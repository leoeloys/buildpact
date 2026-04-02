/**
 * Edge Case Hunter — exhaustive path enumeration for missing handling.
 * Lists ONLY unhandled paths. No comments on quality, no praise — just gaps.
 *
 * @module engine/edge-case-hunter
 * @see Concept 10.3 (BMAD edge case hunter)
 */

import type { EdgeCaseFinding, EdgeCaseHuntResult } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFinding(
  location: string,
  triggerCondition: string,
  guardSnippet: string,
  potentialConsequence: string,
  severity: EdgeCaseFinding['severity'] = 'medium',
): EdgeCaseFinding {
  return { location, triggerCondition, guardSnippet, potentialConsequence, severity }
}

export function createHuntResult(findings: EdgeCaseFinding[]): EdgeCaseHuntResult {
  return { findings }
}

// ---------------------------------------------------------------------------
// Analysis helpers
// ---------------------------------------------------------------------------

/** Common edge case categories to check for */
export const EDGE_CASE_CATEGORIES = [
  'null/undefined input',
  'empty string/array',
  'boundary values (0, -1, MAX_INT)',
  'concurrent access',
  'network failure / timeout',
  'disk full / permission denied',
  'malformed input / encoding',
  'race condition between operations',
  'state corruption after partial failure',
  'overflow / truncation',
] as const

/**
 * Count findings by severity.
 */
export function countBySeverity(result: EdgeCaseHuntResult): Record<string, number> {
  const counts: Record<string, number> = { high: 0, medium: 0, low: 0 }
  for (const f of result.findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1
  }
  return counts
}

/**
 * Filter findings by minimum severity.
 */
export function filterBySeverity(
  result: EdgeCaseHuntResult,
  minSeverity: 'high' | 'medium' | 'low',
): EdgeCaseFinding[] {
  const severityOrder = { high: 3, medium: 2, low: 1 }
  const minLevel = severityOrder[minSeverity]
  return result.findings.filter(f => severityOrder[f.severity] >= minLevel)
}

/**
 * Format findings as structured output.
 */
export function formatFindings(result: EdgeCaseHuntResult): string {
  if (result.findings.length === 0) return 'No edge cases found.'

  return result.findings
    .map((f, i) => [
      `${i + 1}. [${f.severity.toUpperCase()}] ${f.location}`,
      `   Trigger: ${f.triggerCondition}`,
      `   Guard: ${f.guardSnippet}`,
      `   Consequence: ${f.potentialConsequence}`,
    ].join('\n'))
    .join('\n\n')
}
