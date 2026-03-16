import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createI18n } from '../../../src/foundation/i18n.js'
import { checkNodeVersion, checkGitAvailable, checkBuildpactDir, checkIdeConfigs, checkSquadIntegrity } from '../../../src/commands/doctor/checks.js'

/** Create a fully healthy .buildpact project structure in tempDir */
async function createHealthyProject(dir: string): Promise<void> {
  const bpDir = join(dir, '.buildpact')
  await mkdir(join(bpDir, 'audit'), { recursive: true })
  await mkdir(join(bpDir, 'squads', 'software', 'agents'), { recursive: true })
  await writeFile(join(bpDir, 'constitution.md'), '# Constitution\n')
  await writeFile(join(bpDir, 'config.yaml'), 'language: en\nexperience_level: intermediate\nactive_squad: software\n')
  await writeFile(join(bpDir, 'project-context.md'), '# Project Context\n')
  await writeFile(join(bpDir, 'squads', 'software', 'squad.yaml'), [
    'name: software',
    'version: 0.1.0',
    'domain: software',
    'description: Full-stack software development squad',
    'initial_level: L2',
  ].join('\n'))

  // IDE configs
  await mkdir(join(dir, '.claude', 'commands'), { recursive: true })
  await mkdir(join(dir, '.cursor', 'rules'), { recursive: true })
}

describe('Doctor Flow — AC-1: Five-Point Health Check', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'buildpact-doctor-flow-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('all checks pass for a healthy project', async () => {
    await createHealthyProject(tempDir)
    const i18n = createI18n('en')

    const nodeResult = checkNodeVersion(i18n)
    const gitResult = checkGitAvailable(i18n)
    const dirResult = await checkBuildpactDir(tempDir, i18n)
    const ideResult = await checkIdeConfigs(tempDir, i18n)
    const squadResult = await checkSquadIntegrity(tempDir, i18n)

    const results = [nodeResult, gitResult, dirResult, ideResult, squadResult]
    const failCount = results.filter(r => r.status === 'fail').length

    // Node + Git should pass in any CI/test env with Node 20+ and git installed
    expect(nodeResult.status).not.toBe('fail')
    expect(gitResult.status).toBe('pass')
    expect(dirResult.status).toBe('pass')
    expect(ideResult.status).toBe('pass')
    expect(squadResult.status).toBe('pass')
    expect(failCount).toBe(0)
  })

  it('detects missing .buildpact structure', async () => {
    // Empty dir — no .buildpact/
    const i18n = createI18n('en')

    const dirResult = await checkBuildpactDir(tempDir, i18n)
    expect(dirResult.status).toBe('fail')
    expect(dirResult.remediation).toBeDefined()
  })
})

describe('Doctor Flow — AC-2: Actionable Remediation', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'buildpact-doctor-flow-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('provides remediation for every FAIL check', async () => {
    // Create partial structure — missing constitution.md
    const bpDir = join(tempDir, '.buildpact')
    await mkdir(join(bpDir, 'audit'), { recursive: true })
    await writeFile(join(bpDir, 'config.yaml'), 'language: en')
    await writeFile(join(bpDir, 'project-context.md'), '# Context')

    const i18n = createI18n('en')
    const dirResult = await checkBuildpactDir(tempDir, i18n)

    expect(dirResult.status).toBe('fail')
    expect(dirResult.remediation).toContain('buildpact init')
  })

  it('provides remediation for squad validation failures', async () => {
    const squadDir = join(tempDir, '.buildpact', 'squads', 'bad')
    await mkdir(squadDir, { recursive: true })
    await writeFile(join(squadDir, 'squad.yaml'), 'name: bad\n')

    const i18n = createI18n('en')
    const result = await checkSquadIntegrity(tempDir, i18n)

    expect(result.status).toBe('fail')
    expect(result.remediation).toContain('squad.yaml')
  })
})

describe('Doctor Flow — AC-3: Bilingual Output', () => {
  it('resolves i18n keys in English', () => {
    const i18n = createI18n('en')
    const result = checkNodeVersion(i18n)
    // Should contain actual English text, not a [KEY_NAME] fallback
    expect(result.message).not.toMatch(/^\[/)
  })

  it('resolves i18n keys in Portuguese', () => {
    const i18n = createI18n('pt-br')
    const result = checkNodeVersion(i18n)
    // Should contain actual Portuguese text, not a [KEY_NAME] fallback
    expect(result.message).not.toMatch(/^\[/)
  })

  it('all doctor i18n keys exist in both languages', () => {
    const en = createI18n('en')
    const ptBr = createI18n('pt-br')

    const keys = [
      'cli.doctor.title',
      'cli.doctor.node_pass',
      'cli.doctor.node_warn',
      'cli.doctor.node_fail',
      'cli.doctor.node_fix',
      'cli.doctor.git_pass',
      'cli.doctor.git_fail',
      'cli.doctor.git_fix',
      'cli.doctor.dir_pass',
      'cli.doctor.dir_fail',
      'cli.doctor.dir_fix',
      'cli.doctor.ide_pass',
      'cli.doctor.ide_warn',
      'cli.doctor.ide_fix',
      'cli.doctor.squad_pass',
      'cli.doctor.squad_warn',
      'cli.doctor.squad_fail',
      'cli.doctor.squad_fix',
      'cli.doctor.summary_healthy',
      'cli.doctor.summary_issues',
    ]

    for (const key of keys) {
      const enValue = en.t(key)
      const ptBrValue = ptBr.t(key)
      // Should NOT return fallback format [KEY_NAME]
      expect(enValue, `EN missing: ${key}`).not.toMatch(/^\[/)
      expect(ptBrValue, `PT-BR missing: ${key}`).not.toMatch(/^\[/)
    }
  })
})
