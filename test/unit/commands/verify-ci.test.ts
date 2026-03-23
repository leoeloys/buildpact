/**
 * CI-mode tests for the `verify` command handler.
 * Verifies that no interactive @clack/prompts calls happen when --ci is active,
 * that all ACs are auto-skipped, and that the verification report is written to disk.
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
  cancel: vi.fn(),
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

// Mock memory-layer modules so verify tests don't need real feedback storage
vi.mock('../../../src/engine/session-feedback.js', () => ({
  buildFeedbackEntry: vi.fn().mockReturnValue({ slug: 'test', workedAcs: [], failedAcs: [], allPassed: true, notes: {} }),
  captureSessionFeedback: vi.fn().mockResolvedValue(undefined),
  loadRecentFeedbacks: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../src/engine/lessons-distiller.js', () => ({
  captureDistilledLessons: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
}))

// ---------------------------------------------------------------------------
// Spec fixture
// ---------------------------------------------------------------------------

const STUB_SPEC_WITH_ACS = `# Spec — my-feature

> Generated: 2026-01-01T00:00:00.000Z
> Mode: specify (expert)

## Acceptance Criteria

- User can log in with valid credentials
- User is redirected to dashboard after login
- Invalid credentials show an error message
`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verify handler — CI mode', () => {
  let tmpDir: string
  let specPath: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-verify-ci-'))
    // Create the spec under the expected path
    const specDir = join(tmpDir, '.buildpact', 'specs', 'my-feature')
    await mkdir(specDir, { recursive: true })
    specPath = join(specDir, 'spec.md')
    await writeFile(specPath, STUB_SPEC_WITH_ACS, 'utf-8')

    vi.clearAllMocks()
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('returns ok without calling clack.select when --ci given', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/verify/handler.js')
    // Pass specPath first so args[0] resolves the spec correctly; --ci is detected anywhere in args
    const result = await handler.run([specPath, '--ci'])

    expect(result.ok).toBe(true)
    // Interactive AC verdict prompt uses clack.select — must NOT be called in CI
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })

  it('does not call clack.confirm or clack.text in CI mode', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/verify/handler.js')
    await handler.run([specPath, '--ci'])

    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
    expect(vi.mocked(clack.text)).not.toHaveBeenCalled()
  })

  it('auto-skips all ACs — report contains only skip entries', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/verify/handler.js')
    await handler.run([specPath, '--ci'])

    const reportPath = join(tmpDir, '.buildpact', 'specs', 'my-feature', 'verification-report.md')
    const reportContent = await readFile(reportPath, 'utf-8')

    // All 3 ACs should appear as SKIP in the report
    expect(reportContent).toContain('SKIP')
    // No AC should be marked as FAIL or PASS (interactive verdicts)
    expect(reportContent).not.toContain('FAIL')
    expect(reportContent).not.toContain('PASS')
  })

  it('writes verification-report.md to disk', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/verify/handler.js')
    await handler.run([specPath, '--ci'])

    const reportPath = join(tmpDir, '.buildpact', 'specs', 'my-feature', 'verification-report.md')
    const reportContent = await readFile(reportPath, 'utf-8')

    expect(reportContent).toContain('UAT Verification Report')
    expect(reportContent).toContain('my-feature')
  })

  it('report contains the correct summary counts (0 pass, 0 fail, N skipped)', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/verify/handler.js')
    await handler.run([specPath, '--ci'])

    const reportPath = join(tmpDir, '.buildpact', 'specs', 'my-feature', 'verification-report.md')
    const reportContent = await readFile(reportPath, 'utf-8')

    // Spec has 3 ACs — all skipped
    expect(reportContent).toContain('**Passed**: 0')
    expect(reportContent).toContain('**Failed**: 0')
    expect(reportContent).toContain('**Skipped**: 3')
  })

  it('appends a verified marker to the spec file', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/verify/handler.js')
    await handler.run([specPath, '--ci'])

    const updatedSpec = await readFile(specPath, 'utf-8')
    // Handler appends <!-- verified: ... --> marker
    expect(updatedSpec).toContain('<!-- verified:')
    expect(updatedSpec).toContain('skip:3')
  })

  it('auto-skips all ACs when spec path resolved from latest slug (env-var CI mode)', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')
    // Use BP_CI env var so CI mode is detected without passing --ci as args[0]
    vi.stubEnv('BP_CI', 'true')

    const { handler } = await import('../../../src/commands/verify/handler.js')
    // No explicit spec path — handler auto-discovers latest spec
    const result = await handler.run([])

    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })
})
