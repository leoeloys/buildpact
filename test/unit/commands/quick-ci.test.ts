/**
 * CI-mode tests for the `quick` command handler.
 * Verifies that no interactive @clack/prompts calls happen when --ci is active,
 * and that CI-specific guard paths fire correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
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

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
  execSync: vi.fn(() => ''),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('quick handler — CI mode', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-quick-ci-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('executes without interactive prompts when --ci and description provided', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--ci', 'Add', 'login', 'endpoint'])

    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.text)).not.toHaveBeenCalled()
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
  })

  it('writes quick-spec.md to disk in CI mode', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--ci', 'Add', 'login', 'endpoint'])

    const specPath = join(tmpDir, '.buildpact', 'specs', 'add-login-endpoint', 'quick-spec.md')
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('Add login endpoint')
  })

  it('returns MISSING_ARG error when --ci given but no description', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--ci'])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_ARG')
    }
  })

  it('CI mode ignores --discuss flag and does not gather clarifying questions', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--ci', '--discuss', 'Add', 'export', 'feature'])

    expect(result.ok).toBe(true)
    // Discuss flow uses clack.select for each question — must NOT be called in CI
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })

  it('CI mode auto-proceeds on L2 scale without confirm prompt', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    // Use a description that involves enough complexity to potentially score L2
    // (multi-system integration keywords trigger higher scale assessment)
    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--ci', 'Integrate', 'payment', 'gateway', 'with', 'webhook', 'handling'])

    // L2 scale confirm prompt must NOT be called in CI
    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
  })

  it('CI mode --ci with description results in atomic git commit', async () => {
    const { execFileSync } = await import('node:child_process')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--ci', 'Add', 'dark', 'mode'])

    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['add']),
      expect.any(Object),
    )
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining([expect.stringContaining('feat(quick): Add dark mode')]),
      expect.any(Object),
    )
  })

  it('CI mode --full with risks skips the risk confirm prompt', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--ci', '--full', 'Migrate', 'database', 'schema'])

    expect(result.ok).toBe(true)
    // Risk confirmation uses clack.confirm — must NOT be called in CI
    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
  })
})
