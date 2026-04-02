/**
 * Composite Memory Scoring — multi-signal scoring and memory consolidation.
 * Combines semantic similarity, recency, and importance into a single score.
 * @module engine/composite-memory-scoring
 * @see BuildPact concept 20.3
 */

import type { ScoredMemoryEntry } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Default weights
// ---------------------------------------------------------------------------

/** Default weights for composite scoring */
export interface CompositeWeights {
  semantic: number
  recency: number
  importance: number
}

const DEFAULT_WEIGHTS: CompositeWeights = {
  semantic: 0.4,
  recency: 0.3,
  importance: 0.3,
}

// ---------------------------------------------------------------------------
// Composite scoring
// ---------------------------------------------------------------------------

/**
 * Compute a composite score from semantic similarity, recency, and importance.
 * All inputs should be normalized to 0-1 range.
 */
export function computeCompositeScore(
  semantic: number,
  recency: number,
  importance: number,
  weights?: CompositeWeights,
): number {
  const w = weights ?? DEFAULT_WEIGHTS
  const raw = semantic * w.semantic + recency * w.recency + importance * w.importance
  return Math.max(0, Math.min(1, raw))
}

// ---------------------------------------------------------------------------
// Memory consolidation
// ---------------------------------------------------------------------------

/**
 * Simple content similarity: ratio of shared words.
 */
function contentSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/))
  const wordsB = new Set(b.toLowerCase().split(/\s+/))
  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let shared = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) shared++
  }

  return shared / Math.max(wordsA.size, wordsB.size)
}

/**
 * Consolidate similar memory entries by merging duplicates.
 * When two entries exceed the similarity threshold, the lower-scored one is dropped.
 */
export function consolidateMemories(
  entries: readonly ScoredMemoryEntry[],
  similarityThreshold: number = 0.8,
): ScoredMemoryEntry[] {
  if (entries.length === 0) return []

  // Sort by attention score descending — keep highest-scored entries
  const sorted = [...entries].sort((a, b) => b.attentionScore - a.attentionScore)
  const kept: ScoredMemoryEntry[] = []
  const removed = new Set<number>()

  for (let i = 0; i < sorted.length; i++) {
    if (removed.has(i)) continue

    const entry = sorted[i]!
    kept.push(entry)

    // Mark similar lower-scored entries for removal
    for (let j = i + 1; j < sorted.length; j++) {
      if (removed.has(j)) continue
      const other = sorted[j]!
      if (contentSimilarity(entry.content, other.content) >= similarityThreshold) {
        removed.add(j)
      }
    }
  }

  return kept
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/**
 * Remove entries below a minimum attention score threshold.
 */
export function pruneByScore(
  entries: readonly ScoredMemoryEntry[],
  minScore: number = 0.1,
): ScoredMemoryEntry[] {
  return entries.filter(e => e.attentionScore >= minScore)
}
