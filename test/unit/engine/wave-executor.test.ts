import { describe, it, expect } from 'vitest'
import {
  buildSubagentContext,
  executeTaskStub,
  executeWave,
  executeWaves,
  parseWaveTasksFromPlanFile,
} from '../../../src/engine/wave-executor.js'
import type { WaveTask } from '../../../src/engine/wave-executor.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const opts = (overrides?: Partial<WaveTask>): WaveTask => ({
  taskId: 'task-1',
  title: 'Implement login form',
  waveNumber: 0,
  planContent: '## Tasks\n- [ ] [AGENT] Implement login form',
  ...overrides,
})

// ---------------------------------------------------------------------------
// buildSubagentContext
// ---------------------------------------------------------------------------

describe('buildSubagentContext', () => {
  it('produces payload with execute type', () => {
    const payload = buildSubagentContext(opts())
    expect(payload.type).toBe('execute')
  })

  it('includes task title in content', () => {
    const payload = buildSubagentContext(opts({ title: 'Setup database schema' }))
    expect(payload.content).toContain('Setup database schema')
  })

  it('includes plan content in payload', () => {
    const payload = buildSubagentContext(opts({ planContent: '## Tasks\n- [ ] [AGENT] Do thing' }))
    expect(payload.content).toContain('Do thing')
  })

  it('includes codebase context when provided', () => {
    const payload = buildSubagentContext(opts({ codebaseContext: 'src/auth/login.ts line 42' }))
    expect(payload.content).toContain('Codebase Context')
    expect(payload.content).toContain('src/auth/login.ts line 42')
  })

  it('omits codebase context section when not provided', () => {
    const payload = buildSubagentContext(opts())
    expect(payload.content).not.toContain('Codebase Context')
  })

  it('includes constitutionPath when provided', () => {
    const payload = buildSubagentContext(opts({ constitutionPath: '/proj/.buildpact/constitution.md' }))
    expect(payload.constitutionPath).toBe('/proj/.buildpact/constitution.md')
  })

  it('omits constitutionPath when not provided', () => {
    const payload = buildSubagentContext(opts())
    expect(payload.constitutionPath).toBeUndefined()
  })

  it('includes budgetUsd when provided', () => {
    const payload = buildSubagentContext(opts({ budgetUsd: 0.25 }))
    expect(payload.budgetUsd).toBe(0.25)
  })

  it('generates a unique taskId per payload', () => {
    const a = buildSubagentContext(opts())
    const b = buildSubagentContext(opts())
    expect(a.taskId).not.toBe(b.taskId)
  })
})

// ---------------------------------------------------------------------------
// executeTaskStub
// ---------------------------------------------------------------------------

describe('executeTaskStub', () => {
  it('returns success for a normal task', () => {
    const result = executeTaskStub(opts())
    expect(result.success).toBe(true)
    expect(result.taskId).toBe('task-1')
    expect(result.title).toBe('Implement login form')
    expect(result.waveNumber).toBe(0)
    expect(result.artifacts).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('returns failure for oversized payload', () => {
    // 30KB of content — will exceed 20KB limit
    const hugeContent = 'x'.repeat(30 * 1024)
    const result = executeTaskStub(opts({ planContent: hugeContent }))
    expect(result.success).toBe(false)
    expect(result.error).toContain('PAYLOAD_TOO_LARGE')
  })

  it('preserves wave number in result', () => {
    const result = executeTaskStub(opts({ waveNumber: 2 }))
    expect(result.waveNumber).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// executeWave
// ---------------------------------------------------------------------------

describe('executeWave', () => {
  it('returns empty result with allSucceeded=true for empty task list', () => {
    const result = executeWave([])
    expect(result.allSucceeded).toBe(true)
    expect(result.tasks).toEqual([])
  })

  it('executes all tasks and returns results for each', () => {
    const tasks: WaveTask[] = [
      opts({ taskId: 'a', title: 'Task A', waveNumber: 0 }),
      opts({ taskId: 'b', title: 'Task B', waveNumber: 0 }),
      opts({ taskId: 'c', title: 'Task C', waveNumber: 0 }),
    ]
    const result = executeWave(tasks)
    expect(result.tasks).toHaveLength(3)
    expect(result.allSucceeded).toBe(true)
    expect(result.tasks.map(t => t.title)).toEqual(['Task A', 'Task B', 'Task C'])
  })

  it('sets allSucceeded=false when any task fails', () => {
    const tasks: WaveTask[] = [
      opts({ taskId: 'ok', title: 'OK task', waveNumber: 1, planContent: 'small' }),
      opts({ taskId: 'fail', title: 'Fail task', waveNumber: 1, planContent: 'x'.repeat(30 * 1024) }),
    ]
    const result = executeWave(tasks)
    expect(result.allSucceeded).toBe(false)
    expect(result.tasks.find(t => t.taskId === 'ok')?.success).toBe(true)
    expect(result.tasks.find(t => t.taskId === 'fail')?.success).toBe(false)
  })

  it('uses wave number from the first task', () => {
    const tasks: WaveTask[] = [opts({ waveNumber: 3 })]
    const result = executeWave(tasks)
    expect(result.waveNumber).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// executeWaves
// ---------------------------------------------------------------------------

describe('executeWaves', () => {
  it('returns ok with empty array when no waves provided', () => {
    const result = executeWaves([])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual([])
  })

  it('executes all waves and returns results in order', () => {
    const wave0: WaveTask[] = [opts({ taskId: 'w0-t1', waveNumber: 0 })]
    const wave1: WaveTask[] = [opts({ taskId: 'w1-t1', waveNumber: 1 })]
    const result = executeWaves([wave0, wave1])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(2)
      expect(result.value[0]!.waveNumber).toBe(0)
      expect(result.value[1]!.waveNumber).toBe(1)
    }
  })

  it('halts on first wave failure by default and returns err', () => {
    const failingWave: WaveTask[] = [
      opts({ taskId: 'fail', planContent: 'x'.repeat(30 * 1024), waveNumber: 0 }),
    ]
    const nextWave: WaveTask[] = [opts({ taskId: 'next', waveNumber: 1 })]
    const result = executeWaves([failingWave, nextWave])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_IMPLEMENTED')
      expect(result.error.params?.['wave']).toBe('1')
    }
  })

  it('continues through failures when haltOnFailure=false', () => {
    const failingWave: WaveTask[] = [
      opts({ taskId: 'fail', planContent: 'x'.repeat(30 * 1024), waveNumber: 0 }),
    ]
    const nextWave: WaveTask[] = [opts({ taskId: 'next', waveNumber: 1 })]
    const result = executeWaves([failingWave, nextWave], false)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(2)
      expect(result.value[0]!.allSucceeded).toBe(false)
      expect(result.value[1]!.allSucceeded).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// parseWaveTasksFromPlanFile
// ---------------------------------------------------------------------------

describe('parseWaveTasksFromPlanFile', () => {
  const planContent = [
    '# Plan — my-feature — Wave 1',
    '',
    '## Tasks',
    '',
    '- [ ] [AGENT] Implement auth module',
    '- [ ] [AGENT] Write unit tests',
    '- [ ] [HUMAN] Review with team',
    '- [ ] [AGENT] Deploy to staging _(after: T2)_',
  ].join('\n')

  it('extracts all AGENT and HUMAN tasks', () => {
    const tasks = parseWaveTasksFromPlanFile(planContent, 0)
    expect(tasks).toHaveLength(4)
  })

  it('sets correct wave number for all tasks', () => {
    const tasks = parseWaveTasksFromPlanFile(planContent, 2)
    expect(tasks.every(t => t.waveNumber === 2)).toBe(true)
  })

  it('strips dependency annotation from task title', () => {
    const tasks = parseWaveTasksFromPlanFile(planContent, 0)
    const deployTask = tasks.find(t => t.title.includes('Deploy'))
    expect(deployTask?.title).toBe('Deploy to staging')
    expect(deployTask?.title).not.toContain('_(after:')
  })

  it('includes plan content in each task', () => {
    const tasks = parseWaveTasksFromPlanFile(planContent, 0)
    expect(tasks.every(t => t.planContent === planContent)).toBe(true)
  })

  it('includes constitutionPath when provided', () => {
    const tasks = parseWaveTasksFromPlanFile(planContent, 0, '/proj/.buildpact/constitution.md')
    expect(tasks.every(t => t.constitutionPath === '/proj/.buildpact/constitution.md')).toBe(true)
  })

  it('omits constitutionPath when not provided', () => {
    const tasks = parseWaveTasksFromPlanFile(planContent, 0)
    expect(tasks.every(t => t.constitutionPath === undefined)).toBe(true)
  })

  it('generates unique taskIds for each task', () => {
    const tasks = parseWaveTasksFromPlanFile(planContent, 0)
    const ids = tasks.map(t => t.taskId)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('returns empty array for plan with no task lines', () => {
    const emptyPlan = '# Plan\n\n## Key References\n\n- `TypeScript`'
    const tasks = parseWaveTasksFromPlanFile(emptyPlan, 0)
    expect(tasks).toHaveLength(0)
  })
})
