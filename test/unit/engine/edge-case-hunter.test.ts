import { describe, it, expect } from 'vitest'
import {
  createFinding,
  createHuntResult,
  countBySeverity,
  filterBySeverity,
  formatFindings,
} from '../../../src/engine/edge-case-hunter.js'

describe('createFinding', () => {
  it('creates finding with all fields', () => {
    const f = createFinding('parser.ts:42', 'null input', 'if (!input) return', 'crash', 'high')
    expect(f.location).toBe('parser.ts:42')
    expect(f.triggerCondition).toBe('null input')
    expect(f.guardSnippet).toBe('if (!input) return')
    expect(f.potentialConsequence).toBe('crash')
    expect(f.severity).toBe('high')
  })

  it('defaults severity to medium', () => {
    const f = createFinding('loc', 'trigger', 'guard', 'consequence')
    expect(f.severity).toBe('medium')
  })
})

describe('createHuntResult', () => {
  it('wraps findings array', () => {
    const findings = [createFinding('a', 'b', 'c', 'd')]
    const result = createHuntResult(findings)
    expect(result.findings).toHaveLength(1)
  })
})

describe('countBySeverity', () => {
  it('counts findings by severity level', () => {
    const result = createHuntResult([
      createFinding('a', 'b', 'c', 'd', 'high'),
      createFinding('a', 'b', 'c', 'd', 'high'),
      createFinding('a', 'b', 'c', 'd', 'low'),
    ])
    const counts = countBySeverity(result)
    expect(counts.high).toBe(2)
    expect(counts.medium).toBe(0)
    expect(counts.low).toBe(1)
  })
})

describe('filterBySeverity', () => {
  const result = createHuntResult([
    createFinding('a', 'b', 'c', 'd', 'high'),
    createFinding('a', 'b', 'c', 'd', 'medium'),
    createFinding('a', 'b', 'c', 'd', 'low'),
  ])

  it('filters high only', () => {
    expect(filterBySeverity(result, 'high')).toHaveLength(1)
  })

  it('filters medium and above', () => {
    expect(filterBySeverity(result, 'medium')).toHaveLength(2)
  })

  it('filters all when low', () => {
    expect(filterBySeverity(result, 'low')).toHaveLength(3)
  })
})

describe('formatFindings', () => {
  it('returns no-findings message for empty result', () => {
    expect(formatFindings(createHuntResult([]))).toBe('No edge cases found.')
  })

  it('formats findings with location, trigger, guard, consequence', () => {
    const result = createHuntResult([createFinding('file.ts:10', 'empty array', 'if (arr.length)', 'index OOB', 'high')])
    const text = formatFindings(result)
    expect(text).toContain('[HIGH]')
    expect(text).toContain('file.ts:10')
    expect(text).toContain('Trigger: empty array')
    expect(text).toContain('Guard: if (arr.length)')
    expect(text).toContain('Consequence: index OOB')
  })
})
