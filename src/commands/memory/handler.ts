/**
 * Memory command handler.
 * Provides CLI access to all 3 memory tiers: feedback, lessons, decisions.
 * Subcommands: list, search, show.
 * Flags: --json, --tier <tier>, --clear <tier>
 * @see FR-804/805/806 — Memory Layer Tiers 1-3
 */

import * as clack from '@clack/prompts'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { ok, err } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import type { FeedbackFile, FeedbackEntry } from '../../engine/session-feedback.js'
import type { LessonsFile } from '../../engine/lessons-distiller.js'
import type { DecisionFile } from '../../engine/decisions-log.js'

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

/** Generate a short hash ID from a string */
export function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}

/** Truncate a string to maxLen, appending '...' if truncated */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 3) + '...'
}

/** Valid memory tiers for --tier and --clear flags */
export type MemoryTier = 'session' | 'lessons' | 'decisions'
const VALID_TIERS: MemoryTier[] = ['session', 'lessons', 'decisions']

/** Parse --json, --tier, and --clear flags from args */
export function parseMemoryFlags(args: string[]): {
  json: boolean
  tier: MemoryTier | undefined
  clear: MemoryTier | undefined
  remaining: string[]
} {
  let json = false
  let tier: MemoryTier | undefined
  let clear: MemoryTier | undefined
  const remaining: string[] = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') {
      json = true
    } else if (args[i] === '--tier' && i + 1 < args.length) {
      const val = args[i + 1] as MemoryTier
      if (VALID_TIERS.includes(val)) tier = val
      i++
    } else if (args[i] === '--clear' && i + 1 < args.length) {
      const val = args[i + 1] as MemoryTier
      if (VALID_TIERS.includes(val)) clear = val
      i++
    } else {
      remaining.push(args[i]!)
    }
  }

  return { json, tier, clear, remaining }
}

// ---------------------------------------------------------------------------
// Subcommand: list
// ---------------------------------------------------------------------------

/** Load all feedback entries from .buildpact/memory/feedback/ */
export async function loadAllFeedbackEntries(
  feedbackDir: string,
): Promise<{ slug: string; entry: FeedbackEntry }[]> {
  try {
    const files = await readdir(feedbackDir)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    const results: { slug: string; entry: FeedbackEntry }[] = []

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(feedbackDir, file), 'utf-8')
        const parsed = JSON.parse(raw) as FeedbackFile
        for (const entry of parsed.entries) {
          results.push({ slug: parsed.slug, entry })
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Sort newest first
    results.sort((a, b) => b.entry.capturedAt.localeCompare(a.entry.capturedAt))
    return results
  } catch {
    return []
  }
}

/** Format feedback entries as a table for display */
export function formatFeedbackTable(
  entries: { slug: string; entry: FeedbackEntry }[],
): string {
  const header = 'ID        Date        Phase      Summary'
  const sep =    '--------  ----------  ---------  ' + '-'.repeat(60)
  const rows = entries.map(({ slug, entry }) => {
    const id = shortHash(entry.capturedAt + slug)
    const date = entry.capturedAt.slice(0, 10)
    const phase = entry.outcome.padEnd(9)
    const summary = truncate(`[${slug}] ${entry.workedAcs.length} passed, ${entry.failedAcs.length} failed`, 60)
    return `${id}  ${date}  ${phase}  ${summary}`
  })

  return [header, sep, ...rows].join('\n')
}

// ---------------------------------------------------------------------------
// Subcommand: search
// ---------------------------------------------------------------------------

/** Search result for a memory entry */
export interface SearchResult {
  type: 'lesson' | 'decision'
  id: string
  title: string
  snippet: string
}

/** Search lessons and decisions for a query string */
export async function searchMemory(
  memoryDir: string,
  query: string,
): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const lowerQuery = query.toLowerCase()

  // Search lessons
  const lessonsDir = join(memoryDir, 'lessons')
  try {
    const lessonsPath = join(lessonsDir, 'lessons.json')
    const raw = await readFile(lessonsPath, 'utf-8')
    const lessonsFile = JSON.parse(raw) as LessonsFile
    for (const lesson of lessonsFile.lessons) {
      const searchable = `${lesson.acPattern} ${lesson.recommendation}`.toLowerCase()
      const idx = searchable.indexOf(lowerQuery)
      if (idx !== -1) {
        const start = Math.max(0, idx - 30)
        const end = Math.min(searchable.length, idx + lowerQuery.length + 30)
        const snippet = (start > 0 ? '...' : '') + searchable.slice(start, end) + (end < searchable.length ? '...' : '')
        results.push({
          type: 'lesson',
          id: lesson.id,
          title: lesson.acPattern,
          snippet,
        })
      }
    }
  } catch {
    // No lessons file
  }

  // Search decisions
  const decisionsDir = join(memoryDir, 'decisions')
  try {
    const files = await readdir(decisionsDir)
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const raw = await readFile(join(decisionsDir, file), 'utf-8')
        const parsed = JSON.parse(raw) as DecisionFile
        const entry = parsed.entry
        const searchable = `${entry.title} ${entry.decision} ${entry.rationale}`.toLowerCase()
        const idx = searchable.indexOf(lowerQuery)
        if (idx !== -1) {
          const start = Math.max(0, idx - 30)
          const end = Math.min(searchable.length, idx + lowerQuery.length + 30)
          const snippet = (start > 0 ? '...' : '') + searchable.slice(start, end) + (end < searchable.length ? '...' : '')
          results.push({
            type: 'decision',
            id: entry.id,
            title: entry.title,
            snippet,
          })
        }
      } catch {
        // Skip unreadable
      }
    }
  } catch {
    // No decisions directory
  }

  return results
}

// ---------------------------------------------------------------------------
// Subcommand: show
// ---------------------------------------------------------------------------

/** Resolve an ID to a memory entry and return its formatted content */
export async function showEntry(
  memoryDir: string,
  id: string,
): Promise<string | undefined> {
  // Try feedback entries
  const feedbackDir = join(memoryDir, 'feedback')
  try {
    const files = await readdir(feedbackDir)
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const raw = await readFile(join(feedbackDir, file), 'utf-8')
      const parsed = JSON.parse(raw) as FeedbackFile
      for (const entry of parsed.entries) {
        const entryId = shortHash(entry.capturedAt + parsed.slug)
        if (entryId.startsWith(id)) {
          return JSON.stringify(entry, null, 2)
        }
      }
    }
  } catch {
    // No feedback
  }

  // Try lessons
  const lessonsPath = join(memoryDir, 'lessons', 'lessons.json')
  try {
    const raw = await readFile(lessonsPath, 'utf-8')
    const lessonsFile = JSON.parse(raw) as LessonsFile
    for (const lesson of lessonsFile.lessons) {
      if (lesson.id.startsWith(id)) {
        return JSON.stringify(lesson, null, 2)
      }
    }
  } catch {
    // No lessons
  }

  // Try decisions
  const decisionsDir = join(memoryDir, 'decisions')
  try {
    const files = await readdir(decisionsDir)
    for (const file of files.filter(f => f.endsWith('.json'))) {
      const raw = await readFile(join(decisionsDir, file), 'utf-8')
      const parsed = JSON.parse(raw) as DecisionFile
      if (parsed.entry.id.startsWith(id)) {
        return JSON.stringify(parsed.entry, null, 2)
      }
    }
  } catch {
    // No decisions
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Tier-filtered data collection (for --json and --tier)
// ---------------------------------------------------------------------------

/** Collect all memory data, optionally filtered by tier */
export async function collectMemoryData(
  memoryDir: string,
  tier?: MemoryTier,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}

  if (!tier || tier === 'session') {
    const feedbackDir = join(memoryDir, 'feedback')
    data.session = await loadAllFeedbackEntries(feedbackDir)
  }

  if (!tier || tier === 'lessons') {
    const lessonsPath = join(memoryDir, 'lessons', 'lessons.json')
    try {
      const raw = await readFile(lessonsPath, 'utf-8')
      data.lessons = JSON.parse(raw)
    } catch {
      data.lessons = { lessons: [] }
    }
  }

  if (!tier || tier === 'decisions') {
    const decisionsDir = join(memoryDir, 'decisions')
    try {
      const files = await readdir(decisionsDir)
      const decisions: unknown[] = []
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const raw = await readFile(join(decisionsDir, file), 'utf-8')
          decisions.push(JSON.parse(raw))
        } catch {
          // Skip
        }
      }
      data.decisions = decisions
    } catch {
      data.decisions = []
    }
  }

  return data
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

    const memoryDir = join(projectDir, '.buildpact', 'memory')
    const { json, tier, clear, remaining } = parseMemoryFlags(args)
    const subcommand = remaining[0]

    // --clear: log what would be cleared (dry-run confirmation)
    if (clear) {
      const tierDirMap: Record<MemoryTier, string> = {
        session: join(memoryDir, 'feedback'),
        lessons: join(memoryDir, 'lessons'),
        decisions: join(memoryDir, 'decisions'),
      }
      const targetDir = tierDirMap[clear]
      if (!existsSync(targetDir)) {
        if (json) {
          process.stdout.write(JSON.stringify({ clear: clear, status: 'empty', message: `No ${clear} entries to clear.` }, null, 2) + '\n')
        } else {
          clack.log.info(`No ${clear} entries to clear.`)
        }
        return ok(undefined)
      }
      try {
        const files = await readdir(targetDir)
        const jsonFiles = files.filter(f => f.endsWith('.json'))
        if (json) {
          process.stdout.write(JSON.stringify({ clear: clear, status: 'preview', files: jsonFiles, message: `Would clear ${jsonFiles.length} file(s) from ${clear} tier.` }, null, 2) + '\n')
        } else {
          clack.log.info(`Would clear ${jsonFiles.length} file(s) from ${clear} tier in ${targetDir}`)
          clack.log.info('Run with actual deletion not yet implemented. This is a preview.')
        }
      } catch {
        if (json) {
          process.stdout.write(JSON.stringify({ clear: clear, status: 'empty' }, null, 2) + '\n')
        } else {
          clack.log.info(`No ${clear} entries to clear.`)
        }
      }
      return ok(undefined)
    }

    // No subcommand — if --json with optional --tier, dump all data as JSON
    if (!subcommand) {
      if (json) {
        if (!existsSync(memoryDir)) {
          process.stdout.write(JSON.stringify({ session: [], lessons: { lessons: [] }, decisions: [] }, null, 2) + '\n')
          return ok(undefined)
        }
        const data = await collectMemoryData(memoryDir, tier)
        process.stdout.write(JSON.stringify(data, null, 2) + '\n')
        return ok(undefined)
      }
      clack.log.info(i18n.t('cli.memory.usage'))
      return ok(undefined)
    }

    // Check memory directory exists
    if (!existsSync(memoryDir)) {
      if (json) {
        process.stdout.write(JSON.stringify({ entries: [] }, null, 2) + '\n')
        return ok(undefined)
      }
      clack.log.info(i18n.t('cli.memory.empty'))
      return ok(undefined)
    }

    if (subcommand === 'list') {
      await audit.log({ action: 'memory.list', agent: 'memory', files: [], outcome: 'success' })
      const feedbackDir = join(memoryDir, 'feedback')
      const entries = await loadAllFeedbackEntries(feedbackDir)

      if (entries.length === 0) {
        if (json) {
          process.stdout.write(JSON.stringify({ entries: [] }, null, 2) + '\n')
          return ok(undefined)
        }
        clack.log.info(i18n.t('cli.memory.empty'))
        return ok(undefined)
      }

      if (json) {
        process.stdout.write(JSON.stringify({ entries }, null, 2) + '\n')
        return ok(undefined)
      }

      clack.log.info(i18n.t('cli.memory.list_header'))
      clack.log.info(formatFeedbackTable(entries))
      return ok(undefined)
    }

    if (subcommand === 'search') {
      const query = remaining.slice(1).join(' ').trim()
      if (!query) {
        if (json) {
          process.stdout.write(JSON.stringify({ results: [] }, null, 2) + '\n')
          return ok(undefined)
        }
        clack.log.info(i18n.t('cli.memory.usage'))
        return ok(undefined)
      }

      await audit.log({ action: 'memory.search', agent: 'memory', files: [], outcome: 'success' })
      const results = await searchMemory(memoryDir, query)

      if (results.length === 0) {
        if (json) {
          process.stdout.write(JSON.stringify({ results: [] }, null, 2) + '\n')
          return ok(undefined)
        }
        clack.log.info(i18n.t('cli.memory.empty'))
        return ok(undefined)
      }

      if (json) {
        process.stdout.write(JSON.stringify({ results }, null, 2) + '\n')
        return ok(undefined)
      }

      clack.log.info(i18n.t('cli.memory.search_results', { count: String(results.length) }))
      for (const r of results) {
        clack.log.info(`[${r.type}] ${r.id}: ${r.title}\n  ${r.snippet}`)
      }
      return ok(undefined)
    }

    if (subcommand === 'show') {
      const id = remaining[1]?.trim()
      if (!id) {
        if (json) {
          process.stdout.write(JSON.stringify({ error: 'No ID provided' }, null, 2) + '\n')
          return ok(undefined)
        }
        clack.log.info(i18n.t('cli.memory.usage'))
        return ok(undefined)
      }

      await audit.log({ action: 'memory.show', agent: 'memory', files: [], outcome: 'success' })
      const content = await showEntry(memoryDir, id)

      if (!content) {
        return err({
          code: 'NOT_FOUND',
          i18nKey: 'cli.memory.not_found',
          params: { id },
        })
      }

      if (json) {
        // content is already JSON from showEntry
        process.stdout.write(content + '\n')
        return ok(undefined)
      }

      clack.log.info(content)
      return ok(undefined)
    }

    // Unknown subcommand — show usage
    clack.log.info(i18n.t('cli.memory.usage'))
    return ok(undefined)
  },
}
