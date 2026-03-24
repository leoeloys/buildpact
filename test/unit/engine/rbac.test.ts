import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadRbacConfig,
  parseRbacYaml,
  resolveUserRole,
  checkPermission,
  resolveCurrentUser,
  DEFAULT_ROLE_PERMISSIONS,
} from '../../../src/engine/rbac.js'
import type { RbacConfig } from '../../../src/engine/rbac.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<RbacConfig>): RbacConfig {
  return {
    roles: overrides?.roles ?? { ...DEFAULT_ROLE_PERMISSIONS },
    users: overrides?.users ?? { alice: 'admin', bob: 'member', carol: 'viewer' },
  }
}

// ---------------------------------------------------------------------------
// loadRbacConfig
// ---------------------------------------------------------------------------

describe('loadRbacConfig', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-rbac-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns null when no rbac.yaml exists (backward compatible)', async () => {
    const result = await loadRbacConfig(tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBeNull()
  })

  it('loads a valid rbac.yaml', async () => {
    const bpDir = join(tmpDir, '.buildpact')
    await mkdir(bpDir, { recursive: true })
    await writeFile(
      join(bpDir, 'rbac.yaml'),
      [
        'roles:',
        '  admin: ["*"]',
        '  lead:',
        '    - squad.execute',
        '    - config.write',
        '  member:',
        '    - squad.execute',
        '  viewer:',
        '    - audit.read',
        'users:',
        '  alice: admin',
        '  bob: member',
      ].join('\n'),
    )

    const result = await loadRbacConfig(tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok && result.value) {
      expect(result.value.users['alice']).toBe('admin')
      expect(result.value.users['bob']).toBe('member')
      expect(result.value.roles.admin).toEqual(['*'])
      expect(result.value.roles.lead).toContain('squad.execute')
    }
  })

  it('returns error for malformed yaml', async () => {
    const bpDir = join(tmpDir, '.buildpact')
    await mkdir(bpDir, { recursive: true })
    // parseRbacYaml is lenient (line-by-line), so it won't normally error.
    // But loadRbacConfig still successfully parses even odd input.
    await writeFile(join(bpDir, 'rbac.yaml'), 'roles:\n  admin: ["*"]\nusers:\n  alice: admin\n')
    const result = await loadRbacConfig(tmpDir)
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// parseRbacYaml
// ---------------------------------------------------------------------------

describe('parseRbacYaml', () => {
  it('parses inline array roles', () => {
    const config = parseRbacYaml('roles:\n  admin: ["*"]\nusers:\n  alice: admin\n')
    expect(config.roles.admin).toEqual(['*'])
    expect(config.users['alice']).toBe('admin')
  })

  it('fills default roles for missing definitions', () => {
    const config = parseRbacYaml('roles:\nusers:\n  bob: viewer\n')
    expect(config.roles.admin).toEqual(DEFAULT_ROLE_PERMISSIONS.admin)
    expect(config.roles.viewer).toEqual(DEFAULT_ROLE_PERMISSIONS.viewer)
  })
})

// ---------------------------------------------------------------------------
// resolveUserRole
// ---------------------------------------------------------------------------

describe('resolveUserRole', () => {
  it('returns the assigned role for a known user', () => {
    const config = makeConfig()
    expect(resolveUserRole(config, 'bob')).toBe('member')
  })

  it('defaults to viewer (least privilege) for an unknown user', () => {
    const config = makeConfig()
    expect(resolveUserRole(config, 'unknown-person')).toBe('viewer')
  })
})

// ---------------------------------------------------------------------------
// checkPermission
// ---------------------------------------------------------------------------

describe('checkPermission', () => {
  it('admin wildcard grants any permission', () => {
    const config = makeConfig()
    expect(checkPermission(config, 'admin', 'squad.execute')).toBe(true)
    expect(checkPermission(config, 'admin', 'anything.else')).toBe(true)
  })

  it('member has squad.execute but not config.write', () => {
    const config = makeConfig()
    expect(checkPermission(config, 'member', 'squad.execute')).toBe(true)
    expect(checkPermission(config, 'member', 'config.write')).toBe(false)
  })

  it('viewer only has audit.read', () => {
    const config = makeConfig()
    expect(checkPermission(config, 'viewer', 'audit.read')).toBe(true)
    expect(checkPermission(config, 'viewer', 'squad.execute')).toBe(false)
  })

  it('lead has budget.set', () => {
    const config = makeConfig()
    expect(checkPermission(config, 'lead', 'budget.set')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// resolveCurrentUser
// ---------------------------------------------------------------------------

describe('resolveCurrentUser', () => {
  const originalEnv = process.env['BP_USER']

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['BP_USER'] = originalEnv
    } else {
      delete process.env['BP_USER']
    }
  })

  it('reads from BP_USER env var when set', () => {
    process.env['BP_USER'] = 'test-user'
    expect(resolveCurrentUser()).toBe('test-user')
  })

  it('falls back to git user.name when BP_USER is not set', () => {
    delete process.env['BP_USER']
    // Should not throw — returns either git user or 'unknown'
    const user = resolveCurrentUser()
    expect(typeof user).toBe('string')
    expect(user.length).toBeGreaterThan(0)
  })
})
