/**
 * CI-mode tests for the `plan` command handler.
 * Verifies that no interactive @clack/prompts calls happen when --ci is active,
 * and that auto-revision, resume-skip, and readiness-gate paths work correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts — must be declared before any dynamic imports
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    step: vi.fn(),
    message: vi.fn(),
  },
  isCancel: vi.fn(() => false),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}))

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

vi.mock('../../../src/engine/orchestrator.js', () => ({
  enforceConstitutionOnOutput: vi.fn().mockResolvedValue({ ok: true, value: { hasViolations: false, violations: [] } }),
}))

vi.mock('../../../src/commands/registry.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/commands/registry.js')>()
  return {
    ...original,
    guardConstitutionModification: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  }
})

// Default: readiness gate returns PASS so plan.md is written successfully
vi.mock('../../../src/engine/readiness-gate.js', () => ({
  runReadinessGate: vi.fn().mockReturnValue({
    decision: 'PASS' as const,
    checks: [],
    passCount: 4,
    failCount: 0,
    warningCount: 0,
    report: '# Readiness Report\n\nAll checks passed.',
  }),
}))

// ---------------------------------------------------------------------------
// Shared spec content fixture
// ---------------------------------------------------------------------------

const STUB_SPEC = `# Spec — rest-api

> Generated: 2026-01-01T00:00:00.000Z
> Mode: specify (expert)

## Acceptance Criteria

- User can authenticate via JWT
- User can access protected endpoints
- Invalid tokens return 401

## Non-Functional Requirements

- Response time under 200ms
`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plan handler — CI mode', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-plan-ci-'))
    await mkdir(join(tmpDir, '.buildpact', 'specs', 'rest-api'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'specs', 'rest-api', 'spec.md'), STUB_SPEC, 'utf-8')
    vi.clearAllMocks()
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('generates plan without interactive prompts when --ci given', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run(['--ci'])

    // Handler should reach ok or a known CI-path error (readiness gate may emit CONCERNS)
    // The key assertion: no interactive calls
    expect(vi.mocked(clack.text)).not.toHaveBeenCalled()
    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
  })

  it('does not call clack.select in CI mode', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/plan/handler.js')
    await handler.run(['--ci'])

    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })

  it('CI mode skips resume prompt even when partial progress exists', async () => {
    // Write a partial progress.json simulating a previous interrupted session
    const planDir = join(tmpDir, '.buildpact', 'plans', 'rest-api')
    await mkdir(planDir, { recursive: true })
    await writeFile(
      join(planDir, 'progress.json'),
      JSON.stringify({
        slug: 'rest-api',
        generatedAt: '2026-01-01T00:00:00.000Z',
        tasks: [
          { taskId: 'T1', title: 'Auth JWT', executionType: 'agent', completed: true },
          { taskId: 'T2', title: 'Protected endpoints', executionType: 'agent', completed: false },
        ],
      }),
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/plan/handler.js')
    await handler.run(['--ci'])

    // Resume prompt is a clack.select call — must NOT happen in CI
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })

  it('CI mode writes plan.md to disk', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/plan/handler.js')
    await handler.run(['--ci'])

    // plan.md should be written under .buildpact/plans/rest-api/
    const planPath = join(tmpDir, '.buildpact', 'plans', 'rest-api', 'plan.md')
    let planExists = false
    try {
      await readFile(planPath, 'utf-8')
      planExists = true
    } catch {
      planExists = false
    }
    expect(planExists).toBe(true)
  })

  it('CI mode auto-revises plan on critical nyquist validation and does not prompt', async () => {
    // Inject a spec with content that is very likely to produce validation issues
    // (no real AC section — forces fallback tasks which may have critical dependency issues)
    const minimalSpec = '# Spec — rest-api\n\nNo acceptance criteria here.\n'
    await writeFile(join(tmpDir, '.buildpact', 'specs', 'rest-api', 'spec.md'), minimalSpec, 'utf-8')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/plan/handler.js')
    await handler.run(['--ci'])

    // The critical-issues branch calls clack.select in non-CI mode — must not be called here
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })

  it('CI mode auto-fails with error when readiness gate returns CONCERNS', async () => {
    // Override the top-level readiness-gate mock to return CONCERNS for this test only
    const { runReadinessGate } = await import('../../../src/engine/readiness-gate.js')
    vi.mocked(runReadinessGate).mockReturnValueOnce({
      decision: 'CONCERNS' as const,
      checks: [],
      passCount: 2,
      failCount: 0,
      warningCount: 1,
      report: '# Readiness Report\n\n- CONCERNS: snapshot missing',
    })

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/plan/handler.js')
    const result = await handler.run(['--ci'])

    // CI must return an error on CONCERNS (not prompt the user)
    expect(result.ok).toBe(false)
    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
  })
})
