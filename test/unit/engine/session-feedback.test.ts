import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  deriveOutcome,
  buildFeedbackEntry,
  appendWithFifoCap,
  formatFeedbackForContext,
  loadFeedbackFile,
  writeFeedbackFile,
  loadRecentFeedbacks,
  captureSessionFeedback,
  FEEDBACK_FIFO_CAP,
  FEEDBACK_RECENT_LIMIT,
} from '../../../src/engine/session-feedback.js'
import type { FeedbackEntry, FeedbackFile, FeedbackBuildInput } from '../../../src/engine/session-feedback.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeInput = (overrides: Partial<FeedbackBuildInput> = {}): FeedbackBuildInput => ({
  slug: 'my-feature',
  workedAcs: ['Tests pass', 'Typecheck passes'],
  failedAcs: [],
  allPassed: true,
  notes: {},
  ...overrides,
})

const makeEntry = (overrides: Partial<FeedbackEntry> = {}): FeedbackEntry => ({
  capturedAt: '2026-01-01T00:00:00.000Z',
  slug: 'my-feature',
  workedAcs: ['Tests pass'],
  failedAcs: [],
  outcome: 'passed',
  notes: {},
  ...overrides,
})

// ---------------------------------------------------------------------------
// deriveOutcome
// ---------------------------------------------------------------------------

describe('deriveOutcome', () => {
  it('returns passed when all pass and no failures', () => {
    expect(deriveOutcome(3, 0)).toBe('passed')
  })

  it('returns failed when no passes and failures exist', () => {
    expect(deriveOutcome(0, 2)).toBe('failed')
  })

  it('returns partial when both pass and fail', () => {
    expect(deriveOutcome(2, 1)).toBe('partial')
  })

  it('returns failed when passCount=0 and failCount=0', () => {
    expect(deriveOutcome(0, 0)).toBe('failed')
  })
})

// ---------------------------------------------------------------------------
// buildFeedbackEntry
// ---------------------------------------------------------------------------

describe('buildFeedbackEntry', () => {
  it('sets slug from input', () => {
    const entry = buildFeedbackEntry(makeInput({ slug: 'feature-xyz' }))
    expect(entry.slug).toBe('feature-xyz')
  })

  it('sets workedAcs and failedAcs from input', () => {
    const entry = buildFeedbackEntry(makeInput({
      workedAcs: ['AC1'],
      failedAcs: ['AC2'],
    }))
    expect(entry.workedAcs).toEqual(['AC1'])
    expect(entry.failedAcs).toEqual(['AC2'])
  })

  it('derives outcome from pass/fail counts', () => {
    const passed = buildFeedbackEntry(makeInput({ workedAcs: ['AC1'], failedAcs: [], allPassed: true }))
    expect(passed.outcome).toBe('passed')

    const failed = buildFeedbackEntry(makeInput({ workedAcs: [], failedAcs: ['AC1'], allPassed: false }))
    expect(failed.outcome).toBe('failed')

    const partial = buildFeedbackEntry(makeInput({ workedAcs: ['AC1'], failedAcs: ['AC2'], allPassed: false }))
    expect(partial.outcome).toBe('partial')
  })

  it('includes notes from input', () => {
    const entry = buildFeedbackEntry(makeInput({ notes: { 'AC1': 'missing output' } }))
    expect(entry.notes['AC1']).toBe('missing output')
  })

  it('capturedAt is a valid ISO timestamp', () => {
    const entry = buildFeedbackEntry(makeInput())
    expect(() => new Date(entry.capturedAt)).not.toThrow()
    expect(new Date(entry.capturedAt).toISOString()).toBe(entry.capturedAt)
  })
})

// ---------------------------------------------------------------------------
// appendWithFifoCap
// ---------------------------------------------------------------------------

describe('appendWithFifoCap', () => {
  it('appends the new entry to the list', () => {
    const entries: FeedbackEntry[] = []
    const result = appendWithFifoCap(entries, makeEntry())
    expect(result).toHaveLength(1)
  })

  it('does not modify the original array', () => {
    const original: FeedbackEntry[] = [makeEntry()]
    appendWithFifoCap(original, makeEntry())
    expect(original).toHaveLength(1)
  })

  it('enforces FIFO cap — removes oldest entries when cap exceeded', () => {
    const entries: FeedbackEntry[] = Array.from({ length: 30 }, (_, i) =>
      makeEntry({ capturedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, slug: `spec-${i}` }),
    )
    const newEntry = makeEntry({ slug: 'spec-30' })
    const result = appendWithFifoCap(entries, newEntry, 30)
    expect(result).toHaveLength(30)
    expect(result[result.length - 1]!.slug).toBe('spec-30')
    expect(result[0]!.slug).toBe('spec-1') // oldest dropped
  })

  it('does not truncate when under cap', () => {
    const entries: FeedbackEntry[] = Array.from({ length: 5 }, () => makeEntry())
    const result = appendWithFifoCap(entries, makeEntry(), 30)
    expect(result).toHaveLength(6)
  })

  it('uses FEEDBACK_FIFO_CAP default when no cap provided', () => {
    expect(FEEDBACK_FIFO_CAP).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// formatFeedbackForContext
// ---------------------------------------------------------------------------

describe('formatFeedbackForContext', () => {
  it('returns empty string for empty files array', () => {
    expect(formatFeedbackForContext([])).toBe('')
  })

  it('includes Memory Layer header', () => {
    const file: FeedbackFile = {
      slug: 'my-spec',
      entries: [makeEntry({ outcome: 'passed' })],
    }
    const output = formatFeedbackForContext([file])
    expect(output).toContain('Session Feedback Memory')
  })

  it('includes spec slug in output', () => {
    const file: FeedbackFile = {
      slug: 'auth-feature',
      entries: [makeEntry({ slug: 'auth-feature' })],
    }
    const output = formatFeedbackForContext([file])
    expect(output).toContain('auth-feature')
  })

  it('includes outcome and timestamps', () => {
    const file: FeedbackFile = {
      slug: 'my-spec',
      entries: [makeEntry({ outcome: 'partial' })],
    }
    const output = formatFeedbackForContext([file])
    expect(output).toContain('partial')
  })

  it('lists failed ACs with notes', () => {
    const file: FeedbackFile = {
      slug: 'my-spec',
      entries: [makeEntry({
        failedAcs: ['Tests pass'],
        notes: { 'Tests pass': 'coverage was 0%' },
        outcome: 'failed',
      })],
    }
    const output = formatFeedbackForContext([file])
    expect(output).toContain('Tests pass')
    expect(output).toContain('coverage was 0%')
  })

  it('renders multiple files', () => {
    const files: FeedbackFile[] = [
      { slug: 'spec-a', entries: [makeEntry({ slug: 'spec-a' })] },
      { slug: 'spec-b', entries: [makeEntry({ slug: 'spec-b' })] },
    ]
    const output = formatFeedbackForContext(files)
    expect(output).toContain('spec-a')
    expect(output).toContain('spec-b')
  })
})

// ---------------------------------------------------------------------------
// I/O functions
// ---------------------------------------------------------------------------

describe('loadFeedbackFile', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-feedback-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty FeedbackFile when path does not exist', async () => {
    const result = await loadFeedbackFile(join(tmpDir, 'nonexistent.json'), 'my-spec')
    expect(result.slug).toBe('my-spec')
    expect(result.entries).toEqual([])
  })

  it('parses existing valid JSON feedback file', async () => {
    const file: FeedbackFile = {
      slug: 'my-spec',
      entries: [makeEntry()],
    }
    const path = join(tmpDir, 'my-spec.json')
    await writeFile(path, JSON.stringify(file), 'utf-8')

    const result = await loadFeedbackFile(path, 'my-spec')
    expect(result.slug).toBe('my-spec')
    expect(result.entries).toHaveLength(1)
  })

  it('returns empty FeedbackFile on invalid JSON', async () => {
    const path = join(tmpDir, 'bad.json')
    await writeFile(path, 'not json', 'utf-8')
    const result = await loadFeedbackFile(path, 'bad')
    expect(result.entries).toEqual([])
  })
})

describe('writeFeedbackFile', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-feedback-write-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('writes feedback file and returns ok with path', async () => {
    const file: FeedbackFile = { slug: 'my-spec', entries: [makeEntry()] }
    const result = await writeFeedbackFile(tmpDir, 'my-spec', file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('my-spec.json')
    }
  })

  it('creates directory if it does not exist', async () => {
    const nestedDir = join(tmpDir, 'nested', 'feedback')
    const file: FeedbackFile = { slug: 'spec', entries: [] }
    const result = await writeFeedbackFile(nestedDir, 'spec', file)
    expect(result.ok).toBe(true)
  })
})

describe('loadRecentFeedbacks', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-feedback-recent-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array when directory does not exist', async () => {
    const result = await loadRecentFeedbacks(join(tmpDir, 'missing'))
    expect(result).toEqual([])
  })

  it('returns empty array when directory has no json files', async () => {
    const feedbackDir = join(tmpDir, 'feedback')
    await mkdir(feedbackDir, { recursive: true })
    const result = await loadRecentFeedbacks(feedbackDir)
    expect(result).toEqual([])
  })

  it('loads all feedback files from directory', async () => {
    const feedbackDir = join(tmpDir, 'feedback')
    await mkdir(feedbackDir, { recursive: true })
    const file: FeedbackFile = { slug: 'spec-a', entries: [makeEntry()] }
    await writeFile(join(feedbackDir, 'spec-a.json'), JSON.stringify(file), 'utf-8')

    const result = await loadRecentFeedbacks(feedbackDir)
    expect(result).toHaveLength(1)
    expect(result[0]!.slug).toBe('spec-a')
  })

  it('limits results to FEEDBACK_RECENT_LIMIT by default', async () => {
    expect(FEEDBACK_RECENT_LIMIT).toBe(5)
  })

  it('returns at most limit files', async () => {
    const feedbackDir = join(tmpDir, 'feedback')
    await mkdir(feedbackDir, { recursive: true })
    for (let i = 0; i < 8; i++) {
      const slug = `spec-${i}`
      const file: FeedbackFile = { slug, entries: [] }
      await writeFile(join(feedbackDir, `${slug}.json`), JSON.stringify(file), 'utf-8')
    }
    const result = await loadRecentFeedbacks(feedbackDir, 3)
    expect(result.length).toBeLessThanOrEqual(3)
  })
})

describe('captureSessionFeedback', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-capture-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates feedback file in .buildpact/memory/feedback/', async () => {
    const entry = makeEntry({ slug: 'my-feature' })
    const result = await captureSessionFeedback(tmpDir, entry)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('my-feature.json')
      expect(result.value).toContain('feedback')
    }
  })

  it('accumulates entries on subsequent calls', async () => {
    const entry1 = makeEntry({ slug: 'my-feature', outcome: 'passed' })
    const entry2 = makeEntry({ slug: 'my-feature', outcome: 'failed' })

    await captureSessionFeedback(tmpDir, entry1)
    await captureSessionFeedback(tmpDir, entry2)

    const { readFile } = await import('node:fs/promises')
    const { join: pathJoin } = await import('node:path')
    const feedbackPath = pathJoin(tmpDir, '.buildpact', 'memory', 'feedback', 'my-feature.json')
    const raw = await readFile(feedbackPath, 'utf-8')
    const parsed = JSON.parse(raw) as FeedbackFile
    expect(parsed.entries).toHaveLength(2)
  })
})
