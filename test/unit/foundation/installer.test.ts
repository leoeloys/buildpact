import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { install, type InstallOptions } from '../../../src/foundation/installer.js'

// Resolve templates directory relative to project root (CWD when running Vitest)
const TEMPLATES_DIR = resolve(process.cwd(), 'templates')

/** Helper: check a path exists */
async function exists(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

describe('install', () => {
  let tmpDir: string
  let projectDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-install-'))
    projectDir = join(tmpDir, 'my-project')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  // Factory: evaluated lazily so projectDir is set by beforeEach
  const opts = (overrides: Partial<InstallOptions> = {}): InstallOptions => ({
    projectName: 'my-project',
    language: 'en',
    domain: 'software',
    ides: ['claude-code'],
    experienceLevel: 'intermediate',
    installSquad: true,
    projectDir,
    templatesDir: TEMPLATES_DIR,
    ...overrides,
  })

  it('creates .buildpact/ directory with required files', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.buildpact'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'constitution.md'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'config.yaml'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'project-context.md'))).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'audit'))).toBe(true)
  })

  it('generates Claude Code config directory when selected', async () => {
    const result = await install(opts({ ides: ['claude-code'] }))
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.claude', 'commands'))).toBe(true)
  })

  it('generates Cursor config when selected', async () => {
    const result = await install(opts({ ides: ['cursor'] }))
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.cursor', 'rules'))).toBe(true)
    expect(await exists(join(projectDir, '.cursorrules'))).toBe(true)
  })

  it('generates Gemini CLI config when selected', async () => {
    const result = await install(opts({ ides: ['gemini'] }))
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.gemini'))).toBe(true)
  })

  it('generates Codex config when selected', async () => {
    const result = await install(opts({ ides: ['codex'] }))
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.codex'))).toBe(true)
  })

  it('generates multiple IDE configs simultaneously', async () => {
    const result = await install(opts({ ides: ['claude-code', 'cursor'] }))
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.claude', 'commands'))).toBe(true)
    expect(await exists(join(projectDir, '.cursor', 'rules'))).toBe(true)
  })

  it('generates CLAUDE.md when claude-code is selected', async () => {
    const result = await install(opts({ ides: ['claude-code'] }))
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, 'CLAUDE.md'))).toBe(true)
  })

  it('interpolates project name into config.yaml', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    const config = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(config).toContain('my-project')
  })

  it('installs bundled Software Squad when squad install requested', async () => {
    const result = await install(opts({ installSquad: true }))
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'squads', 'software', 'squad.yaml'))).toBe(true)
  })

  it('skips Squad installation when not requested', async () => {
    const result = await install(opts({ installSquad: false }))
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, '.buildpact', 'squads'))).toBe(false)
  })

  it('returns list of installed resources', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.installedResources.length).toBeGreaterThan(0)
    }
  })

  it('creates DECISIONS.md in project root', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, 'DECISIONS.md'))).toBe(true)
  })

  it('creates STATUS.md in project root', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    expect(await exists(join(projectDir, 'STATUS.md'))).toBe(true)
  })

  it('DECISIONS.md contains project name', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    const content = await readFile(join(projectDir, 'DECISIONS.md'), 'utf-8')
    expect(content).toContain('my-project')
  })

  it('STATUS.md contains project name', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    const content = await readFile(join(projectDir, 'STATUS.md'), 'utf-8')
    expect(content).toContain('my-project')
  })

  it('installedResources includes DECISIONS.md and STATUS.md', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.installedResources).toContain('DECISIONS.md')
      expect(result.value.installedResources).toContain('STATUS.md')
    }
  })

  it('logs audit entries for install steps', async () => {
    const result = await install(opts())
    expect(result.ok).toBe(true)
    const auditLog = join(projectDir, '.buildpact', 'audit', 'install.jsonl')
    expect(await exists(auditLog)).toBe(true)
    const content = await readFile(auditLog, 'utf-8')
    expect(content.trim().length).toBeGreaterThan(0)
  })
})
