/**
 * Adversarial Review — cynical posture, minimum findings required.
 * "Assume problems exist. Find what's missing, not just what's wrong."
 * 0 findings = suspicious result requiring re-analysis.
 *
 * @module engine/adversarial-review
 * @see Concept 10.2 (BMAD adversarial review)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { AdversarialReviewConfig, AdversarialReviewResult, AdversarialFinding } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_MINIMUM_FINDINGS = 10

export const REVIEWER_POSTURE = 'Cynical, zero patience for sloppy work. Assumes problems exist. Attacks the work, not the person.'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createReviewConfig(
  content: string,
  contentType: AdversarialReviewConfig['contentType'],
  minimumFindings: number = DEFAULT_MINIMUM_FINDINGS,
): AdversarialReviewConfig {
  return { content, contentType, minimumFindings }
}

export function createFinding(
  description: string,
  severity: AdversarialFinding['severity'],
  category: AdversarialFinding['category'],
  evidence: string,
): AdversarialFinding {
  return { description, severity, category, evidence }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an adversarial review result.
 * 0 findings → suspicious (likely insufficient analysis).
 * Below minimum → warning but still valid.
 */
export function validateReviewResult(
  config: AdversarialReviewConfig,
  result: AdversarialReviewResult,
): Result<AdversarialReviewResult> {
  if (result.findings.length === 0) {
    return err({
      code: ERROR_CODES.ADVERSARIAL_ZERO_FINDINGS,
      i18nKey: 'error.adversarial.zero_findings',
      params: { contentType: config.contentType },
    })
  }

  const updated = {
    ...result,
    suspicious: result.findings.length < config.minimumFindings,
    reviewerPosture: REVIEWER_POSTURE,
  }

  return ok(updated)
}

/**
 * Create a review result from a list of findings.
 */
export function createReviewResult(findings: AdversarialFinding[]): AdversarialReviewResult {
  return {
    findings,
    suspicious: false,
    reviewerPosture: REVIEWER_POSTURE,
  }
}

/**
 * Summarize findings by severity.
 */
export function summarizeFindings(findings: AdversarialFinding[]): Record<string, number> {
  const summary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) {
    summary[f.severity] = (summary[f.severity] ?? 0) + 1
  }
  return summary
}

/**
 * Format findings for display.
 */
export function formatFindings(findings: AdversarialFinding[]): string {
  return findings
    .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] (${f.category}) ${f.description}\n   Evidence: ${f.evidence}`)
    .join('\n\n')
}
