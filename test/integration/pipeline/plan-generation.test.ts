/**
 * Integration test: wave-based plan generation end-to-end (Story 5.2)
 * Tests that runPlanCommand() analyses dependencies, produces correct wave structure,
 * and writes plan files to .buildpact/snapshots/<spec_slug>/plans/.
 *
 * @see Story 5.2 — Task 5
 * @see AC #1 — Wave Grouping by Dependency
 * @see AC #2 — Max 2–3 Tasks per Plan File
 * @see AC #4 — Plan Files Written to Snapshots
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts — prevents interactive TTY blocking
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

// Mock spawnResearchAgents — returns stub ResearchSummary (AC #5.5)
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
  const tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-plan-gen-'))
  await mkdir(join(tmpDir, '.buildpact', 'specs', specSlug), { recursive: true })
  await writeFile(
    join(tmpDir, '.buildpact', 'specs', specSlug, 'spec.md'),
    specContent,
    'utf-8',
  )
  return tmpDir
}

// Spec with 5 tasks having mixed dependencies:
// task-1, task-2: independent (Wave 1)
// task-3: depends on task-1 (Wave 2)
// task-4: depends on task-2 (Wave 2)
// task-5: depends on task-3 and task-4 (Wave 3)
const MIXED_DEPS_SPEC = [
  '# Reset Password Feature',
  '',
  '## Tasks',
  '',
  '- task-1: Create database schema (deps: none)',
  '- task-2: Create TypeScript types (deps: none)',
  '- task-3: Build API endpoint (deps: task-1)',
  '- task-4: Build UI form (deps: task-2)',
  '- task-5: Write integration tests (deps: task-3, task-4)',
].join('\n')

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('Plan generation end-to-end (Story 5.2)', () => {
  let tmpDir: string

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  it('plan files are written to .buildpact/snapshots/<spec_slug>/plans/ (AC #4)', async () => {
    const specSlug = 'reset-password'
    tmpDir = await setupSpecDir(specSlug, MIXED_DEPS_SPEC)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand(specSlug, tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const plansDir = join(tmpDir, '.buildpact', 'snapshots', specSlug, 'plans')
    const entries = await readdir(plansDir)
    expect(entries.length).toBeGreaterThan(0)
    // All written files should be in planFiles list
    expect(result.value.planFiles.length).toBeGreaterThan(0)
  })

  it('each plan file has ≤3 tasks (AC #2)', async () => {
    const specSlug = 'reset-password-2'
    tmpDir = await setupSpecDir(specSlug, MIXED_DEPS_SPEC)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand(specSlug, tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Read each plan file and verify task count ≤ 3
    for (const filePath of result.value.planFiles) {
      const content = await readFile(filePath, 'utf-8')
      // Count task entries (lines starting with "### Task:")
      const taskHeadings = content.match(/^### Task:/gm) ?? []
      expect(taskHeadings.length).toBeLessThanOrEqual(3)
    }
  })

  it('wave-1 tasks are all independent (no deps in plan file) (AC #1)', async () => {
    const specSlug = 'reset-password-3'
    tmpDir = await setupSpecDir(specSlug, MIXED_DEPS_SPEC)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand(specSlug, tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Find wave-1-plan-1.md
    const wave1File = result.value.planFiles.find(f => f.includes('wave-1-plan-1'))
    expect(wave1File).toBeDefined()

    const content = await readFile(wave1File!, 'utf-8')
    // Wave 1 tasks should all have "Dependencies: none"
    const depLines = content.match(/\*\*Dependencies:\*\* .+/g) ?? []
    expect(depLines.length).toBeGreaterThan(0)
    for (const line of depLines) {
      expect(line).toBe('**Dependencies:** none')
    }
  })

  it('produces correct wave count for mixed-dependency spec (AC #1)', async () => {
    const specSlug = 'reset-password-4'
    tmpDir = await setupSpecDir(specSlug, MIXED_DEPS_SPEC)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand(specSlug, tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // 5 tasks with 3-tier dependency chain → 3 waves
    expect(result.value.waveCount).toBe(3)
  })

  it('research-summary.md is written to snapshots dir (AC #4)', async () => {
    const specSlug = 'reset-password-5'
    tmpDir = await setupSpecDir(specSlug, MIXED_DEPS_SPEC)

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand(specSlug, tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const summary = await readFile(result.value.researchSummaryPath, 'utf-8')
    expect(summary).toContain('Research Summary')
    expect(summary).toContain('Tech Stack')
    expect(summary).toContain('Codebase')
  })

  it('returns FILE_READ_FAILED error when spec.md does not exist (error path)', async () => {
    const specSlug = 'nonexistent-spec'
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-plan-gen-'))

    const { runPlanCommand } = await import('../../../src/commands/plan/handler.js')
    const result = await runPlanCommand(specSlug, tmpDir)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('FILE_READ_FAILED')
  })
})
