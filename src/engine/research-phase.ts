/**
 * Research Phase — resolve technical unknowns before planning.
 * Blocking unknowns MUST be resolved before plan can proceed.
 *
 * @module engine/research-phase
 * @see Concept 6.4 (Spec-Kit research phase)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { TechnicalUnknown, ResearchFinding, ResearchPhaseState } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateUnknownId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `UNK-${ts}-${rand}`
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createResearchPhase(): ResearchPhaseState {
  return { unknowns: [], findings: [], status: 'pending' }
}

export function addUnknown(
  state: ResearchPhaseState,
  description: string,
  source: string,
  priority: TechnicalUnknown['priority'],
): ResearchPhaseState {
  const unknown: TechnicalUnknown = {
    id: generateUnknownId(),
    description,
    source,
    priority,
    status: 'unresolved',
  }
  return { ...state, unknowns: [...state.unknowns, unknown] }
}

export function addFinding(
  state: ResearchPhaseState,
  unknownId: string,
  finding: string,
  sources: string[],
  recommendation: string,
  confidence: ResearchFinding['confidence'],
): ResearchPhaseState {
  const entry: ResearchFinding = { unknownId, finding, sources, recommendation, confidence }

  // Auto-resolve the unknown
  const unknowns = state.unknowns.map(u =>
    u.id === unknownId ? { ...u, status: 'resolved' as const } : u,
  )

  return { ...state, unknowns, findings: [...state.findings, entry] }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getBlockingUnresolved(state: ResearchPhaseState): TechnicalUnknown[] {
  return state.unknowns.filter(u => u.priority === 'blocking' && u.status === 'unresolved')
}

export function getUnresolvedCount(state: ResearchPhaseState): number {
  return state.unknowns.filter(u => u.status === 'unresolved').length
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Check if research phase allows proceeding to plan.
 * BLOCKS if any blocking unknowns remain unresolved.
 */
export function canProceedToPlan(state: ResearchPhaseState): Result<void> {
  const blocking = getBlockingUnresolved(state)
  if (blocking.length > 0) {
    return err({
      code: ERROR_CODES.RESEARCH_BLOCKING_UNRESOLVED,
      i18nKey: 'error.research.blocking_unresolved',
      params: {
        count: String(blocking.length),
        ids: blocking.map(u => u.id).join(', '),
      },
    })
  }
  return ok(undefined)
}

/**
 * Mark research phase as complete.
 */
export function completeResearch(state: ResearchPhaseState): ResearchPhaseState {
  return { ...state, status: 'complete' }
}
