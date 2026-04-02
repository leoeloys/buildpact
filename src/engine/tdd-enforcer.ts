/**
 * TDD Enforcer — RED-GREEN-REFACTOR cycle enforcement.
 * "NO PRODUCTION CODE WITHOUT FAILING TEST FIRST"
 *
 * @module engine/tdd-enforcer
 * @see Concept 3.3 (Superpowers test-driven-development)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { TddPhase, TddCycleState, TestRunResult } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** File patterns exempt from TDD (config files, generated code) */
export const TDD_EXEMPT_PATTERNS = [
  /package\.json$/,
  /tsconfig.*\.json$/,
  /\.config\.(ts|js|mjs)$/,
  /\.env/,
  /\.gitignore$/,
  /\.md$/,
]

/** Anti-patterns that suggest TDD evasion */
export const TDD_ANTIPATTERNS = [
  'too simple to test',
  "i'll test after",
  'already manually tested',
  'test later',
  'no test needed',
  'trivial change',
]

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTddCycle(taskId: string): TddCycleState {
  return {
    taskId,
    phase: 'RED',
    testFilePath: null,
    testRunResults: [],
    productionFilesModified: [],
  }
}

// ---------------------------------------------------------------------------
// Phase checks
// ---------------------------------------------------------------------------

/**
 * Check if a file is exempt from TDD requirements.
 */
export function isExemptFromTdd(filePath: string): boolean {
  return TDD_EXEMPT_PATTERNS.some(p => p.test(filePath))
}

/**
 * Check if a file is a test file.
 */
export function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath)
}

/**
 * Record a file modification in the TDD cycle.
 * In RED phase: only test files allowed.
 * In GREEN phase: only production files allowed.
 * In REFACTOR phase: both allowed (but tests must keep passing).
 */
export function recordFileModification(
  state: TddCycleState,
  filePath: string,
): Result<TddCycleState> {
  if (isExemptFromTdd(filePath)) return ok(state)

  const isTest = isTestFile(filePath)

  if (state.phase === 'RED' && !isTest) {
    return err({
      code: ERROR_CODES.TDD_PRODUCTION_BEFORE_TEST,
      i18nKey: 'error.tdd.production_before_test',
      params: { file: filePath, phase: 'RED' },
    })
  }

  if (isTest && !state.testFilePath) {
    return ok({ ...state, testFilePath: filePath })
  }

  if (!isTest) {
    return ok({
      ...state,
      productionFilesModified: [...state.productionFilesModified, filePath],
    })
  }

  return ok(state)
}

/**
 * Record a test run result and validate phase constraints.
 * RED: tests MUST fail.
 * GREEN: tests MUST pass.
 * REFACTOR: tests MUST pass.
 */
export function recordTestRun(
  state: TddCycleState,
  exitCode: number,
  failureCount: number,
): Result<TddCycleState> {
  const result: TestRunResult = {
    phase: state.phase,
    exitCode,
    failureCount,
    timestamp: new Date().toISOString(),
  }

  const updated = { ...state, testRunResults: [...state.testRunResults, result] }

  if (state.phase === 'RED' && exitCode === 0 && failureCount === 0) {
    return err({
      code: ERROR_CODES.TDD_TEST_NOT_FAILING,
      i18nKey: 'error.tdd.test_not_failing',
      params: { phase: 'RED' },
    })
  }

  return ok(updated)
}

/**
 * Advance to the next TDD phase.
 * RED → GREEN (after test fails)
 * GREEN → REFACTOR (after test passes)
 * REFACTOR → RED (cycle complete, start new cycle)
 */
export function advanceTddPhase(state: TddCycleState): Result<TddCycleState> {
  const lastRun = state.testRunResults[state.testRunResults.length - 1]

  if (state.phase === 'RED') {
    if (!lastRun || (lastRun.exitCode === 0 && lastRun.failureCount === 0)) {
      return err({
        code: ERROR_CODES.TDD_PHASE_VIOLATION,
        i18nKey: 'error.tdd.phase_violation',
        params: { from: 'RED', to: 'GREEN', reason: 'test must fail first' },
      })
    }
    return ok({ ...state, phase: 'GREEN' })
  }

  if (state.phase === 'GREEN') {
    if (!lastRun || lastRun.exitCode !== 0 || lastRun.failureCount > 0) {
      return err({
        code: ERROR_CODES.TDD_PHASE_VIOLATION,
        i18nKey: 'error.tdd.phase_violation',
        params: { from: 'GREEN', to: 'REFACTOR', reason: 'test must pass first' },
      })
    }
    return ok({ ...state, phase: 'REFACTOR' })
  }

  // REFACTOR → RED (new cycle)
  return ok({
    ...state,
    phase: 'RED',
    testFilePath: null,
    productionFilesModified: [],
  })
}

/**
 * Detect TDD anti-patterns in text (e.g., commit messages, agent output).
 */
export function detectTddAntipatterns(text: string): string[] {
  const lower = text.toLowerCase()
  return TDD_ANTIPATTERNS.filter(p => lower.includes(p))
}
