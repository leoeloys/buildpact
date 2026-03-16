/**
 * Integration test: full init flow, multi-IDE output, offline fallback
 * Tests AC-1, AC-2, AC-3 end-to-end
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, access, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { install } from '../../../src/foundation/installer.js'

const TEMPLATES_DIR = resolve(process.cwd(), 'templates')

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

describe('AC-1: Basic init flow', () => {
  let tmpDir: string
  let projectDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-int-'))
    projectDir = join(tmpDir, 'my-project')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates complete .buildpact/ structure with all required files', async () => {
    const result = await install({
      projectName: 'my-project',
      language: 'en',
      domain: 'software',
      ides: ['claude-code'],
      experienceLevel: 'intermediate',
      installSquad: true,
      projectDir,
      templatesDir: TEMPLATES_DIR,
    })

    expect(result.ok).toBe(true)

    // Core .buildpact/ structure
    expect(await exists(join(projectDir, '.buildpact', 'constitution.md'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'config.yaml'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'project-context.md'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'audit'))).toBe(true)
  })

  it('completes within a reasonable time (well under 60s SLA)', async () => {
    const start = Date.now()
    const result = await install({
      projectName: 'perf-test',
      language: 'en',
      domain: 'software',
      ides: ['claude-code', 'cursor'],
      experienceLevel: 'expert',
      installSquad: true,
      projectDir,
      templatesDir: TEMPLATES_DIR,
    })
    const elapsed = Date.now() - start

    expect(result.ok).toBe(true)
    // Local install should be well under 5 seconds (network fetch is mocked by using bundled squad)
    expect(elapsed).toBeLessThan(5000)
  })

  it('generates audit log with at least one entry per install step', async () => {
    const result = await install({
      projectName: 'my-project',
      language: 'pt-br',
      domain: 'software',
      ides: ['claude-code'],
      experienceLevel: 'beginner',
      installSquad: false,
      projectDir,
      templatesDir: TEMPLATES_DIR,
    })

    expect(result.ok).toBe(true)
    const auditLog = join(projectDir, '.buildpact', 'audit', 'install.jsonl')
    const content = await readFile(auditLog, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    // Must have multiple entries: start + constitution + config + context + complete
    expect(lines.length).toBeGreaterThanOrEqual(4)

    // Every line must be valid JSON with required fields
    for (const line of lines) {
      const entry = JSON.parse(line) as Record<string, unknown>
      expect(entry).toHaveProperty('ts')
      expect(entry).toHaveProperty('action')
      expect(entry).toHaveProperty('agent')
      expect(entry).toHaveProperty('outcome')
    }
  })
})

describe('AC-2: Multi-IDE configuration', () => {
  let tmpDir: string
  let projectDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-int-'))
    projectDir = join(tmpDir, 'multi-ide-project')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('generates all IDE configs simultaneously for Claude Code + Cursor', async () => {
    const result = await install({
      projectName: 'multi-ide-project',
      language: 'en',
      domain: 'software',
      ides: ['claude-code', 'cursor'],
      experienceLevel: 'intermediate',
      installSquad: false,
      projectDir,
      templatesDir: TEMPLATES_DIR,
    })

    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.claude', 'commands'))).toBe(true)
    expect(await exists(join(projectDir, 'CLAUDE.md'))).toBe(true)
    expect(await exists(join(projectDir, '.cursor', 'rules'))).toBe(true)
    expect(await exists(join(projectDir, '.cursorrules'))).toBe(true)
  })

  it('generates all four IDE configs simultaneously', async () => {
    const result = await install({
      projectName: 'multi-ide-project',
      language: 'en',
      domain: 'software',
      ides: ['claude-code', 'cursor', 'gemini', 'codex'],
      experienceLevel: 'expert',
      installSquad: false,
      projectDir,
      templatesDir: TEMPLATES_DIR,
    })

    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.claude', 'commands'))).toBe(true)
    expect(await exists(join(projectDir, '.cursor', 'rules'))).toBe(true)
    expect(await exists(join(projectDir, '.gemini'))).toBe(true)
    expect(await exists(join(projectDir, '.codex'))).toBe(true)
  })
})

describe('AC-3: Offline fallback — bundled Software Squad', () => {
  let tmpDir: string
  let projectDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-int-'))
    projectDir = join(tmpDir, 'offline-project')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('installs bundled Software Squad without network access', async () => {
    // The install function uses the bundled templates/ directory — no network needed
    const result = await install({
      projectName: 'offline-project',
      language: 'en',
      domain: 'software',
      ides: ['claude-code'],
      experienceLevel: 'intermediate',
      installSquad: true,
      projectDir,
      templatesDir: TEMPLATES_DIR,
    })

    expect(result.ok).toBe(true)
    // Squad installed from bundled templates
    expect(await exists(join(projectDir, '.buildpact', 'squads', 'software', 'squad.yaml'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'squads', 'software', 'agents', 'pm.md'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'squads', 'software', 'README.md'))).toBe(true)

    if (result.ok) {
      expect(result.value.bundledResources).toContain('squads/software (bundled)')
    }
  })
})
