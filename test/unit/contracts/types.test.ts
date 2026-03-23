/**
 * Structural contract tests — verify that all contract modules export
 * the expected types and constants. These tests ensure that barrel re-exports
 * don't silently break when contracts are refactored.
 */
import { describe, it, expect } from 'vitest'

describe('contracts/errors exports', () => {
  it('exports ok, err, ERROR_CODES', async () => {
    const mod = await import('../../../src/contracts/errors.js')
    expect(typeof mod.ok).toBe('function')
    expect(typeof mod.err).toBe('function')
    expect(typeof mod.ERROR_CODES).toBe('object')
  })
})

describe('contracts/index barrel', () => {
  it('re-exports ok, err, ERROR_CODES from errors', async () => {
    const mod = await import('../../../src/contracts/index.js')
    expect(typeof mod.ok).toBe('function')
    expect(typeof mod.err).toBe('function')
    expect(typeof mod.ERROR_CODES).toBe('object')
  })
})

describe('contracts/budget types', () => {
  it('module is importable (type-only)', async () => {
    const mod = await import('../../../src/contracts/budget.js')
    // Pure type module — no runtime exports, but import should not throw
    expect(mod).toBeDefined()
  })
})

describe('contracts/i18n types', () => {
  it('module is importable (type-only)', async () => {
    const mod = await import('../../../src/contracts/i18n.js')
    expect(mod).toBeDefined()
  })
})

describe('contracts/profile types', () => {
  it('module is importable (type-only)', async () => {
    const mod = await import('../../../src/contracts/profile.js')
    expect(mod).toBeDefined()
  })
})

describe('contracts/squad types', () => {
  it('module is importable (type-only)', async () => {
    const mod = await import('../../../src/contracts/squad.js')
    expect(mod).toBeDefined()
  })
})

describe('contracts/task types', () => {
  it('module is importable (type-only)', async () => {
    const mod = await import('../../../src/contracts/task.js')
    expect(mod).toBeDefined()
  })
})

describe('engine/types', () => {
  it('module is importable (type-only)', async () => {
    const mod = await import('../../../src/engine/types.js')
    expect(mod).toBeDefined()
  })
})
