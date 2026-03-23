import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadBuiltInBenchmark,
  loadCustomBenchmark,
  scoreOutput,
} from '../../../src/engine/benchmark-sets.js'
import type { BenchmarkTask } from '../../../src/engine/benchmark-sets.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides?: Partial<BenchmarkTask>): BenchmarkTask {
  return {
    id: 't1',
    name: 'Test',
    domain: 'software',
    input: 'do something',
    expectedPatterns: ['hello', 'world'],
    qualityRubric: { maxScore: 10, criteria: ['criterion'] },
    maxCostUsd: 0.05,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// loadBuiltInBenchmark
// ---------------------------------------------------------------------------

describe('loadBuiltInBenchmark', () => {
  it('returns software benchmarks with 5 tasks', () => {
    const set = loadBuiltInBenchmark('software')
    expect(set.domain).toBe('software')
    expect(set.tasks).toHaveLength(5)
  })

  it('returns tasks with valid structure', () => {
    const set = loadBuiltInBenchmark('software')
    for (const task of set.tasks) {
      expect(task.id).toBeTruthy()
      expect(task.expectedPatterns.length).toBeGreaterThan(0)
      expect(task.qualityRubric.maxScore).toBe(10)
    }
  })

  it('returns empty set for unknown domain', () => {
    const set = loadBuiltInBenchmark('unknown-domain')
    expect(set.tasks).toHaveLength(0)
    expect(set.domain).toBe('unknown-domain')
  })

  it('all software tasks have unique IDs', () => {
    const set = loadBuiltInBenchmark('software')
    const ids = set.tasks.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all software tasks have positive maxCostUsd', () => {
    const set = loadBuiltInBenchmark('software')
    for (const task of set.tasks) {
      expect(task.maxCostUsd).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// loadCustomBenchmark
// ---------------------------------------------------------------------------

describe('loadCustomBenchmark', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-bench-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('loads a valid JSON benchmark file', async () => {
    const benchPath = join(tmpDir, 'custom.json')
    await writeFile(
      benchPath,
      JSON.stringify({
        name: 'Custom',
        domain: 'custom',
        tasks: [makeTask()],
      }),
    )
    const result = await loadCustomBenchmark(benchPath)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('Custom')
      expect(result.value.tasks).toHaveLength(1)
    }
  })

  it('returns error for non-existent file', async () => {
    const result = await loadCustomBenchmark('/nonexistent/path.json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_READ_FAILED')
    }
  })

  it('returns error for invalid JSON', async () => {
    const benchPath = join(tmpDir, 'bad.json')
    await writeFile(benchPath, 'not json!!!')
    const result = await loadCustomBenchmark(benchPath)
    expect(result.ok).toBe(false)
  })

  it('returns error for missing required fields', async () => {
    const benchPath = join(tmpDir, 'incomplete.json')
    await writeFile(benchPath, JSON.stringify({ name: 'Missing fields' }))
    const result = await loadCustomBenchmark(benchPath)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_INVALID')
    }
  })

  it('returns error when tasks is not an array', async () => {
    const benchPath = join(tmpDir, 'badtasks.json')
    await writeFile(
      benchPath,
      JSON.stringify({ name: 'Bad', domain: 'x', tasks: 'not-array' }),
    )
    const result = await loadCustomBenchmark(benchPath)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_INVALID')
    }
  })
})

// ---------------------------------------------------------------------------
// scoreOutput
// ---------------------------------------------------------------------------

describe('scoreOutput', () => {
  it('scores full marks when all patterns match', () => {
    const task = makeTask({ expectedPatterns: ['hello', 'world'] })
    const score = scoreOutput('hello world', task)
    expect(score).toBe(10)
  })

  it('scores partial when some patterns match', () => {
    const task = makeTask({ expectedPatterns: ['hello', 'missing'] })
    const score = scoreOutput('hello there', task)
    expect(score).toBe(5)
  })

  it('scores zero when no patterns match', () => {
    const task = makeTask({ expectedPatterns: ['xyz', 'abc'] })
    const score = scoreOutput('nothing here', task)
    expect(score).toBe(0)
  })

  it('returns zero for empty expected patterns', () => {
    const task = makeTask({ expectedPatterns: [] })
    const score = scoreOutput('hello world', task)
    expect(score).toBe(0)
  })

  it('handles regex patterns', () => {
    const task = makeTask({ expectedPatterns: ['\\d+', '[A-Z]{3}'] })
    const score = scoreOutput('found 42 and ABC here', task)
    expect(score).toBe(10)
  })

  it('does not exceed maxScore', () => {
    const task = makeTask({
      expectedPatterns: ['a'],
      qualityRubric: { maxScore: 5, criteria: ['ok'] },
    })
    const score = scoreOutput('a', task)
    expect(score).toBeLessThanOrEqual(5)
  })
})
