import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveProvider } from '../../../../src/engine/providers/index.js'
import { StubProvider } from '../../../../src/engine/providers/stub.js'
import { AnthropicProvider } from '../../../../src/engine/providers/anthropic.js'

describe('resolveProvider', () => {
  const originalEnv = process.env['ANTHROPIC_API_KEY']

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env['ANTHROPIC_API_KEY'] = originalEnv
    } else {
      delete process.env['ANTHROPIC_API_KEY']
    }
  })

  it('returns StubProvider when no API key is set', async () => {
    delete process.env['ANTHROPIC_API_KEY']
    const result = await resolveProvider('/nonexistent/project')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeInstanceOf(StubProvider)
      expect(result.value.name).toBe('stub')
    }
  })

  it('returns AnthropicProvider when ANTHROPIC_API_KEY is set', async () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-test-key-123'
    const result = await resolveProvider('/nonexistent/project')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeInstanceOf(AnthropicProvider)
      expect(result.value.name).toBe('anthropic')
    }
  })

  it('returns StubProvider when API key is empty string', async () => {
    process.env['ANTHROPIC_API_KEY'] = ''
    const result = await resolveProvider('/nonexistent/project')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeInstanceOf(StubProvider)
    }
  })

  it('always returns ok result (never errors)', async () => {
    delete process.env['ANTHROPIC_API_KEY']
    const result = await resolveProvider('/nonexistent/project')
    expect(result.ok).toBe(true)
  })
})
