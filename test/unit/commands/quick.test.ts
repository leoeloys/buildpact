import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
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

// Mock child_process.execFileSync to avoid running real git commands in tests
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
  execSync: vi.fn(() => ''),
}))

// ---------------------------------------------------------------------------
// inferCommitType unit tests (pure function — no TUI or FS)
// ---------------------------------------------------------------------------

describe('inferCommitType', () => {
  it('returns "fix" for AC#3 fix keywords anywhere in description', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('fix broken login redirect')).toBe('fix')
    expect(inferCommitType('Fix null pointer in auth')).toBe('fix')
    expect(inferCommitType('resolve CORS issue')).toBe('fix')
    expect(inferCommitType('correct typo in README')).toBe('fix')
    // AC#3 keywords that were previously missing
    expect(inferCommitType('error in auth module')).toBe('fix')
    expect(inferCommitType('handle null case in login')).toBe('fix')
    expect(inferCommitType('broken redirect after logout')).toBe('fix')
    expect(inferCommitType('crash on startup')).toBe('fix')
    expect(inferCommitType('wrong calculation in totals')).toBe('fix')
  })

  it('returns "docs" for descriptions starting with "docs" keywords', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('docs update for API')).toBe('docs')
    expect(inferCommitType('document the new endpoint')).toBe('docs')
    expect(inferCommitType('readme improvements')).toBe('docs')
  })

  it('returns "test" for descriptions starting with "test" keywords', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('test coverage for auth module')).toBe('test')
    expect(inferCommitType('spec for user registration')).toBe('test')
  })

  it('returns "refactor" for refactor keywords', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('refactor auth module')).toBe('refactor')
    expect(inferCommitType('rename getUser to fetchUser')).toBe('refactor')
  })

  it('returns "feat" for AC#3 feat keywords anywhere in description', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('add dark mode toggle')).toBe('feat')
    expect(inferCommitType('new user profile page')).toBe('feat')
    expect(inferCommitType('implement search functionality')).toBe('feat')
    expect(inferCommitType('build search feature')).toBe('feat')
    expect(inferCommitType('introduce dark mode')).toBe('feat')
    expect(inferCommitType('enable notifications')).toBe('feat')
  })

  it('returns "chore" as default when no fix/feat keywords match (AC#3)', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('bump dependencies')).toBe('chore')
    expect(inferCommitType('update lockfile')).toBe('chore')
    expect(inferCommitType('upgrade node version')).toBe('chore')
  })
})

// ---------------------------------------------------------------------------
// handler integration tests
// ---------------------------------------------------------------------------

describe('quick handler', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-quick-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('generates quick-spec.md from CLI args description', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['add', 'dark', 'mode', 'toggle'])
    expect(result.ok).toBe(true)

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'add-dark-mode-toggle',
      'quick-spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('# Quick Spec — add dark mode toggle')
    expect(content).toContain('add dark mode toggle')
    expect(content).toContain('Mode: quick (zero-ceremony)')
  })

  it('generates quick-spec.md from TUI prompt when no args given', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.text).mockResolvedValueOnce('fix broken login')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'fix-broken-login',
      'quick-spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('fix broken login')
  })

  it('injects constitution path into spec when constitution exists', async () => {
    // Write a constitution file
    const { writeFile } = await import('node:fs/promises')
    await writeFile(
      join(tmpDir, '.buildpact', 'constitution.md'),
      '# Project Constitution\n\n## Coding Standards\nUse TypeScript strict mode\n',
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['add', 'search', 'feature'])
    expect(result.ok).toBe(true)

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'add-search-feature',
      'quick-spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('constitution.md')
    expect(content).toContain('validated')
  })

  it('spec notes "not configured" when no constitution exists', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['implement', 'export', 'feature'])
    expect(result.ok).toBe(true)

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'implement-export-feature',
      'quick-spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('not configured')
  })

  it('returns ok when user cancels TUI prompt', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(true)
    vi.mocked(clack.text).mockResolvedValueOnce(Symbol('cancel'))

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
  })

  it('spec includes taskId and type metadata', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['add', 'user', 'avatar'])

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'add-user-avatar',
      'quick-spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    expect(content).toMatch(/Task ID.*[0-9a-f-]{36}/)
    expect(content).toContain('**Type**: `quick`')
  })

  it('attempts git add and commit with correct message format', async () => {
    const { execFileSync } = await import('node:child_process')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['add', 'feature', 'x'])

    // git add should have been called
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['add']),
      expect.any(Object),
    )
    // git commit should have been called with type(quick): description format
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining([expect.stringContaining('feat(quick): add feature x')]),
      expect.any(Object),
    )
  })

  it('uses "fix" commit type when description starts with "fix"', async () => {
    const { execFileSync } = await import('node:child_process')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['fix', 'null', 'pointer', 'in', 'auth'])

    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining([expect.stringContaining('fix(quick): fix null pointer in auth')]),
      expect.any(Object),
    )
  })

  it('still returns ok when git commit fails (git not available)', async () => {
    const { execFileSync } = await import('node:child_process')
    vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error('not a git repo') })

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    // Even if git fails, handler must succeed (spec was written)
    const result = await handler.run(['add', 'theme', 'switcher'])
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// --discuss mode tests
// ---------------------------------------------------------------------------

describe('quick handler --discuss mode', () => {
  let tmpDir: string

  /**
   * Set up clack.select to return each response in order.
   * Uses mockImplementation with a closure counter so it works
   * reliably regardless of vi.clearAllMocks queue-clearing behaviour.
   */
  async function mockSelectSequence(responses: string[]) {
    const clack = await import('@clack/prompts')
    let idx = 0
    vi.mocked(clack.select).mockImplementation(async () => responses[idx++] ?? 'none')
  }

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-discuss-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
    // Explicitly restore isCancel to return false after clearAllMocks,
    // guarding against any Vitest version that might wipe the factory impl.
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('generates quick-spec.md with discussion context when --discuss given', async () => {
    await mockSelectSequence(['This module only', 'Minimal change', 'No breaking changes', 'Silent / no output', 'Standard error handling'])
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--discuss', 'add', 'payment', 'integration'])
    expect(result.ok).toBe(true)

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'add-payment-integration',
      'quick-spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('add payment integration')
    expect(content).toContain('quick (with discussion)')
    expect(content).toContain('Context from Discussion')
  })

  it('spec includes selected answer text, not generic placeholder', async () => {
    await mockSelectSequence(['This module only', 'Best practices', 'No breaking changes', 'Log message', 'Standard error handling'])
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--discuss', 'refactor', 'auth', 'module'])

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'refactor-auth-module',
      'quick-spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    // Answers should reflect the specific option text selected
    expect(content).toContain('This module only')
    expect(content).toContain('Best practices')
    expect(content).toContain('No breaking changes')
    expect(content).toContain('Log message')
  })

  it('spec uses "other" free-text answer when user selects other', async () => {
    // scope → Other (free text), then remaining questions answered normally
    await mockSelectSequence(['Other (free text)', 'Minimal change', 'No breaking changes', 'Silent / no output', 'Standard error handling'])
    const clack = await import('@clack/prompts')
    vi.mocked(clack.text).mockResolvedValueOnce('Shared utility library')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--discuss', 'update', 'utils'])

    const specPath = join(tmpDir, '.buildpact', 'specs', 'update-utils', 'quick-spec.md')
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('Shared utility library')
  })

  it('cancels cleanly when user cancels a discuss question', async () => {
    const clack = await import('@clack/prompts')
    const cancelSymbol = Symbol('cancel')
    vi.mocked(clack.select).mockImplementation(async () => cancelSymbol as unknown as string)
    vi.mocked(clack.isCancel).mockImplementation((v) => v === cancelSymbol)

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--discuss', 'add', 'feature'])
    expect(result.ok).toBe(true)
  })

  it('asks exactly 5 questions for a description without technical terms', async () => {
    await mockSelectSequence(['This module only', 'Minimal change', 'No breaking changes', 'Silent / no output', 'Standard error handling'])
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--discuss', 'add', 'dashboard', 'widget'])

    expect(vi.mocked(clack.select)).toHaveBeenCalledTimes(5)
  })

  it('asks exactly 3 questions for a description with ≥3 technical terms', async () => {
    await mockSelectSequence(['This module only', 'Minimal change', 'No breaking changes'])
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    // api + database + schema = 3 technical terms → reduction to 3 questions
    await handler.run(['--discuss', 'update', 'api', 'with', 'database', 'schema'])

    expect(vi.mocked(clack.select)).toHaveBeenCalledTimes(3)
  })

  it('proceeds directly to execution after discuss answers (no extra pipeline steps)', async () => {
    await mockSelectSequence(['This module only', 'Minimal change', 'No breaking changes', 'Silent / no output', 'Standard error handling'])
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { execFileSync } = await import('node:child_process')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--discuss', 'add', 'export', 'csv'])
    expect(result.ok).toBe(true)

    // Execution still produces git commit (same as base quick mode)
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['add']),
      expect.any(Object),
    )
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining([expect.stringContaining('feat(quick): add export csv')]),
      expect.any(Object),
    )
  })
})

// ---------------------------------------------------------------------------
// Note: buildFullPlan, validatePlanCompleteness (handler), validatePlanFeasibility,
// verifyAgainstSpec, buildFixPlan have been replaced by plan-verifier.ts pure functions.
// Those pure functions are tested in test/unit/commands/quick-full.test.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// --full mode handler integration tests
// ---------------------------------------------------------------------------

describe('quick handler --full mode', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-full-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    // Default: user confirms risk (proceeds with execution)
    vi.mocked(clack.confirm).mockResolvedValue(true)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('generates quick-spec.md with mode "quick (full)" when --full given', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--full', 'add', 'user', 'profile'])
    expect(result.ok).toBe(true)

    const specPath = join(tmpDir, '.buildpact', 'specs', 'add-user-profile', 'quick-spec.md')
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('add user profile')
    expect(content).toContain('Mode: quick (full)')
  })

  it('generates plan.md alongside spec in --full mode', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--full', 'add', 'export', 'button'])

    const planPath = join(tmpDir, '.buildpact', 'specs', 'add-export-button', 'plan.md')
    const content = await readFile(planPath, 'utf-8')
    expect(content).toContain('# Quick Plan — add export button')
    expect(content).toContain('quick (full — with plan verification)')
    expect(content).toContain('## Steps')
  })

  it('shows risk confirmation prompt before execution', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--full', 'fix', 'header', 'layout'])

    expect(vi.mocked(clack.confirm)).toHaveBeenCalledOnce()
  })

  it('aborts without commit when user declines risk confirm', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.confirm).mockResolvedValue(false)
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { execFileSync } = await import('node:child_process')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--full', 'add', 'risky', 'change'])
    expect(result.ok).toBe(true)

    // No git commit should happen
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['commit']),
      expect.any(Object),
    )
  })

  it('commits spec and plan when user confirms in --full mode', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { execFileSync } = await import('node:child_process')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--full', 'add', 'notifications'])

    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['add']),
      expect.any(Object),
    )
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining([expect.stringContaining('feat(quick): add notifications')]),
      expect.any(Object),
    )
  })

  it('does not generate fix-plan.md when all ACs pass verification', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--full', 'add', 'dark', 'mode'])

    const fixPlanPath = join(tmpDir, '.buildpact', 'specs', 'add-dark-mode', 'fix-plan.md')
    let fixPlanExists = false
    try {
      await readFile(fixPlanPath, 'utf-8')
      fixPlanExists = true
    } catch {
      fixPlanExists = false
    }
    // The generated plan covers the built-in ACs, so no fix plan expected
    expect(fixPlanExists).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// index.ts: parseQuickArgs unit tests (Story 3.1 — Task 5.1)
// ---------------------------------------------------------------------------

describe('parseQuickArgs', () => {
  it('returns empty description and base mode for empty args', async () => {
    const { parseQuickArgs } = await import('../../../src/commands/quick/index.js')
    expect(parseQuickArgs([])).toEqual({ description: '', mode: 'base' })
  })

  it('returns discuss mode and strips --discuss flag from description', async () => {
    const { parseQuickArgs } = await import('../../../src/commands/quick/index.js')
    expect(parseQuickArgs(['--discuss', 'add rate limiting'])).toEqual({
      description: 'add rate limiting',
      mode: 'discuss',
    })
  })

  it('returns full mode and joins multi-token description without --full flag', async () => {
    const { parseQuickArgs } = await import('../../../src/commands/quick/index.js')
    expect(parseQuickArgs(['--full', 'migrate', 'users', 'table'])).toEqual({
      description: 'migrate users table',
      mode: 'full',
    })
  })

  it('returns base mode and joins tokens when no flags present', async () => {
    const { parseQuickArgs } = await import('../../../src/commands/quick/index.js')
    expect(parseQuickArgs(['fix', 'null', 'pointer'])).toEqual({
      description: 'fix null pointer',
      mode: 'base',
    })
  })
})

// ---------------------------------------------------------------------------
// index.ts: loadQuickTemplate unit tests (Story 3.1 — Task 5.1)
// ---------------------------------------------------------------------------

describe('loadQuickTemplate', () => {
  it('returns a string containing the ORCHESTRATOR header', async () => {
    const { loadQuickTemplate } = await import('../../../src/commands/quick/index.js')
    expect(loadQuickTemplate()).toContain('<!-- ORCHESTRATOR: quick')
  })

  it('template is at most 300 lines', async () => {
    const { loadQuickTemplate } = await import('../../../src/commands/quick/index.js')
    expect(loadQuickTemplate().split('\n').length).toBeLessThanOrEqual(300)
  })
})

// ---------------------------------------------------------------------------
// index.ts: runQuick error cases (Story 3.1 — Task 5.1)
// ---------------------------------------------------------------------------

describe('runQuick', () => {
  it('returns MISSING_ARG error when no description provided', async () => {
    const { runQuick } = await import('../../../src/commands/quick/index.js')
    const result = await runQuick([], '/tmp/test-project')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_ARG')
    }
  })

  it('delegates --discuss mode to handler (no longer NOT_IMPLEMENTED)', async () => {
    const { runQuick } = await import('../../../src/commands/quick/index.js')
    // --discuss mode now runs via handler.run(), which produces a spec
    // In test environment with mocked clack, the handler should succeed
    const result = await runQuick(['--discuss', 'task'], '/tmp/test-project')
    // Handler runs the discuss flow; with mocked clack.select it completes
    expect(result.ok).toBe(true)
  })

  it('delegates --full mode to handler (no longer NOT_IMPLEMENTED)', async () => {
    const { runQuick } = await import('../../../src/commands/quick/index.js')
    // --full mode now runs via handler.run(), which produces spec + plan
    // In test environment with mocked clack, the handler should succeed
    const result = await runQuick(['--full', 'add soft delete'], '/tmp/test-project')
    expect(result.ok).toBe(true)
  })
})
