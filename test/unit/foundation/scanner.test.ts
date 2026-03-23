import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject, formatScanSummary } from '../../../src/foundation/scanner.js'
import type { ScanResult } from '../../../src/foundation/scanner.js'

// ---------------------------------------------------------------------------
// Mock child_process to avoid real git calls in temp dirs
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => {
    throw new Error('not a git repo')
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

async function makeTmpProject(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), 'buildpact-scanner-'))
  return tmp
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
// scanProject — package manager detection
// ---------------------------------------------------------------------------

describe('scanProject — package managers', () => {
  it('detects package.json as npm', async () => {
    await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }), 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.packageManagers.length).toBe(1)
    expect(result.packageManagers[0].name).toBe('npm')
    expect(result.packageManagers[0].configFile).toBe('package.json')
    expect(result.packageManagers[0].projectName).toBe('test-app')
  })

  it('detects pnpm-lock.yaml as pnpm', async () => {
    await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'pnpm-app' }), 'utf-8')
    await writeFile(join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 5\n', 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.packageManagers[0].name).toBe('pnpm')
  })

  it('uses project name from package.json', async () => {
    await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'my-cool-project' }), 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.projectName).toBe('my-cool-project')
  })
})

// ---------------------------------------------------------------------------
// scanProject — language detection
// ---------------------------------------------------------------------------

describe('scanProject — languages', () => {
  it('detects tsconfig.json as TypeScript', async () => {
    await writeFile(join(tmpDir, 'tsconfig.json'), '{}', 'utf-8')
    await writeFile(join(tmpDir, 'package.json'), '{}', 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.languages).toContain('TypeScript')
  })

  it('detects package.json without tsconfig as JavaScript', async () => {
    await writeFile(join(tmpDir, 'package.json'), '{}', 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.languages).toContain('JavaScript')
    expect(result.languages).not.toContain('TypeScript')
  })

  it('detects Cargo.toml as Rust', async () => {
    await writeFile(join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"\n', 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.languages).toContain('Rust')
  })
})

// ---------------------------------------------------------------------------
// scanProject — linter detection
// ---------------------------------------------------------------------------

describe('scanProject — linters', () => {
  it('detects .eslintrc.json as eslint linter', async () => {
    await writeFile(join(tmpDir, '.eslintrc.json'), '{}', 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.linters.length).toBeGreaterThanOrEqual(1)
    const eslint = result.linters.find(l => l.tool === 'eslint')
    expect(eslint).toBeDefined()
    expect(eslint!.configFile).toBe('.eslintrc.json')
  })

  it('detects eslint.config.js as eslint with flat config', async () => {
    await writeFile(join(tmpDir, 'eslint.config.js'), 'export default []', 'utf-8')

    const result = await scanProject(tmpDir)

    const eslint = result.linters.find(l => l.tool === 'eslint')
    expect(eslint).toBeDefined()
    expect(eslint!.extractedRules).toContain('flat config')
  })

  it('detects .prettierrc as prettier', async () => {
    await writeFile(join(tmpDir, '.prettierrc'), '{}', 'utf-8')

    const result = await scanProject(tmpDir)

    const prettier = result.linters.find(l => l.tool === 'prettier')
    expect(prettier).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// scanProject — CI detection
// ---------------------------------------------------------------------------

describe('scanProject — CI', () => {
  it('detects .github/workflows as github-actions CI', async () => {
    const workflowsDir = join(tmpDir, '.github', 'workflows')
    await mkdir(workflowsDir, { recursive: true })
    await writeFile(join(workflowsDir, 'ci.yml'), 'name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest\n', 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.ci.length).toBe(1)
    expect(result.ci[0].platform).toBe('github-actions')
    expect(result.ci[0].configFile).toBe('.github/workflows/')
  })

  it('extracts quality gates from workflow content', async () => {
    const workflowsDir = join(tmpDir, '.github', 'workflows')
    await mkdir(workflowsDir, { recursive: true })
    await writeFile(
      join(workflowsDir, 'ci.yml'),
      'name: CI\njobs:\n  test:\n    run: npm test\n  lint:\n    run: npm run lint\n  build:\n    run: npm run build\n',
      'utf-8',
    )

    const result = await scanProject(tmpDir)

    expect(result.ci[0].qualityGates).toContain('test')
    expect(result.ci[0].qualityGates).toContain('lint')
    expect(result.ci[0].qualityGates).toContain('build')
  })
})

// ---------------------------------------------------------------------------
// scanProject — existing BuildPact and AI configs
// ---------------------------------------------------------------------------

describe('scanProject — existing configs', () => {
  it('detects existing .buildpact directory', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })

    const result = await scanProject(tmpDir)

    expect(result.existingBuildpact).toBe(true)
  })

  it('detects existing CLAUDE.md as claude-code AI config', async () => {
    await writeFile(join(tmpDir, 'CLAUDE.md'), '# Claude instructions', 'utf-8')

    const result = await scanProject(tmpDir)

    const claude = result.existingAiConfigs.find(c => c.ide === 'claude-code')
    expect(claude).toBeDefined()
    expect(claude!.files).toContain('CLAUDE.md')
  })

  it('detects .cursorrules as cursor AI config', async () => {
    await writeFile(join(tmpDir, '.cursorrules'), '# Cursor rules', 'utf-8')

    const result = await scanProject(tmpDir)

    const cursor = result.existingAiConfigs.find(c => c.ide === 'cursor')
    expect(cursor).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// scanProject — empty directory
// ---------------------------------------------------------------------------

describe('scanProject — empty directory', () => {
  it('returns empty arrays for empty directory', async () => {
    const result = await scanProject(tmpDir)

    expect(result.packageManagers).toEqual([])
    expect(result.languages).toEqual([])
    expect(result.linters).toEqual([])
    expect(result.ci).toEqual([])
    expect(result.existingAiConfigs).toEqual([])
    expect(result.existingBuildpact).toBe(false)
    expect(result.inferredDomain).toBe('custom')
  })
})

// ---------------------------------------------------------------------------
// scanProject — domain inference
// ---------------------------------------------------------------------------

describe('scanProject — domain inference', () => {
  it('infers software domain when package manager detected', async () => {
    await writeFile(join(tmpDir, 'package.json'), '{}', 'utf-8')

    const result = await scanProject(tmpDir)

    expect(result.inferredDomain).toBe('software')
  })
})

// ---------------------------------------------------------------------------
// formatScanSummary
// ---------------------------------------------------------------------------

describe('formatScanSummary', () => {
  it('produces human-readable string with all detected info', () => {
    const scan: ScanResult = {
      packageManagers: [{ name: 'npm', configFile: 'package.json' }],
      languages: ['TypeScript'],
      linters: [{ tool: 'eslint', configFile: '.eslintrc.json', extractedRules: [] }],
      ci: [{ platform: 'github-actions', configFile: '.github/workflows/', qualityGates: ['test'] }],
      git: { commitCount: 42, branchCount: 3, contributorCount: 2, firstCommitDate: '2024-01-01', hasUncommittedChanges: false },
      existingAiConfigs: [],
      existingBuildpact: false,
      inferredDomain: 'software',
      projectName: 'test',
    }

    const summary = formatScanSummary(scan)

    expect(typeof summary).toBe('string')
    expect(summary).toContain('TypeScript')
    expect(summary).toContain('npm')
    expect(summary).toContain('eslint')
    expect(summary).toContain('github-actions')
    expect(summary).toContain('42 commits')
    expect(summary).toContain('2 contributor(s)')
  })

  it('returns empty string for empty scan', () => {
    const scan: ScanResult = {
      packageManagers: [],
      languages: [],
      linters: [],
      ci: [],
      git: null,
      existingAiConfigs: [],
      existingBuildpact: false,
      inferredDomain: 'custom',
      projectName: 'empty',
    }

    const summary = formatScanSummary(scan)

    expect(summary).toBe('')
  })
})
