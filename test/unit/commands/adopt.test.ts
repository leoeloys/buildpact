import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn()
const mockMultiselect = vi.fn()
const mockConfirm = vi.fn()
const mockSpinner = { start: vi.fn(), stop: vi.fn() }

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  select: (...args: unknown[]) => mockSelect(...args),
  multiselect: (...args: unknown[]) => mockMultiselect(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  spinner: () => mockSpinner,
  log: { success: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), step: vi.fn() },
  isCancel: vi.fn(() => false),
}))

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class { log = vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
}))

// Mock scanner to return controlled results
const mockScanResult = {
  packageManagers: [{ name: 'npm', configFile: 'package.json' }],
  languages: ['TypeScript'],
  linters: [],
  ci: [],
  git: null,
  existingAiConfigs: [],
  existingBuildpact: false,
  inferredDomain: 'software',
  projectName: 'test-adopt',
}

vi.mock('../../../src/foundation/scanner.js', () => ({
  scanProject: vi.fn(() => Promise.resolve(mockScanResult)),
  formatScanSummary: vi.fn(() => 'TypeScript, npm'),
}))

// Mock adopter to return success
vi.mock('../../../src/foundation/adopter.js', () => ({
  adopt: vi.fn(() => Promise.resolve({
    ok: true,
    value: { created: ['.buildpact/config.yaml'], modified: [], skipped: [] },
  })),
}))

// Mock diagnostician
vi.mock('../../../src/foundation/diagnostician.js', () => ({
  diagnoseProject: vi.fn(() => Promise.resolve({
    projectName: 'test-adopt',
    generatedAt: '2026-03-21',
    documents: [],
    phases: [],
    metrics: { totalFiles: 10, totalLines: 500, byDirectory: {}, testFiles: 2, testLines: 100 },
    qualitySignals: [],
    requirements: [],
    recommendations: ['Run buildpact specify'],
  })),
  formatDiagnosticReport: vi.fn(() => '# Diagnostic Report'),
}))

let tmpDir: string
let originalCwd: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'bp-adopt-cmd-'))
  await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  originalCwd = process.cwd()
  process.chdir(tmpDir)
  vi.clearAllMocks()
})

afterEach(async () => {
  process.chdir(originalCwd)
  await rm(tmpDir, { recursive: true, force: true })
})

describe('runAdopt', () => {
  it('returns ok when user cancels at language selection', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(true)
    mockSelect.mockResolvedValueOnce(Symbol.for('cancel'))

    const { runAdopt } = await import('../../../src/commands/adopt/handler.js')
    const result = await runAdopt([])

    expect(result.ok).toBe(true)
  })

  it('returns ok when user cancels at domain selection', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel)
      .mockReturnValueOnce(false) // lang
      .mockReturnValueOnce(true)  // domain cancel

    mockSelect
      .mockResolvedValueOnce('en')       // lang
      .mockResolvedValueOnce(Symbol.for('cancel')) // domain

    const { runAdopt } = await import('../../../src/commands/adopt/handler.js')
    const result = await runAdopt([])

    expect(result.ok).toBe(true)
  })

  it('calls adopt with correct options when user completes full flow', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)

    mockSelect
      .mockResolvedValueOnce('en')           // lang
      .mockResolvedValueOnce('software')     // domain
      .mockResolvedValueOnce('intermediate') // experience
    mockMultiselect.mockResolvedValueOnce(['claude-code'])  // ides
    mockConfirm
      .mockResolvedValueOnce(true)  // squad
      .mockResolvedValueOnce(true)  // confirm adopt
      .mockResolvedValueOnce(false) // skip diagnostic

    const { runAdopt } = await import('../../../src/commands/adopt/handler.js')
    const result = await runAdopt([])

    expect(result.ok).toBe(true)

    const { adopt } = await import('../../../src/foundation/adopter.js')
    expect(adopt).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'en',
        domain: 'software',
        experienceLevel: 'intermediate',
        installSquad: true,
        ides: ['claude-code'],
      }),
    )
  })

  it('runs diagnostic when user accepts and writes report', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)

    mockSelect
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('software')
      .mockResolvedValueOnce('expert')
    mockMultiselect.mockResolvedValueOnce(['claude-code'])
    mockConfirm
      .mockResolvedValueOnce(false) // no squad
      .mockResolvedValueOnce(true)  // confirm adopt
      .mockResolvedValueOnce(true)  // yes diagnostic

    const { runAdopt } = await import('../../../src/commands/adopt/handler.js')
    const result = await runAdopt([])

    expect(result.ok).toBe(true)

    const { diagnoseProject } = await import('../../../src/foundation/diagnostician.js')
    expect(diagnoseProject).toHaveBeenCalled()
  })

  it('shows existing .buildpact/ merge prompt when detected', async () => {
    // Mutate scan result temporarily
    mockScanResult.existingBuildpact = true

    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)

    mockSelect
      .mockResolvedValueOnce('en')       // lang
      .mockResolvedValueOnce('merge')    // existing choice
      .mockResolvedValueOnce('software') // domain
      .mockResolvedValueOnce('beginner') // experience
    mockMultiselect.mockResolvedValueOnce(['cursor'])
    mockConfirm
      .mockResolvedValueOnce(true)  // squad
      .mockResolvedValueOnce(true)  // confirm
      .mockResolvedValueOnce(false) // skip diag

    const { runAdopt } = await import('../../../src/commands/adopt/handler.js')
    const result = await runAdopt([])

    expect(result.ok).toBe(true)

    const { adopt } = await import('../../../src/foundation/adopter.js')
    expect(adopt).toHaveBeenCalledWith(
      expect.objectContaining({ mergeExisting: true }),
    )

    // Restore
    mockScanResult.existingBuildpact = false
  })

  it('returns ok when user cancels at confirm step', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockReturnValue(false)

    mockSelect
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('software')
      .mockResolvedValueOnce('intermediate')
    mockMultiselect.mockResolvedValueOnce(['claude-code'])
    mockConfirm
      .mockResolvedValueOnce(true)  // squad
      .mockResolvedValueOnce(false) // reject confirm

    const { runAdopt } = await import('../../../src/commands/adopt/handler.js')
    const result = await runAdopt([])

    expect(result.ok).toBe(true)
    // adopt should NOT have been called
    const { adopt } = await import('../../../src/foundation/adopter.js')
    expect(adopt).not.toHaveBeenCalled()
  })
})
