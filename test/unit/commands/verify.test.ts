import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  extractAcsFromSpec,
  formatUatReport,
  buildAcGuidance,
  findLatestSpecSlug,
} from '../../../src/commands/verify/handler.js'
import type { UatReport } from '../../../src/commands/verify/handler.js'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    message: vi.fn(),
  },
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
  select: vi.fn(async () => 'pass'),
  text: vi.fn(async () => ''),
}))

// ---------------------------------------------------------------------------
// extractAcsFromSpec
// ---------------------------------------------------------------------------

describe('extractAcsFromSpec', () => {
  it('returns empty array when no AC section exists', () => {
    const spec = '# Spec\n\n## User Story\n\nSome story\n'
    expect(extractAcsFromSpec(spec)).toEqual([])
  })

  it('extracts bullet items from ## Acceptance Criteria section', () => {
    const spec = [
      '# Spec',
      '',
      '## Acceptance Criteria',
      '',
      '- First criterion',
      '- Second criterion',
      '- [ ] Third criterion with checkbox',
      '',
      '## Functional Requirements',
      '',
      '- [ ] FR item (should not be included)',
    ].join('\n')
    const result = extractAcsFromSpec(spec)
    expect(result).toEqual(['First criterion', 'Second criterion', 'Third criterion with checkbox'])
  })

  it('stops at the next ## heading', () => {
    const spec = [
      '## Acceptance Criteria',
      '- AC one',
      '## Next Section',
      '- not an AC',
    ].join('\n')
    expect(extractAcsFromSpec(spec)).toEqual(['AC one'])
  })

  it('handles Given/When/Then sub-bullets inside AC section', () => {
    const spec = [
      '## Acceptance Criteria',
      '',
      '### Given/When/Then',
      '',
      '**Given** I am a user',
      '**When** I do something',
      '**Then** I see results',
      '',
      '- The feature works correctly',
    ].join('\n')
    // Only picks up bullet lines starting with - or *
    const result = extractAcsFromSpec(spec)
    expect(result).toContain('The feature works correctly')
  })

  it('strips leading checkbox syntax from bullets', () => {
    const spec = '## Acceptance Criteria\n- [x] Already done\n- [ ] Not done\n'
    const result = extractAcsFromSpec(spec)
    expect(result).toEqual(['Already done', 'Not done'])
  })

  it('returns empty array for empty spec', () => {
    expect(extractAcsFromSpec('')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// buildAcGuidance
// ---------------------------------------------------------------------------

describe('buildAcGuidance', () => {
  it('returns test guidance for AC mentioning tests', () => {
    expect(buildAcGuidance('Tests pass')).toContain('tests')
  })

  it('returns typecheck guidance for typecheck AC', () => {
    expect(buildAcGuidance('Typecheck passes')).toContain('typecheck')
  })

  it('returns lint guidance for lint AC', () => {
    expect(buildAcGuidance('Lint passes with zero errors')).toContain('lint')
  })

  it('returns file guidance for file/generate ACs', () => {
    const result = buildAcGuidance('Generated file must exist at correct path')
    expect(result).toContain('file')
  })

  it('returns command guidance for CLI ACs', () => {
    expect(buildAcGuidance('CLI command runs successfully')).toContain('command')
  })

  it('returns default guidance for generic ACs', () => {
    const result = buildAcGuidance('The system behaves as expected overall')
    expect(result).toContain('Manually verify')
  })

  it('returns error guidance for error-handling ACs', () => {
    expect(buildAcGuidance('Error message shown when invalid input')).toContain('error')
  })
})

// ---------------------------------------------------------------------------
// formatUatReport
// ---------------------------------------------------------------------------

describe('formatUatReport', () => {
  const makeReport = (overrides: Partial<UatReport> = {}): UatReport => ({
    slug: 'my-feature',
    specPath: '/path/to/spec.md',
    verifiedAt: '2026-03-16T00:00:00.000Z',
    acResults: [
      { index: 0, ac: 'First criterion', status: 'pass' },
      { index: 1, ac: 'Second criterion', status: 'fail', note: 'missing output' },
      { index: 2, ac: 'Third criterion', status: 'skip' },
    ],
    passCount: 1,
    failCount: 1,
    skipCount: 1,
    allPassed: false,
    ...overrides,
  })

  it('includes the spec slug in the title', () => {
    const report = formatUatReport(makeReport())
    expect(report).toContain('my-feature')
  })

  it('renders PASS status with icon', () => {
    const report = formatUatReport(makeReport())
    expect(report).toContain('✅ PASS')
  })

  it('renders FAIL status with icon', () => {
    const report = formatUatReport(makeReport())
    expect(report).toContain('❌ FAIL')
  })

  it('renders SKIP status with icon', () => {
    const report = formatUatReport(makeReport())
    expect(report).toContain('⏭️ SKIP')
  })

  it('appends note after fail status', () => {
    const report = formatUatReport(makeReport())
    expect(report).toContain('missing output')
  })

  it('shows VERIFIED when allPassed=true', () => {
    const report = formatUatReport(makeReport({ allPassed: true, failCount: 0, passCount: 3 }))
    expect(report).toContain('VERIFIED')
    expect(report).not.toContain('NOT VERIFIED')
  })

  it('shows NOT VERIFIED when allPassed=false', () => {
    const report = formatUatReport(makeReport())
    expect(report).toContain('NOT VERIFIED')
  })

  it('includes summary counts', () => {
    const report = formatUatReport(makeReport())
    expect(report).toContain('Passed**: 1')
    expect(report).toContain('Failed**: 1')
    expect(report).toContain('Skipped**: 1')
  })
})

// ---------------------------------------------------------------------------
// findLatestSpecSlug
// ---------------------------------------------------------------------------

describe('findLatestSpecSlug', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-verify-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns undefined when specs dir does not exist', async () => {
    const result = await findLatestSpecSlug(tmpDir)
    expect(result).toBeUndefined()
  })

  it('returns undefined when specs dir is empty', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'specs'), { recursive: true })
    const result = await findLatestSpecSlug(tmpDir)
    expect(result).toBeUndefined()
  })

  it('returns last alphabetical slug when specs exist', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'specs', 'alpha-feature'), { recursive: true })
    await mkdir(join(tmpDir, '.buildpact', 'specs', 'beta-feature'), { recursive: true })
    const result = await findLatestSpecSlug(tmpDir)
    expect(result).toBe('beta-feature')
  })

  it('returns single spec slug when only one exists', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'specs', 'my-feature'), { recursive: true })
    const result = await findLatestSpecSlug(tmpDir)
    expect(result).toBe('my-feature')
  })
})

// ---------------------------------------------------------------------------
// handler integration tests
// ---------------------------------------------------------------------------

describe('verify handler', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-verify-handler-'))
    await mkdir(join(tmpDir, '.buildpact', 'config.yaml').replace('config.yaml', ''), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'language: en\n')

    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    vi.mocked(clack.select).mockResolvedValue('pass')
    vi.mocked(clack.text).mockResolvedValue('')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('writes verification-report.md to spec dir after completion', async () => {
    const specDir = join(tmpDir, '.buildpact', 'specs', 'my-feature')
    await mkdir(specDir, { recursive: true })
    await writeFile(join(specDir, 'spec.md'), [
      '# Spec',
      '## Acceptance Criteria',
      '- Tests pass',
      '- Typecheck passes',
    ].join('\n'))

    // Dynamically import to pick up module-level cwd mock workaround
    const origCwd = process.cwd
    process.cwd = () => tmpDir
    const { handler } = await import('../../../src/commands/verify/handler.js')
    const result = await handler.run([])
    process.cwd = origCwd

    expect(result.ok).toBe(true)
    const report = await readFile(join(specDir, 'verification-report.md'), 'utf-8')
    expect(report).toContain('UAT Verification Report')
    expect(report).toContain('my-feature')
  })

  it('returns NOT_FOUND error when no spec exists', async () => {
    const origCwd = process.cwd
    process.cwd = () => tmpDir
    const { handler } = await import('../../../src/commands/verify/handler.js')
    const result = await handler.run([])
    process.cwd = origCwd

    expect(result.ok).toBe(false)
  })

  it('returns NOT_FOUND error when spec has no ACs', async () => {
    const specDir = join(tmpDir, '.buildpact', 'specs', 'empty-spec')
    await mkdir(specDir, { recursive: true })
    await writeFile(join(specDir, 'spec.md'), '# Spec\n## User Story\nNo ACs here.\n')

    const origCwd = process.cwd
    process.cwd = () => tmpDir
    const { handler } = await import('../../../src/commands/verify/handler.js')
    const result = await handler.run([])
    process.cwd = origCwd

    expect(result.ok).toBe(false)
  })

  it('marks spec as verified by appending marker comment', async () => {
    const specDir = join(tmpDir, '.buildpact', 'specs', 'marked-spec')
    await mkdir(specDir, { recursive: true })
    const specPath = join(specDir, 'spec.md')
    await writeFile(specPath, '## Acceptance Criteria\n- Tests pass\n')

    const origCwd = process.cwd
    process.cwd = () => tmpDir
    const { handler } = await import('../../../src/commands/verify/handler.js')
    await handler.run([])
    process.cwd = origCwd

    const updated = await readFile(specPath, 'utf-8')
    expect(updated).toContain('<!-- verified:')
  })

  it('records fail note when verdict is fail', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.select).mockResolvedValue('fail')
    vi.mocked(clack.text).mockResolvedValue('missing output X')

    const specDir = join(tmpDir, '.buildpact', 'specs', 'fail-spec')
    await mkdir(specDir, { recursive: true })
    await writeFile(join(specDir, 'spec.md'), '## Acceptance Criteria\n- Test criterion\n')

    const origCwd = process.cwd
    process.cwd = () => tmpDir
    const { handler } = await import('../../../src/commands/verify/handler.js')
    await handler.run([])
    process.cwd = origCwd

    const report = await readFile(join(specDir, 'verification-report.md'), 'utf-8')
    expect(report).toContain('missing output X')
    expect(report).toContain('NOT VERIFIED')
  })
})
