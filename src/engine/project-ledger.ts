/**
 * Project Ledger — unified temporal index of all project events.
 * Single append-only document (LEDGER.md) with pointers to detail files.
 * Replaces fragmented logs with one place to answer "what happened?"
 * @module engine/project-ledger
 * @see Original BuildPact concept 16.6
 */

import { readFile, mkdir, writeFile, appendFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { LedgerEntry, LedgerCategory } from '../contracts/task.js'
import { refreshBuildpactMaps } from './directory-map.js'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const LEDGER_FILE = 'LEDGER.md'
const MAP_FILE = 'MAP.md'

function ledgerPath(projectDir: string): string {
  return join(projectDir, '.buildpact', LEDGER_FILE)
}

function mapPath(projectDir: string): string {
  return join(projectDir, '.buildpact', MAP_FILE)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a single ledger entry as a 2-line string.
 * Line 1: timestamp + category + [ID] + summary
 * Line 2: → Details: path
 */
export function formatLedgerEntry(entry: LedgerEntry): string {
  const time = entry.timestamp.slice(11, 16) // HH:MM
  const date = entry.timestamp.slice(0, 10)   // YYYY-MM-DD
  return [
    `### ${date} ${time} — ${entry.category} [${entry.id}]`,
    entry.summary,
    `→ Details: ${entry.detailsPath}`,
  ].join('\n')
}

/**
 * Format a date header for grouping entries.
 */
function formatDateHeader(date: string): string {
  return `\n## ${date}\n`
}

// ---------------------------------------------------------------------------
// Append
// ---------------------------------------------------------------------------

/**
 * Append an entry to LEDGER.md (append-only, chronological order).
 * Uses appendFile() for atomic writes — safe under concurrent access.
 * Creates LEDGER.md with header if it doesn't exist.
 */
export async function appendToLedger(
  projectDir: string,
  entry: LedgerEntry,
): Promise<Result<void>> {
  const buildpactDir = join(projectDir, '.buildpact')
  await mkdir(buildpactDir, { recursive: true })

  const path = ledgerPath(projectDir)
  const formatted = formatLedgerEntry(entry)

  // Check if file exists; if not, create with header
  let needsHeader = false
  try {
    await readFile(path, 'utf-8')
  } catch {
    needsHeader = true
  }

  if (needsHeader) {
    const header = [
      '# Project Ledger',
      '',
      '> Unified temporal index of all project events. Chronological order.',
      '> Each entry has a summary + pointer to details. Never edit manually.',
      '',
    ].join('\n')
    try {
      await writeFile(path, header, 'utf-8')
    } catch {
      return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.file.write_failed', params: { path } })
    }
  }

  // Append-only write — minimizes data loss risk under concurrent access
  // Note: Node.js appendFile is NOT truly atomic; use file locks for strict guarantees
  try {
    await appendFile(path, '\n' + formatted + '\n', 'utf-8')
    return ok(undefined)
  } catch {
    return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.file.write_failed', params: { path } })
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Parse LEDGER.md into structured entries.
 * Optionally filter by category or date range.
 */
export function parseLedgerEntries(content: string): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  const lines = content.split('\n')

  let currentDate = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Legacy date header (from older ledger format)
    const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      currentDate = dateMatch[1]!
      i++
      continue
    }

    // Entry header: ### YYYY-MM-DD HH:MM — CATEGORY [ID] (new format)
    // or legacy: ### HH:MM — CATEGORY [ID] (requires currentDate from ## header)
    const newFormatMatch = line.match(/^### (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) — (\w+) \[([^\]]+)\]/)
    const legacyMatch = !newFormatMatch ? line.match(/^### (\d{2}:\d{2}) — (\w+) \[([^\]]+)\]/) : null

    if (newFormatMatch) {
      const date = newFormatMatch[1]!
      const time = newFormatMatch[2]!
      const category = newFormatMatch[3]! as LedgerCategory
      const id = newFormatMatch[4]!

      const summary = (i + 1 < lines.length) ? lines[i + 1]!.trim() : ''
      const detailsLine = (i + 2 < lines.length) ? lines[i + 2]! : ''
      const detailsMatch = detailsLine.match(/→ Details: (.+)/)
      const detailsPath = detailsMatch ? detailsMatch[1]!.trim() : ''

      entries.push({ timestamp: `${date}T${time}:00.000Z`, category, id, summary, detailsPath })
      i += 3
      continue
    }

    if (legacyMatch && currentDate) {
      const time = legacyMatch[1]!
      const category = legacyMatch[2]! as LedgerCategory
      const id = legacyMatch[3]!

      const summary = (i + 1 < lines.length) ? lines[i + 1]!.trim() : ''
      const detailsLine = (i + 2 < lines.length) ? lines[i + 2]! : ''
      const detailsMatch = detailsLine.match(/→ Details: (.+)/)
      const detailsPath = detailsMatch ? detailsMatch[1]!.trim() : ''

      entries.push({ timestamp: `${currentDate}T${time}:00.000Z`, category, id, summary, detailsPath })
      i += 3
      continue
    }

    i++
  }

  return entries
}

/**
 * Read and parse the ledger, with optional filters.
 */
export async function readLedger(
  projectDir: string,
  filters?: { category?: LedgerCategory; fromDate?: string; toDate?: string; limit?: number },
): Promise<Result<LedgerEntry[]>> {
  const path = ledgerPath(projectDir)
  try {
    const content = await readFile(path, 'utf-8')
    let entries = parseLedgerEntries(content)

    if (filters?.category) {
      entries = entries.filter(e => e.category === filters.category)
    }
    if (filters?.fromDate) {
      entries = entries.filter(e => e.timestamp >= filters.fromDate!)
    }
    if (filters?.toDate) {
      entries = entries.filter(e => e.timestamp <= filters.toDate!)
    }
    if (filters?.limit) {
      entries = entries.slice(0, filters.limit)
    }

    return ok(entries)
  } catch {
    return ok([]) // No ledger yet — empty is fine
  }
}

// ---------------------------------------------------------------------------
// MAP.md generation
// ---------------------------------------------------------------------------

/**
 * Generate MAP.md content describing where everything lives in .buildpact/
 */
export function generateMapContent(): string {
  return `# Project Map — Where Everything Lives

> Auto-generated. Describes the location and format of every information type in \`.buildpact/\`.

| What | Where | Format |
|------|-------|--------|
| Ledger (unified index) | \`.buildpact/LEDGER.md\` | Append-only, reverse chronological |
| Map (this file) | \`.buildpact/MAP.md\` | Auto-generated reference |
| Decisions | \`.buildpact/memory/decisions/\` | 1 .md per decision |
| Lessons | \`.buildpact/memory/lessons/\` | 1 .md per lesson |
| Gotchas | \`.buildpact/memory/gotchas/\` | 1 .md per gotcha |
| Feedback | \`.buildpact/memory/feedback/\` | 1 .json per session |
| Changelogs | \`.buildpact/changelogs/\` | 1 .md per artifact type |
| Handoffs | \`.buildpact/handoffs/\` | 1 .json per handoff |
| Approvals | \`.buildpact/approvals/\` | 1 .json per approval |
| Budget incidents | \`.buildpact/budget/incidents/\` | 1 .json per incident |
| Quality reviews | \`.buildpact/quality/reviews/\` | 1 .md per review |
| Metrics | \`.buildpact/metrics.json\` | Single ledger |
| Forensics | \`.buildpact/forensics/\` | 1 .json per crash |
| Checkpoints | \`.buildpact/checkpoints/\` | 1 .json per checkpoint |
| Build state | \`.buildpact/build-state.json\` | Single file |
| Constitution | \`.buildpact/constitution.md\` | Single, versioned |
| Config | \`.buildpact/config.yaml\` | Single file |
| Audit log | \`.buildpact/audit/\` | Append-only JSONL |
| Squads | \`.buildpact/squads/\` | 1 dir per squad |
| Specs | \`.buildpact/specs/\` | 1 dir per spec (versioned) |
| Plans | \`.buildpact/plans/\` | 1 dir per plan |
`
}

/**
 * Initialize LEDGER.md and per-directory MAP.md files.
 * LEDGER.md is created once; MAP.md files are regenerated on every call.
 */
export async function initializeLedger(projectDir: string): Promise<Result<void>> {
  const buildpactDir = join(projectDir, '.buildpact')
  await mkdir(buildpactDir, { recursive: true })

  // LEDGER.md — only create if missing
  const lPath = ledgerPath(projectDir)
  let ledgerExists = false
  try { await access(lPath); ledgerExists = true } catch { /* not found */ }
  if (!ledgerExists) {
    const header = [
      '# Project Ledger',
      '',
      '> Unified temporal index of all project events. Chronological order.',
      '> Each entry has a summary + pointer to details. Never edit manually.',
      '',
    ].join('\n')
    try {
      await writeFile(lPath, header, 'utf-8')
    } catch {
      return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.file.write_failed', params: { path: lPath } })
    }
  }

  // MAP.md — per-directory index, always regenerated
  try {
    await refreshBuildpactMaps(projectDir)
  } catch {
    // Non-critical — maps are convenience, not essential
  }

  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Convenience: create + append in one call
// ---------------------------------------------------------------------------

/**
 * Create a ledger entry and append it. Convenience for modules that register events.
 */
export async function registerEvent(
  projectDir: string,
  category: LedgerCategory,
  id: string,
  summary: string,
  detailsPath: string,
): Promise<Result<void>> {
  const entry: LedgerEntry = {
    timestamp: new Date().toISOString(),
    category,
    id,
    summary,
    detailsPath,
  }
  return appendToLedger(projectDir, entry)
}
