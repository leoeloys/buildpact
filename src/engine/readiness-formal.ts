/**
 * Readiness Formal — 6-step implementation readiness assessment.
 * All steps must pass for READY verdict. Any critical failure = NOT_READY.
 * Non-critical failures = NEEDS_WORK.
 *
 * @module engine/readiness-formal
 * @see Concept 10.4 (Formal readiness assessment before implementation)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ReadinessAssessment, ReadinessStep, ReadinessVerdict } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The 6 mandatory readiness steps in evaluation order */
export const READINESS_STEPS: ReadinessStep['step'][] = [
  'discovery',
  'spec-analysis',
  'plan-coverage',
  'architecture-alignment',
  'quality-review',
  'final-assessment',
]

/** Steps whose failure means NOT_READY (vs NEEDS_WORK) */
const CRITICAL_STEPS: ReadinessStep['step'][] = [
  'spec-analysis',
  'architecture-alignment',
]

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fresh readiness assessment with all 6 steps pending.
 */
export function createReadinessAssessment(): ReadinessAssessment {
  return {
    steps: READINESS_STEPS.map(step => ({
      step,
      passed: false,
      notes: 'Pending evaluation.',
    })),
    verdict: 'NOT_READY',
    blockers: [],
  }
}

// ---------------------------------------------------------------------------
// Step completion
// ---------------------------------------------------------------------------

/**
 * Complete a readiness step with a pass/fail result and notes.
 * Returns a new assessment with the updated step and recomputed verdict.
 */
export function completeStep(
  assessment: ReadinessAssessment,
  step: ReadinessStep['step'],
  passed: boolean,
  notes: string,
): ReadinessAssessment {
  const updatedSteps = assessment.steps.map(s =>
    s.step === step ? { ...s, passed, notes } : s,
  )

  const updatedAssessment: ReadinessAssessment = {
    ...assessment,
    steps: updatedSteps,
    verdict: 'NOT_READY',
    blockers: [],
  }

  return {
    ...updatedAssessment,
    ...computeVerdictInternal(updatedSteps),
  }
}

// ---------------------------------------------------------------------------
// Verdict computation
// ---------------------------------------------------------------------------

function computeVerdictInternal(
  steps: ReadinessStep[],
): { verdict: ReadinessVerdict; blockers: string[] } {
  const blockers: string[] = []
  let hasCriticalFailure = false
  let hasAnyFailure = false

  for (const step of steps) {
    if (!step.passed) {
      hasAnyFailure = true
      blockers.push(`${step.step}: ${step.notes}`)

      if (CRITICAL_STEPS.includes(step.step)) {
        hasCriticalFailure = true
      }
    }
  }

  let verdict: ReadinessVerdict
  if (hasCriticalFailure) {
    verdict = 'NOT_READY'
  } else if (hasAnyFailure) {
    verdict = 'NEEDS_WORK'
  } else {
    verdict = 'READY'
  }

  return { verdict, blockers }
}

/**
 * Compute the readiness verdict from an assessment's steps.
 * All passed = READY. Any critical failure = NOT_READY. Otherwise = NEEDS_WORK.
 */
export function computeVerdict(assessment: ReadinessAssessment): ReadinessVerdict {
  return computeVerdictInternal(assessment.steps).verdict
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Require that the assessment is READY.
 * Blocks with an error if verdict is NOT_READY.
 * NEEDS_WORK passes with a warning (not blocking).
 */
export function requireReady(assessment: ReadinessAssessment): Result<void> {
  if (assessment.verdict === 'NOT_READY') {
    return err({
      code: ERROR_CODES.READINESS_NOT_READY,
      i18nKey: 'error.readiness.not_ready',
      params: {
        blockers: assessment.blockers.join('; '),
      },
    })
  }

  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a readiness assessment as a human-readable report.
 */
export function formatReadinessReport(assessment: ReadinessAssessment): string {
  const lines: string[] = []

  lines.push('## Readiness Assessment Report')
  lines.push('')
  lines.push(`**Verdict: ${assessment.verdict}**`)
  lines.push('')

  for (const step of assessment.steps) {
    const icon = step.passed ? 'PASS' : 'FAIL'
    lines.push(`### ${step.step} — ${icon}`)
    lines.push(step.notes)
    lines.push('')
  }

  if (assessment.blockers.length > 0) {
    lines.push('### Blockers')
    for (const blocker of assessment.blockers) {
      lines.push(`- ${blocker}`)
    }
  }

  return lines.join('\n')
}
