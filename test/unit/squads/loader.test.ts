import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  readSquadManifest,
  buildAgentIndex,
  loadAgentDefinition,
} from '../../../src/squads/loader.js'
import type { AgentIndex } from '../../../src/squads/loader.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string | undefined

async function createTmp(): Promise<string> {
  tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-loader-test-'))
  return tmpDir
}

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true })
    tmpDir = undefined
  }
})

const VALID_SQUAD_YAML = `# Squad Manifest — test-squad
name: test-squad
version: "0.1.0"
domain: software
description: "Test squad for loader tests"
initial_level: L2

agents:
  chief:
    file: agents/chief.md
  specialist:
    file: agents/specialist.md
  support:
    file: agents/support.md
`

async function scaffoldSquad(dir: string, yaml = VALID_SQUAD_YAML): Promise<void> {
  await writeFile(join(dir, 'squad.yaml'), yaml, 'utf-8')
  await mkdir(join(dir, 'agents'), { recursive: true })
}

// ---------------------------------------------------------------------------
// 4.1 readSquadManifest — parses valid squad.yaml
// ---------------------------------------------------------------------------

describe('readSquadManifest', () => {
  it('parses all scalar fields from a valid squad.yaml', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)

    const result = await readSquadManifest(dir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.name).toBe('test-squad')
    expect(result.value.version).toBe('0.1.0')
    expect(result.value.domain).toBe('software')
    expect(result.value.description).toBe('Test squad for loader tests')
    expect(result.value.initial_level).toBe('L2')
  })

  it('parses agent file refs from squad.yaml', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)

    const result = await readSquadManifest(dir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.agents['chief']).toEqual({ file: 'agents/chief.md' })
    expect(result.value.agents['specialist']).toEqual({ file: 'agents/specialist.md' })
    expect(result.value.agents['support']).toEqual({ file: 'agents/support.md' })
  })

  it('parses initial_level L1', async () => {
    const dir = await createTmp()
    const yaml = VALID_SQUAD_YAML.replace('initial_level: L2', 'initial_level: L1')
    await scaffoldSquad(dir, yaml)

    const result = await readSquadManifest(dir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.initial_level).toBe('L1')
  })

  // 4.2 — err() when squad.yaml missing
  it('returns err when squad.yaml does not exist', async () => {
    const dir = await createTmp()

    const result = await readSquadManifest(dir)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('FILE_READ_FAILED')
  })

  it('returns err when required field name is missing', async () => {
    const dir = await createTmp()
    const yaml = VALID_SQUAD_YAML.replace('name: test-squad\n', '')
    await scaffoldSquad(dir, yaml)

    const result = await readSquadManifest(dir)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('SQUAD_VALIDATION_FAILED')
  })
})

// ---------------------------------------------------------------------------
// 4.3 buildAgentIndex — identifies chief correctly, rest as specialists
// ---------------------------------------------------------------------------

describe('buildAgentIndex', () => {
  it('places agent named chief into index.chief', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)

    const manifest = await readSquadManifest(dir)
    expect(manifest.ok).toBe(true)
    if (!manifest.ok) return

    const index = buildAgentIndex(manifest.value)

    expect(index.chief.id).toBe('chief')
    expect(index.chief.file).toBe('agents/chief.md')
    expect(index.chief.level).toBe('L2')
  })

  it('places all non-chief agents into specialists array', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)

    const manifest = await readSquadManifest(dir)
    expect(manifest.ok).toBe(true)
    if (!manifest.ok) return

    const index = buildAgentIndex(manifest.value)

    const specialistIds = index.specialists.map(s => s.id)
    expect(specialistIds).toContain('specialist')
    expect(specialistIds).toContain('support')
    expect(specialistIds).not.toContain('chief')
  })

  it('includes squad_name and squad_version in index', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)

    const manifest = await readSquadManifest(dir)
    expect(manifest.ok).toBe(true)
    if (!manifest.ok) return

    const index = buildAgentIndex(manifest.value)

    expect(index.squad_name).toBe('test-squad')
    expect(index.squad_version).toBe('0.1.0')
  })

  it('uses manifest initial_level as agent level', async () => {
    const dir = await createTmp()
    const yaml = VALID_SQUAD_YAML.replace('initial_level: L2', 'initial_level: L3')
    await scaffoldSquad(dir, yaml)

    const manifest = await readSquadManifest(dir)
    expect(manifest.ok).toBe(true)
    if (!manifest.ok) return

    const index = buildAgentIndex(manifest.value)

    expect(index.chief.level).toBe('L3')
    expect(index.specialists.every(s => s.level === 'L3')).toBe(true)
  })

  // 4.4 — serializes to ≤1KB
  it('serializes to ≤1KB (FR-906 constraint)', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)

    const manifest = await readSquadManifest(dir)
    expect(manifest.ok).toBe(true)
    if (!manifest.ok) return

    const index: AgentIndex = buildAgentIndex(manifest.value)
    const serialized = JSON.stringify(index)

    expect(serialized.length).toBeLessThanOrEqual(1024)
  })
})

// ---------------------------------------------------------------------------
// 4.5 loadAgentDefinition — reads agent markdown content
// ---------------------------------------------------------------------------

describe('loadAgentDefinition', () => {
  it('returns the content of an agent markdown file', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)
    await writeFile(join(dir, 'agents', 'chief.md'), '# Chief Agent\n## Identity\nI am the Chief.', 'utf-8')

    const manifest = await readSquadManifest(dir)
    expect(manifest.ok).toBe(true)
    if (!manifest.ok) return

    const index = buildAgentIndex(manifest.value)
    const result = await loadAgentDefinition(dir, index.chief)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toContain('# Chief Agent')
    expect(result.value).toContain('I am the Chief.')
  })

  it('returns content for a specialist agent', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)
    await writeFile(join(dir, 'agents', 'specialist.md'), '# Specialist\n## Identity\nDomain expert.', 'utf-8')

    const manifest = await readSquadManifest(dir)
    expect(manifest.ok).toBe(true)
    if (!manifest.ok) return

    const index = buildAgentIndex(manifest.value)
    const spec = index.specialists.find(s => s.id === 'specialist')!
    const result = await loadAgentDefinition(dir, spec)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toContain('Domain expert.')
  })

  // 4.6 — err() when agent file missing
  it('returns err when agent file does not exist', async () => {
    const dir = await createTmp()
    await scaffoldSquad(dir)
    // agents/chief.md NOT written to disk

    const manifest = await readSquadManifest(dir)
    expect(manifest.ok).toBe(true)
    if (!manifest.ok) return

    const index = buildAgentIndex(manifest.value)
    const result = await loadAgentDefinition(dir, index.chief)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AGENT_LOAD_FAILED')
  })
})
