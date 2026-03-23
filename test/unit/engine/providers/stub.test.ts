import { describe, it, expect } from 'vitest'
import { StubProvider } from '../../../../src/engine/providers/stub.js'
import { STUB_COST_PER_TASK_USD } from '../../../../src/engine/budget-guard.js'
import type { TaskDispatchPayload } from '../../../../src/contracts/task.js'

const payload = (overrides?: Partial<TaskDispatchPayload>): TaskDispatchPayload => ({
  taskId: 'test-task-1',
  type: 'execute',
  content: '## Task\nImplement login form',
  ...overrides,
})

describe('StubProvider', () => {
  it('has name "stub"', () => {
    const provider = new StubProvider()
    expect(provider.name).toBe('stub')
  })

  it('returns success for a normal payload', async () => {
    const provider = new StubProvider()
    const result = await provider.dispatch(payload())
    expect(result.success).toBe(true)
    expect(result.taskId).toBe('test-task-1')
    expect(result.artifacts).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('returns STUB_COST_PER_TASK_USD as costUsd', async () => {
    const provider = new StubProvider()
    const result = await provider.dispatch(payload())
    expect(result.costUsd).toBe(STUB_COST_PER_TASK_USD)
  })

  it('returns tokensUsed as 0', async () => {
    const provider = new StubProvider()
    const result = await provider.dispatch(payload())
    expect(result.tokensUsed).toBe(0)
  })

  it('returns failure for oversized payload', async () => {
    const provider = new StubProvider()
    const hugeContent = 'x'.repeat(30 * 1024)
    const result = await provider.dispatch(payload({ content: hugeContent }))
    expect(result.success).toBe(false)
    expect(result.error).toContain('PAYLOAD_TOO_LARGE')
    expect(result.costUsd).toBe(0)
    expect(result.tokensUsed).toBe(0)
  })

  it('preserves taskId from payload in result', async () => {
    const provider = new StubProvider()
    const result = await provider.dispatch(payload({ taskId: 'custom-id-42' }))
    expect(result.taskId).toBe('custom-id-42')
  })
})
