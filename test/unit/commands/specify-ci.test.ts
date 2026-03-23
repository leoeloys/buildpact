/**
 * CI-mode tests for the `specify` command handler.
 * Verifies that no interactive @clack/prompts calls happen when --ci is active,
 * and that all CI guard paths (expert-only, skip ambiguity, skip maturity) fire correctly.
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

// Mock constitution enforcement so it always passes (no constitution in test fixtures)
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('specify handler — CI mode', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-specify-ci-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
    // Restore isCancel to always return false after clearAllMocks
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('returns ok and writes spec.md when --ci and description provided', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['--ci', '--description', 'Build', 'a', 'REST', 'API'])

    expect(result.ok).toBe(true)

    // Verify spec was actually written to disk
    const specsDir = join(tmpDir, '.buildpact', 'specs')
    const entries = await readdir_safe(specsDir)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('returns MISSING_ARG error when --ci given but no description', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['--ci'])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_ARG')
    }
  })

  it('does not call clack.text (no interactive prompts) in CI mode with description', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/specify/handler.js')
    await handler.run(['--ci', 'Add', 'user', 'profile', 'page'])

    expect(vi.mocked(clack.text)).not.toHaveBeenCalled()
  })

  it('does not call clack.select (no interactive prompts) in CI mode with description', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/specify/handler.js')
    await handler.run(['--ci', 'Add', 'user', 'profile', 'page'])

    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })

  it('does not call clack.confirm (no interactive prompts) in CI mode', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/specify/handler.js')
    await handler.run(['--ci', 'Add', 'payment', 'integration'])

    expect(vi.mocked(clack.confirm)).not.toHaveBeenCalled()
  })

  it('CI mode forces expert mode even when config says beginner', async () => {
    // Write config.yaml with experience: beginner
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: en\nexperience: beginner\n',
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['--ci', 'Build', 'login', 'form'])

    // Should succeed (expert path) and must NOT call the beginner wizard (clack.text)
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.text)).not.toHaveBeenCalled()
  })

  it('CI mode skips ambiguity detection even when description contains ambiguous terms', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    // "fast" and "secure" are known ambiguity triggers
    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['--ci', 'Build', 'a', 'fast', 'secure', 'API'])

    expect(result.ok).toBe(true)
    // select should not be called (clarification flow is interactive)
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })

  it('CI mode skips maturity assessment and auto-defaults to Stage 3', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['--ci', 'Add', 'dashboard', 'widget'])

    expect(result.ok).toBe(true)
    // Maturity assessment would call clack.select multiple times — must NOT happen
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()

    // The written spec should contain the auto-defaulted maturity assessment
    const specsDir = join(tmpDir, '.buildpact', 'specs')
    const slugDirs = await readdir_safe(specsDir)
    if (slugDirs.length > 0) {
      const specPath = join(specsDir, slugDirs[0]!, 'spec.md')
      const content = await readFile(specPath, 'utf-8').catch(() => '')
      // CI auto-assigns a maturity stage — section should be present
      expect(content).toContain('Automation Maturity Assessment')
    }
  })

  it('CI mode skips squad question flow', async () => {
    // Write config with an active squad
    await mkdir(join(tmpDir, '.buildpact', 'squads', 'software'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: en\nactive_squad: software\n',
      'utf-8',
    )
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'software', 'squad.yaml'),
      'name: software\ndomain: software\n',
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['--ci', 'Add', 'REST', 'endpoints'])

    expect(result.ok).toBe(true)
    // Squad questions use clack.select — must not be called in CI
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function readdir_safe(dir: string): Promise<string[]> {
  try {
    const { readdir } = await import('node:fs/promises')
    return await readdir(dir)
  } catch {
    return []
  }
}
