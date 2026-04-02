/**
 * Experiment Loop — autonomous metric optimization with binary keep/discard.
 * Baseline mandatory. Single metric focus. Crash recovery built-in.
 *
 * @module engine/experiment-loop
 * @see Concept 4.1 (Autoresearch experiment loop)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { OptimizationTarget } from '../contracts/experiment.js'
import type { ExperimentResult, ExperimentLoopState } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createExperimentLoop(
  tag: string,
  branch: string,
  stopCondition: ExperimentLoopState['stopCondition'] = 'manual',
): ExperimentLoopState {
  return { tag, branch, baseline: null, experiments: [], stopCondition }
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

/**
 * Set baseline measurement. Must be called before any experiments.
 */
export function setBaseline(state: ExperimentLoopState, value: number): ExperimentLoopState {
  return { ...state, baseline: value }
}

/**
 * Require baseline before proceeding.
 */
export function requireBaseline(state: ExperimentLoopState): Result<number> {
  if (state.baseline === null) {
    return err({
      code: ERROR_CODES.EXPERIMENT_BASELINE_MISSING,
      i18nKey: 'error.experiment.baseline_missing',
      params: { tag: state.tag },
    })
  }
  return ok(state.baseline)
}

// ---------------------------------------------------------------------------
// Experiment recording
// ---------------------------------------------------------------------------

/**
 * Record an experiment result. Binary decision: keep or discard.
 */
export function recordExperiment(
  state: ExperimentLoopState,
  result: ExperimentResult,
): ExperimentLoopState {
  return { ...state, experiments: [...state.experiments, result] }
}

/**
 * Decide keep/discard based on metric direction.
 */
export function shouldKeep(
  target: OptimizationTarget,
  baseline: number,
  measured: number,
): boolean {
  if (target.direction === 'maximize') return measured > baseline
  return measured < baseline
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function bestExperiment(state: ExperimentLoopState): ExperimentResult | undefined {
  const kept = state.experiments.filter(e => e.status === 'keep')
  if (kept.length === 0) return undefined
  return kept[kept.length - 1]
}

export function experimentCount(state: ExperimentLoopState): {
  total: number; kept: number; discarded: number; crashed: number
} {
  return {
    total: state.experiments.length,
    kept: state.experiments.filter(e => e.status === 'keep').length,
    discarded: state.experiments.filter(e => e.status === 'discard').length,
    crashed: state.experiments.filter(e => e.status === 'crash').length,
  }
}

/**
 * Detect plateau: last N experiments all discarded.
 */
export function detectPlateau(state: ExperimentLoopState, windowSize: number = 5): boolean {
  if (state.experiments.length < windowSize) return false
  const recent = state.experiments.slice(-windowSize)
  return recent.every(e => e.status === 'discard')
}
