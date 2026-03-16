/**
 * Budget guard — session/phase/day cost limits before execution.
 * @module engine/budget-guard
 * @see FR-705 — Budget Guards (Beta)
 */

import type { BudgetConfig, BudgetGuardResult } from '../contracts/budget.js'
import type { Result } from '../contracts/errors.js'
import { ERROR_CODES } from '../contracts/errors.js'

/**
 * Checks whether the current session budget allows proceeding with a task.
 * @stub Deferred to Beta — FR-705
 */
export function checkBudget(_config: BudgetConfig): Result<BudgetGuardResult> {
  // TODO: implement in Beta — FR-705 budget guards (session/phase/day limits)
  return { ok: false, error: { code: ERROR_CODES.NOT_IMPLEMENTED, i18nKey: 'error.stub.not_implemented', phase: 'Beta' } }
}
