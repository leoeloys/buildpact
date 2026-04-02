/**
 * Debug Protocol — systematic 4-phase debugging methodology.
 * "NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"
 *
 * Enforces: INVESTIGATION → PATTERN_ANALYSIS → HYPOTHESIS_TEST → IMPLEMENTATION
 * Cannot enter IMPLEMENTATION without rootCauseIdentified.
 * After 3 failed fixes, forces architecture-level questioning.
 *
 * @module engine/debug-protocol
 * @see Concept 3.2 (Superpowers systematic-debugging)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { DebugPhase, DebugSession, Hypothesis } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default maximum fix attempts before forcing architecture review */
export const DEFAULT_MAX_FIX_ATTEMPTS = 3

/** Valid phase transitions — each phase can only advance to the next */
const PHASE_ORDER: DebugPhase[] = ['INVESTIGATION', 'PATTERN_ANALYSIS', 'HYPOTHESIS_TEST', 'IMPLEMENTATION']

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new debug session starting at INVESTIGATION phase.
 */
export function createDebugSession(sessionId: string): DebugSession {
  return {
    sessionId,
    phase: 'INVESTIGATION',
    hypotheses: [],
    evidence: [],
    fixAttempts: 0,
    rootCauseIdentified: false,
    createdAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Evidence & Hypotheses
// ---------------------------------------------------------------------------

/**
 * Add evidence to the debug session (error messages, logs, reproduction steps).
 */
export function addEvidence(session: DebugSession, evidenceItem: string): DebugSession {
  return {
    ...session,
    evidence: [...session.evidence, evidenceItem],
  }
}

/**
 * Add a new hypothesis to the session. Returns updated session.
 */
export function addHypothesis(session: DebugSession, description: string): DebugSession {
  const hypothesis: Hypothesis = {
    description,
    evidenceFor: [],
    evidenceAgainst: [],
    tested: false,
    result: 'pending',
  }
  return {
    ...session,
    hypotheses: [...session.hypotheses, hypothesis],
  }
}

/**
 * Record the result of testing a hypothesis.
 * If confirmed, sets rootCauseIdentified = true.
 */
export function testHypothesis(
  session: DebugSession,
  hypothesisIndex: number,
  result: 'confirmed' | 'rejected',
): DebugSession {
  if (hypothesisIndex < 0 || hypothesisIndex >= session.hypotheses.length) {
    return session
  }

  const updated = session.hypotheses.map((h, i) =>
    i === hypothesisIndex ? { ...h, tested: true, result } : h,
  )

  return {
    ...session,
    hypotheses: updated,
    rootCauseIdentified: session.rootCauseIdentified || result === 'confirmed',
  }
}

/**
 * Record a fix attempt. Increments the counter.
 */
export function recordFixAttempt(session: DebugSession): DebugSession {
  return {
    ...session,
    fixAttempts: session.fixAttempts + 1,
  }
}

// ---------------------------------------------------------------------------
// Phase progression
// ---------------------------------------------------------------------------

/**
 * Advance to the next debug phase.
 * BLOCKS:
 * - Skipping phases (must go in order)
 * - Entering IMPLEMENTATION without rootCauseIdentified
 */
export function advancePhase(session: DebugSession): Result<DebugSession> {
  const currentIndex = PHASE_ORDER.indexOf(session.phase)
  const nextIndex = currentIndex + 1

  if (nextIndex >= PHASE_ORDER.length) {
    return ok(session) // Already at IMPLEMENTATION, no-op
  }

  const nextPhase = PHASE_ORDER[nextIndex]!

  // Cannot enter IMPLEMENTATION without root cause
  if (nextPhase === 'IMPLEMENTATION' && !session.rootCauseIdentified) {
    return err({
      code: ERROR_CODES.DEBUG_ROOT_CAUSE_MISSING,
      i18nKey: 'error.debug.root_cause_missing',
      params: { currentPhase: session.phase },
    })
  }

  return ok({ ...session, phase: nextPhase })
}

// ---------------------------------------------------------------------------
// Fix limit check
// ---------------------------------------------------------------------------

/**
 * Check if fix attempts have exceeded the limit.
 * After maxAttempts, agent must question architecture, not hypotheses.
 */
export function checkFixLimit(
  session: DebugSession,
  maxAttempts: number = DEFAULT_MAX_FIX_ATTEMPTS,
): Result<void> {
  if (session.fixAttempts >= maxAttempts) {
    return err({
      code: ERROR_CODES.DEBUG_FIX_LIMIT_REACHED,
      i18nKey: 'error.debug.fix_limit_reached',
      params: {
        attempts: String(session.fixAttempts),
        max: String(maxAttempts),
      },
    })
  }
  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a debug session as a compact briefing for context injection.
 */
export function formatDebugBriefing(session: DebugSession): string {
  const lines: string[] = [
    `## Debug Session [${session.sessionId}]`,
    '',
    `**Phase:** ${session.phase}`,
    `**Root Cause Identified:** ${session.rootCauseIdentified ? 'YES' : 'NO'}`,
    `**Fix Attempts:** ${session.fixAttempts}`,
    '',
  ]

  if (session.evidence.length > 0) {
    lines.push('**Evidence:**')
    for (const e of session.evidence) {
      lines.push(`- ${e}`)
    }
    lines.push('')
  }

  if (session.hypotheses.length > 0) {
    lines.push('**Hypotheses:**')
    for (const h of session.hypotheses) {
      const status = h.tested ? `[${h.result}]` : '[pending]'
      lines.push(`- ${status} ${h.description}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
