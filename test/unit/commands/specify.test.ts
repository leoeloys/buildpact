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
    const clack = await import('@clack/prompts')
    // 4 maturity select calls: frequency, predictability, humanDecisions, override
    vi.mocked(clack.select)
      .mockResolvedValueOnce('rarely')
      .mockResolvedValueOnce('always_same')
      .mockResolvedValueOnce('none_needed')
      .mockResolvedValueOnce('keep')

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
    // 4 maturity select calls: frequency, predictability, humanDecisions, override
    vi.mocked(clack.select)
      .mockResolvedValueOnce('weekly')
      .mockResolvedValueOnce('mostly_predictable')
      .mockResolvedValueOnce('minor')
      .mockResolvedValueOnce('keep')

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
    // 4 maturity select calls: frequency, predictability, humanDecisions, override
    vi.mocked(clack.select)
      .mockResolvedValueOnce('rarely')
      .mockResolvedValueOnce('highly_variable')
      .mockResolvedValueOnce('complex_expertise')
      .mockResolvedValueOnce('keep')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    await handler.run(['create', 'a', 'function', 'for', 'login'])

    expect(vi.mocked(clack.log.warn)).toHaveBeenCalled()
  })

  it('includes constitution path in spec when constitution file exists', async () => {
    const clack = await import('@clack/prompts')
    // 4 maturity select calls: frequency, predictability, humanDecisions, override
    vi.mocked(clack.select)
      .mockResolvedValueOnce('daily')
      .mockResolvedValueOnce('always_same')
      .mockResolvedValueOnce('none_needed')
      .mockResolvedValueOnce('keep')

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
    // 4 maturity select calls: frequency, predictability, humanDecisions, override
    vi.mocked(clack.select)
      .mockResolvedValueOnce('rarely')
      .mockResolvedValueOnce('always_same')
      .mockResolvedValueOnce('minor')
      .mockResolvedValueOnce('keep')

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

// ---------------------------------------------------------------------------
// detectAmbiguities unit tests (pure function)
// ---------------------------------------------------------------------------

describe('detectAmbiguities', () => {
  it('returns empty array for clear, unambiguous input', async () => {
    const { detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    expect(detectAmbiguities('Users should be able to reset their password via email')).toEqual([])
    expect(detectAmbiguities('Add a product search feature with filters')).toEqual([])
    expect(detectAmbiguities('Show a confirmation dialog before deleting an item')).toEqual([])
  })

  it('returns matching ambiguity for "quickly"', async () => {
    const { detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const result = detectAmbiguities('The page should load quickly')
    expect(result).toHaveLength(1)
    expect(result[0].phrase).toBe('quickly')
    expect(result[0].options.length).toBeGreaterThanOrEqual(3)
  })

  it('returns matching ambiguity for "fast"', async () => {
    const { detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const result = detectAmbiguities('We need a fast checkout process')
    expect(result).toHaveLength(1)
    expect(result[0].phrase).toBe('fast')
  })

  it('returns multiple ambiguities when multiple phrases are present', async () => {
    const { detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const result = detectAmbiguities('It should be easy and secure for users')
    const phrases = result.map((a) => a.phrase)
    expect(phrases).toContain('easy')
    expect(phrases).toContain('secure')
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('deduplicates when same phrase appears multiple times', async () => {
    const { detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const result = detectAmbiguities('make it fast and also very fast')
    const fastMatches = result.filter((a) => a.phrase === 'fast')
    expect(fastMatches).toHaveLength(1)
  })

  it('detects phrases case-insensitively', async () => {
    const { detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const lower = detectAmbiguities('load quickly')
    const upper = detectAmbiguities('load QUICKLY')
    expect(lower).toHaveLength(1)
    expect(upper).toHaveLength(1)
    expect(lower[0].phrase).toBe(upper[0].phrase)
  })
})

// ---------------------------------------------------------------------------
// runClarificationFlow unit tests
// ---------------------------------------------------------------------------

describe('runClarificationFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when given no ambiguities', async () => {
    const { runClarificationFlow } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')
    const result = await runClarificationFlow([], i18n)
    expect(result).toEqual([])
  })

  it('returns answer when user selects a numbered option', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.select).mockResolvedValueOnce('Under 1 second')

    const { runClarificationFlow, detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')

    const ambiguities = detectAmbiguities('load quickly')
    const result = await runClarificationFlow(ambiguities, i18n)

    expect(result).not.toBeUndefined()
    expect(result).toHaveLength(1)
    expect(result![0].phrase).toBe('quickly')
    expect(result![0].answer).toBe('Under 1 second')
  })

  it('returns free-text answer when user selects "Other"', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.select).mockResolvedValueOnce('__other__')
    vi.mocked(clack.text).mockResolvedValueOnce('Roughly 2 seconds max')

    const { runClarificationFlow, detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')

    const ambiguities = detectAmbiguities('load quickly')
    const result = await runClarificationFlow(ambiguities, i18n)

    expect(result).not.toBeUndefined()
    expect(result![0].answer).toBe('Roughly 2 seconds max')
  })

  it('returns undefined when user cancels select', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation((v) => v === Symbol.for('cancel'))
    const cancelSymbol = Symbol.for('cancel')
    vi.mocked(clack.select).mockResolvedValueOnce(cancelSymbol as unknown as string)
    vi.mocked(clack.isCancel).mockReturnValueOnce(true)

    const { runClarificationFlow, detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')

    const ambiguities = detectAmbiguities('load quickly')
    const result = await runClarificationFlow(ambiguities, i18n)
    expect(result).toBeUndefined()
  })

  it('handles multiple ambiguities and returns all answers', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    let callIdx = 0
    vi.mocked(clack.select).mockImplementation(async () => {
      return callIdx++ === 0 ? 'Under 5 seconds' : 'HTTPS and standard auth (session/JWT)'
    })

    const { runClarificationFlow, detectAmbiguities } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')

    const ambiguities = detectAmbiguities('load fast and be secure')
    const result = await runClarificationFlow(ambiguities, i18n)

    expect(result).not.toBeUndefined()
    expect(result!.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// buildSpecContent with clarifications
// ---------------------------------------------------------------------------

describe('buildSpecContent with clarifications', () => {
  const basePayload = { taskId: 'test-456', type: 'specify' }
  const generatedAt = '2026-03-16T00:00:00.000Z'

  it('includes Clarifications section when answers provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'The system should respond quickly',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'fast-response',
      clarifications: [
        { phrase: 'quickly', question: 'How quickly should this happen?', answer: 'Under 1 second' },
      ],
    })

    expect(content).toContain('## Clarifications')
    expect(content).toContain('quickly')
    expect(content).toContain('Under 1 second')
    expect(content).toContain('How quickly should this happen?')
  })

  it('omits Clarifications section when no clarifications provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Show a dialog before deleting',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'delete-dialog',
    })

    expect(content).not.toContain('## Clarifications')
  })

  it('omits Clarifications section when empty array provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Show a dialog before deleting',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'delete-dialog',
      clarifications: [],
    })

    expect(content).not.toContain('## Clarifications')
  })
})

// ---------------------------------------------------------------------------
// handler integration tests — ambiguity detection flow
// ---------------------------------------------------------------------------

describe('specify handler — ambiguity clarification integration', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-specify-amb-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('skips clarification when description has no ambiguities', async () => {
    const clack = await import('@clack/prompts')
    // No ambiguity select calls, but maturity assessment adds 4 select calls
    vi.mocked(clack.select)
      .mockResolvedValueOnce('rarely')
      .mockResolvedValueOnce('always_same')
      .mockResolvedValueOnce('none_needed')
      .mockResolvedValueOnce('keep')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['users', 'can', 'reset', 'their', 'password'])
    expect(result.ok).toBe(true)

    // clack.select called exactly 4 times — maturity assessment only (no ambiguity clarification)
    expect(vi.mocked(clack.select)).toHaveBeenCalledTimes(4)
  })

  it('triggers clarification flow when description contains ambiguous phrase', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    // 1 clarification select + 4 maturity selects = 5 total
    vi.mocked(clack.select)
      .mockResolvedValueOnce('Under 1 second')  // clarification: quickly
      .mockResolvedValueOnce('daily')            // maturity: frequency
      .mockResolvedValueOnce('mostly_predictable') // maturity: predictability
      .mockResolvedValueOnce('minor')            // maturity: humanDecisions
      .mockResolvedValueOnce('keep')             // maturity: override
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['the', 'page', 'should', 'load', 'quickly'])
    expect(result.ok).toBe(true)

    // 5 calls total: 1 clarification + 4 maturity
    expect(vi.mocked(clack.select)).toHaveBeenCalledTimes(5)
  })

  it('writes clarifications into spec.md when ambiguity resolved', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    // 1 clarification select + 4 maturity selects = 5 total
    vi.mocked(clack.select)
      .mockResolvedValueOnce('Under 5 seconds') // clarification: quickly
      .mockResolvedValueOnce('daily')            // maturity: frequency
      .mockResolvedValueOnce('always_same')      // maturity: predictability
      .mockResolvedValueOnce('none_needed')      // maturity: humanDecisions
      .mockResolvedValueOnce('keep')             // maturity: override
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    await handler.run(['load', 'quickly'])

    const specPath = join(tmpDir, '.buildpact', 'specs', 'load-quickly', 'spec.md')
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('## Clarifications')
    expect(content).toContain('quickly')
    expect(content).toContain('Under 5 seconds')
  })
})

// ---------------------------------------------------------------------------
// getSquadQuestions unit tests (pure function)
// ---------------------------------------------------------------------------

describe('getSquadQuestions', () => {
  it('returns questions for software domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('software')
    expect(questions.length).toBeGreaterThanOrEqual(3)
    expect(questions[0].options.length).toBeGreaterThanOrEqual(3)
  })

  it('returns questions for marketing domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('marketing')
    expect(questions.length).toBeGreaterThanOrEqual(3)
  })

  it('returns questions for health domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('health')
    expect(questions.length).toBeGreaterThanOrEqual(3)
  })

  it('returns questions for research domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('research')
    expect(questions.length).toBeGreaterThanOrEqual(3)
  })

  it('returns empty array for unknown domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    expect(getSquadQuestions('unknown-domain')).toEqual([])
  })

  it('is case-insensitive for domain name', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    expect(getSquadQuestions('Software')).toEqual(getSquadQuestions('software'))
  })
})

// ---------------------------------------------------------------------------
// readActiveSquad unit tests
// ---------------------------------------------------------------------------

describe('readActiveSquad', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-squad-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns undefined when no active_squad in config', async () => {
    const { readActiveSquad } = await import('../../../src/commands/specify/handler.js')
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'language: en\n', 'utf-8')
    expect(await readActiveSquad(tmpDir)).toBeUndefined()
  })

  it('returns undefined when active_squad is "none"', async () => {
    const { readActiveSquad } = await import('../../../src/commands/specify/handler.js')
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'active_squad: none\n', 'utf-8')
    expect(await readActiveSquad(tmpDir)).toBeUndefined()
  })

  it('returns undefined when config file is missing', async () => {
    const { readActiveSquad } = await import('../../../src/commands/specify/handler.js')
    expect(await readActiveSquad(tmpDir)).toBeUndefined()
  })

  it('returns squad name and domain when squad.yaml exists', async () => {
    const { readActiveSquad } = await import('../../../src/commands/specify/handler.js')
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'active_squad: software\n', 'utf-8')
    await mkdir(join(tmpDir, '.buildpact', 'squads', 'software'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'software', 'squad.yaml'),
      'name: software\nversion: "0.1.0"\ndomain: software\n',
      'utf-8',
    )
    const result = await readActiveSquad(tmpDir)
    expect(result).toEqual({ name: 'software', domain: 'software' })
  })

  it('falls back to squad name as domain when squad.yaml missing domain field', async () => {
    const { readActiveSquad } = await import('../../../src/commands/specify/handler.js')
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'active_squad: marketing\n', 'utf-8')
    await mkdir(join(tmpDir, '.buildpact', 'squads', 'marketing'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'marketing', 'squad.yaml'),
      'name: marketing\nversion: "0.1.0"\n',
      'utf-8',
    )
    const result = await readActiveSquad(tmpDir)
    expect(result).toEqual({ name: 'marketing', domain: 'marketing' })
  })
})

// ---------------------------------------------------------------------------
// buildSpecContent with squadConstraints
// ---------------------------------------------------------------------------

describe('buildSpecContent with squadConstraints', () => {
  const basePayload = { taskId: 'test-789', type: 'specify' }
  const generatedAt = '2026-03-16T00:00:00.000Z'

  it('includes Domain Constraints section when squadConstraints provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add user authentication',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'user-auth',
      squadConstraints: {
        squadName: 'software',
        domain: 'software',
        answers: [
          { key: 'tech_stack', question: 'What is the primary technology stack?', answer: 'Backend (Node.js / Python / Go / Java)' },
          { key: 'deployment_target', question: 'What is the deployment target?', answer: 'Cloud (AWS / GCP / Azure)' },
        ],
      },
    })

    expect(content).toContain('## Domain Constraints')
    expect(content).toContain('Squad: **software**')
    expect(content).toContain('domain: software')
    expect(content).toContain('tech_stack')
    expect(content).toContain('Backend (Node.js / Python / Go / Java)')
    expect(content).toContain('Cloud (AWS / GCP / Azure)')
  })

  it('omits Domain Constraints section when no squadConstraints', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add user authentication',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'user-auth',
    })

    expect(content).not.toContain('## Domain Constraints')
  })

  it('omits Domain Constraints section when answers array is empty', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add user authentication',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'user-auth',
      squadConstraints: { squadName: 'unknown', domain: 'unknown', answers: [] },
    })

    expect(content).not.toContain('## Domain Constraints')
  })
})

// ---------------------------------------------------------------------------
// runSquadFlow unit tests
// ---------------------------------------------------------------------------

describe('runSquadFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when given no questions', async () => {
    const { runSquadFlow } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')
    const result = await runSquadFlow([], i18n, false)
    expect(result).toEqual([])
  })

  it('returns answer when user selects a numbered option in CLI mode', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.select).mockResolvedValueOnce('Cloud (AWS / GCP / Azure)')

    const { runSquadFlow, getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')
    const questions = [getSquadQuestions('software')[2]] // deployment_target

    const result = await runSquadFlow(questions, i18n, false)
    expect(result).not.toBeUndefined()
    expect(result!).toHaveLength(1)
    expect(result![0].key).toBe('deployment_target')
    expect(result![0].answer).toBe('Cloud (AWS / GCP / Azure)')
  })

  it('accepts free-text "Other" answer in CLI mode', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.select).mockResolvedValueOnce('__squad_other__')
    vi.mocked(clack.text).mockResolvedValueOnce('Custom stack — Elixir / Phoenix')

    const { runSquadFlow, getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')
    const questions = [getSquadQuestions('software')[0]] // tech_stack

    const result = await runSquadFlow(questions, i18n, false)
    expect(result).not.toBeUndefined()
    expect(result![0].answer).toBe('Custom stack — Elixir / Phoenix')
  })

  it('accepts text input in web bundle mode', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.text).mockResolvedValueOnce('1')

    const { runSquadFlow, getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')
    const questions = [getSquadQuestions('software')[0]] // tech_stack

    const result = await runSquadFlow(questions, i18n, true)
    expect(result).not.toBeUndefined()
    expect(result![0].answer).toBe('1')
  })

  it('returns undefined when user cancels in CLI mode', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValueOnce(true)
    vi.mocked(clack.select).mockResolvedValueOnce(Symbol('cancel') as unknown as string)

    const { runSquadFlow, getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')
    const questions = [getSquadQuestions('software')[0]]

    const result = await runSquadFlow(questions, i18n, false)
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// handler integration tests — Squad domain integration
// ---------------------------------------------------------------------------

describe('specify handler — Squad domain integration', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-specify-squad-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('skips squad questions when no active squad configured', async () => {
    const clack = await import('@clack/prompts')
    // No squad select calls, but maturity assessment adds 4 select calls
    vi.mocked(clack.select)
      .mockResolvedValueOnce('rarely')
      .mockResolvedValueOnce('always_same')
      .mockResolvedValueOnce('none_needed')
      .mockResolvedValueOnce('keep')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    await handler.run(['add', 'user', 'login'])

    // select called exactly 4 times — maturity assessment only (no squad questions)
    expect(vi.mocked(clack.select)).toHaveBeenCalledTimes(4)
  })

  it('injects domain questions and writes Domain Constraints to spec.md when squad is active', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    // 3 squad questions + 4 maturity selects = 7 total
    vi.mocked(clack.select)
      .mockResolvedValueOnce('Backend (Node.js / Python / Go / Java)') // squad: tech_stack
      .mockResolvedValueOnce('TypeScript strict mode')                   // squad: quality_standards
      .mockResolvedValueOnce('Cloud (AWS / GCP / Azure)')               // squad: deployment_target
      .mockResolvedValueOnce('daily')                                    // maturity: frequency
      .mockResolvedValueOnce('always_same')                              // maturity: predictability
      .mockResolvedValueOnce('none_needed')                              // maturity: humanDecisions
      .mockResolvedValueOnce('keep')                                     // maturity: override

    // Set up active software squad
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'active_squad: software\nlanguage: en\n',
      'utf-8',
    )
    await mkdir(join(tmpDir, '.buildpact', 'squads', 'software'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'software', 'squad.yaml'),
      'name: software\nversion: "0.1.0"\ndomain: software\n',
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['add', 'user', 'authentication'])
    expect(result.ok).toBe(true)

    const specPath = join(tmpDir, '.buildpact', 'specs', 'add-user-authentication', 'spec.md')
    const content = await readFile(specPath, 'utf-8')
    expect(content).toContain('## Domain Constraints')
    expect(content).toContain('Squad: **software**')
    expect(content).toContain('Backend (Node.js / Python / Go / Java)')
    expect(content).toContain('Cloud (AWS / GCP / Azure)')
  })

  it('uses clack.text (not select) in web bundle mode for both squad and maturity', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    // web bundle mode uses clack.text for squad questions (3) + maturity (3 questions + 1 override = 4)
    vi.mocked(clack.text)
      .mockResolvedValueOnce('2')   // squad: tech_stack
      .mockResolvedValueOnce('3')   // squad: quality_standards
      .mockResolvedValueOnce('1')   // squad: deployment_target
      .mockResolvedValueOnce('3')   // maturity: frequency
      .mockResolvedValueOnce('2')   // maturity: predictability
      .mockResolvedValueOnce('3')   // maturity: humanDecisions
      .mockResolvedValueOnce('1')   // maturity: override (keep)

    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'active_squad: software\nlanguage: en\nmode: web-bundle\n',
      'utf-8',
    )
    await mkdir(join(tmpDir, '.buildpact', 'squads', 'software'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'software', 'squad.yaml'),
      'name: software\nversion: "0.1.0"\ndomain: software\n',
      'utf-8',
    )

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['add', 'product', 'catalog'])
    expect(result.ok).toBe(true)

    // select should NOT have been called — all interactions use clack.text in web bundle mode
    expect(vi.mocked(clack.select)).not.toHaveBeenCalled()
    // text should have been called 7 times (3 squad + 4 maturity)
    expect(vi.mocked(clack.text)).toHaveBeenCalledTimes(7)
  })
})

// ---------------------------------------------------------------------------
// scoreMaturity unit tests (pure function)
// ---------------------------------------------------------------------------

describe('scoreMaturity', () => {
  it('returns Stage 1 (Manual) for rarely / highly_variable / complex_expertise', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    const result = scoreMaturity({
      frequency: 'rarely',
      predictability: 'highly_variable',
      humanDecisions: 'complex_expertise',
    })
    expect(result.stage).toBe(1)
    expect(result.name).toBe('Manual')
    expect(result.score).toBe(0)
    expect(result.isOverride).toBe(false)
    expect(result.justification).toContain('score: 0/9')
  })

  it('returns Stage 2 (Documented Skill) for rarely / varies / significant', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    // score: 0 + 1 + 1 = 2 → Stage 2
    const result = scoreMaturity({
      frequency: 'rarely',
      predictability: 'varies',
      humanDecisions: 'significant',
    })
    expect(result.stage).toBe(2)
    expect(result.name).toBe('Documented Skill')
    expect(result.score).toBe(2)
    expect(result.justification).toContain('score: 2/9')
  })

  it('returns Stage 3 (Alias) for rarely / mostly_predictable / minor', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    // score: 0 + 2 + 2 = 4 → Stage 3
    const result = scoreMaturity({
      frequency: 'rarely',
      predictability: 'mostly_predictable',
      humanDecisions: 'minor',
    })
    expect(result.stage).toBe(3)
    expect(result.name).toBe('Alias')
    expect(result.score).toBe(4)
  })

  it('returns Stage 4 (Heartbeat Check) for weekly / always_same / none_needed', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    // score: 1 + 3 + 3 = 7 → Stage 4
    const result = scoreMaturity({
      frequency: 'weekly',
      predictability: 'always_same',
      humanDecisions: 'none_needed',
    })
    expect(result.stage).toBe(4)
    expect(result.name).toBe('Heartbeat Check')
    expect(result.score).toBe(7)
  })

  it('returns Stage 5 (Full Automation) for multiple_daily / always_same / none_needed', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    const result = scoreMaturity({
      frequency: 'multiple_daily',
      predictability: 'always_same',
      humanDecisions: 'none_needed',
    })
    expect(result.stage).toBe(5)
    expect(result.name).toBe('Full Automation')
    expect(result.score).toBe(9)
    expect(result.justification).toContain('score: 9/9')
  })

  it('includes all input factors in justification text', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    const result = scoreMaturity({
      frequency: 'daily',
      predictability: 'always_same',
      humanDecisions: 'none_needed',
    })
    expect(result.justification).toContain('runs daily')
    expect(result.justification).toContain('steps are always identical')
    expect(result.justification).toContain('requires no human decisions')
  })
})

// ---------------------------------------------------------------------------
// assessAutomationMaturity unit tests (interactive)
// ---------------------------------------------------------------------------

describe('assessAutomationMaturity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns scored result when user keeps recommendation', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.select)
      .mockResolvedValueOnce('multiple_daily') // frequency
      .mockResolvedValueOnce('always_same')    // predictability
      .mockResolvedValueOnce('none_needed')    // humanDecisions
      .mockResolvedValueOnce('keep')           // override → keep

    const { assessAutomationMaturity } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')

    const result = await assessAutomationMaturity(i18n)
    expect(result).not.toBeUndefined()
    expect(result!.stage).toBe(5)
    expect(result!.name).toBe('Full Automation')
    expect(result!.isOverride).toBe(false)
    expect(result!.originalStage).toBeUndefined()
  })

  it('returns overridden result when user selects a different stage', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.select)
      .mockResolvedValueOnce('rarely')         // frequency
      .mockResolvedValueOnce('highly_variable') // predictability
      .mockResolvedValueOnce('complex_expertise') // humanDecisions → Stage 1
      .mockResolvedValueOnce('change')          // override → change
      .mockResolvedValueOnce(3)                 // override stage → 3

    const { assessAutomationMaturity } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')

    const result = await assessAutomationMaturity(i18n)
    expect(result).not.toBeUndefined()
    expect(result!.stage).toBe(3)
    expect(result!.name).toBe('Alias')
    expect(result!.isOverride).toBe(true)
    expect(result!.originalStage).toBe(1)
  })

  it('returns undefined when user cancels frequency question', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValueOnce(true)
    vi.mocked(clack.select).mockResolvedValueOnce(Symbol('cancel') as unknown as string)

    const { assessAutomationMaturity } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')

    const result = await assessAutomationMaturity(i18n)
    expect(result).toBeUndefined()
  })

  it('returns undefined when user cancels override question', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel)
      .mockReturnValueOnce(false) // frequency
      .mockReturnValueOnce(false) // predictability
      .mockReturnValueOnce(false) // humanDecisions
      .mockReturnValueOnce(true)  // override → cancel
    vi.mocked(clack.select)
      .mockResolvedValueOnce('daily')
      .mockResolvedValueOnce('always_same')
      .mockResolvedValueOnce('none_needed')
      .mockResolvedValueOnce(Symbol('cancel') as unknown as string)

    const { assessAutomationMaturity } = await import('../../../src/commands/specify/handler.js')
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')

    const result = await assessAutomationMaturity(i18n)
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// buildSpecContent with maturityAssessment
// ---------------------------------------------------------------------------

describe('buildSpecContent with maturityAssessment', () => {
  const basePayload = { taskId: 'test-mat', type: 'specify' }
  const generatedAt = '2026-03-16T00:00:00.000Z'

  it('includes Automation Maturity Assessment section when maturityAssessment provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Automate daily report generation',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'daily-report',
      maturityAssessment: {
        stage: 5,
        name: 'Full Automation',
        score: 9,
        justification: 'High frequency, predictable steps, no decisions.',
        isOverride: false,
      },
    })

    expect(content).toContain('## Automation Maturity Assessment')
    expect(content).toContain('**Recommended Stage**: 5 — Full Automation')
    expect(content).toContain('**Justification**: High frequency, predictable steps, no decisions.')
    expect(content).not.toContain('Override applied')
  })

  it('includes override notice when maturityAssessment.isOverride is true', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Run weekly backup',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'weekly-backup',
      maturityAssessment: {
        stage: 3,
        name: 'Alias',
        score: 1,
        justification: 'Low score but user chose a higher stage.',
        isOverride: true,
        originalStage: 1,
      },
    })

    expect(content).toContain('## Automation Maturity Assessment')
    expect(content).toContain('**Recommended Stage**: 3 — Alias')
    expect(content).toContain('Override applied')
    expect(content).toContain('Stage 1')
    expect(content).toContain('Manual')
  })

  it('omits Automation Maturity Assessment section when maturityAssessment not provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')
    const content = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add dark mode toggle',
      constitutionPath: undefined,
      payload: basePayload,
      generatedAt,
      slug: 'dark-mode',
    })

    expect(content).not.toContain('## Automation Maturity Assessment')
  })

  it('includes maturity section in spec.md output from handler', async () => {
    const { mkdtemp: mkdtempFn, mkdir: mkdirFn, rm: rmFn, readFile: readFileFn } = await import('node:fs/promises')
    const { tmpdir: tmpdirFn } = await import('node:os')
    const { join: joinFn } = await import('node:path')

    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.select)
      .mockResolvedValueOnce('multiple_daily')
      .mockResolvedValueOnce('always_same')
      .mockResolvedValueOnce('none_needed')
      .mockResolvedValueOnce('keep')

    const dir = await mkdtempFn(joinFn(tmpdirFn(), 'buildpact-maturity-'))
    await mkdirFn(joinFn(dir, '.buildpact'), { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(dir)

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['automate', 'daily', 'report'])
    expect(result.ok).toBe(true)

    const specPath = joinFn(dir, '.buildpact', 'specs', 'automate-daily-report', 'spec.md')
    const content = await readFileFn(specPath, 'utf-8')
    expect(content).toContain('## Automation Maturity Assessment')
    expect(content).toContain('Full Automation')

    await rmFn(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })
})
