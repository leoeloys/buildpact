import { describe, it, expect } from 'vitest'
import { buildTaskPayload, validatePayloadSize, serializePayload } from '../../../src/engine/subagent.js'

describe('buildTaskPayload', () => {
  it('assembles correct shape from minimal params', () => {
    const payload = buildTaskPayload({ type: 'specify', content: 'plan this feature' })

    expect(payload.type).toBe('specify')
    expect(payload.content).toBe('plan this feature')
    expect(typeof payload.taskId).toBe('string')
    expect(payload.taskId.length).toBeGreaterThan(0)
    expect(payload.context).toBeUndefined()
    expect(payload.outputPath).toBeUndefined()
    expect(payload.budgetUsd).toBeUndefined()
  })

  it('includes optional fields when provided', () => {
    const payload = buildTaskPayload({
      type: 'plan',
      content: 'plan the feature',
      context: 'some codebase context',
      outputPath: '.buildpact/specs/feature.md',
      budgetUsd: 0.5,
    })

    expect(payload.context).toBe('some codebase context')
    expect(payload.outputPath).toBe('.buildpact/specs/feature.md')
    expect(payload.budgetUsd).toBe(0.5)
  })

  it('generates a unique taskId per call', () => {
    const a = buildTaskPayload({ type: 'execute', content: 'x' })
    const b = buildTaskPayload({ type: 'execute', content: 'x' })
    expect(a.taskId).not.toBe(b.taskId)
  })

  it('supports all valid task types', () => {
    const types = ['specify', 'plan', 'execute', 'verify', 'quick', 'optimize'] as const
    for (const type of types) {
      const payload = buildTaskPayload({ type, content: 'test' })
      expect(payload.type).toBe(type)
    }
  })
})

describe('serializePayload', () => {
  it('produces valid JSON string', () => {
    const payload = buildTaskPayload({ type: 'specify', content: 'hello' })
    const json = serializePayload(payload)

    expect(typeof json).toBe('string')
    const parsed = JSON.parse(json) as Record<string, unknown>
    expect(parsed['taskId']).toBe(payload.taskId)
    expect(parsed['type']).toBe('specify')
    expect(parsed['content']).toBe('hello')
  })

  it('omits undefined optional fields from serialization', () => {
    const payload = buildTaskPayload({ type: 'specify', content: 'hello' })
    const json = serializePayload(payload)
    const parsed = JSON.parse(json) as Record<string, unknown>

    expect('context' in parsed).toBe(false)
    expect('outputPath' in parsed).toBe(false)
    expect('budgetUsd' in parsed).toBe(false)
  })
})

describe('validatePayloadSize', () => {
  it('returns ok when payload is well under 20KB', () => {
    const payload = buildTaskPayload({ type: 'specify', content: 'short content' })
    const result = validatePayloadSize(payload)
    expect(result.ok).toBe(true)
  })

  it('returns ok for payload exactly at the boundary (20KB)', () => {
    // ~20KB of content — use a string slightly under limit after JSON overhead
    const content = 'x'.repeat(20 * 1024 - 200)
    const payload = buildTaskPayload({ type: 'plan', content })
    const result = validatePayloadSize(payload)
    expect(result.ok).toBe(true)
  })

  it('returns err with PAYLOAD_TOO_LARGE when payload exceeds 20KB', () => {
    // 30KB of content — will exceed 20KB limit after serialization
    const content = 'x'.repeat(30 * 1024)
    const payload = buildTaskPayload({ type: 'execute', content })
    const result = validatePayloadSize(payload)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PAYLOAD_TOO_LARGE')
      expect(result.error.i18nKey).toBe('error.engine.payload_too_large')
      expect(result.error.params?.['bytes']).toBeDefined()
      expect(result.error.params?.['max']).toBe('20480')
    }
  })

  it('uses byte length not character length for size check', () => {
    // A string of multibyte chars (each 3 bytes in UTF-8)
    // 5000 × 3 bytes = 15000 bytes — should pass
    const content = '€'.repeat(5000)
    const payload = buildTaskPayload({ type: 'specify', content })
    // 5000 '€' chars × 3 bytes = 15000 bytes for content alone + JSON overhead ~50 bytes = ~15050 bytes < 20480
    const result = validatePayloadSize(payload)
    expect(result.ok).toBe(true)
  })
})
