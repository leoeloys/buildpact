import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
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

// ---------------------------------------------------------------------------
// detectImplementationDetails unit tests (pure function)
// ---------------------------------------------------------------------------

describe('detectImplementationDetails', () => {
  it('returns undefined for clean natural language input', async () => {
    const { detectImplementationDetails } = await import(
      '../../../src/commands/specify/handler.js'
    )
    expect(detectImplementationDetails('Users should be able to reset their password')).toBeUndefined()
    expect(detectImplementationDetails('Add a way to search for products')).toBeUndefined()
    expect(detectImplementationDetails('Show a confirmation before deleting an item')).toBeUndefined()
  })

  it('returns matched keyword for "function " keyword', async () => {
    const { detectImplementationDetails } = await import(
      '../../../src/commands/specify/handler.js'
    )
    const result = detectImplementationDetails('Add a function that handles user login')
    expect(result).toBe('function ')
  })

  it('returns matched keyword for "class " keyword', async () => {
    const { detectImplementationDetails } = await import(
      '../../../src/commands/specify/handler.js'
    )
    const result = detectImplementationDetails('Create a class for user management')
    expect(result).toBe('class ')
  })

  it('returns matched keyword for "database schema" keyword', async () => {
    const { detectImplementationDetails } = await import(
      '../../../src/commands/specify/handler.js'
    )
    const result = detectImplementationDetails('Update the database schema to add a new column')
    expect(result).toBe('database schema')
  })

  it('returns matched keyword for "api endpoint" (case-insensitive)', async () => {
    const { detectImplementationDetails } = await import(
      '../../../src/commands/specify/handler.js'
    )
    const result = detectImplementationDetails('Create an API endpoint for login')
    expect(result).toBe('api endpoint')
  })

  it('returns matched keyword for "migration"', async () => {
    const { detectImplementationDetails } = await import(
      '../../../src/commands/specify/handler.js'
    )
    const result = detectImplementationDetails('Write a migration to add users table')
    expect(result).toBe('migration')
  })
})

// ---------------------------------------------------------------------------
// buildSpecContent unit tests
// ---------------------------------------------------------------------------

describe('buildSpecContent', () => {
  const basePayload = { taskId: 'test-123', type: 'specify' }
  const generatedAt = '2026-03-16T00:00:00.000Z'

  it('generates beginner spec with all required sections', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'beginner',
      wizardAnswers: {
        persona: 'registered user',
        goal: 'reset their password',
        motivation: 'regain access quickly',
        successOutcome: 'receive an email with a reset link',
        constraints: 'email sent within 60 seconds',
      },
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'reset-their-password',
    })

    expect(content).toContain('## User Story')
    expect(content).toContain('**As a** registered user')
    expect(content).toContain('**I want to** reset their password')
    expect(content).toContain('**So that** regain access quickly')
    expect(content).toContain('## Acceptance Criteria')
    expect(content).toContain('Given/When/Then')
    expect(content).toContain('## Functional Requirements')
    expect(content).toContain('## Non-Functional Requirements')
    expect(content).toContain('## Assumptions')
    expect(content).toContain('## Constitution Self-Assessment')
  })

  it('generates expert spec with all required sections', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Users should be able to search products by name and filter by category.',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'product-search',
    })

    expect(content).toContain('## User Story')
    expect(content).toContain('Users should be able to search products')
    expect(content).toContain('## Acceptance Criteria')
    expect(content).toContain('Given/When/Then')
    expect(content).toContain('## Functional Requirements')
    expect(content).toContain('## Non-Functional Requirements')
    expect(content).toContain('## Assumptions')
    expect(content).toContain('## Constitution Self-Assessment')
  })

  it('includes constitution path in spec when provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add dark mode',
      constitutionPath: '/project/.buildpact/constitution.md',
      payload: basePayload,
      generatedAt,
      slug: 'add-dark-mode',
    })

    expect(content).toContain('/project/.buildpact/constitution.md')
    expect(content).toContain('validated before acceptance')
  })

  it('omits constitution path when not provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add dark mode',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'add-dark-mode',
    })

    expect(content).toContain('not configured')
    expect(content).not.toContain('validated before acceptance')
  })

  it('includes mode label in spec metadata', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const beginner = buildSpecContent({
      mode: 'beginner',
      wizardAnswers: {
        persona: 'user',
        goal: 'do something',
        motivation: 'because',
        successOutcome: 'it works',
        constraints: 'None specified',
      },
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'test',
    })
    expect(beginner).toContain('Mode: specify (beginner)')

    const expert = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Do something',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'test',
    })
    expect(expert).toContain('Mode: specify (expert)')
  })
})

// ---------------------------------------------------------------------------
// handler integration tests
// ---------------------------------------------------------------------------

describe('specify handler (expert mode)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-specify-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('generates spec.md from CLI args in expert mode', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['users', 'can', 'reset', 'password'])
    expect(result.ok).toBe(true)

    const specPath = join(tmpDir, '.buildpact', 'specs', 'users-can-reset-password', 'spec.md')
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('## User Story')
    expect(content).toContain('users can reset password')
    expect(content).toContain('## Acceptance Criteria')
    expect(content).toContain('## Constitution Self-Assessment')
  })

  it('generates spec.md from TUI prompt when no args given', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.text).mockResolvedValueOnce('add product search feature')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'add-product-search-feature',
      'spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('add product search feature')
  })

  it('warns when input contains implementation details', async () => {
    const clack = await import('@clack/prompts')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    await handler.run(['create', 'a', 'function', 'for', 'login'])

    expect(vi.mocked(clack.log.warn)).toHaveBeenCalled()
  })

  it('includes constitution path in spec when constitution file exists', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'constitution.md'),
      '# Project Constitution\n\n## Coding Standards\nUse TypeScript strict mode\n',
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['add', 'dark', 'mode'])
    expect(result.ok).toBe(true)

    const specPath = join(tmpDir, '.buildpact', 'specs', 'add-dark-mode', 'spec.md')
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('constitution.md')
  })

  it('returns ok and cancels when TUI text is cancelled', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValueOnce(true)
    vi.mocked(clack.text).mockResolvedValueOnce(Symbol('cancel') as unknown as string)

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.outro)).toHaveBeenCalled()
  })
})

describe('specify handler (beginner mode)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-specify-beginner-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    // Write config with experience: beginner
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'experience: beginner\nlanguage: en\n',
      'utf-8',
    )
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('runs wizard in beginner mode and generates spec.md', async () => {
    const clack = await import('@clack/prompts')
    // Mock 5 wizard text prompts: persona, goal, motivation, successOutcome, constraints
    vi.mocked(clack.text)
      .mockResolvedValueOnce('registered user')
      .mockResolvedValueOnce('reset their password')
      .mockResolvedValueOnce('regain access quickly')
      .mockResolvedValueOnce('receive a reset link via email')
      .mockResolvedValueOnce('email within 60 seconds')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    const specPath = join(
      tmpDir,
      '.buildpact',
      'specs',
      'reset-their-password',
      'spec.md',
    )
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('**As a** registered user')
    expect(content).toContain('**I want to** reset their password')
    expect(content).toContain('Mode: specify (beginner)')
    expect(content).toContain('Given/When/Then')
  })

  it('cancels when user cancels first wizard question', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValueOnce(true)
    vi.mocked(clack.text).mockResolvedValueOnce(Symbol('cancel') as unknown as string)

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.outro)).toHaveBeenCalled()
  })
})
