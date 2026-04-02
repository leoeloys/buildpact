import { describe, it, expect } from 'vitest'
import {
  calculateSimplicity,
  shouldAutoDiscard,
  formatSimplicityReport,
} from '../../../src/engine/simplicity-criterion.js'

describe('calculateSimplicity', () => {
  it('computes net complexity as added minus removed', () => {
    const check = calculateSimplicity(50, 20, 0.5)
    expect(check.netComplexity).toBe(30)
    expect(check.linesAdded).toBe(50)
    expect(check.linesRemoved).toBe(20)
  })

  it('computes simplicity ratio correctly', () => {
    const check = calculateSimplicity(30, 10, 2.0)
    // netComplexity = 20, ratio = 2.0 / 20 = 0.1
    expect(check.simplicityRatio).toBeCloseTo(0.1)
  })

  it('uses abs(netComplexity) in denominator', () => {
    // net = -10, denominator = max(10, 1) = 10
    const check = calculateSimplicity(5, 15, 1.0)
    expect(check.netComplexity).toBe(-10)
    expect(check.simplicityRatio).toBeCloseTo(0.1)
  })

  it('uses 1 as denominator when net complexity is 0', () => {
    const check = calculateSimplicity(10, 10, 0.5)
    expect(check.netComplexity).toBe(0)
    expect(check.simplicityRatio).toBe(0.5)
  })

  it('preserves metric improvement', () => {
    const check = calculateSimplicity(0, 0, 0.99)
    expect(check.metricImprovement).toBe(0.99)
  })
})

describe('shouldAutoDiscard', () => {
  it('discards when improvement below threshold and complexity above limit', () => {
    const check = calculateSimplicity(100, 10, 0.005)
    expect(shouldAutoDiscard(check)).toBe(true)
  })

  it('keeps when improvement above threshold', () => {
    const check = calculateSimplicity(100, 10, 0.5)
    expect(shouldAutoDiscard(check)).toBe(false)
  })

  it('keeps when complexity below limit', () => {
    const check = calculateSimplicity(10, 5, 0.005)
    // net = 5, below default 20
    expect(shouldAutoDiscard(check)).toBe(false)
  })

  it('respects custom thresholds', () => {
    const check = calculateSimplicity(15, 5, 0.03)
    // net = 10, improvement = 0.03
    expect(shouldAutoDiscard(check, 0.05, 5)).toBe(true)
  })
})

describe('formatSimplicityReport', () => {
  it('includes KEEP for non-discarded change', () => {
    const check = calculateSimplicity(10, 5, 1.0)
    const report = formatSimplicityReport(check)
    expect(report).toContain('KEEP')
    expect(report).toContain('Simplicity Criterion Report')
  })

  it('includes AUTO-DISCARD for discardable change', () => {
    const check = calculateSimplicity(100, 10, 0.001)
    const report = formatSimplicityReport(check)
    expect(report).toContain('AUTO-DISCARD')
  })

  it('shows positive sign for positive net complexity', () => {
    const check = calculateSimplicity(30, 10, 0.5)
    const report = formatSimplicityReport(check)
    expect(report).toContain('+20')
  })
})
