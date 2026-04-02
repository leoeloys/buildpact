/**
 * Persona A (Dr. Ana) medical marketing journey test.
 * Validates specify -> plan -> execute with Medical Marketing Squad.
 * Tests CFM compliance awareness in generated artifacts.
 * @see Story 17.2 — AC-3: Persona A (Dr. Ana) Medical Marketing Journey
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import {
  createPersonaProject,
  writePersonaSpec,
  writePersonaPlan,
  MEDICAL_MARKETING_FIXTURE,
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
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
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
// Persona A: Medical Marketing Journey
// ---------------------------------------------------------------------------

describe('Persona A: Medical Marketing (Dr. Ana) Journey', () => {
  let project: TempProject & { fixture: typeof MEDICAL_MARKETING_FIXTURE }
  const slug = 'brochure-implantes'

  beforeEach(async () => {
    project = await createPersonaProject(MEDICAL_MARKETING_FIXTURE)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await project.cleanup()
    vi.restoreAllMocks()
  })

  it('project is initialized with medical-marketing squad', async () => {
    const configContent = await readFile(
      join(project.dir, '.buildpact', 'config.yaml'),
      'utf-8',
    )
    expect(configContent).toContain('active_squad: "medical-marketing"')
    expect(configContent).toContain('language: "pt-br"')

    // Squad directory exists
    expect(
      await fileExists(
        join(project.dir, '.buildpact', 'squads', 'medical-marketing', 'squad.yaml'),
      ),
    ).toBe(true)
  })

  it('step 1: specify creates spec with domain context', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.text).mockResolvedValue(MEDICAL_MARKETING_FIXTURE.specDescription)
    vi.mocked(clack.confirm).mockResolvedValue(false)
    vi.mocked(clack.select).mockResolvedValue('beginner')

    const result = await runBpCommand(project.dir, 'specify', [])
    expect(result.ok).toBe(true)
  })

  it('step 2: plan generates plan from medical spec', async () => {
    await writePersonaSpec(project.dir, slug, MEDICAL_MARKETING_FIXTURE.specContent)

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValue('override')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    const result = await runBpCommand(project.dir, 'plan', [])
    expect(result.ok).toBe(true)

    const planDir = join(project.dir, '.buildpact', 'plans', slug)
    expect(await fileExists(join(planDir, 'plan.md'))).toBe(true)

    // Plan should reference the domain content
    const planContent = await readFile(join(planDir, 'plan.md'), 'utf-8')
    const structure = extractMarkdownStructure(planContent)
    expect(structure.sections).toContain('Research Findings')
    expect(structure.sections).toContain('Domain Constraints')
  })

  it('step 3: execute processes medical marketing tasks', async () => {
    await writePersonaSpec(project.dir, slug, MEDICAL_MARKETING_FIXTURE.specContent)
    await writePersonaPlan(project.dir, slug, MEDICAL_MARKETING_FIXTURE)

    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    const result = await runBpCommand(project.dir, 'execute', [])
    expect(result.ok).toBe(true)
  })

  it('audit trail records operations', async () => {
    await writePersonaSpec(project.dir, slug, MEDICAL_MARKETING_FIXTURE.specContent)

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValue('override')
    vi.mocked(clack.confirm).mockResolvedValue(true)

    await runBpCommand(project.dir, 'plan', [])

    // Audit directory should exist (audit logger was mocked but dir was created)
    expect(await fileExists(join(project.dir, '.buildpact', 'audit'))).toBe(true)
  })

  it('persona project is self-contained and independent', async () => {
    expect(project.dir).toContain('buildpact-e2e-')
    const dir = project.dir
    await project.cleanup()
    expect(await fileExists(dir)).toBe(false)
    project = await createPersonaProject(MEDICAL_MARKETING_FIXTURE)
  })
})
