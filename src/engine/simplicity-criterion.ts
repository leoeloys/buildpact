/**
 * Simplicity Criterion — measure whether a change is worth its complexity.
 * If the metric improvement is too small relative to the code churn,
 * the change should be auto-discarded.
 *
 * @module engine/simplicity-criterion
 * @see Concept 4.3 (Simplicity criterion for experiment evaluation)
 */

import type { SimplicityCheck } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Calculate the simplicity check for a code change.
 * netComplexity = linesAdded - linesRemoved (positive = more complex)
 * simplicityRatio = metricImprovement / max(netComplexity, 1)
 */
export function calculateSimplicity(
  linesAdded: number,
  linesRemoved: number,
  metricImprovement: number,
): SimplicityCheck {
  const netComplexity = linesAdded - linesRemoved
  const denominator = Math.max(Math.abs(netComplexity), 1)
  const simplicityRatio = metricImprovement / denominator

  return {
    linesAdded,
    linesRemoved,
    netComplexity,
    metricImprovement,
    simplicityRatio,
  }
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/**
 * Determine whether a change should be auto-discarded.
 * Discard if: metric improvement is below threshold AND net complexity exceeds limit.
 */
export function shouldAutoDiscard(
  check: SimplicityCheck,
  improvementThreshold: number = 0.01,
  complexityThreshold: number = 20,
): boolean {
  return check.metricImprovement < improvementThreshold && check.netComplexity > complexityThreshold
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a simplicity check as a human-readable report.
 */
export function formatSimplicityReport(check: SimplicityCheck): string {
  const lines: string[] = []
  lines.push('## Simplicity Criterion Report')
  lines.push('')
  lines.push(`- Lines added: ${check.linesAdded}`)
  lines.push(`- Lines removed: ${check.linesRemoved}`)
  lines.push(`- Net complexity: ${check.netComplexity > 0 ? '+' : ''}${check.netComplexity}`)
  lines.push(`- Metric improvement: ${check.metricImprovement.toFixed(4)}`)
  lines.push(`- Simplicity ratio: ${check.simplicityRatio.toFixed(4)}`)
  lines.push('')

  const discard = shouldAutoDiscard(check)
  lines.push(`**Verdict: ${discard ? 'AUTO-DISCARD (improvement too small for complexity)' : 'KEEP'}**`)

  return lines.join('\n')
}
