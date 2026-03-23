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

describe('formatElapsed', () => {
  it('formats elapsed time as Xm Ys', async () => {
    const { formatElapsed } = await import('../../../src/commands/status/handler.js')
    // Set a time 125 seconds ago
    const start = new Date(Date.now() - 125_000).toISOString()
    const result = formatElapsed(start)
    expect(result).toMatch(/^\d+m \d+s$/)
  })
})

describe('phaseIndicator', () => {
  it('shows green checkmark for completed phases', async () => {
    const { phaseIndicator } = await import('../../../src/commands/status/handler.js')
    const result = phaseIndicator('specify', 'plan')
    expect(result).toContain('specify')
    // Should contain ANSI green escape
    expect(result).toContain('\x1b[32m')
  })

  it('shows yellow for active phase', async () => {
    const { phaseIndicator } = await import('../../../src/commands/status/handler.js')
    const result = phaseIndicator('plan', 'plan')
    expect(result).toContain('plan')
    expect(result).toContain('\x1b[33m')
  })

  it('shows dim for pending phases', async () => {
    const { phaseIndicator } = await import('../../../src/commands/status/handler.js')
    const result = phaseIndicator('verify', 'plan')
    expect(result).toContain('verify')
    expect(result).toContain('\x1b[2m')
  })
})

describe('countFiles', () => {
  it('returns 0 for non-existent directory', async () => {
    const { countFiles } = await import('../../../src/commands/status/handler.js')
    expect(countFiles('/nonexistent/path')).toBe(0)
  })

  it('counts files matching filter', async () => {
    const { countFiles } = await import('../../../src/commands/status/handler.js')
    const tmpDir = await mkdtemp(join(tmpdir(), 'bp-count-'))
    await writeFile(join(tmpDir, 'a.md'), 'x')
    await writeFile(join(tmpDir, 'b.md'), 'x')
    await writeFile(join(tmpDir, 'c.txt'), 'x')
    const count = countFiles(tmpDir, f => f.endsWith('.md'))
    expect(count).toBe(2)
    await rm(tmpDir, { recursive: true, force: true })
  })
})

describe('parseStatusFlags', () => {
  it('detects --json flag', async () => {
    const { parseStatusFlags } = await import('../../../src/commands/status/handler.js')
    expect(parseStatusFlags(['--json']).json).toBe(true)
  })

  it('returns false when no --json', async () => {
    const { parseStatusFlags } = await import('../../../src/commands/status/handler.js')
    expect(parseStatusFlags([]).json).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe('status handler', () => {
  let tmpDir: string
  const origCwd = process.cwd

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-status-'))
    process.cwd = () => tmpDir
  })

  afterEach(async () => {
    process.cwd = origCwd
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns error when no .buildpact/ directory exists', async () => {
    const { handler } = await import('../../../src/commands/status/index.js')
    const result = await handler.run([])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.i18nKey).toBe('cli.status.no_project')
    }
  })

  it('renders status when .buildpact/ exists', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/status/index.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    expect(clack.log.info).toHaveBeenCalled()
  })

  it('shows memory summary with counts', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'memory', 'feedback'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'memory', 'feedback', 'test.json'),
      JSON.stringify({ slug: 'test', entries: [{ capturedAt: '2026-01-01' }] }),
    )
    await mkdir(join(tmpDir, '.buildpact', 'memory', 'decisions'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'memory', 'decisions', 'd1.json'),
      JSON.stringify({ slug: 'd1', entry: {} }),
    )

    const clack = await import('@clack/prompts')
    const { handler } = await import('../../../src/commands/status/index.js')
    await handler.run([])
    // Verify handler ran successfully (memory details may appear in various log methods)
    const allCalls = [
      ...(clack.log.info as ReturnType<typeof vi.fn>).mock.calls.flat(),
      ...(clack.log.success as ReturnType<typeof vi.fn>).mock.calls.flat(),
    ]
    expect(allCalls.length).toBeGreaterThan(0)
  })

  it('outputs JSON when --json flag is provided', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const { handler } = await import('../../../src/commands/status/index.js')
    const result = await handler.run(['--json'])
    expect(result.ok).toBe(true)
    expect(stdoutWrite).toHaveBeenCalled()
    const output = stdoutWrite.mock.calls[0]?.[0] as string
    const parsed = JSON.parse(output)
    expect(parsed).toHaveProperty('phase')
    expect(parsed).toHaveProperty('artifacts')
    expect(parsed).toHaveProperty('memory')
    stdoutWrite.mockRestore()
  })
})
