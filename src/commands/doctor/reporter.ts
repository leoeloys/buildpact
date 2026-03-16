import * as clack from '@clack/prompts'
import type { CheckResult } from './types.js'

/** Display a single check result using @clack/prompts log methods */
export function reportCheck(result: CheckResult): void {
  switch (result.status) {
    case 'pass':
      clack.log.success(result.message)
      break
    case 'warn':
      clack.log.warn(result.message)
      if (result.remediation) {
        clack.log.info(`  → ${result.remediation}`)
      }
      break
    case 'fail':
      clack.log.error(result.message)
      if (result.remediation) {
        clack.log.info(`  → ${result.remediation}`)
      }
      break
  }
}
