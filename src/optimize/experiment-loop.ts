/**
 * Experiment Loop — fixed-budget time management for AutoResearch sessions.
 * Pure functions with injected nowMs for deterministic testing.
 * @module optimize/experiment-loop
 * @see FR-AutoResearch Epic 12.2 — Fixed-Budget Experiment Loop
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default time budget per individual experiment: 5 minutes in ms */
export const DEFAULT_EXPERIMENT_MS = 5 * 60 * 1000

/** Default total session budget: 30 minutes in ms */
export const DEFAULT_SESSION_MS = 30 * 60 * 1000

/** Maximum total session budget: 24 hours in ms */
export const MAX_SESSION_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Time budget for the experiment loop */
export interface ExperimentBudget {
  /** Max duration per individual experiment in milliseconds */
  experimentMs: number
  /** Max duration for the entire session in milliseconds */
  sessionMs: number
}

/** Outcome of a single completed experiment */
export type ExperimentOutcome = 'improved' | 'no_change' | 'worse' | 'error' | 'timeout'

/** Record of one completed experiment */
export interface ExperimentResult {
  experimentNumber: number
  startedAtMs: number
  completedAtMs: number
  outcome: ExperimentOutcome
  description: string
}

/** Reason the loop stopped */
export type LoopStopReason =
  | 'experiment_time_exhausted'
  | 'session_time_exhausted'
  | 'cost_limit_reached'
  | 'user_stopped'

/** Immutable snapshot of the loop's current state */
export interface ExperimentSession {
  readonly budget: ExperimentBudget
  readonly sessionStartMs: number
  readonly currentExperimentNumber: number
  readonly currentExperimentStartMs: number | null
  readonly completedExperiments: readonly ExperimentResult[]
  readonly stopped: boolean
  readonly stopReason: LoopStopReason | null
  readonly sessionSpendUsd: number
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new experiment session with the given budget.
 * Clamps sessionMs to MAX_SESSION_MS.
 * @param budget - Time budget configuration
 * @param nowMs - Current timestamp in ms (injected for testability)
 */
export function createExperimentSession(
  budget: ExperimentBudget,
  nowMs: number,
): ExperimentSession {
  const clampedSessionMs = Math.min(budget.sessionMs, MAX_SESSION_MS)
  return {
    budget: { ...budget, sessionMs: clampedSessionMs },
    sessionStartMs: nowMs,
    currentExperimentNumber: 0,
    currentExperimentStartMs: null,
    completedExperiments: [],
    stopped: false,
    stopReason: null,
    sessionSpendUsd: 0,
  }
}

// ---------------------------------------------------------------------------
// Time budget checks
// ---------------------------------------------------------------------------

/**
 * Returns true if the current experiment has exceeded its time budget.
 * Returns false if no experiment is currently running.
 */
export function isExperimentBudgetExhausted(session: ExperimentSession, nowMs: number): boolean {
  if (session.currentExperimentStartMs === null) return false
  return nowMs - session.currentExperimentStartMs >= session.budget.experimentMs
}

/**
 * Returns true if the total session time budget has been exhausted.
 */
export function isSessionBudgetExhausted(session: ExperimentSession, nowMs: number): boolean {
  return nowMs - session.sessionStartMs >= session.budget.sessionMs
}

// ---------------------------------------------------------------------------
// Session mutations (immutable — return new session)
// ---------------------------------------------------------------------------

/**
 * Advance to the next experiment, recording its start time.
 * Returns updated session with incremented experiment number.
 */
export function startNextExperiment(session: ExperimentSession, nowMs: number): ExperimentSession {
  return {
    ...session,
    currentExperimentNumber: session.currentExperimentNumber + 1,
    currentExperimentStartMs: nowMs,
  }
}

/**
 * Complete the current experiment with the given result.
 * Appends result to completedExperiments and clears current experiment state.
 */
export function completeExperiment(
  session: ExperimentSession,
  result: Omit<ExperimentResult, 'experimentNumber' | 'startedAtMs'>,
): ExperimentSession {
  const experimentResult: ExperimentResult = {
    experimentNumber: session.currentExperimentNumber,
    startedAtMs: session.currentExperimentStartMs ?? result.completedAtMs,
    ...result,
  }
  return {
    ...session,
    currentExperimentStartMs: null,
    completedExperiments: [...session.completedExperiments, experimentResult],
  }
}

/**
 * Stop the session cleanly with the given reason.
 * Preserves all completed experiment results.
 */
export function stopSession(session: ExperimentSession, reason: LoopStopReason): ExperimentSession {
  return {
    ...session,
    stopped: true,
    stopReason: reason,
    currentExperimentStartMs: null,
  }
}

/**
 * Record a cost spend update against the session.
 */
export function addSessionSpend(session: ExperimentSession, spendUsd: number): ExperimentSession {
  return { ...session, sessionSpendUsd: session.sessionSpendUsd + spendUsd }
}

// ---------------------------------------------------------------------------
// Cost limit check
// ---------------------------------------------------------------------------

/**
 * Returns true if the session spend has reached or exceeded the cost limit.
 * A limitUsd of 0 means unlimited — always returns false.
 */
export function isCostLimitReached(sessionSpendUsd: number, limitUsd: number): boolean {
  if (limitUsd <= 0) return false
  return sessionSpendUsd >= limitUsd
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format milliseconds as a human-readable duration string (e.g. "4m 32s") */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

/**
 * Format a human-readable status of the current loop state.
 * Shows: experiments run, elapsed time, remaining session time, current spend.
 */
export function formatLoopStatus(session: ExperimentSession, nowMs: number): string {
  const elapsed = nowMs - session.sessionStartMs
  const remaining = Math.max(0, session.budget.sessionMs - elapsed)
  const completed = session.completedExperiments.length
  const improved = session.completedExperiments.filter((e) => e.outcome === 'improved').length

  const lines = [
    `Experiments: ${completed} run (${improved} improved)`,
    `Elapsed: ${formatDurationMs(elapsed)} / ${formatDurationMs(session.budget.sessionMs)}`,
    `Remaining: ${formatDurationMs(remaining)}`,
    `Spend: $${session.sessionSpendUsd.toFixed(4)}`,
  ]

  if (session.currentExperimentNumber > 0 && session.currentExperimentStartMs !== null) {
    const expElapsed = nowMs - session.currentExperimentStartMs
    const expRemaining = Math.max(0, session.budget.experimentMs - expElapsed)
    lines.push(
      `Current experiment #${session.currentExperimentNumber}: ${formatDurationMs(expElapsed)} elapsed, ${formatDurationMs(expRemaining)} remaining`,
    )
  }

  return lines.join('\n')
}

/**
 * Build the stop reason message for the loop summary.
 */
export function buildLoopSummary(session: ExperimentSession, nowMs: number): string {
  const completed = session.completedExperiments.length
  const improved = session.completedExperiments.filter((e) => e.outcome === 'improved').length
  const elapsed = formatDurationMs(nowMs - session.sessionStartMs)

  const reasonMsg: Record<LoopStopReason, string> = {
    experiment_time_exhausted: 'experiment time budget exhausted',
    session_time_exhausted: 'session time budget exhausted',
    cost_limit_reached: 'cost limit reached',
    user_stopped: 'stopped by user',
  }

  const reason = session.stopReason ? reasonMsg[session.stopReason] : 'complete'

  return [
    `Loop stopped (${reason}) — ${completed} experiments run, ${improved} improved in ${elapsed}`,
    `Spend: $${session.sessionSpendUsd.toFixed(4)}`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Budget configuration reader
// ---------------------------------------------------------------------------

/**
 * Parse experiment and session budget from CLI args.
 * --experiment-budget=N sets experiment budget to N minutes (default 5)
 * --session-budget=N sets session budget to N minutes (default 30, max 1440)
 */
export function parseBudgetFromArgs(args: string[]): ExperimentBudget {
  let experimentMinutes = 5
  let sessionMinutes = 30

  for (const arg of args) {
    const expMatch = /^--experiment-budget=(\d+)$/.exec(arg)
    if (expMatch) {
      const val = parseInt(expMatch[1]!, 10)
      if (val > 0) experimentMinutes = val
    }
    const sessMatch = /^--session-budget=(\d+)$/.exec(arg)
    if (sessMatch) {
      const val = parseInt(sessMatch[1]!, 10)
      if (val > 0) sessionMinutes = Math.min(val, 1440) // cap at 24 hours
    }
  }

  return {
    experimentMs: experimentMinutes * 60 * 1000,
    sessionMs: sessionMinutes * 60 * 1000,
  }
}
