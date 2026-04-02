import { describe, it, expect } from 'vitest'
import {
  extractSearchTerms,
  indexSession,
  searchSessions,
} from '../../../src/engine/session-search.js'
import type { SessionIndex } from '../../../src/engine/session-search.js'

describe('extractSearchTerms', () => {
  it('lowercases and splits on whitespace', () => {
    const terms = extractSearchTerms('Hello World')
    expect(terms).toContain('hello')
    expect(terms).toContain('world')
  })

  it('filters stopwords', () => {
    const terms = extractSearchTerms('the quick brown fox and the lazy dog')
    expect(terms).not.toContain('the')
    expect(terms).not.toContain('and')
    expect(terms).toContain('quick')
    expect(terms).toContain('brown')
  })

  it('filters short tokens (< 2 chars)', () => {
    const terms = extractSearchTerms('I am a builder')
    expect(terms).not.toContain('i')
    expect(terms).not.toContain('a')
    expect(terms).toContain('builder')
  })

  it('returns empty for empty string', () => {
    expect(extractSearchTerms('')).toEqual([])
  })
})

describe('indexSession', () => {
  it('builds term frequency map', () => {
    const idx = indexSession('s1', 'hello world hello')
    expect(idx.id).toBe('s1')
    expect(idx.terms.get('hello')).toBe(2)
    expect(idx.terms.get('world')).toBe(1)
  })

  it('excludes stopwords from index', () => {
    const idx = indexSession('s1', 'the quick and the fast')
    expect(idx.terms.has('the')).toBe(false)
    expect(idx.terms.has('and')).toBe(false)
  })
})

describe('searchSessions', () => {
  const indices: SessionIndex[] = [
    indexSession('s1', 'typescript compiler errors debugging'),
    indexSession('s2', 'react hooks performance optimization'),
    indexSession('s3', 'typescript react component testing'),
  ]

  it('returns matching sessions sorted by score', () => {
    const results = searchSessions(indices, 'typescript')
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results[0]!.sessionId).toBeDefined()
  })

  it('returns empty for stopword-only queries', () => {
    const results = searchSessions(indices, 'the and or')
    expect(results).toEqual([])
  })

  it('returns empty for empty query', () => {
    expect(searchSessions(indices, '')).toEqual([])
  })

  it('scores higher for sessions with more term matches', () => {
    const results = searchSessions(indices, 'typescript react')
    // s3 has both terms, should score highest
    expect(results[0]!.sessionId).toBe('s3')
  })
})
