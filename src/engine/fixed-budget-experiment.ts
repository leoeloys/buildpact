/**
 * Fixed Budget Experiment — hard caps on experiment resource consumption.
 * Supports time, cost, and token budgets with strict/soft enforcement.
 *
 * @module engine/fixed-budget-experiment
 * @see Concept 4.5 (Fixed-budget experiments with kill switches)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Budget type: what resource is being capped */
export type BudgetType = 'time' | 'cost' | 'tokens'

/** A fixed experiment budget with strict/soft enforcement */
export interface ExperimentBudget {
  /** What resource is being capped */
  type: BudgetType
  /** Budget value (seconds for time, USD for cost, count for tokens) */
  value: number
  /** If true, exceeding budget kills the experiment immediately */
  strict: boolean
}

/** Result of checking budget consumption */
export interface BudgetCheckResult {
  /** Whether the budget has been exceeded */
  exceeded: boolean
  /** Remaining budget (negative if exceeded) */
  remaining: number
  /** Whether the experiment should be killed (only true if strict + exceeded) */
  shouldKill: boolean
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fixed experiment budget.
 */
export function createExperimentBudget(
  type: BudgetType,
  value: number,
  strict: boolean,
): ExperimentBudget {
  return { type, value, strict }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Check budget consumption against the limit.
 * Returns whether budget is exceeded, remaining amount, and kill signal.
 */
export function checkBudget(
  budget: ExperimentBudget,
  elapsed: number,
): BudgetCheckResult {
  const remaining = budget.value - elapsed
  const exceeded = remaining < 0

  return {
    exceeded,
    remaining,
    shouldKill: exceeded && budget.strict,
  }
}

/**
 * Require that the budget has not been exceeded.
 * Returns an error if the budget is exceeded and strict mode is on.
 */
export function requireBudget(
  budget: ExperimentBudget,
  elapsed: number,
): Result<BudgetCheckResult> {
  const result = checkBudget(budget, elapsed)

  if (result.shouldKill) {
    return err({
      code: ERROR_CODES.BUDGET_EXCEEDED,
      i18nKey: 'error.experiment.budget_exceeded',
      params: {
        type: budget.type,
        value: String(budget.value),
        elapsed: String(elapsed),
      },
    })
  }

  return ok(result)
}
