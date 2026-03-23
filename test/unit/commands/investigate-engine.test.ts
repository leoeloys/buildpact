import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateSlug,
  detectScope,
  investigateCodebase,
  formatCodebaseBrief,
  formatDomainBrief,
  formatTechBrief,
  formatInvestigationReport,
  runInvestigation,
} from '../../../src/commands/investigate/engine.js'

// ---------------------------------------------------------------------------
// generateSlug
// ---------------------------------------------------------------------------

describe('generateSlug', () => {
  it('converts to lowercase and replaces spaces with hyphens', () => {
    expect(generateSlug('Create a squad for Healthcare')).toBe('create-a-squad-for-healthcare')
  })

  it('removes special characters', () => {
    expect(generateSlug('Compare React vs. Svelte!')).toBe('compare-react-vs-svelte')
  })

  it('truncates to 50 characters', () => {
    const longQuery = 'This is a very long investigation query that should be truncated to fifty characters maximum'
    const slug = generateSlug(longQuery)
    expect(slug.length).toBeLessThanOrEqual(50)
  })

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug(' - test - ')).toBe('test')
  })

  it('collapses multiple hyphens', () => {
    expect(generateSlug('hello   world')).toBe('hello-world')
  })
})

// ---------------------------------------------------------------------------
// detectScope
// ---------------------------------------------------------------------------

describe('detectScope', () => {
  it('detects domain investigation from squad-related queries', () => {
    expect(detectScope('Create a squad for healthcare')).toBe('domain')
  })

  it('detects codebase investigation from code-related queries', () => {
    expect(detectScope('Understand this codebase architecture')).toBe('codebase')
  })

  it('detects technology investigation from comparison queries', () => {
    expect(detectScope('Compare React vs Svelte for our frontend')).toBe('technology')
  })

  it('defaults to domain when no strong signals', () => {
    expect(detectScope('Research something')).toBe('domain')
  })

  it('uses explicit type when provided', () => {
    expect(detectScope('anything', 'codebase')).toBe('codebase')
    expect(detectScope('anything', 'technology')).toBe('technology')
    expect(detectScope('anything', 'domain')).toBe('domain')
  })
})

// ---------------------------------------------------------------------------
// investigateCodebase
// ---------------------------------------------------------------------------

describe('investigateCodebase', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-investigate-'))
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await mkdir(join(tmpDir, 'test'), { recursive: true })

    // Create a TypeScript project fixture
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: { react: '^18.0.0' },
        devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
      }),
      'utf-8',
    )
    await writeFile(join(tmpDir, 'tsconfig.json'), '{}', 'utf-8')
    await writeFile(join(tmpDir, 'src', 'index.ts'), 'export const x = 1', 'utf-8')
    await writeFile(join(tmpDir, 'src', 'utils.ts'), 'export const y = 2', 'utf-8')
    await writeFile(join(tmpDir, 'test', 'index.test.ts'), 'test("x", () => {})', 'utf-8')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('detects TypeScript language', async () => {
    const info = await investigateCodebase(tmpDir)
    expect(info.languages).toContain('TypeScript')
  })

  it('detects frameworks from package.json', async () => {
    const info = await investigateCodebase(tmpDir)
    expect(info.frameworks).toContain('React')
  })

  it('detects test frameworks from package.json', async () => {
    const info = await investigateCodebase(tmpDir)
    expect(info.testFrameworks).toContain('Vitest')
  })

  it('counts source and test files', async () => {
    const info = await investigateCodebase(tmpDir)
    expect(info.sourceFileCount).toBeGreaterThanOrEqual(2)
    expect(info.testFileCount).toBeGreaterThanOrEqual(1)
  })

  it('detects config files', async () => {
    const info = await investigateCodebase(tmpDir)
    expect(info.configFiles).toContain('package.json')
    expect(info.configFiles).toContain('tsconfig.json')
  })
})

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

describe('formatCodebaseBrief', () => {
  it('includes tech stack section', () => {
    const info = {
      languages: ['TypeScript'],
      frameworks: ['React'],
      buildTools: ['esbuild'],
      testFrameworks: ['Vitest'],
      configFiles: ['package.json'],
      sourceFileCount: 50,
      testFileCount: 20,
    }
    const brief = formatCodebaseBrief(info)
    expect(brief).toContain('## Tech Stack')
    expect(brief).toContain('TypeScript')
    expect(brief).toContain('React')
  })

  it('flags missing tests', () => {
    const info = {
      languages: ['TypeScript'],
      frameworks: [],
      buildTools: [],
      testFrameworks: [],
      configFiles: [],
      sourceFileCount: 50,
      testFileCount: 0,
    }
    const brief = formatCodebaseBrief(info)
    expect(brief).toContain('Pain Points')
    expect(brief).toContain('No test files')
  })
})

describe('formatDomainBrief', () => {
  it('includes domain investigation sections', () => {
    const brief = formatDomainBrief('healthcare squad')
    expect(brief).toContain('Domain Investigation')
    expect(brief).toContain('Industry Standards')
    expect(brief).toContain('Best Practices')
  })
})

describe('formatTechBrief', () => {
  it('includes technology comparison sections', () => {
    const brief = formatTechBrief('React vs Svelte')
    expect(brief).toContain('Technology Investigation')
    expect(brief).toContain('Alternatives Comparison')
    expect(brief).toContain('Migration Cost')
  })
})

describe('formatInvestigationReport', () => {
  it('formats a complete report with all sections', () => {
    const report = {
      type: 'codebase' as const,
      slug: 'test-project',
      query: 'Analyze test project',
      findings: ['TypeScript detected', '50 source files'],
      recommendations: ['Add more tests'],
      bestPractices: ['Follow clean architecture'],
      timestamp: '2026-03-22T00:00:00Z',
    }
    const md = formatInvestigationReport(report)
    expect(md).toContain('# Investigation Report')
    expect(md).toContain('## Key Findings')
    expect(md).toContain('## Recommendations')
    expect(md).toContain('## Relevant Best Practices')
    expect(md).toContain('## Next Steps')
  })
})

// ---------------------------------------------------------------------------
// runInvestigation
// ---------------------------------------------------------------------------

describe('runInvestigation', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-inv-run-'))
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await writeFile(join(tmpDir, 'src', 'index.ts'), '// code', 'utf-8')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('runs a codebase investigation', async () => {
    const result = await runInvestigation('codebase', 'Analyze codebase', tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.type).toBe('codebase')
    expect(result.value.findings.length).toBeGreaterThan(0)
    expect(result.value.techStack).toBeDefined()
  })

  it('runs a domain investigation', async () => {
    const result = await runInvestigation('domain', 'Healthcare squad', tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.type).toBe('domain')
    expect(result.value.findings.length).toBeGreaterThan(0)
  })

  it('runs a technology investigation', async () => {
    const result = await runInvestigation('technology', 'React vs Svelte', tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.type).toBe('technology')
    expect(result.value.findings.length).toBeGreaterThan(0)
  })

  it('generates a valid slug', async () => {
    const result = await runInvestigation('domain', 'Create a Healthcare Squad', tmpDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.slug).toBe('create-a-healthcare-squad')
  })
})
