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

// Mock child_process.execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
}))

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('parseGitDiffOutput', () => {
  it('parses added files', async () => {
    const { parseGitDiffOutput } = await import('../../../src/commands/diff/handler.js')
    const result = parseGitDiffOutput('A\tsrc/new-file.ts')
    expect(result).toEqual([{ status: 'added', path: 'src/new-file.ts' }])
  })

  it('parses modified files', async () => {
    const { parseGitDiffOutput } = await import('../../../src/commands/diff/handler.js')
    const result = parseGitDiffOutput('M\tsrc/changed.ts')
    expect(result).toEqual([{ status: 'modified', path: 'src/changed.ts' }])
  })

  it('parses deleted files', async () => {
    const { parseGitDiffOutput } = await import('../../../src/commands/diff/handler.js')
    const result = parseGitDiffOutput('D\tsrc/removed.ts')
    expect(result).toEqual([{ status: 'deleted', path: 'src/removed.ts' }])
  })

  it('handles multiple lines', async () => {
    const { parseGitDiffOutput } = await import('../../../src/commands/diff/handler.js')
    const result = parseGitDiffOutput('A\ta.ts\nM\tb.ts\nD\tc.ts\n')
    expect(result).toHaveLength(3)
    expect(result[0]!.status).toBe('added')
    expect(result[1]!.status).toBe('modified')
    expect(result[2]!.status).toBe('deleted')
  })

  it('skips empty lines', async () => {
    const { parseGitDiffOutput } = await import('../../../src/commands/diff/handler.js')
    const result = parseGitDiffOutput('\n\n')
    expect(result).toEqual([])
  })
})

describe('groupChanges', () => {
  it('groups changes by status', async () => {
    const { groupChanges } = await import('../../../src/commands/diff/handler.js')
    const changes = [
      { status: 'added' as const, path: 'a.ts' },
      { status: 'modified' as const, path: 'b.ts' },
      { status: 'deleted' as const, path: 'c.ts' },
      { status: 'added' as const, path: 'd.ts' },
    ]
    const result = groupChanges(changes)
    expect(result.added).toHaveLength(2)
    expect(result.modified).toHaveLength(1)
    expect(result.deleted).toHaveLength(1)
  })
})

describe('formatChange', () => {
  it('marks src/ files as unverified', async () => {
    const { formatChange } = await import('../../../src/commands/diff/handler.js')
    const result = formatChange({ status: 'modified', path: 'src/engine/test.ts' })
    expect(result).toContain('[unverified]')
  })

  it('marks non-src files as non-critical', async () => {
    const { formatChange } = await import('../../../src/commands/diff/handler.js')
    const result = formatChange({ status: 'modified', path: 'docs/readme.md' })
    expect(result).toContain('[non-critical]')
  })

  it('uses green color for added files', async () => {
    const { formatChange } = await import('../../../src/commands/diff/handler.js')
    const result = formatChange({ status: 'added', path: 'docs/new.md' })
    expect(result).toContain('\x1b[32m')
  })

  it('uses red color for deleted files', async () => {
    const { formatChange } = await import('../../../src/commands/diff/handler.js')
    const result = formatChange({ status: 'deleted', path: 'docs/old.md' })
    expect(result).toContain('\x1b[31m')
  })
})

describe('categorizeFile', () => {
  it('categorizes agent files', async () => {
    const { categorizeFile } = await import('../../../src/commands/diff/handler.js')
    expect(categorizeFile('.buildpact/squads/software/agents/dev.md')).toBe('agents')
  })

  it('categorizes plan files', async () => {
    const { categorizeFile } = await import('../../../src/commands/diff/handler.js')
    expect(categorizeFile('.buildpact/plans/sprint-1.yaml')).toBe('plans')
  })

  it('categorizes config files', async () => {
    const { categorizeFile } = await import('../../../src/commands/diff/handler.js')
    expect(categorizeFile('.buildpact/config.yaml')).toBe('config')
    expect(categorizeFile('.buildpact/constitution.md')).toBe('config')
  })

  it('categorizes output files', async () => {
    const { categorizeFile } = await import('../../../src/commands/diff/handler.js')
    expect(categorizeFile('.buildpact/output/result.txt')).toBe('output')
  })

  it('categorizes audit files', async () => {
    const { categorizeFile } = await import('../../../src/commands/diff/handler.js')
    expect(categorizeFile('.buildpact/audit/cli.jsonl')).toBe('audit')
  })

  it('categorizes other files', async () => {
    const { categorizeFile } = await import('../../../src/commands/diff/handler.js')
    expect(categorizeFile('src/commands/diff/handler.ts')).toBe('other')
  })
})

describe('categorizeChanges', () => {
  it('groups changes into semantic categories', async () => {
    const { categorizeChanges } = await import('../../../src/commands/diff/handler.js')
    const changes = [
      { status: 'added' as const, path: '.buildpact/squads/software/agents/dev.md' },
      { status: 'modified' as const, path: '.buildpact/plans/sprint.yaml' },
      { status: 'modified' as const, path: '.buildpact/config.yaml' },
      { status: 'added' as const, path: '.buildpact/output/bundle.txt' },
      { status: 'modified' as const, path: '.buildpact/audit/cli.jsonl' },
      { status: 'added' as const, path: 'src/index.ts' },
    ]
    const result = categorizeChanges(changes)
    expect(result.agents).toHaveLength(1)
    expect(result.plans).toHaveLength(1)
    expect(result.config).toHaveLength(1)
    expect(result.output).toHaveLength(1)
    expect(result.audit).toHaveLength(1)
    expect(result.other).toHaveLength(1)
  })
})

describe('parseDiffFlags', () => {
  it('parses --json flag', async () => {
    const { parseDiffFlags } = await import('../../../src/commands/diff/handler.js')
    expect(parseDiffFlags(['--json']).json).toBe(true)
  })

  it('parses --since flag', async () => {
    const { parseDiffFlags } = await import('../../../src/commands/diff/handler.js')
    expect(parseDiffFlags(['--since', 'abc123']).since).toBe('abc123')
  })

  it('parses both flags together', async () => {
    const { parseDiffFlags } = await import('../../../src/commands/diff/handler.js')
    const result = parseDiffFlags(['--json', '--since', 'HEAD~5'])
    expect(result.json).toBe(true)
    expect(result.since).toBe('HEAD~5')
  })
})

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe('diff handler', () => {
  let tmpDir: string
  const origCwd = process.cwd

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-diff-'))
    process.cwd = () => tmpDir
  })

  afterEach(async () => {
    process.cwd = origCwd
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('shows warning when no verify baseline exists', async () => {
    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/diff/index.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    expect(clack.log.warn).toHaveBeenCalled()
  })

  it('shows clean message when git diff returns no changes', async () => {
    // Set up verify state
    await mkdir(join(tmpDir, '.buildpact', 'verify'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'verify', 'last-verify.json'),
      JSON.stringify({ sha: 'abc123', timestamp: '2026-01-01T00:00:00Z', specSlug: 'test' }),
    )

    // execSync returns empty string (no changes)
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockReturnValue('')

    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/diff/index.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    expect(clack.log.success).toHaveBeenCalled()
  })

  it('shows file changes when git diff returns results', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'verify'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'verify', 'last-verify.json'),
      JSON.stringify({ sha: 'abc123', timestamp: '2026-01-01T00:00:00Z', specSlug: 'test' }),
    )

    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockReturnValue('A\tsrc/new.ts\nM\tsrc/changed.ts\n')

    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/diff/index.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
  })

  it('outputs JSON when --json flag is provided', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'verify'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'verify', 'last-verify.json'),
      JSON.stringify({ sha: 'abc123', timestamp: '2026-01-01T00:00:00Z', specSlug: 'test' }),
    )

    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockReturnValue('A\t.buildpact/squads/software/agents/dev.md\nM\t.buildpact/config.yaml\n')

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const { handler } = await import('../../../src/commands/diff/index.js')
    const result = await handler.run(['--json'])
    expect(result.ok).toBe(true)
    const output = stdoutWrite.mock.calls[0]?.[0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toHaveProperty('changes')
    expect(parsed).toHaveProperty('categories')
    expect(parsed).toHaveProperty('summary')
    expect(parsed.categories.agents).toHaveLength(1)
    expect(parsed.categories.config).toHaveLength(1)
    stdoutWrite.mockRestore()
  })

  it('uses --since commit ref instead of verify baseline', async () => {
    const { execSync } = await import('node:child_process')
    vi.mocked(execSync).mockReturnValue('A\tsrc/new.ts\n')

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const { handler } = await import('../../../src/commands/diff/index.js')
    const result = await handler.run(['--json', '--since', 'HEAD~3'])
    expect(result.ok).toBe(true)
    expect(execSync).toHaveBeenCalledWith(
      'git diff --name-status HEAD~3..HEAD',
      expect.any(Object),
    )
    stdoutWrite.mockRestore()
  })
})
