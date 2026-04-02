import { describe, it, expect } from 'vitest'
import {
  createHeartbeatConfig,
  createHeartbeatRun,
  startRun,
  completeRun,
  failRun,
  isRunning,
} from '../../../src/engine/heartbeat-scheduler.js'

describe('createHeartbeatConfig', () => {
  it('creates config with provided values', () => {
    const config = createHeartbeatConfig('agent-1', '*/5 * * * *', 3)
    expect(config.agentId).toBe('agent-1')
    expect(config.schedule).toBe('*/5 * * * *')
    expect(config.maxConcurrentRuns).toBe(3)
    expect(config.enabled).toBe(true)
  })

  it('defaults maxConcurrentRuns to 1', () => {
    const config = createHeartbeatConfig('agent-1', '0 * * * *')
    expect(config.maxConcurrentRuns).toBe(1)
  })
})

describe('createHeartbeatRun', () => {
  it('creates a run in queued status', () => {
    const run = createHeartbeatRun('agent-1', 'schedule')
    expect(run.id).toMatch(/^HBR-/)
    expect(run.agentId).toBe('agent-1')
    expect(run.trigger).toBe('schedule')
    expect(run.status).toBe('queued')
    expect(run.finishedAt).toBeNull()
    expect(run.summary).toBeNull()
  })

  it('generates unique IDs', () => {
    const a = createHeartbeatRun('agent-1', 'schedule')
    const b = createHeartbeatRun('agent-1', 'schedule')
    expect(a.id).not.toBe(b.id)
  })
})

describe('startRun', () => {
  it('transitions to running status', () => {
    const run = createHeartbeatRun('agent-1', 'event')
    const started = startRun(run)
    expect(started.status).toBe('running')
    expect(started.startedAt).toBeTruthy()
  })
})

describe('completeRun', () => {
  it('transitions to completed with summary', () => {
    const run = startRun(createHeartbeatRun('agent-1', 'schedule'))
    const completed = completeRun(run, 'All tasks done')
    expect(completed.status).toBe('completed')
    expect(completed.summary).toBe('All tasks done')
    expect(completed.finishedAt).toBeTruthy()
  })
})

describe('failRun', () => {
  it('transitions to failed with error', () => {
    const run = startRun(createHeartbeatRun('agent-1', 'schedule'))
    const failed = failRun(run, 'Timeout exceeded')
    expect(failed.status).toBe('failed')
    expect(failed.summary).toBe('Timeout exceeded')
    expect(failed.finishedAt).toBeTruthy()
  })
})

describe('isRunning', () => {
  it('returns true when any run is running', () => {
    const runs = [
      completeRun(startRun(createHeartbeatRun('a', 'schedule')), 'done'),
      startRun(createHeartbeatRun('b', 'event')),
    ]
    expect(isRunning(runs)).toBe(true)
  })

  it('returns false when no runs are running', () => {
    const runs = [
      completeRun(startRun(createHeartbeatRun('a', 'schedule')), 'done'),
      failRun(startRun(createHeartbeatRun('b', 'event')), 'err'),
    ]
    expect(isRunning(runs)).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(isRunning([])).toBe(false)
  })
})
