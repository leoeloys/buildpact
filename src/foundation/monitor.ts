/**
 * @module foundation/monitor
 * @see FR-303
 *
 * Real-time context & cost monitoring for BuildPact CLI.
 * Alpha phase: alert thresholds fully implemented; token/cost integrations are stubs
 * pending Claude API hooks (promoted in Beta — FR-303).
 */

import { err, ERROR_CODES, type Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertLevel = 'none' | 'warning' | 'critical'

export interface CostState {
  estimatedPhaseCostUsd: number
  accumulatedMilestoneCostUsd: number
}

export interface MonitorState {
  contextPct: number
  alertLevel: AlertLevel
  cost: CostState
}

// ---------------------------------------------------------------------------
// Constants — FR-303 canonical thresholds
// ---------------------------------------------------------------------------

export const CONTEXT_WARNING_THRESHOLD = 0.50
export const CONTEXT_CRITICAL_THRESHOLD = 0.75

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the alert level for a given context usage percentage.
 * Pure function — no I/O, never throws.
 *
 * Boundaries are inclusive (at-or-beyond per FR-303): pct >= 0.75 → 'critical', pct >= 0.50 → 'warning'.
 * Note: ACs say "exceeds 50%/75%" but FR-303 intends inclusive — pct = 0.50 triggers 'warning'.
 */
export function checkContextAlert(pct: number): AlertLevel {
  if (pct >= CONTEXT_CRITICAL_THRESHOLD) return 'critical'
  if (pct >= CONTEXT_WARNING_THRESHOLD) return 'warning'
  return 'none'
}

/**
 * Returns the current context usage as a fraction [0, 1].
 *
 * Alpha stub — no Claude API hook for real-time token count in this phase.
 * TODO: integrate Claude API token count — FR-303, promoted in Beta.
 */
export function getContextUsage(): Result<number> {
  // TODO: integrate Claude API token count — FR-303, promoted in Beta
  return err({ code: ERROR_CODES.NOT_IMPLEMENTED, i18nKey: 'error.stub.not_implemented', phase: 'Alpha — FR-303' })
}

/**
 * Returns the current cost state for the active session.
 *
 * Alpha stub — cost tracking requires API integration in Beta.
 * TODO: integrate cost tracking — FR-303, promoted in Beta.
 */
export function getCostState(): Result<CostState> {
  // TODO: integrate cost tracking — FR-303, promoted in Beta
  return err({ code: ERROR_CODES.NOT_IMPLEMENTED, i18nKey: 'error.stub.not_implemented', phase: 'Alpha — FR-303' })
}
