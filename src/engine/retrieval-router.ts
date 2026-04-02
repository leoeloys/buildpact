/**
 * Retrieval Router — adaptive pipeline selection based on query characteristics.
 * Routes queries to keyword, semantic, recency, or hybrid retrieval pipelines.
 * @module engine/retrieval-router
 * @see BuildPact concept 20.2
 */

import type { RetrievalPipeline, RetrievalRoute } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Query type classification
// ---------------------------------------------------------------------------

/** Internal query type for routing */
type QueryType = 'code' | 'concept' | 'recent' | 'complex'

/** Patterns that indicate code-specific queries */
const CODE_PATTERNS = [
  /function\s+\w+/i, /class\s+\w+/i, /import\s+/i, /export\s+/i,
  /\w+\.\w+\(/i, /error\s+in\s+/i, /file\s+\w+\.\w+/i, /\w+\.ts/i,
  /\w+\.js/i, /\w+\.py/i,
]

/** Patterns that indicate recency-sensitive queries */
const RECENCY_PATTERNS = [
  /recent/i, /latest/i, /last\s+\d+/i, /today/i, /yesterday/i,
  /this\s+week/i, /just\s+(changed|added|updated)/i,
]

/**
 * Classify a query into a query type.
 */
function classifyQuery(query: string): QueryType {
  // Check recency first (most specific)
  if (RECENCY_PATTERNS.some(p => p.test(query))) return 'recent'

  // Check code patterns
  if (CODE_PATTERNS.some(p => p.test(query))) return 'code'

  // Long queries with multiple concepts
  const wordCount = query.split(/\s+/).length
  if (wordCount > 10) return 'complex'

  return 'concept'
}

// ---------------------------------------------------------------------------
// Pipeline selection
// ---------------------------------------------------------------------------

/**
 * Select the retrieval pipeline for a query type.
 */
export function selectPipeline(queryType: QueryType): RetrievalPipeline {
  switch (queryType) {
    case 'code': return 'keyword'
    case 'concept': return 'semantic'
    case 'recent': return 'recency'
    case 'complex': return 'hybrid'
  }
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/**
 * Route a query to the appropriate retrieval pipeline.
 * Optionally accepts context to refine the routing decision.
 */
export function routeQuery(query: string, _context?: string): RetrievalRoute {
  const queryType = classifyQuery(query)
  const pipeline = selectPipeline(queryType)

  // Confidence heuristic: more specific patterns = higher confidence
  let confidence = 0.5
  if (queryType === 'code') confidence = 0.8
  if (queryType === 'recent') confidence = 0.9
  if (queryType === 'complex') confidence = 0.6

  return {
    pipeline,
    query,
    confidence,
  }
}
