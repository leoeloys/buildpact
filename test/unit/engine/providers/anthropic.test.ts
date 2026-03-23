import { describe, it, expect, vi } from 'vitest'
import { AnthropicProvider } from '../../../../src/engine/providers/anthropic.js'
import { parseModelProfiles, MODEL_CATALOG } from '../../../../src/engine/model-profile-manager.js'
import type { TaskDispatchPayload } from '../../../../src/contracts/task.js'
import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock API error that bypasses the SDK's Headers requirement */
function makeAPIError(status: number, message: string): Anthropic.APIError {
  const error = new Error(message) as Anthropic.APIError
  error.status = status
  error.message = message
  // Make it pass instanceof checks by setting the prototype
  Object.setPrototypeOf(error, Anthropic.APIError.prototype)
  return error
}

const payload = (overrides?: Partial<TaskDispatchPayload>): TaskDispatchPayload => ({
  taskId: 'test-task-1',
  type: 'execute',
  content: '## Task\nImplement login form',
  ...overrides,
})

/** Create a mock Anthropic client */
function mockClient(response?: Partial<Anthropic.Message>) {
  const defaultResponse: Anthropic.Message = {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content: [{ type: 'text', text: 'Done.' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50, ...(response?.usage ?? {}) },
    ...response,
  }
  return {
    messages: {
      create: vi.fn().mockResolvedValue(defaultResponse),
    },
  } as unknown as Anthropic
}

/** Create provider with mock client */
function createProvider(opts?: {
  client?: Anthropic
  tier?: 'quality' | 'balanced' | 'budget'
}) {
  const client = opts?.client ?? mockClient()
  return new AnthropicProvider({
    apiKey: 'test-key',
    client,
    profileConfig: parseModelProfiles(''),
    tier: opts?.tier ?? 'balanced',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnthropicProvider', () => {
  it('has name "anthropic"', () => {
    const provider = createProvider()
    expect(provider.name).toBe('anthropic')
  })

  it('returns success with token usage from API response', async () => {
    const client = mockClient({
      usage: { input_tokens: 200, output_tokens: 100 },
    })
    const provider = createProvider({ client })

    const result = await provider.dispatch(payload())
    expect(result.success).toBe(true)
    expect(result.taskId).toBe('test-task-1')
    expect(result.tokensUsed).toBe(300) // 200 + 100
    expect(result.artifacts).toEqual([])
  })

  it('calculates costUsd from token usage and model rates', async () => {
    const client = mockClient({
      usage: { input_tokens: 1000, output_tokens: 1000 },
    })
    const provider = createProvider({ client })

    const result = await provider.dispatch(payload())
    expect(result.success).toBe(true)
    expect(result.costUsd).toBeGreaterThan(0)
    // Sonnet rate: 0.015 per 1k output tokens
    // Output: 1000/1000 * 0.015 = 0.015
    // Input: 1000/1000 * 0.015/5 = 0.003
    // Total ≈ 0.018
    expect(result.costUsd).toBeCloseTo(0.018, 3)
  })

  it('calls Anthropic API with correct model and content', async () => {
    const client = mockClient()
    const provider = createProvider({ client })

    await provider.dispatch(payload({ content: 'Hello world' }))

    const createFn = client.messages.create as ReturnType<typeof vi.fn>
    expect(createFn).toHaveBeenCalledOnce()
    const args = createFn.mock.calls[0]![0]
    expect(args.messages).toEqual([{ role: 'user', content: 'Hello world' }])
    expect(args.model).toBeDefined()
    expect(args.max_tokens).toBeGreaterThan(0)
  })

  it('returns failure for oversized payload without calling API', async () => {
    const client = mockClient()
    const provider = createProvider({ client })
    const hugeContent = 'x'.repeat(30 * 1024)

    const result = await provider.dispatch(payload({ content: hugeContent }))
    expect(result.success).toBe(false)
    expect(result.error).toContain('PAYLOAD_TOO_LARGE')

    const createFn = client.messages.create as ReturnType<typeof vi.fn>
    expect(createFn).not.toHaveBeenCalled()
  })

  it('returns failure on non-retryable API error', async () => {
    const client = mockClient()
    const createFn = client.messages.create as ReturnType<typeof vi.fn>
    createFn.mockRejectedValue(makeAPIError(401, 'invalid api key'))
    const provider = createProvider({ client })

    const result = await provider.dispatch(payload())
    expect(result.success).toBe(false)
    expect(result.error).toContain('401')
    expect(result.tokensUsed).toBe(0)
    expect(result.costUsd).toBe(0)
  })

  it('attempts failover on retryable 429 error', async () => {
    const client = mockClient()
    const createFn = client.messages.create as ReturnType<typeof vi.fn>
    // First call: 429 rate limit error
    createFn.mockRejectedValueOnce(makeAPIError(429, 'rate limited'))
    // Second call (failover model): success
    createFn.mockResolvedValueOnce({
      id: 'msg_456',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5-20251001',
      content: [{ type: 'text', text: 'Done via failover.' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 80, output_tokens: 30 },
    })
    const provider = createProvider({ client })

    const result = await provider.dispatch(payload())
    expect(result.success).toBe(true)
    expect(createFn).toHaveBeenCalledTimes(2)
  })

  it('returns failure when all failover models exhausted', async () => {
    const client = mockClient()
    const createFn = client.messages.create as ReturnType<typeof vi.fn>
    // Budget tier has no failover chain — single model
    createFn.mockRejectedValue(makeAPIError(429, 'rate limited'))
    const provider = createProvider({ client, tier: 'budget' })

    const result = await provider.dispatch(payload())
    expect(result.success).toBe(false)
    expect(result.error).toContain('exhausted')
  })

  it('uses execution operation for execute task type', async () => {
    const client = mockClient()
    const provider = createProvider({ client, tier: 'quality' })

    await provider.dispatch(payload({ type: 'execute' }))

    const createFn = client.messages.create as ReturnType<typeof vi.fn>
    const args = createFn.mock.calls[0]![0]
    // Quality tier uses Opus for execution
    expect(args.model).toBe('claude-opus-4-6')
  })

  it('uses plan_writing operation for plan task type', async () => {
    const client = mockClient()
    const provider = createProvider({ client, tier: 'quality' })

    await provider.dispatch(payload({ type: 'plan' }))

    const createFn = client.messages.create as ReturnType<typeof vi.fn>
    const args = createFn.mock.calls[0]![0]
    // Quality tier uses Sonnet for plan_writing
    expect(args.model).toBe('claude-sonnet-4-6')
  })
})
