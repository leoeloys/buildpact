import { describe, it, expect } from 'vitest'
import {
  createVerificationEvidence,
  isEvidenceStale,
  validateEvidence,
  detectRedFlags,
  requireVerificationForClaim,
  DEFAULT_MAX_AGE_MS,
  MAX_OUTPUT_LENGTH,
} from '../../../src/engine/verification-gate.js'

describe('createVerificationEvidence', () => {
  it('creates evidence with correct fields', () => {
    const ev = createVerificationEvidence('npm test', 0, 'All tests passed', 'TESTS_PASS')
    expect(ev.command).toBe('npm test')
    expect(ev.exitCode).toBe(0)
    expect(ev.output).toBe('All tests passed')
    expect(ev.claimType).toBe('TESTS_PASS')
    expect(ev.stale).toBe(false)
    expect(ev.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('truncates output exceeding MAX_OUTPUT_LENGTH', () => {
    const longOutput = 'x'.repeat(MAX_OUTPUT_LENGTH + 500)
    const ev = createVerificationEvidence('cmd', 0, longOutput, 'BUILD_SUCCEEDS')
    expect(ev.output.length).toBe(MAX_OUTPUT_LENGTH)
  })
})

describe('isEvidenceStale', () => {
  it('returns false for fresh evidence', () => {
    const ev = createVerificationEvidence('cmd', 0, 'ok', 'BUILD_SUCCEEDS')
    expect(isEvidenceStale(ev)).toBe(false)
  })

  it('returns true for old evidence', () => {
    const ev = createVerificationEvidence('cmd', 0, 'ok', 'BUILD_SUCCEEDS')
    ev.timestamp = new Date(Date.now() - DEFAULT_MAX_AGE_MS - 1000).toISOString()
    expect(isEvidenceStale(ev)).toBe(true)
  })

  it('respects custom maxAgeMs', () => {
    const ev = createVerificationEvidence('cmd', 0, 'ok', 'BUILD_SUCCEEDS')
    ev.timestamp = new Date(Date.now() - 5000).toISOString()
    expect(isEvidenceStale(ev, 3000)).toBe(true)
    expect(isEvidenceStale(ev, 10000)).toBe(false)
  })
})

describe('validateEvidence', () => {
  it('passes for valid fresh evidence with exit 0', () => {
    const ev = createVerificationEvidence('npm test', 0, '95 tests passed', 'TESTS_PASS')
    expect(validateEvidence(ev).ok).toBe(true)
  })

  it('rejects stale evidence', () => {
    const ev = createVerificationEvidence('npm test', 0, 'ok', 'TESTS_PASS')
    ev.timestamp = new Date(Date.now() - DEFAULT_MAX_AGE_MS - 1000).toISOString()
    const result = validateEvidence(ev)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VERIFICATION_EVIDENCE_STALE')
  })

  it('rejects nonzero exit for TESTS_PASS', () => {
    const ev = createVerificationEvidence('npm test', 1, 'FAIL', 'TESTS_PASS')
    const result = validateEvidence(ev)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VERIFICATION_CLAIM_UNSUBSTANTIATED')
  })

  it('rejects nonzero exit for BUILD_SUCCEEDS', () => {
    const ev = createVerificationEvidence('npm run build', 2, 'error', 'BUILD_SUCCEEDS')
    const result = validateEvidence(ev)
    expect(result.ok).toBe(false)
  })

  it('rejects nonzero exit for LINT_CLEAN', () => {
    const ev = createVerificationEvidence('eslint .', 1, '3 errors', 'LINT_CLEAN')
    expect(validateEvidence(ev).ok).toBe(false)
  })

  it('allows nonzero exit for BUG_FIXED (only needs evidence)', () => {
    const ev = createVerificationEvidence('node repro.js', 1, 'Error reproduced', 'BUG_FIXED')
    expect(validateEvidence(ev).ok).toBe(true)
  })

  it('rejects empty output', () => {
    const ev = createVerificationEvidence('cmd', 0, '', 'BUILD_SUCCEEDS')
    const result = validateEvidence(ev)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VERIFICATION_CLAIM_UNSUBSTANTIATED')
  })
})

describe('detectRedFlags', () => {
  it('detects "probably" in output', () => {
    expect(detectRedFlags('This probably works fine')).toContain('probably')
  })

  it('detects "should work"', () => {
    expect(detectRedFlags('It should work now')).toContain('should work')
  })

  it('detects multiple red flags', () => {
    const flags = detectRedFlags('It probably works and seems to be fine, hopefully')
    expect(flags).toContain('probably')
    expect(flags).toContain('seems to')
    expect(flags).toContain('hopefully')
  })

  it('returns empty for clean output', () => {
    expect(detectRedFlags('95 tests passed, 0 failures')).toEqual([])
  })

  it('is case-insensitive', () => {
    expect(detectRedFlags('PROBABLY works')).toContain('probably')
  })
})

describe('requireVerificationForClaim', () => {
  it('blocks when no evidence provided', () => {
    const result = requireVerificationForClaim('TESTS_PASS')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VERIFICATION_EVIDENCE_MISSING')
  })

  it('passes with valid evidence', () => {
    const ev = createVerificationEvidence('npm test', 0, 'ok', 'TESTS_PASS')
    const result = requireVerificationForClaim('TESTS_PASS', ev)
    expect(result.ok).toBe(true)
  })

  it('blocks with stale evidence', () => {
    const ev = createVerificationEvidence('npm test', 0, 'ok', 'TESTS_PASS')
    ev.timestamp = new Date(Date.now() - DEFAULT_MAX_AGE_MS - 1000).toISOString()
    const result = requireVerificationForClaim('TESTS_PASS', ev)
    expect(result.ok).toBe(false)
  })
})
