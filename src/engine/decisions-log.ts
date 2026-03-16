/**
 * Decisions Log — Memory Layer Tier 3 (v1.0).
 * Stores architectural decisions with decision, rationale, alternatives,
 * and date in .buildpact/memory/decisions/ for permanent reference.
 * @see FR-806 — Memory Layer Tier 3 (Decisions Log)
 */

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single architectural decision entry */
export interface DecisionEntry {
  /** Unique stable ID for the decision */
  id: string
  /** Short title for this decision */
  title: string
  /** The decision made */
  decision: string
  /** Rationale explaining why this decision was made */
  rationale: string
  /** Alternatives that were considered but not chosen */
  alternatives: string[]
  /** ISO date string when the decision was recorded */
  date: string
}

/** Persisted decisions file (one per decision slug) */
export interface DecisionFile {
  /** Slug identifier for this decision */
  slug: string
  /** The decision entry */
  entry: DecisionEntry
}

/** Input required to create a decision entry */
export interface DecisionInput {
  /** Short title for the decision */
  title: string
  /** The decision that was made */
  decision: string
  /** Rationale/reasoning behind the decision */
  rationale: string
  /** Alternatives considered */
  alternatives: string[]
}

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Slugify a decision title to a stable file-safe identifier.
 * Lowercased, non-alphanumeric chars replaced with hyphens, trimmed.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Build a DecisionEntry from a DecisionInput.
 * Pure function — no side effects. Uses current date.
 */
export function buildDecisionEntry(input: DecisionInput): DecisionEntry {
  const slug = slugifyTitle(input.title)
  return {
    id: slug,
    title: input.title,
    decision: input.decision,
    rationale: input.rationale,
    alternatives: input.alternatives,
    date: new Date().toISOString().slice(0, 10),
  }
}

/**
 * Format a list of decision entries as a markdown context block for subagent injection.
 * Pure function — no side effects.
 */
export function formatDecisionsForContext(entries: DecisionEntry[]): string {
  if (entries.length === 0) return ''

  const lines: string[] = [
    '## Decisions Log Memory (Tier 3)',
    '',
    '_Key architectural decisions — loaded from .buildpact/memory/decisions/_',
    '',
  ]

  for (const entry of entries) {
    lines.push(`### Decision: ${entry.title}`)
    lines.push(`- **Date**: ${entry.date}`)
    lines.push(`- **Decision**: ${entry.decision}`)
    lines.push(`- **Rationale**: ${entry.rationale}`)
    if (entry.alternatives.length > 0) {
      lines.push(`- **Alternatives considered**: ${entry.alternatives.join('; ')}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// I/O functions
// ---------------------------------------------------------------------------

/**
 * Write a DecisionEntry as a JSON file to the decisions directory.
 * Filename is derived from the entry's id slug.
 */
export async function writeDecisionFile(
  decisionsDir: string,
  entry: DecisionEntry,
): Promise<Result<string>> {
  try {
    await mkdir(decisionsDir, { recursive: true })
    const filePath = join(decisionsDir, `${entry.id}.json`)
    const file: DecisionFile = { slug: entry.id, entry }
    await writeFile(filePath, JSON.stringify(file, null, 2), 'utf-8')
    return ok(filePath)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.decisions.write_failed',
      params: { id: entry.id },
    })
  }
}

/**
 * Load all decision entries from the decisions directory.
 * Returns entries sorted by date ascending (oldest first).
 */
export async function loadAllDecisions(decisionsDir: string): Promise<DecisionEntry[]> {
  try {
    const entries = await readdir(decisionsDir)
    const jsonFiles = entries.filter(e => e.endsWith('.json'))

    if (jsonFiles.length === 0) return []

    const loaded = await Promise.all(
      jsonFiles.map(async name => {
        try {
          const filePath = join(decisionsDir, name)
          const raw = await readFile(filePath, 'utf-8')
          const parsed = JSON.parse(raw) as DecisionFile
          return parsed.entry
        } catch {
          return null
        }
      }),
    )

    const valid = loaded.filter((e): e is DecisionEntry => e !== null)
    valid.sort((a, b) => a.date.localeCompare(b.date))
    return valid
  } catch {
    return []
  }
}

/**
 * End-to-end: build a decision entry from input and persist it to the decisions directory.
 */
export async function captureDecision(
  projectDir: string,
  input: DecisionInput,
): Promise<Result<string>> {
  const entry = buildDecisionEntry(input)
  const decisionsDir = join(projectDir, '.buildpact', 'memory', 'decisions')
  return writeDecisionFile(decisionsDir, entry)
}
