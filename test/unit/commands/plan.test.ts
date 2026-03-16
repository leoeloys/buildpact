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
})
