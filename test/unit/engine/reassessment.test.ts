import { describe, it, expect } from 'vitest'
import {
  shouldReassess,
  createReassessment,
  applyChanges,
  formatReassessmentReport,
} from '../../../src/engine/reassessment.js'
import type { PlanChange } from '../../../src/contracts/task.js'

describe('shouldReassess', () => {
  it('returns task-failed-2x for 2+ consecutive failures', () => {
    expect(shouldReassess(2, false)).toBe('task-failed-2x')
    expect(shouldReassess(5, false)).toBe('task-failed-2x')
  })

  it('returns new-contradicting-info when new info is true', () => {
    expect(shouldReassess(0, true)).toBe('new-contradicting-info')
  })

  it('returns null when no trigger conditions met', () => {
    expect(shouldReassess(0, false)).toBeNull()
    expect(shouldReassess(1, false)).toBeNull()
  })

  it('prioritizes failures over new info', () => {
    expect(shouldReassess(3, true)).toBe('task-failed-2x')
  })
})

describe('createReassessment', () => {
  it('creates result with changes', () => {
    const changes: PlanChange[] = [
      { type: 'add', taskId: 'T1', reason: 'needed' },
    ]
    const r = createReassessment('task-failed-2x', changes)
    expect(r.trigger).toBe('task-failed-2x')
    expect(r.planChanged).toBe(true)
    expect(r.changes).toHaveLength(1)
    expect(r.timestamp).toBeTruthy()
  })

  it('sets planChanged=false for empty changes', () => {
    const r = createReassessment('wave-complete', [])
    expect(r.planChanged).toBe(false)
  })

  it('generates ISO timestamp', () => {
    const r = createReassessment('budget-alert', [])
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('applyChanges', () => {
  it('removes tasks', () => {
    const changes: PlanChange[] = [{ type: 'remove', taskId: 'T2', reason: 'obsolete' }]
    const result = applyChanges(['T1', 'T2', 'T3'], changes)
    expect(result).toEqual(['T1', 'T3'])
  })

  it('adds tasks to end', () => {
    const changes: PlanChange[] = [{ type: 'add', taskId: 'T4', reason: 'new req' }]
    const result = applyChanges(['T1', 'T2'], changes)
    expect(result).toEqual(['T1', 'T2', 'T4'])
  })

  it('processes removals before additions', () => {
    const changes: PlanChange[] = [
      { type: 'add', taskId: 'T2-new', reason: 'replace' },
      { type: 'remove', taskId: 'T2', reason: 'obsolete' },
    ]
    const result = applyChanges(['T1', 'T2', 'T3'], changes)
    expect(result).toEqual(['T1', 'T3', 'T2-new'])
  })

  it('ignores reorder/modify changes', () => {
    const changes: PlanChange[] = [{ type: 'reorder', taskId: 'T1', reason: 'reprioritize' }]
    const result = applyChanges(['T1', 'T2'], changes)
    expect(result).toEqual(['T1', 'T2'])
  })

  it('handles empty task list', () => {
    const changes: PlanChange[] = [{ type: 'add', taskId: 'T1', reason: 'new' }]
    expect(applyChanges([], changes)).toEqual(['T1'])
  })
})

describe('formatReassessmentReport', () => {
  it('includes trigger and timestamp', () => {
    const r = createReassessment('task-failed-2x', [])
    const report = formatReassessmentReport(r)
    expect(report).toContain('task-failed-2x')
    expect(report).toContain('Reassessment Report')
  })

  it('shows no changes message for empty changes', () => {
    const r = createReassessment('wave-complete', [])
    expect(formatReassessmentReport(r)).toContain('No changes to the plan.')
  })

  it('lists changes with type and reason', () => {
    const changes: PlanChange[] = [
      { type: 'add', taskId: 'T5', reason: 'new requirement' },
    ]
    const r = createReassessment('new-contradicting-info', changes)
    const report = formatReassessmentReport(r)
    expect(report).toContain('ADD')
    expect(report).toContain('T5')
    expect(report).toContain('new requirement')
  })
})
