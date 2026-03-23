import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listPendingMigrations,
  runMigrations,
  MIGRATIONS,
} from '../../../src/foundation/migrator.js'
import { CURRENT_SCHEMA_VERSION } from '../../../src/foundation/version-guard.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

async function makeTmpProject(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), 'buildpact-migrator-'))
  await mkdir(join(tmp, '.buildpact', 'audit'), { recursive: true })
  return tmp
}

async function writeConfig(dir: string, content: string): Promise<void> {
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
// listPendingMigrations
// ---------------------------------------------------------------------------

describe('listPendingMigrations', () => {
  it('returns empty array when already current', () => {
    const result = listPendingMigrations(CURRENT_SCHEMA_VERSION)
    expect(result).toEqual([])
  })

  it('returns migration 0->1 when currentSchema is 0', () => {
    const result = listPendingMigrations(0, 1)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].fromSchema).toBe(0)
    expect(result[0].toSchema).toBe(1)
  })

  it('returns all migrations between a range', () => {
    const all = listPendingMigrations(0, CURRENT_SCHEMA_VERSION)
    // Should include the 0->1 migration at minimum
    expect(all.length).toBe(MIGRATIONS.filter(m => m.fromSchema >= 0 && m.toSchema <= CURRENT_SCHEMA_VERSION).length)
  })
})

// ---------------------------------------------------------------------------
// runMigrations
// ---------------------------------------------------------------------------

describe('runMigrations', () => {
  it('with schema 0 adds buildpact_schema to config.yaml', async () => {
    await writeConfig(tmpDir, '# BuildPact config\nproject_name: "test"\n')

    const result = await runMigrations(tmpDir, 0, 1)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.migrationsRun).toBe(1)
    expect(result.value.fromSchema).toBe(0)
    expect(result.value.toSchema).toBe(1)

    const content = await readFile(join(tmpDir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(content).toContain('buildpact_schema:')
    expect(content).toContain('created_by_cli:')
    expect(content).toContain('last_upgraded_by_cli:')
  })

  it('returns ok with migrationsRun=0 when already current', async () => {
    await writeConfig(tmpDir, `buildpact_schema: ${CURRENT_SCHEMA_VERSION}\n`)

    const result = await runMigrations(tmpDir, CURRENT_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.migrationsRun).toBe(0)
    expect(result.value.results).toEqual([])
  })

  it('creates audit log entries', async () => {
    await writeConfig(tmpDir, '# BuildPact config\nproject_name: "test"\n')

    await runMigrations(tmpDir, 0, 1)

    const auditPath = join(tmpDir, '.buildpact', 'audit', 'upgrade.jsonl')
    const auditContent = await readFile(auditPath, 'utf-8')
    const lines = auditContent.trim().split('\n').filter(l => l.trim())

    expect(lines.length).toBeGreaterThanOrEqual(2)

    const entries = lines.map(l => JSON.parse(l))
    const actions = entries.map((e: { action: string }) => e.action)
    expect(actions).toContain('upgrade.migration.start')
    expect(actions).toContain('upgrade.migration.complete')
  })

  it('preserves existing config content after migration', async () => {
    await writeConfig(tmpDir, '# My project\nproject_name: "my-app"\nlanguage: "en"\n')

    await runMigrations(tmpDir, 0, 1)

    const content = await readFile(join(tmpDir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(content).toContain('project_name: "my-app"')
    expect(content).toContain('language: "en"')
    expect(content).toContain('buildpact_schema:')
  })

  it('migration result includes modified files', async () => {
    await writeConfig(tmpDir, 'project_name: "test"\n')

    const result = await runMigrations(tmpDir, 0, 1)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.results.length).toBe(1)
    expect(result.value.results[0].filesModified).toContain('.buildpact/config.yaml')
  })
})
