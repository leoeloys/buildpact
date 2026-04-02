import { describe, it, expect } from 'vitest'
import {
  computeCompositeScore,
  consolidateMemories,
  pruneByScore,
} from '../../../src/engine/composite-memory-scoring.js'
import type { CompositeWeights } from '../../../src/engine/composite-memory-scoring.js'
import type { ScoredMemoryEntry } from '../../../src/contracts/task.js'

function makeEntry(overrides: Partial<ScoredMemoryEntry> = {}): ScoredMemoryEntry {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 6)}`,
    content: 'default content',
    type: 'insight',
    temperature: 'warm',
    attentionScore: 0.5,
    lastAccessedAt: new Date().toISOString(),
    accessCount: 5,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('computeCompositeScore', () => {
  it('uses default weights (0.4, 0.3, 0.3)', () => {
    const score = computeCompositeScore(1.0, 1.0, 1.0)
    expect(score).toBeCloseTo(1.0)
  })

  it('returns 0 for all-zero inputs', () => {
    expect(computeCompositeScore(0, 0, 0)).toBe(0)
  })

  it('clamps to 0-1 range', () => {
    expect(computeCompositeScore(2.0, 2.0, 2.0)).toBe(1)
    expect(computeCompositeScore(-1, -1, -1)).toBe(0)
  })

  it('respects custom weights', () => {
    const weights: CompositeWeights = { semantic: 1.0, recency: 0, importance: 0 }
    expect(computeCompositeScore(0.8, 1.0, 1.0, weights)).toBeCloseTo(0.8)
  })

  it('computes weighted sum correctly', () => {
    // 0.5*0.4 + 0.5*0.3 + 0.5*0.3 = 0.2 + 0.15 + 0.15 = 0.5
    expect(computeCompositeScore(0.5, 0.5, 0.5)).toBeCloseTo(0.5)
  })
})

describe('consolidateMemories', () => {
  it('returns empty for empty input', () => {
    expect(consolidateMemories([])).toEqual([])
  })

  it('keeps all entries when content is different', () => {
    const entries = [
      makeEntry({ content: 'alpha beta gamma', attentionScore: 0.9 }),
      makeEntry({ content: 'completely different topic', attentionScore: 0.5 }),
    ]
    const result = consolidateMemories(entries)
    expect(result).toHaveLength(2)
  })

  it('deduplicates similar entries, keeping higher-scored one', () => {
    const entries = [
      makeEntry({ content: 'the quick brown fox jumps over the lazy dog', attentionScore: 0.3 }),
      makeEntry({ content: 'the quick brown fox jumps over the lazy dog', attentionScore: 0.9 }),
    ]
    const result = consolidateMemories(entries)
    expect(result).toHaveLength(1)
    expect(result[0]!.attentionScore).toBe(0.9)
  })

  it('respects custom similarity threshold', () => {
    const entries = [
      makeEntry({ content: 'word1 word2 word3 word4', attentionScore: 0.8 }),
      makeEntry({ content: 'word1 word2 word3 word5', attentionScore: 0.5 }),
    ]
    // With threshold of 1.0 (exact match only), both should survive
    const result = consolidateMemories(entries, 1.0)
    expect(result).toHaveLength(2)
  })
})

describe('pruneByScore', () => {
  it('removes entries below threshold', () => {
    const entries = [
      makeEntry({ attentionScore: 0.5 }),
      makeEntry({ attentionScore: 0.05 }),
      makeEntry({ attentionScore: 0.2 }),
    ]
    const result = pruneByScore(entries, 0.1)
    expect(result).toHaveLength(2)
  })

  it('keeps entries at exactly the threshold', () => {
    const entries = [makeEntry({ attentionScore: 0.1 })]
    expect(pruneByScore(entries, 0.1)).toHaveLength(1)
  })

  it('uses default threshold of 0.1', () => {
    const entries = [
      makeEntry({ attentionScore: 0.09 }),
      makeEntry({ attentionScore: 0.11 }),
    ]
    expect(pruneByScore(entries)).toHaveLength(1)
  })
})
