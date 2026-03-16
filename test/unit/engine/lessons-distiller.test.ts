import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  shouldDistill,
  slugifyAc,
  buildRecommendation,
  analyzePatterns,
  buildLessonEntry,
  countTotalSessions,
  distillLessons,
  formatLessonsForContext,
  loadLessonsFile,
  writeLessonsFile,
  captureDistilledLessons,
  LESSONS_DISTILL_THRESHOLD,
  LESSONS_MIN_FAIL_COUNT,
} from '../../../src/engine/lessons-distiller.js'
import type { PatternMatch, LessonsFile } from '../../../src/engine/lessons-distiller.js'
import type { FeedbackFile, FeedbackEntry } from '../../../src/engine/session-feedback.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEntry = (overrides: Partial<FeedbackEntry> = {}): FeedbackEntry => ({
  capturedAt: '2026-01-01T00:00:00.000Z',
  slug: 'my-feature',
  workedAcs: ['Tests pass'],
  failedAcs: [],
  outcome: 'passed',
  notes: {},
  ...overrides,
})

const makeFeedbackFile = (slug: string, entries: FeedbackEntry[]): FeedbackFile => ({
  slug,
  entries,
})

// ---------------------------------------------------------------------------
// shouldDistill
// ---------------------------------------------------------------------------

describe('shouldDistill', () => {
  it('returns false below threshold', () => {
    expect(shouldDistill(4)).toBe(false)
  })

  it('returns true at threshold', () => {
    expect(shouldDistill(LESSONS_DISTILL_THRESHOLD)).toBe(true)
  })

  it('returns true above threshold', () => {
    expect(shouldDistill(10)).toBe(true)
  })

  it('accepts custom threshold', () => {
    expect(shouldDistill(3, 3)).toBe(true)
    expect(shouldDistill(2, 3)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// slugifyAc
// ---------------------------------------------------------------------------

describe('slugifyAc', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugifyAc('Tests pass')).toBe('tests-pass')
  })

  it('removes leading and trailing hyphens', () => {
    expect(slugifyAc('!Tests pass!')).toBe('tests-pass')
  })

  it('collapses multiple non-alphanum chars into one hyphen', () => {
    expect(slugifyAc('Tests  pass (all)')).toBe('tests-pass-all')
  })

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(80)
    expect(slugifyAc(long).length).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// buildRecommendation
// ---------------------------------------------------------------------------

describe('buildRecommendation', () => {
  it('returns test-specific recommendation for test-related ACs', () => {
    const rec = buildRecommendation('Tests pass', [])
    expect(rec).toContain('tests are written')
  })

  it('returns typecheck recommendation for typecheck ACs', () => {
    const rec = buildRecommendation('Typecheck passes', [])
    expect(rec).toContain('tsc')
  })

  it('returns lint recommendation for lint ACs', () => {
    const rec = buildRecommendation('Lint passes with zero errors', [])
    expect(rec).toContain('linter')
  })

  it('returns file recommendation for file creation ACs', () => {
    const rec = buildRecommendation('File is created at path', [])
    expect(rec).toContain('files are created')
  })

  it('returns generic recommendation for unknown ACs', () => {
    const rec = buildRecommendation('Some unique criterion', [])
    expect(rec).toContain('failed repeatedly')
  })

  it('appends notes summary when notes are provided', () => {
    const rec = buildRecommendation('Tests pass', ['missing import', 'wrong module'])
    expect(rec).toContain('missing import')
  })
})

// ---------------------------------------------------------------------------
// countTotalSessions
// ---------------------------------------------------------------------------

describe('countTotalSessions', () => {
  it('returns 0 for empty array', () => {
    expect(countTotalSessions([])).toBe(0)
  })

  it('sums entries across all files', () => {
    const files: FeedbackFile[] = [
      makeFeedbackFile('a', [makeEntry(), makeEntry()]),
      makeFeedbackFile('b', [makeEntry()]),
    ]
    expect(countTotalSessions(files)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// analyzePatterns
// ---------------------------------------------------------------------------

describe('analyzePatterns', () => {
  it('returns empty array when no failures', () => {
    const files = [makeFeedbackFile('a', [makeEntry({ failedAcs: [] })])]
    expect(analyzePatterns(files)).toEqual([])
  })

  it('returns empty when fail count below minimum', () => {
    const files = [makeFeedbackFile('a', [makeEntry({ failedAcs: ['AC1'] })])]
    expect(analyzePatterns(files, 2)).toEqual([])
  })

  it('returns pattern when AC fails in 2+ sessions', () => {
    const files = [
      makeFeedbackFile('a', [
        makeEntry({ failedAcs: ['Tests pass'], slug: 'spec-a' }),
        makeEntry({ failedAcs: ['Tests pass'], slug: 'spec-a' }),
      ]),
    ]
    const patterns = analyzePatterns(files, 2)
    expect(patterns).toHaveLength(1)
    expect(patterns[0]!.acText).toBe('Tests pass')
    expect(patterns[0]!.failCount).toBe(2)
  })

  it('collects notes across entries', () => {
    const files = [
      makeFeedbackFile('a', [
        makeEntry({ failedAcs: ['Tests pass'], notes: { 'Tests pass': 'missing import' }, slug: 'spec-a' }),
        makeEntry({ failedAcs: ['Tests pass'], notes: { 'Tests pass': 'wrong path' }, slug: 'spec-a' }),
      ]),
    ]
    const patterns = analyzePatterns(files, 2)
    expect(patterns[0]!.commonNotes).toContain('missing import')
    expect(patterns[0]!.commonNotes).toContain('wrong path')
  })

  it('collects unique slugs across files', () => {
    const files = [
      makeFeedbackFile('spec-a', [makeEntry({ failedAcs: ['Lint passes'], slug: 'spec-a' })]),
      makeFeedbackFile('spec-b', [makeEntry({ failedAcs: ['Lint passes'], slug: 'spec-b' })]),
    ]
    const patterns = analyzePatterns(files, 2)
    expect(patterns[0]!.slugs).toContain('spec-a')
    expect(patterns[0]!.slugs).toContain('spec-b')
  })

  it('sorts by failCount descending', () => {
    const files = [
      makeFeedbackFile('a', [
        makeEntry({ failedAcs: ['AC1'], slug: 'a' }),
        makeEntry({ failedAcs: ['AC1', 'AC2'], slug: 'a' }),
        makeEntry({ failedAcs: ['AC1', 'AC2'], slug: 'a' }),
      ]),
    ]
    const patterns = analyzePatterns(files, 2)
    expect(patterns[0]!.acText).toBe('AC1') // 3 failures
    expect(patterns[1]!.acText).toBe('AC2') // 2 failures
  })
})

// ---------------------------------------------------------------------------
// buildLessonEntry
// ---------------------------------------------------------------------------

describe('buildLessonEntry', () => {
  const pattern: PatternMatch = {
    acText: 'Tests pass',
    failCount: 3,
    slugs: ['spec-a', 'spec-b'],
    commonNotes: ['missing setup'],
  }

  it('sets id from slugified AC text', () => {
    const lesson = buildLessonEntry(pattern)
    expect(lesson.id).toBe('tests-pass')
  })

  it('sets acPattern from pattern', () => {
    const lesson = buildLessonEntry(pattern)
    expect(lesson.acPattern).toBe('Tests pass')
  })

  it('sets failCount from pattern', () => {
    const lesson = buildLessonEntry(pattern)
    expect(lesson.failCount).toBe(3)
  })

  it('sets affectedSlugs from pattern', () => {
    const lesson = buildLessonEntry(pattern)
    expect(lesson.affectedSlugs).toEqual(['spec-a', 'spec-b'])
  })

  it('sets learnedAt as ISO string', () => {
    const lesson = buildLessonEntry(pattern)
    expect(() => new Date(lesson.learnedAt)).not.toThrow()
  })

  it('sets recommendation as non-empty string', () => {
    const lesson = buildLessonEntry(pattern)
    expect(lesson.recommendation.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// distillLessons
// ---------------------------------------------------------------------------

describe('distillLessons', () => {
  it('returns empty lessons for empty feedback', () => {
    const result = distillLessons([])
    expect(result.lessons).toHaveLength(0)
    expect(result.totalSessionsAnalyzed).toBe(0)
  })

  it('sets totalSessionsAnalyzed correctly', () => {
    const files = [
      makeFeedbackFile('a', [makeEntry(), makeEntry()]),
      makeFeedbackFile('b', [makeEntry()]),
    ]
    const result = distillLessons(files)
    expect(result.totalSessionsAnalyzed).toBe(3)
  })

  it('creates lessons for recurring failures', () => {
    const files = [
      makeFeedbackFile('a', [
        makeEntry({ failedAcs: ['Tests pass'], slug: 'spec-a' }),
        makeEntry({ failedAcs: ['Tests pass'], slug: 'spec-a' }),
      ]),
    ]
    const result = distillLessons(files)
    expect(result.lessons).toHaveLength(1)
    expect(result.lessons[0]!.acPattern).toBe('Tests pass')
  })

  it('sets distilledAt as ISO string', () => {
    const result = distillLessons([])
    expect(() => new Date(result.distilledAt)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// formatLessonsForContext
// ---------------------------------------------------------------------------

describe('formatLessonsForContext', () => {
  it('returns empty string for empty lessons', () => {
    const file: LessonsFile = { distilledAt: '2026-01-01T00:00:00.000Z', totalSessionsAnalyzed: 0, lessons: [] }
    expect(formatLessonsForContext(file)).toBe('')
  })

  it('includes Tier 2 header', () => {
    const file: LessonsFile = {
      distilledAt: '2026-01-01T00:00:00.000Z',
      totalSessionsAnalyzed: 5,
      lessons: [{
        id: 'tests-pass',
        acPattern: 'Tests pass',
        failCount: 3,
        learnedAt: '2026-01-01T00:00:00.000Z',
        recommendation: 'Run tests first.',
        affectedSlugs: ['spec-a'],
      }],
    }
    const output = formatLessonsForContext(file)
    expect(output).toContain('Tier 2')
    expect(output).toContain('Tests pass')
    expect(output).toContain('3 sessions')
  })

  it('includes affected slugs when present', () => {
    const file: LessonsFile = {
      distilledAt: '2026-01-01T00:00:00.000Z',
      totalSessionsAnalyzed: 5,
      lessons: [{
        id: 'tests-pass',
        acPattern: 'Tests pass',
        failCount: 2,
        learnedAt: '2026-01-01T00:00:00.000Z',
        recommendation: 'Run tests first.',
        affectedSlugs: ['spec-a', 'spec-b'],
      }],
    }
    const output = formatLessonsForContext(file)
    expect(output).toContain('spec-a')
    expect(output).toContain('spec-b')
  })
})

// ---------------------------------------------------------------------------
// I/O: loadLessonsFile + writeLessonsFile
// ---------------------------------------------------------------------------

describe('loadLessonsFile', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lessons-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty LessonsFile when no file exists', async () => {
    const result = await loadLessonsFile(tmpDir)
    expect(result.lessons).toHaveLength(0)
    expect(result.totalSessionsAnalyzed).toBe(0)
  })

  it('loads previously written file', async () => {
    const file: LessonsFile = {
      distilledAt: '2026-01-01T00:00:00.000Z',
      totalSessionsAnalyzed: 7,
      lessons: [],
    }
    await writeLessonsFile(tmpDir, file)
    const loaded = await loadLessonsFile(tmpDir)
    expect(loaded.totalSessionsAnalyzed).toBe(7)
  })
})

describe('writeLessonsFile', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lessons-write-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns ok with path when write succeeds', async () => {
    const file: LessonsFile = { distilledAt: '2026-01-01T00:00:00.000Z', totalSessionsAnalyzed: 0, lessons: [] }
    const result = await writeLessonsFile(tmpDir, file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('lessons.json')
    }
  })

  it('creates directory if not exists', async () => {
    const nestedDir = join(tmpDir, 'a', 'b', 'c')
    const file: LessonsFile = { distilledAt: '2026-01-01T00:00:00.000Z', totalSessionsAnalyzed: 0, lessons: [] }
    const result = await writeLessonsFile(nestedDir, file)
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// captureDistilledLessons
// ---------------------------------------------------------------------------

describe('captureDistilledLessons', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lessons-capture-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns ok(undefined) when session count is below threshold', async () => {
    const files = [makeFeedbackFile('a', [makeEntry(), makeEntry()])] // 2 sessions < 5
    const result = await captureDistilledLessons(tmpDir, files)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeUndefined()
    }
  })

  it('distills and persists lessons when threshold is met', async () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ failedAcs: ['Tests pass'], slug: `spec-${i}` }),
    )
    const files = [makeFeedbackFile('a', entries)]
    const result = await captureDistilledLessons(tmpDir, files)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).not.toBeUndefined()
      expect(result.value?.totalSessionsAnalyzed).toBe(5)
    }
  })

  it('writes lessons.json to .buildpact/memory/lessons/', async () => {
    const entries = Array.from({ length: 5 }, () => makeEntry())
    const files = [makeFeedbackFile('a', entries)]
    await captureDistilledLessons(tmpDir, files)

    const loaded = await loadLessonsFile(join(tmpDir, '.buildpact', 'memory', 'lessons'))
    expect(loaded.totalSessionsAnalyzed).toBe(5)
  })

  it('distills when forceDistill=true even below threshold', async () => {
    const files = [makeFeedbackFile('a', [makeEntry()])] // 1 session
    const result = await captureDistilledLessons(tmpDir, files, true)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).not.toBeUndefined()
    }
  })
})
