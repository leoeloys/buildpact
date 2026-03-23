/**
 * E2E test: init → specify → plan flow exercising real BuildPact modules.
 * Uses DryRunProvider to avoid real LLM calls while testing actual code paths.
 * @see Story 17.1 — E2E Pipeline Test Suite (CRITICAL-1)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { readFile, readdir, access } from 'node:fs/promises'
import {
  createTempProject,
  runBpCommand,
  fileExists,
  extractMarkdownStructure,
  type TempProject,
} from './helpers.js'

// ---------------------------------------------------------------------------
// Mocks — mock only the UI layer, not the business logic
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
  note: vi.fn(),
}))

vi.mock('../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Init → Specify → Plan E2E flow
// ---------------------------------------------------------------------------

describe('E2E: Init → Specify → Plan (real code paths)', () => {
  let project: TempProject

  beforeEach(async () => {
    project = await createTempProject({ lang: 'en' })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await project.cleanup()
    vi.restoreAllMocks()
  })

  it('createTempProject produces a valid .buildpact/ structure', async () => {
    // Verify the real installer output: config.yaml, constitution.md exist
    expect(await fileExists(join(project.dir, '.buildpact', 'config.yaml'))).toBe(true)
    expect(await fileExists(join(project.dir, '.buildpact', 'constitution.md'))).toBe(true)

    // Read config and verify it has expected fields
    const config = await readFile(join(project.dir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(config).toContain('language:')
    expect(config).toContain('active_squad:')
  })

  it('specify handler creates a structured spec from user input', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.text).mockResolvedValue('Add user authentication with email and password login')
    vi.mocked(clack.confirm).mockResolvedValue(false)
    vi.mocked(clack.select).mockResolvedValue('intermediate')

    // Exercise the REAL specify handler (not a mock)
    const result = await runBpCommand(project.dir, 'specify', [])
    expect(result.ok).toBe(true)

    // Verify spec file was created by the real handler
    const specsDir = join(project.dir, '.buildpact', 'specs')
    const entries = await readdir(specsDir)
    expect(entries.length).toBeGreaterThan(0)

    // Read the spec and verify structural output
    const specDir = join(specsDir, entries[0]!)
    const specContent = await readFile(join(specDir, 'spec.md'), 'utf-8')
    const structure = extractMarkdownStructure(specContent)
    expect(structure.headings.length).toBeGreaterThan(0)
    expect(specContent.toLowerCase()).toContain('authentication')
  })

  it('plan handler creates wave files from existing spec', async () => {
    // Pre-populate a spec (simulating specify output)
    const specDir = join(project.dir, '.buildpact', 'specs', 'add-auth')
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(specDir, { recursive: true })
    await writeFile(
      join(specDir, 'spec.md'),
      [
        '# Spec -- add-auth',
        '',
        '## User Story',
        'As a user, I want to log in with email and password.',
        '',
        '## Acceptance Criteria',
        '- Valid credentials grant access',
        '- Invalid credentials show error',
      ].join('\n'),
      'utf-8',
    )

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValue('override')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    // Exercise the REAL plan handler
    const result = await runBpCommand(project.dir, 'plan', [])
    expect(result.ok).toBe(true)

    // Verify plan directory was created by real handler
    const planDir = join(project.dir, '.buildpact', 'plans', 'add-auth')
    expect(await fileExists(join(planDir, 'plan.md'))).toBe(true)

    // Plan should have research + wave structure
    const planContent = await readFile(join(planDir, 'plan.md'), 'utf-8')
    const planStructure = extractMarkdownStructure(planContent)
    expect(planStructure.sections.some(s => s.includes('Research') || s.includes('Wave'))).toBe(true)
  })

  it('full init-to-plan pipeline produces consistent artifacts', async () => {
    // Step 1: Specify
    const clack = await import('@clack/prompts')
    vi.mocked(clack.text).mockResolvedValue('Build a REST API for task management')
    vi.mocked(clack.confirm).mockResolvedValue(false)
    vi.mocked(clack.select).mockResolvedValue('intermediate')

    const specResult = await runBpCommand(project.dir, 'specify', [])
    expect(specResult.ok).toBe(true)

    // Step 2: Plan (using the spec created in step 1)
    vi.mocked(clack.select).mockResolvedValue('override')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    const planResult = await runBpCommand(project.dir, 'plan', [])
    expect(planResult.ok).toBe(true)

    // Verify both specs and plans directories have content
    const specs = await readdir(join(project.dir, '.buildpact', 'specs'))
    expect(specs.length).toBeGreaterThan(0)

    const plans = await readdir(join(project.dir, '.buildpact', 'plans'))
    expect(plans.length).toBeGreaterThan(0)
  })
})
