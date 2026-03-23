/**
 * @module commands/audit/handler
 * @see Story 15.2 — Audit Trail Export
 *
 * Read .buildpact/audit/*.jsonl files and export as JSON or CSV
 * with optional date-range and command-type filters.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, type Result } from '../../contracts/errors.js'
import type { AuditEntry } from '../../foundation/audit.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditExportOptions {
  /** Output format */
  format: 'json' | 'csv'
  /** Optional start date (inclusive, ISO date string) */
  from?: string
  /** Optional end date (inclusive, ISO date string) */
  to?: string
  /** Filter by command/action type */
  command?: string
  /** Output file path (undefined = return string) */
  output?: string
  /** Project directory */
  projectDir: string
}

// ---------------------------------------------------------------------------
// JSONL reader
// ---------------------------------------------------------------------------

/**
 * Read all .jsonl files from the audit directory and parse entries.
 */
export async function readAuditEntries(auditDir: string): Promise<Result<AuditEntry[]>> {
  let files: string[]
  try {
    const allFiles = await readdir(auditDir)
    files = allFiles.filter((f) => f.endsWith('.jsonl')).sort()
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok([])
    }
    return err({ code: 'FILE_READ_FAILED', i18nKey: 'error.file.read_failed', cause })
  }

  const entries: AuditEntry[] = []
  for (const file of files) {
    try {
      const content = await readFile(join(auditDir, file), 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          entries.push(JSON.parse(trimmed) as AuditEntry)
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return ok(entries)
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * Apply date range and command filters to audit entries.
 */
export function filterEntries(
  entries: AuditEntry[],
  options: Pick<AuditExportOptions, 'from' | 'to' | 'command'>,
): AuditEntry[] {
  let filtered = entries

  if (options.from) {
    const fromDate = new Date(options.from)
    filtered = filtered.filter((e) => new Date(e.ts) >= fromDate)
  }

  if (options.to) {
    // "to" is inclusive — add one day to make end-of-day inclusive
    const toDate = new Date(options.to)
    toDate.setDate(toDate.getDate() + 1)
    filtered = filtered.filter((e) => new Date(e.ts) < toDate)
  }

  if (options.command) {
    const cmd = options.command.toLowerCase()
    filtered = filtered.filter((e) => e.action.toLowerCase().includes(cmd))
  }

  return filtered
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Format entries as pretty-printed JSON array */
export function formatJson(entries: AuditEntry[]): string {
  return JSON.stringify(entries, null, 2)
}

/** Escape a CSV field value — always wraps in quotes for safety */
function escapeCsvField(value: string): string {
  // Always wrap in quotes and escape internal quotes by doubling them
  return `"${value.replace(/"/g, '""')}"`
}

/** Format entries as CSV with headers */
export function formatCsv(entries: AuditEntry[]): string {
  const headers = ['ts', 'action', 'agent', 'files', 'outcome', 'error', 'cost_usd', 'tokens']
  const lines: string[] = [headers.join(',')]

  for (const entry of entries) {
    const row = [
      entry.ts,
      entry.action,
      entry.agent,
      entry.files.join(';'),
      entry.outcome,
      entry.error ?? '',
      entry.cost_usd != null ? String(entry.cost_usd) : '',
      entry.tokens != null ? String(entry.tokens) : '',
    ].map(escapeCsvField)
    lines.push(row.join(','))
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Handle audit export — read, filter, format, and optionally write to file.
 */
export async function handleAuditExport(options: AuditExportOptions): Promise<Result<string>> {
  const auditDir = join(options.projectDir, '.buildpact', 'audit')

  const readResult = await readAuditEntries(auditDir)
  if (!readResult.ok) return readResult

  const filtered = filterEntries(readResult.value, options)

  const formatted =
    options.format === 'csv' ? formatCsv(filtered) : formatJson(filtered)

  if (options.output) {
    try {
      await writeFile(options.output, formatted, 'utf-8')
    } catch (cause) {
      return err({ code: 'FILE_WRITE_FAILED', i18nKey: 'error.file.write_failed', cause })
    }
  }

  return ok(formatted)
}
