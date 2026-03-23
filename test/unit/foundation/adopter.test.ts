import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateConstitutionFromScan,
  generateContextFromScan,
  adopt,
} from '../../../src/foundation/adopter.js'
import type { AdoptOptions } from '../../../src/foundation/adopter.js'
import type { ScanResult } from '../../../src/foundation/scanner.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string

async function makeTmpProject(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), 'buildpact-adopter-'))
  return tmp
}

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    packageManagers: [{ name: 'npm', configFile: 'package.json', projectName: 'test-project', version: '1.0.0' }],
    languages: ['TypeScript'],
    linters: [{ tool: 'eslint', configFile: '.eslintrc.json', extractedRules: ['flat config'] }],
    ci: [{ platform: 'github-actions', configFile: '.github/workflows/', qualityGates: ['test', 'lint'] }],
    git: null,
    existingAiConfigs: [],
    existingBuildpact: false,
    inferredDomain: 'software',
    projectName: 'test-project',
    ...overrides,
  }
}

function makeAdoptOptions(overrides: Partial<AdoptOptions> = {}): AdoptOptions {
  return {
    projectDir: tmpDir,
    language: 'en',
    scan: makeScanResult(),
    // mergeExisting: true by default to skip template-dependent copyDir for
    // profiles/squads (resolveTemplatesDir resolves relative to source, not cwd)
    mergeExisting: true,
    ides: [],
    experienceLevel: 'intermediate',
    installSquad: false,
    domain: 'software',
    ...overrides,
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Pre-create files in tmpDir that adopt() would try to copy from the
 * templates directory (profiles, DECISIONS.md, STATUS.md).
 * This avoids template path resolution issues during unit tests.
 * adopt()'s mergeExisting=true will skip already-existing targets.
 */
async function preCreateTemplateTargets(dir: string): Promise<void> {
  // Pre-create DECISIONS.md and STATUS.md so adopt() skips template reads
  await writeFile(join(dir, 'DECISIONS.md'), '# Decisions\n', 'utf-8')
  await writeFile(join(dir, 'STATUS.md'), '# Status\n', 'utf-8')
  // Pre-create profiles dir so copyDir is skipped when mergeExisting=true
  await mkdir(join(dir, '.buildpact', 'profiles'), { recursive: true })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  tmpDir = await makeTmpProject()
  await preCreateTemplateTargets(tmpDir)
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// generateConstitutionFromScan
// ---------------------------------------------------------------------------

describe('generateConstitutionFromScan', () => {
  it('includes detected languages', () => {
    const scan = makeScanResult({ languages: ['TypeScript', 'Python'] })
    const result = generateConstitutionFromScan(scan, 'my-project')

    expect(result).toContain('TypeScript, Python')
    expect(result).toContain('Primary language(s)')
  })

  it('includes linter info', () => {
    const scan = makeScanResult({
      linters: [{ tool: 'eslint', configFile: '.eslintrc.json', extractedRules: ['flat config'] }],
    })
    const result = generateConstitutionFromScan(scan, 'my-project')

    expect(result).toContain('eslint enforced')
    expect(result).toContain('.eslintrc.json')
    expect(result).toContain('flat config')
  })

  it('includes CI quality gates', () => {
    const scan = makeScanResult({
      ci: [{ platform: 'github-actions', configFile: '.github/workflows/', qualityGates: ['test', 'lint'] }],
    })
    const result = generateConstitutionFromScan(scan, 'my-project')

    expect(result).toContain('github-actions')
    expect(result).toContain('gates: test, lint')
  })

  it('includes project name in header', () => {
    const result = generateConstitutionFromScan(makeScanResult(), 'awesome-app')
    expect(result).toContain('# Project Constitution — awesome-app')
  })

  it('mentions no linter when none detected', () => {
    const scan = makeScanResult({ linters: [] })
    const result = generateConstitutionFromScan(scan, 'my-project')
    expect(result).toContain('No linter detected')
  })

  it('includes package manager info in architectural constraints', () => {
    const scan = makeScanResult()
    const result = generateConstitutionFromScan(scan, 'my-project')
    expect(result).toContain('Package manager: npm')
  })
})

// ---------------------------------------------------------------------------
// generateContextFromScan
// ---------------------------------------------------------------------------

describe('generateContextFromScan', () => {
  it('includes tech stack section', () => {
    const scan = makeScanResult()
    const result = generateContextFromScan(scan, 'my-project', 'en', 'intermediate', 'software')

    expect(result).toContain('## Technology Stack')
    expect(result).toContain('**Languages:** TypeScript')
    expect(result).toContain('**Package manager:** npm')
    expect(result).toContain('**Linter/formatter:** eslint')
    expect(result).toContain('**CI/CD:** github-actions')
  })

  it('includes frontmatter with correct fields', () => {
    const scan = makeScanResult()
    const result = generateContextFromScan(scan, 'my-project', 'pt-br', 'beginner', 'software')

    expect(result).toContain('---')
    expect(result).toContain('project_name: "my-project"')
    expect(result).toContain('language: "pt-br"')
    expect(result).toContain('experience_level: "beginner"')
    expect(result).toContain('active_squad: "software"')
    expect(result).toContain('active_model_profile: "balanced"')
    expect(result).toContain('workflow_phase: "adopted"')
  })

  it('includes project header', () => {
    const scan = makeScanResult()
    const result = generateContextFromScan(scan, 'cool-project', 'en', 'expert', 'none')
    expect(result).toContain('# cool-project — Project Context')
  })
})

// ---------------------------------------------------------------------------
// adopt
// ---------------------------------------------------------------------------

describe('adopt', () => {
  it('creates constitution, config, and context in project', async () => {
    const options = makeAdoptOptions()
    const result = await adopt(options)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Constitution and context are created fresh (not pre-existing)
    expect(result.value.created).toContain('.buildpact/constitution.md')
    expect(result.value.created).toContain('.buildpact/project-context.md')

    // Verify files exist on disk
    expect(await fileExists(join(tmpDir, '.buildpact', 'constitution.md'))).toBe(true)
    expect(await fileExists(join(tmpDir, '.buildpact', 'config.yaml'))).toBe(true)
    expect(await fileExists(join(tmpDir, '.buildpact', 'project-context.md'))).toBe(true)
  })

  it('config.yaml contains schema version and project name', async () => {
    const options = makeAdoptOptions()
    const result = await adopt(options)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const content = await readFile(join(tmpDir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(content).toContain('buildpact_schema:')
    expect(content).toContain('project_name: "test-project"')
  })

  it('skips existing constitution when mergeExisting=true', async () => {
    // Pre-create constitution
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), '# Existing constitution\n', 'utf-8')

    const options = makeAdoptOptions({ mergeExisting: true })
    const result = await adopt(options)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.skipped).toContain('.buildpact/constitution.md')

    // Verify original content preserved
    const content = await readFile(join(tmpDir, '.buildpact', 'constitution.md'), 'utf-8')
    expect(content).toBe('# Existing constitution\n')
  })

  it('adds schema fields to existing config.yaml when merging', async () => {
    // Pre-create config without schema
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      '# Old config\nproject_name: "legacy"\n',
      'utf-8',
    )

    const options = makeAdoptOptions({ mergeExisting: true })
    const result = await adopt(options)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.modified).toContain('.buildpact/config.yaml')

    const content = await readFile(join(tmpDir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(content).toContain('buildpact_schema:')
    expect(content).toContain('project_name: "legacy"')
  })

  it('skips config.yaml entirely when merging and schema already present', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'buildpact_schema: 1\nproject_name: "existing"\n',
      'utf-8',
    )

    const options = makeAdoptOptions({ mergeExisting: true })
    const result = await adopt(options)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.skipped).toContain('.buildpact/config.yaml')
  })

  it('skips profiles and template files that already exist', async () => {
    const options = makeAdoptOptions({ mergeExisting: true })
    const result = await adopt(options)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.skipped).toContain('.buildpact/profiles')
    expect(result.value.skipped).toContain('DECISIONS.md')
    expect(result.value.skipped).toContain('STATUS.md')
  })

  it('creates audit log entries during adopt', async () => {
    const options = makeAdoptOptions()
    const result = await adopt(options)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const auditPath = join(tmpDir, '.buildpact', 'audit', 'adopt.jsonl')
    expect(await fileExists(auditPath)).toBe(true)

    const content = await readFile(auditPath, 'utf-8')
    const lines = content.trim().split('\n').filter(l => l.trim())
    expect(lines.length).toBeGreaterThanOrEqual(2)

    const entries = lines.map(l => JSON.parse(l))
    const actions = entries.map((e: { action: string }) => e.action)
    expect(actions).toContain('adopt.start')
    expect(actions).toContain('adopt.complete')
  })

  it('generated constitution includes scan data', async () => {
    const options = makeAdoptOptions()
    const result = await adopt(options)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const content = await readFile(join(tmpDir, '.buildpact', 'constitution.md'), 'utf-8')
    expect(content).toContain('TypeScript')
    expect(content).toContain('eslint')
    expect(content).toContain('github-actions')
  })
})
