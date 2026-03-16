import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts so tests don't block on interactive TTY prompts
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

// Mock AuditLogger to avoid writing real audit logs during tests
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// extractTasksFromSpec unit tests
// ---------------------------------------------------------------------------

describe('extractTasksFromSpec', () => {
  it('extracts tasks from Acceptance Criteria section', async () => {
    const { extractTasksFromSpec } = await import('../../../src/commands/plan/handler.js')
    const spec = '# Spec\n\n## Acceptance Criteria\n\n- User can log in\n- User can log out\n- Session expires after 1 hour\n'
    const tasks = extractTasksFromSpec(spec)
    expect(tasks).toHaveLength(3)
    expect(tasks[0]?.id).toBe('T1')
    expect(tasks[0]?.title).toBe('User can log in')
    expect(tasks[1]?.id).toBe('T2')
    expect(tasks[2]?.id).toBe('T3')
  })

  it('extracts tasks from Functional Requirements section', async () => {
    const { extractTasksFromSpec } = await import('../../../src/commands/plan/handler.js')
    const spec = '# Spec\n\n## Functional Requirements\n\n- FR1: Accept user input\n- FR2: Validate input\n'
    const tasks = extractTasksFromSpec(spec)
    expect(tasks.length).toBeGreaterThanOrEqual(2)
  })

  it('stops collecting at the next ## section', async () => {
    const { extractTasksFromSpec } = await import('../../../src/commands/plan/handler.js')
    const spec = '# Spec\n\n## Acceptance Criteria\n\n- Task A\n- Task B\n\n## NFRs\n\n- Not a task\n'
    const tasks = extractTasksFromSpec(spec)
    expect(tasks).toHaveLength(2)
  })

  it('returns 3 fallback tasks when no AC section found', async () => {
    const { extractTasksFromSpec } = await import('../../../src/commands/plan/handler.js')
    const tasks = extractTasksFromSpec('# Spec\nSome description without AC section')
    expect(tasks).toHaveLength(3)
    expect(tasks[0]?.id).toBe('T1')
    expect(tasks[2]?.id).toBe('T3')
  })

  it('all extracted tasks start with wave 0 and empty dependencies', async () => {
    const { extractTasksFromSpec } = await import('../../../src/commands/plan/handler.js')
    const spec = '## Acceptance Criteria\n\n- Do this\n- Do that\n'
    const tasks = extractTasksFromSpec(spec)
    for (const task of tasks) {
      expect(task.wave).toBe(0)
      expect(task.dependencies).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// inferDependencies unit tests
// ---------------------------------------------------------------------------

describe('inferDependencies', () => {
  it('detects "after T1" in title and adds T1 as dependency', async () => {
    const { inferDependencies } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'Foundation setup', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Core implementation after T1 completes', dependencies: [], wave: 0 },
    ]
    const result = inferDependencies(tasks)
    expect(result[1]?.dependencies).toContain('T1')
  })

  it('detects "requires T1" keyword', async () => {
    const { inferDependencies } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'Setup', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Deploy requires T1', dependencies: [], wave: 0 },
    ]
    const result = inferDependencies(tasks)
    expect(result[1]?.dependencies).toContain('T1')
  })

  it('returns tasks unchanged when no dependency keywords present', async () => {
    const { inferDependencies } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'Independent task A', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Independent task B', dependencies: [], wave: 0 },
    ]
    const result = inferDependencies(tasks)
    expect(result[0]?.dependencies).toEqual([])
    expect(result[1]?.dependencies).toEqual([])
  })

  it('does not add self-reference as dependency', async () => {
    const { inferDependencies } = await import('../../../src/commands/plan/handler.js')
    const tasks = [{ id: 'T1', title: 'Task requires T1 (self)', dependencies: [], wave: 0 }]
    const result = inferDependencies(tasks)
    expect(result[0]?.dependencies).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// assignWaves unit tests
// ---------------------------------------------------------------------------

describe('assignWaves', () => {
  it('assigns wave 0 to tasks with no dependencies', async () => {
    const { assignWaves } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'Task A', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Task B', dependencies: [], wave: 0 },
    ]
    const result = assignWaves(tasks)
    expect(result[0]?.wave).toBe(0)
    expect(result[1]?.wave).toBe(0)
  })

  it('assigns wave 1 to task depending on wave-0 task', async () => {
    const { assignWaves } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'Foundation', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Implementation', dependencies: ['T1'], wave: 0 },
    ]
    const result = assignWaves(tasks)
    expect(result[0]?.wave).toBe(0)
    expect(result[1]?.wave).toBe(1)
  })

  it('assigns wave 2 to task in a chain T1 → T2 → T3', async () => {
    const { assignWaves } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'Step 1', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Step 2', dependencies: ['T1'], wave: 0 },
      { id: 'T3', title: 'Step 3', dependencies: ['T2'], wave: 0 },
    ]
    const result = assignWaves(tasks)
    expect(result[0]?.wave).toBe(0)
    expect(result[1]?.wave).toBe(1)
    expect(result[2]?.wave).toBe(2)
  })

  it('handles circular dependencies without throwing', async () => {
    const { assignWaves } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'A', dependencies: ['T2'], wave: 0 },
      { id: 'T2', title: 'B', dependencies: ['T1'], wave: 0 },
    ]
    expect(() => assignWaves(tasks)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// groupIntoWaves unit tests
// ---------------------------------------------------------------------------

describe('groupIntoWaves', () => {
  it('groups independent tasks into the same wave', async () => {
    const { groupIntoWaves } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'Task A', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Task B', dependencies: [], wave: 0 },
      { id: 'T3', title: 'Task C', dependencies: ['T1', 'T2'], wave: 1 },
    ]
    const waves = groupIntoWaves(tasks)
    expect(waves).toHaveLength(2)
    expect(waves[0]?.waveNumber).toBe(0)
    expect(waves[0]?.tasks).toHaveLength(2)
    expect(waves[1]?.waveNumber).toBe(1)
    expect(waves[1]?.tasks).toHaveLength(1)
  })

  it('returns waves sorted by wave number', async () => {
    const { groupIntoWaves } = await import('../../../src/commands/plan/handler.js')
    const tasks = [
      { id: 'T1', title: 'A', dependencies: [], wave: 2 },
      { id: 'T2', title: 'B', dependencies: [], wave: 0 },
      { id: 'T3', title: 'C', dependencies: [], wave: 1 },
    ]
    const waves = groupIntoWaves(tasks)
    expect(waves.map(w => w.waveNumber)).toEqual([0, 1, 2])
  })
})

// ---------------------------------------------------------------------------
// splitWavesIfNeeded unit tests
// ---------------------------------------------------------------------------

describe('splitWavesIfNeeded', () => {
  it('keeps wave with ≤2 tasks in a single file', async () => {
    const { splitWavesIfNeeded } = await import('../../../src/commands/plan/handler.js')
    const waves = [{
      waveNumber: 0,
      tasks: [
        { id: 'T1', title: 'Task A', dependencies: [], wave: 0 },
        { id: 'T2', title: 'Task B', dependencies: [], wave: 0 },
      ],
    }]
    const files = splitWavesIfNeeded(waves)
    expect(files).toHaveLength(1)
    expect(files[0]?.filename).toBe('plan-wave-1.md')
    expect(files[0]?.partSuffix).toBe('')
  })

  it('splits wave with 3 tasks into 2 files (2+1)', async () => {
    const { splitWavesIfNeeded } = await import('../../../src/commands/plan/handler.js')
    const waves = [{
      waveNumber: 0,
      tasks: [
        { id: 'T1', title: 'A', dependencies: [], wave: 0 },
        { id: 'T2', title: 'B', dependencies: [], wave: 0 },
        { id: 'T3', title: 'C', dependencies: [], wave: 0 },
      ],
    }]
    const files = splitWavesIfNeeded(waves)
    expect(files).toHaveLength(2)
    expect(files[0]?.filename).toBe('plan-wave-1.md')
    expect(files[0]?.tasks).toHaveLength(2)
    expect(files[1]?.filename).toBe('plan-wave-1b.md')
    expect(files[1]?.tasks).toHaveLength(1)
  })

  it('splits wave with 4 tasks into 2 files (2+2)', async () => {
    const { splitWavesIfNeeded } = await import('../../../src/commands/plan/handler.js')
    const waves = [{
      waveNumber: 0,
      tasks: [
        { id: 'T1', title: 'A', dependencies: [], wave: 0 },
        { id: 'T2', title: 'B', dependencies: [], wave: 0 },
        { id: 'T3', title: 'C', dependencies: [], wave: 0 },
        { id: 'T4', title: 'D', dependencies: [], wave: 0 },
      ],
    }]
    const files = splitWavesIfNeeded(waves)
    expect(files).toHaveLength(2)
    expect(files[0]?.tasks).toHaveLength(2)
    expect(files[1]?.tasks).toHaveLength(2)
  })

  it('assigns correct part suffixes for split waves', async () => {
    const { splitWavesIfNeeded } = await import('../../../src/commands/plan/handler.js')
    const waves = [{
      waveNumber: 1,
      tasks: [
        { id: 'T1', title: 'A', dependencies: [], wave: 1 },
        { id: 'T2', title: 'B', dependencies: [], wave: 1 },
        { id: 'T3', title: 'C', dependencies: [], wave: 1 },
        { id: 'T4', title: 'D', dependencies: [], wave: 1 },
        { id: 'T5', title: 'E', dependencies: [], wave: 1 },
      ],
    }]
    const files = splitWavesIfNeeded(waves)
    expect(files[0]?.partSuffix).toBe('')
    expect(files[1]?.partSuffix).toBe('b')
    expect(files[2]?.partSuffix).toBe('c')
  })

  it('generates one file per wave when all waves are small', async () => {
    const { splitWavesIfNeeded } = await import('../../../src/commands/plan/handler.js')
    const waves = [
      { waveNumber: 0, tasks: [{ id: 'T1', title: 'A', dependencies: [], wave: 0 }] },
      { waveNumber: 1, tasks: [{ id: 'T2', title: 'B', dependencies: ['T1'], wave: 1 }] },
    ]
    const files = splitWavesIfNeeded(waves)
    expect(files).toHaveLength(2)
    expect(files[0]?.filename).toBe('plan-wave-1.md')
    expect(files[1]?.filename).toBe('plan-wave-2.md')
  })
})

// ---------------------------------------------------------------------------
// buildWaveFileContent unit tests
// ---------------------------------------------------------------------------

describe('buildWaveFileContent', () => {
  it('includes wave label in the heading', async () => {
    const { buildWaveFileContent, buildStubFindings, consolidateResearch } = await import('../../../src/commands/plan/handler.js')
    const research = consolidateResearch(
      buildStubFindings('tech_stack', '# Spec'),
      buildStubFindings('codebase', '# Spec'),
      buildStubFindings('squad_domain', '# Spec'),
    )
    const fileSpec = {
      filename: 'plan-wave-1.md',
      waveNumber: 0,
      partSuffix: '',
      tasks: [{ id: 'T1', title: 'Implement login', dependencies: [], wave: 0 }],
    }
    const content = buildWaveFileContent(fileSpec, research, 'login-feature', '2026-03-16T00:00:00.000Z')
    expect(content).toContain('# Plan — login-feature — Wave 1')
    expect(content).toContain('[AGENT] Implement login')
  })

  it('shows dependency note when task has dependencies', async () => {
    const { buildWaveFileContent, buildStubFindings, consolidateResearch } = await import('../../../src/commands/plan/handler.js')
    const research = consolidateResearch(
      buildStubFindings('tech_stack', '# Spec'),
      buildStubFindings('codebase', '# Spec'),
      buildStubFindings('squad_domain', '# Spec'),
    )
    const fileSpec = {
      filename: 'plan-wave-2.md',
      waveNumber: 1,
      partSuffix: '',
      tasks: [{ id: 'T2', title: 'Deploy service', dependencies: ['T1'], wave: 1 }],
    }
    const content = buildWaveFileContent(fileSpec, research, 'my-slug', '2026-03-16T00:00:00.000Z')
    expect(content).toContain('after: T1')
  })

  it('uses part suffix in wave label for split waves', async () => {
    const { buildWaveFileContent, buildStubFindings, consolidateResearch } = await import('../../../src/commands/plan/handler.js')
    const research = consolidateResearch(
      buildStubFindings('tech_stack', '# Spec'),
      buildStubFindings('codebase', '# Spec'),
      buildStubFindings('squad_domain', '# Spec'),
    )
    const fileSpec = {
      filename: 'plan-wave-1b.md',
      waveNumber: 0,
      partSuffix: 'b',
      tasks: [{ id: 'T3', title: 'Extra task', dependencies: [], wave: 0 }],
    }
    const content = buildWaveFileContent(fileSpec, research, 'my-slug', '2026-03-16T00:00:00.000Z')
    expect(content).toContain('Wave 1B')
  })

  it('includes Key References section', async () => {
    const { buildWaveFileContent, buildStubFindings, consolidateResearch } = await import('../../../src/commands/plan/handler.js')
    const research = consolidateResearch(
      buildStubFindings('tech_stack', '# Spec'),
      buildStubFindings('codebase', '# Spec'),
      buildStubFindings('squad_domain', '# Spec'),
    )
    const fileSpec = {
      filename: 'plan-wave-1.md',
      waveNumber: 0,
      partSuffix: '',
      tasks: [{ id: 'T1', title: 'Task', dependencies: [], wave: 0 }],
    }
    const content = buildWaveFileContent(fileSpec, research, 'slug', '2026-03-16T00:00:00.000Z')
    expect(content).toContain('## Key References')
    expect(content).toContain('`TypeScript`')
  })
})

// ---------------------------------------------------------------------------
// buildResearchPayload unit tests
// ---------------------------------------------------------------------------

describe('buildResearchPayload', () => {
  it('returns a payload with the correct topic and task type', async () => {
    const { buildResearchPayload } = await import('../../../src/commands/plan/handler.js')
    const result = buildResearchPayload('tech_stack', '# Spec\nBuild a login page')
    expect(result.topic).toBe('tech_stack')
    expect(result.taskPayload.type).toBe('plan')
  })

  it('includes spec content in the task payload content', async () => {
    const { buildResearchPayload } = await import('../../../src/commands/plan/handler.js')
    const specContent = '# Spec\nUsers should be able to reset their password'
    const result = buildResearchPayload('codebase', specContent)
    expect(result.taskPayload.content).toContain(specContent)
  })

  it('injects constitutionPath into task payload when provided', async () => {
    const { buildResearchPayload } = await import('../../../src/commands/plan/handler.js')
    const result = buildResearchPayload('squad_domain', '# Spec', '/project/.buildpact/constitution.md')
    expect(result.taskPayload.constitutionPath).toBe('/project/.buildpact/constitution.md')
  })

  it('omits constitutionPath when not provided', async () => {
    const { buildResearchPayload } = await import('../../../src/commands/plan/handler.js')
    const result = buildResearchPayload('tech_stack', '# Spec')
    expect(result.taskPayload.constitutionPath).toBeUndefined()
  })

  it('generates a unique taskId for each payload', async () => {
    const { buildResearchPayload } = await import('../../../src/commands/plan/handler.js')
    const a = buildResearchPayload('tech_stack', '# Spec')
    const b = buildResearchPayload('codebase', '# Spec')
    expect(a.taskPayload.taskId).not.toBe(b.taskPayload.taskId)
  })

  it('builds correct prompts for all three research topics', async () => {
    const { buildResearchPayload } = await import('../../../src/commands/plan/handler.js')
    const topics = ['tech_stack', 'codebase', 'squad_domain'] as const
    for (const topic of topics) {
      const result = buildResearchPayload(topic, '# Spec\nTest feature')
      expect(result.taskPayload.content).toContain('# Research Task:')
      expect(result.taskPayload.content).toContain(topic)
    }
  })
})

// ---------------------------------------------------------------------------
// buildStubFindings unit tests
// ---------------------------------------------------------------------------

describe('buildStubFindings', () => {
  it('returns tech_stack findings with TypeScript keyword', async () => {
    const { buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const result = buildStubFindings('tech_stack', '# Spec\nBuild a login page')
    expect(result.topic).toBe('tech_stack')
    expect(result.keywords).toContain('TypeScript')
    expect(result.findings).toContain('Tech Stack Research')
  })

  it('returns codebase findings with Result keyword', async () => {
    const { buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const result = buildStubFindings('codebase', '# Spec\nBuild a login page')
    expect(result.topic).toBe('codebase')
    expect(result.keywords).toContain('Result')
    expect(result.findings).toContain('Codebase Research')
  })

  it('returns squad_domain findings with Constitution keyword', async () => {
    const { buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const result = buildStubFindings('squad_domain', '# Spec\nBuild a login page')
    expect(result.topic).toBe('squad_domain')
    expect(result.keywords).toContain('Constitution')
    expect(result.findings).toContain('Domain Constraints Research')
  })

  it('incorporates spec first line into findings', async () => {
    const { buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const result = buildStubFindings('tech_stack', 'My unique feature description')
    expect(result.findings).toContain('My unique feature description')
  })
})

// ---------------------------------------------------------------------------
// consolidateResearch unit tests
// ---------------------------------------------------------------------------

describe('consolidateResearch', () => {
  it('merges three research results into a summary', async () => {
    const { consolidateResearch, buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const ts = buildStubFindings('tech_stack', '# Spec')
    const cb = buildStubFindings('codebase', '# Spec')
    const sd = buildStubFindings('squad_domain', '# Spec')
    const summary = consolidateResearch(ts, cb, sd)
    expect(summary.techStack).toBe(ts)
    expect(summary.codebase).toBe(cb)
    expect(summary.squadDomain).toBe(sd)
    expect(summary.consolidatedAt).toBeTruthy()
  })

  it('sets consolidatedAt as ISO 8601 string', async () => {
    const { consolidateResearch, buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const ts = buildStubFindings('tech_stack', '# Spec')
    const cb = buildStubFindings('codebase', '# Spec')
    const sd = buildStubFindings('squad_domain', '# Spec')
    const summary = consolidateResearch(ts, cb, sd)
    expect(() => new Date(summary.consolidatedAt)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// buildPlanContent unit tests
// ---------------------------------------------------------------------------

describe('buildPlanContent', () => {
  it('includes research findings sections in the plan', async () => {
    const { buildPlanContent, consolidateResearch, buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const ts = buildStubFindings('tech_stack', '# Spec\nLogin feature')
    const cb = buildStubFindings('codebase', '# Spec\nLogin feature')
    const sd = buildStubFindings('squad_domain', '# Spec\nLogin feature')
    const summary = consolidateResearch(ts, cb, sd)
    const plan = buildPlanContent('# Spec\nLogin feature', summary, 'login-feature', '2026-03-16T00:00:00.000Z')
    expect(plan).toContain('## Research Findings')
    expect(plan).toContain('### Tech Stack')
    expect(plan).toContain('### Codebase Context')
    expect(plan).toContain('### Domain Constraints')
  })

  it('includes key references section with all research keywords', async () => {
    const { buildPlanContent, consolidateResearch, buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const ts = buildStubFindings('tech_stack', '# Spec')
    const cb = buildStubFindings('codebase', '# Spec')
    const sd = buildStubFindings('squad_domain', '# Spec')
    const summary = consolidateResearch(ts, cb, sd)
    const plan = buildPlanContent('# Spec', summary, 'test-slug', '2026-03-16T00:00:00.000Z')
    expect(plan).toContain('## Key References from Research')
    expect(plan).toContain('`TypeScript`')
    expect(plan).toContain('`Result`')
    expect(plan).toContain('`Constitution`')
  })

  it('includes wave plan structure with agent tags', async () => {
    const { buildPlanContent, consolidateResearch, buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const ts = buildStubFindings('tech_stack', '# Spec')
    const cb = buildStubFindings('codebase', '# Spec')
    const sd = buildStubFindings('squad_domain', '# Spec')
    const summary = consolidateResearch(ts, cb, sd)
    const plan = buildPlanContent('# Spec', summary, 'test-slug', '2026-03-16T00:00:00.000Z')
    expect(plan).toContain('## Wave Plan')
    expect(plan).toContain('[AGENT]')
  })

  it('includes spec slug in plan heading', async () => {
    const { buildPlanContent, consolidateResearch, buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const ts = buildStubFindings('tech_stack', '# Spec')
    const cb = buildStubFindings('codebase', '# Spec')
    const sd = buildStubFindings('squad_domain', '# Spec')
    const summary = consolidateResearch(ts, cb, sd)
    const plan = buildPlanContent('# Spec', summary, 'my-feature-slug', '2026-03-16T00:00:00.000Z')
    expect(plan).toContain('# Plan — my-feature-slug')
  })

  it('includes generatedAt timestamp in plan', async () => {
    const { buildPlanContent, consolidateResearch, buildStubFindings } = await import('../../../src/commands/plan/handler.js')
    const ts = buildStubFindings('tech_stack', '# Spec')
    const cb = buildStubFindings('codebase', '# Spec')
    const sd = buildStubFindings('squad_domain', '# Spec')
    const summary = consolidateResearch(ts, cb, sd)
    const plan = buildPlanContent('# Spec', summary, 'slug', '2026-03-16T12:00:00.000Z')
    expect(plan).toContain('2026-03-16T12:00:00.000Z')
  })
})

// ---------------------------------------------------------------------------
// handler integration tests
// ---------------------------------------------------------------------------

describe('plan handler integration', () => {
  let tmpDir: string
  const origCwd = process.cwd

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-plan-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(async () => {
    vi.spyOn(process, 'cwd').mockImplementation(origCwd)
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns ok and writes plan.md when spec exists', async () => {
    // Create a spec
    const specsDir = join(tmpDir, '.buildpact', 'specs', 'my-feature')
    await mkdir(specsDir, { recursive: true })
    await writeFile(join(specsDir, 'spec.md'), '# Spec — my-feature\n\nUsers should be able to log in.', 'utf-8')

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    const planPath = join(tmpDir, '.buildpact', 'plans', 'my-feature', 'plan.md')
    const planContent = await readFile(planPath, 'utf-8')
    expect(planContent).toContain('# Plan — my-feature')
    expect(planContent).toContain('## Research Findings')
  })

  it('returns ok with no plan written when no spec exists', async () => {
    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
  })

  it('returns error when explicit spec path does not exist', async () => {
    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run(['/nonexistent/path/spec.md'])
    expect(result.ok).toBe(false)
  })

  it('writes wave files when spec has more than MAX_TASKS_PER_PLAN_FILE tasks in a single wave', async () => {
    // Create a spec with 4 independent tasks (all in wave 0, needs splitting 2+2)
    const specsDir = join(tmpDir, '.buildpact', 'specs', 'wave-split-feature')
    await mkdir(specsDir, { recursive: true })
    const spec = [
      '# Spec — wave-split-feature',
      '',
      '## Acceptance Criteria',
      '',
      '- Task Alpha: set up database',
      '- Task Beta: configure environment',
      '- Task Gamma: implement API routes',
      '- Task Delta: add integration tests',
    ].join('\n')
    await writeFile(join(specsDir, 'spec.md'), spec, 'utf-8')

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    const planDir = join(tmpDir, '.buildpact', 'plans', 'wave-split-feature')
    const planContent = await readFile(join(planDir, 'plan.md'), 'utf-8')
    expect(planContent).toContain('## Wave Plan')

    // Should have written wave files for the split
    const waveFile1 = await readFile(join(planDir, 'plan-wave-1.md'), 'utf-8')
    expect(waveFile1).toContain('[AGENT]')
    expect(waveFile1).toContain('Wave 1')

    const waveFile1b = await readFile(join(planDir, 'plan-wave-1b.md'), 'utf-8')
    expect(waveFile1b).toContain('Wave 1B')
  })

  it('writes validation-report.md alongside plan.md', async () => {
    const specsDir = join(tmpDir, '.buildpact', 'specs', 'validation-test-feature')
    await mkdir(specsDir, { recursive: true })
    await writeFile(
      join(specsDir, 'spec.md'),
      '# Spec\n\n## Acceptance Criteria\n\n- Implement authentication system endpoint\n',
      'utf-8',
    )

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    const reportPath = join(tmpDir, '.buildpact', 'plans', 'validation-test-feature', 'validation-report.md')
    const reportContent = await readFile(reportPath, 'utf-8')
    expect(reportContent).toContain('Nyquist Plan Validation Report')
    expect(reportContent).toContain('Completeness vs Spec')
  })
})

// ---------------------------------------------------------------------------
// plan handler validation flow tests
// ---------------------------------------------------------------------------

describe('plan handler validation flow', () => {
  let tmpDir: string
  const origCwd = process.cwd

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-plan-val-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(async () => {
    vi.spyOn(process, 'cwd').mockImplementation(origCwd)
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('proceeds without prompting user when plan has no critical issues', async () => {
    const specsDir = join(tmpDir, '.buildpact', 'specs', 'clean-feature')
    await mkdir(specsDir, { recursive: true })
    await writeFile(
      join(specsDir, 'spec.md'),
      '# Spec\n\n## Acceptance Criteria\n\n- Implement clean feature endpoint successfully\n',
      'utf-8',
    )

    const clack = await import('@clack/prompts')
    const selectSpy = vi.mocked(clack.select)
    selectSpy.mockClear()

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    // select should NOT have been called for validation (no critical issues)
    expect(selectSpy).not.toHaveBeenCalled()
  })

  it('calls clack.select with 3 options when critical issues exist', async () => {
    const specsDir = join(tmpDir, '.buildpact', 'specs', 'broken-feature')
    await mkdir(specsDir, { recursive: true })
    // AC bullet with 4-char title "Fix!" passes extractTasksFromSpec (>3) but
    // fails validateConsistency (<5) → consistency critical issue
    await writeFile(
      join(specsDir, 'spec.md'),
      '# Spec\n\n## Acceptance Criteria\n\n- Fix!\n',
      'utf-8',
    )

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValueOnce('override')
    vi.mocked(clack.isCancel).mockImplementation(() => false)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.select)).toHaveBeenCalled()
    const callArgs = vi.mocked(clack.select).mock.calls[0]?.[0]
    expect((callArgs as { options: unknown[] }).options).toHaveLength(3)
  })

  it('returns ok without writing files when user cancels on critical issues', async () => {
    const specsDir = join(tmpDir, '.buildpact', 'specs', 'cancel-feature')
    await mkdir(specsDir, { recursive: true })
    await writeFile(
      join(specsDir, 'spec.md'),
      '# Spec\n\n## Acceptance Criteria\n\n- Fix!\n',
      'utf-8',
    )

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValueOnce('cancel')
    vi.mocked(clack.isCancel).mockImplementation(() => false)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    // plan.md should NOT have been written
    const planPath = join(tmpDir, '.buildpact', 'plans', 'cancel-feature', 'plan.md')
    await expect(readFile(planPath, 'utf-8')).rejects.toThrow()
  })

  it('generates plan when user chooses override on critical issues', async () => {
    const specsDir = join(tmpDir, '.buildpact', 'specs', 'override-feature')
    await mkdir(specsDir, { recursive: true })
    await writeFile(
      join(specsDir, 'spec.md'),
      '# Spec\n\n## Acceptance Criteria\n\n- Fix!\n',
      'utf-8',
    )

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValueOnce('override')
    vi.mocked(clack.isCancel).mockImplementation(() => false)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    const planPath = join(tmpDir, '.buildpact', 'plans', 'override-feature', 'plan.md')
    const content = await readFile(planPath, 'utf-8')
    expect(content).toContain('# Plan')
  })

  it('generates revised plan when user chooses revise on critical issues', async () => {
    const specsDir = join(tmpDir, '.buildpact', 'specs', 'revise-feature')
    await mkdir(specsDir, { recursive: true })
    await writeFile(
      join(specsDir, 'spec.md'),
      '# Spec\n\n## Acceptance Criteria\n\n- Fix!\n',
      'utf-8',
    )

    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValueOnce('revise')
    vi.mocked(clack.isCancel).mockImplementation(() => false)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    const planPath = join(tmpDir, '.buildpact', 'plans', 'revise-feature', 'plan.md')
    const content = await readFile(planPath, 'utf-8')
    expect(content).toContain('# Plan')
  })
})
