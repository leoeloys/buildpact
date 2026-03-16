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

// Mock child_process.execSync to avoid running real git commands in tests
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
}))

// ---------------------------------------------------------------------------
// inferCommitType unit tests (pure function — no TUI or FS)
// ---------------------------------------------------------------------------

describe('inferCommitType', () => {
  it('returns "fix" for descriptions starting with "fix"', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('fix broken login redirect')).toBe('fix')
    expect(inferCommitType('Fix null pointer in auth')).toBe('fix')
    expect(inferCommitType('resolve CORS issue')).toBe('fix')
    expect(inferCommitType('correct typo in README')).toBe('fix')
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

  it('returns "chore" for chore keywords', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('chore bump deps')).toBe('chore')
    expect(inferCommitType('build pipeline update')).toBe('chore')
  })

  it('returns "feat" as default for new feature descriptions', async () => {
    const { inferCommitType } = await import('../../../src/commands/quick/handler.js')
    expect(inferCommitType('add dark mode toggle')).toBe('feat')
    expect(inferCommitType('new user profile page')).toBe('feat')
    expect(inferCommitType('implement search functionality')).toBe('feat')
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
    const { execSync } = await import('node:child_process')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['add', 'feature', 'x'])

    // git add should have been called with the spec dir
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('git add'),
      expect.any(Object),
    )
    // git commit should have been called with type(quick): description format
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('feat(quick): add feature x'),
      expect.any(Object),
    )
  })

  it('uses "fix" commit type when description starts with "fix"', async () => {
    const { execSync } = await import('node:child_process')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['fix', 'null', 'pointer', 'in', 'auth'])

    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('fix(quick): fix null pointer in auth'),
      expect.any(Object),
    )
  })

  it('still returns ok when git commit fails (git not available)', async () => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('not a git repo') })

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
    await mockSelectSequence(['frontend', 'low', 'tests_pass', 'none'])
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
    await mockSelectSequence(['frontend', 'low', 'tests_pass', 'none'])
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
    // Answers should reflect specific selections (Frontend / UI, Low — isolated...)
    expect(content).toMatch(/Frontend/)
    expect(content).toMatch(/Low/)
    expect(content).toMatch(/All existing tests pass/)
    expect(content).toMatch(/No special constraints/)
  })

  it('spec uses "other" free-text answer when user selects other', async () => {
    // scope → other (free text), then remaining questions answered normally
    await mockSelectSequence(['other', 'medium', 'manual', 'none'])
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

  it('asks exactly 4 questions in discuss mode', async () => {
    await mockSelectSequence(['frontend', 'low', 'tests_pass', 'none'])
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const clack = await import('@clack/prompts')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--discuss', 'add', 'dashboard', 'widget'])

    expect(vi.mocked(clack.select)).toHaveBeenCalledTimes(4)
  })

  it('proceeds directly to execution after discuss answers (no extra pipeline steps)', async () => {
    await mockSelectSequence(['frontend', 'low', 'tests_pass', 'none'])
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { execSync } = await import('node:child_process')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--discuss', 'add', 'export', 'csv'])
    expect(result.ok).toBe(true)

    // Execution still produces git commit (same as base quick mode)
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('git add'),
      expect.any(Object),
    )
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('feat(quick): add export csv'),
      expect.any(Object),
    )
  })
})

// ---------------------------------------------------------------------------
// Pure function unit tests for --full mode helpers
// ---------------------------------------------------------------------------

describe('buildFullPlan', () => {
  it('generates a plan with task sections, AC coverage, and risk assessment', async () => {
    const { buildFullPlan } = await import('../../../src/commands/quick/handler.js')
    const plan = buildFullPlan('add search feature', undefined, { taskId: 'abc-123', type: 'quick' }, '2026-01-01T00:00:00.000Z')
    expect(plan).toContain('# Full Plan — add search feature')
    expect(plan).toContain('### Task 1:')
    expect(plan).toContain('### Task 2:')
    expect(plan).toContain('Acceptance Criteria Coverage')
    expect(plan).toContain('Risk Assessment')
    expect(plan).toContain('Mode: quick (full')
  })

  it('includes constitution path when provided', async () => {
    const { buildFullPlan } = await import('../../../src/commands/quick/handler.js')
    const plan = buildFullPlan('fix login bug', '/project/.buildpact/constitution.md', { taskId: 'def-456', type: 'quick' }, '2026-01-01T00:00:00.000Z')
    expect(plan).toContain('constitution.md')
    expect(plan).toContain('validated')
  })
})

describe('validatePlanCompleteness', () => {
  it('returns passed:true when all spec ACs have keywords in plan', async () => {
    const { validatePlanCompleteness } = await import('../../../src/commands/quick/handler.js')
    const spec = '## ACs\n- [ ] The change is implemented\n- [ ] Tests pass\n'
    const plan = 'implement change. tests should pass. covered.'
    const result = validatePlanCompleteness(spec, plan)
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
    expect(result.perspective).toBe('Completeness')
  })

  it('returns issues when an AC keyword is absent from plan', async () => {
    const { validatePlanCompleteness } = await import('../../../src/commands/quick/handler.js')
    const spec = '## ACs\n- [ ] Implement authentication middleware for JWT tokens\n'
    const plan = 'some unrelated content here only'
    const result = validatePlanCompleteness(spec, plan)
    expect(result.passed).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })
})

describe('validatePlanFeasibility', () => {
  it('returns passed:true for a well-structured plan', async () => {
    const { validatePlanFeasibility } = await import('../../../src/commands/quick/handler.js')
    const plan = '### Task 1: Do something\n\nRisk Assessment\n\nAcceptance Criteria Coverage\n'
    const result = validatePlanFeasibility(plan)
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
    expect(result.perspective).toBe('Feasibility')
  })

  it('returns issues when task sections are missing', async () => {
    const { validatePlanFeasibility } = await import('../../../src/commands/quick/handler.js')
    const plan = 'no tasks here at all'
    const result = validatePlanFeasibility(plan)
    expect(result.passed).toBe(false)
    expect(result.issues).toContain('Plan contains no defined tasks')
  })

  it('returns issues when risk assessment is missing', async () => {
    const { validatePlanFeasibility } = await import('../../../src/commands/quick/handler.js')
    const plan = '### Task 1: Implement\n\nAcceptance Criteria Coverage\n'
    const result = validatePlanFeasibility(plan)
    expect(result.issues.some((i) => i.includes('Risk Assessment'))).toBe(true)
  })
})

describe('verifyAgainstSpec', () => {
  it('returns all ACs as passed when plan covers their keywords', async () => {
    const { verifyAgainstSpec } = await import('../../../src/commands/quick/handler.js')
    const spec = '- [ ] Tests should pass and be green\n- [ ] Change must be implemented\n'
    const plan = 'ensure tests pass. implement change.'
    const result = verifyAgainstSpec(spec, plan)
    expect(result.failed).toHaveLength(0)
    expect(result.passed.length).toBeGreaterThan(0)
  })

  it('returns failed ACs when plan does not cover their keywords', async () => {
    const { verifyAgainstSpec } = await import('../../../src/commands/quick/handler.js')
    const spec = '- [ ] Deploy application to Kubernetes cluster with monitoring\n'
    const plan = 'write some code and commit'
    const result = verifyAgainstSpec(spec, plan)
    expect(result.failed.length).toBeGreaterThan(0)
    expect(result.passed).toHaveLength(0)
  })
})

describe('buildFixPlan', () => {
  it('generates fix plan listing failed ACs and fix tasks', async () => {
    const { buildFixPlan } = await import('../../../src/commands/quick/handler.js')
    const failedACs = ['Deploy to Kubernetes', 'Add monitoring dashboard']
    const fixPlan = buildFixPlan('update infra', failedACs, { taskId: 'fix-001' }, '2026-01-01T00:00:00.000Z')
    expect(fixPlan).toContain('# Fix Plan — update infra')
    expect(fixPlan).toContain('Deploy to Kubernetes')
    expect(fixPlan).toContain('Add monitoring dashboard')
    expect(fixPlan).toContain('### Fix Task 1:')
    expect(fixPlan).toContain('### Fix Task 2:')
    expect(fixPlan).toContain('targeted fix for failed verification')
  })
})

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
    expect(content).toContain('# Full Plan — add export button')
    expect(content).toContain('### Task 1:')
    expect(content).toContain('Risk Assessment')
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
    const { execSync } = await import('node:child_process')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    const result = await handler.run(['--full', 'add', 'risky', 'change'])
    expect(result.ok).toBe(true)

    // No git commit should happen
    expect(vi.mocked(execSync)).not.toHaveBeenCalledWith(
      expect.stringContaining('git commit'),
      expect.any(Object),
    )
  })

  it('commits spec and plan when user confirms in --full mode', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { execSync } = await import('node:child_process')

    const { handler } = await import('../../../src/commands/quick/handler.js')
    await handler.run(['--full', 'add', 'notifications'])

    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('git add'),
      expect.any(Object),
    )
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('feat(quick): add notifications'),
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
