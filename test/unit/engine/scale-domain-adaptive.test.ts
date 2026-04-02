import { describe, it, expect } from 'vitest'
import {
  detectComplexity,
  recommendFlow,
  formatRecommendation,
} from '../../../src/engine/scale-domain-adaptive.js'

describe('detectComplexity', () => {
  it('returns trivial for tiny projects', () => {
    expect(detectComplexity(3, 2, 0)).toBe('trivial')
  })

  it('returns simple for small projects', () => {
    expect(detectComplexity(15, 8, 1)).toBe('simple')
  })

  it('returns moderate for medium projects', () => {
    expect(detectComplexity(50, 20, 3)).toBe('moderate')
  })

  it('returns complex for large projects', () => {
    expect(detectComplexity(200, 50, 10)).toBe('complex')
  })

  it('returns expert for massive projects', () => {
    expect(detectComplexity(1000, 500, 50)).toBe('expert')
  })
})

describe('recommendFlow', () => {
  it('skips all phases for trivial tier', () => {
    const flow = recommendFlow('trivial')
    expect(flow.skipSpec).toBe(true)
    expect(flow.skipClarify).toBe(true)
    expect(flow.skipResearch).toBe(true)
    expect(flow.planDepth).toBe('shallow')
  })

  it('uses deep planning for complex tier', () => {
    const flow = recommendFlow('complex')
    expect(flow.skipSpec).toBe(false)
    expect(flow.skipClarify).toBe(false)
    expect(flow.planDepth).toBe('deep')
  })

  it('returns a copy, not a reference', () => {
    const a = recommendFlow('moderate')
    const b = recommendFlow('moderate')
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })
})

describe('formatRecommendation', () => {
  it('includes tier name uppercased', () => {
    const flow = recommendFlow('trivial')
    const text = formatRecommendation('trivial', flow)
    expect(text).toContain('TRIVIAL')
  })

  it('lists skipped phases for trivial', () => {
    const flow = recommendFlow('trivial')
    const text = formatRecommendation('trivial', flow)
    expect(text).toContain('Skip: spec, clarify, research')
  })

  it('says "No phases skipped" for complex', () => {
    const flow = recommendFlow('complex')
    const text = formatRecommendation('complex', flow)
    expect(text).toContain('No phases skipped')
  })
})
