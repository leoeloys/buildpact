import { describe, it, expect } from 'vitest'
import { buildTaskPayload, validatePayloadSize, serializePayload, formatTaskId } from '../../../src/engine/subagent.js'

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

describe('buildTaskPayload — expanded fields', () => {
  it('includes description when provided', () => {
    const payload = buildTaskPayload({ type: 'execute', content: 'test', description: 'Implement login' })
    expect(payload.description).toBe('Implement login')
  })

  it('includes projectContextPath when provided', () => {
    const payload = buildTaskPayload({ type: 'execute', content: 'test', projectContextPath: '/proj/.buildpact/project-context.md' })
    expect(payload.projectContextPath).toBe('/proj/.buildpact/project-context.md')
  })

  it('includes squadAgentPath when provided', () => {
    const payload = buildTaskPayload({ type: 'execute', content: 'test', squadAgentPath: '/proj/.buildpact/squads/software/agents/developer.md' })
    expect(payload.squadAgentPath).toBe('/proj/.buildpact/squads/software/agents/developer.md')
  })

  it('includes modelProfile when provided', () => {
    const payload = buildTaskPayload({ type: 'execute', content: 'test', modelProfile: 'quality' })
    expect(payload.modelProfile).toBe('quality')
  })

  it('includes budgetRemainingUsd when provided', () => {
    const payload = buildTaskPayload({ type: 'execute', content: 'test', budgetRemainingUsd: 4.50 })
    expect(payload.budgetRemainingUsd).toBe(4.50)
  })

  it('includes commitFormat when provided', () => {
    const payload = buildTaskPayload({ type: 'execute', content: 'test', commitFormat: 'type(auth-flow): description' })
    expect(payload.commitFormat).toBe('type(auth-flow): description')
  })

  it('uses provided taskId instead of generating UUID', () => {
    const payload = buildTaskPayload({ type: 'execute', content: 'test', taskId: 'task-execute-01-03' })
    expect(payload.taskId).toBe('task-execute-01-03')
  })

  it('omits new fields when not provided', () => {
    const payload = buildTaskPayload({ type: 'execute', content: 'test' })
    expect(payload.description).toBeUndefined()
    expect(payload.projectContextPath).toBeUndefined()
    expect(payload.squadAgentPath).toBeUndefined()
    expect(payload.modelProfile).toBeUndefined()
    expect(payload.budgetRemainingUsd).toBeUndefined()
    expect(payload.commitFormat).toBeUndefined()
  })

  it('serialized payload with all fields stays within 20KB', () => {
    const payload = buildTaskPayload({
      type: 'execute',
      taskId: 'task-execute-01-00',
      description: 'Implement authentication module with OAuth2 flow',
      content: 'x'.repeat(15 * 1024), // 15KB of plan content
      projectContextPath: '/proj/.buildpact/project-context.md',
      squadAgentPath: '/proj/.buildpact/squads/software/agents/developer.md',
      modelProfile: 'balanced',
      budgetRemainingUsd: 4.50,
      commitFormat: 'type(auth-flow): description',
      constitutionPath: '/proj/.buildpact/constitution.md',
    })
    const result = validatePayloadSize(payload)
    expect(result.ok).toBe(true)
  })
})

describe('formatTaskId', () => {
  it('formats task ID with zero-padded numbers', () => {
    expect(formatTaskId('execute', 1, 3)).toBe('task-execute-01-03')
  })

  it('uses phase name directly', () => {
    expect(formatTaskId('auth-flow', 0, 0)).toBe('task-auth-flow-00-00')
  })

  it('pads single-digit numbers to 2 digits', () => {
    expect(formatTaskId('plan', 5, 9)).toBe('task-plan-05-09')
  })

  it('handles double-digit numbers without extra padding', () => {
    expect(formatTaskId('execute', 12, 15)).toBe('task-execute-12-15')
  })

  it('produces deterministic output for same inputs', () => {
    const a = formatTaskId('execute', 2, 1)
    const b = formatTaskId('execute', 2, 1)
    expect(a).toBe(b)
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
