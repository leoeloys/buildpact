import { describe, it, expect } from 'vitest'
import {
  createDebugSession,
  addEvidence,
  addHypothesis,
  testHypothesis,
  recordFixAttempt,
  advancePhase,
  checkFixLimit,
  formatDebugBriefing,
} from '../../../src/engine/debug-protocol.js'

describe('createDebugSession', () => {
  it('starts at INVESTIGATION phase', () => {
    const s = createDebugSession('DBG-001')
    expect(s.sessionId).toBe('DBG-001')
    expect(s.phase).toBe('INVESTIGATION')
    expect(s.hypotheses).toEqual([])
    expect(s.evidence).toEqual([])
    expect(s.fixAttempts).toBe(0)
    expect(s.rootCauseIdentified).toBe(false)
  })
})

describe('addEvidence', () => {
  it('appends evidence to session', () => {
    let s = createDebugSession('DBG-001')
    s = addEvidence(s, 'Error: ENOENT')
    s = addEvidence(s, 'Stack trace points to line 42')
    expect(s.evidence).toHaveLength(2)
    expect(s.evidence[0]).toBe('Error: ENOENT')
  })
})

describe('addHypothesis / testHypothesis', () => {
  it('adds hypothesis with pending status', () => {
    let s = createDebugSession('DBG-001')
    s = addHypothesis(s, 'File path is wrong')
    expect(s.hypotheses).toHaveLength(1)
    expect(s.hypotheses[0]!.result).toBe('pending')
    expect(s.hypotheses[0]!.tested).toBe(false)
  })

  it('marks hypothesis as confirmed and sets rootCauseIdentified', () => {
    let s = createDebugSession('DBG-001')
    s = addHypothesis(s, 'Missing import')
    s = testHypothesis(s, 0, 'confirmed')
    expect(s.hypotheses[0]!.tested).toBe(true)
    expect(s.hypotheses[0]!.result).toBe('confirmed')
    expect(s.rootCauseIdentified).toBe(true)
  })

  it('marks hypothesis as rejected without setting rootCause', () => {
    let s = createDebugSession('DBG-001')
    s = addHypothesis(s, 'Wrong config')
    s = testHypothesis(s, 0, 'rejected')
    expect(s.hypotheses[0]!.result).toBe('rejected')
    expect(s.rootCauseIdentified).toBe(false)
  })

  it('ignores invalid hypothesis index', () => {
    let s = createDebugSession('DBG-001')
    s = testHypothesis(s, 99, 'confirmed')
    expect(s.rootCauseIdentified).toBe(false)
  })
})

describe('advancePhase', () => {
  it('progresses INVESTIGATION → PATTERN_ANALYSIS', () => {
    const s = createDebugSession('DBG-001')
    const result = advancePhase(s)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.phase).toBe('PATTERN_ANALYSIS')
  })

  it('progresses PATTERN_ANALYSIS → HYPOTHESIS_TEST', () => {
    let s = createDebugSession('DBG-001')
    s = advancePhase(s).ok ? (advancePhase(s) as any).value : s
    const result = advancePhase(s)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.phase).toBe('HYPOTHESIS_TEST')
  })

  it('BLOCKS IMPLEMENTATION without rootCauseIdentified', () => {
    let s = createDebugSession('DBG-001')
    // Advance to HYPOTHESIS_TEST
    s = (advancePhase(s) as any).value // → PATTERN_ANALYSIS
    s = (advancePhase(s) as any).value // → HYPOTHESIS_TEST
    const result = advancePhase(s) // → IMPLEMENTATION?
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DEBUG_ROOT_CAUSE_MISSING')
  })

  it('allows IMPLEMENTATION with rootCauseIdentified', () => {
    let s = createDebugSession('DBG-001')
    s = (advancePhase(s) as any).value
    s = (advancePhase(s) as any).value
    s = addHypothesis(s, 'Root cause found')
    s = testHypothesis(s, 0, 'confirmed')
    const result = advancePhase(s)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.phase).toBe('IMPLEMENTATION')
  })

  it('no-ops at IMPLEMENTATION', () => {
    let s = createDebugSession('DBG-001')
    s = (advancePhase(s) as any).value
    s = (advancePhase(s) as any).value
    s = { ...s, rootCauseIdentified: true }
    s = (advancePhase(s) as any).value // → IMPLEMENTATION
    const result = advancePhase(s) // should no-op
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.phase).toBe('IMPLEMENTATION')
  })
})

describe('checkFixLimit', () => {
  it('passes when under limit', () => {
    const s = createDebugSession('DBG-001')
    expect(checkFixLimit(s).ok).toBe(true)
  })

  it('blocks at default limit (3)', () => {
    let s = createDebugSession('DBG-001')
    s = recordFixAttempt(recordFixAttempt(recordFixAttempt(s)))
    const result = checkFixLimit(s)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DEBUG_FIX_LIMIT_REACHED')
  })

  it('respects custom limit', () => {
    let s = createDebugSession('DBG-001')
    s = recordFixAttempt(s)
    expect(checkFixLimit(s, 1).ok).toBe(false)
    expect(checkFixLimit(s, 5).ok).toBe(true)
  })
})

describe('formatDebugBriefing', () => {
  it('includes session info', () => {
    let s = createDebugSession('DBG-001')
    s = addEvidence(s, 'Error X')
    s = addHypothesis(s, 'Bad import')
    const briefing = formatDebugBriefing(s)
    expect(briefing).toContain('DBG-001')
    expect(briefing).toContain('INVESTIGATION')
    expect(briefing).toContain('Error X')
    expect(briefing).toContain('Bad import')
  })
})
