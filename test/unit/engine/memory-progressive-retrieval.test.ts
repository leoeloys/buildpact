import { describe, it, expect } from 'vitest'
import {
  scoreMemoryEntry,
  classifyTemperature,
  selectForContext,
  pruneStale,
} from '../../../src/engine/memory-progressive-retrieval.js'
import type { ScoredMemoryEntry } from '../../../src/contracts/task.js'

function makeEntry(overrides: Partial<ScoredMemoryEntry> = {}): ScoredMemoryEntry {
  return {
    id: 'mem-1',
    content: 'Some memory content here',
    type: 'gotcha',
    temperature: 'hot',
    attentionScore: 0.8,
    lastAccessedAt: new Date().toISOString(),
    accessCount: 10,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('scoreMemoryEntry', () => {
  it('returns high score for recently-accessed gotcha with many accesses', () => {
    const entry = makeEntry({ type: 'gotcha', accessCount: 20 })
    const score = scoreMemoryEntry(entry)
    // recency ~1.0*0.4 + accessNorm 1.0*0.3 + typeWeight 1.0*0.3 = 1.0
    expect(score).toBeCloseTo(1.0, 1)
  })

  it('returns lower score for old entries', () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const entry = makeEntry({ lastAccessedAt: old, accessCount: 0, type: 'pattern' })
    const score = scoreMemoryEntry(entry)
    // recency 0 + accessNorm 0 + typeWeight 0.5*0.3 = 0.15
    expect(score).toBeCloseTo(0.15, 1)
  })

  it('caps accessCount normalization at 20', () => {
    const a = makeEntry({ accessCount: 20 })
    const b = makeEntry({ accessCount: 100 })
    expect(scoreMemoryEntry(a)).toBeCloseTo(scoreMemoryEntry(b), 5)
  })

  it('uses correct type weights for decisions', () => {
    const gotcha = makeEntry({ type: 'gotcha', accessCount: 0 })
    const decision = makeEntry({ type: 'decision', accessCount: 0 })
    // Both recent, 0 access => only diff is type weight: gotcha=1.0 vs decision=0.9
    expect(scoreMemoryEntry(gotcha)).toBeGreaterThan(scoreMemoryEntry(decision))
  })
})

describe('classifyTemperature', () => {
  it('returns hot for high-score recent entry', () => {
    const entry = makeEntry({ type: 'gotcha', accessCount: 20 })
    expect(classifyTemperature(entry)).toBe('hot')
  })

  it('returns cold for very old entry', () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const entry = makeEntry({ lastAccessedAt: old, accessCount: 0, type: 'pattern' })
    expect(classifyTemperature(entry)).toBe('cold')
  })
})

describe('selectForContext', () => {
  it('returns empty array when no entries', () => {
    expect(selectForContext([], 1000)).toEqual([])
  })

  it('excludes cold entries', () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const cold = makeEntry({ id: 'cold', lastAccessedAt: old, accessCount: 0, type: 'pattern' })
    const result = selectForContext([cold], 10000)
    expect(result).toEqual([])
  })

  it('respects token budget', () => {
    // Each entry content "Some memory content here" = 24 chars => ~6 tokens
    const entries = [
      makeEntry({ id: 'a', content: 'aaaa', accessCount: 20, type: 'gotcha' }),
      makeEntry({ id: 'b', content: 'bbbb', accessCount: 20, type: 'gotcha' }),
    ]
    // Budget of 1 token = 4 chars, only first entry fits (4 chars = 1 token)
    const result = selectForContext(entries, 1)
    expect(result.length).toBe(1)
  })
})

describe('pruneStale', () => {
  it('keeps recent entries', () => {
    const recent = makeEntry()
    expect(pruneStale([recent], 30)).toHaveLength(1)
  })

  it('removes entries older than maxAgeDays', () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const stale = makeEntry({ lastAccessedAt: old })
    expect(pruneStale([stale], 30)).toHaveLength(0)
  })

  it('uses default 30-day cutoff', () => {
    const borderline = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString()
    const entry = makeEntry({ lastAccessedAt: borderline })
    expect(pruneStale([entry])).toHaveLength(1)
  })
})
