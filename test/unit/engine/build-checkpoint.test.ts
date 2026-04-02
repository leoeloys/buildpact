import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createBuildState,
  addCheckpoint,
  setCurrentTask,
  updateStatus,
  resumeFromCheckpoint,
  detectAbandoned,
  saveBuildState,
  loadBuildState,
} from '../../../src/engine/build-checkpoint.js'

describe('createBuildState', () => {
  it('creates state with correct defaults', () => {
    const s = createBuildState('SESSION-001', 10)
    expect(s.sessionId).toBe('SESSION-001')
    expect(s.status).toBe('PENDING')
    expect(s.completedTasks).toEqual([])
    expect(s.checkpoints).toEqual([])
    expect(s.metrics.totalTasks).toBe(10)
    expect(s.metrics.completedTasks).toBe(0)
    expect(s.metrics.totalCostUsd).toBe(0)
  })
})

describe('addCheckpoint', () => {
  it('adds checkpoint and updates metrics', () => {
    let s = createBuildState('S-001', 5)
    s = addCheckpoint(s, 'T-001', ['src/foo.ts'], 0.25)
    expect(s.status).toBe('IN_PROGRESS')
    expect(s.completedTasks).toEqual(['T-001'])
    expect(s.checkpoints).toHaveLength(1)
    expect(s.checkpoints[0]!.taskId).toBe('T-001')
    expect(s.checkpoints[0]!.costUsd).toBe(0.25)
    expect(s.metrics.completedTasks).toBe(1)
    expect(s.metrics.totalCostUsd).toBe(0.25)
  })

  it('accumulates across multiple checkpoints', () => {
    let s = createBuildState('S-001', 5)
    s = addCheckpoint(s, 'T-001', ['a.ts'], 0.10)
    s = addCheckpoint(s, 'T-002', ['b.ts'], 0.15)
    s = addCheckpoint(s, 'T-003', ['c.ts'], 0.20)
    expect(s.completedTasks).toEqual(['T-001', 'T-002', 'T-003'])
    expect(s.checkpoints).toHaveLength(3)
    expect(s.metrics.completedTasks).toBe(3)
    expect(s.metrics.totalCostUsd).toBeCloseTo(0.45)
  })
})

describe('setCurrentTask', () => {
  it('sets wave and task', () => {
    let s = createBuildState('S-001', 5)
    s = setCurrentTask(s, 2, 'T-005')
    expect(s.currentWave).toBe(2)
    expect(s.currentTask).toBe('T-005')
    expect(s.status).toBe('IN_PROGRESS')
  })
})

describe('updateStatus', () => {
  it('updates status', () => {
    let s = createBuildState('S-001', 5)
    s = updateStatus(s, 'PAUSED')
    expect(s.status).toBe('PAUSED')
    s = updateStatus(s, 'COMPLETED')
    expect(s.status).toBe('COMPLETED')
  })
})

describe('resumeFromCheckpoint', () => {
  it('returns correct resume point', () => {
    let s = createBuildState('S-001', 5)
    s = setCurrentTask(s, 1, 'T-003')
    s = addCheckpoint(s, 'T-001', [], 0.1)
    s = addCheckpoint(s, 'T-002', [], 0.1)
    const resume = resumeFromCheckpoint(s)
    expect(resume.nextWave).toBe(1)
    expect(resume.nextTaskIndex).toBe(2) // 2 completed
  })

  it('returns 0 for fresh state', () => {
    const s = createBuildState('S-001', 5)
    const resume = resumeFromCheckpoint(s)
    expect(resume.nextTaskIndex).toBe(0)
  })
})

describe('detectAbandoned', () => {
  it('returns false for active build', () => {
    const s = createBuildState('S-001', 5)
    expect(detectAbandoned(s)).toBe(false)
  })

  it('returns true for stale build', () => {
    const s = createBuildState('S-001', 5)
    s.lastCheckpoint = new Date(Date.now() - 4_000_000).toISOString() // >1h ago
    s.status = 'IN_PROGRESS'
    expect(detectAbandoned(s)).toBe(true)
  })

  it('returns false for completed build', () => {
    let s = createBuildState('S-001', 5)
    s = updateStatus(s, 'COMPLETED')
    s.lastCheckpoint = new Date(Date.now() - 4_000_000).toISOString()
    expect(detectAbandoned(s)).toBe(false)
  })

  it('respects custom threshold', () => {
    const s = createBuildState('S-001', 5)
    s.lastCheckpoint = new Date(Date.now() - 5000).toISOString()
    s.status = 'IN_PROGRESS'
    expect(detectAbandoned(s, 3000)).toBe(true)
    expect(detectAbandoned(s, 10000)).toBe(false)
  })
})

describe('saveBuildState / loadBuildState', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('round-trips state through disk', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-build-'))
    let s = createBuildState('S-001', 5)
    s = addCheckpoint(s, 'T-001', ['f.ts'], 0.3)

    const saveResult = await saveBuildState(tempDir, s)
    expect(saveResult.ok).toBe(true)

    const loadResult = await loadBuildState(tempDir)
    expect(loadResult.ok).toBe(true)
    if (loadResult.ok) {
      expect(loadResult.value.sessionId).toBe('S-001')
      expect(loadResult.value.checkpoints).toHaveLength(1)
      expect(loadResult.value.metrics.totalCostUsd).toBeCloseTo(0.3)
    }
  })

  it('returns error when no state file exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-build-'))
    const result = await loadBuildState(tempDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('BUILD_CHECKPOINT_CORRUPT')
  })
})
