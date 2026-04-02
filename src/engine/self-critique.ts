/**
 * Self-Critique — mandatory self-assessment at post-code and post-test gates.
 * Minimum 3 predicted bugs + 3 edge cases. Vague descriptions rejected.
 *
 * @module engine/self-critique
 * @see Concept 8.1 (AIOX self-critique)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { SelfCritiqueReport, PredictedIssue } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_PREDICTED_BUGS = 3
export const MIN_EDGE_CASES = 3
export const MIN_DESCRIPTION_LENGTH = 20

/** Vague descriptions that indicate low-effort self-critique */
const VAGUE_PATTERNS = [
  'might have issues',
  'could be a problem',
  'potential issue',
  'may not work',
  'needs more testing',
  'something could go wrong',
]

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSelfCritiqueReport(
  taskId: string,
  gate: 'post-code' | 'post-test',
  predictedBugs: PredictedIssue[],
  edgeCases: PredictedIssue[],
): SelfCritiqueReport {
  return {
    taskId,
    gate,
    predictedBugs,
    edgeCases,
    overallPass: false, // Set after validation
    skipped: false,
    timestamp: new Date().toISOString(),
  }
}

export function createSkippedReport(taskId: string, gate: 'post-code' | 'post-test'): SelfCritiqueReport {
  return {
    taskId,
    gate,
    predictedBugs: [],
    edgeCases: [],
    overallPass: false,
    skipped: true,
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check if a predicted issue description is too vague.
 */
export function isVagueDescription(description: string): boolean {
  if (description.length < MIN_DESCRIPTION_LENGTH) return true
  const lower = description.toLowerCase()
  return VAGUE_PATTERNS.some(p => lower.includes(p))
}

/**
 * Validate a self-critique report meets minimum requirements.
 * BLOCKS if insufficient bugs/edge cases or vague descriptions.
 */
export function validateSelfCritique(report: SelfCritiqueReport): Result<SelfCritiqueReport> {
  if (report.skipped) {
    return ok(report) // Skipped reports are allowed but flagged
  }

  if (report.predictedBugs.length < MIN_PREDICTED_BUGS) {
    return err({
      code: ERROR_CODES.SELF_CRITIQUE_INSUFFICIENT,
      i18nKey: 'error.self_critique.insufficient_bugs',
      params: {
        count: String(report.predictedBugs.length),
        minimum: String(MIN_PREDICTED_BUGS),
      },
    })
  }

  if (report.edgeCases.length < MIN_EDGE_CASES) {
    return err({
      code: ERROR_CODES.SELF_CRITIQUE_INSUFFICIENT,
      i18nKey: 'error.self_critique.insufficient_edge_cases',
      params: {
        count: String(report.edgeCases.length),
        minimum: String(MIN_EDGE_CASES),
      },
    })
  }

  // Check for vague descriptions
  const allIssues = [...report.predictedBugs, ...report.edgeCases]
  const vagueIssues = allIssues.filter(i => isVagueDescription(i.description))
  if (vagueIssues.length > 0) {
    return err({
      code: ERROR_CODES.SELF_CRITIQUE_INSUFFICIENT,
      i18nKey: 'error.self_critique.vague_descriptions',
      params: { count: String(vagueIssues.length) },
    })
  }

  return ok({ ...report, overallPass: true })
}

/**
 * Require self-critique for a task. BLOCKS if no report provided.
 */
export function requireSelfCritique(
  report?: SelfCritiqueReport | undefined,
): Result<SelfCritiqueReport> {
  if (!report) {
    return err({
      code: ERROR_CODES.SELF_CRITIQUE_MISSING,
      i18nKey: 'error.self_critique.missing',
    })
  }
  return validateSelfCritique(report)
}
