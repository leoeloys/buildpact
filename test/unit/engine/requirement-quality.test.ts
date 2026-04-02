import { describe, it, expect, beforeEach } from 'vitest'
import {
  createChecklist,
  createCheckItem,
  evaluateItem,
  calculateTraceability,
  calculatePassRate,
  checkQualityThreshold,
  resetCheckCounter,
} from '../../../src/engine/requirement-quality.js'

describe('createChecklist', () => {
  beforeEach(() => resetCheckCounter())

  it('creates checklist with auto-generated IDs', () => {
    const items = [
      createCheckItem('Are error modes defined?', 'COMPLETENESS', 'Spec §3.2'),
      createCheckItem('Are response times specified?', 'MEASURABILITY'),
    ]
    const cl = createChecklist('SPEC-001', items)
    expect(cl.specId).toBe('SPEC-001')
    expect(cl.items).toHaveLength(2)
    expect(cl.items[0]!.id).toBe('CHK-001')
    expect(cl.items[1]!.id).toBe('CHK-002')
  })
})

describe('evaluateItem', () => {
  beforeEach(() => resetCheckCounter())

  it('updates item status and recalculates rates', () => {
    const items = [
      createCheckItem('Q1?', 'COMPLETENESS', 'Spec §1'),
      createCheckItem('Q2?', 'CLARITY', 'Spec §2'),
    ]
    let cl = createChecklist('SPEC-001', items)
    cl = evaluateItem(cl, 'CHK-001', 'pass')
    cl = evaluateItem(cl, 'CHK-002', 'fail')
    expect(cl.items[0]!.status).toBe('pass')
    expect(cl.items[1]!.status).toBe('fail')
    expect(cl.passRate).toBe(0.5) // 1/2
  })

  it('supports notes', () => {
    const items = [createCheckItem('Q1?', 'COVERAGE')]
    let cl = createChecklist('SPEC-001', items)
    cl = evaluateItem(cl, 'CHK-001', 'fail', 'Missing edge case for empty input')
    expect(cl.items[0]!.notes).toBe('Missing edge case for empty input')
  })
})

describe('calculateTraceability', () => {
  beforeEach(() => resetCheckCounter())

  it('returns 1 for all items with specReference', () => {
    const items = [
      createCheckItem('Q1?', 'COMPLETENESS', 'Spec §1'),
      createCheckItem('Q2?', 'CLARITY', 'Spec §2'),
    ]
    let cl = createChecklist('SPEC-001', items)
    cl = evaluateItem(cl, 'CHK-001', 'pass')
    cl = evaluateItem(cl, 'CHK-002', 'pass')
    expect(calculateTraceability(cl)).toBe(1)
  })

  it('returns 0.5 when half have specReference', () => {
    const items = [
      createCheckItem('Q1?', 'COMPLETENESS', 'Spec §1'),
      createCheckItem('Q2?', 'CLARITY'), // no ref
    ]
    let cl = createChecklist('SPEC-001', items)
    cl = evaluateItem(cl, 'CHK-001', 'pass')
    cl = evaluateItem(cl, 'CHK-002', 'pass')
    expect(calculateTraceability(cl)).toBe(0.5)
  })

  it('excludes na items from calculation', () => {
    const items = [
      createCheckItem('Q1?', 'COMPLETENESS', 'Spec §1'),
      createCheckItem('Q2?', 'CLARITY'), // no ref, but na
    ]
    let cl = createChecklist('SPEC-001', items)
    cl = evaluateItem(cl, 'CHK-001', 'pass')
    // CHK-002 stays na
    expect(calculateTraceability(cl)).toBe(1) // only CHK-001 counted
  })

  it('returns 1 when no items evaluated', () => {
    const cl = createChecklist('SPEC-001', [])
    expect(calculateTraceability(cl)).toBe(1)
  })
})

describe('calculatePassRate', () => {
  beforeEach(() => resetCheckCounter())

  it('calculates correctly', () => {
    const items = [
      createCheckItem('Q1?', 'COMPLETENESS'),
      createCheckItem('Q2?', 'CLARITY'),
      createCheckItem('Q3?', 'COVERAGE'),
    ]
    let cl = createChecklist('SPEC-001', items)
    cl = evaluateItem(cl, 'CHK-001', 'pass')
    cl = evaluateItem(cl, 'CHK-002', 'pass')
    cl = evaluateItem(cl, 'CHK-003', 'fail')
    expect(calculatePassRate(cl)).toBeCloseTo(0.667, 2)
  })
})

describe('checkQualityThreshold', () => {
  beforeEach(() => resetCheckCounter())

  it('passes when above both thresholds', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      createCheckItem(`Q${i}?`, 'COMPLETENESS', `Spec §${i}`),
    )
    let cl = createChecklist('SPEC-001', items)
    for (let i = 1; i <= 10; i++) {
      cl = evaluateItem(cl, `CHK-${String(i).padStart(3, '0')}`, i <= 9 ? 'pass' : 'fail')
    }
    // 9/10 pass = 90%, all have specRef = 100% traceability
    expect(checkQualityThreshold(cl).ok).toBe(true)
  })

  it('blocks when pass rate below threshold', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      createCheckItem(`Q${i}?`, 'COMPLETENESS', `Spec §${i}`),
    )
    let cl = createChecklist('SPEC-001', items)
    for (let i = 1; i <= 10; i++) {
      cl = evaluateItem(cl, `CHK-${String(i).padStart(3, '0')}`, i <= 7 ? 'pass' : 'fail')
    }
    // 7/10 = 70% < 80%
    const result = checkQualityThreshold(cl)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REQUIREMENT_QUALITY_BELOW_THRESHOLD')
  })

  it('blocks when traceability below threshold', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      createCheckItem(`Q${i}?`, 'COMPLETENESS', i < 7 ? `Spec §${i}` : null),
    )
    let cl = createChecklist('SPEC-001', items)
    for (let i = 1; i <= 10; i++) {
      cl = evaluateItem(cl, `CHK-${String(i).padStart(3, '0')}`, 'pass')
    }
    // all pass but only 7/10 have specRef = 70% < 80%
    const result = checkQualityThreshold(cl)
    expect(result.ok).toBe(false)
  })

  it('respects custom thresholds', () => {
    const items = [createCheckItem('Q1?', 'COMPLETENESS')]
    let cl = createChecklist('SPEC-001', items)
    cl = evaluateItem(cl, 'CHK-001', 'pass')
    // 100% pass, 0% traceability — custom threshold 0%
    expect(checkQualityThreshold(cl, 0.8, 0).ok).toBe(true)
  })
})
