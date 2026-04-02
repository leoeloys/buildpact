import { describe, it, expect } from 'vitest'
import {
  ELICITATION_METHODS,
  selectMethods,
} from '../../../src/data/elicitation-methods.js'
import type { ElicitationMethod } from '../../../src/data/elicitation-methods.js'

describe('ELICITATION_METHODS', () => {
  it('contains 15 methods', () => {
    expect(ELICITATION_METHODS).toHaveLength(15)
  })

  it('each method has id, name, description, bestFor', () => {
    for (const m of ELICITATION_METHODS) {
      expect(m.id).toBeTruthy()
      expect(m.name).toBeTruthy()
      expect(m.description).toBeTruthy()
      expect(m.bestFor).toBeTruthy()
    }
  })

  it('includes interview method', () => {
    expect(ELICITATION_METHODS.some(m => m.id === 'interview')).toBe(true)
  })
})

describe('selectMethods', () => {
  it('returns exactly 5 methods', () => {
    const result = selectMethods('saas', 'medium')
    expect(result).toHaveLength(5)
  })

  it('returns methods with correct shape', () => {
    const result = selectMethods('enterprise', 'high')
    for (const m of result) {
      expect(m).toHaveProperty('id')
      expect(m).toHaveProperty('name')
      expect(m).toHaveProperty('description')
      expect(m).toHaveProperty('bestFor')
    }
  })

  it('falls back gracefully for unknown project type', () => {
    const result = selectMethods('unknown', 'low')
    expect(result).toHaveLength(5)
  })

  it('boosts complexity-specific methods for high complexity', () => {
    const result = selectMethods('enterprise', 'high')
    const ids = result.map(m => m.id)
    // workshop is boosted for high complexity + enterprise
    expect(ids).toContain('workshop')
  })

  it('boosts survey for low complexity', () => {
    const result = selectMethods('startup', 'low')
    const ids = result.map(m => m.id)
    expect(ids).toContain('survey')
  })
})
