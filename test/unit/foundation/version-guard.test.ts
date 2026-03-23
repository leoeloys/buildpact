import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  readProjectSchema,
  checkProjectVersion,
  CURRENT_SCHEMA_VERSION,
  MAX_READABLE_SCHEMA,
} from '../../../src/foundation/version-guard.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

async function makeTmpProject(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), 'buildpact-vguard-'))
  return tmp
}

async function writeConfig(dir: string, content: string): Promise<void> {
  await mkdir(join(dir, '.buildpact'), { recursive: true })
  await writeFile(join(dir, '.buildpact', 'config.yaml'), content, 'utf-8')
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  tmpDir = await makeTmpProject()
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// readProjectSchema
// ---------------------------------------------------------------------------

describe('readProjectSchema', () => {
  it('returns number when buildpact_schema exists in config.yaml', async () => {
    await writeConfig(tmpDir, 'buildpact_schema: 1\nproject_name: "test"\n')
    const result = await readProjectSchema(tmpDir)
    expect(result).toBe(1)
  })

  it('returns null when key is absent', async () => {
    await writeConfig(tmpDir, 'project_name: "test"\nlanguage: "en"\n')
    const result = await readProjectSchema(tmpDir)
    expect(result).toBeNull()
  })

  it('returns null when file does not exist', async () => {
    const result = await readProjectSchema(tmpDir)
    expect(result).toBeNull()
  })

  it('handles quoted values like "1"', async () => {
    await writeConfig(tmpDir, 'buildpact_schema: "1"\nproject_name: "test"\n')
    const result = await readProjectSchema(tmpDir)
    expect(result).toBe(1)
  })

  it('handles single-quoted values', async () => {
    await writeConfig(tmpDir, "buildpact_schema: '1'\nproject_name: \"test\"\n")
    const result = await readProjectSchema(tmpDir)
    expect(result).toBe(1)
  })

  it('returns null for non-numeric value', async () => {
    await writeConfig(tmpDir, 'buildpact_schema: abc\n')
    const result = await readProjectSchema(tmpDir)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// checkProjectVersion
// ---------------------------------------------------------------------------

describe('checkProjectVersion', () => {
  it('returns no_project when .buildpact/ does not exist', async () => {
    const result = await checkProjectVersion(tmpDir)
    expect(result.status).toBe('no_project')
  })

  it('returns no_schema when config exists but no schema key', async () => {
    await writeConfig(tmpDir, 'project_name: "legacy"\nlanguage: "en"\n')
    const result = await checkProjectVersion(tmpDir)
    expect(result.status).toBe('no_schema')
  })

  it('returns compatible when schema matches CURRENT_SCHEMA_VERSION', async () => {
    await writeConfig(tmpDir, `buildpact_schema: ${CURRENT_SCHEMA_VERSION}\nproject_name: "test"\n`)
    const result = await checkProjectVersion(tmpDir)
    expect(result.status).toBe('compatible')
  })

  it('returns upgrade_available when schema < CURRENT_SCHEMA_VERSION', async () => {
    // Only valid if CURRENT_SCHEMA_VERSION > 0
    if (CURRENT_SCHEMA_VERSION <= 0) return
    await writeConfig(tmpDir, 'buildpact_schema: 0\nproject_name: "test"\n')
    const result = await checkProjectVersion(tmpDir)
    expect(result.status).toBe('upgrade_available')
    if (result.status === 'upgrade_available') {
      expect(result.projectSchema).toBe(0)
      expect(result.cliSchema).toBe(CURRENT_SCHEMA_VERSION)
    }
  })

  it('returns cli_too_old when schema > MAX_READABLE_SCHEMA', async () => {
    const futureSchema = MAX_READABLE_SCHEMA + 1
    await writeConfig(tmpDir, `buildpact_schema: ${futureSchema}\nproject_name: "test"\n`)
    const result = await checkProjectVersion(tmpDir)
    expect(result.status).toBe('cli_too_old')
    if (result.status === 'cli_too_old') {
      expect(result.projectSchema).toBe(futureSchema)
      expect(result.cliSchema).toBe(CURRENT_SCHEMA_VERSION)
    }
  })
})
