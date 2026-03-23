import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  sha256,
  serializeLockfile,
  parseLockfile,
  buildLockedEntry,
  readLockfile,
  writeLockfile,
  checkSquadDrift,
  checkAllSquadDrift,
  lockSquad,
  updateAllLocks,
} from '../../../src/engine/squad-lock.js'
import type { LockedSquad, SquadLockfile } from '../../../src/engine/squad-lock.js'

// ---------------------------------------------------------------------------
// sha256
// ---------------------------------------------------------------------------

describe('sha256', () => {
  it('returns a 64-char hex string', () => {
    const hash = sha256('hello world')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic', () => {
    expect(sha256('test')).toBe(sha256('test'))
  })

  it('different inputs produce different hashes', () => {
    expect(sha256('a')).not.toBe(sha256('b'))
  })
})

// ---------------------------------------------------------------------------
// serializeLockfile / parseLockfile
// ---------------------------------------------------------------------------

describe('serializeLockfile + parseLockfile', () => {
  const sampleLock: SquadLockfile = {
    lockVersion: 1,
    squads: {
      software: {
        name: 'software',
        version: '1.0.0',
        contentHash: 'abc123',
        lockedAt: '2026-03-22T00:00:00.000Z',
        files: {
          'squad.yaml': 'hash1',
          'agents/chief.md': 'hash2',
        },
      },
    },
  }

  it('serializes to a readable YAML-like format', () => {
    const serialized = serializeLockfile(sampleLock)
    expect(serialized).toContain('lock_version: 1')
    expect(serialized).toContain('squads:')
    expect(serialized).toContain('  software:')
    expect(serialized).toContain('    version: "1.0.0"')
    expect(serialized).toContain('    content_hash: "abc123"')
    expect(serialized).toContain('      "squad.yaml": "hash1"')
  })

  it('roundtrips correctly', () => {
    const serialized = serializeLockfile(sampleLock)
    const result = parseLockfile(serialized)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = result.value
    expect(parsed.lockVersion).toBe(1)
    expect(parsed.squads['software']!.name).toBe('software')
    expect(parsed.squads['software']!.version).toBe('1.0.0')
    expect(parsed.squads['software']!.contentHash).toBe('abc123')
    expect(parsed.squads['software']!.files['squad.yaml']).toBe('hash1')
    expect(parsed.squads['software']!.files['agents/chief.md']).toBe('hash2')
  })

  it('rejects unsupported lock version', () => {
    const content = 'lock_version: 2\nsquads:\n'
    const result = parseLockfile(content)
    expect(result.ok).toBe(false)
  })

  it('handles empty lockfile', () => {
    const content = 'lock_version: 1\nsquads:\n'
    const result = parseLockfile(content)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value.squads)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// buildLockedEntry
// ---------------------------------------------------------------------------

describe('buildLockedEntry', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-lock-'))
    await mkdir(join(tmpDir, 'agents'), { recursive: true })
    await writeFile(
      join(tmpDir, 'squad.yaml'),
      'name: test-squad\nversion: "1.2.3"\ndomain: custom\n',
    )
    await writeFile(join(tmpDir, 'agents', 'chief.md'), '# Chief agent content')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('builds entry with correct version from squad.yaml', async () => {
    const result = await buildLockedEntry(tmpDir, 'test-squad', '2026-03-22T10:00:00Z')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.name).toBe('test-squad')
    expect(result.value.version).toBe('1.2.3')
    expect(result.value.lockedAt).toBe('2026-03-22T10:00:00Z')
  })

  it('computes per-file hashes', async () => {
    const result = await buildLockedEntry(tmpDir, 'test-squad')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.files['squad.yaml']).toBeDefined()
    expect(result.value.files['agents/chief.md']).toBeDefined()
    expect(result.value.files['squad.yaml']).toMatch(/^[a-f0-9]{64}$/)
  })

  it('computes a content hash', async () => {
    const result = await buildLockedEntry(tmpDir, 'test-squad')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })
})

// ---------------------------------------------------------------------------
// readLockfile / writeLockfile
// ---------------------------------------------------------------------------

describe('readLockfile / writeLockfile', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-lock-rw-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty lockfile when file does not exist', async () => {
    const result = await readLockfile(tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value.squads)).toHaveLength(0)
  })

  it('roundtrips via write then read', async () => {
    const lock: SquadLockfile = {
      lockVersion: 1,
      squads: {
        mysquad: {
          name: 'mysquad',
          version: '0.1.0',
          contentHash: 'deadbeef',
          lockedAt: '2026-03-22T00:00:00Z',
          files: { 'squad.yaml': 'abcdef' },
        },
      },
    }
    const writeResult = await writeLockfile(tmpDir, lock)
    expect(writeResult.ok).toBe(true)

    const readResult = await readLockfile(tmpDir)
    expect(readResult.ok).toBe(true)
    if (!readResult.ok) return
    expect(readResult.value.squads['mysquad']!.version).toBe('0.1.0')
  })
})

// ---------------------------------------------------------------------------
// checkSquadDrift
// ---------------------------------------------------------------------------

describe('checkSquadDrift', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-drift-'))
    await mkdir(join(tmpDir, 'agents'), { recursive: true })
    await writeFile(join(tmpDir, 'squad.yaml'), 'name: test\nversion: "1.0"\n')
    await writeFile(join(tmpDir, 'agents', 'chief.md'), '# Chief')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('detects no drift when files match', async () => {
    const entryResult = await buildLockedEntry(tmpDir, 'test')
    expect(entryResult.ok).toBe(true)
    if (!entryResult.ok) return

    const drift = await checkSquadDrift(tmpDir, entryResult.value)
    expect(drift.drifted).toBe(false)
    expect(drift.changedFiles).toHaveLength(0)
    expect(drift.addedFiles).toHaveLength(0)
    expect(drift.removedFiles).toHaveLength(0)
  })

  it('detects changed files', async () => {
    const entryResult = await buildLockedEntry(tmpDir, 'test')
    expect(entryResult.ok).toBe(true)
    if (!entryResult.ok) return

    // Modify a file
    await writeFile(join(tmpDir, 'squad.yaml'), 'name: test\nversion: "2.0"\n')

    const drift = await checkSquadDrift(tmpDir, entryResult.value)
    expect(drift.drifted).toBe(true)
    expect(drift.changedFiles).toContain('squad.yaml')
  })

  it('detects added files', async () => {
    const entryResult = await buildLockedEntry(tmpDir, 'test')
    expect(entryResult.ok).toBe(true)
    if (!entryResult.ok) return

    // Add a new file
    await writeFile(join(tmpDir, 'agents', 'specialist.md'), '# Specialist')

    const drift = await checkSquadDrift(tmpDir, entryResult.value)
    expect(drift.drifted).toBe(true)
    expect(drift.addedFiles).toContain('agents/specialist.md')
  })

  it('detects removed files', async () => {
    const entryResult = await buildLockedEntry(tmpDir, 'test')
    expect(entryResult.ok).toBe(true)
    if (!entryResult.ok) return

    // Remove a file
    await rm(join(tmpDir, 'agents', 'chief.md'))

    const drift = await checkSquadDrift(tmpDir, entryResult.value)
    expect(drift.drifted).toBe(true)
    expect(drift.removedFiles).toContain('agents/chief.md')
  })
})

// ---------------------------------------------------------------------------
// lockSquad / updateAllLocks
// ---------------------------------------------------------------------------

describe('lockSquad', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-locksquad-'))
    await mkdir(join(tmpDir, '.buildpact', 'squads', 'mysquad', 'agents'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'mysquad', 'squad.yaml'),
      'name: mysquad\nversion: "1.0"\ndomain: custom\n',
    )
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'mysquad', 'agents', 'chief.md'),
      '# Chief',
    )
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates lockfile for a single squad', async () => {
    const result = await lockSquad(tmpDir, 'mysquad')
    expect(result.ok).toBe(true)

    const lockResult = await readLockfile(tmpDir)
    expect(lockResult.ok).toBe(true)
    if (!lockResult.ok) return
    expect(lockResult.value.squads['mysquad']).toBeDefined()
    expect(lockResult.value.squads['mysquad']!.version).toBe('1.0')
  })
})

describe('updateAllLocks', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-updateall-'))
    await mkdir(join(tmpDir, '.buildpact', 'squads', 'alpha'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'alpha', 'squad.yaml'),
      'name: alpha\nversion: "1.0"\n',
    )
    await mkdir(join(tmpDir, '.buildpact', 'squads', 'beta'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'beta', 'squad.yaml'),
      'name: beta\nversion: "2.0"\n',
    )
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('locks all installed squads', async () => {
    const result = await updateAllLocks(tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(2)
    expect(result.value).toContain('alpha')
    expect(result.value).toContain('beta')

    const lockResult = await readLockfile(tmpDir)
    expect(lockResult.ok).toBe(true)
    if (!lockResult.ok) return
    expect(lockResult.value.squads['alpha']!.version).toBe('1.0')
    expect(lockResult.value.squads['beta']!.version).toBe('2.0')
  })

  it('returns empty when no squads directory', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'bp-empty-'))
    const result = await updateAllLocks(emptyDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(0)
    await rm(emptyDir, { recursive: true, force: true })
  })
})
