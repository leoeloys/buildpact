/**
 * @module foundation/decisions
 * @see NFR-26
 *
 * Append-only project decision log for BuildPact CLI.
 * Appends structured entries to DECISIONS.md at the project root.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single decision log entry (NFR-26). */
export interface DecisionEntry {
  /** ISO date string, e.g. "2026-03-15" */
  date: string
  /** One-line summary of the decision made. */
  decision: string
  /** Rationale behind the decision. */
  rationale: string
  /** List of file paths or artifact names affected. */
  affected: string[]
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Appends a structured entry to DECISIONS.md at {projectDir}/DECISIONS.md.
 * Creates the file if it does not exist.
 * Never truncates or overwrites existing content (append semantics).
 *
 * Returns ok(undefined) on success, or FILE_WRITE_FAILED on I/O error.
 */
export async function appendDecision(
  projectDir: string,
  entry: DecisionEntry,
): Promise<Result<void>> {
  const decisionsPath = join(projectDir, 'DECISIONS.md')
  try {
    let existing = ''
    try {
      existing = await readFile(decisionsPath, 'utf-8')
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      // File does not exist yet — start from empty string
    }

    const newEntry = [
      '',
      `## ${entry.date} — ${entry.decision}`,
      '',
      `**Decision:** ${entry.decision}`,
      `**Rationale:** ${entry.rationale}`,
      `**Affected:** ${entry.affected.join(', ')}`,
      '',
      '---',
    ].join('\n')

    await writeFile(decisionsPath, existing + newEntry, 'utf-8')
    return ok(undefined)
  } catch (cause) {
    return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.decisions.write_failed', cause })
  }
}
