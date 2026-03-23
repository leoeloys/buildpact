import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  checkpoint,
  loadState,
  clearState,
  type AgentState,
} from '../../../src/engine/state-persistence.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tmpDirs: string[] = []

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'bp-state-test-'))
  tmpDirs.push(dir)
  return dir
}

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    version: 1,
    supervisorPid: process.pid,
    startedAt: '2026-03-23T10:00:00.000Z',
    lastCheckpoint: new Date().toISOString(),
    completedTasks: ['task-1', 'task-2'],
    pendingTasks: ['task-3'],
    currentWave: 2,
    totalCostUsd: 0.42,
    customData: { key: 'value' },
    ...overrides,
  }
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
  tmpDirs.length = 0
})

// ---------------------------------------------------------------------------
// checkpoint
// ---------------------------------------------------------------------------

describe('checkpoint', () => {
  it('writes state file atomically', async () => {
    const dir = await makeTmpDir()
    const state = makeState()
    const result = await checkpoint(dir, state)

    expect(result.ok).toBe(true)
    expect(existsSync(join(dir, 'agent-state.json'))).toBe(true)
  })

  it('creates directory if it does not exist', async () => {
    const dir = await makeTmpDir()
    const nested = join(dir, 'sub', 'dir')
    const state = makeState()
    const result = await checkpoint(nested, state)

    expect(result.ok).toBe(true)
    expect(existsSync(join(nested, 'agent-state.json'))).toBe(true)
  })

  it('leaves no temp files after successful write', async () => {
    const dir = await makeTmpDir()
    await checkpoint(dir, makeState())

    const { readdir } = await import('node:fs/promises')
    const files = await readdir(dir)
    const tmpFiles = files.filter(f => f.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// loadState
// ---------------------------------------------------------------------------

describe('loadState', () => {
  it('returns null when no file exists', async () => {
    const dir = await makeTmpDir()
    const result = await loadState(dir)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeNull()
    }
  })

  it('recovers state from checkpoint', async () => {
    const dir = await makeTmpDir()
    const state = makeState()
    await checkpoint(dir, state)

    const result = await loadState(dir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).not.toBeNull()
      expect(result.value?.version).toBe(1)
      expect(result.value?.supervisorPid).toBe(process.pid)
      expect(result.value?.completedTasks).toEqual(['task-1', 'task-2'])
    }
  })
})

// ---------------------------------------------------------------------------
// clearState
// ---------------------------------------------------------------------------

describe('clearState', () => {
  it('removes state file', async () => {
    const dir = await makeTmpDir()
    await checkpoint(dir, makeState())
    expect(existsSync(join(dir, 'agent-state.json'))).toBe(true)

    const result = await clearState(dir)
    expect(result.ok).toBe(true)
    expect(existsSync(join(dir, 'agent-state.json'))).toBe(false)
  })

  it('succeeds when no file exists', async () => {
    const dir = await makeTmpDir()
    const result = await clearState(dir)
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('checkpoint then load preserves all data', async () => {
    const dir = await makeTmpDir()
    const original = makeState({
      completedTasks: ['a', 'b', 'c'],
      pendingTasks: ['d', 'e'],
      currentWave: 5,
      totalCostUsd: 1.2345,
      customData: { nested: { deep: true }, arr: [1, 2, 3] },
    })

    await checkpoint(dir, original)
    const result = await loadState(dir)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(original)
    }
  })

  it('overwriting checkpoint replaces previous state', async () => {
    const dir = await makeTmpDir()

    await checkpoint(dir, makeState({ currentWave: 1 }))
    await checkpoint(dir, makeState({ currentWave: 2 }))

    const result = await loadState(dir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value?.currentWave).toBe(2)
    }
  })
})
