import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadConstitution,
  saveConstitution,
  constitutionExists,
} from '../../../src/foundation/constitution.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONSTITUTION_PATH = (dir: string) => join(dir, '.buildpact', 'constitution.md')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('constitutionExists', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-constitution-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns false when .buildpact/constitution.md does not exist', async () => {
    const result = await constitutionExists(tmpDir)
    expect(result).toBe(false)
  })

  it('returns true when .buildpact/constitution.md exists', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(CONSTITUTION_PATH(tmpDir), '# Constitution', 'utf-8')
    const result = await constitutionExists(tmpDir)
    expect(result).toBe(true)
  })
})

describe('loadConstitution', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-constitution-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns CONSTITUTION_NOT_FOUND when file does not exist', async () => {
    const result = await loadConstitution(tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONSTITUTION_NOT_FOUND')
    }
  })

  it('returns ok(content) when file exists', async () => {
    const content = '# My Constitution\n\n## Coding Standards\n- Use TypeScript\n'
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(CONSTITUTION_PATH(tmpDir), content, 'utf-8')
    const result = await loadConstitution(tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(content)
    }
  })

  it('returns FILE_READ_FAILED when file is unreadable (non-ENOENT)', async () => {
    // Create constitution.md as a directory to cause EISDIR
    await mkdir(CONSTITUTION_PATH(tmpDir), { recursive: true })
    const result = await loadConstitution(tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_READ_FAILED')
    }
  })
})

describe('saveConstitution', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-constitution-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('saves constitution content to .buildpact/constitution.md', async () => {
    const content = '# Constitution\n\n## Standards\n- TypeScript strict\n'
    const result = await saveConstitution(tmpDir, content)
    expect(result.ok).toBe(true)

    const { readFile } = await import('node:fs/promises')
    const saved = await readFile(CONSTITUTION_PATH(tmpDir), 'utf-8')
    expect(saved).toBe(content)
  })

  it('returns CONSTITUTION_EMPTY when content is empty string', async () => {
    const result = await saveConstitution(tmpDir, '')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONSTITUTION_EMPTY')
    }
  })

  it('returns CONSTITUTION_EMPTY when content is only whitespace', async () => {
    const result = await saveConstitution(tmpDir, '   \n\t  ')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONSTITUTION_EMPTY')
    }
  })

  it('returns FILE_WRITE_FAILED when write fails (path is unwritable)', async () => {
    // Use a path where .buildpact is a file, not a directory
    const blockerDir = await mkdtemp(join(tmpdir(), 'buildpact-blocker-'))
    await writeFile(join(blockerDir, '.buildpact'), 'not a dir', 'utf-8')
    const result = await saveConstitution(blockerDir, '# Constitution')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_WRITE_FAILED')
    }
    await rm(blockerDir, { recursive: true, force: true })
  })

  it('overwrites existing constitution content', async () => {
    await writeFile(CONSTITUTION_PATH(tmpDir), '# Old Constitution', 'utf-8')
    const newContent = '# New Constitution\n'
    const result = await saveConstitution(tmpDir, newContent)
    expect(result.ok).toBe(true)

    const { readFile } = await import('node:fs/promises')
    const saved = await readFile(CONSTITUTION_PATH(tmpDir), 'utf-8')
    expect(saved).toBe(newContent)
  })
})
