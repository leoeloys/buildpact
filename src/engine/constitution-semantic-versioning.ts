/**
 * Constitution Semantic Versioning — MAJOR/MINOR/PATCH classification
 * with impact propagation to affected specs and plans.
 *
 * @module engine/constitution-semantic-versioning
 * @see Concept 6.5 (Spec-Kit constitution versioning)
 */

import type { ConstitutionVersion, ConstitutionVersionChange, SyncImpactReport } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export function createVersion(major = 1, minor = 0, patch = 0): ConstitutionVersion {
  return { major, minor, patch }
}

export function formatVersion(v: ConstitutionVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`
}

export function parseVersion(s: string): ConstitutionVersion | null {
  const match = s.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return null
  return { major: parseInt(match[1]!, 10), minor: parseInt(match[2]!, 10), patch: parseInt(match[3]!, 10) }
}

// ---------------------------------------------------------------------------
// Change classification
// ---------------------------------------------------------------------------

/**
 * Classify a constitution change as MAJOR/MINOR/PATCH.
 *
 * MAJOR (breaking): principle removed or fundamentally changed
 * MINOR (additive): new principle added or expanded
 * PATCH (cosmetic): clarification, typo, formatting
 */
export function classifyChange(change: ConstitutionVersionChange): 'major' | 'minor' | 'patch' {
  if (change.impact === 'breaking') return 'major'
  if (change.impact === 'additive') return 'minor'
  return 'patch'
}

/**
 * Compute the next version given a set of changes.
 * Highest-impact change determines the version bump.
 */
export function computeNextVersion(
  current: ConstitutionVersion,
  changes: ConstitutionVersionChange[],
): ConstitutionVersion {
  const hasBreaking = changes.some(c => c.impact === 'breaking')
  const hasAdditive = changes.some(c => c.impact === 'additive')

  if (hasBreaking) return { major: current.major + 1, minor: 0, patch: 0 }
  if (hasAdditive) return { major: current.major, minor: current.minor + 1, patch: 0 }
  return { major: current.major, minor: current.minor, patch: current.patch + 1 }
}

// ---------------------------------------------------------------------------
// Impact analysis
// ---------------------------------------------------------------------------

/**
 * Generate a sync impact report for a set of constitution changes.
 * Identifies affected specs and plans.
 */
export function generateImpactReport(
  currentVersion: ConstitutionVersion,
  changes: ConstitutionVersionChange[],
): SyncImpactReport {
  const nextVersion = computeNextVersion(currentVersion, changes)

  const affectedSpecs = new Set<string>()
  const affectedPlans = new Set<string>()

  for (const change of changes) {
    for (const artifact of change.affectedArtifacts) {
      if (artifact.includes('spec')) affectedSpecs.add(artifact)
      else if (artifact.includes('plan')) affectedPlans.add(artifact)
      else affectedSpecs.add(artifact) // default to specs
    }
  }

  const hasBreaking = changes.some(c => c.impact === 'breaking')

  return {
    version: nextVersion,
    changes,
    affectedSpecs: Array.from(affectedSpecs),
    affectedPlans: Array.from(affectedPlans),
    migrationRequired: hasBreaking,
  }
}

/**
 * Create a version change record.
 */
export function createVersionChange(
  type: ConstitutionVersionChange['type'],
  principle: string,
  impact: ConstitutionVersionChange['impact'],
  affectedArtifacts: string[] = [],
): ConstitutionVersionChange {
  return { type, principle, impact, affectedArtifacts }
}

/**
 * Format impact report for display.
 */
export function formatImpactReport(report: SyncImpactReport): string {
  const lines = [
    `## Constitution Version ${formatVersion(report.version)}`,
    '',
    `**Changes:** ${report.changes.length}`,
    `**Migration required:** ${report.migrationRequired ? 'YES' : 'no'}`,
    '',
  ]

  for (const c of report.changes) {
    lines.push(`- [${c.impact.toUpperCase()}] ${c.type}: ${c.principle}`)
  }

  if (report.affectedSpecs.length > 0) {
    lines.push('', `**Affected specs:** ${report.affectedSpecs.join(', ')}`)
  }
  if (report.affectedPlans.length > 0) {
    lines.push(`**Affected plans:** ${report.affectedPlans.join(', ')}`)
  }

  return lines.join('\n')
}
