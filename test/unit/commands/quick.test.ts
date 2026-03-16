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
