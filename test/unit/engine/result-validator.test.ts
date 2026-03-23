import { describe, it, expect } from 'vitest'
import { validateTaskResult, simplifyPayload } from '../../../src/engine/result-validator.js'
import type { TaskResult, TaskDispatchPayload } from '../../../src/contracts/task.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const taskResult = (overrides?: Partial<TaskResult>): TaskResult => ({
  taskId: 'task-1',
  success: true,
  artifacts: [],
  response: 'Generated implementation code...',
  ...overrides,
})

const payload = (overrides?: Partial<TaskDispatchPayload>): TaskDispatchPayload => ({
  taskId: 'task-1',
  type: 'execute',
  content: '# Task: Build auth module\n\n## Plan Context\n\nImplement login flow',
  context: 'src/auth/login.ts line 42',
  ...overrides,
})

// ---------------------------------------------------------------------------
// validateTaskResult
// ---------------------------------------------------------------------------

describe('validateTaskResult', () => {
  it('returns ok for valid successful result', () => {
    const result = validateTaskResult(taskResult(), 'Build auth')
    expect(result.ok).toBe(true)
  })

  it('returns ok for result with undefined response (no response expected)', () => {
    const result = validateTaskResult(taskResult({ response: undefined }), 'Build auth')
    expect(result.ok).toBe(true)
  })

  it('returns err for failed result', () => {
    const result = validateTaskResult(
      taskResult({ success: false, error: 'API error' }),
      'Build auth',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('TASK_RESULT_INVALID')
      expect(result.error.params?.['title']).toBe('Build auth')
    }
  })

  it('returns err for empty response content', () => {
    const result = validateTaskResult(
      taskResult({ response: '   ' }),
      'Build auth',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.params?.['reason']).toContain('empty response')
    }
  })

  it('returns err for zero-length response', () => {
    const result = validateTaskResult(
      taskResult({ response: '' }),
      'Build auth',
    )
    expect(result.ok).toBe(false)
  })

  it('preserves task title in error params', () => {
    const result = validateTaskResult(
      taskResult({ success: false }),
      'Complex task with long name',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.params?.['title']).toBe('Complex task with long name')
    }
  })

  it('includes error message from result in params', () => {
    const result = validateTaskResult(
      taskResult({ success: false, error: 'Model refused' }),
      'Build auth',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.params?.['reason']).toContain('Model refused')
    }
  })
})

// ---------------------------------------------------------------------------
// simplifyPayload
// ---------------------------------------------------------------------------

describe('simplifyPayload', () => {
  it('prepends simplification prefix to content', () => {
    const simplified = simplifyPayload(payload())
    expect(simplified.content).toContain('SIMPLIFICATION MODE')
    expect(simplified.content).toContain('minimal, working implementation')
  })

  it('preserves original content after prefix', () => {
    const original = payload()
    const simplified = simplifyPayload(original)
    expect(simplified.content).toContain(original.content)
  })

  it('omits context from simplified payload', () => {
    const original = payload({ context: 'some codebase context' })
    const simplified = simplifyPayload(original)
    expect(simplified.context).toBeUndefined()
  })

  it('preserves taskId, type, and budgetUsd', () => {
    const original = payload({ budgetUsd: 0.50 })
    const simplified = simplifyPayload(original)
    expect(simplified.taskId).toBe(original.taskId)
    expect(simplified.type).toBe(original.type)
    expect(simplified.budgetUsd).toBe(0.50)
  })

  it('preserves constitutionPath when present', () => {
    const original = payload({ constitutionPath: '/proj/.buildpact/constitution.md' })
    const simplified = simplifyPayload(original)
    expect(simplified.constitutionPath).toBe('/proj/.buildpact/constitution.md')
  })

  it('omits budgetUsd when not in original', () => {
    const simplified = simplifyPayload(payload())
    expect(simplified.budgetUsd).toBeUndefined()
  })
})
