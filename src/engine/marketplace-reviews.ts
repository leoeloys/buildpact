/**
 * Marketplace Ratings & Reviews — submit and retrieve squad reviews
 * from the BuildPact community registry.
 * @see Epic 24.3: Marketplace Ratings & Reviews
 */

import { ok, err } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import { REGISTRY_BASE_URL } from './community-hub.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SquadReview {
  author: string
  squadName: string
  rating: number // 1-5
  comment: string
  timestamp: string
  verified: boolean // has used the squad for at least one execution
}

export interface ReviewSummary {
  averageRating: number
  totalReviews: number
  recentReviews: SquadReview[] // 3 most recent
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REVIEWS_API_PATH = '/api/reviews'

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Validate a review before submission.
 * Checks: rating 1-5, comment not empty, author not empty.
 */
export function validateReview(review: SquadReview): Result<void> {
  if (!review.author || review.author.trim() === '') {
    return err({
      code: 'REVIEW_INVALID',
      i18nKey: 'error.review.author_empty',
      params: { field: 'author' },
    })
  }

  if (!review.squadName || review.squadName.trim() === '') {
    return err({
      code: 'REVIEW_INVALID',
      i18nKey: 'error.review.squad_empty',
      params: { field: 'squadName' },
    })
  }

  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
    return err({
      code: 'REVIEW_INVALID',
      i18nKey: 'error.review.rating_out_of_range',
      params: { rating: String(review.rating) },
    })
  }

  if (!review.comment || review.comment.trim() === '') {
    return err({
      code: 'REVIEW_INVALID',
      i18nKey: 'error.review.comment_empty',
      params: { field: 'comment' },
    })
  }

  return ok(undefined)
}

/**
 * Submit a review to the community registry.
 */
export async function submitReview(
  review: SquadReview,
  registryBase?: string | undefined,
  fetchFn?: typeof fetch | undefined,
): Promise<Result<void>> {
  const validation = validateReview(review)
  if (!validation.ok) return validation

  const base = registryBase ?? REGISTRY_BASE_URL
  const url = `${base}${REVIEWS_API_PATH}`
  const doFetch = fetchFn ?? globalThis.fetch

  try {
    const response = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    })

    if (!response.ok) {
      return err({
        code: 'REVIEW_SUBMIT_FAILED',
        i18nKey: 'error.review.submit_failed',
        params: { status: String(response.status) },
      })
    }

    return ok(undefined)
  } catch (e) {
    return err({
      code: 'REVIEW_SUBMIT_FAILED',
      i18nKey: 'error.review.submit_failed',
      params: { status: 'network_error' },
      cause: e,
    })
  }
}

/**
 * Fetch the review summary for a squad from the community registry.
 */
export async function getReviewSummary(
  squadName: string,
  registryBase?: string | undefined,
  fetchFn?: typeof fetch | undefined,
): Promise<Result<ReviewSummary>> {
  const base = registryBase ?? REGISTRY_BASE_URL
  const url = `${base}${REVIEWS_API_PATH}/${encodeURIComponent(squadName)}`
  const doFetch = fetchFn ?? globalThis.fetch

  try {
    const response = await doFetch(url)

    if (!response.ok) {
      return err({
        code: 'REVIEW_FETCH_FAILED',
        i18nKey: 'error.review.fetch_failed',
        params: { squadName, status: String(response.status) },
      })
    }

    const raw = (await response.json()) as Record<string, unknown>
    const data: ReviewSummary = {
      averageRating: Number(raw['averageRating'] ?? 0),
      totalReviews: Number(raw['totalReviews'] ?? 0),
      recentReviews: Array.isArray(raw['recentReviews'])
        ? (raw['recentReviews'] as Record<string, unknown>[]).map(r => ({
            author: String(r['author'] ?? ''),
            squadName: String(r['squadName'] ?? ''),
            rating: Number(r['rating'] ?? 0),
            comment: String(r['comment'] ?? ''),
            timestamp: String(r['timestamp'] ?? ''),
            verified: r['verified'] === true,
          }))
        : [],
    }
    return ok(data)
  } catch (e) {
    return err({
      code: 'REVIEW_FETCH_FAILED',
      i18nKey: 'error.review.fetch_failed',
      params: { squadName, status: 'network_error' },
      cause: e,
    })
  }
}

/**
 * Format a review summary for human-readable display.
 */
export function formatReviewSummary(summary: ReviewSummary): string {
  const stars = (n: number): string => '\u2605'.repeat(n) + '\u2606'.repeat(5 - n)
  const lines: string[] = [
    `Rating: ${stars(Math.round(summary.averageRating))} ${summary.averageRating.toFixed(1)}/5.0 (${summary.totalReviews} reviews)`,
    '',
  ]

  if (summary.recentReviews.length > 0) {
    lines.push('Recent reviews:')
    for (const r of summary.recentReviews) {
      const verified = r.verified ? ' [verified]' : ''
      lines.push(`  ${stars(r.rating)} by ${r.author}${verified} — "${r.comment}"`)
    }
  } else {
    lines.push('No reviews yet.')
  }

  return lines.join('\n')
}
