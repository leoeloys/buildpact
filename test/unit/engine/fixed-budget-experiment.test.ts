import { describe, it, expect } from 'vitest'
import {
  createExperimentBudget,
  checkBudget,
  requireBudget,
} from '../../../src/engine/fixed-budget-experiment.js'

describe('createExperimentBudget', () => {
  it('creates a time budget', () => {
    const b = createExperimentBudget('time', 300, true)
    expect(b.type).toBe('time')
    expect(b.value).toBe(300)
    expect(b.strict).toBe(true)
  })

  it('creates a cost budget', () => {
    const b = createExperimentBudget('cost', 5.0, false)
    expect(b.type).toBe('cost')
    expect(b.strict).toBe(false)
  })

  it('creates a tokens budget', () => {
    const b = createExperimentBudget('tokens', 100000, true)
    expect(b.type).toBe('tokens')
    expect(b.value).toBe(100000)
  })
})

describe('checkBudget', () => {
  it('reports not exceeded when under budget', () => {
    const b = createExperimentBudget('time', 100, true)
    const r = checkBudget(b, 50)
    expect(r.exceeded).toBe(false)
    expect(r.remaining).toBe(50)
    expect(r.shouldKill).toBe(false)
  })

  it('reports exceeded when over budget', () => {
    const b = createExperimentBudget('cost', 10, true)
    const r = checkBudget(b, 15)
    expect(r.exceeded).toBe(true)
    expect(r.remaining).toBe(-5)
    expect(r.shouldKill).toBe(true)
  })

  it('does not kill on soft budget exceeded', () => {
    const b = createExperimentBudget('tokens', 1000, false)
    const r = checkBudget(b, 2000)
    expect(r.exceeded).toBe(true)
    expect(r.shouldKill).toBe(false)
  })

  it('returns 0 remaining at exact budget', () => {
    const b = createExperimentBudget('time', 60, true)
    const r = checkBudget(b, 60)
    expect(r.exceeded).toBe(false)
    expect(r.remaining).toBe(0)
  })
})

describe('requireBudget', () => {
  it('returns ok when budget not exceeded', () => {
    const b = createExperimentBudget('time', 100, true)
    const result = requireBudget(b, 50)
    expect(result.ok).toBe(true)
  })

  it('returns error with BUDGET_EXCEEDED when strict + exceeded', () => {
    const b = createExperimentBudget('cost', 5, true)
    const result = requireBudget(b, 10)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('BUDGET_EXCEEDED')
    }
  })

  it('returns ok when soft + exceeded', () => {
    const b = createExperimentBudget('tokens', 100, false)
    const result = requireBudget(b, 200)
    expect(result.ok).toBe(true)
  })

  it('includes budget type in error params', () => {
    const b = createExperimentBudget('time', 30, true)
    const result = requireBudget(b, 60)
    if (!result.ok) {
      expect(result.error.params?.type).toBe('time')
    }
  })
})
