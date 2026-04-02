import { describe, it, expect } from 'vitest'
import {
  STRIP_RULES,
  PRESERVE_RULES,
  TRANSFORM_RULES,
  DEFAULT_RULES,
  matchRule,
} from '../../../src/data/compression-rules.js'

describe('STRIP_RULES', () => {
  it('has at least 10 rules', () => {
    expect(STRIP_RULES.length).toBeGreaterThanOrEqual(10)
  })

  it('all rules have id, action, pattern, description', () => {
    for (const rule of STRIP_RULES) {
      expect(rule.id).toBeTruthy()
      expect(rule.action).toBe('strip')
      expect(rule.pattern).toBeTruthy()
      expect(rule.description).toBeTruthy()
    }
  })

  it('matches "As mentioned earlier"', () => {
    expect(STRIP_RULES.some(r => matchRule('As mentioned earlier, this is key.', r))).toBe(true)
  })

  it('matches "It\'s worth noting that"', () => {
    expect(STRIP_RULES.some(r => matchRule("It's worth noting that X works.", r))).toBe(true)
  })

  it('matches "We believe"', () => {
    expect(STRIP_RULES.some(r => matchRule('We believe this is correct.', r))).toBe(true)
  })

  it('matches "Basically"', () => {
    expect(STRIP_RULES.some(r => matchRule('Basically, it works.', r))).toBe(true)
  })

  it('matches "Perhaps"', () => {
    expect(STRIP_RULES.some(r => matchRule('Perhaps we should reconsider.', r))).toBe(true)
  })
})

describe('PRESERVE_RULES', () => {
  it('has at least 8 rules', () => {
    expect(PRESERVE_RULES.length).toBeGreaterThanOrEqual(8)
  })

  it('all rules have preserve action', () => {
    for (const rule of PRESERVE_RULES) {
      expect(rule.action).toBe('preserve')
    }
  })

  it('matches version numbers', () => {
    expect(PRESERVE_RULES.some(r => matchRule('Version v2.3.1 released', r))).toBe(true)
  })

  it('matches monetary values', () => {
    expect(PRESERVE_RULES.some(r => matchRule('Cost is $10.50', r))).toBe(true)
  })

  it('matches ISO dates', () => {
    expect(PRESERVE_RULES.some(r => matchRule('Date: 2026-04-01', r))).toBe(true)
  })

  it('matches identifiers', () => {
    expect(PRESERVE_RULES.some(r => matchRule('See FR-201', r))).toBe(true)
  })

  it('matches RFC 2119 keywords', () => {
    expect(PRESERVE_RULES.some(r => matchRule('Agents MUST provide evidence', r))).toBe(true)
  })

  it('matches scope boundaries', () => {
    expect(PRESERVE_RULES.some(r => matchRule('This is Out of scope', r))).toBe(true)
  })
})

describe('TRANSFORM_RULES', () => {
  it('has at least 5 rules', () => {
    expect(TRANSFORM_RULES.length).toBeGreaterThanOrEqual(5)
  })

  it('all rules have transform action', () => {
    for (const rule of TRANSFORM_RULES) {
      expect(rule.action).toBe('transform')
    }
  })

  it('matches "It is critical to"', () => {
    expect(TRANSFORM_RULES.some(r => matchRule('It is critical to fix this', r))).toBe(true)
  })
})

describe('DEFAULT_RULES', () => {
  it('contains all strip, transform, and preserve rules', () => {
    expect(DEFAULT_RULES.length).toBe(STRIP_RULES.length + TRANSFORM_RULES.length + PRESERVE_RULES.length)
  })
})

describe('matchRule', () => {
  it('returns true for matching pattern', () => {
    expect(matchRule('hello world', { id: 'x', action: 'strip', pattern: 'hello', description: 'test' })).toBe(true)
  })

  it('returns false for non-matching', () => {
    expect(matchRule('goodbye', { id: 'x', action: 'strip', pattern: 'hello', description: 'test' })).toBe(false)
  })

  it('returns false for invalid regex', () => {
    expect(matchRule('text', { id: 'x', action: 'strip', pattern: '[[bad', description: 'test' })).toBe(false)
  })
})
