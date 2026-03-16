import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts so tests don't block on interactive TTY prompts
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  group: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  isCancel: vi.fn(() => false),
}))

// Mock AuditLogger to avoid writing real audit logs during tests
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('constitution handler — mode detection', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-constitution-cmd-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('runs create flow when constitution does not exist', async () => {
    // Set up clack group to return valid sections (create mode)
    const clack = await import('@clack/prompts')
    vi.mocked(clack.group).mockResolvedValueOnce({
      coding_standards: 'Use TypeScript strict mode',
      compliance: 'None',
      architecture: 'Layered architecture',
      quality_gates: '90% coverage',
      domain_rules: 'N/A',
    })

    // Override process.cwd() to use tmpDir
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/constitution/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    // Constitution file should now exist
    const content = await readFile(join(tmpDir, '.buildpact', 'constitution.md'), 'utf-8')
    expect(content).toContain('Use TypeScript strict mode')
  })

  it('runs edit flow when constitution already exists', async () => {
    // Create existing constitution
    const existing = '# Project Constitution\n\n## Coding Standards\n- Use TypeScript\n'
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), existing, 'utf-8')

    const clack = await import('@clack/prompts')
    // Edit mode: user selects a section then types new content
    vi.mocked(clack.select).mockResolvedValueOnce('coding_standards')
    vi.mocked(clack.text).mockResolvedValueOnce('Use TypeScript strict mode with ESM')
    vi.mocked(clack.confirm).mockResolvedValueOnce(false) // no more edits

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/constitution/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
  })

  it('returns ok(undefined) even when user cancels (no changes)', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), '# Existing\n', 'utf-8')

    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(true)
    vi.mocked(clack.select).mockResolvedValueOnce(Symbol('cancel'))

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/constitution/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
  })
})

describe('constitution handler — bilingual support', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-constitution-i18n-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('resolves i18n keys for EN language (no [CLI_CONSTITUTION_*] placeholders)', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.group).mockResolvedValueOnce({
      coding_standards: 'Standards',
      compliance: 'None',
      architecture: 'Clean arch',
      quality_gates: '80%',
      domain_rules: 'N/A',
    })
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    // Capture intro calls to verify i18n keys were resolved
    const introCalls: unknown[] = []
    vi.mocked(clack.intro).mockImplementation((msg) => { introCalls.push(msg) })

    const { handler } = await import('../../../src/commands/constitution/handler.js')
    await handler.run([])

    // Verify that intro was called with a string (not a missing key placeholder)
    expect(introCalls[0]).toBeDefined()
    expect(String(introCalls[0])).not.toMatch(/^\[CLI_CONSTITUTION_/)
  })

  it('resolves i18n keys for PT-BR language when config sets pt-br', async () => {
    // Write a config.yaml with pt-br language
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: pt-br\n',
      'utf-8',
    )

    const clack = await import('@clack/prompts')
    vi.mocked(clack.group).mockResolvedValueOnce({
      coding_standards: 'Padrões',
      compliance: 'Nenhum',
      architecture: 'Camadas',
      quality_gates: '80%',
      domain_rules: 'N/A',
    })
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const introCalls: unknown[] = []
    vi.mocked(clack.intro).mockImplementation((msg) => { introCalls.push(msg) })

    const { handler } = await import('../../../src/commands/constitution/handler.js')
    await handler.run([])

    expect(introCalls[0]).toBeDefined()
    expect(String(introCalls[0])).not.toMatch(/^\[CLI_CONSTITUTION_/)
  })
})
