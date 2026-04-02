import { describe, it, expect } from 'vitest'
import {
  SPECULATION_PATTERNS,
  extractClaims,
  detectSpeculationMarkers,
  checkFaithfulness,
  requireFaithfulness,
} from '../../../src/engine/faithfulness-checker.js'

describe('SPECULATION_PATTERNS', () => {
  it('is a non-empty array of strings', () => {
    expect(SPECULATION_PATTERNS.length).toBeGreaterThan(0)
    expect(SPECULATION_PATTERNS).toContain('probably')
    expect(SPECULATION_PATTERNS).toContain('i believe')
  })
})

describe('extractClaims', () => {
  it('splits sentences on period boundaries', () => {
    const claims = extractClaims('First sentence. Second sentence. Third.')
    expect(claims).toHaveLength(3)
    expect(claims[0]!.claim).toBe('First sentence.')
    expect(claims[1]!.claim).toBe('Second sentence.')
  })

  it('returns empty for empty string', () => {
    expect(extractClaims('')).toEqual([])
    expect(extractClaims('   ')).toEqual([])
  })

  it('marks all claims as unverified and unfaithful initially', () => {
    const claims = extractClaims('A claim.')
    expect(claims[0]!.verified).toBe(false)
    expect(claims[0]!.faithful).toBe(false)
    expect(claims[0]!.source).toBeNull()
  })

  it('handles single sentence without trailing period', () => {
    const claims = extractClaims('Single sentence without period')
    expect(claims).toHaveLength(1)
  })
})

describe('detectSpeculationMarkers', () => {
  it('detects matching speculation phrases', () => {
    const markers = detectSpeculationMarkers('This probably works and should work fine.')
    expect(markers).toContain('probably')
    expect(markers).toContain('should work')
  })

  it('returns empty when no speculation', () => {
    expect(detectSpeculationMarkers('The function returns 42.')).toEqual([])
  })

  it('is case-insensitive', () => {
    const markers = detectSpeculationMarkers('I BELIEVE this is correct.')
    expect(markers).toContain('i believe')
  })
})

describe('checkFaithfulness', () => {
  it('returns score=1 and passed=true for empty claims', () => {
    const r = checkFaithfulness([])
    expect(r.score).toBe(1)
    expect(r.passed).toBe(true)
    expect(r.claims).toHaveLength(0)
  })

  it('auto-marks speculative claims as unfaithful', () => {
    const claims = extractClaims('This probably works. The sky is blue.')
    const r = checkFaithfulness(claims)
    expect(r.claims[0]!.faithful).toBe(false)
    expect(r.speculationMarkers).toContain('probably')
  })

  it('scores based on faithful proportion', () => {
    const claims = [
      { claim: 'Certain fact.', source: null, verified: false, faithful: true },
      { claim: 'This probably works.', source: null, verified: false, faithful: false },
    ]
    const r = checkFaithfulness(claims)
    // Speculation auto-marks second, first stays faithful
    expect(r.score).toBe(0.5)
  })

  it('respects custom minScore threshold', () => {
    const claims = [
      { claim: 'Fact one.', source: null, verified: false, faithful: true },
      { claim: 'Fact two.', source: null, verified: false, faithful: true },
      { claim: 'Probably wrong.', source: null, verified: false, faithful: false },
    ]
    const r = checkFaithfulness(claims, 0.9)
    // 2/3 = 0.67, below 0.9
    expect(r.passed).toBe(false)
  })

  it('deduplicates speculation markers', () => {
    const claims = [
      { claim: 'Probably A.', source: null, verified: false, faithful: false },
      { claim: 'Probably B.', source: null, verified: false, faithful: false },
    ]
    const r = checkFaithfulness(claims)
    expect(r.speculationMarkers.filter(m => m === 'probably')).toHaveLength(1)
  })
})

describe('requireFaithfulness', () => {
  it('returns ok when passed=true', () => {
    const r = checkFaithfulness([])
    expect(requireFaithfulness(r).ok).toBe(true)
  })

  it('returns error FAITHFULNESS_BELOW_THRESHOLD when failed', () => {
    const claims = extractClaims('This probably works.')
    const r = checkFaithfulness(claims, 1.0)
    const result = requireFaithfulness(r)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FAITHFULNESS_BELOW_THRESHOLD')
      expect(result.error.params?.score).toBeDefined()
    }
  })
})
