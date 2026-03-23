/**
 * Web Bundle orchestrator — generates a single copiable prompt bundle for web platforms.
 * Reads active squad agent definitions, constitution, and project context; assembles
 * them into a bundle using foundation/bundle.ts primitives.
 *
 * @module squads/web-bundle
 * @see FR-105 Web Bundle Generator
 * @see US-043 Epic 10.1: Web Bundle Export Command
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  estimateTokens,
  assembleBundle,
  checkTokenBudget,
  applyStandardCompression,
  computeBundleHash,
} from '../foundation/bundle.js'
import type { BundlePart, BundlePartMap, AgentFile, CompressedBundle, BundleMetadata } from '../foundation/bundle.js'
import type { SupportedLanguage } from '../contracts/i18n.js'
import { createI18n } from '../foundation/i18n.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Jargon blocklist — host model must NEVER use these terms with the user
// ---------------------------------------------------------------------------

/**
 * Technical jargon that the host model must never surface to non-technical users.
 * Includes both English and PT-BR variants so the host model blocks them in both languages.
 * @see AC-1 — Conversational mode: no technical terms in user-facing conversation
 */
export const JARGON_BLOCKLIST: Readonly<Record<'en' | 'pt-br', readonly string[]>> = {
  en: [
    'repository', 'branch', 'commit', 'YAML', 'JSON', 'pipeline', 'subagent',
    'orchestrator', 'TypeScript', 'JavaScript', 'npm', 'CLI', 'terminal', 'chmod',
    'export', 'import', 'module', 'workflow file', 'markdown', 'prompt injection', 'token',
  ],
  'pt-br': [
    'repositório', 'ramo', 'confirmação', 'arquivo YAML', 'arquivo JSON', 'pipeline',
    'subagente', 'orquestrador', 'terminal', 'linha de comando', 'módulo',
  ],
}

// ---------------------------------------------------------------------------
// generateConversationalPreamble (AC-1, AC-2)
// ---------------------------------------------------------------------------

/**
 * Generate the conversational activation preamble for a web bundle.
 *
 * Instructs the host model (Claude.ai / ChatGPT) to operate in conversational
 * mode — replacing all /bp:* commands with numbered natural language options,
 * never surfacing technical jargon, and always responding in the configured language.
 *
 * The full jargon blocklist (EN + PT-BR) is embedded so the host model suppresses
 * these terms regardless of which language the user writes in.
 *
 * Phase prompts are loaded from `locales/<lang>.yaml` under `bundle.conversational.*`.
 *
 * @param squadName - Name of the active squad, or undefined when none is set
 * @param language  - Bundle language ('en' | 'pt-br') — controls all user-facing text
 * @see AC-1 — All /bp:* commands replaced with numbered natural language options
 * @see AC-2 — Full PT-BR support with no English fallback
 */
export function generateConversationalPreamble(
  squadName: string | undefined,
  language: SupportedLanguage,
): string {
  const i18n = createI18n(language)
  const squadLabel = squadName ? ` "${squadName}"` : ''

  // Combine both EN and PT-BR blocked terms — the host model should block them in any language
  const allBlockedTerms = [
    ...JARGON_BLOCKLIST.en,
    ...JARGON_BLOCKLIST['pt-br'],
  ].join(', ')

  // Phase prompts loaded from locale files (bundle.conversational.phase_*)
  const phaseLines = [
    `- specify: "${i18n.t('bundle.conversational.phase_specify')}"`,
    `- plan: "${i18n.t('bundle.conversational.phase_plan')}"`,
    `- execute: "${i18n.t('bundle.conversational.phase_execute')}"`,
    `- verify: "${i18n.t('bundle.conversational.phase_verify')}"`,
  ].join('\n')

  if (language === 'pt-br') {
    return [
      `Você é o assistente${squadLabel} configurado com o BuildPact.`,
      `Siga as regras abaixo para TODAS as respostas.`,
      '',
      '## Regras de Interação Conversacional',
      `1. NUNCA use comandos /bp:* — substitua por opções numeradas em linguagem natural.`,
      `2. NUNCA use os seguintes termos com o usuário: ${allBlockedTerms}`,
      `3. SEMPRE responda em Português (Brasil). Se o usuário escrever em outro idioma, reconheça mas continue em Português.`,
      `4. Apresente todas as escolhas como opções numeradas e aguarde o usuário escolher.`,
      `5. Faça uma pergunta por vez.`,
      '',
      '## Prompts de Fase',
      phaseLines,
    ].join('\n')
  }

  return [
    `You are the assistant${squadLabel} configured with BuildPact.`,
    `Follow the rules below for ALL responses.`,
    '',
    '## Conversational Interaction Rules',
    `1. NEVER use /bp:* commands — replace with numbered options in natural language.`,
    `2. NEVER use the following technical terms with the user: ${allBlockedTerms}`,
    `3. ALWAYS respond in English. If the user writes in another language, acknowledge it but continue in English.`,
    `4. Present all choices as numbered options and wait for the user to choose.`,
    `5. Ask one question at a time.`,
    '',
    '## Phase Prompts',
    phaseLines,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Degradation tiers (AC-2)
// ---------------------------------------------------------------------------

/**
 * Graceful degradation tier applied when standard compression is not enough.
 * Each tier is additive — tier 2 includes tier 1 changes.
 *
 * @see AC-2 — Graceful degradation tiers when over limit
 */
export enum DegradationTier {
  /** No degradation — full standard-compressed bundle */
  NONE = 0,
  /** Tier 1: Remove ## Examples sections from all agent files */
  REMOVE_EXAMPLES = 1,
  /** Tier 2: Remove ## Heuristics sections except VETO: lines */
  REMOVE_HEURISTICS = 2,
  /** Tier 3: Keep only the Chief orchestrator agent */
  CHIEF_ONLY = 3,
  /** Tier 4: Minimal "quick session" bundle — specify phase only, no Constitution */
  QUICK_SESSION = 4,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for web bundle generation */
export interface WebBundleOptions {
  /** Project root directory (must contain .buildpact/) */
  projectDir: string
  /** Language override; falls back to config.yaml → language → 'en' */
  language?: SupportedLanguage
}

/** Result returned by generateWebBundle */
export interface WebBundleResult {
  /** Full assembled bundle text ready to be written to disk */
  content: string
  /** Estimated token count (Math.ceil(content.length / 4)) */
  tokenCount: number
  /** true when the bundle still exceeds the platform limit after standard compression */
  needsDegradation: boolean
  /** The CompressedBundle produced by applyStandardCompression — use with applyDegradationTier */
  compressedBundle: CompressedBundle
  /** Degradation tiers the CLI handler may present to the user */
  availableTiers: DegradationTier[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read `language` field from .buildpact/config.yaml, fallback to 'en' */
async function readConfigLanguage(projectDir: string): Promise<SupportedLanguage> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('language:')) {
        const value = trimmed.slice('language:'.length).trim().replace(/^["']|["']$/g, '')
        if (value === 'pt-br' || value === 'en') return value
      }
    }
  } catch {
    // Config missing
  }
  return 'en'
}

/** Read `active_squad` field from .buildpact/config.yaml */
async function readActiveSquad(projectDir: string): Promise<string | undefined> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('active_squad:')) {
        const value = trimmed.slice('active_squad:'.length).trim().replace(/^["']|["']$/g, '')
        if (value && value !== 'none') return value
      }
    }
  } catch {
    // Config missing
  }
  return undefined
}

/**
 * Extract bundle_disclaimers from squad.yaml using regex parsing (no YAML library).
 * Returns bilingual disclaimer or empty string.
 */
async function readBundleDisclaimer(
  projectDir: string,
  squadName: string,
  language: SupportedLanguage,
): Promise<string> {
  try {
    const yamlPath = join(projectDir, '.buildpact', 'squads', squadName, 'squad.yaml')
    const content = await readFile(yamlPath, 'utf-8')

    // Find bundle_disclaimers block and extract the language-specific value
    const disclaimerMatch = content.match(/bundle_disclaimers:\s*\n([\s\S]*?)(?=\n\w|\n#|$)/m)
    if (!disclaimerMatch) return ''

    const block = disclaimerMatch[1] ?? ''
    const langKey = language === 'pt-br' ? 'pt-br' : 'en'

    // Match `  pt-br: "value"` or `  en: 'value'` or unquoted
    const lineMatch = block.match(
      new RegExp(`\\s+${langKey.replace('-', '\\-')}:\\s+["']?([^"'\n]+)["']?`),
    )
    return lineMatch ? (lineMatch[1] ?? '').trim() : ''
  } catch {
    return ''
  }
}

/** Build the activation preamble in the configured language */
function buildActivationPreamble(
  platform: string,
  squadName: string | undefined,
  language: SupportedLanguage,
): string {
  const squadLabel = squadName ? ` "${squadName}"` : ''
  if (language === 'pt-br') {
    return [
      `Você é um assistente de desenvolvimento configurado com o BuildPact Squad${squadLabel}.`,
      'Siga as regras abaixo para todas as respostas.',
      '',
      '## Regras de Interação Conversacional',
      '1. Guie os usuários com conversa natural — não use comandos ou atalhos técnicos.',
      '2. Apresente todas as escolhas como opções numeradas e peça ao usuário para digitar um número ou descrever sua escolha.',
      '3. Use linguagem simples: evite termos técnicos como repositório, branch, commit, YAML, pipeline e subagente.',
      '4. Aplique sua expertise no domínio em cada tarefa e siga as regras do projeto o tempo todo.',
      '5. Faça uma pergunta por vez e aguarde a resposta do usuário antes de continuar.',
    ].join('\n')
  }
  return [
    `You are a development assistant configured with BuildPact Squad${squadLabel}.`,
    'Follow the rules below for all responses.',
    '',
    '## Conversational Interaction Rules',
    '1. Guide users through natural conversation — do not use commands or technical shortcuts.',
    '2. Present all choices as numbered options and ask the user to type a number or describe their choice.',
    '3. Use plain language: avoid technical terms such as repository, branch, commit, YAML, pipeline, and subagent.',
    '4. Apply your domain expertise for every task and follow the project rules at all times.',
    '5. Ask one question at a time and wait for the user\'s answer before continuing.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Degradation helpers (operate on assembled bundle content)
// ---------------------------------------------------------------------------

/** Remove all `## Examples` sections from a markdown string */
function _removeExamplesSection(content: string): string {
  const lines = content.split('\n')
  const out: string[] = []
  let skip = false
  for (const line of lines) {
    // Bundle section delimiters (=== HEADER ===) always reset skip
    if (line.startsWith('=== ')) {
      skip = false
    } else if (line.startsWith('## ')) {
      skip = line.slice(3).toLowerCase().includes('example')
    }
    if (!skip) out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * Remove all `## Heuristics` sections from a markdown string,
 * but keep any line that starts with `VETO:` or `- VETO:` (mandatory rules).
 */
function _removeHeuristicsSection(content: string): string {
  const lines = content.split('\n')
  const out: string[] = []
  let inHeuristics = false
  for (const line of lines) {
    // Bundle section delimiters (=== HEADER ===) always reset inHeuristics
    if (line.startsWith('=== ')) {
      inHeuristics = false
    } else if (line.startsWith('## ')) {
      inHeuristics = line.slice(3).toLowerCase().includes('heuristic')
    }
    if (!inHeuristics) {
      out.push(line)
    } else {
      // Keep VETO: rules even within heuristics sections
      const t = line.trim()
      if (t.startsWith('VETO:') || t.startsWith('- VETO:')) {
        out.push(line)
      }
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * Within the `=== SQUAD AGENTS ===` section, keep only the agent named
 * "chief" (or the first agent if no chief exists). Chief-only mode.
 */
function _applyChiefOnly(content: string): string {
  // Match the SQUAD AGENTS section (up to the next === or end of string)
  const sectionRe = /(=== SQUAD AGENTS ===\n)([\s\S]*?)(?=\n\n===|\n===|$)/
  const match = content.match(sectionRe)
  if (!match) return content

  const header = match[1] ?? '=== SQUAD AGENTS ===\n'
  const body = match[2] ?? ''

  // Split agents by `--- name ---` delimiter
  const agentBlocks = body.split(/(?=--- .+ ---)/).filter((b) => b.trim().length > 0)

  // Find chief (case-insensitive name match)
  const chiefBlock =
    agentBlocks.find((b) => /^---\s*\S*chief\S*\s*---/i.test(b.trim())) ?? agentBlocks[0]

  if (!chiefBlock) return content

  return content.replace(sectionRe, `${header}${chiefBlock.trim()}`)
}

/**
 * Remove `=== CONSTITUTION RULES ===` and `=== PROJECT CONTEXT ===` sections
 * from the assembled bundle (Tier 4 — quick session).
 */
function _removeConstitutionAndContext(content: string): string {
  // Remove each section (header + body up to next === or end)
  const removeSectionRe = (header: string) =>
    new RegExp(`\\n\\n=== ${header} ===\\n[\\s\\S]*?(?=\\n\\n===|$)`, 'g')

  return content
    .replace(removeSectionRe('CONSTITUTION RULES'), '')
    .replace(removeSectionRe('PROJECT CONTEXT'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Extract platform string from bundle content header (e.g. `Platform: claude.ai`) */
function _extractPlatform(content: string): string {
  const m = content.match(/^Platform:\s*(.+)$/m)
  return m ? (m[1] ?? 'the target platform').trim() : 'the target platform'
}

/** Build the degradation note text to inject into the bundle */
function _buildDegradationNote(
  platform: string,
  sectionsRemoved: string[],
  tier: DegradationTier,
  language: SupportedLanguage = 'en',
): string {
  const i18n = createI18n(language)
  const tierLabels: Record<DegradationTier, string> = {
    [DegradationTier.NONE]: '',
    [DegradationTier.REMOVE_EXAMPLES]: 'agent examples removed',
    [DegradationTier.REMOVE_HEURISTICS]: 'agent examples and heuristics removed',
    [DegradationTier.CHIEF_ONLY]: 'reduced to chief-only mode',
    [DegradationTier.QUICK_SESSION]: 'minimal quick-session bundle',
  }
  const removed = sectionsRemoved.length > 0 ? sectionsRemoved.join(', ') : tierLabels[tier]

  // PT-BR bundles use a user-friendly locale string (no technical jargon)
  if (language === 'pt-br') {
    return [
      i18n.t('bundle.conversational.bundle_too_large'),
      `Removido: ${removed}`,
    ].join('\n')
  }

  return [
    `This bundle was compressed to fit within ${platform}'s token limit.`,
    `Removed: ${removed}`,
    `To access full functionality, ask the Squad creator for an updated export`,
    `targeting a platform with a higher token limit (e.g., Gemini 1M).`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// applyDegradationTier (AC-2)
// ---------------------------------------------------------------------------

/**
 * Apply a graceful degradation tier to a CompressedBundle.
 * Each tier is additive — tier 2 includes all changes from tier 1.
 *
 * Injects a `=== COMPRESSION NOTE ===` section inside the bundle when tier > NONE.
 * The note documents what was removed so non-technical users understand the limitation.
 *
 * @see AC-2 — Graceful degradation tiers when over limit
 */
export function applyDegradationTier(
  bundle: CompressedBundle,
  tier: DegradationTier,
  language: SupportedLanguage = 'en',
): CompressedBundle {
  if (tier === DegradationTier.NONE) return bundle

  let content = bundle.content
  const sectionsRemoved = [...bundle.sectionsRemoved]

  // Tier 1: Remove agent examples (additive base)
  if (tier >= DegradationTier.REMOVE_EXAMPLES) {
    content = _removeExamplesSection(content)
    sectionsRemoved.push('agent-examples')
  }

  // Tier 2: Remove heuristics (keep VETO: lines)
  if (tier >= DegradationTier.REMOVE_HEURISTICS) {
    content = _removeHeuristicsSection(content)
    sectionsRemoved.push('agent-heuristics')
  }

  // Tier 3: Chief-only — remove all non-chief agents
  if (tier >= DegradationTier.CHIEF_ONLY) {
    content = _applyChiefOnly(content)
    sectionsRemoved.push('non-chief-agents')
  }

  // Tier 4: Quick session — remove Constitution and Project Context
  if (tier >= DegradationTier.QUICK_SESSION) {
    content = _removeConstitutionAndContext(content)
    sectionsRemoved.push('constitution', 'project-context')
  }

  // Inject degradation note before === DISCLAIMER === (or append if not found)
  const platform = _extractPlatform(content)
  const noteBody = _buildDegradationNote(platform, sectionsRemoved, tier, language)
  const noteSection = `=== COMPRESSION NOTE ===\n${noteBody}`

  if (content.includes('=== DISCLAIMER ===')) {
    content = content.replace('=== DISCLAIMER ===', `${noteSection}\n\n=== DISCLAIMER ===`)
  } else {
    content = content + '\n\n' + noteSection
  }

  const compressionLevel = (Math.min(tier, 4) as 0 | 1 | 2 | 3 | 4)

  return {
    content: content.trim(),
    compressionLevel,
    sectionsRemoved,
    tokenCount: estimateTokens(content),
  }
}

// ---------------------------------------------------------------------------
// Story 10.4: Staleness instruction generator (Task 2)
// ---------------------------------------------------------------------------

/**
 * Generate a staleness check instruction for the host model.
 * This instruction is embedded in the activation preamble so the host model
 * (Claude.ai / ChatGPT) evaluates the bundle's expiry date at conversation start.
 *
 * The instruction is clearly marked "for host model only" to prevent it from
 * being surfaced to non-technical users.
 *
 * @param generatedAt - ISO 8601 timestamp of bundle generation
 * @param expiryDate  - ISO 8601 timestamp 7 days after generatedAt
 * @param language    - Bundle language ('en' | 'pt-br')
 * @see AC-2 — Staleness warning when bundle is older than 7 days
 */
function _generateStalenessInstruction(
  generatedAt: string,
  expiryDate: string,
  language: SupportedLanguage,
): string {
  const i18n = createI18n(language)
  const warningMsg = i18n.t('bundle.conversational.staleness_warning')
  const langLabel = language === 'pt-br' ? 'Português (Brasil)' : 'English'
  return [
    'STALENESS CHECK INSTRUCTION (for host model only — not shown to user):',
    `This bundle was generated on ${generatedAt}. It expires on ${expiryDate}.`,
    `If today's date is later than ${expiryDate}:`,
    `  Display this message to the user (in ${langLabel}):`,
    `  "${warningMsg}"`,
    `  Then continue with the normal workflow.`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a web bundle for the given platform.
 *
 * Orchestrates reading squad agent definitions, constitution rules, project
 * context, and disclaimer text; assembles them into a single prompt file
 * using `assembleBundle()` from `foundation/bundle.ts`.
 *
 * @param platform - Target platform key (e.g. 'claude.ai', 'chatgpt', 'gemini')
 * @param options  - Generation options (projectDir, optional language override)
 */
export async function generateWebBundle(
  platform: string,
  options: WebBundleOptions,
): Promise<WebBundleResult> {
  const { projectDir } = options
  const language: SupportedLanguage = options.language ?? (await readConfigLanguage(projectDir))

  const squadName = await readActiveSquad(projectDir)

  // Load all source files in parallel (Steps 3 & 4: do NOT include memory/ or feedback/)
  const [constitutionRaw, projectContextRaw, agentFileList, disclaimer, squadYamlRaw] = await Promise.all([
    readFile(join(projectDir, '.buildpact', 'constitution.md'), 'utf-8').catch(() => ''),
    readFile(join(projectDir, '.buildpact', 'project-context.md'), 'utf-8').catch(() => ''),
    squadName ? _readAgentFiles(projectDir, squadName) : Promise.resolve([] as AgentFile[]),
    squadName
      ? readBundleDisclaimer(projectDir, squadName, language)
      : Promise.resolve(''),
    // Task 3.1: Read squad.yaml for source file tracking
    squadName
      ? readFile(join(projectDir, '.buildpact', 'squads', squadName, 'squad.yaml'), 'utf-8').catch(() => '')
      : Promise.resolve(''),
  ])

  // Task 3.1/3.2: Track all source files read during bundle assembly
  // Relative paths are relative to .buildpact/ root for portability (Task 3.3)
  const sourceContents: string[] = []
  const sourcePaths: string[] = []

  if (constitutionRaw) {
    sourceContents.push(constitutionRaw)
    sourcePaths.push('constitution.md')
  }
  if (projectContextRaw) {
    sourceContents.push(projectContextRaw)
    sourcePaths.push('project-context.md')
  }
  for (const agent of agentFileList) {
    sourceContents.push(agent.content)
    sourcePaths.push(`squads/${squadName}/agents/${agent.name}.md`)
  }
  if (squadName && squadYamlRaw) {
    sourceContents.push(squadYamlRaw)
    sourcePaths.push(`squads/${squadName}/squad.yaml`)
  }

  // Task 1.1: Compute bundle hash from source file contents
  const bundleHash = computeBundleHash(sourceContents)

  // Apply standard compression (AC-1 steps 1–4) before token check
  const bundlePartMap: BundlePartMap = {
    agents: agentFileList,
    activeSquad: squadName ?? '',
    constitution: constitutionRaw,
    projectContext: projectContextRaw,
    platform,
  }
  const compressedCore = applyStandardCompression(bundlePartMap)

  // Build non-compressible sections (activation preamble + header)
  const activationPreamble = generateConversationalPreamble(squadName, language)
  const generatedAt = new Date().toISOString()

  // Task 2.1: Compute expiry date (generatedAt + 7 days)
  const expiryDate = new Date(
    new Date(generatedAt).getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString()

  // Task 2.2/2.3/2.4: Generate staleness instruction for host model
  const stalenessInstruction = _generateStalenessInstruction(generatedAt, expiryDate, language)

  // Combine activation preamble with staleness instruction
  const fullActivationPreamble = `${activationPreamble}\n\n${stalenessInstruction}`

  const headerContent = [`Platform: ${platform}`, `Generated: ${generatedAt}`].join('\n')

  // Task 1.2: Create BundleMetadata for header injection
  const metadata: BundleMetadata = {
    generatedAt,
    platform,
    bundleHash,
    sourceFiles: sourcePaths,
    stalenessThresholdDays: 7,
  }

  const headerActivationParts: BundlePart[] = [
    { header: 'BUILDPACT WEB BUNDLE', content: headerContent },
    { header: 'ACTIVATION INSTRUCTIONS', content: fullActivationPreamble },
  ]
  // Task 1.3: Pass metadata to assembleBundle to include in header section
  const headerActivation = assembleBundle(headerActivationParts, metadata)

  // Assemble full bundle: header + activation + compressed core + disclaimer
  const mergedContent = mergeFullBundle(headerActivation, compressedCore.content, disclaimer)

  const tokenCount = estimateTokens(mergedContent)

  // Task 3.2: Return degradation info when bundle still exceeds platform limit
  const { withinLimit } = checkTokenBudget(tokenCount, platform)
  const needsDegradation = !withinLimit

  // The compressedBundle for the caller contains the full merged content
  const fullCompressedBundle: CompressedBundle = {
    content: mergedContent,
    compressionLevel: compressedCore.compressionLevel,
    sectionsRemoved: compressedCore.sectionsRemoved,
    tokenCount,
  }

  const availableTiers: DegradationTier[] = needsDegradation
    ? [
        DegradationTier.REMOVE_EXAMPLES,
        DegradationTier.REMOVE_HEURISTICS,
        DegradationTier.CHIEF_ONLY,
        DegradationTier.QUICK_SESSION,
      ]
    : []

  return {
    content: mergedContent,
    tokenCount,
    needsDegradation,
    compressedBundle: fullCompressedBundle,
    availableTiers,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read agent files from the squad's agents/ directory (or squad root fallback),
 * returning them as AgentFile[] for use with applyStandardCompression.
 */
async function _readAgentFiles(projectDir: string, squadName: string): Promise<AgentFile[]> {
  const agentsDir = join(projectDir, '.buildpact', 'squads', squadName, 'agents')
  let dir = agentsDir
  try {
    await readdir(agentsDir) // probe
  } catch {
    // Fallback to squad root
    dir = join(projectDir, '.buildpact', 'squads', squadName)
  }
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort()
    const agentFiles: AgentFile[] = []
    for (const file of files) {
      try {
        const content = await readFile(join(dir, file), 'utf-8')
        agentFiles.push({ name: file.replace('.md', ''), content, squad: squadName })
      } catch {
        // Skip unreadable files
      }
    }
    return agentFiles
  } catch {
    return []
  }
}

/**
 * Merge the full bundle (header + activation) with the compressed core content
 * and the disclaimer to produce the final bundle text.
 */
function mergeFullBundle(
  fullContentWithoutCore: string,
  coreContent: string,
  disclaimer: string,
): string {
  const headerAndActivation = fullContentWithoutCore
  const parts: string[] = [headerAndActivation]

  if (coreContent.trim()) {
    parts.push(coreContent.trim())
  }

  if (disclaimer.trim()) {
    parts.push(`=== DISCLAIMER ===\n${disclaimer.trim()}`)
  }

  return parts.join('\n\n')
}
