/**
 * E2E test: full specify -> plan -> execute -> verify pipeline.
 * Uses isolated temp projects with mocked LLM responses.
 * Tests both EN and PT-BR language configurations.
 * @see Story 17.1 — E2E Pipeline Test Suite
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import {
  createTempProject,
  runBpCommand,
  fileExists,
  extractMarkdownStructure,
  compareStructures,
  type TempProject,
  type MarkdownStructure,
} from '../helpers.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  group: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}))

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Snapshot baselines — structural expectations per stage
// ---------------------------------------------------------------------------

const SPEC_STRUCTURE: MarkdownStructure = {
  headings: ['# Spec'],
  sections: ['User Story', 'Acceptance Criteria'],
  bulletCount: 1,
  hasCodeBlocks: false,
}

const PLAN_STRUCTURE: MarkdownStructure = {
  headings: ['# Plan'],
  sections: ['Research Findings', 'Wave Plan'],
  bulletCount: 1,
  hasCodeBlocks: false,
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Write a pre-populated spec to the project so plan/execute/verify can find it */
async function writeSpec(dir: string, slug: string, content: string): Promise<void> {
  const specDir = join(dir, '.buildpact', 'specs', slug)
  await mkdir(specDir, { recursive: true })
  await writeFile(join(specDir, 'spec.md'), content, 'utf-8')
}

/** Write a pre-populated plan so execute can find it */
async function writePlan(dir: string, slug: string): Promise<void> {
  const planDir = join(dir, '.buildpact', 'plans', slug)
  await mkdir(planDir, { recursive: true })

  await writeFile(
    join(planDir, 'plan.md'),
    [
      `# Plan — ${slug}`,
      '',
      '> Generated: 2026-03-22',
      '',
      '## Research Findings',
      '',
      '### Tech Stack',
      '- TypeScript, Node.js',
      '',
      '### Codebase Context',
      '- contracts, foundation, engine',
      '',
      '### Domain Constraints',
      '- Constitution enforcement',
      '',
      '## Wave Plan',
      '',
      '### Wave 1',
      '- [ ] [AGENT] Foundation setup',
      '- [ ] [AGENT] Core implementation',
      '',
      '### Wave 2',
      '- [ ] [AGENT] Tests and verification',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(planDir, 'plan-wave-1.md'),
    [
      `# Plan — ${slug} — Wave 1`,
      '',
      '## Tasks',
      '',
      '- [ ] [AGENT] Foundation setup',
      '- [ ] [AGENT] Core implementation: Add user authentication',
      '',
      '## Key References',
      '- `TypeScript`',
    ].join('\n'),
    'utf-8',
  )

  await writeFile(
    join(planDir, 'plan-wave-2.md'),
    [
      `# Plan — ${slug} — Wave 2`,
      '',
      '## Tasks',
      '',
      '- [ ] [AGENT] Tests and verification',
      '',
      '## Key References',
      '- `Vitest`',
    ].join('\n'),
    'utf-8',
  )
}

const SAMPLE_SPEC = [
  '# Spec — add-user-auth',
  '',
  '## User Story',
  '',
  'As a registered user, I want to log in with email and password, so that I can access my account.',
  '',
  '## Acceptance Criteria',
  '',
  '- User can log in with valid credentials',
  '- Invalid credentials show an error message',
  '- Session expires after 24 hours',
  '',
  '## Non-Functional Requirements',
  '',
  '- Response time < 200ms',
  '',
  '## Assumptions',
  '',
  '- Database schema already exists',
].join('\n')

// ---------------------------------------------------------------------------
// AC-1: Full pipeline E2E test (EN)
// ---------------------------------------------------------------------------

describe('AC-1: Full pipeline E2E test', () => {
  let project: TempProject

  beforeEach(async () => {
    project = await createTempProject({ lang: 'en' })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await project.cleanup()
    vi.restoreAllMocks()
  })

  it('specify command produces a spec file', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.text).mockResolvedValue('Add user authentication with email and password')
    vi.mocked(clack.confirm).mockResolvedValue(false)
    vi.mocked(clack.select).mockResolvedValue('intermediate')

    const result = await runBpCommand(project.dir, 'specify', [])
    expect(result.ok).toBe(true)

    // Check spec file exists
    const specsDir = join(project.dir, '.buildpact', 'specs')
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(specsDir)
    expect(entries.length).toBeGreaterThan(0)

    // Verify spec has expected structure
    const specDir = join(specsDir, entries[0]!)
    const specContent = await readFile(join(specDir, 'spec.md'), 'utf-8')
    const structure = extractMarkdownStructure(specContent)

    // Spec must have headings and content
    expect(structure.headings.length).toBeGreaterThan(0)
    expect(specContent).toContain('authentication')
  })

  it('plan command produces plan files from existing spec', async () => {
    // Pre-populate a spec
    await writeSpec(project.dir, 'add-user-auth', SAMPLE_SPEC)

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValue('override')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    const result = await runBpCommand(project.dir, 'plan', [])
    expect(result.ok).toBe(true)

    // Plan directory must exist
    const planDir = join(project.dir, '.buildpact', 'plans', 'add-user-auth')
    expect(await fileExists(join(planDir, 'plan.md'))).toBe(true)

    // Plan must have wave structure
    const planContent = await readFile(join(planDir, 'plan.md'), 'utf-8')
    const structure = extractMarkdownStructure(planContent)
    const diffs = compareStructures(structure, PLAN_STRUCTURE)
    expect(diffs).toEqual([])
  })

  it('execute command processes wave files', async () => {
    // Pre-populate spec and plan
    await writeSpec(project.dir, 'add-user-auth', SAMPLE_SPEC)
    await writePlan(project.dir, 'add-user-auth')

    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    const result = await runBpCommand(project.dir, 'execute', [])
    // Execute completes (may succeed or return ok with no errors in stub mode)
    expect(result.ok).toBe(true)
  })

  it('verify command runs guided acceptance test', async () => {
    // Pre-populate spec
    await writeSpec(project.dir, 'add-user-auth', SAMPLE_SPEC)

    const clack = await import('@clack/prompts')
    // Simulate: PASS for all 3 ACs
    vi.mocked(clack.select)
      .mockResolvedValueOnce('pass')
      .mockResolvedValueOnce('pass')
      .mockResolvedValueOnce('pass')

    const result = await runBpCommand(project.dir, 'verify', [])
    expect(result.ok).toBe(true)

    // Verification report should exist
    const reportsExist = await fileExists(
      join(project.dir, '.buildpact', 'specs', 'add-user-auth', 'verification-report.md'),
    )
    expect(reportsExist).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC-2: Bilingual coverage
// ---------------------------------------------------------------------------

describe('AC-2: Bilingual coverage (PT-BR)', () => {
  let project: TempProject

  beforeEach(async () => {
    project = await createTempProject({ lang: 'pt-br' })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await project.cleanup()
    vi.restoreAllMocks()
  })

  it('plan command works in PT-BR locale', async () => {
    await writeSpec(project.dir, 'autenticacao-usuario', SAMPLE_SPEC)

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValue('override')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    const result = await runBpCommand(project.dir, 'plan', [])
    expect(result.ok).toBe(true)

    const planDir = join(project.dir, '.buildpact', 'plans', 'autenticacao-usuario')
    expect(await fileExists(join(planDir, 'plan.md'))).toBe(true)
  })

  it('verify command works in PT-BR locale', async () => {
    await writeSpec(project.dir, 'autenticacao-usuario', SAMPLE_SPEC)

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select)
      .mockResolvedValueOnce('pass')
      .mockResolvedValueOnce('pass')
      .mockResolvedValueOnce('pass')

    const result = await runBpCommand(project.dir, 'verify', [])
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC-3: Snapshot-based output validation
// ---------------------------------------------------------------------------

describe('AC-3: Snapshot-based structural validation', () => {
  it('extractMarkdownStructure parses headings and sections', () => {
    const content = [
      '# Title',
      '',
      '## Section A',
      '- bullet 1',
      '- bullet 2',
      '',
      '## Section B',
      '```ts',
      'code',
      '```',
    ].join('\n')

    const structure = extractMarkdownStructure(content)
    expect(structure.headings).toEqual(['# Title', '## Section A', '## Section B'])
    expect(structure.sections).toEqual(['Title', 'Section A', 'Section B'])
    expect(structure.bulletCount).toBe(2)
    expect(structure.hasCodeBlocks).toBe(true)
  })

  it('compareStructures detects missing sections', () => {
    const actual: MarkdownStructure = {
      headings: ['# Title'],
      sections: ['Title'],
      bulletCount: 0,
      hasCodeBlocks: false,
    }
    const expected: MarkdownStructure = {
      headings: ['# Title', '## Required Section'],
      sections: ['Title', 'Required Section'],
      bulletCount: 0,
      hasCodeBlocks: false,
    }

    const diffs = compareStructures(actual, expected)
    expect(diffs).toContain('Missing section: "Required Section"')
  })

  it('compareStructures returns empty array when structures match', () => {
    const structure: MarkdownStructure = {
      headings: ['# Title', '## A', '## B'],
      sections: ['Title', 'A', 'B'],
      bulletCount: 3,
      hasCodeBlocks: false,
    }

    const diffs = compareStructures(structure, structure)
    expect(diffs).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// AC-4: Test isolation
// ---------------------------------------------------------------------------

describe('AC-4: Test isolation', () => {
  it('each createTempProject creates a unique directory', async () => {
    const project1 = await createTempProject()
    const project2 = await createTempProject()

    expect(project1.dir).not.toBe(project2.dir)

    await project1.cleanup()
    await project2.cleanup()
  })

  it('cleanup removes temp directory', async () => {
    const project = await createTempProject()
    const dir = project.dir

    expect(await fileExists(dir)).toBe(true)
    await project.cleanup()
    expect(await fileExists(dir)).toBe(false)
  })

  it('temp projects do not modify real user .buildpact/', async () => {
    const project = await createTempProject()
    const realBuildpact = join(process.cwd(), '.buildpact')

    // The temp dir should be in OS temp, not in the current project
    expect(project.dir).not.toContain(process.cwd())
    expect(project.dir).toContain('buildpact-e2e-')

    await project.cleanup()
  })
})
