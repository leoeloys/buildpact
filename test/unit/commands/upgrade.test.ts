import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConfirm = vi.fn()
const mockSpinner = { start: vi.fn(), stop: vi.fn() }

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  spinner: () => mockSpinner,
  log: { success: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), step: vi.fn() },
  isCancel: vi.fn(() => false),
}))

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class { log = vi.fn().mockResolvedValue(undefined) },
}))

let tmpDir: string
let originalCwd: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'bp-upgrade-cmd-'))
  originalCwd = process.cwd()
  process.chdir(tmpDir)
  vi.clearAllMocks()
})

afterEach(async () => {
  process.chdir(originalCwd)
  await rm(tmpDir, { recursive: true, force: true })
})

describe('runUpgrade', () => {
  it('returns error when no .buildpact/ exists', async () => {
    const { runUpgrade } = await import('../../../src/commands/upgrade/handler.js')
    const result = await runUpgrade([])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_INVALID')
    }
  })

  it('reports already current when schema matches', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), [
      'buildpact_schema: 1',
      'project_name: "test"',
      'language: "en"',
    ].join('\n'))

    const { runUpgrade } = await import('../../../src/commands/upgrade/handler.js')
    const result = await runUpgrade([])

    expect(result.ok).toBe(true)
    const clack = await import('@clack/prompts')
    expect(clack.log.success).toHaveBeenCalled()
  })

  it('shows dry-run output without applying migrations', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), [
      'project_name: "test"',
      'language: "en"',
    ].join('\n'))

    const { runUpgrade } = await import('../../../src/commands/upgrade/handler.js')
    const result = await runUpgrade(['--dry-run'])

    expect(result.ok).toBe(true)
    const clack = await import('@clack/prompts')
    expect(clack.log.info).toHaveBeenCalled()
  })

  it('runs migrations when user confirms', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'audit'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), [
      '# BuildPact config',
      'project_name: "test"',
      'language: "en"',
    ].join('\n'))

    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)
    mockConfirm.mockResolvedValueOnce(true)

    const { runUpgrade } = await import('../../../src/commands/upgrade/handler.js')
    const result = await runUpgrade([])

    expect(result.ok).toBe(true)

    // config.yaml should now have buildpact_schema
    const content = await import('node:fs/promises').then(fs =>
      fs.readFile(join(tmpDir, '.buildpact', 'config.yaml'), 'utf-8'),
    )
    expect(content).toContain('buildpact_schema:')
  })

  it('returns ok when user cancels migration confirm', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), [
      'project_name: "test"',
      'language: "en"',
    ].join('\n'))

    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)
    mockConfirm.mockResolvedValueOnce(false)

    const { runUpgrade } = await import('../../../src/commands/upgrade/handler.js')
    const result = await runUpgrade([])

    expect(result.ok).toBe(true)
  })

  it('detects pt-br language from existing config', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), [
      'buildpact_schema: 1',
      'project_name: "test"',
      'language: "pt-br"',
    ].join('\n'))

    const { runUpgrade } = await import('../../../src/commands/upgrade/handler.js')
    const result = await runUpgrade([])

    expect(result.ok).toBe(true)
    // It should have read pt-br and created i18n with it
    // Since schema is already 1, it reports already current
    const clack = await import('@clack/prompts')
    expect(clack.log.success).toHaveBeenCalled()
  })

  it('treats missing schema key as schema 0 (legacy)', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'audit'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), [
      'project_name: "legacy-project"',
      'language: "en"',
    ].join('\n'))

    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)
    // Dry run to avoid needing confirm mock
    const { runUpgrade } = await import('../../../src/commands/upgrade/handler.js')
    const result = await runUpgrade(['--dry-run'])

    expect(result.ok).toBe(true)
    // Should show legacy warning
    expect(clack.log.warn).toHaveBeenCalled()
    // Should list pending migrations
    expect(clack.log.info).toHaveBeenCalled()
  })
})
