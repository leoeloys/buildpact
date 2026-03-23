import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readExperienceLevel } from '../../../src/foundation/context.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'bp-ctx-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('readExperienceLevel', () => {
  it('reads experience_level from frontmatter', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), [
      '---',
      'project_name: "test"',
      'experience_level: "expert"',
      '---',
      '',
      '# Project',
    ].join('\n'))

    const level = await readExperienceLevel(tmpDir)
    expect(level).toBe('expert')
  })

  it('reads unquoted experience_level', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), [
      '---',
      'experience_level: beginner',
      '---',
    ].join('\n'))

    const level = await readExperienceLevel(tmpDir)
    expect(level).toBe('beginner')
  })

  it('returns intermediate when file does not exist', async () => {
    const level = await readExperienceLevel(tmpDir)
    expect(level).toBe('intermediate')
  })

  it('returns intermediate when field is missing from frontmatter', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), [
      '---',
      'project_name: "test"',
      '---',
    ].join('\n'))

    const level = await readExperienceLevel(tmpDir)
    expect(level).toBe('intermediate')
  })

  it('returns intermediate for empty file', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), '')

    const level = await readExperienceLevel(tmpDir)
    expect(level).toBe('intermediate')
  })

  it('reads single-quoted value', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), [
      "---",
      "experience_level: 'intermediate'",
      "---",
    ].join('\n'))

    const level = await readExperienceLevel(tmpDir)
    expect(level).toBe('intermediate')
  })
})
