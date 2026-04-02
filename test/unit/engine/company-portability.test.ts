import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  exportProject,
  importProject,
} from '../../../src/engine/company-portability.js'
import type { ProjectExport } from '../../../src/engine/company-portability.js'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'bp-portability-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('exportProject', () => {
  it('returns null for all fields when no files exist', async () => {
    const result = await exportProject(tempDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.config).toBeNull()
      expect(result.value.constitution).toBeNull()
      expect(result.value.squads).toBeNull()
      expect(result.value.policies).toBeNull()
    }
  })

  it('reads existing files into snapshot', async () => {
    const bpDir = join(tempDir, '.buildpact')
    await mkdir(bpDir, { recursive: true })
    await writeFile(join(bpDir, 'config.yml'), 'version: 1', 'utf-8')
    await writeFile(join(bpDir, 'constitution.md'), '# Rules', 'utf-8')

    const result = await exportProject(tempDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.config).toBe('version: 1')
      expect(result.value.constitution).toBe('# Rules')
      expect(result.value.squads).toBeNull()
      expect(result.value.policies).toBeNull()
    }
  })
})

describe('importProject', () => {
  it('writes non-null files to target directory', async () => {
    const snapshot: ProjectExport = {
      config: 'version: 2',
      constitution: '# New rules',
      squads: null,
      policies: '{"budget": 100}',
    }

    const result = await importProject(tempDir, snapshot)
    expect(result.ok).toBe(true)

    const config = await readFile(join(tempDir, '.buildpact', 'config.yml'), 'utf-8')
    expect(config).toBe('version: 2')

    const constitution = await readFile(join(tempDir, '.buildpact', 'constitution.md'), 'utf-8')
    expect(constitution).toBe('# New rules')

    const policies = await readFile(join(tempDir, '.buildpact', 'policies.json'), 'utf-8')
    expect(policies).toBe('{"budget": 100}')
  })

  it('skips null fields during import', async () => {
    const snapshot: ProjectExport = {
      config: 'v1',
      constitution: null,
      squads: null,
      policies: null,
    }

    await importProject(tempDir, snapshot)
    const config = await readFile(join(tempDir, '.buildpact', 'config.yml'), 'utf-8')
    expect(config).toBe('v1')
  })

  it('round-trips export then import', async () => {
    const bpDir = join(tempDir, '.buildpact')
    await mkdir(bpDir, { recursive: true })
    await writeFile(join(bpDir, 'config.yml'), 'original', 'utf-8')

    const exported = await exportProject(tempDir)
    expect(exported.ok).toBe(true)

    const targetDir = await mkdtemp(join(tmpdir(), 'bp-import-'))
    try {
      if (exported.ok) {
        await importProject(targetDir, exported.value)
        const content = await readFile(join(targetDir, '.buildpact', 'config.yml'), 'utf-8')
        expect(content).toBe('original')
      }
    } finally {
      await rm(targetDir, { recursive: true, force: true })
    }
  })
})
