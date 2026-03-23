import { describe, it, expect } from 'vitest'
import { ok, err, ERROR_CODES } from '../../../src/contracts/errors.js'
import type { CliError, Result, ErrorCode } from '../../../src/contracts/errors.js'

describe('ok', () => {
  it('creates a success result with value', () => {
    const result = ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(42)
    }
  })

  it('works with string values', () => {
    const result = ok('hello')
    expect(result).toEqual({ ok: true, value: 'hello' })
  })

  it('works with undefined (void operations)', () => {
    const result = ok(undefined)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeUndefined()
    }
  })

  it('works with complex objects', () => {
    const data = { files: ['a.ts', 'b.ts'], count: 2 }
    const result = ok(data)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(data)
    }
  })
})

describe('err', () => {
  it('creates a failure result with CliError', () => {
    const error: CliError = {
      code: 'SQUAD_NOT_FOUND',
      i18nKey: 'error.squad.not_found',
    }
    const result = err(error)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('SQUAD_NOT_FOUND')
      expect(result.error.i18nKey).toBe('error.squad.not_found')
    }
  })

  it('preserves optional params', () => {
    const result = err({
      code: 'FILE_READ_FAILED',
      i18nKey: 'error.file.read_failed',
      params: { path: '/some/file.ts' },
    })
    if (!result.ok) {
      expect(result.error.params).toEqual({ path: '/some/file.ts' })
    }
  })

  it('preserves optional phase', () => {
    const result = err({
      code: 'NOT_IMPLEMENTED',
      i18nKey: 'error.not_implemented',
      phase: 'v1.0',
    })
    if (!result.ok) {
      expect(result.error.phase).toBe('v1.0')
    }
  })

  it('preserves optional cause', () => {
    const original = new Error('disk full')
    const result = err({
      code: 'FILE_WRITE_FAILED',
      i18nKey: 'error.file.write_failed',
      cause: original,
    })
    if (!result.ok) {
      expect(result.error.cause).toBe(original)
    }
  })
})

describe('ERROR_CODES', () => {
  it('is a frozen object (as const)', () => {
    expect(typeof ERROR_CODES).toBe('object')
    expect(ERROR_CODES).toBeTruthy()
  })

  it('has all expected code categories', () => {
    // Squad
    expect(ERROR_CODES.SQUAD_NOT_FOUND).toBe('SQUAD_NOT_FOUND')
    expect(ERROR_CODES.SQUAD_VALIDATION_FAILED).toBe('SQUAD_VALIDATION_FAILED')
    expect(ERROR_CODES.SQUAD_INVALID_NAME).toBe('SQUAD_INVALID_NAME')

    // File I/O
    expect(ERROR_CODES.FILE_WRITE_FAILED).toBe('FILE_WRITE_FAILED')
    expect(ERROR_CODES.FILE_READ_FAILED).toBe('FILE_READ_FAILED')

    // Constitution
    expect(ERROR_CODES.CONSTITUTION_NOT_FOUND).toBe('CONSTITUTION_NOT_FOUND')
    expect(ERROR_CODES.CONSTITUTION_EMPTY).toBe('CONSTITUTION_EMPTY')
    expect(ERROR_CODES.CONSTITUTION_VIOLATION).toBe('CONSTITUTION_VIOLATION')
    expect(ERROR_CODES.CONSTITUTION_MODIFICATION_BLOCKED).toBe('CONSTITUTION_MODIFICATION_BLOCKED')

    // Budget & model
    expect(ERROR_CODES.BUDGET_EXCEEDED).toBe('BUDGET_EXCEEDED')
    expect(ERROR_CODES.FAILOVER_EXHAUSTED).toBe('FAILOVER_EXHAUSTED')

    // Git
    expect(ERROR_CODES.GIT_COMMAND_FAILED).toBe('GIT_COMMAND_FAILED')
    expect(ERROR_CODES.RATCHET_BRANCH_FAILED).toBe('RATCHET_BRANCH_FAILED')
    expect(ERROR_CODES.RATCHET_COMMIT_FAILED).toBe('RATCHET_COMMIT_FAILED')
    expect(ERROR_CODES.RATCHET_REVERT_FAILED).toBe('RATCHET_REVERT_FAILED')

    // Upgrade & adopt
    expect(ERROR_CODES.SCHEMA_INCOMPATIBLE).toBe('SCHEMA_INCOMPATIBLE')
    expect(ERROR_CODES.CLI_TOO_OLD).toBe('CLI_TOO_OLD')
    expect(ERROR_CODES.MIGRATION_FAILED).toBe('MIGRATION_FAILED')
    expect(ERROR_CODES.ADOPT_FAILED).toBe('ADOPT_FAILED')
    expect(ERROR_CODES.ADOPT_SCAN_FAILED).toBe('ADOPT_SCAN_FAILED')
  })

  it('values equal their keys (SCREAMING_SNAKE convention)', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(key).toBe(value)
    }
  })

  it('has no duplicate values', () => {
    const values = Object.values(ERROR_CODES)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

describe('Result type narrowing', () => {
  it('narrows to value on ok check', () => {
    const result: Result<number> = ok(42)
    if (result.ok) {
      // TypeScript should allow accessing .value here
      const n: number = result.value
      expect(n).toBe(42)
    }
  })

  it('narrows to error on !ok check', () => {
    const result: Result<number> = err({ code: 'X', i18nKey: 'x' })
    if (!result.ok) {
      // TypeScript should allow accessing .error here
      const e: CliError = result.error
      expect(e.code).toBe('X')
    }
  })
})
