import { describe, it, expect } from 'vitest'
import {
  validateReview,
  submitReview,
  getReviewSummary,
  formatReviewSummary,
} from '../../../src/engine/marketplace-reviews.js'
import type { SquadReview, ReviewSummary } from '../../../src/engine/marketplace-reviews.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReview(overrides?: Partial<SquadReview>): SquadReview {
  return {
    author: 'alice',
    squadName: 'software',
    rating: 4,
    comment: 'Great squad for backend work',
    timestamp: new Date().toISOString(),
    verified: true,
    ...overrides,
  }
}

function makeSummary(overrides?: Partial<ReviewSummary>): ReviewSummary {
  return {
    averageRating: 4.2,
    totalReviews: 10,
    recentReviews: [makeReview()],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// validateReview
// ---------------------------------------------------------------------------

describe('validateReview', () => {
  it('passes for a valid review', () => {
    const result = validateReview(makeReview())
    expect(result.ok).toBe(true)
  })

  it('rejects empty author', () => {
    const result = validateReview(makeReview({ author: '' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REVIEW_INVALID')
  })

  it('rejects rating below 1', () => {
    const result = validateReview(makeReview({ rating: 0 }))
    expect(result.ok).toBe(false)
  })

  it('rejects rating above 5', () => {
    const result = validateReview(makeReview({ rating: 6 }))
    expect(result.ok).toBe(false)
  })

  it('rejects non-integer rating', () => {
    const result = validateReview(makeReview({ rating: 3.5 }))
    expect(result.ok).toBe(false)
  })

  it('rejects empty comment', () => {
    const result = validateReview(makeReview({ comment: '' }))
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// submitReview
// ---------------------------------------------------------------------------

describe('submitReview', () => {
  it('succeeds with a 200 response', async () => {
    const mockFetch = async () => new Response(null, { status: 200 })
    const result = await submitReview(makeReview(), 'https://mock.registry', mockFetch as typeof fetch)
    expect(result.ok).toBe(true)
  })

  it('returns error on non-ok response', async () => {
    const mockFetch = async () => new Response(null, { status: 500 })
    const result = await submitReview(makeReview(), 'https://mock.registry', mockFetch as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REVIEW_SUBMIT_FAILED')
  })

  it('returns error on network failure', async () => {
    const mockFetch = async () => { throw new Error('network down') }
    const result = await submitReview(makeReview(), 'https://mock.registry', mockFetch as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REVIEW_SUBMIT_FAILED')
  })

  it('validates before submitting', async () => {
    const mockFetch = async () => new Response(null, { status: 200 })
    const result = await submitReview(makeReview({ author: '' }), 'https://mock.registry', mockFetch as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REVIEW_INVALID')
  })
})

// ---------------------------------------------------------------------------
// getReviewSummary
// ---------------------------------------------------------------------------

describe('getReviewSummary', () => {
  it('returns summary on success', async () => {
    const summary = makeSummary()
    const mockFetch = async () => new Response(JSON.stringify(summary), { status: 200 })
    const result = await getReviewSummary('software', 'https://mock.registry', mockFetch as typeof fetch)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.averageRating).toBe(4.2)
      expect(result.value.totalReviews).toBe(10)
    }
  })

  it('returns error on failure', async () => {
    const mockFetch = async () => new Response(null, { status: 404 })
    const result = await getReviewSummary('unknown-squad', 'https://mock.registry', mockFetch as typeof fetch)
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// formatReviewSummary
// ---------------------------------------------------------------------------

describe('formatReviewSummary', () => {
  it('formats a summary with reviews', () => {
    const output = formatReviewSummary(makeSummary())
    expect(output).toContain('4.2')
    expect(output).toContain('10 reviews')
    expect(output).toContain('alice')
  })

  it('handles empty reviews list', () => {
    const output = formatReviewSummary(makeSummary({ recentReviews: [] }))
    expect(output).toContain('No reviews yet')
  })
})
