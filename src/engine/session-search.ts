/**
 * Session Search — term-frequency search across session transcripts.
 * Lightweight keyword search without external dependencies.
 * @module engine/session-search
 * @see BuildPact concept 18.3
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Indexed session with term frequencies */
export interface SessionIndex {
  id: string
  terms: Map<string, number>
}

/** Search result with relevance score */
export interface SessionSearchResult {
  sessionId: string
  score: number
}

// ---------------------------------------------------------------------------
// Stopwords
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'are',
  'were', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
  'these', 'those', 'not', 'no', 'if', 'then', 'else', 'so', 'up',
  'out', 'just', 'also', 'than', 'more', 'very', 'too', 'all', 'each',
])

// ---------------------------------------------------------------------------
// Term extraction
// ---------------------------------------------------------------------------

/**
 * Extract search terms from a query string.
 * Splits on whitespace, lowercases, and filters stopwords + short tokens.
 */
export function extractSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length >= 2 && !STOPWORDS.has(term))
}

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

/**
 * Build a term-frequency index for a session's content.
 */
export function indexSession(sessionId: string, content: string): SessionIndex {
  const terms = new Map<string, number>()
  const tokens = extractSearchTerms(content)

  for (const token of tokens) {
    terms.set(token, (terms.get(token) ?? 0) + 1)
  }

  return { id: sessionId, terms }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search indexed sessions using TF matching.
 * Returns results sorted by descending score, filtering out zero-score matches.
 */
export function searchSessions(
  indices: readonly SessionIndex[],
  query: string,
): SessionSearchResult[] {
  const queryTerms = extractSearchTerms(query)
  if (queryTerms.length === 0) return []

  const results: SessionSearchResult[] = []

  for (const index of indices) {
    let score = 0

    for (const term of queryTerms) {
      const tf = index.terms.get(term)
      if (tf !== undefined) {
        score += tf
      }
    }

    if (score > 0) {
      results.push({ sessionId: index.id, score })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
