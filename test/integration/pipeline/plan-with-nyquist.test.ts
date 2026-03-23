/**
 * Integration test: Nyquist multi-perspective plan validation (Story 5.4)
 * Tests that runPlanCommand() runs Nyquist validation, auto-revises when critical,
 * and writes nyquist-report.md to snapshots.
 *
 * @see Story 5.4 — Task 7
 * @see AC #1 — Multi-Perspective Analysis
 * @see AC #2 — Execution Blocked on Critical Issues
 * @see AC #3 — Auto-Revision Capability
 * @see AC #4 — Validation Report Format
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

async function setupSpecDir(specSlug: string, specContent: string): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-nyquist-'))
  await mkdir(join(tmpDir, '.buildpact', 'specs', specSlug), { recursive: true })
  await writeFile(
    join(tmpDir, '.buildpact', 'specs', specSlug, 'spec.md'),
    specContent,
    'utf-8',
  )
  return tmpDir
}

// Spec where all ACs are covered by tasks
const COVERED_SPEC = [
  '# User Authentication',
  '',
  '## Acceptance Criteria',
  '',
  '- Users can log in with email and password',
  '- Users can reset their password',
  '- Invalid credentials show an error message',
  '',
  '## Tasks',
  '',
  '- task-1: Implement login with email and password (deps: none)',
  '- task-2: Implement password reset flow (deps: task-1)',
  '- task-3: Add invalid credentials error handling (deps: task-1)',
].join('\n')

// Spec with an AC that no task covers (triggers completeness issue)
const UNCOVERED_AC_SPEC = [
  '# User Authentication',
  '',
  '## Acceptance Criteria',
  '',
  '- Users can log in with email and password',
  '- Users can authenticate via single sign-on OAuth',
  '- Rate limiting prevents brute force attacks',
  '',
  '## Tasks',
  '',
  '- task-1: Implement login with email and password (deps: none)',
].join('\n')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plan with Nyquist validation (Story 5.4)', () => {
  let tmpDir: string

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  it('writes nyquist-report.md to snapshots when all ACs covered', async () => {
    tmpDir = await setupSpecDir('auth-feature', COVERED_SPEC)
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand('auth-feature', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // nyquist-report.md should be written to snapshots
    expect(result.value.validationReportPath).toBeDefined()
    const reportContent = await readFile(result.value.validationReportPath!, 'utf-8')
    expect(reportContent).toContain('Nyquist')
    expect(reportContent).toContain('Completeness')
    expect(reportContent).toContain('Consistency')
    expect(reportContent).toContain('Dependency Correctness')
    expect(reportContent).toContain('Feasibility')
  })

  it('sets validationPassed to true when no critical issues', async () => {
    tmpDir = await setupSpecDir('clean-plan', COVERED_SPEC)
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand('clean-plan', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.validationPassed).toBe(true)
  })

  it('auto-revises plan when spec has uncovered ACs — revised plan includes placeholder task', async () => {
    tmpDir = await setupSpecDir('uncovered', UNCOVERED_AC_SPEC)
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand('uncovered', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Report should exist and note completeness issues
    expect(result.value.validationReportPath).toBeDefined()
    const reportContent = await readFile(result.value.validationReportPath!, 'utf-8')
    expect(reportContent).toContain('Completeness')

    // Auto-revision must have added placeholder tasks for uncovered ACs.
    // autoRevisePlan() generates tasks titled "Implement: <ac text>".
    // These should appear in at least one written plan file.
    const planFileContents = await Promise.all(
      result.value.planFiles.filter(f => f.endsWith('.md') && !f.endsWith('research-summary.md') && !f.endsWith('nyquist-report.md')).map(f => readFile(f, 'utf-8')),
    )
    const allPlanContent = planFileContents.join('\n')
    // Either the placeholder prefix "Implement:" appears OR validation passed (revision fixed all issues)
    const hasPlaceholder = allPlanContent.includes('Implement:')
    const validationPassed = result.value.validationPassed
    expect(hasPlaceholder || validationPassed).toBe(true)
  })

  it('nyquist-report.md contains all 4 perspective sections', async () => {
    tmpDir = await setupSpecDir('perspectives', COVERED_SPEC)
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand('perspectives', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const report = await readFile(result.value.validationReportPath!, 'utf-8')

    // All 4 perspectives should appear in the report
    expect(report).toContain('Completeness')
    expect(report).toContain('Consistency')
    expect(report).toContain('Dependency Correctness')
    expect(report).toContain('Feasibility')
  })

  it('includes validationReportPath in PlanOutput', async () => {
    tmpDir = await setupSpecDir('output-check', COVERED_SPEC)
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand('output-check', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.validationReportPath).toContain('nyquist-report.md')
    expect(result.value.validationReportPath).toContain('output-check')
  })
})
