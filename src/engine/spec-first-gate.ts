/**
 * Spec-First Gate — blocks execution without an approved specification.
 * "NO implementation until design is approved"
 *
 * @module engine/spec-first-gate
 * @see Concept 3.7 (Superpowers brainstorming hard gate)
 */

import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Markers indicating spec approval */
export const APPROVAL_MARKERS = ['[APPROVED]', 'status: approved', '✅ Approved']

/** Markers indicating unresolved clarification */
export const CLARIFICATION_MARKER_PATTERN = /\[NEEDS CLARIFICATION[^\]]*\]/g

/** Maximum unresolved clarification markers allowed */
export const MAX_UNRESOLVED_MARKERS = 3

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Check if a spec file exists.
 */
export async function specExists(projectDir: string): Promise<boolean> {
  try {
    await access(join(projectDir, '.buildpact', 'spec.md'))
    return true
  } catch {
    return false
  }
}

/**
 * Check if spec content contains an approval marker.
 */
export function hasApprovalMarker(content: string): boolean {
  const lower = content.toLowerCase()
  return APPROVAL_MARKERS.some(m => lower.includes(m.toLowerCase()))
}

/**
 * Count unresolved clarification markers in spec content.
 */
export function countClarificationMarkers(content: string): number {
  const matches = content.match(CLARIFICATION_MARKER_PATTERN)
  return matches ? matches.length : 0
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Require an approved spec before execution can proceed.
 * BLOCKS if:
 * - No spec exists
 * - Spec exists but has no approval marker
 * - Spec has too many unresolved clarification markers
 *
 * Returns the spec content on success (for further processing).
 */
export async function requireApprovedSpec(
  projectDir: string,
  maxUnresolved: number = MAX_UNRESOLVED_MARKERS,
): Promise<Result<string>> {
  const specPath = join(projectDir, '.buildpact', 'spec.md')

  let content: string
  try {
    content = await readFile(specPath, 'utf-8')
  } catch {
    return err({
      code: ERROR_CODES.SPEC_NOT_APPROVED,
      i18nKey: 'error.spec.not_found',
      params: { path: specPath },
    })
  }

  if (!hasApprovalMarker(content)) {
    return err({
      code: ERROR_CODES.SPEC_NOT_APPROVED,
      i18nKey: 'error.spec.not_approved',
      params: { path: specPath },
    })
  }

  const markers = countClarificationMarkers(content)
  if (markers > maxUnresolved) {
    return err({
      code: ERROR_CODES.SPEC_NOT_APPROVED,
      i18nKey: 'error.spec.unresolved_markers',
      params: { count: String(markers), max: String(maxUnresolved) },
    })
  }

  return ok(content)
}

/**
 * Bypass spec-first gate with audit trail.
 * Returns a bypass record that should be logged.
 */
export function createSpecBypass(reason: string): {
  bypassed: true
  reason: string
  timestamp: string
} {
  return {
    bypassed: true,
    reason,
    timestamp: new Date().toISOString(),
  }
}
