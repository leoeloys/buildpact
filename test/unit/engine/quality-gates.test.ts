import { describe, it, expect } from 'vitest'
import {
  runLayer1,
  runLayer2,
  runLayer3,
  requireLayerOrder,
} from '../../../src/engine/quality-gates.js'
import type { ReviewIssue, QualityGateResult } from '../../../src/contracts/task.js'

const criticalIssue: ReviewIssue = {
  severity: 'critical',
  category: 'type-error',
  description: 'Type mismatch',
  file: 'src/index.ts',
  recommendation: 'Fix type.',
}

describe('runLayer1', () => {
  it('passes when all checks pass', () => {
    const r = runLayer1({
      lint: { passed: true, issues: [] },
      test: { passed: true, issues: [] },
    })
    expect(r.layer).toBe(1)
    expect(r.mode).toBe('auto')
    expect(r.passed).toBe(true)
  })

  it('fails when any check fails', () => {
    const r = runLayer1({
      lint: { passed: true, issues: [] },
      test: { passed: false, issues: [criticalIssue] },
    })
    expect(r.passed).toBe(false)
    expect(r.issues).toHaveLength(1)
  })

  it('passes with no checks provided', () => {
    const r = runLayer1({})
    expect(r.passed).toBe(true)
    expect(r.issues).toHaveLength(0)
  })
})

describe('runLayer2', () => {
  it('passes when both sub-reviews pass', () => {
    const r = runLayer2(
      { passed: true, issues: [] },
      { passed: true, issues: [] },
    )
    expect(r.layer).toBe(2)
    expect(r.mode).toBe('hybrid')
    expect(r.passed).toBe(true)
  })

  it('fails when spec compliance fails', () => {
    const r = runLayer2(
      { passed: false, issues: [criticalIssue] },
      { passed: true, issues: [] },
    )
    expect(r.passed).toBe(false)
  })

  it('merges issues from both sub-reviews', () => {
    const r = runLayer2(
      { passed: true, issues: [criticalIssue] },
      { passed: true, issues: [criticalIssue] },
    )
    expect(r.issues).toHaveLength(2)
  })
})

describe('runLayer3', () => {
  it('always returns passed=false (pending human)', () => {
    const r = runLayer3(['Check auth flow', 'Verify UI'])
    expect(r.layer).toBe(3)
    expect(r.mode).toBe('manual')
    expect(r.passed).toBe(false)
  })

  it('creates suggestion issues from checklist', () => {
    const r = runLayer3(['Check auth flow'])
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]!.severity).toBe('suggestion')
    expect(r.issues[0]!.description).toBe('Check auth flow')
  })

  it('handles empty checklist', () => {
    const r = runLayer3([])
    expect(r.passed).toBe(false)
    expect(r.issues).toHaveLength(0)
  })
})

describe('requireLayerOrder', () => {
  it('passes for sequential passing layers', () => {
    const l1: QualityGateResult = { layer: 1, mode: 'auto', passed: true, issues: [], duration: 0 }
    const l2: QualityGateResult = { layer: 2, mode: 'hybrid', passed: true, issues: [], duration: 0 }
    expect(requireLayerOrder([l1, l2]).ok).toBe(true)
  })

  it('fails when layer 1 failed before layer 2', () => {
    const l1: QualityGateResult = { layer: 1, mode: 'auto', passed: false, issues: [], duration: 0 }
    const l2: QualityGateResult = { layer: 2, mode: 'hybrid', passed: true, issues: [], duration: 0 }
    const result = requireLayerOrder([l1, l2])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('QUALITY_GATE_LAYER1_FAILED')
  })

  it('fails when layers have gaps', () => {
    const l1: QualityGateResult = { layer: 1, mode: 'auto', passed: true, issues: [], duration: 0 }
    const l3: QualityGateResult = { layer: 3, mode: 'manual', passed: false, issues: [], duration: 0 }
    const result = requireLayerOrder([l1, l3])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REVIEW_STAGE_ORDER_VIOLATION')
  })

  it('passes for single layer', () => {
    const l1: QualityGateResult = { layer: 1, mode: 'auto', passed: true, issues: [], duration: 0 }
    expect(requireLayerOrder([l1]).ok).toBe(true)
  })

  it('sorts layers before checking order', () => {
    const l2: QualityGateResult = { layer: 2, mode: 'hybrid', passed: true, issues: [], duration: 0 }
    const l1: QualityGateResult = { layer: 1, mode: 'auto', passed: true, issues: [], duration: 0 }
    expect(requireLayerOrder([l2, l1]).ok).toBe(true)
  })
})
