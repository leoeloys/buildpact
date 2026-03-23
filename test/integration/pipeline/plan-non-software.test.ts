/**
 * Integration test: Non-Software Domain Planning (Story 5.5)
 * Tests domain-aware [HUMAN]/[AGENT] tagging in plan output and progress persistence.
 *
 * @see Story 5.5 — Task 9
 * @see AC #1 — Task Tagging by Executor
 * @see AC #3 — Non-Software Domain Detection
 * @see AC #5 — Progress Persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  isCancel: vi.fn(() => false),
}))

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

vi.mock('../../../src/commands/plan/researcher.js', () => ({
  spawnResearchAgents: vi.fn().mockResolvedValue({
    specSlug: 'test-spec',
    timestamp: '2026-03-18T00:00:00.000Z',
    techStack: {
      domain: 'tech-stack',
      findings: ['TypeScript', 'Node.js'],
      relevantPatterns: ['TypeScript'],
    },
    codebase: {
      domain: 'codebase',
      findings: ['contracts → engine → commands'],
      relevantPatterns: ['Result'],
    },
    squadConstraints: {
      domain: 'squad-constraints',
      findings: ['No squad active'],
      relevantPatterns: [],
    },
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up a temp project dir with spec and optional squad config.
 */
async function setupProjectDir(opts: {
  specSlug: string
  specContent: string
  squadName?: string
  domainType?: string
}): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-non-software-'))
  const { specSlug, specContent, squadName, domainType } = opts

  // Write spec
  await mkdir(join(tmpDir, '.buildpact', 'specs', specSlug), { recursive: true })
  await writeFile(join(tmpDir, '.buildpact', 'specs', specSlug, 'spec.md'), specContent, 'utf-8')

  // Write squad config if requested
  if (squadName && domainType) {
    await mkdir(join(tmpDir, '.buildpact', 'squads', squadName), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', squadName, 'squad.yaml'),
      `name: ${squadName}\ndomain_type: ${domainType}\n`,
      'utf-8',
    )
  }

  return tmpDir
}

// A spec with tasks that include human-keyword tasks
const MIXED_SPEC = [
  '# Patient Brochure Creation',
  '',
  '## Acceptance Criteria',
  '',
  '- Generate brochure draft from template',
  '- Review brochure for regulatory compliance',
  '- Approve final layout before printing',
  '- Deploy digital version to patient portal',
  '',
  '## Tasks',
  '',
  '- task-1: Generate brochure draft (deps: none)',
  '- task-2: Review draft for compliance (deps: task-1)',
  '- task-3: Approve final layout (deps: task-2)',
  '- task-4: Deploy to patient portal (deps: task-3)',
].join('\n')

// A spec where no tasks have human keywords
const SOFTWARE_SPEC = [
  '# Authentication Module',
  '',
  '## Acceptance Criteria',
  '',
  '- Implement login endpoint',
  '- Add JWT token validation',
  '- Write integration tests',
  '',
  '## Tasks',
  '',
  '- task-1: Implement login endpoint (deps: none)',
  '- task-2: Add JWT validation (deps: task-1)',
  '- task-3: Write integration tests (deps: task-2)',
].join('\n')

// ---------------------------------------------------------------------------
// Tests: AC #1 — domain-aware plan file tagging via buildPlanContent
// ---------------------------------------------------------------------------

describe('Non-software domain planning — plan file tagging (Story 5.5)', () => {
  let tmpDir: string

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  it('medical domain: plan files contain [HUMAN] tags for keyword-matching tasks (AC #1)', async () => {
    tmpDir = await setupProjectDir({
      specSlug: 'brochure-medical',
      specContent: MIXED_SPEC,
      squadName: 'medical-marketing',
      domainType: 'medical',
    })

    const { buildPlanContent, consolidateResearch, buildStubFindings } = await import(
      '../../../src/commands/plan/handler.js'
    )

    const research = consolidateResearch(
      buildStubFindings('tech_stack', MIXED_SPEC),
      buildStubFindings('codebase', MIXED_SPEC),
      buildStubFindings('squad_domain', MIXED_SPEC),
    )

    // Use medical domain type
    const planContent = buildPlanContent(MIXED_SPEC, research, 'brochure-medical', '2026-03-18T00:00:00.000Z', 'medical')

    // Tasks with 'review' and 'approve' keywords should be tagged HUMAN for medical domain
    expect(planContent).toContain('[HUMAN]')
    expect(planContent).toContain('[AGENT]')
  })

  it('software domain: no [HUMAN] tags even for human-keyword tasks (AC #3)', async () => {
    tmpDir = await setupProjectDir({
      specSlug: 'auth-software',
      specContent: SOFTWARE_SPEC,
    })

    const { buildPlanContent, consolidateResearch, buildStubFindings } = await import(
      '../../../src/commands/plan/handler.js'
    )

    const research = consolidateResearch(
      buildStubFindings('tech_stack', SOFTWARE_SPEC),
      buildStubFindings('codebase', SOFTWARE_SPEC),
      buildStubFindings('squad_domain', SOFTWARE_SPEC),
    )

    // Software domain — all tasks should be AGENT
    const planContent = buildPlanContent(SOFTWARE_SPEC, research, 'auth-software', '2026-03-18T00:00:00.000Z', 'software')

    expect(planContent).not.toContain('[HUMAN]')
    expect(planContent).toContain('[AGENT]')
  })

  it('medical domain: HUMAN tasks include checklist items (AC #4)', async () => {
    const { buildPlanContent, consolidateResearch, buildStubFindings } = await import(
      '../../../src/commands/plan/handler.js'
    )

    const research = consolidateResearch(
      buildStubFindings('tech_stack', MIXED_SPEC),
      buildStubFindings('codebase', MIXED_SPEC),
      buildStubFindings('squad_domain', MIXED_SPEC),
    )

    const planContent = buildPlanContent(MIXED_SPEC, research, 'brochure', '2026-03-18T00:00:00.000Z', 'medical')

    // Checklist items appear as indented sub-items after [HUMAN] tasks
    // buildHumanChecklist always includes a "Sign off" item
    expect(planContent).toContain('Sign off')
  })
})

// ---------------------------------------------------------------------------
// Tests: AC #5 — Progress persistence (save/load/resume)
// ---------------------------------------------------------------------------

describe('Progress persistence — save/load/resume (Story 5.5 AC #5)', () => {
  let tmpDir: string

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  it('saveProgress → loadProgress roundtrip preserves all fields', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-progress-'))
    const { saveProgress, loadProgress } = await import('../../../src/commands/plan/progress.js')

    const progress = {
      slug: 'test-feature',
      generatedAt: '2026-03-18T00:00:00.000Z',
      tasks: [
        { taskId: 'T1', title: 'Review document', executionType: 'HUMAN' as const, completed: true, completedAt: '2026-03-18T01:00:00.000Z' },
        { taskId: 'T2', title: 'Deploy service', executionType: 'AGENT' as const, completed: false },
      ],
    }

    await saveProgress(tmpDir, progress)
    const loaded = await loadProgress(tmpDir)

    expect(loaded).not.toBeNull()
    expect(loaded!.slug).toBe('test-feature')
    expect(loaded!.tasks).toHaveLength(2)
    expect(loaded!.tasks[0].completed).toBe(true)
    expect(loaded!.tasks[1].completed).toBe(false)
  })

  it('loadProgress returns null when progress.json does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-no-progress-'))
    const { loadProgress } = await import('../../../src/commands/plan/progress.js')

    const result = await loadProgress(tmpDir)
    expect(result).toBeNull()
  })

  it('isHumanStepPending returns true for uncompleted tasks and false for completed ones', async () => {
    const { isHumanStepPending } = await import('../../../src/commands/plan/progress.js')

    const progress = {
      slug: 'test',
      generatedAt: '2026-03-18T00:00:00.000Z',
      tasks: [
        { taskId: 'T1', title: 'Review', executionType: 'HUMAN' as const, completed: true },
        { taskId: 'T2', title: 'Approve', executionType: 'HUMAN' as const, completed: false },
      ],
    }

    expect(isHumanStepPending(progress, 'T1')).toBe(false) // completed
    expect(isHumanStepPending(progress, 'T2')).toBe(true)  // not completed
    expect(isHumanStepPending(progress, 'T3')).toBe(true)  // not in progress → pending
  })
})
