import { describe, it, expect } from 'vitest'
import {
  WaveProgressRenderer,
  formatElapsed,
} from '../../../src/engine/progress-renderer.js'
import type { TuiAdapter } from '../../../src/engine/progress-renderer.js'
import type { TaskExecutionResult, WaveExecutionResult } from '../../../src/engine/wave-executor.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockTui() {
  const calls: { method: string; msg: string }[] = []
  const spinnerInstance = {
    start: (msg: string) => calls.push({ method: 'spinner.start', msg }),
    stop: (msg: string) => calls.push({ method: 'spinner.stop', msg }),
    message: (msg: string) => calls.push({ method: 'spinner.message', msg }),
  }
  const tui: TuiAdapter = {
    spinner: () => spinnerInstance,
    log: {
      step: (msg: string) => calls.push({ method: 'log.step', msg }),
      info: (msg: string) => calls.push({ method: 'log.info', msg }),
      success: (msg: string) => calls.push({ method: 'log.success', msg }),
      error: (msg: string) => calls.push({ method: 'log.error', msg }),
      warn: (msg: string) => calls.push({ method: 'log.warn', msg }),
    },
  }
  return { tui, calls }
}

const taskResult = (overrides?: Partial<TaskExecutionResult>): TaskExecutionResult => ({
  taskId: 'task-1',
  title: 'Build auth module',
  waveNumber: 0,
  success: true,
  artifacts: [],
  ...overrides,
})

const waveResult = (overrides?: Partial<WaveExecutionResult>): WaveExecutionResult => ({
  waveNumber: 0,
  tasks: [taskResult()],
  allSucceeded: true,
  ...overrides,
})

// ---------------------------------------------------------------------------
// formatElapsed
// ---------------------------------------------------------------------------

describe('formatElapsed', () => {
  it('formats milliseconds', () => {
    expect(formatElapsed(500)).toBe('500ms')
  })

  it('formats seconds', () => {
    expect(formatElapsed(1500)).toBe('1.5s')
    expect(formatElapsed(45300)).toBe('45.3s')
  })

  it('formats minutes and seconds', () => {
    expect(formatElapsed(135000)).toBe('2m 15s')
  })
})

// ---------------------------------------------------------------------------
// WaveProgressRenderer
// ---------------------------------------------------------------------------

describe('WaveProgressRenderer', () => {
  it('logs wave header on startWave', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 3, 5)

    const stepCall = calls.find(c => c.method === 'log.step')
    expect(stepCall).toBeDefined()
    expect(stepCall!.msg).toContain('Wave 1/3')
    expect(stepCall!.msg).toContain('5 task(s)')
  })

  it('starts spinner on startWave', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 2, 3)

    const spinnerStart = calls.find(c => c.method === 'spinner.start')
    expect(spinnerStart).toBeDefined()
  })

  it('updates spinner message on startTask', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 1, 2)
    renderer.startTask('t1', 'Build login')

    const msgCalls = calls.filter(c => c.method === 'spinner.message')
    expect(msgCalls.length).toBeGreaterThan(0)
    expect(msgCalls.at(-1)!.msg).toContain('Build login')
  })

  it('updates spinner message on completeTask (success)', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 1, 2)
    renderer.startTask('t1', 'Build login')
    renderer.completeTask('t1', taskResult({ taskId: 't1', title: 'Build login' }))

    const msgCalls = calls.filter(c => c.method === 'spinner.message')
    const lastMsg = msgCalls.at(-1)?.msg ?? ''
    expect(lastMsg).toContain('1/2 done')
  })

  it('logs error on completeTask (failure)', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 1, 1)
    renderer.startTask('t1', 'Failing task')
    renderer.completeTask('t1', taskResult({
      taskId: 't1',
      title: 'Failing task',
      success: false,
      error: 'API error',
    }))

    const errorCall = calls.find(c => c.method === 'log.error')
    expect(errorCall).toBeDefined()
    expect(errorCall!.msg).toContain('Failing task')
    expect(errorCall!.msg).toContain('API error')
  })

  it('shows wave summary on endWave', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 2, 1)
    renderer.endWave(0, waveResult())

    const stopCall = calls.find(c => c.method === 'spinner.stop' && c.msg.includes('Wave 1 complete'))
    expect(stopCall).toBeDefined()
    expect(stopCall!.msg).toContain('1/1 tasks passed')
  })

  it('warns about failures on endWave', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 1, 2)
    renderer.endWave(0, waveResult({
      tasks: [
        taskResult({ success: true }),
        taskResult({ success: false, error: 'fail' }),
      ],
      allSucceeded: false,
    }))

    const warnCall = calls.find(c => c.method === 'log.warn')
    expect(warnCall).toBeDefined()
    expect(warnCall!.msg).toContain('1 task(s) failed')
  })

  it('includes cost in wave summary when available', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 1, 1)
    renderer.startTask('t1', 'Costly task')
    renderer.completeTask('t1', taskResult({ costUsd: 0.05 }))
    renderer.endWave(0, waveResult({ tasks: [taskResult({ costUsd: 0.05 })] }))

    const stopCall = calls.find(c => c.method === 'spinner.stop' && c.msg.includes('$'))
    expect(stopCall).toBeDefined()
  })

  it('tracks total cost across waves', () => {
    const { tui } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 2, 1)
    renderer.startTask('t1', 'Task 1')
    renderer.completeTask('t1', taskResult({ costUsd: 0.03 }))
    renderer.endWave(0, waveResult())

    renderer.startWave(1, 2, 1)
    renderer.startTask('t2', 'Task 2')
    renderer.completeTask('t2', taskResult({ costUsd: 0.05 }))
    renderer.endWave(1, waveResult({ waveNumber: 1 }))

    expect(renderer.getTotalCostUsd()).toBeCloseTo(0.08)
  })

  it('pauseAll stops spinner', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 1, 1)
    renderer.pauseAll()

    const stopCall = calls.find(c => c.method === 'spinner.stop' && c.msg.includes('Paused'))
    expect(stopCall).toBeDefined()
  })

  it('resumeAll restarts spinner when tasks are running', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 1, 1)
    renderer.startTask('t1', 'Task')
    renderer.pauseAll()
    renderer.resumeAll()

    const restartCalls = calls.filter(c => c.method === 'spinner.start')
    // First start + resume start
    expect(restartCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('no active spinners during pause (for confirmation prompts)', () => {
    const { tui, calls } = mockTui()
    const renderer = new WaveProgressRenderer(tui)

    renderer.startWave(0, 1, 1)
    renderer.startTask('t1', 'Task')
    renderer.pauseAll()

    // After pauseAll, the last spinner action should be stop
    const lastSpinnerCall = [...calls].reverse().find(
      c => c.method === 'spinner.start' || c.method === 'spinner.stop',
    )
    expect(lastSpinnerCall?.method).toBe('spinner.stop')
  })
})
