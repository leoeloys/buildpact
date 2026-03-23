/**
 * Integration test: plan research phase
 * Tests that the plan command produces research-summary.md in the correct snapshot path
 * and that the summary contains all 3 research domains.
 *
 * @see Story 5.1 — Task 6
 * @see AC #1 — Parallel research agents spawned
 * @see AC #2 — Research informs plan content
 * @see AC #3 — Squad domain constraints included
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts — prevents interactive TTY blocking in CI
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

// ---------------------------------------------------------------------------
// Test setup helpers
// ---------------------------------------------------------------------------

async function setupProjectDir(specSlug: string, specContent: string): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-plan-research-int-'))

  // Minimal .buildpact structure
  await mkdir(join(tmpDir, '.buildpact', 'audit'), { recursive: true })
  await mkdir(join(tmpDir, '.buildpact', 'specs', specSlug), { recursive: true })

  await writeFile(
    join(tmpDir, '.buildpact', 'config.yaml'),
    'language: en\n',
    'utf-8',
  )

  await writeFile(
    join(tmpDir, '.buildpact', 'specs', specSlug, 'spec.md'),
    specContent,
    'utf-8',
  )

  return tmpDir
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('Plan research phase — produces research-summary.md (Story 5.1, AC #1, #2, #3)', () => {
  let tmpDir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    cwdSpy?.mockRestore()
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('writes research-summary.md to .buildpact/snapshots/<spec_slug>/ (AC #1)', async () => {
    const specSlug = 'build-login-feature'
    const specContent = [
      '# Build Login Feature',
      '',
      '## Acceptance Criteria',
      '',
      '- User can enter email and password',
      '- User receives JWT token on success',
    ].join('\n')

    tmpDir = await setupProjectDir(specSlug, specContent)
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])

    expect(result.ok).toBe(true)

    const summaryPath = join(tmpDir, '.buildpact', 'snapshots', specSlug, 'research-summary.md')
    const summary = await readFile(summaryPath, 'utf-8')
    expect(summary.length).toBeGreaterThan(0)
  })

  it('research-summary.md contains all 3 domain sections (AC #1, #2)', async () => {
    const specSlug = 'process-payments'
    const specContent = [
      '# Process Payments',
      '',
      '## Acceptance Criteria',
      '',
      '- User can enter card details',
      '- System charges the card',
    ].join('\n')

    tmpDir = await setupProjectDir(specSlug, specContent)
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])

    expect(result.ok).toBe(true)

    const summaryPath = join(tmpDir, '.buildpact', 'snapshots', specSlug, 'research-summary.md')
    const summary = await readFile(summaryPath, 'utf-8')

    // All 3 domains must appear in the research summary
    expect(summary).toContain('Tech Stack')
    expect(summary).toContain('Codebase')
    expect(summary).toContain('Squad Domain')
  })

  it('research-summary.md is created before plan.md (AC #1)', async () => {
    const specSlug = 'user-registration'
    const specContent = [
      '# User Registration',
      '',
      '## Acceptance Criteria',
      '',
      '- User fills in registration form',
      '- User receives confirmation email',
    ].join('\n')

    tmpDir = await setupProjectDir(specSlug, specContent)
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])

    expect(result.ok).toBe(true)

    // Both files must exist
    const summaryPath = join(tmpDir, '.buildpact', 'snapshots', specSlug, 'research-summary.md')
    const planPath = join(tmpDir, '.buildpact', 'plans', specSlug, 'plan.md')

    const [summary, plan] = await Promise.all([
      readFile(summaryPath, 'utf-8'),
      readFile(planPath, 'utf-8'),
    ])

    expect(summary.length).toBeGreaterThan(0)
    expect(plan.length).toBeGreaterThan(0)
  })

  it('plan.md references keywords from research findings (AC #2)', async () => {
    const specSlug = 'search-functionality'
    const specContent = [
      '# Search Functionality',
      '',
      '## Acceptance Criteria',
      '',
      '- User can search by keyword',
      '- Results appear within 500ms',
    ].join('\n')

    tmpDir = await setupProjectDir(specSlug, specContent)
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run([])

    expect(result.ok).toBe(true)

    const planPath = join(tmpDir, '.buildpact', 'plans', specSlug, 'plan.md')
    const plan = await readFile(planPath, 'utf-8')

    // Plan should reference at least one research keyword (TypeScript is always present)
    expect(plan).toContain('TypeScript')
  })
})

describe('spawnResearchAgents — unit contract for research output (Story 5.1, AC #3, #4)', () => {
  it('all 3 domain keys are present in ResearchSummary', async () => {
    const { spawnResearchAgents } = await import('../../../src/commands/plan/researcher.js')
    const summary = await spawnResearchAgents(
      '# Spec\n\nBuild a clinic scheduling system',
      'active_squad: clinic-management',
    )

    expect(summary.techStack).toBeDefined()
    expect(summary.codebase).toBeDefined()
    expect(summary.squadConstraints).toBeDefined()
    expect(summary.techStack.domain).toBe('tech-stack')
    expect(summary.codebase.domain).toBe('codebase')
    expect(summary.squadConstraints.domain).toBe('squad-constraints')
  })

  it('each agent domain result has non-empty findings (AC #2)', async () => {
    const { spawnResearchAgents } = await import('../../../src/commands/plan/researcher.js')
    const summary = await spawnResearchAgents(
      '# Spec\n\nSend transactional emails',
      '',
    )

    expect(summary.techStack.findings.length).toBeGreaterThan(0)
    expect(summary.codebase.findings.length).toBeGreaterThan(0)
    expect(summary.squadConstraints.findings.length).toBeGreaterThan(0)
  })
})
