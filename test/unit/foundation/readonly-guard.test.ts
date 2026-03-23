/**
 * Readonly guard — unit tests
 * @see Epic 21.3: v1.0 Release Checklist
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { isReadonlyMode, checkReadonly, READONLY_BLOCKED_COMMANDS } from '../../../src/foundation/readonly-guard.js'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'bp-readonly-'))
  await mkdir(join(tempDir, '.buildpact'), { recursive: true })
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('isReadonlyMode', () => {
  it('returns false when no config exists', () => {
    expect(isReadonlyMode(join(tempDir, 'nonexistent'))).toBe(false)
  })

  it('returns false when readonly is not set', async () => {
    await writeFile(join(tempDir, '.buildpact', 'config.yaml'), 'language: en\n', 'utf-8')
    expect(isReadonlyMode(tempDir)).toBe(false)
  })

  it('returns true when readonly: true', async () => {
    await writeFile(
      join(tempDir, '.buildpact', 'config.yaml'),
      'language: en\nreadonly: true\n',
      'utf-8',
    )
    expect(isReadonlyMode(tempDir)).toBe(true)
  })

  it('returns false when readonly: false', async () => {
    await writeFile(
      join(tempDir, '.buildpact', 'config.yaml'),
      'language: en\nreadonly: false\n',
      'utf-8',
    )
    expect(isReadonlyMode(tempDir)).toBe(false)
  })
})

describe('checkReadonly', () => {
  it('allows all commands when not readonly', async () => {
    await writeFile(join(tempDir, '.buildpact', 'config.yaml'), 'language: en\n', 'utf-8')
    for (const cmd of READONLY_BLOCKED_COMMANDS) {
      expect(checkReadonly(tempDir, cmd).ok).toBe(true)
    }
  })

  it('blocks state-modifying commands when readonly', async () => {
    await writeFile(
      join(tempDir, '.buildpact', 'config.yaml'),
      'language: en\nreadonly: true\n',
      'utf-8',
    )
    for (const cmd of READONLY_BLOCKED_COMMANDS) {
      const result = checkReadonly(tempDir, cmd)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('READONLY_MODE')
      }
    }
  })

  it('allows read-only commands when readonly', async () => {
    await writeFile(
      join(tempDir, '.buildpact', 'config.yaml'),
      'language: en\nreadonly: true\n',
      'utf-8',
    )
    const readOnlyCommands = ['doctor', 'help', 'hub', 'learn', 'status', 'verify']
    for (const cmd of readOnlyCommands) {
      expect(checkReadonly(tempDir, cmd).ok).toBe(true)
    }
  })
})
