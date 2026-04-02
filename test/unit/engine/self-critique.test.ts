import { describe, it, expect } from 'vitest'
import {
  createSelfCritiqueReport,
  createSkippedReport,
  validateSelfCritique,
  requireSelfCritique,
  isVagueDescription,
  MIN_PREDICTED_BUGS,
  MIN_EDGE_CASES,
} from '../../../src/engine/self-critique.js'
import type { PredictedIssue, SelfCritiqueReport } from '../../../src/contracts/task.js'

function makeIssue(desc: string, severity: PredictedIssue['severity'] = 'medium'): PredictedIssue {
  return { description: desc, severity, mitigated: false, mitigation: null }
}

function makeValidBugs(n: number): PredictedIssue[] {
  return Array.from({ length: n }, (_, i) =>
    makeIssue(`Bug number ${i + 1} with sufficient detail to pass validation checks`)
  )
}

function makeValidEdgeCases(n: number): PredictedIssue[] {
  return Array.from({ length: n }, (_, i) =>
    makeIssue(`Edge case ${i + 1} with enough detail to pass the length check`)
  )
}

describe('createSelfCritiqueReport', () => {
  it('creates report with correct fields', () => {
    const report = createSelfCritiqueReport('task-1', 'post-code', [], [])
    expect(report.taskId).toBe('task-1')
    expect(report.gate).toBe('post-code')
    expect(report.overallPass).toBe(false)
    expect(report.skipped).toBe(false)
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('createSkippedReport', () => {
  it('creates skipped report', () => {
    const report = createSkippedReport('task-2', 'post-test')
    expect(report.skipped).toBe(true)
    expect(report.predictedBugs).toEqual([])
    expect(report.edgeCases).toEqual([])
  })
})

describe('isVagueDescription', () => {
  it('flags short descriptions', () => {
    expect(isVagueDescription('too short')).toBe(true)
  })

  it('flags known vague patterns', () => {
    expect(isVagueDescription('This might have issues with the system under certain conditions')).toBe(true)
  })

  it('accepts detailed descriptions', () => {
    expect(isVagueDescription('When concurrent requests hit the /api/users endpoint, the shared counter increments non-atomically')).toBe(false)
  })
})

describe('validateSelfCritique', () => {
  it('passes skipped reports without validation', () => {
    const report = createSkippedReport('task-1', 'post-code')
    const result = validateSelfCritique(report)
    expect(result.ok).toBe(true)
  })

  it('fails with insufficient bugs', () => {
    const report = createSelfCritiqueReport('task-1', 'post-code', [makeIssue('x'.repeat(30))], makeValidEdgeCases(MIN_EDGE_CASES))
    const result = validateSelfCritique(report)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SELF_CRITIQUE_INSUFFICIENT')
  })

  it('fails with insufficient edge cases', () => {
    const report = createSelfCritiqueReport('task-1', 'post-code', makeValidBugs(MIN_PREDICTED_BUGS), [makeIssue('x'.repeat(30))])
    const result = validateSelfCritique(report)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SELF_CRITIQUE_INSUFFICIENT')
  })

  it('fails with vague descriptions', () => {
    const vagueIssue = makeIssue('This might have issues with the overall system behavior during operations')
    const bugs = [...makeValidBugs(MIN_PREDICTED_BUGS - 1), vagueIssue]
    const report = createSelfCritiqueReport('task-1', 'post-code', bugs, makeValidEdgeCases(MIN_EDGE_CASES))
    const result = validateSelfCritique(report)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SELF_CRITIQUE_INSUFFICIENT')
  })

  it('passes with sufficient valid bugs and edge cases', () => {
    const report = createSelfCritiqueReport('task-1', 'post-code', makeValidBugs(MIN_PREDICTED_BUGS), makeValidEdgeCases(MIN_EDGE_CASES))
    const result = validateSelfCritique(report)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.overallPass).toBe(true)
  })
})

describe('requireSelfCritique', () => {
  it('fails when no report provided', () => {
    const result = requireSelfCritique(undefined)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SELF_CRITIQUE_MISSING')
  })

  it('delegates to validateSelfCritique when report present', () => {
    const report = createSelfCritiqueReport('task-1', 'post-code', makeValidBugs(MIN_PREDICTED_BUGS), makeValidEdgeCases(MIN_EDGE_CASES))
    const result = requireSelfCritique(report)
    expect(result.ok).toBe(true)
  })
})
