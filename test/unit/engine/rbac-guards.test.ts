import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getCommandPermissions,
  guardCommand,
  formatDeniedMessage,
} from '../../../src/engine/rbac-guards.js'

// ---------------------------------------------------------------------------
// getCommandPermissions
// ---------------------------------------------------------------------------

describe('getCommandPermissions', () => {
  it('returns a map with known commands', () => {
    const perms = getCommandPermissions()
    expect(perms['execute']).toBe('squad.execute')
    expect(perms['quick']).toBe('squad.execute')
    expect(perms['plan']).toBe('config.write')
    expect(perms['adopt']).toBe('squad.install')
    expect(perms['audit']).toBe('audit.read')
  })
})

// ---------------------------------------------------------------------------
// guardCommand
// ---------------------------------------------------------------------------

describe('guardCommand', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-rbac-guard-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    delete process.env['BP_USER']
  })

  it('allows all commands when no rbac.yaml exists', async () => {
    const result = await guardCommand(tmpDir, 'execute')
    expect(result.ok).toBe(true)
  })

  it('allows admin user to run any command', async () => {
    process.env['BP_USER'] = 'alice'
    const bpDir = join(tmpDir, '.buildpact')
    await mkdir(bpDir, { recursive: true })
    await writeFile(
      join(bpDir, 'rbac.yaml'),
      'roles:\n  admin: ["*"]\nusers:\n  alice: admin\n',
    )

    const result = await guardCommand(tmpDir, 'execute')
    expect(result.ok).toBe(true)
  })

  it('denies viewer from running execute', async () => {
    process.env['BP_USER'] = 'viewer-user'
    const bpDir = join(tmpDir, '.buildpact')
    await mkdir(bpDir, { recursive: true })
    await writeFile(
      join(bpDir, 'rbac.yaml'),
      [
        'roles:',
        '  viewer:',
        '    - audit.read',
        'users:',
        '  viewer-user: viewer',
      ].join('\n'),
    )

    const result = await guardCommand(tmpDir, 'execute')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RBAC_DENIED')
    }
  })

  it('allows unknown commands (no restriction)', async () => {
    process.env['BP_USER'] = 'viewer-user'
    const bpDir = join(tmpDir, '.buildpact')
    await mkdir(bpDir, { recursive: true })
    await writeFile(
      join(bpDir, 'rbac.yaml'),
      'roles:\nusers:\n  viewer-user: viewer\n',
    )

    const result = await guardCommand(tmpDir, 'some-unknown-command')
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// formatDeniedMessage
// ---------------------------------------------------------------------------

describe('formatDeniedMessage', () => {
  it('produces a clear denial message', () => {
    const msg = formatDeniedMessage('viewer', 'squad.execute')
    expect(msg).toContain('viewer')
    expect(msg).toContain('squad.execute')
    expect(msg).toContain('Contact your admin')
  })
})
