/**
 * Help command handler.
 * Scans .buildpact/ project state and recommends the next pipeline step.
 * Pure filesystem scan — no subagent dispatch needed.
 */

import * as clack from '@clack/prompts'
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { ok } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse config.yaml to extract language setting */
function readLanguage(projectDir: string): SupportedLanguage {
  try {
    const content = readFileSync(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('language:')) {
        const value = trimmed.slice('language:'.length).trim().replace(/^["']|["']$/g, '')
        if (value === 'pt-br' || value === 'en') return value
      }
    }
  } catch {
    // Config missing or unreadable — fall back to English
  }
  return 'en'
}

/** Check if a path exists (file or directory) */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Count files matching a pattern inside a directory (non-recursive single glob level) */
async function countFiles(dir: string, suffix: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true })
    return entries.filter(e => e.isFile() && e.name.endsWith(suffix)).length
  } catch {
    return 0
  }
}

/** Read squad name and domain from squad.yaml */
async function readSquadInfo(
  squadsDir: string,
): Promise<{ name: string; domain: string } | null> {
  let entries: string[]
  try {
    entries = await readdir(squadsDir)
  } catch {
    return null
  }
  for (const entry of entries) {
    const yamlPath = join(squadsDir, entry, 'squad.yaml')
    try {
      const content = await readFile(yamlPath, 'utf-8')
      let name = entry
      let domain = ''
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('name:')) {
          name = trimmed.slice('name:'.length).trim().replace(/^["']|["']$/g, '')
        }
        if (trimmed.startsWith('domain:')) {
          domain = trimmed.slice('domain:'.length).trim().replace(/^["']|["']$/g, '')
        }
      }
      return { name, domain }
    } catch {
      continue
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Pipeline position detection
// ---------------------------------------------------------------------------

type PipelineState =
  | 'not_initialized'
  | 'fresh_project'
  | 'spec_ready'
  | 'plan_ready'
  | 'executed'
  | 'verified'
  | 'has_failures'

interface ProjectScan {
  hasConfig: boolean
  hasConstitution: boolean
  specCount: number
  planCount: number
  verificationCount: number
  feedbackCount: number
  hasLessons: boolean
  squad: { name: string; domain: string } | null
}

async function scanProject(projectDir: string): Promise<ProjectScan> {
  const bp = join(projectDir, '.buildpact')

  const [hasConfig, hasConstitution, hasLessons, squad] = await Promise.all([
    exists(join(bp, 'config.yaml')),
    exists(join(bp, 'constitution.md')),
    exists(join(bp, 'memory', 'lessons', 'lessons.json')),
    readSquadInfo(join(bp, 'squads')),
  ])

  const [specCount, planCount, verificationCount, feedbackCount] = await Promise.all([
    countFiles(join(bp, 'specs'), 'spec.md'),
    countFiles(join(bp, 'plans'), '.md'),
    countFiles(join(bp, 'specs'), 'verification-report.md'),
    countFiles(join(bp, 'memory', 'feedback'), '.json'),
  ])

  return {
    hasConfig,
    hasConstitution,
    specCount,
    planCount,
    verificationCount,
    feedbackCount,
    hasLessons,
    squad,
  }
}

function determinePipelineState(scan: ProjectScan): PipelineState {
  if (!scan.hasConfig) return 'not_initialized'
  if (scan.specCount === 0) return 'fresh_project'
  if (scan.planCount === 0) return 'spec_ready'
  if (scan.verificationCount === 0 && scan.planCount > 0) return 'plan_ready'
  // If we have verifications, check if any have failures
  // (simplified: if verification count < spec count, some are pending)
  if (scan.verificationCount > 0 && scan.verificationCount >= scan.specCount) return 'verified'
  if (scan.verificationCount > 0) return 'executed'
  return 'plan_ready'
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(_args: string[]): Promise<Result<void>> {
    const projectDir = process.cwd()
    const lang = readLanguage(projectDir)
    const i18n = createI18n(lang)

    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))
    await audit.log({ action: 'help.scan', agent: 'help', files: [], outcome: 'success' })

    clack.intro(i18n.t('cli.help.welcome'))

    // STEP 1: Project State Scan
    const s = clack.spinner()
    s.start(i18n.t('cli.help.scanning'))
    const scan = await scanProject(projectDir)
    s.stop(i18n.t('cli.help.scanning'))

    // Display artifact table
    clack.log.info(
      [
        `Config:          ${scan.hasConfig ? '✓' : '✗'}`,
        `Constitution:    ${scan.hasConstitution ? '✓' : '✗'}`,
        `Specs:           ${scan.specCount}`,
        `Plans:           ${scan.planCount}`,
        `Verifications:   ${scan.verificationCount}`,
        `Feedback:        ${scan.feedbackCount}`,
        `Lessons:         ${scan.hasLessons ? '✓' : '✗'}`,
        `Squad:           ${scan.squad ? `${scan.squad.name} (${scan.squad.domain})` : '—'}`,
      ].join('\n'),
    )

    // STEP 2: Pipeline position & recommendation
    const state = determinePipelineState(scan)

    const recommendationKey: Record<PipelineState, string> = {
      not_initialized: 'cli.help.not_initialized',
      fresh_project: 'cli.help.next_specify',
      spec_ready: 'cli.help.next_plan',
      plan_ready: 'cli.help.next_execute',
      executed: 'cli.help.next_verify',
      verified: 'cli.help.next_feature',
      has_failures: 'cli.help.next_fix',
    }

    clack.log.step(i18n.t(recommendationKey[state]))

    // STEP 3: Available Commands Quick Reference
    clack.log.info(
      [
        'Pipeline:      /bp:specify → /bp:plan → /bp:execute → /bp:verify',
        'Quick path:    /bp:quick "description"  (zero-ceremony for small tasks)',
        'Setup:         buildpact init | buildpact doctor | buildpact adopt',
        'Advanced:      /bp:squad | /bp:constitution | /bp:optimize',
        'Help:          /bp:help (you are here)',
      ].join('\n'),
    )

    // STEP 3b: Common Error Codes Quick Reference
    clack.log.info(
      [
        'Common Error Codes:',
        '',
        'Setup & Config:',
        '  SQUAD_NOT_FOUND         — No squad installed. Run: buildpact init',
        '  SQUAD_VALIDATION_FAILED — Squad files are malformed. Run: buildpact squad validate <path>',
        '  SQUAD_INVALID_NAME      — Invalid squad name. Use lowercase alphanumeric, hyphens, underscores.',
        '  CONFIG_INVALID          — config.yaml is missing or malformed. Run: buildpact doctor',
        '  IDE_CONFIG_FAILED       — Could not write IDE config files. Check filesystem permissions.',
        '',
        'Constitution:',
        '  CONSTITUTION_NOT_FOUND  — No constitution.md found. Run: buildpact init',
        '  CONSTITUTION_EMPTY      — constitution.md exists but has no content.',
        '  CONSTITUTION_VIOLATION  — Output violates a constitution rule. Review and approve or reject.',
        '  CONSTITUTION_MODIFICATION_BLOCKED — Attempted to modify constitution without approval.',
        '',
        'Pipeline Execution:',
        '  SPEC_NOT_FOUND          — No spec found. Run: /bp:specify first',
        '  BUDGET_EXCEEDED         — Cost limit reached. Increase budget or reduce scope.',
        '  FAILOVER_EXHAUSTED      — All provider fallback attempts failed.',
        '  TASK_TIMEOUT            — Task execution exceeded time limit.',
        '  TASK_RESULT_INVALID     — Agent returned malformed output. Retry or adjust prompt.',
        '',
        'Provider & Agents:',
        '  PROVIDER_API_KEY_MISSING — API key not set. Export the provider env var.',
        '  PROVIDER_DISPATCH_FAILED — Could not dispatch task to provider.',
        '  AGENT_LOAD_FAILED       — Could not load agent definition file.',
        '  PAYLOAD_TOO_LARGE       — Task payload exceeds size limit.',
        '',
        'Version & Schema:',
        '  SCHEMA_INCOMPATIBLE     — Project schema version mismatch. Run: buildpact upgrade',
        '  CLI_TOO_OLD             — CLI is older than project schema. Run: npm update -g buildpact',
        '  MIGRATION_FAILED        — Schema migration failed. Check error details.',
        '',
        'File Operations:',
        '  FILE_WRITE_FAILED       — Could not write file. Check permissions.',
        '  FILE_READ_FAILED        — Could not read file. Check path and permissions.',
      ].join('\n'),
    )

    // STEP 4: Squad Status
    if (scan.squad) {
      clack.log.info(i18n.t('cli.help.squad_active', { name: scan.squad.name, domain: scan.squad.domain }))
    } else {
      clack.log.info(i18n.t('cli.help.squad_none'))
    }

    clack.outro(i18n.t('cli.help.done'))

    return ok(undefined)
  },
}
