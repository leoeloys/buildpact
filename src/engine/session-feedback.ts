/**
 * Session Feedback — Memory Layer Tier 1.
 * Captures structured feedback after verification sessions.
 * Stores in .buildpact/memory/feedback/ with FIFO cap of 30 entries.
 * @see FR-804 — Memory Layer free in open-source core
 */

import { readFile, mkdir, writeFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum feedback entries retained per file (FIFO eviction) */
export const FEEDBACK_FIFO_CAP = 30

/** Number of most recent feedback files loaded into subagent context */
export const FEEDBACK_RECENT_LIMIT = 5

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Outcome of a verification session */
export type SessionOutcome = 'passed' | 'failed' | 'partial'

/** A single feedback entry captured after a verification session */
export interface FeedbackEntry {
  /** ISO timestamp when this feedback was recorded */
  capturedAt: string
  /** Spec slug that was verified */
  slug: string
  /** ACs that passed verification */
  workedAcs: string[]
  /** ACs that failed verification */
  failedAcs: string[]
  /** Overall session outcome */
  outcome: SessionOutcome
  /** Optional notes per failed AC (ac text → note) */
  notes: Record<string, string>
}

/** Persisted feedback file contents */
export interface FeedbackFile {
  /** Spec slug this file belongs to */
  slug: string
  /** Ordered feedback entries, newest last */
  entries: FeedbackEntry[]
}

/** Input for building a feedback entry from a UAT report */
export interface FeedbackBuildInput {
  slug: string
  workedAcs: string[]
  failedAcs: string[]
  allPassed: boolean
  notes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Derive SessionOutcome from pass/fail counts.
 */
export function deriveOutcome(passCount: number, failCount: number): SessionOutcome {
  if (failCount === 0 && passCount > 0) return 'passed'
  if (passCount === 0) return 'failed'
  return 'partial'
}

/**
 * Build a FeedbackEntry from a UAT report input.
 * Pure function — no side effects.
 */
export function buildFeedbackEntry(input: FeedbackBuildInput): FeedbackEntry {
  return {
    capturedAt: new Date().toISOString(),
    slug: input.slug,
    workedAcs: input.workedAcs,
    failedAcs: input.failedAcs,
    outcome: deriveOutcome(input.workedAcs.length, input.failedAcs.length),
    notes: input.notes,
  }
}

/**
 * Append a new entry to a list of entries, enforcing the FIFO cap.
 * Returns a new array (immutable).
 */
export function appendWithFifoCap(entries: FeedbackEntry[], newEntry: FeedbackEntry, cap = FEEDBACK_FIFO_CAP): FeedbackEntry[] {
  const updated = [...entries, newEntry]
  if (updated.length > cap) {
    return updated.slice(updated.length - cap)
  }
  return updated
}

/**
 * Format feedback entries as a markdown context block for subagent injection.
 * Pure function — no side effects.
 */
export function formatFeedbackForContext(files: FeedbackFile[]): string {
  if (files.length === 0) return ''

  const lines: string[] = [
    '## Session Feedback Memory (Tier 1)',
    '',
    '_Auto-loaded from .buildpact/memory/feedback/ — most recent sessions._',
    '',
  ]

  for (const file of files) {
    const latest = file.entries[file.entries.length - 1]
    if (!latest) continue

    lines.push(`### Spec: ${file.slug}`)
    lines.push(`- **Last verified**: ${latest.capturedAt}`)
    lines.push(`- **Outcome**: ${latest.outcome}`)

    if (latest.workedAcs.length > 0) {
      lines.push(`- **Worked**: ${latest.workedAcs.join(', ')}`)
    }
    if (latest.failedAcs.length > 0) {
      lines.push(`- **Failed**: ${latest.failedAcs.join(', ')}`)
      const noteEntries = Object.entries(latest.notes)
      if (noteEntries.length > 0) {
        for (const [ac, note] of noteEntries) {
          lines.push(`  - _${ac}_: ${note}`)
        }
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// I/O functions
// ---------------------------------------------------------------------------

/**
 * Load an existing feedback file, or return an empty FeedbackFile.
 */
export async function loadFeedbackFile(feedbackPath: string, slug: string): Promise<FeedbackFile> {
  try {
    const raw = await readFile(feedbackPath, 'utf-8')
    const parsed = JSON.parse(raw) as FeedbackFile
    return parsed
  } catch {
    return { slug, entries: [] }
  }
}

/**
 * Write a FeedbackFile as JSON to the given path.
 */
export async function writeFeedbackFile(
  feedbackDir: string,
  slug: string,
  file: FeedbackFile,
): Promise<Result<string>> {
  try {
    await mkdir(feedbackDir, { recursive: true })
    const feedbackPath = join(feedbackDir, `${slug}.json`)
    await writeFile(feedbackPath, JSON.stringify(file, null, 2), 'utf-8')
    return ok(feedbackPath)
  } catch (e) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.feedback.write_failed',
      params: { slug },
    })
  }
}

/**
 * Load the N most recent feedback files from the feedback directory.
 * Sorted by file modification time, most recent last.
 */
export async function loadRecentFeedbacks(
  feedbackDir: string,
  limit = FEEDBACK_RECENT_LIMIT,
): Promise<FeedbackFile[]> {
  try {
    const entries = await readdir(feedbackDir)
    const jsonFiles = entries.filter(e => e.endsWith('.json'))

    if (jsonFiles.length === 0) return []

    // Sort by mtime, newest last
    const withStats = await Promise.all(
      jsonFiles.map(async name => {
        const filePath = join(feedbackDir, name)
        const s = await stat(filePath)
        return { name, mtime: s.mtimeMs, filePath }
      }),
    )
    withStats.sort((a, b) => a.mtime - b.mtime)

    // Take last N
    const recent = withStats.slice(-limit)

    const files = await Promise.all(
      recent.map(async ({ name, filePath }) => {
        const slug = name.replace(/\.json$/, '')
        return loadFeedbackFile(filePath, slug)
      }),
    )

    return files
  } catch {
    return []
  }
}

/**
 * Append a feedback entry for a slug and persist it.
 * Handles mkdir, FIFO cap, and JSON write in one operation.
 */
export async function captureSessionFeedback(
  projectDir: string,
  entry: FeedbackEntry,
): Promise<Result<string>> {
  const feedbackDir = join(projectDir, '.buildpact', 'memory', 'feedback')
  const feedbackPath = join(feedbackDir, `${entry.slug}.json`)

  const existing = await loadFeedbackFile(feedbackPath, entry.slug)
  const updatedEntries = appendWithFifoCap(existing.entries, entry)
  const updatedFile: FeedbackFile = { slug: entry.slug, entries: updatedEntries }

  return writeFeedbackFile(feedbackDir, entry.slug, updatedFile)
}
