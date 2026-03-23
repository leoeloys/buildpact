/**
 * Diff command handler.
 * Shows files changed since the last verification.
 * Read-only — no mutations to project state.
 * Flags: --json, --since <commit>
 * @see Story 14.4 — Diff Change Tracker
 */

import * as clack from '@clack/prompts'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
// Simple ANSI color helpers (avoid adding picocolors as direct dependency)
const pc = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}
import { ok, err } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Persisted state from the last verification run */
export interface LastVerifyState {
  sha: string
  timestamp: string
  specSlug: string
}

/** A single file change entry */
export interface FileChange {
  status: 'added' | 'modified' | 'deleted'
  path: string
}

/** Result of computing the diff */
export interface DiffResult {
  added: FileChange[]
  modified: FileChange[]
  deleted: FileChange[]
}

/** Semantic category for grouping changes */
export type SemanticCategory = 'agents' | 'plans' | 'config' | 'output' | 'audit' | 'other'

/** Categorized diff result */
export interface CategorizedDiffResult {
  agents: FileChange[]
  plans: FileChange[]
  config: FileChange[]
  output: FileChange[]
  audit: FileChange[]
  other: FileChange[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read language from .buildpact/config.yaml, fallback to 'en' */
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
    // Config missing or unreadable
  }
  return 'en'
}

/** Read the last verify state from .buildpact/verify/last-verify.json */
export function getLastVerifyState(projectDir: string): LastVerifyState | undefined {
  const verifyPath = join(projectDir, '.buildpact', 'verify', 'last-verify.json')
  if (!existsSync(verifyPath)) return undefined
  try {
    return JSON.parse(readFileSync(verifyPath, 'utf-8')) as LastVerifyState
  } catch {
    return undefined
  }
}

/** Parse git diff --name-status output into FileChange[] */
export function parseGitDiffOutput(output: string): FileChange[] {
  const changes: FileChange[] = []
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [statusCode, ...pathParts] = trimmed.split('\t')
    const path = pathParts.join('\t')
    if (!statusCode || !path) continue

    let status: FileChange['status']
    if (statusCode.startsWith('A')) status = 'added'
    else if (statusCode.startsWith('D')) status = 'deleted'
    else status = 'modified'

    changes.push({ status, path })
  }
  return changes
}

/** Compute diff using git diff against a SHA */
export function computeGitDiff(projectDir: string, sha: string): DiffResult | undefined {
  try {
    const output = execSync(`git diff --name-status ${sha}..HEAD`, {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const changes = parseGitDiffOutput(output)
    return groupChanges(changes)
  } catch {
    return undefined
  }
}

/** Group FileChange[] into a DiffResult */
export function groupChanges(changes: FileChange[]): DiffResult {
  return {
    added: changes.filter(c => c.status === 'added'),
    modified: changes.filter(c => c.status === 'modified'),
    deleted: changes.filter(c => c.status === 'deleted'),
  }
}

/** Determine the semantic category for a file path */
export function categorizeFile(filePath: string): SemanticCategory {
  const lower = filePath.toLowerCase()
  if (lower.includes('agents/') || lower.includes('/agents/')) return 'agents'
  if (lower.includes('plan/') || lower.includes('plans/') || lower.includes('/plan/') || lower.includes('/plans/')) return 'plans'
  if (lower.includes('config.yaml') || lower.includes('constitution') || lower.endsWith('.yaml') && lower.includes('config')) return 'config'
  if (lower.includes('output/') || lower.includes('/output/') || lower.includes('bundles/')) return 'output'
  if (lower.includes('audit/') || lower.includes('/audit/')) return 'audit'
  return 'other'
}

/** Group changes by semantic category */
export function categorizeChanges(changes: FileChange[]): CategorizedDiffResult {
  const result: CategorizedDiffResult = {
    agents: [],
    plans: [],
    config: [],
    output: [],
    audit: [],
    other: [],
  }

  for (const change of changes) {
    const category = categorizeFile(change.path)
    result[category].push(change)
  }

  return result
}

/** Format a file change with color and unverified badge */
export function formatChange(change: FileChange): string {
  const badge = change.path.startsWith('src/') ? pc.yellow(' [unverified]') : pc.dim(' [non-critical]')
  switch (change.status) {
    case 'added': return pc.green('+ ' + change.path) + badge
    case 'deleted': return pc.red('- ' + change.path) + badge
    case 'modified': return pc.yellow('~ ' + change.path) + badge
  }
}

/** Parse --json and --since flags from args */
export function parseDiffFlags(args: string[]): { json: boolean; since: string | undefined } {
  let json = false
  let since: string | undefined
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') json = true
    if (args[i] === '--since' && i + 1 < args.length) {
      since = args[i + 1]
      i++
    }
  }
  return { json, since }
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(args: string[]): Promise<Result<void>> {
    const projectDir = process.cwd()
    const lang = readLanguage(projectDir)
    const i18n = createI18n(lang)
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))
    await audit.log({ action: 'diff.view', agent: 'diff', files: [], outcome: 'success' })

    const { json, since } = parseDiffFlags(args)

    // Determine the base SHA: --since takes precedence over last verify state
    let baseSha: string | undefined
    if (since) {
      baseSha = since
    } else {
      const verifyState = getLastVerifyState(projectDir)
      if (!verifyState) {
        if (json) {
          process.stdout.write(JSON.stringify({ error: 'No verify baseline found' }, null, 2) + '\n')
        } else {
          clack.log.warn(i18n.t('cli.diff.no_verify_baseline'))
        }
        return ok(undefined)
      }
      baseSha = verifyState.sha
    }

    // Compute diff via git
    const diffResult = computeGitDiff(projectDir, baseSha)
    if (!diffResult) {
      if (json) {
        process.stdout.write(JSON.stringify({ error: 'Git diff failed' }, null, 2) + '\n')
      } else {
        clack.log.warn(i18n.t('cli.diff.no_verify_baseline'))
      }
      return ok(undefined)
    }

    const allChanges = [...diffResult.added, ...diffResult.modified, ...diffResult.deleted]
    const totalChanges = allChanges.length

    // Clean state
    if (totalChanges === 0) {
      if (json) {
        process.stdout.write(JSON.stringify({ changes: [], categories: {}, summary: { total: 0, added: 0, modified: 0, deleted: 0 } }, null, 2) + '\n')
      } else {
        clack.log.success(i18n.t('cli.diff.clean'))
      }
      return ok(undefined)
    }

    // Categorize changes
    const categorized = categorizeChanges(allChanges)

    if (json) {
      const data = {
        changes: allChanges,
        categories: categorized,
        summary: {
          total: totalChanges,
          added: diffResult.added.length,
          modified: diffResult.modified.length,
          deleted: diffResult.deleted.length,
        },
      }
      process.stdout.write(JSON.stringify(data, null, 2) + '\n')
      return ok(undefined)
    }

    // Render changes grouped by category
    clack.log.info(i18n.t('cli.diff.header'))

    const categoryLabels: Record<SemanticCategory, string> = {
      agents: 'Agents',
      plans: 'Plans',
      config: 'Config',
      output: 'Output',
      audit: 'Audit',
      other: 'Other',
    }

    for (const cat of (['agents', 'plans', 'config', 'output', 'audit', 'other'] as SemanticCategory[])) {
      const catChanges = categorized[cat]
      if (catChanges.length > 0) {
        clack.log.info(pc.bold(`  ${categoryLabels[cat]} (${catChanges.length})`))
        for (const change of catChanges) {
          clack.log.info('    ' + formatChange(change))
        }
      }
    }

    // Summary
    clack.log.info(
      i18n.t('cli.diff.summary', {
        total: String(totalChanges),
        added: String(diffResult.added.length),
        modified: String(diffResult.modified.length),
        deleted: String(diffResult.deleted.length),
      }),
    )

    // Recommend verify if unverified source files exist
    const hasUnverifiedSrc = [...diffResult.added, ...diffResult.modified].some(c => c.path.startsWith('src/'))
    if (hasUnverifiedSrc) {
      clack.log.warn(i18n.t('cli.diff.recommend_verify'))
    }

    return ok(undefined)
  },
}
