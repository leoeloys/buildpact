/**
 * Two-Stage Review — spec compliance first, code quality second.
 * Quality review only runs if spec compliance passes.
 * A single critical issue in spec compliance fails the entire review.
 *
 * @module engine/two-stage-review
 * @see Concept 3.4 (Two-stage review: spec compliance then code quality)
 */

import type { ReviewIssue, ReviewStage, TwoStageReviewResult } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a spec-compliance review stage from a list of issues.
 * Passes only if no critical issues are found.
 */
export function createSpecComplianceReview(issues: ReviewIssue[]): ReviewStage {
  return {
    stage: 'spec-compliance',
    issues,
    passed: !issues.some(i => i.severity === 'critical'),
  }
}

/**
 * Create a code-quality review stage from a list of issues.
 * Passes only if no critical issues are found.
 */
export function createCodeQualityReview(issues: ReviewIssue[]): ReviewStage {
  return {
    stage: 'code-quality',
    issues,
    passed: !issues.some(i => i.severity === 'critical'),
  }
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Run a two-stage review.
 * Quality review only runs if spec compliance passed.
 * Critical issues in spec stage force overallPassed=false regardless.
 */
export function runTwoStageReview(
  specReview: ReviewStage,
  qualityReview?: ReviewStage,
): TwoStageReviewResult {
  // If spec failed, quality review is skipped
  if (!specReview.passed) {
    return {
      specReview,
      qualityReview: null,
      overallPassed: false,
    }
  }

  // Spec passed — include quality review if provided
  const effectiveQuality = qualityReview ?? null
  const qualityPassed = effectiveQuality === null || effectiveQuality.passed

  return {
    specReview,
    qualityReview: effectiveQuality,
    overallPassed: specReview.passed && qualityPassed,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Check whether a review stage contains any critical issues.
 */
export function hasCriticalIssues(stage: ReviewStage): boolean {
  return stage.issues.some(i => i.severity === 'critical')
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a two-stage review result as a human-readable report.
 */
export function formatReviewReport(result: TwoStageReviewResult): string {
  const lines: string[] = []

  lines.push('## Two-Stage Review Report')
  lines.push('')
  lines.push(`### Stage 1: Spec Compliance — ${result.specReview.passed ? 'PASSED' : 'FAILED'}`)
  if (result.specReview.issues.length === 0) {
    lines.push('No issues found.')
  } else {
    for (const issue of result.specReview.issues) {
      lines.push(`- [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}`)
      lines.push(`  File: ${issue.file}${issue.line != null ? `:${issue.line}` : ''}`)
      lines.push(`  Recommendation: ${issue.recommendation}`)
    }
  }

  lines.push('')
  if (result.qualityReview === null) {
    lines.push('### Stage 2: Code Quality — SKIPPED (spec compliance failed)')
  } else {
    lines.push(`### Stage 2: Code Quality — ${result.qualityReview.passed ? 'PASSED' : 'FAILED'}`)
    if (result.qualityReview.issues.length === 0) {
      lines.push('No issues found.')
    } else {
      for (const issue of result.qualityReview.issues) {
        lines.push(`- [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}`)
        lines.push(`  File: ${issue.file}${issue.line != null ? `:${issue.line}` : ''}`)
        lines.push(`  Recommendation: ${issue.recommendation}`)
      }
    }
  }

  lines.push('')
  lines.push(`**Overall: ${result.overallPassed ? 'PASSED' : 'FAILED'}**`)

  return lines.join('\n')
}
