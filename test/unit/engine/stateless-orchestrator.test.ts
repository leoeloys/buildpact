import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  parseStateContent,
  formatStateContent,
  readPipelineState,
  writePipelineState,
  orchestratorCycle,
} from '../../../src/engine/stateless-orchestrator.js'
import type { PipelineState } from '../../../src/engine/stateless-orchestrator.js'

const baseState: PipelineState = {
  phase: 'execute',
  waveNumber: 2,
  taskIndex: 3,
  totalTasks: 5,
  totalWaves: 4,
  paused: false,
}

describe('parseStateContent', () => {
  it('parses all fields from STATE.md content', () => {
    const content = [
      '# Pipeline State',
      '',
      'phase: execute',
      'wave: 2',
      'task: 3',
      'totalTasks: 5',
      'totalWaves: 4',
      'paused: false',
      'lastCompleted: T-007',
    ].join('\n')

    const state = parseStateContent(content)
    expect(state.phase).toBe('execute')
    expect(state.waveNumber).toBe(2)
    expect(state.taskIndex).toBe(3)
    expect(state.totalTasks).toBe(5)
    expect(state.totalWaves).toBe(4)
    expect(state.paused).toBe(false)
    expect(state.lastCompletedTask).toBe('T-007')
  })

  it('parses goal ancestry fields', () => {
    const content = [
      'phase: specify',
      'wave: 0',
      'task: 0',
      'totalTasks: 0',
      'totalWaves: 0',
      'paused: false',
      'mission: Build the best CLI',
      'projectGoal: Ship v1.0',
    ].join('\n')

    const state = parseStateContent(content)
    expect(state.goalAncestry).toBeDefined()
    expect(state.goalAncestry!.mission).toBe('Build the best CLI')
    expect(state.goalAncestry!.projectGoal).toBe('Ship v1.0')
  })

  it('defaults to specify phase when empty', () => {
    const state = parseStateContent('')
    expect(state.phase).toBe('specify')
    expect(state.waveNumber).toBe(0)
    expect(state.paused).toBe(false)
  })

  it('handles paused state', () => {
    const content = 'phase: execute\nwave: 1\ntask: 0\ntotalTasks: 3\ntotalWaves: 2\npaused: true\npauseReason: Budget exceeded'
    const state = parseStateContent(content)
    expect(state.paused).toBe(true)
    expect(state.pauseReason).toBe('Budget exceeded')
  })
})

describe('formatStateContent', () => {
  it('round-trips through parse', () => {
    const formatted = formatStateContent(baseState)
    const parsed = parseStateContent(formatted)
    expect(parsed.phase).toBe(baseState.phase)
    expect(parsed.waveNumber).toBe(baseState.waveNumber)
    expect(parsed.taskIndex).toBe(baseState.taskIndex)
    expect(parsed.totalTasks).toBe(baseState.totalTasks)
    expect(parsed.totalWaves).toBe(baseState.totalWaves)
    expect(parsed.paused).toBe(baseState.paused)
  })

  it('includes updated timestamp', () => {
    const formatted = formatStateContent(baseState)
    expect(formatted).toContain('updated:')
  })

  it('includes pauseReason when paused', () => {
    const formatted = formatStateContent({ ...baseState, paused: true, pauseReason: 'Budget exceeded' })
    expect(formatted).toContain('pauseReason: Budget exceeded')
  })

  it('includes goal ancestry when present', () => {
    const formatted = formatStateContent({
      ...baseState,
      goalAncestry: { mission: 'M', projectGoal: 'P', phaseGoal: 'Ph', taskObjective: 'T' },
    })
    expect(formatted).toContain('mission: M')
    expect(formatted).toContain('projectGoal: P')
  })
})

describe('readPipelineState / writePipelineState', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true })
  })

  it('writes and reads state round-trip', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-orch-'))
    const writeResult = await writePipelineState(tempDir, baseState)
    expect(writeResult.ok).toBe(true)

    const readResult = await readPipelineState(tempDir)
    expect(readResult.ok).toBe(true)
    if (readResult.ok) {
      expect(readResult.value.phase).toBe('execute')
      expect(readResult.value.waveNumber).toBe(2)
    }
  })

  it('returns error when STATE.md does not exist', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-orch-'))
    const result = await readPipelineState(tempDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('ORCHESTRATOR_STATE_READ_FAILED')
  })

  it('rejects state that exceeds MAX_STATE_LINES', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-orch-'))
    const bloatedState: PipelineState = {
      ...baseState,
      pauseReason: Array(60).fill('line').join('\n'),
    }
    const result = await writePipelineState(tempDir, bloatedState)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('ORCHESTRATOR_CONTEXT_POLLUTION')
  })
})

describe('orchestratorCycle', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true })
  })

  it('returns paused when state is paused', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-orch-'))
    await writePipelineState(tempDir, { ...baseState, paused: true, pauseReason: 'Budget' })

    const result = await orchestratorCycle(tempDir, () => ({ action: 'dispatch' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.action).toBe('paused')
      expect(result.value.reason).toContain('Budget')
    }
  })

  it('calls decide function with current state', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-orch-'))
    await writePipelineState(tempDir, baseState)

    let capturedPhase = ''
    await orchestratorCycle(tempDir, (state) => {
      capturedPhase = state.phase
      return { action: 'complete' }
    })
    expect(capturedPhase).toBe('execute')
  })

  it('returns error when state cannot be read', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-orch-'))
    // No STATE.md written
    const result = await orchestratorCycle(tempDir, () => ({ action: 'dispatch' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.action).toBe('error')
  })
})
