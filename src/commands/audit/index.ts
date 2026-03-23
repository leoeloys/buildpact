/**
 * @module commands/audit
 * @see Story 15.2 — Audit Trail Export
 *
 * CLI entry point for `bp audit export`.
 */

import * as clack from '@clack/prompts'
import { ok } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import { handleAuditExport } from './handler.js'

export const handler: CommandHandler = {
  async run(args: string[]) {
    const subcommand = args[0]

    if (subcommand !== 'export') {
      clack.log.info('Usage: buildpact audit export --format json|csv [--from DATE] [--to DATE] [--command TYPE] [--output FILE]')
      return ok(undefined)
    }

    // Parse flags
    let format: 'json' | 'csv' = 'json'
    let from: string | undefined
    let to: string | undefined
    let command: string | undefined
    let output: string | undefined

    for (let i = 1; i < args.length; i++) {
      const arg = args[i]
      const next = args[i + 1]
      if (arg === '--format' && next) { format = next as 'json' | 'csv'; i++ }
      else if (arg === '--from' && next) { from = next; i++ }
      else if (arg === '--to' && next) { to = next; i++ }
      else if (arg === '--command' && next) { command = next; i++ }
      else if (arg === '--output' && next) { output = next; i++ }
    }

    const projectDir = process.cwd()
    const result = await handleAuditExport({ format, from, to, command, output, projectDir })

    if (!result.ok) {
      clack.log.error(result.error.i18nKey)
      return result
    }

    if (output) {
      clack.log.success(`Audit export written to ${output}`)
    } else {
      // Write to stdout
      process.stdout.write(result.value + '\n')
    }

    return ok(undefined)
  },
}
