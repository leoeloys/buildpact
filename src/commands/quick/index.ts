/**
 * Quick Flow command — zero-ceremony execution.
 * @see FR-401
 */

import { readFileSync } from 'node:fs'
import { ok, err } from '../../contracts/errors.js'
import type { Result, CliError } from '../../contracts/errors.js'
import { handler } from './handler.js'

export { handler }

/**
 * Load the quick orchestrator template from the package templates directory.
 */
export function loadQuickTemplate(): string {
  return readFileSync(new URL('../../../templates/commands/quick.md', import.meta.url), 'utf8')
}

/**
 * Parse CLI args into description and mode.
 * Strips --discuss and --full flags before joining remaining tokens as description.
 */
export function parseQuickArgs(args: string[]): { description: string; mode: 'base' | 'discuss' | 'full' } {
  let mode: 'base' | 'discuss' | 'full' = 'base'
  if (args.includes('--discuss')) mode = 'discuss'
  if (args.includes('--full')) mode = 'full'
  const description = args.filter((a) => !a.startsWith('--')).join(' ')
  return { description, mode }
}

/**
 * Quick Flow command — zero-ceremony execution.
 * Returns MISSING_ARG if no description is provided.
 * --discuss mode delegates to handler which runs the discuss flow via gatherDiscussContext.
 * --full mode delegates to handler which runs plan generation, validation, and verification.
 * @see FR-401
 * @see FR-402
 * @see FR-403
 */
export async function runQuick(args: string[], projectDir: string): Promise<Result<void, CliError>> {
  const { description, mode } = parseQuickArgs(args)

  if (!description) {
    return {
      ok: false,
      error: { code: 'MISSING_ARG', i18nKey: 'cli.quick.no_description', phase: 'alpha' },
    }
  }

  // All modes (base, discuss, full) execute via handler
  // handler.run() owns the audit log entry (quick.execute) — no duplication here
  return handler.run(args)
}
