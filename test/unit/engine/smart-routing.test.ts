import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MODEL_TIERS,
  assessComplexity,
  selectModel,
} from '../../../src/engine/smart-routing.js'
import type { ModelDescriptor } from '../../../src/engine/smart-routing.js'

describe('DEFAULT_MODEL_TIERS', () => {
  it('maps all five tiers', () => {
    expect(DEFAULT_MODEL_TIERS.trivial).toBe('haiku')
    expect(DEFAULT_MODEL_TIERS.simple).toBe('haiku')
    expect(DEFAULT_MODEL_TIERS.moderate).toBe('sonnet')
    expect(DEFAULT_MODEL_TIERS.complex).toBe('opus')
    expect(DEFAULT_MODEL_TIERS.expert).toBe('opus')
  })
})

describe('assessComplexity', () => {
  it('returns trivial for minimal inputs', () => {
    expect(assessComplexity('fix typo', 1, 100)).toBe('trivial')
  })

  it('returns simple for moderate description and few files', () => {
    const desc = 'a'.repeat(150)
    expect(assessComplexity(desc, 5, 500)).toBe('simple')
  })

  it('returns moderate for medium inputs', () => {
    const desc = 'a'.repeat(600)
    expect(assessComplexity(desc, 12, 5000)).toBe('moderate')
  })

  it('returns complex for large inputs', () => {
    const desc = 'a'.repeat(2500)
    // 30 (desc>2000) + 20 (files>10) + 10 (tokens>2000) = 60
    expect(assessComplexity(desc, 12, 5000)).toBe('complex')
  })

  it('returns expert for very large inputs', () => {
    const desc = 'a'.repeat(3000)
    expect(assessComplexity(desc, 30, 60000)).toBe('expert')
  })
})

describe('selectModel', () => {
  const models: ModelDescriptor[] = [
    { name: 'haiku', maxTokens: 4000, costPer1k: 0.25 },
    { name: 'sonnet', maxTokens: 8000, costPer1k: 3.0 },
    { name: 'opus', maxTokens: 200000, costPer1k: 15.0 },
  ]

  it('returns exact match for default tier model', () => {
    const result = selectModel('trivial', models)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.selectedModel).toBe('haiku')
      expect(result.value.tier).toBe('trivial')
    }
  })

  it('returns opus for expert tier', () => {
    const result = selectModel('expert', models)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.selectedModel).toBe('opus')
    }
  })

  it('returns error when no models available', () => {
    const result = selectModel('trivial', [])
    expect(result.ok).toBe(false)
  })

  it('falls back to cheapest for trivial when preferred not available', () => {
    const altModels: ModelDescriptor[] = [
      { name: 'custom-small', maxTokens: 2000, costPer1k: 0.1 },
      { name: 'custom-large', maxTokens: 100000, costPer1k: 10.0 },
    ]
    const result = selectModel('trivial', altModels)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.selectedModel).toBe('custom-small')
    }
  })

  it('falls back to most expensive for expert when preferred not available', () => {
    const altModels: ModelDescriptor[] = [
      { name: 'custom-small', maxTokens: 2000, costPer1k: 0.1 },
      { name: 'custom-large', maxTokens: 100000, costPer1k: 10.0 },
    ]
    const result = selectModel('expert', altModels)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.selectedModel).toBe('custom-large')
    }
  })
})
