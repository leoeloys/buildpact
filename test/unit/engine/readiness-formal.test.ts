import { describe, it, expect } from 'vitest'
import {
  READINESS_STEPS,
  createReadinessAssessment,
  completeStep,
  computeVerdict,
  requireReady,
  formatReadinessReport,
} from '../../../src/engine/readiness-formal.js'

describe('READINESS_STEPS', () => {
  it('has 6 steps', () => {
    expect(READINESS_STEPS).toHaveLength(6)
  })

  it('starts with discovery and ends with final-assessment', () => {
    expect(READINESS_STEPS[0]).toBe('discovery')
    expect(READINESS_STEPS[5]).toBe('final-assessment')
  })
})

describe('createReadinessAssessment', () => {
  it('creates assessment with all steps pending', () => {
    const a = createReadinessAssessment()
    expect(a.steps).toHaveLength(6)
    expect(a.verdict).toBe('NOT_READY')
    expect(a.blockers).toEqual([])
    expect(a.steps.every(s => !s.passed)).toBe(true)
  })
})

describe('completeStep', () => {
  it('updates a single step to passed', () => {
    let a = createReadinessAssessment()
    a = completeStep(a, 'discovery', true, 'Completed discovery.')
    const step = a.steps.find(s => s.step === 'discovery')
    expect(step?.passed).toBe(true)
    expect(step?.notes).toBe('Completed discovery.')
  })

  it('recomputes verdict after completing all steps', () => {
    let a = createReadinessAssessment()
    for (const step of READINESS_STEPS) {
      a = completeStep(a, step, true, 'Done')
    }
    expect(a.verdict).toBe('READY')
    expect(a.blockers).toHaveLength(0)
  })

  it('returns NOT_READY when critical step fails', () => {
    let a = createReadinessAssessment()
    // Pass all except spec-analysis (critical)
    for (const step of READINESS_STEPS) {
      a = completeStep(a, step, step !== 'spec-analysis', step === 'spec-analysis' ? 'Failed' : 'Done')
    }
    expect(a.verdict).toBe('NOT_READY')
  })

  it('returns NEEDS_WORK when non-critical step fails', () => {
    let a = createReadinessAssessment()
    for (const step of READINESS_STEPS) {
      a = completeStep(a, step, step !== 'discovery', step === 'discovery' ? 'Incomplete' : 'Done')
    }
    expect(a.verdict).toBe('NEEDS_WORK')
  })
})

describe('computeVerdict', () => {
  it('returns NOT_READY for fresh assessment', () => {
    const a = createReadinessAssessment()
    expect(computeVerdict(a)).toBe('NOT_READY')
  })

  it('returns READY when all passed', () => {
    let a = createReadinessAssessment()
    for (const step of READINESS_STEPS) {
      a = completeStep(a, step, true, 'OK')
    }
    expect(computeVerdict(a)).toBe('READY')
  })
})

describe('requireReady', () => {
  it('returns ok for READY verdict', () => {
    let a = createReadinessAssessment()
    for (const step of READINESS_STEPS) {
      a = completeStep(a, step, true, 'OK')
    }
    expect(requireReady(a).ok).toBe(true)
  })

  it('returns error READINESS_NOT_READY for NOT_READY', () => {
    const a = createReadinessAssessment()
    const result = requireReady(a)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('READINESS_NOT_READY')
  })

  it('returns ok for NEEDS_WORK (not blocking)', () => {
    let a = createReadinessAssessment()
    for (const step of READINESS_STEPS) {
      a = completeStep(a, step, step !== 'discovery', 'note')
    }
    expect(a.verdict).toBe('NEEDS_WORK')
    expect(requireReady(a).ok).toBe(true)
  })
})

describe('formatReadinessReport', () => {
  it('includes verdict in report', () => {
    const a = createReadinessAssessment()
    const report = formatReadinessReport(a)
    expect(report).toContain('NOT_READY')
    expect(report).toContain('Readiness Assessment Report')
  })

  it('shows PASS/FAIL per step', () => {
    let a = createReadinessAssessment()
    a = completeStep(a, 'discovery', true, 'OK')
    const report = formatReadinessReport(a)
    expect(report).toContain('discovery — PASS')
    expect(report).toContain('spec-analysis — FAIL')
  })
})
