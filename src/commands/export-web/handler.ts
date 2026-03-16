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
  const { platform, squadName, agents, constitutionEssentials, projectContext, language } = input

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

  const content = sections.join('\n')
  const tokenEstimate = estimateTokens(content)

  return { content, tokenEstimate, platform }
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

    // Build bundle
    const bundleResult = buildWebBundle({
      platform,
      squadName,
      agents,
      constitutionEssentials,
      projectContext,
      language: lang,
    })

    // Token warning
    const { overLimit, overWarn, limitTokens } = checkTokenWarning(
      bundleResult.tokenEstimate,
      platform,
    )

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
