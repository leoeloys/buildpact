import { describe, it, expect } from 'vitest'
import {
  checkContextAlert,
  getContextUsage,
  getCostState,
  CONTEXT_WARNING_THRESHOLD,
  CONTEXT_CRITICAL_THRESHOLD,
} from '../../../src/foundation/monitor.js'

describe('checkContextAlert', () => {
  it('returns none at 0%', () => {
    expect(checkContextAlert(0)).toBe('none')
  })

  it('returns none below warning threshold (0.49)', () => {
    expect(checkContextAlert(0.49)).toBe('none')
  })

  it('returns warning at warning threshold boundary (0.50 — inclusive)', () => {
    expect(checkContextAlert(CONTEXT_WARNING_THRESHOLD)).toBe('warning')
  })

  it('returns warning between thresholds (0.74)', () => {
    expect(checkContextAlert(0.74)).toBe('warning')
  })

  it('returns critical at critical threshold boundary (0.75 — inclusive)', () => {
    expect(checkContextAlert(CONTEXT_CRITICAL_THRESHOLD)).toBe('critical')
  })

  it('returns critical at 1.0', () => {
    expect(checkContextAlert(1.0)).toBe('critical')
  })

  it('returns critical at 0.999', () => {
    expect(checkContextAlert(0.999)).toBe('critical')
  })
})

describe('getContextUsage (Alpha stub)', () => {
  it('returns NOT_IMPLEMENTED with phase FR-303', () => {
    const result = getContextUsage()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_IMPLEMENTED')
      expect(result.error.phase).toContain('FR-303')
    }
  })
})

describe('getCostState (Alpha stub)', () => {
  it('returns NOT_IMPLEMENTED with phase FR-303', () => {
    const result = getCostState()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_IMPLEMENTED')
      expect(result.error.phase).toContain('FR-303')
    }
  })
})
