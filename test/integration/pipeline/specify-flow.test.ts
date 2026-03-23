/**
 * Integration test: full specify pipeline (expert mode + maturity assessment)
 * Tests the end-to-end flow: NL input → ambiguity detection → Squad skip → maturity → spec.md
 *
 * @see Story 4.4 — Task 2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts — prevents interactive TTY blocking in CI
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

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------

async function setupProjectDir(): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-specify-int-'))
  // Create minimal .buildpact/config.yaml — expert mode, no Squad, no web-bundle
  await mkdir(join(tmpDir, '.buildpact', 'audit'), { recursive: true })
  await writeFile(
    join(tmpDir, '.buildpact', 'config.yaml'),
    'experience: intermediate\nlanguage: en\n',
    'utf-8',
  )
  return tmpDir
}

describe('Full specify pipeline — expert mode with maturity assessment (Story 4.4, AC #1, #2)', () => {
  let tmpDir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    cwdSpy?.mockRestore()
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('expert mode: writes spec.md with ## Automation Maturity Assessment', async () => {
    tmpDir = await setupProjectDir()
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    // Mock 4 clack.select calls from assessAutomationMaturity():
    //   1. frequency → 'daily' (score 2)
    //   2. predictability → 'always_same' (score 3)
    //   3. humanDecisions → 'minor' (score 2)
    //   total = 7 → Stage 4 (Heartbeat Check)
    //   4. keep or override prompt → 'keep'
    const { select } = await import('@clack/prompts')
    vi.mocked(select)
      .mockResolvedValueOnce('daily')
      .mockResolvedValueOnce('always_same')
      .mockResolvedValueOnce('minor')
      .mockResolvedValueOnce('keep')

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['users', 'reset', 'their', 'password'])

    expect(result.ok).toBe(true)

    const specPath = join(tmpDir, '.buildpact', 'specs', 'users-reset-their-password', 'spec.md')
    const spec = await readFile(specPath, 'utf-8')

    expect(spec).toContain('## Automation Maturity Assessment')
    expect(spec).toContain('Heartbeat Check')
    expect(spec).toContain('score: 7/9')
  })

  it('override flow: spec contains override note when user selects a different stage (AC #3)', async () => {
    tmpDir = await setupProjectDir()
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    // Maturity questions → score 2 (Stage 2: Documented Skill)
    // Then user selects 'change' and picks stage 5
    const { select } = await import('@clack/prompts')
    vi.mocked(select)
      .mockResolvedValueOnce('rarely')         // frequency = 0
      .mockResolvedValueOnce('mostly_predictable') // predictability = 2
      .mockResolvedValueOnce('none_needed')    // humanDecisions = 3 → total = 5 → Stage 3
      .mockResolvedValueOnce('change')         // user overrides
      .mockResolvedValueOnce(5)                // selects Stage 5

    const { handler } = await import('../../../src/commands/specify/handler.js')
    const result = await handler.run(['automate', 'database', 'backup'])

    expect(result.ok).toBe(true)

    const specPath = join(tmpDir, '.buildpact', 'specs', 'automate-database-backup', 'spec.md')
    const spec = await readFile(specPath, 'utf-8')

    expect(spec).toContain('## Automation Maturity Assessment')
    expect(spec).toContain('Override applied')
  })
})
