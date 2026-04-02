/**
 * Clarify Engine — structured ambiguity resolution before planning.
 * Specs with unresolved [NEEDS CLARIFICATION] markers cannot proceed to plan.
 *
 * 10 ambiguity categories ensure markers are specific, not generic:
 * SCOPE, DATA_MODEL, USER_FLOW, ERROR_HANDLING, PERFORMANCE,
 * SECURITY, INTEGRATION, PERSISTENCE, UI_UX, BUSINESS_RULES
 *
 * @module engine/clarify-engine
 * @see Concept 6.1 (Spec-Kit clarify command)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { AmbiguityCategory, ClarificationMarker, ClarificationSession } from '../contracts/clarify.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default max unresolved markers allowed to proceed to plan */
export const DEFAULT_MAX_UNRESOLVED = 3

/** All valid ambiguity categories */
export const AMBIGUITY_CATEGORIES: AmbiguityCategory[] = [
  'SCOPE', 'DATA_MODEL', 'USER_FLOW', 'ERROR_HANDLING', 'PERFORMANCE',
  'SECURITY', 'INTEGRATION', 'PERSISTENCE', 'UI_UX', 'BUSINESS_RULES',
]

// ---------------------------------------------------------------------------
// Counter
// ---------------------------------------------------------------------------

let markerCounter = 0

/** Reset counter (for testing) */
export function resetMarkerCounter(): void {
  markerCounter = 0
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Create a new clarification session for a spec.
 */
export function createClarificationSession(
  specId: string,
  maxUnresolved: number = DEFAULT_MAX_UNRESOLVED,
): ClarificationSession {
  return {
    specId,
    markers: [],
    maxUnresolvedAfterClarify: maxUnresolved,
    roundsCompleted: 0,
  }
}

/**
 * Add a clarification marker to the session.
 * Auto-generates CLR-XXX id. Category must be from the taxonomy.
 */
export function addMarker(
  session: ClarificationSession,
  category: AmbiguityCategory,
  location: string,
  question: string,
): Result<ClarificationSession> {
  if (!AMBIGUITY_CATEGORIES.includes(category)) {
    return err({
      code: ERROR_CODES.CLARIFICATION_MARKER_NO_CATEGORY,
      i18nKey: 'error.clarify.invalid_category',
      params: { category },
    })
  }

  markerCounter++
  const marker: ClarificationMarker = {
    id: `CLR-${String(markerCounter).padStart(3, '0')}`,
    category,
    location,
    question,
    status: 'open',
    resolution: null,
  }

  return ok({
    ...session,
    markers: [...session.markers, marker],
  })
}

/**
 * Resolve a clarification marker.
 */
export function resolveMarker(
  session: ClarificationSession,
  markerId: string,
  resolution: string,
): Result<ClarificationSession> {
  const idx = session.markers.findIndex(m => m.id === markerId)
  if (idx === -1) {
    return err({
      code: ERROR_CODES.CLARIFICATION_MARKER_NO_CATEGORY,
      i18nKey: 'error.clarify.marker_not_found',
      params: { markerId },
    })
  }

  const updated = session.markers.map((m, i) =>
    i === idx ? { ...m, status: 'resolved' as const, resolution } : m,
  )

  return ok({ ...session, markers: updated })
}

/**
 * Complete a clarification round.
 */
export function completeRound(session: ClarificationSession): ClarificationSession {
  return { ...session, roundsCompleted: session.roundsCompleted + 1 }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Count unresolved markers in the session.
 */
export function getUnresolvedCount(session: ClarificationSession): number {
  return session.markers.filter(m => m.status === 'open').length
}

/**
 * Get all unresolved markers.
 */
export function getUnresolvedMarkers(session: ClarificationSession): ClarificationMarker[] {
  return session.markers.filter(m => m.status === 'open')
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Check if the spec can proceed to planning.
 * BLOCKS if unresolved markers exceed the configured threshold.
 */
export function canProceedToPlan(session: ClarificationSession): Result<void> {
  const unresolved = getUnresolvedCount(session)
  if (unresolved > session.maxUnresolvedAfterClarify) {
    return err({
      code: ERROR_CODES.CLARIFICATION_MARKERS_UNRESOLVED,
      i18nKey: 'error.clarify.markers_unresolved',
      params: {
        unresolved: String(unresolved),
        max: String(session.maxUnresolvedAfterClarify),
        specId: session.specId,
      },
    })
  }
  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format markers as [NEEDS CLARIFICATION] tags for insertion into specs.
 */
export function formatMarkersForSpec(markers: ClarificationMarker[]): string {
  return markers
    .filter(m => m.status === 'open')
    .map(m => `[NEEDS CLARIFICATION: ${m.id}] (${m.category}) ${m.question}`)
    .join('\n')
}

/**
 * Format a full clarification report.
 */
export function formatClarificationReport(session: ClarificationSession): string {
  const open = session.markers.filter(m => m.status === 'open')
  const resolved = session.markers.filter(m => m.status === 'resolved')

  const lines: string[] = [
    `## Clarification Report — ${session.specId}`,
    '',
    `**Rounds completed:** ${session.roundsCompleted}`,
    `**Total markers:** ${session.markers.length}`,
    `**Open:** ${open.length} | **Resolved:** ${resolved.length}`,
    '',
  ]

  if (open.length > 0) {
    lines.push('### Unresolved')
    for (const m of open) {
      lines.push(`- **[${m.id}]** (${m.category}) ${m.location}: ${m.question}`)
    }
    lines.push('')
  }

  if (resolved.length > 0) {
    lines.push('### Resolved')
    for (const m of resolved) {
      lines.push(`- **[${m.id}]** (${m.category}) ${m.location}: ${m.question}`)
      lines.push(`  → ${m.resolution}`)
    }
  }

  return lines.join('\n')
}
