/**
 * Export-web command handler.
 * Generates a single copiable prompt bundle for Claude.ai/ChatGPT/Gemini.
 * @see FR-1001 — Web Bundle Export Command
 * @see US-043 — Epic 10.1: Web Bundle Export Command
 */

import * as clack from '@clack/prompts'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'

// ---------------------------------------------------------------------------
// Compression tiers
// ---------------------------------------------------------------------------

/** Progressive compression tier applied to fit within platform token limits */
export type CompressionTier =
  | 'none'
  | 'inline_agents'
  | 'compress_constitution'
  | 'exclude_optional_sections'
  | 'context_only'
  | 'remove_examples'
  | 'remove_heuristics'
  | 'chief_only'
  | 'minimal'

/** Human-readable description of each compression tier, embedded in bundle notices */
export const COMPRESSION_TIER_DESCRIPTIONS: Record<CompressionTier, string> = {
  none: '',
  inline_agents: 'Agent definitions compressed: section headers removed, whitespace minimized.',
  compress_constitution:
    'Constitution compressed to essential rules only (first 500 characters).',
  exclude_optional_sections:
    'Optional sections (Optimization, Memory, Tips, Performance) excluded to reduce size.',
  context_only: 'Bundle reduced to project context only — agent definitions excluded.',
  remove_examples: 'Example blocks removed from all sections to reduce size.',
  remove_heuristics: 'Heuristic detail sections removed; core rules retained.',
  chief_only:
    'Only the Chief agent definition included; specialist agents excluded.',
  minimal:
    'Minimal quick-session bundle: core instructions only, no agent definitions or project context.',
}

// ---------------------------------------------------------------------------
// Platform token limits
// ---------------------------------------------------------------------------

/** Supported web platform targets */
export type WebPlatform = 'claude' | 'chatgpt' | 'gemini'

/** Token limits per platform (context window sizes) */
export const PLATFORM_TOKEN_LIMITS: Record<WebPlatform, number> = {
  claude: 180_000,
  chatgpt: 128_000,
  gemini: 1_000_000,
}

/** Warning threshold — warn when bundle exceeds this fraction of the limit */
export const WARN_THRESHOLD = 0.8

// ---------------------------------------------------------------------------
// Token estimation (rough approximation: 1 token ≈ 4 chars)
// ---------------------------------------------------------------------------

/**
 * Estimate token count for a string.
 * Uses the 4-chars-per-token heuristic widely used for LLM estimates.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Check if estimated token count exceeds the platform warning threshold.
 */
export function checkTokenWarning(
  tokens: number,
  platform: WebPlatform,
): { overLimit: boolean; overWarn: boolean; limitTokens: number } {
  const limitTokens = PLATFORM_TOKEN_LIMITS[platform]!
  return {
    overLimit: tokens > limitTokens,
    overWarn: tokens > Math.floor(limitTokens * WARN_THRESHOLD),
    limitTokens,
  }
}

// ---------------------------------------------------------------------------
// File loading helpers
// ---------------------------------------------------------------------------

/** Read language from .buildpact/config.yaml, fallback to 'en' */
async function readLanguage(projectDir: string): Promise<SupportedLanguage> {
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
    // Config missing — fall back to English
  }
  return 'en'
}

/**
 * Load the project constitution essentials.
 * Returns a condensed version (first 2000 chars) or empty string if missing.
 */
export async function loadConstitutionEssentials(projectDir: string): Promise<string> {
  try {
    const content = await readFile(
      join(projectDir, '.buildpact', 'constitution.md'),
      'utf-8',
    )
    // Return first 2000 chars as "essentials" — keeps bundle compact
    return content.slice(0, 2000)
  } catch {
    return ''
  }
}

/**
 * Load project context from .buildpact/project-context.md.
 * Returns the content or empty string if missing.
 */
export async function loadProjectContext(projectDir: string): Promise<string> {
  try {
    return await readFile(join(projectDir, '.buildpact', 'project-context.md'), 'utf-8')
  } catch {
    return ''
  }
}

/** A single agent file content loaded from a squad */
export interface AgentContent {
  name: string
  content: string
}

/**
 * Load compressed squad agent definitions from .buildpact/squads/<squadName>/.
 * Reads all .md files and compresses whitespace.
 * Returns empty array if squad not found.
 */
export async function loadSquadAgents(
  projectDir: string,
  squadName: string,
): Promise<AgentContent[]> {
  const { readdir } = await import('node:fs/promises')
  const squadDir = join(projectDir, '.buildpact', 'squads', squadName)
  try {
    const files = await readdir(squadDir)
    const mdFiles = files.filter((f) => f.endsWith('.md'))
    const agents: AgentContent[] = []
    for (const file of mdFiles) {
      try {
        const raw = await readFile(join(squadDir, file), 'utf-8')
        // Compress: collapse multiple blank lines, trim trailing whitespace per line
        const compressed = raw
          .split('\n')
          .map((l) => l.trimEnd())
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        agents.push({ name: file.replace('.md', ''), content: compressed })
      } catch {
        // Skip unreadable files
      }
    }
    return agents
  } catch {
    return []
  }
}

/**
 * Read the active squad name from .buildpact/config.yaml.
 * Returns undefined if no squad is set or config is missing.
 */
export async function readActiveSquadName(projectDir: string): Promise<string | undefined> {
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

// ---------------------------------------------------------------------------
// Progressive compression helpers
// ---------------------------------------------------------------------------

/**
 * Tier 1 — Inline agents: strip markdown headers from agent content and
 * collapse whitespace. Reduces size while preserving rules.
 */
export function inlineAgents(agents: AgentContent[]): AgentContent[] {
  return agents.map((agent) => ({
    ...agent,
    content: agent.content
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .map((l) => l.trimEnd())
      .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
      .join('\n')
      .trim(),
  }))
}

/**
 * Tier 2 — Compress constitution: return first ~500 chars only.
 */
export function compressConstitution(content: string): string {
  return content.slice(0, 500)
}

/** Section headings that are considered optional and can be excluded */
const OPTIONAL_SECTION_KEYWORDS = ['optimization', 'memory', 'tips', 'performance']
/** Section headings identifying example blocks */
const EXAMPLES_SECTION_KEYWORDS = ['example']
/** Section headings identifying heuristic/detail blocks */
const HEURISTICS_SECTION_KEYWORDS = ['heuristic', 'detail']

/**
 * Tier 3 — Exclude optional sections: remove ## Optimization / Memory / Tips /
 * Performance headings and their content from a markdown string.
 */
export function excludeOptionalSections(content: string): string {
  return _removeSectionsByKeywords(content, OPTIONAL_SECTION_KEYWORDS)
}

/**
 * Degradation Tier D1 — Remove examples: strip ## Examples sections.
 */
export function removeExamples(content: string): string {
  return _removeSectionsByKeywords(content, EXAMPLES_SECTION_KEYWORDS)
}

/**
 * Degradation Tier D2 — Remove heuristics: strip ## Heuristics / ## Details sections.
 */
export function removeHeuristics(content: string): string {
  return _removeSectionsByKeywords(content, HEURISTICS_SECTION_KEYWORDS)
}

/** Remove level-2 `##` sections whose heading matches any of the given keywords. */
function _removeSectionsByKeywords(content: string, keywords: string[]): string {
  const lines = content.split('\n')
  const out: string[] = []
  let skip = false

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const heading = line.slice(3).toLowerCase()
      skip = keywords.some((k) => heading.includes(k))
    }
    if (!skip) out.push(line)
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Degradation Tier D3 — Chief-only: keep only the agent named 'chief'
 * (or the first agent if no chief exists).
 */
export function filterChiefOnly(agents: AgentContent[]): AgentContent[] {
  const chief = agents.find((a) => a.name.toLowerCase().includes('chief'))
  return chief ? [chief] : agents.slice(0, 1)
}

// ---------------------------------------------------------------------------
// Bundle builder
// ---------------------------------------------------------------------------

/** Input data for assembling the web bundle */
export interface WebBundleInput {
  platform: WebPlatform
  squadName: string | undefined
  agents: AgentContent[]
  constitutionEssentials: string
  projectContext: string
  language: SupportedLanguage
  /** Compression tier applied — when set (and not 'none'), a notice is embedded in the bundle */
  compressionTier?: CompressionTier
}

/** Result of assembling a web bundle */
export interface WebBundleResult {
  content: string
  tokenEstimate: number
  platform: WebPlatform
}

/**
 * Build the final .txt bundle content from all components.
 * Structure: workflow header, constitution essentials, project context, agent definitions.
 */
export function buildWebBundle(input: WebBundleInput): WebBundleResult {
  const {
    platform,
    squadName,
    agents,
    constitutionEssentials,
    projectContext,
    language,
    compressionTier,
  } = input

  const platformLabel =
    platform === 'claude' ? 'Claude.ai' : platform === 'chatgpt' ? 'ChatGPT' : 'Gemini'

  const activationInstruction =
    language === 'pt-br'
      ? `Você é um assistente de desenvolvimento configurado com o BuildPact Squad${squadName ? ` "${squadName}"` : ''}. Siga as regras abaixo para todas as respostas.`
      : `You are a development assistant configured with BuildPact Squad${squadName ? ` "${squadName}"` : ''}. Follow the rules below for all responses.`

  const sections: string[] = []

  // Header
  sections.push(
    `# BuildPact Web Bundle — ${platformLabel}`,
    `# Generated: ${new Date().toISOString()}`,
    '',
    '## Activation Instructions',
    activationInstruction,
    '',
  )

  // Workflow instructions
  sections.push(
    '## Workflow Instructions',
    '1. Read all rules in this bundle before responding.',
    '2. Apply the Squad domain expertise for every task.',
    '3. Follow the Constitution principles at all times.',
    '4. Use the project context to understand codebase constraints.',
    '',
  )

  // Constitution essentials
  if (constitutionEssentials) {
    sections.push('## Constitution Essentials', constitutionEssentials.trim(), '')
  }

  // Project context
  if (projectContext) {
    sections.push('## Project Context', projectContext.trim(), '')
  }

  // Agent definitions
  if (agents.length > 0) {
    sections.push('## Squad Agent Definitions')
    for (const agent of agents) {
      sections.push(`### Agent: ${agent.name}`, agent.content, '')
    }
  }

  // Bundle compression notice — document which tier was applied
  if (compressionTier && compressionTier !== 'none') {
    const description = COMPRESSION_TIER_DESCRIPTIONS[compressionTier]
    sections.push(
      '## Bundle Compression Notice',
      `This bundle was automatically compressed to fit within the ${platformLabel} token limit.`,
      `Applied compression tier: **${compressionTier}**`,
      description,
      '',
    )
  }

  const content = sections.join('\n')
  const tokenEstimate = estimateTokens(content)

  return { content, tokenEstimate, platform }
}

// ---------------------------------------------------------------------------
// Progressive compression orchestrator
// ---------------------------------------------------------------------------

/**
 * Try to build a bundle that fits within `tokenLimit`.
 * Applies compression tiers in sequence, returning the first result that fits.
 * Each tier is cumulative — later tiers build on earlier ones.
 *
 * Sequence:
 *   1. none                  — full bundle as-is
 *   2. inline_agents         — strip headers from agent content
 *   3. compress_constitution — truncate constitution to 500 chars
 *   4. exclude_optional_sections — remove Optimization/Memory/Tips from agents & constitution
 *   5. context_only          — drop all agents
 *   6. remove_examples       — strip ## Examples from project context
 *   7. remove_heuristics     — strip ## Heuristics/Details from project context
 *   8. chief_only            — restore chief agent, compressed constitution, no context
 *   9. minimal               — bare header only
 */
export function applyProgressiveCompression(
  input: WebBundleInput,
  tokenLimit: number,
): { result: WebBundleResult; tier: CompressionTier } {
  const tryBuild = (partial: WebBundleInput, tier: CompressionTier) =>
    buildWebBundle({ ...partial, compressionTier: tier })

  // Tier 0: none
  const t0 = tryBuild(input, 'none')
  if (t0.tokenEstimate <= tokenLimit) return { result: t0, tier: 'none' }

  // Tier 1: inline agents
  const t1Input: WebBundleInput = { ...input, agents: inlineAgents(input.agents) }
  const t1 = tryBuild(t1Input, 'inline_agents')
  if (t1.tokenEstimate <= tokenLimit) return { result: t1, tier: 'inline_agents' }

  // Tier 2: + compress constitution
  const t2Input: WebBundleInput = {
    ...t1Input,
    constitutionEssentials: compressConstitution(t1Input.constitutionEssentials),
  }
  const t2 = tryBuild(t2Input, 'compress_constitution')
  if (t2.tokenEstimate <= tokenLimit) return { result: t2, tier: 'compress_constitution' }

  // Tier 3: + exclude optional sections from agents & constitution
  const t3Input: WebBundleInput = {
    ...t2Input,
    agents: t2Input.agents.map((a) => ({ ...a, content: excludeOptionalSections(a.content) })),
    constitutionEssentials: excludeOptionalSections(t2Input.constitutionEssentials),
  }
  const t3 = tryBuild(t3Input, 'exclude_optional_sections')
  if (t3.tokenEstimate <= tokenLimit) return { result: t3, tier: 'exclude_optional_sections' }

  // Tier 4: context only — remove all agents
  const t4Input: WebBundleInput = { ...t3Input, agents: [], constitutionEssentials: '' }
  const t4 = tryBuild(t4Input, 'context_only')
  if (t4.tokenEstimate <= tokenLimit) return { result: t4, tier: 'context_only' }

  // Tier 5: + remove examples from project context
  const t5Input: WebBundleInput = {
    ...t4Input,
    projectContext: removeExamples(t4Input.projectContext),
  }
  const t5 = tryBuild(t5Input, 'remove_examples')
  if (t5.tokenEstimate <= tokenLimit) return { result: t5, tier: 'remove_examples' }

  // Tier 6: + remove heuristics from project context
  const t6Input: WebBundleInput = {
    ...t5Input,
    projectContext: removeHeuristics(t5Input.projectContext),
  }
  const t6 = tryBuild(t6Input, 'remove_heuristics')
  if (t6.tokenEstimate <= tokenLimit) return { result: t6, tier: 'remove_heuristics' }

  // Tier 7: chief-only — restore chief agent, no context
  const t7Input: WebBundleInput = {
    ...input,
    agents: filterChiefOnly(input.agents),
    constitutionEssentials: compressConstitution(input.constitutionEssentials),
    projectContext: '',
  }
  const t7 = tryBuild(t7Input, 'chief_only')
  if (t7.tokenEstimate <= tokenLimit) return { result: t7, tier: 'chief_only' }

  // Tier 8: minimal — bare header, nothing else
  const t8Input: WebBundleInput = {
    ...input,
    agents: [],
    constitutionEssentials: '',
    projectContext: '',
  }
  return { result: tryBuild(t8Input, 'minimal'), tier: 'minimal' }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Parse platform from CLI args, defaulting to 'claude' */
export function parsePlatform(args: string[]): WebPlatform {
  const arg = args[0]?.toLowerCase() ?? ''
  if (arg === 'chatgpt') return 'chatgpt'
  if (arg === 'gemini') return 'gemini'
  return 'claude'
}

export const handler: CommandHandler = {
  async run(args: string[]): Promise<Result<void>> {
    const projectDir = process.cwd()
    const lang = await readLanguage(projectDir)
    const i18n = createI18n(lang)
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'audit.log'))

    clack.intro(i18n.t('cli.export_web.welcome'))

    const platform = parsePlatform(args)

    // Log intent
    await audit.log({
      action: 'export_web.start',
      agent: 'export-web',
      files: [],
      outcome: 'success',
    })

    const spinner = clack.spinner()
    spinner.start(i18n.t('cli.export_web.loading'))

    // Load all components in parallel
    const [constitutionEssentials, projectContext, squadName] = await Promise.all([
      loadConstitutionEssentials(projectDir),
      loadProjectContext(projectDir),
      readActiveSquadName(projectDir),
    ])

    const agents = squadName ? await loadSquadAgents(projectDir, squadName) : []

    spinner.stop(i18n.t('cli.export_web.loaded'))

    // Build bundle with progressive compression when needed
    const baseInput: WebBundleInput = {
      platform,
      squadName,
      agents,
      constitutionEssentials,
      projectContext,
      language: lang,
    }
    const limitTokens = PLATFORM_TOKEN_LIMITS[platform]!
    const { result: bundleResult, tier: compressionTier } = applyProgressiveCompression(
      baseInput,
      limitTokens,
    )

    // Notify user when compression was applied
    if (compressionTier !== 'none') {
      clack.log.warn(
        i18n.t('cli.export_web.compression_applied', { tier: compressionTier }),
      )
    }

    // Token warning (for warn threshold — bundle may still be large even after compression)
    const { overLimit, overWarn } = checkTokenWarning(bundleResult.tokenEstimate, platform)

    if (overLimit) {
      clack.log.warn(
        i18n.t('cli.export_web.token_over_limit', {
          tokens: String(bundleResult.tokenEstimate),
          limit: String(limitTokens),
          platform,
        }),
      )
    } else if (overWarn) {
      clack.log.warn(
        i18n.t('cli.export_web.token_warn', {
          tokens: String(bundleResult.tokenEstimate),
          limit: String(limitTokens),
          pct: String(Math.round((bundleResult.tokenEstimate / limitTokens) * 100)),
        }),
      )
    }

    // Write bundle
    const outputDir = join(projectDir, '.buildpact', 'bundles')
    const filename = `web-bundle-${platform}-${Date.now()}.txt`
    const outputPath = join(outputDir, filename)

    try {
      await mkdir(outputDir, { recursive: true })
      await writeFile(outputPath, bundleResult.content, 'utf-8')
    } catch (cause) {
      const result = err<void>({
        code: ERROR_CODES.FILE_WRITE_FAILED,
        i18nKey: 'error.file.write_failed',
        params: { path: outputPath, reason: String(cause) },
        cause,
      })
      await audit.log({
        action: 'export_web.write',
        agent: 'export-web',
        files: [],
        outcome: 'failure',
        error: String(cause),
      })
      return result
    }

    await audit.log({
      action: 'export_web.complete',
      agent: 'export-web',
      files: [outputPath],
      outcome: 'success',
    })

    clack.log.success(
      i18n.t('cli.export_web.done', {
        path: outputPath,
        tokens: String(bundleResult.tokenEstimate),
        platform,
      }),
    )

    clack.outro(i18n.t('cli.export_web.outro'))

    return ok(undefined)
  },
}
