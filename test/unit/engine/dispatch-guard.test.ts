import { describe, it, expect } from 'vitest'
import {
  checkWavePrerequisites,
  checkTaskPrerequisites,
  formatGuardResult,
} from '../../../src/engine/dispatch-guard.js'
import type { BuildState } from '../../../src/contracts/task.js'

function makeBuildState(overrides: Partial<BuildState> = {}): BuildState {
  return {
    sessionId: 'sess-1',
    status: 'IN_PROGRESS',
    startedAt: new Date().toISOString(),
    lastCheckpoint: new Date().toISOString(),
    currentWave: 0,
    currentTask: 'task-1',
    completedTasks: [],
    checkpoints: [],
    metrics: { totalTasks: 5, completedTasks: 0, failedTasks: 0, totalCostUsd: 0 },
    ...overrides,
  } as BuildState
}

describe('checkWavePrerequisites', () => {
  it('blocks when task already completed', () => {
    const state = makeBuildState({ completedTasks: ['task-1'] })
    const result = checkWavePrerequisites(state, 0, 'task-1')
    expect(result.allowed).toBe(false)
    expect(result.blockedBy.some(b => b.includes('already completed'))).toBe(true)
  })

  it('blocks when build is FAILED', () => {
    const state = makeBuildState({ status: 'FAILED' as any })
    const result = checkWavePrerequisites(state, 0, 'task-2')
    expect(result.allowed).toBe(false)
    expect(result.blockedBy.some(b => b.includes('FAILED'))).toBe(true)
  })

  it('blocks when build is PAUSED', () => {
    const state = makeBuildState({ status: 'PAUSED' as any })
    const result = checkWavePrerequisites(state, 0, 'task-2')
    expect(result.allowed).toBe(false)
    expect(result.blockedBy.some(b => b.includes('PAUSED'))).toBe(true)
  })

  it('allows when no blockers', () => {
    const state = makeBuildState()
    const result = checkWavePrerequisites(state, 0, 'task-2')
    expect(result.allowed).toBe(true)
  })
})

describe('checkTaskPrerequisites', () => {
  it('blocks when prerequisites not completed', () => {
    const result = checkTaskPrerequisites(['task-1'], ['task-1', 'task-2'])
    expect(result.allowed).toBe(false)
    expect(result.missingPrerequisites.some(m => m.includes('task-2'))).toBe(true)
  })

  it('allows when all prerequisites completed', () => {
    const result = checkTaskPrerequisites(['task-1', 'task-2'], ['task-1', 'task-2'])
    expect(result.allowed).toBe(true)
    expect(result.missingPrerequisites).toEqual([])
  })
})

describe('formatGuardResult', () => {
  it('formats allowed result', () => {
    const text = formatGuardResult({ allowed: true, blockedBy: [], missingPrerequisites: [] })
    expect(text).toContain('allowed')
  })

  it('formats blocked result with reasons', () => {
    const text = formatGuardResult({ allowed: false, blockedBy: ['Build is FAILED'], missingPrerequisites: ['task-3 not completed'] })
    expect(text).toContain('BLOCKED')
    expect(text).toContain('FAILED')
  })
})
