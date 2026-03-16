/**
 * Pipeline orchestrator — Markdown template loader and compliance validator.
 * Enforces that every orchestrator command file respects line and context budgets.
 * @module engine/orchestrator
 * @see FR-301 — Orchestrator size limits (≤300 lines, ≤15% context window)
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { err, ok, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

/** Maximum number of lines permitted in any orchestrator Markdown file (FR-301) */
const MAX_ORCHESTRATOR_LINES = 300

/**
 * Reads a Markdown orchestrator template from the templates/commands/ directory.
 * Returns the raw file content for use by command handlers or validation.
 */
export async function loadOrchestratorTemplate(
  commandName: string,
  templatesDir: string,
): Promise<Result<string>> {
  const filePath = join(templatesDir, 'commands', `${commandName}.md`)
  try {
    const content = await readFile(filePath, 'utf-8')
    return ok(content)
  } catch {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.engine.file_read_failed',
      params: { path: filePath },
    })
  }
}

/**
 * Validates that a Markdown orchestrator file meets all compliance requirements:
 * 1. Line count ≤ 300 (FR-301)
 * 2. Contains ORCHESTRATOR header comment
 * 3. Contains ## Implementation Notes block
 *
 * Checks are applied in order — first failure returns immediately.
 */
export function validateOrchestratorFile(content: string, filePath: string): Result<void> {
  const lines = content.split('\n')

  if (lines.length > MAX_ORCHESTRATOR_LINES) {
    return err({
      code: ERROR_CODES.ORCHESTRATOR_TOO_LONG,
      i18nKey: 'error.engine.orchestrator_too_long',
      params: {
        path: filePath,
        lines: String(lines.length),
        max: String(MAX_ORCHESTRATOR_LINES),
      },
    })
  }

  const hasOrchestratorHeader = lines.some(line => line.includes('<!-- ORCHESTRATOR:'))
  if (!hasOrchestratorHeader) {
    return err({
      code: ERROR_CODES.MISSING_ORCHESTRATOR_HEADER,
      i18nKey: 'error.engine.missing_orchestrator_header',
      params: { path: filePath },
    })
  }

  const hasImplementationNotes = lines.some(line => line.trimEnd() === '## Implementation Notes')
  if (!hasImplementationNotes) {
    return err({
      code: ERROR_CODES.MISSING_IMPLEMENTATION_NOTES,
      i18nKey: 'error.engine.missing_implementation_notes',
      params: { path: filePath },
    })
  }

  return ok(undefined)
}
