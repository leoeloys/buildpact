import { describe, it, expect, vi } from 'vitest'
import {
  selectNextStrategy,
  isStuckLoop,
  buildFailureSummary,
  handleTaskFailure,
  createRecoverySession,
  executeRollback,
} from '../../../src/engine/recovery.js'
import type { TaskFailure, RecoverySession } from '../../../src/engine/recovery.js'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => 'abc1234567890\n'),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const failure = (overrides?: Partial<TaskFailure>): TaskFailure => ({
  taskId: 'task-1',
  taskTitle: 'Implement login',
  strategy: 'retry',
  attemptNumber: 0,
  error: 'TypeScript compilation failed',
  ...overrides,
})

const session = (overrides?: Partial<RecoverySession>): RecoverySession => ({
  lastGoodCommitRef: 'abc1234',
  failures: [],
  ...overrides,
})

// ---------------------------------------------------------------------------
// selectNextStrategy
// ---------------------------------------------------------------------------

describe('selectNextStrategy', () => {
  it('returns retry for attempt 0', () => {
    expect(selectNextStrategy(0)).toBe('retry')
  })

  it('returns simplify for attempt 1', () => {
    expect(selectNextStrategy(1)).toBe('simplify')
  })

  it('returns skip for attempt 2', () => {
    expect(selectNextStrategy(2)).toBe('skip')
  })

  it('returns undefined for attempt 3 (exhausted)', () => {
    expect(selectNextStrategy(3)).toBeUndefined()
  })

  it('returns undefined for attempt numbers beyond 3', () => {
    expect(selectNextStrategy(10)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// isStuckLoop
// ---------------------------------------------------------------------------

describe('isStuckLoop', () => {
  it('returns false when fewer than 2 failures for task', () => {
    const failures = [failure({ taskId: 'task-1', error: 'Timeout' })]
    expect(isStuckLoop(failures, 'task-1')).toBe(false)
  })

  it('returns true when last 2 failures have identical errors', () => {
    const failures = [
      failure({ taskId: 'task-1', error: 'Timeout', attemptNumber: 0 }),
      failure({ taskId: 'task-1', error: 'Timeout', attemptNumber: 1 }),
    ]
    expect(isStuckLoop(failures, 'task-1')).toBe(true)
  })

  it('returns false when last 2 failures have different errors', () => {
    const failures = [
      failure({ taskId: 'task-1', error: 'Timeout', attemptNumber: 0 }),
      failure({ taskId: 'task-1', error: 'Compilation error', attemptNumber: 1 }),
    ]
    expect(isStuckLoop(failures, 'task-1')).toBe(false)
  })

  it('only considers failures for the specified taskId', () => {
    const failures = [
      failure({ taskId: 'task-2', error: 'Same error', attemptNumber: 0 }),
      failure({ taskId: 'task-2', error: 'Same error', attemptNumber: 1 }),
      failure({ taskId: 'task-1', error: 'Different', attemptNumber: 0 }),
    ]
    expect(isStuckLoop(failures, 'task-1')).toBe(false)
    expect(isStuckLoop(failures, 'task-2')).toBe(true)
  })

  it('returns false for empty failures', () => {
    expect(isStuckLoop([], 'task-1')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildFailureSummary
// ---------------------------------------------------------------------------

describe('buildFailureSummary', () => {
  it('returns a default message for empty failures', () => {
    const summary = buildFailureSummary([])
    expect(summary).toBe('No failures recorded.')
  })

  it('includes failure count in summary header', () => {
    const failures = [
      failure({ attemptNumber: 0, strategy: 'retry' }),
      failure({ attemptNumber: 1, strategy: 'simplify' }),
    ]
    const summary = buildFailureSummary(failures)
    expect(summary).toContain('2 recovery attempt(s) failed')
  })

  it('includes task title in summary', () => {
    const failures = [failure({ taskTitle: 'Build auth module', attemptNumber: 0 })]
    const summary = buildFailureSummary(failures)
    expect(summary).toContain('Build auth module')
  })

  it('includes error message in summary', () => {
    const failures = [failure({ error: 'Module not found: ./auth', attemptNumber: 0 })]
    const summary = buildFailureSummary(failures)
    expect(summary).toContain('Module not found: ./auth')
  })

  it('includes strategy used for each attempt', () => {
    const failures = [
      failure({ strategy: 'retry', attemptNumber: 0 }),
      failure({ strategy: 'simplify', attemptNumber: 1 }),
    ]
    const summary = buildFailureSummary(failures)
    expect(summary).toContain('[retry]')
    expect(summary).toContain('[simplify]')
  })

  it('includes next steps section', () => {
    const failures = [failure()]
    const summary = buildFailureSummary(failures)
    expect(summary).toContain('Next Steps')
    expect(summary).toContain('Re-run')
  })

  it('groups failures by taskId', () => {
    const failures = [
      failure({ taskId: 'task-1', taskTitle: 'Task A', attemptNumber: 0 }),
      failure({ taskId: 'task-2', taskTitle: 'Task B', attemptNumber: 0 }),
    ]
    const summary = buildFailureSummary(failures)
    expect(summary).toContain('Task A')
    expect(summary).toContain('Task B')
  })
})

// ---------------------------------------------------------------------------
// handleTaskFailure
// ---------------------------------------------------------------------------

describe('handleTaskFailure', () => {
  it('records the failure and returns retry strategy for first attempt', () => {
    const { session: newSession, recovery } = handleTaskFailure(
      session(),
      'task-1',
      'Implement login',
      'Compilation failed',
    )
    expect(newSession.failures).toHaveLength(1)
    expect(newSession.failures[0]!.strategy).toBe('retry')
    expect(recovery.recovered).toBe(true)
    expect(recovery.nextStrategy).toBe('simplify')
  })

  it('advances to simplify strategy after first failure', () => {
    const s = session({
      failures: [failure({ taskId: 'task-1', attemptNumber: 0, strategy: 'retry' })],
    })
    const { recovery } = handleTaskFailure(s, 'task-1', 'Implement login', 'Still failing')
    expect(recovery.recovered).toBe(true)
    expect(recovery.nextStrategy).toBe('skip')
  })

  it('escalates after 3 failures for the same task', () => {
    const s = session({
      failures: [
        failure({ taskId: 'task-1', attemptNumber: 0, strategy: 'retry' }),
        failure({ taskId: 'task-1', attemptNumber: 1, strategy: 'simplify' }),
      ],
    })
    const { recovery } = handleTaskFailure(s, 'task-1', 'Implement login', 'Still failing')
    expect(recovery.recovered).toBe(false)
    expect(recovery.rolledBack).toBe(true)
    expect(recovery.failureSummary).toBeDefined()
    expect(recovery.failureSummary).toContain('Recovery Exhausted')
  })

  it('escalates when stuck in a loop (same error twice across 3 attempts)', () => {
    const sameError = 'Infinite loop detected'
    const s = session({
      failures: [
        failure({ taskId: 'task-1', attemptNumber: 0, strategy: 'retry', error: sameError }),
        failure({ taskId: 'task-1', attemptNumber: 1, strategy: 'simplify', error: sameError }),
      ],
    })
    const { recovery } = handleTaskFailure(s, 'task-1', 'Implement login', sameError)
    expect(recovery.recovered).toBe(false)
    expect(recovery.rolledBack).toBe(true)
  })

  it('does not affect failures for other tasks', () => {
    const s = session({
      failures: [
        failure({ taskId: 'task-2', attemptNumber: 0, strategy: 'retry' }),
      ],
    })
    const { session: newSession } = handleTaskFailure(
      s,
      'task-1',
      'Task 1',
      'Error',
    )
    expect(newSession.failures.filter(f => f.taskId === 'task-2')).toHaveLength(1)
    expect(newSession.failures.filter(f => f.taskId === 'task-1')).toHaveLength(1)
  })

  it('immutably updates session — original session unchanged', () => {
    const original = session()
    handleTaskFailure(original, 'task-1', 'Task', 'Error')
    expect(original.failures).toHaveLength(0)
  })

  it('failure summary includes all task failures when escalating', () => {
    const s = session({
      failures: [
        failure({ taskId: 'task-1', taskTitle: 'Build auth', attemptNumber: 0, strategy: 'retry' }),
        failure({ taskId: 'task-1', taskTitle: 'Build auth', attemptNumber: 1, strategy: 'simplify' }),
      ],
    })
    const { recovery } = handleTaskFailure(s, 'task-1', 'Build auth', 'Final error')
    expect(recovery.failureSummary).toContain('Build auth')
    expect(recovery.failureSummary).toContain('[retry]')
    expect(recovery.failureSummary).toContain('[simplify]')
  })
})

// ---------------------------------------------------------------------------
// createRecoverySession
// ---------------------------------------------------------------------------

describe('createRecoverySession', () => {
  it('returns ok with last good commit ref from git HEAD', async () => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockReturnValueOnce('abc1234567890\n' as unknown as Buffer)

    const result = createRecoverySession('/tmp/project')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.lastGoodCommitRef).toBe('abc1234567890')
      expect(result.value.failures).toEqual([])
    }
  })

  it('trims whitespace from commit ref', async () => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockReturnValueOnce('  deadbeef  \n' as unknown as Buffer)

    const result = createRecoverySession('/tmp/project')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.lastGoodCommitRef).toBe('deadbeef')
    }
  })

  it('returns err when git command fails', async () => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error('not a git repository')
    })

    const result = createRecoverySession('/tmp/not-a-repo')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_READ_FAILED')
      expect(result.error.i18nKey).toBe('error.recovery.session_create_failed')
    }
  })
})

// ---------------------------------------------------------------------------
// executeRollback
// ---------------------------------------------------------------------------

describe('executeRollback', () => {
  it('returns ok with commit ref on successful rollback', async () => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockReturnValueOnce('' as unknown as Buffer)

    const result = executeRollback('/tmp/project', 'abc1234')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('abc1234')
    }
  })

  it('returns err when git reset fails', async () => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error('fatal: unknown revision')
    })

    const result = executeRollback('/tmp/project', 'badreff')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_WRITE_FAILED')
      expect(result.error.i18nKey).toBe('error.recovery.rollback_failed')
      expect(result.error.params?.['ref']).toBe('badreff')
    }
  })

  it('calls git reset --hard with the provided commit ref', async () => {
    const { execSync } = await import('node:child_process')
    const mockExec = vi.mocked(execSync)
    mockExec.mockReturnValueOnce('' as unknown as Buffer)

    executeRollback('/tmp/project', 'deadbeef123')

    expect(mockExec).toHaveBeenCalledWith(
      'git reset --hard deadbeef123',
      expect.objectContaining({ cwd: '/tmp/project' }),
    )
  })
})
