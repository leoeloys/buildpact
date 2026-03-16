import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EXPERIMENT_MS,
  DEFAULT_SESSION_MS,
  MAX_SESSION_MS,
  createExperimentSession,
  isExperimentBudgetExhausted,
  isSessionBudgetExhausted,
  startNextExperiment,
  completeExperiment,
  stopSession,
  addSessionSpend,
  isCostLimitReached,
  formatDurationMs,
  formatLoopStatus,
  buildLoopSummary,
  parseBudgetFromArgs,
} from '../../../src/optimize/experiment-loop.js'

const NOW = 1_700_000_000_000 // Fixed epoch for deterministic tests

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('DEFAULT_EXPERIMENT_MS is 5 minutes', () => {
    expect(DEFAULT_EXPERIMENT_MS).toBe(5 * 60 * 1000)
  })

  it('DEFAULT_SESSION_MS is 30 minutes', () => {
    expect(DEFAULT_SESSION_MS).toBe(30 * 60 * 1000)
  })

  it('MAX_SESSION_MS is 24 hours', () => {
    expect(MAX_SESSION_MS).toBe(24 * 60 * 60 * 1000)
  })
})

// ---------------------------------------------------------------------------
// createExperimentSession
// ---------------------------------------------------------------------------

describe('createExperimentSession', () => {
  it('creates session with given budget', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    const session = createExperimentSession(budget, NOW)
    expect(session.budget.experimentMs).toBe(5 * 60_000)
    expect(session.budget.sessionMs).toBe(30 * 60_000)
    expect(session.sessionStartMs).toBe(NOW)
    expect(session.completedExperiments).toHaveLength(0)
    expect(session.stopped).toBe(false)
  })

  it('clamps session budget to MAX_SESSION_MS', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: MAX_SESSION_MS + 1000 }
    const session = createExperimentSession(budget, NOW)
    expect(session.budget.sessionMs).toBe(MAX_SESSION_MS)
  })

  it('starts with experiment number 0', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    const session = createExperimentSession(budget, NOW)
    expect(session.currentExperimentNumber).toBe(0)
    expect(session.currentExperimentStartMs).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isExperimentBudgetExhausted
// ---------------------------------------------------------------------------

describe('isExperimentBudgetExhausted', () => {
  const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }

  it('returns false when no experiment is running', () => {
    const session = createExperimentSession(budget, NOW)
    expect(isExperimentBudgetExhausted(session, NOW + 10 * 60_000)).toBe(false)
  })

  it('returns false when experiment is within budget', () => {
    const session = startNextExperiment(createExperimentSession(budget, NOW), NOW)
    expect(isExperimentBudgetExhausted(session, NOW + 4 * 60_000)).toBe(false)
  })

  it('returns true when experiment time has elapsed exactly', () => {
    const session = startNextExperiment(createExperimentSession(budget, NOW), NOW)
    expect(isExperimentBudgetExhausted(session, NOW + 5 * 60_000)).toBe(true)
  })

  it('returns true when experiment time has been exceeded', () => {
    const session = startNextExperiment(createExperimentSession(budget, NOW), NOW)
    expect(isExperimentBudgetExhausted(session, NOW + 6 * 60_000)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isSessionBudgetExhausted
// ---------------------------------------------------------------------------

describe('isSessionBudgetExhausted', () => {
  const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }

  it('returns false when session is within budget', () => {
    const session = createExperimentSession(budget, NOW)
    expect(isSessionBudgetExhausted(session, NOW + 29 * 60_000)).toBe(false)
  })

  it('returns true when session budget is exactly reached', () => {
    const session = createExperimentSession(budget, NOW)
    expect(isSessionBudgetExhausted(session, NOW + 30 * 60_000)).toBe(true)
  })

  it('returns true when session budget is exceeded', () => {
    const session = createExperimentSession(budget, NOW)
    expect(isSessionBudgetExhausted(session, NOW + 60 * 60_000)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// startNextExperiment
// ---------------------------------------------------------------------------

describe('startNextExperiment', () => {
  it('increments experiment number', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    const session = createExperimentSession(budget, NOW)
    const next = startNextExperiment(session, NOW)
    expect(next.currentExperimentNumber).toBe(1)
    expect(next.currentExperimentStartMs).toBe(NOW)
  })

  it('increments again on second call', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = startNextExperiment(session, NOW)
    session = completeExperiment(session, { completedAtMs: NOW + 1000, outcome: 'no_change', description: 'test' })
    session = startNextExperiment(session, NOW + 2000)
    expect(session.currentExperimentNumber).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// completeExperiment
// ---------------------------------------------------------------------------

describe('completeExperiment', () => {
  it('appends result to completedExperiments', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = startNextExperiment(session, NOW)
    session = completeExperiment(session, {
      completedAtMs: NOW + 3000,
      outcome: 'improved',
      description: 'extracted helper',
    })
    expect(session.completedExperiments).toHaveLength(1)
    expect(session.completedExperiments[0]!.outcome).toBe('improved')
    expect(session.completedExperiments[0]!.experimentNumber).toBe(1)
  })

  it('clears currentExperimentStartMs after completion', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = startNextExperiment(session, NOW)
    session = completeExperiment(session, { completedAtMs: NOW + 1000, outcome: 'no_change', description: 'x' })
    expect(session.currentExperimentStartMs).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// stopSession
// ---------------------------------------------------------------------------

describe('stopSession', () => {
  it('sets stopped and stopReason', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = stopSession(session, 'session_time_exhausted')
    expect(session.stopped).toBe(true)
    expect(session.stopReason).toBe('session_time_exhausted')
  })

  it('preserves completed experiments on stop', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = startNextExperiment(session, NOW)
    session = completeExperiment(session, { completedAtMs: NOW + 1000, outcome: 'improved', description: 'x' })
    session = stopSession(session, 'user_stopped')
    expect(session.completedExperiments).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// addSessionSpend
// ---------------------------------------------------------------------------

describe('addSessionSpend', () => {
  it('accumulates spend correctly', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = addSessionSpend(session, 0.001)
    session = addSessionSpend(session, 0.002)
    expect(session.sessionSpendUsd).toBeCloseTo(0.003)
  })
})

// ---------------------------------------------------------------------------
// isCostLimitReached
// ---------------------------------------------------------------------------

describe('isCostLimitReached', () => {
  it('returns false when limit is 0 (unlimited)', () => {
    expect(isCostLimitReached(100, 0)).toBe(false)
  })

  it('returns false when spend is below limit', () => {
    expect(isCostLimitReached(0.5, 1.0)).toBe(false)
  })

  it('returns true when spend equals limit', () => {
    expect(isCostLimitReached(1.0, 1.0)).toBe(true)
  })

  it('returns true when spend exceeds limit', () => {
    expect(isCostLimitReached(1.5, 1.0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// formatDurationMs
// ---------------------------------------------------------------------------

describe('formatDurationMs', () => {
  it('formats seconds only when under 1 minute', () => {
    expect(formatDurationMs(45_000)).toBe('45s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDurationMs(4 * 60_000 + 32_000)).toBe('4m 32s')
  })

  it('formats exactly 0s', () => {
    expect(formatDurationMs(0)).toBe('0s')
  })

  it('formats exactly 30 minutes', () => {
    expect(formatDurationMs(30 * 60_000)).toBe('30m 0s')
  })
})

// ---------------------------------------------------------------------------
// formatLoopStatus
// ---------------------------------------------------------------------------

describe('formatLoopStatus', () => {
  it('shows 0 experiments at start', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    const session = createExperimentSession(budget, NOW)
    const status = formatLoopStatus(session, NOW + 60_000)
    expect(status).toContain('Experiments: 0 run')
    expect(status).toContain('Elapsed: 1m 0s')
  })

  it('shows improved count', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = startNextExperiment(session, NOW)
    session = completeExperiment(session, { completedAtMs: NOW + 1000, outcome: 'improved', description: 'x' })
    const status = formatLoopStatus(session, NOW + 2000)
    expect(status).toContain('1 run (1 improved)')
  })

  it('shows current experiment progress when running', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = startNextExperiment(session, NOW)
    const status = formatLoopStatus(session, NOW + 2 * 60_000)
    expect(status).toContain('Current experiment #1')
  })
})

// ---------------------------------------------------------------------------
// buildLoopSummary
// ---------------------------------------------------------------------------

describe('buildLoopSummary', () => {
  it('shows session_time_exhausted reason', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = stopSession(session, 'session_time_exhausted')
    const summary = buildLoopSummary(session, NOW + 30 * 60_000)
    expect(summary).toContain('session time budget exhausted')
    expect(summary).toContain('0 experiments run')
  })

  it('shows cost_limit_reached reason', () => {
    const budget = { experimentMs: 5 * 60_000, sessionMs: 30 * 60_000 }
    let session = createExperimentSession(budget, NOW)
    session = stopSession(session, 'cost_limit_reached')
    const summary = buildLoopSummary(session, NOW + 5 * 60_000)
    expect(summary).toContain('cost limit reached')
  })
})

// ---------------------------------------------------------------------------
// parseBudgetFromArgs
// ---------------------------------------------------------------------------

describe('parseBudgetFromArgs', () => {
  it('returns defaults when no args provided', () => {
    const budget = parseBudgetFromArgs([])
    expect(budget.experimentMs).toBe(5 * 60_000)
    expect(budget.sessionMs).toBe(30 * 60_000)
  })

  it('parses --experiment-budget=10', () => {
    const budget = parseBudgetFromArgs(['--experiment-budget=10'])
    expect(budget.experimentMs).toBe(10 * 60_000)
  })

  it('parses --session-budget=60', () => {
    const budget = parseBudgetFromArgs(['--session-budget=60'])
    expect(budget.sessionMs).toBe(60 * 60_000)
  })

  it('caps session budget at 1440 minutes (24 hours)', () => {
    const budget = parseBudgetFromArgs(['--session-budget=9999'])
    expect(budget.sessionMs).toBe(1440 * 60_000)
  })

  it('ignores zero or negative experiment-budget', () => {
    const budget = parseBudgetFromArgs(['--experiment-budget=0'])
    expect(budget.experimentMs).toBe(5 * 60_000) // default kept
  })

  it('ignores unrelated args', () => {
    const budget = parseBudgetFromArgs(['--loop', 'src/foo.ts', '--full'])
    expect(budget.experimentMs).toBe(5 * 60_000)
    expect(budget.sessionMs).toBe(30 * 60_000)
  })
})
