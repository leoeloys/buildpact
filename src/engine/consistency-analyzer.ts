/**
 * Consistency Analyzer — cross-artifact validation for contradictions.
 * Detects terminology drift, coverage gaps, requirement conflicts,
 * and constitution violations across project artifacts.
 *
 * @module engine/consistency-analyzer
 * @see Concept 6.2 (Cross-artifact consistency analysis)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type {
  ConsistencyCategory,
  ConsistencyFinding,
  ConsistencyReport,
} from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Counter
// ---------------------------------------------------------------------------

let findingCounter = 0

/** Reset the auto-ID counter (useful for testing) */
export function resetFindingCounter(): void {
  findingCounter = 0
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a consistency finding with an auto-generated ID.
 */
export function createConsistencyFinding(
  severity: ConsistencyFinding['severity'],
  category: ConsistencyCategory,
  description: string,
  source: string,
  conflict: string,
  recommendation: string,
): ConsistencyFinding {
  findingCounter += 1
  return {
    id: `CST-${String(findingCounter).padStart(3, '0')}`,
    severity,
    category,
    description,
    sourceArtifact: source,
    conflictArtifact: conflict,
    recommendation,
  }
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a set of findings into a consistency report.
 * Produces a summary counting findings by severity.
 */
export function analyzeConsistency(findings: ConsistencyFinding[]): ConsistencyReport {
  const summary: Record<string, number> = {}
  for (const finding of findings) {
    summary[finding.severity] = (summary[finding.severity] ?? 0) + 1
  }
  return { findings, summary }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Check whether a report contains critical findings.
 */
export function hasCriticalFindings(report: ConsistencyReport): boolean {
  return report.findings.some(f => f.severity === 'critical')
}

/**
 * Auto-promote CONSTITUTION_VIOLATION findings to critical severity.
 * Returns a new array with promoted findings (originals are not mutated).
 */
export function constitutionViolationsAreCritical(
  findings: ConsistencyFinding[],
): ConsistencyFinding[] {
  return findings.map(f =>
    f.category === 'CONSTITUTION_VIOLATION' && f.severity !== 'critical'
      ? { ...f, severity: 'critical' as const }
      : f,
  )
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Require that a consistency report has no critical findings.
 * Blocks if any critical-severity finding exists.
 */
export function requireConsistency(report: ConsistencyReport): Result<void> {
  if (hasCriticalFindings(report)) {
    const criticals = report.findings.filter(f => f.severity === 'critical')
    return err({
      code: ERROR_CODES.CONSISTENCY_VIOLATION_CRITICAL,
      i18nKey: 'error.consistency.critical_violation',
      params: {
        count: String(criticals.length),
        first: criticals[0]?.description ?? 'unknown',
      },
    })
  }
  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a consistency report as a human-readable string.
 */
export function formatConsistencyReport(report: ConsistencyReport): string {
  const lines: string[] = []

  lines.push('## Consistency Analysis Report')
  lines.push('')

  if (report.findings.length === 0) {
    lines.push('No inconsistencies found.')
    return lines.join('\n')
  }

  lines.push(`Found ${report.findings.length} finding(s):`)
  lines.push('')

  for (const finding of report.findings) {
    lines.push(`### ${finding.id} [${finding.severity.toUpperCase()}]`)
    lines.push(`- Category: ${finding.category}`)
    lines.push(`- ${finding.description}`)
    lines.push(`- Source: ${finding.sourceArtifact}`)
    lines.push(`- Conflicts with: ${finding.conflictArtifact}`)
    lines.push(`- Recommendation: ${finding.recommendation}`)
    lines.push('')
  }

  lines.push('### Summary')
  for (const [severity, count] of Object.entries(report.summary)) {
    lines.push(`- ${severity}: ${count}`)
  }

  return lines.join('\n')
}
