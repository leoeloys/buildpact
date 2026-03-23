import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listAvailablePacks,
  mergeConstitutionRules,
  installPack,
} from '../../../src/engine/expansion-packs.js'
import type { ExpansionPack } from '../../../src/engine/expansion-packs.js'

// ---------------------------------------------------------------------------
// listAvailablePacks
// ---------------------------------------------------------------------------

describe('listAvailablePacks', () => {
  it('returns all four built-in packs', () => {
    const packs = listAvailablePacks()
    expect(packs).toHaveLength(4)
    const names = packs.map((p) => p.name)
    expect(names).toContain('healthcare')
    expect(names).toContain('legal')
    expect(names).toContain('education')
    expect(names).toContain('fintech')
  })

  it('each pack has non-empty constitution rules', () => {
    for (const pack of listAvailablePacks()) {
      expect(pack.constitutionRules.length).toBeGreaterThan(0)
    }
  })

  it('returns a copy — mutations do not affect original', () => {
    const packs = listAvailablePacks()
    packs.pop()
    expect(listAvailablePacks()).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// mergeConstitutionRules
// ---------------------------------------------------------------------------

describe('mergeConstitutionRules', () => {
  it('appends domain rules section to existing constitution', () => {
    const existing = '# Constitution\n\n## Core Rules\n\n- Be safe'
    const merged = mergeConstitutionRules(existing, ['No PHI in logs'])
    expect(merged).toContain('## Domain Rules')
    expect(merged).toContain('- No PHI in logs')
    expect(merged).toContain('## Core Rules')
  })

  it('appends to existing domain rules section', () => {
    const existing = '# Constitution\n\n## Domain Rules\n\n- Rule A\n'
    const merged = mergeConstitutionRules(existing, ['Rule B'])
    expect(merged).toContain('- Rule A')
    expect(merged).toContain('- Rule B')
  })

  it('returns original when no new rules', () => {
    const existing = '# My Constitution'
    expect(mergeConstitutionRules(existing, [])).toBe(existing)
  })

  it('handles empty existing constitution', () => {
    const merged = mergeConstitutionRules('', ['First rule'])
    expect(merged).toContain('## Domain Rules')
    expect(merged).toContain('- First rule')
  })
})

// ---------------------------------------------------------------------------
// installPack
// ---------------------------------------------------------------------------

describe('installPack', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-pack-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  const testPack: ExpansionPack = {
    name: 'test-pack',
    domain: 'testing',
    description: 'A test expansion pack',
    squadName: 'test-squad',
    constitutionRules: ['Tests must pass before commit'],
    exampleSpecs: ['Example spec'],
  }

  it('installs constitution rules and squad', async () => {
    const result = await installPack(testPack, tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.constitutionMerged).toBe(true)
    expect(result.value.squadInstalled).toBe(true)
  })

  it('creates constitution.md with domain rules', async () => {
    await installPack(testPack, tmpDir)
    const content = await readFile(
      join(tmpDir, '.buildpact', 'constitution.md'),
      'utf-8',
    )
    expect(content).toContain('Tests must pass before commit')
  })

  it('creates squad.yaml in squad directory', async () => {
    await installPack(testPack, tmpDir)
    const yaml = await readFile(
      join(tmpDir, '.buildpact', 'squads', 'test-squad', 'squad.yaml'),
      'utf-8',
    )
    expect(yaml).toContain('name: test-squad')
    expect(yaml).toContain('domain: testing')
  })

  it('merges with existing constitution', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'constitution.md'),
      '# My Constitution\n\n## Core Rules\n\n- Existing rule\n',
    )

    await installPack(testPack, tmpDir)
    const content = await readFile(
      join(tmpDir, '.buildpact', 'constitution.md'),
      'utf-8',
    )
    expect(content).toContain('- Existing rule')
    expect(content).toContain('Tests must pass before commit')
  })

  it('does not overwrite existing squads', async () => {
    const otherSquadDir = join(tmpDir, '.buildpact', 'squads', 'other')
    await mkdir(otherSquadDir, { recursive: true })
    await writeFile(join(otherSquadDir, 'squad.yaml'), 'name: other')

    await installPack(testPack, tmpDir)

    const otherYaml = await readFile(join(otherSquadDir, 'squad.yaml'), 'utf-8')
    expect(otherYaml).toContain('name: other')
  })
})
