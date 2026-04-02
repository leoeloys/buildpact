/**
 * Memory Progressive Retrieval — composite scoring and temperature-based context selection.
 * Hot memories load first, warm fill remaining budget, cold are pruned.
 * @module engine/memory-progressive-retrieval
 * @see BuildPact concept 8.4
 */

import type { ScoredMemoryEntry, MemoryTemperature } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Type weights — gotchas and decisions are more valuable than patterns
// ---------------------------------------------------------------------------

const TYPE_WEIGHTS: Record<ScoredMemoryEntry['type'], number> = {
  gotcha: 1.0,
  decision: 0.9,
  insight: 0.7,
  pattern: 0.5,
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute a composite attention score for a memory entry.
 * Formula: recency (0.4) + accessCount (0.3) + type-weight (0.3)
 * Recency decays over 30 days; accessCount caps at 20 for normalization.
 */
export function scoreMemoryEntry(entry: ScoredMemoryEntry): number {
  const now = Date.now()
  const lastAccessed = new Date(entry.lastAccessedAt).getTime()
  const daysSinceAccess = Math.max(0, (now - lastAccessed) / (1000 * 60 * 60 * 24))

  // Recency: 1.0 at 0 days, 0.0 at 30+ days
  const recency = Math.max(0, 1 - daysSinceAccess / 30)

  // Access frequency: normalized to 0-1 range, capped at 20
  const accessNorm = Math.min(entry.accessCount / 20, 1)

  // Type weight
  const typeWeight = TYPE_WEIGHTS[entry.type] ?? 0.5

  return recency * 0.4 + accessNorm * 0.3 + typeWeight * 0.3
}

// ---------------------------------------------------------------------------
// Temperature classification
// ---------------------------------------------------------------------------

/**
 * Classify a memory entry into hot/warm/cold temperature.
 * Hot: accessed within 3 days AND score > 0.7
 * Warm: accessed within 7 days AND score 0.3–0.7
 * Cold: everything else
 */
export function classifyTemperature(entry: ScoredMemoryEntry): MemoryTemperature {
  const now = Date.now()
  const lastAccessed = new Date(entry.lastAccessedAt).getTime()
  const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24)
  const score = scoreMemoryEntry(entry)

  if (daysSinceAccess < 3 && score > 0.7) return 'hot'
  if (daysSinceAccess < 7 && score >= 0.3 && score <= 0.7) return 'warm'
  return 'cold'
}

// ---------------------------------------------------------------------------
// Context selection
// ---------------------------------------------------------------------------

/** Estimate token count: ~4 chars per token */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4)
}

/**
 * Select memory entries that fit within a token budget.
 * Hot entries first, then warm if budget allows. Cold entries are excluded.
 */
export function selectForContext(
  entries: readonly ScoredMemoryEntry[],
  tokenBudget: number,
): ScoredMemoryEntry[] {
  const classified = entries.map(e => ({
    entry: e,
    temperature: classifyTemperature(e),
    score: scoreMemoryEntry(e),
  }))

  // Sort: hot first (by score desc), then warm (by score desc)
  const hot = classified
    .filter(c => c.temperature === 'hot')
    .sort((a, b) => b.score - a.score)
  const warm = classified
    .filter(c => c.temperature === 'warm')
    .sort((a, b) => b.score - a.score)

  const selected: ScoredMemoryEntry[] = []
  let remaining = tokenBudget

  for (const { entry } of [...hot, ...warm]) {
    const tokens = estimateTokens(entry.content)
    if (tokens <= remaining) {
      selected.push(entry)
      remaining -= tokens
    }
  }

  return selected
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/**
 * Remove memory entries older than maxAgeDays based on lastAccessedAt.
 */
export function pruneStale(
  entries: readonly ScoredMemoryEntry[],
  maxAgeDays: number = 30,
): ScoredMemoryEntry[] {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  return entries.filter(e => new Date(e.lastAccessedAt).getTime() >= cutoff)
}
