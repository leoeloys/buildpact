import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetFindingCounter,
  createConsistencyFinding,
  analyzeConsistency,
  hasCriticalFindings,
  constitutionViolationsAreCritical,
  requireConsistency,
  formatConsistencyReport,
} from '../../../src/engine/consistency-analyzer.js'

beforeEach(() => {
  resetFindingCounter()
})

describe('createConsistencyFinding', () => {
  it('generates unique IDs', () => {
    const f1 = createConsistencyFinding('high', 'DUPLICATION', 'dup', 'a.md', 'b.md', 'merge')
    const f2 = createConsistencyFinding('low', 'COVERAGE_GAP', 'gap', 'c.md', 'd.md', 'add')
    expect(f1.id).toMatch(/^CST-/)
    expect(f2.id).toMatch(/^CST-/)
    expect(f1.id).not.toBe(f2.id)
  })

  it('preserves all fields', () => {
    const f = createConsistencyFinding('critical', 'CONSTITUTION_VIOLATION', 'violation', 's.md', 'c.md', 'fix')
    expect(f.severity).toBe('critical')
    expect(f.category).toBe('CONSTITUTION_VIOLATION')
    expect(f.sourceArtifact).toBe('s.md')
    expect(f.conflictArtifact).toBe('c.md')
  })
})

describe('analyzeConsistency', () => {
  it('returns empty summary for no findings', () => {
    const report = analyzeConsistency([])
    expect(report.findings).toHaveLength(0)
    expect(Object.keys(report.summary)).toHaveLength(0)
  })

  it('counts findings by severity', () => {
    const f1 = createConsistencyFinding('high', 'DUPLICATION', 'd', 'a', 'b', 'r')
    const f2 = createConsistencyFinding('high', 'COVERAGE_GAP', 'g', 'a', 'b', 'r')
    const f3 = createConsistencyFinding('critical', 'REQUIREMENT_CONFLICT', 'c', 'a', 'b', 'r')
    const report = analyzeConsistency([f1, f2, f3])
    expect(report.summary['high']).toBe(2)
    expect(report.summary['critical']).toBe(1)
  })
})

describe('hasCriticalFindings', () => {
  it('returns false when no criticals', () => {
    const f = createConsistencyFinding('low', 'DUPLICATION', 'd', 'a', 'b', 'r')
    const report = analyzeConsistency([f])
    expect(hasCriticalFindings(report)).toBe(false)
  })

  it('returns true when critical exists', () => {
    const f = createConsistencyFinding('critical', 'REQUIREMENT_CONFLICT', 'c', 'a', 'b', 'r')
    const report = analyzeConsistency([f])
    expect(hasCriticalFindings(report)).toBe(true)
  })
})

describe('constitutionViolationsAreCritical', () => {
  it('promotes CONSTITUTION_VIOLATION to critical', () => {
    const f = createConsistencyFinding('low', 'CONSTITUTION_VIOLATION', 'd', 'a', 'b', 'r')
    const promoted = constitutionViolationsAreCritical([f])
    expect(promoted[0]!.severity).toBe('critical')
  })

  it('does not change already-critical findings', () => {
    const f = createConsistencyFinding('critical', 'CONSTITUTION_VIOLATION', 'd', 'a', 'b', 'r')
    const promoted = constitutionViolationsAreCritical([f])
    expect(promoted[0]!.severity).toBe('critical')
  })

  it('does not affect non-constitution findings', () => {
    const f = createConsistencyFinding('low', 'DUPLICATION', 'd', 'a', 'b', 'r')
    const promoted = constitutionViolationsAreCritical([f])
    expect(promoted[0]!.severity).toBe('low')
  })
})

describe('requireConsistency', () => {
  it('returns ok when no critical findings', () => {
    const f = createConsistencyFinding('low', 'DUPLICATION', 'd', 'a', 'b', 'r')
    const report = analyzeConsistency([f])
    expect(requireConsistency(report).ok).toBe(true)
  })

  it('returns error CONSISTENCY_VIOLATION_CRITICAL on critical', () => {
    const f = createConsistencyFinding('critical', 'REQUIREMENT_CONFLICT', 'c', 'a', 'b', 'r')
    const report = analyzeConsistency([f])
    const result = requireConsistency(report)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONSISTENCY_VIOLATION_CRITICAL')
  })
})

describe('formatConsistencyReport', () => {
  it('shows no inconsistencies for empty report', () => {
    const report = analyzeConsistency([])
    expect(formatConsistencyReport(report)).toContain('No inconsistencies found.')
  })

  it('includes finding details', () => {
    const f = createConsistencyFinding('high', 'DUPLICATION', 'dup desc', 'src.md', 'tgt.md', 'merge')
    const report = analyzeConsistency([f])
    const text = formatConsistencyReport(report)
    expect(text).toMatch(/CST-/)
    expect(text).toContain('DUPLICATION')
    expect(text).toContain('dup desc')
  })
})
