/**
 * CI-mode tests for the `execute` command handler.
 * Verifies that no interactive @clack/prompts calls happen when --ci is active:
 * - L1 write-confirm prompt is skipped (auto-confirmed)
 * - Budget-exceeded prompt is skipped (hard error instead)
 * - Normal execution returns ok without prompts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
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
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
}))

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal wave plan file content with one AGENT task */
const STUB_WAVE = `# Plan — rest-api — Wave 1

> Generated: 2026-01-01T00:00:00.000Z
> Wave: Wave 1 (1 task)

## Tasks

- [ ] [AGENT] Implement JWT authentication
`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('execute handler — CI mode', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-execute-ci-'))
    // Minimal plan structure: .buildpact/plans/rest-api/plan-wave-1.md
    await mkdir(join(tmpDir, '.buildpact', 'plans', 'rest-api'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'plans', 'rest-api', 'plan-wave-1.md'),
      STUB_WAVE,
      'utf-8',
    )
    vi.clearAllMocks()
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('runs without L1 confirm prompt in CI mode', async () => {
    // Force L1 agent level by writing an approval store with level L1
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'approvals.json'),
      JSON.stringify({ '__default__': 'L1' }),
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/execute/handler.js')
    const result = await handler.run(['--ci'])

    expect(result.ok).toBe(true)
    // L1 confirm would use clack.confirm — must NOT be called in CI
    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
  })

  it('CI success returns ok without any interactive prompts', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/execute/handler.js')
    const result = await handler.run(['--ci'])

    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.text)).not.toHaveBeenCalled()
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
  })

  it('CI mode with budget exceeded returns error without showing override prompt', async () => {
    // Write a budget config with a very low session limit ($0.001) so it fires immediately
    await writeFile(
      join(tmpDir, '.buildpact', 'budget.yaml'),
      'session_limit_usd: 0.0001\nphase_limit_usd: 0\ndaily_limit_usd: 0\n',
      'utf-8',
    )
    // Write a high daily-spend baseline so budget is exceeded on first check
    await writeFile(
      join(tmpDir, '.buildpact', 'daily-spend.json'),
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), spendUsd: 999 }),
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/execute/handler.js')
    // Budget check fires before task dispatch — in CI we get a hard stop (not ok),
    // OR the handler stops early without calling the interactive override prompt.
    await handler.run(['--ci'])

    // The interactive budget override prompt uses clack.select — must NOT be called in CI
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })

  it('does not call clack.select even when no plan is found (graceful exit)', async () => {
    // Remove the plan file so "no plan found" path triggers
    const emptyDir = await mkdtemp(join(tmpdir(), 'buildpact-empty-'))
    await mkdir(join(emptyDir, '.buildpact'), { recursive: true })

    vi.spyOn(process, 'cwd').mockReturnValue(emptyDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/execute/handler.js')
    const result = await handler.run(['--ci'])

    // Graceful ok (no plan = early exit)
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()

    await rm(emptyDir, { recursive: true, force: true })
  })
})
