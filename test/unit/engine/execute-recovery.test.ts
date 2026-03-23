import { describe, it, expect } from 'vitest'
import {
  handleTaskFailure,
  selectNextStrategy,
  isStuckLoop,
  buildFailureSummary,
} from '../../../src/engine/recovery.js'
import type { RecoverySession, TaskFailure } from '../../../src/engine/recovery.js'
import { validateTaskResult, simplifyPayload } from '../../../src/engine/result-validator.js'
import type { TaskResult, TaskDispatchPayload } from '../../../src/contracts/task.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSession = (): RecoverySession => ({
  lastGoodCommitRef: 'abc123',
  failures: [],
})

// ---------------------------------------------------------------------------
// Recovery integration with result validation
// ---------------------------------------------------------------------------

describe('recovery integration with validation', () => {
  it('handleTaskFailure returns simplify as first recovery strategy (after recording initial failure)', () => {
    const session = makeSession()
    const { recovery } = handleTaskFailure(session, 'task-1', 'Build auth', 'API error')

    // After the first failure (attempt 0), the next strategy is attempt 1 = simplify
    expect(recovery.recovered).toBe(true)
    expect(recovery.nextStrategy).toBe('simplify')
  })

  it('handleTaskFailure returns skip as second recovery strategy', () => {
    const session: RecoverySession = {
      lastGoodCommitRef: 'abc123',
      failures: [
        { taskId: 'task-1', taskTitle: 'Build auth', strategy: 'retry', attemptNumber: 0, error: 'API error' },
      ],
    }
    const { recovery } = handleTaskFailure(session, 'task-1', 'Build auth', 'API error again')

    // After the second failure (attempt 1), the next strategy is attempt 2 = skip
    expect(recovery.recovered).toBe(true)
    expect(recovery.nextStrategy).toBe('skip')
  })

  it('handleTaskFailure returns exhausted after 3 attempts', () => {
    const failures: TaskFailure[] = [
      { taskId: 'task-1', taskTitle: 'Build auth', strategy: 'retry', attemptNumber: 0, error: 'err1' },
      { taskId: 'task-1', taskTitle: 'Build auth', strategy: 'simplify', attemptNumber: 1, error: 'err2' },
    ]
    const session: RecoverySession = { lastGoodCommitRef: 'abc123', failures }
    const { recovery } = handleTaskFailure(session, 'task-1', 'Build auth', 'err3')

    expect(recovery.recovered).toBe(false)
    expect(recovery.failureSummary).toBeDefined()
    expect(recovery.failureSummary).toContain('Recovery Exhausted')
  })

  it('stuck loop detection advances strategy', () => {
    const failures: TaskFailure[] = [
      { taskId: 'task-1', taskTitle: 'Task A', strategy: 'retry', attemptNumber: 0, error: 'same error' },
    ]
    expect(isStuckLoop(failures, 'task-1')).toBe(false)

    const failures2: TaskFailure[] = [
      { taskId: 'task-1', taskTitle: 'Task A', strategy: 'retry', attemptNumber: 0, error: 'same error' },
      { taskId: 'task-1', taskTitle: 'Task A', strategy: 'retry', attemptNumber: 1, error: 'same error' },
    ]
    expect(isStuckLoop(failures2, 'task-1')).toBe(true)
  })

  it('buildFailureSummary includes all attempts', () => {
    const failures: TaskFailure[] = [
      { taskId: 'task-1', taskTitle: 'Build auth', strategy: 'retry', attemptNumber: 0, error: 'timeout' },
      { taskId: 'task-1', taskTitle: 'Build auth', strategy: 'simplify', attemptNumber: 1, error: 'too complex' },
      { taskId: 'task-1', taskTitle: 'Build auth', strategy: 'skip', attemptNumber: 2, error: 'skipped' },
    ]
    const summary = buildFailureSummary(failures)
    expect(summary).toContain('Build auth')
    expect(summary).toContain('retry')
    expect(summary).toContain('simplify')
    expect(summary).toContain('skip')
    expect(summary).toContain('Next Steps')
  })

  it('validation failure feeds into recovery as failed task', () => {
    // Simulate: provider returns success=true but empty response
    const result: TaskResult = {
      taskId: 'task-1',
      success: true,
      artifacts: [],
      response: '',
    }
    const validation = validateTaskResult(result, 'Build auth')
    expect(validation.ok).toBe(false)

    // This validation failure would trigger recovery
    if (!validation.ok) {
      const session = makeSession()
      const { recovery } = handleTaskFailure(
        session,
        'task-1',
        'Build auth',
        validation.error.params?.['reason'] ?? 'validation failed',
      )
      expect(recovery.recovered).toBe(true)
      expect(recovery.nextStrategy).toBe('simplify')
    }
  })

  it('simplified payload can be used for retry dispatch', () => {
    const original: TaskDispatchPayload = {
      taskId: 'task-1',
      type: 'execute',
      content: 'Build a complex authentication module with OAuth2',
      context: 'src/auth/ directory structure...',
      budgetUsd: 0.50,
    }

    const simplified = simplifyPayload(original)
    expect(simplified.content).toContain('SIMPLIFICATION MODE')
    expect(simplified.context).toBeUndefined()
    expect(simplified.budgetUsd).toBe(0.50)
  })

  it('selectNextStrategy returns undefined when exhausted', () => {
    expect(selectNextStrategy(0)).toBe('retry')
    expect(selectNextStrategy(1)).toBe('simplify')
    expect(selectNextStrategy(2)).toBe('skip')
    expect(selectNextStrategy(3)).toBeUndefined()
  })
})
