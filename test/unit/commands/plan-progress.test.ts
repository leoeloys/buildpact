/**
 * Unit tests for plan progress persistence (Story 5.5)
 * @see AC #2 — Pause on Human Steps
 * @see AC #5 — Progress Persistence
 */

import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProgress, saveProgress, isHumanStepPending } from '../../../src/commands/plan/progress.js'
import type { PlanProgress } from '../../../src/commands/plan/progress.js'

describe('loadProgress', () => {
  let tmpDir: string

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns null when progress.json does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-progress-'))
    const result = await loadProgress(tmpDir)
    expect(result).toBeNull()
  })

  it('returns parsed PlanProgress when file exists', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-progress-'))
    const progress: PlanProgress = {
      slug: 'test-spec',
      generatedAt: '2026-03-18T00:00:00Z',
      tasks: [
        { taskId: 't1', title: 'Task 1', executionType: 'AGENT', completed: true, completedAt: '2026-03-18T01:00:00Z' },
        { taskId: 't2', title: 'Task 2', executionType: 'HUMAN', completed: false },
      ],
    }
    await saveProgress(tmpDir, progress)

    const loaded = await loadProgress(tmpDir)
    expect(loaded).not.toBeNull()
    expect(loaded!.slug).toBe('test-spec')
    expect(loaded!.tasks).toHaveLength(2)
    expect(loaded!.tasks[0].completed).toBe(true)
    expect(loaded!.tasks[1].completed).toBe(false)
  })
})

describe('saveProgress', () => {
  let tmpDir: string

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  it('writes progress.json that can be round-tripped', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-progress-'))
    const progress: PlanProgress = {
      slug: 'roundtrip',
      generatedAt: '2026-03-18T00:00:00Z',
      tasks: [
        { taskId: 't1', title: 'Test task', executionType: 'AGENT', completed: false },
      ],
    }

    await saveProgress(tmpDir, progress)
    const loaded = await loadProgress(tmpDir)

    expect(loaded).toEqual(progress)
  })
})

describe('isHumanStepPending', () => {
  const progress: PlanProgress = {
    slug: 'test',
    generatedAt: '2026-03-18T00:00:00Z',
    tasks: [
      { taskId: 't1', title: 'Done task', executionType: 'HUMAN', completed: true },
      { taskId: 't2', title: 'Pending task', executionType: 'HUMAN', completed: false },
    ],
  }

  it('returns false for completed tasks', () => {
    expect(isHumanStepPending(progress, 't1')).toBe(false)
  })

  it('returns true for incomplete tasks', () => {
    expect(isHumanStepPending(progress, 't2')).toBe(true)
  })

  it('returns true for unknown task IDs', () => {
    expect(isHumanStepPending(progress, 'unknown')).toBe(true)
  })
})
