import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
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
// buildProgramMd unit tests (pure function — no TUI or FS)
// ---------------------------------------------------------------------------

describe('buildProgramMd', () => {
  it('includes target filename in heading', async () => {
    const { buildProgramMd } = await import('../../../src/commands/optimize/handler.js')
    const content = buildProgramMd('src/engine/my-module.ts', '2026-01-01T00:00:00.000Z')
    expect(content).toContain('# AutoResearch Program — src/engine/my-module.ts')
  })

  it('includes experiment directions sections', async () => {
    const { buildProgramMd } = await import('../../../src/commands/optimize/handler.js')
    const content = buildProgramMd('src/foo.ts', '2026-01-01T00:00:00.000Z')
    expect(content).toContain('## Experiment Directions')
    expect(content).toContain('Direction 1: Readability & Structure')
    expect(content).toContain('Direction 2: Performance')
    expect(content).toContain('Direction 3: Robustness')
  })

  it('includes acceptance criteria section', async () => {
    const { buildProgramMd } = await import('../../../src/commands/optimize/handler.js')
    const content = buildProgramMd('src/foo.ts', '2026-01-01T00:00:00.000Z')
    expect(content).toContain('## Acceptance Criteria')
    expect(content).toContain('- [ ] All existing tests pass after each experiment')
  })

  it('includes optimization goal and constraints sections', async () => {
    const { buildProgramMd } = await import('../../../src/commands/optimize/handler.js')
    const content = buildProgramMd('src/foo.ts', '2026-01-01T00:00:00.000Z')
    expect(content).toContain('## Optimization Goal')
    expect(content).toContain('## Constraints')
  })

  it('includes target in AC line', async () => {
    const { buildProgramMd } = await import('../../../src/commands/optimize/handler.js')
    const content = buildProgramMd('src/myfile.ts', '2026-01-01T00:00:00.000Z')
    expect(content).toContain('`src/myfile.ts`')
  })
})

// ---------------------------------------------------------------------------
// countFileLines unit tests
// ---------------------------------------------------------------------------

describe('countFileLines', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-optimize-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns correct line count for a small file', async () => {
    const { countFileLines } = await import('../../../src/commands/optimize/handler.js')
    const filePath = join(tmpDir, 'small.ts')
    await writeFile(filePath, 'line1\nline2\nline3\n', 'utf-8')
    expect(await countFileLines(filePath)).toBe(4)
  })

  it('returns 0 for a missing file', async () => {
    const { countFileLines } = await import('../../../src/commands/optimize/handler.js')
    expect(await countFileLines(join(tmpDir, 'nonexistent.ts'))).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// readExperienceLevel unit tests
// ---------------------------------------------------------------------------

describe('readExperienceLevel', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-optimize-exp-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns "expert" when config.yaml has experience_level: expert', async () => {
    const { readExperienceLevel } = await import('../../../src/commands/optimize/handler.js')
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: "en"\nexperience_level: "expert"\n',
      'utf-8',
    )
    expect(await readExperienceLevel(tmpDir)).toBe('expert')
  })

  it('returns "beginner" as fallback when config.yaml is missing', async () => {
    const { readExperienceLevel } = await import('../../../src/commands/optimize/handler.js')
    expect(await readExperienceLevel(tmpDir)).toBe('beginner')
  })

  it('returns "intermediate" when config.yaml has experience_level: intermediate', async () => {
    const { readExperienceLevel } = await import('../../../src/commands/optimize/handler.js')
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: "en"\nexperience_level: "intermediate"\n',
      'utf-8',
    )
    expect(await readExperienceLevel(tmpDir)).toBe('intermediate')
  })
})

// ---------------------------------------------------------------------------
// optimize handler integration tests
// ---------------------------------------------------------------------------

describe('optimize handler', () => {
  let tmpDir: string
  const originalCwd = process.cwd()

  beforeEach(async () => {
    vi.clearAllMocks()
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-optimize-handler-'))
    process.chdir(tmpDir)
    // Create .buildpact dir with expert config
    await mkdir(join(tmpDir, '.buildpact', 'audit'), { recursive: true })
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns EXPERT_ONLY error when experience_level is not expert', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: "en"\nexperience_level: "beginner"\n',
      'utf-8',
    )
    const { handler } = await import('../../../src/commands/optimize/handler.js')
    const result = await handler.run(['src/foo.ts'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EXPERT_ONLY')
    }
  })

  it('returns FILE_READ_FAILED error when no target is provided', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: "en"\nexperience_level: "expert"\n',
      'utf-8',
    )
    const { handler } = await import('../../../src/commands/optimize/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_READ_FAILED')
    }
  })

  it('returns TARGET_TOO_LARGE error when file exceeds 600 lines', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: "en"\nexperience_level: "expert"\n',
      'utf-8',
    )
    // Create a large file with 601 lines
    const bigContent = Array.from({ length: 601 }, (_, i) => `line ${i + 1}`).join('\n')
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await writeFile(join(tmpDir, 'src', 'big.ts'), bigContent, 'utf-8')
    const { handler } = await import('../../../src/commands/optimize/handler.js')
    const result = await handler.run(['src/big.ts'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('TARGET_TOO_LARGE')
    }
  })

  it('writes program.md and returns ok for valid expert + small target', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: "en"\nexperience_level: "expert"\n',
      'utf-8',
    )
    // Create a small target file (under 600 lines)
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await writeFile(join(tmpDir, 'src', 'small.ts'), 'const x = 1\n', 'utf-8')
    const { handler } = await import('../../../src/commands/optimize/handler.js')
    const result = await handler.run(['src/small.ts'])
    expect(result.ok).toBe(true)
    // Verify program.md was written
    const { readFile } = await import('node:fs/promises')
    const programContent = await readFile(
      join(tmpDir, '.buildpact', 'optimize', 'src-small-ts', 'program.md'),
      'utf-8',
    )
    expect(programContent).toContain('# AutoResearch Program — src/small.ts')
    expect(programContent).toContain('## Optimization Goal')
    expect(programContent).toContain('## Acceptance Criteria')
  })

  it('target file at exactly 600 lines is allowed (not blocked)', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: "en"\nexperience_level: "expert"\n',
      'utf-8',
    )
    // Create a file with exactly 600 lines
    const content = Array.from({ length: 600 }, (_, i) => `line ${i + 1}`).join('\n')
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await writeFile(join(tmpDir, 'src', 'exact.ts'), content, 'utf-8')
    const { handler } = await import('../../../src/commands/optimize/handler.js')
    const result = await handler.run(['src/exact.ts'])
    expect(result.ok).toBe(true)
  })
})
