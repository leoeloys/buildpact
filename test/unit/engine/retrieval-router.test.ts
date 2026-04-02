import { describe, it, expect } from 'vitest'
import {
  selectPipeline,
  routeQuery,
} from '../../../src/engine/retrieval-router.js'

describe('selectPipeline', () => {
  it('returns keyword for code queries', () => {
    expect(selectPipeline('code')).toBe('keyword')
  })

  it('returns semantic for concept queries', () => {
    expect(selectPipeline('concept')).toBe('semantic')
  })

  it('returns recency for recent queries', () => {
    expect(selectPipeline('recent')).toBe('recency')
  })

  it('returns hybrid for complex queries', () => {
    expect(selectPipeline('complex')).toBe('hybrid')
  })
})

describe('routeQuery', () => {
  it('routes code-pattern queries to keyword pipeline', () => {
    const route = routeQuery('function parseConfig in config.ts')
    expect(route.pipeline).toBe('keyword')
    expect(route.confidence).toBe(0.8)
  })

  it('routes recency queries to recency pipeline', () => {
    const route = routeQuery('what changed recently in the project')
    expect(route.pipeline).toBe('recency')
    expect(route.confidence).toBe(0.9)
  })

  it('routes long concept queries to hybrid pipeline', () => {
    const long = 'how does the authentication system work with the authorization middleware and session management across multiple microservices'
    const route = routeQuery(long)
    expect(route.pipeline).toBe('hybrid')
    expect(route.confidence).toBe(0.6)
  })

  it('routes simple concept queries to semantic pipeline', () => {
    const route = routeQuery('memory scoring')
    expect(route.pipeline).toBe('semantic')
    expect(route.confidence).toBe(0.5)
  })

  it('preserves original query in route', () => {
    const route = routeQuery('test query')
    expect(route.query).toBe('test query')
  })

  it('detects file extensions as code queries', () => {
    const route = routeQuery('check utils.ts')
    expect(route.pipeline).toBe('keyword')
  })
})
