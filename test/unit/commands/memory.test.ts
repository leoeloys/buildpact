import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  isCancel: vi.fn(() => false),
}))

// Mock AuditLogger
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('shortHash', () => {
  it('returns an 8-character hex string', async () => {
    const { shortHash } = await import('../../../src/commands/memory/handler.js')
    const hash = shortHash('test-input')
    expect(hash).toHaveLength(8)
    expect(/^[0-9a-f]{8}$/.test(hash)).toBe(true)
  })

  it('returns different hashes for different inputs', async () => {
    const { shortHash } = await import('../../../src/commands/memory/handler.js')
    expect(shortHash('input-a')).not.toBe(shortHash('input-b'))
  })
})

describe('truncate', () => {
  it('returns string unchanged if within limit', async () => {
    const { truncate } = await import('../../../src/commands/memory/handler.js')
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates with ellipsis when over limit', async () => {
    const { truncate } = await import('../../../src/commands/memory/handler.js')
    const result = truncate('this is a very long string indeed', 15)
    expect(result).toHaveLength(15)
    expect(result.endsWith('...')).toBe(true)
  })
})

describe('parseMemoryFlags', () => {
  it('parses --json flag', async () => {
    const { parseMemoryFlags } = await import('../../../src/commands/memory/handler.js')
    const result = parseMemoryFlags(['--json', 'list'])
    expect(result.json).toBe(true)
    expect(result.remaining).toEqual(['list'])
  })

  it('parses --tier flag with value', async () => {
    const { parseMemoryFlags } = await import('../../../src/commands/memory/handler.js')
    const result = parseMemoryFlags(['--tier', 'session'])
    expect(result.tier).toBe('session')
  })

  it('parses --clear flag with value', async () => {
    const { parseMemoryFlags } = await import('../../../src/commands/memory/handler.js')
    const result = parseMemoryFlags(['--clear', 'decisions'])
    expect(result.clear).toBe('decisions')
  })

  it('ignores invalid tier values', async () => {
    const { parseMemoryFlags } = await import('../../../src/commands/memory/handler.js')
    const result = parseMemoryFlags(['--tier', 'invalid'])
    expect(result.tier).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Filesystem-dependent tests
// ---------------------------------------------------------------------------

describe('memory command handler', () => {
  let tmpDir: string
  const origCwd = process.cwd

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-memory-'))
    process.cwd = () => tmpDir
  })

  afterEach(async () => {
    process.cwd = origCwd
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('shows usage when no subcommand given', async () => {
    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    expect(clack.log.info).toHaveBeenCalled()
  })

  it('shows empty message when no .buildpact/memory/ exists', async () => {
    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run(['list'])
    expect(result.ok).toBe(true)
    expect(clack.log.info).toHaveBeenCalled()
  })

  it('lists feedback entries when they exist', async () => {
    // Set up feedback file
    const feedbackDir = join(tmpDir, '.buildpact', 'memory', 'feedback')
    await mkdir(feedbackDir, { recursive: true })
    await writeFile(
      join(feedbackDir, 'test-spec.json'),
      JSON.stringify({
        slug: 'test-spec',
        entries: [
          {
            capturedAt: '2026-01-15T10:00:00.000Z',
            slug: 'test-spec',
            workedAcs: ['AC1', 'AC2'],
            failedAcs: ['AC3'],
            outcome: 'partial',
            notes: { AC3: 'Failed because...' },
          },
        ],
      }),
    )

    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run(['list'])
    expect(result.ok).toBe(true)
    // Should have called log.info at least twice (header + table)
    const calls = (clack.log.info as ReturnType<typeof vi.fn>).mock.calls.flat()
    const tableCall = calls.find((c: string) => typeof c === 'string' && c.includes('test-spec'))
    expect(tableCall).toBeDefined()
  })

  it('searches memory entries by keyword', async () => {
    // Set up lessons file
    const lessonsDir = join(tmpDir, '.buildpact', 'memory', 'lessons')
    await mkdir(lessonsDir, { recursive: true })
    await writeFile(
      join(lessonsDir, 'lessons.json'),
      JSON.stringify({
        distilledAt: '2026-01-15T10:00:00.000Z',
        totalSessionsAnalyzed: 5,
        lessons: [
          {
            id: 'test-ac-pattern',
            acPattern: 'test coverage must be above 80%',
            failCount: 3,
            learnedAt: '2026-01-15T10:00:00.000Z',
            recommendation: 'Write tests before verification.',
            affectedSlugs: ['spec-a'],
          },
        ],
      }),
    )

    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run(['search', 'coverage'])
    expect(result.ok).toBe(true)
    const calls = (clack.log.info as ReturnType<typeof vi.fn>).mock.calls.flat()
    const matchCall = calls.find((c: string) => typeof c === 'string' && c.includes('coverage'))
    expect(matchCall).toBeDefined()
  })

  it('shows a specific entry by ID', async () => {
    // Set up decisions file
    const decisionsDir = join(tmpDir, '.buildpact', 'memory', 'decisions')
    await mkdir(decisionsDir, { recursive: true })
    await writeFile(
      join(decisionsDir, 'use-esm.json'),
      JSON.stringify({
        slug: 'use-esm',
        entry: {
          id: 'use-esm',
          title: 'Use ESM modules',
          decision: 'All modules use ESM',
          rationale: 'Modern standard',
          alternatives: ['CommonJS'],
          date: '2026-01-10',
        },
      }),
    )

    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run(['show', 'use-esm'])
    expect(result.ok).toBe(true)
    const calls = (clack.log.info as ReturnType<typeof vi.fn>).mock.calls.flat()
    const showCall = calls.find((c: string) => typeof c === 'string' && c.includes('Use ESM modules'))
    expect(showCall).toBeDefined()
  })

  it('returns NOT_FOUND error for unknown entry ID', async () => {
    const memoryDir = join(tmpDir, '.buildpact', 'memory')
    await mkdir(memoryDir, { recursive: true })

    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run(['show', 'nonexistent-id'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  it('outputs JSON when --json flag is provided with no subcommand', async () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run(['--json'])
    expect(result.ok).toBe(true)
    expect(stdoutWrite).toHaveBeenCalled()
    const output = stdoutWrite.mock.calls[0]?.[0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toHaveProperty('session')
    expect(parsed).toHaveProperty('lessons')
    expect(parsed).toHaveProperty('decisions')
    stdoutWrite.mockRestore()
  })

  it('outputs JSON for list subcommand with --json', async () => {
    const feedbackDir = join(tmpDir, '.buildpact', 'memory', 'feedback')
    await mkdir(feedbackDir, { recursive: true })
    await writeFile(
      join(feedbackDir, 'test.json'),
      JSON.stringify({
        slug: 'test',
        entries: [{ capturedAt: '2026-01-15T10:00:00.000Z', workedAcs: ['AC1'], failedAcs: [], outcome: 'pass', notes: {} }],
      }),
    )

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run(['--json', 'list'])
    expect(result.ok).toBe(true)
    const output = stdoutWrite.mock.calls[0]?.[0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toHaveProperty('entries')
    expect(parsed.entries.length).toBe(1)
    stdoutWrite.mockRestore()
  })

  it('previews clear for a tier with --clear', async () => {
    const feedbackDir = join(tmpDir, '.buildpact', 'memory', 'feedback')
    await mkdir(feedbackDir, { recursive: true })
    await writeFile(join(feedbackDir, 'test.json'), '{}')

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const { handler } = await import('../../../src/commands/memory/index.js')
    const result = await handler.run(['--json', '--clear', 'session'])
    expect(result.ok).toBe(true)
    const output = stdoutWrite.mock.calls[0]?.[0] as string
    const parsed = JSON.parse(output)
    expect(parsed.clear).toBe('session')
    expect(parsed.status).toBe('preview')
    stdoutWrite.mockRestore()
  })
})
