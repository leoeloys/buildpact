/**
 * Persona B (Developer) journey test.
 * Validates the full specify -> plan -> execute -> verify flow for a software developer.
 * @see Story 17.2 — AC-1: Persona B (Developer) Journey
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import {
  createPersonaProject,
  writePersonaSpec,
  writePersonaPlan,
  DEVELOPER_FIXTURE,
} from './helpers.js'
import {
  runBpCommand,
  fileExists,
  extractMarkdownStructure,
  type TempProject,
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
// Persona B: Developer Journey
// ---------------------------------------------------------------------------

describe('Persona B: Developer Journey', () => {
  let project: TempProject & { fixture: typeof DEVELOPER_FIXTURE }
  const slug = 'add-jwt-auth'

  beforeEach(async () => {
    project = await createPersonaProject(DEVELOPER_FIXTURE)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await project.cleanup()
    vi.restoreAllMocks()
  })

  it('step 1: specify creates a structured spec', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.text).mockResolvedValue(DEVELOPER_FIXTURE.specDescription)
    vi.mocked(clack.confirm).mockResolvedValue(false)
    vi.mocked(clack.select).mockResolvedValue('intermediate')

    const result = await runBpCommand(project.dir, 'specify', [])
    expect(result.ok).toBe(true)

    // Spec directory should be created
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(join(project.dir, '.buildpact', 'specs'))
    expect(entries.length).toBeGreaterThan(0)
  })

  it('step 2: plan generates wave files from spec', async () => {
    await writePersonaSpec(project.dir, slug, DEVELOPER_FIXTURE.specContent)

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValue('override')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    const result = await runBpCommand(project.dir, 'plan', [])
    expect(result.ok).toBe(true)

    const planDir = join(project.dir, '.buildpact', 'plans', slug)
    const planContent = await readFile(join(planDir, 'plan.md'), 'utf-8')
    const structure = extractMarkdownStructure(planContent)

    // Plan must have research and wave sections
    expect(structure.sections).toContain('Research Findings')
    expect(structure.sections).toContain('Wave Plan')

    // Wave files should exist
    expect(await fileExists(join(planDir, 'plan-wave-1.md'))).toBe(true)
  })

  it('step 3: execute processes wave tasks', async () => {
    await writePersonaSpec(project.dir, slug, DEVELOPER_FIXTURE.specContent)
    await writePersonaPlan(project.dir, slug, DEVELOPER_FIXTURE)

    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    const result = await runBpCommand(project.dir, 'execute', [])
    expect(result.ok).toBe(true)
  })

  it('step 4: verify validates acceptance criteria', async () => {
    await writePersonaSpec(project.dir, slug, DEVELOPER_FIXTURE.specContent)

    const clack = await import('@clack/prompts')
    // Pass all 4 ACs
    vi.mocked(clack.select)
      .mockResolvedValueOnce('pass')
      .mockResolvedValueOnce('pass')
      .mockResolvedValueOnce('pass')
      .mockResolvedValueOnce('pass')

    const result = await runBpCommand(project.dir, 'verify', [])
    expect(result.ok).toBe(true)

    // Verification report references ACs from spec
    const reportPath = join(
      project.dir,
      '.buildpact',
      'specs',
      slug,
      'verification-report.md',
    )
    expect(await fileExists(reportPath)).toBe(true)
    const report = await readFile(reportPath, 'utf-8')
    expect(report).toContain('JWT')
  })

  it('full journey is self-contained and independent', async () => {
    // Verify project directory is isolated in OS temp
    expect(project.dir).toContain('buildpact-e2e-')
    // Verify cleanup works
    const dir = project.dir
    await project.cleanup()
    expect(await fileExists(dir)).toBe(false)
    // Re-create for afterEach
    project = await createPersonaProject(DEVELOPER_FIXTURE)
  })
})
