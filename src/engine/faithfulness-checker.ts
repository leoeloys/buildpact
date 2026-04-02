/**
 * Faithfulness Checker — verify agent output claims against source material.
 * Splits output into sentence-level claims, scores faithfulness,
 * and detects speculation markers that indicate ungrounded assertions.
 *
 * @module engine/faithfulness-checker
 * @see Concept 20.1 (Output faithfulness verification)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { OutputClaim, FaithfulnessResult } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Patterns that indicate speculative or ungrounded claims */
export const SPECULATION_PATTERNS = [
  'probably',
  'should work',
  'seems to',
  'seems correct',
  'might work',
  'i think it',
  'i believe',
  'likely',
  'presumably',
  'most likely',
  'hopefully',
  'i assume',
  'it appears',
  'apparently',
  'in theory',
]

/** Sentence-splitting pattern (period, exclamation, question mark followed by space or end) */
const SENTENCE_SPLIT = /(?<=[.!?])\s+/

// ---------------------------------------------------------------------------
// Claim extraction
// ---------------------------------------------------------------------------

/**
 * Extract claims from agent output by splitting on sentence boundaries.
 * Each sentence becomes a claim, initially unverified and unfaithful.
 */
export function extractClaims(output: string): OutputClaim[] {
  const trimmed = output.trim()
  if (trimmed === '') return []

  const sentences = trimmed.split(SENTENCE_SPLIT).filter(s => s.trim() !== '')

  return sentences.map(sentence => ({
    claim: sentence.trim(),
    source: null,
    verified: false,
    faithful: false,
  }))
}

// ---------------------------------------------------------------------------
// Speculation detection
// ---------------------------------------------------------------------------

/**
 * Detect speculation markers in text.
 * Returns all matched speculative phrases.
 */
export function detectSpeculationMarkers(text: string): string[] {
  const lower = text.toLowerCase()
  return SPECULATION_PATTERNS.filter(phrase => lower.includes(phrase))
}

// ---------------------------------------------------------------------------
// Faithfulness scoring
// ---------------------------------------------------------------------------

/**
 * Check faithfulness of a set of claims.
 * Score = proportion of claims marked as faithful (0-1).
 * Claims containing speculation markers are auto-marked as unfaithful.
 */
export function checkFaithfulness(
  claims: OutputClaim[],
  minScore: number = 0.7,
): FaithfulnessResult {
  if (claims.length === 0) {
    return {
      claims: [],
      score: 1,
      speculationMarkers: [],
      passed: true,
    }
  }

  const allSpeculation: string[] = []

  // Auto-mark claims with speculation as unfaithful
  const scoredClaims = claims.map(claim => {
    const markers = detectSpeculationMarkers(claim.claim)
    allSpeculation.push(...markers)

    if (markers.length > 0) {
      return { ...claim, faithful: false, verified: true }
    }
    return claim
  })

  const faithfulCount = scoredClaims.filter(c => c.faithful).length
  const score = faithfulCount / scoredClaims.length
  const uniqueMarkers = [...new Set(allSpeculation)]

  return {
    claims: scoredClaims,
    score,
    speculationMarkers: uniqueMarkers,
    passed: score >= minScore,
  }
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Require that faithfulness score meets the threshold.
 * Blocks if score is below the threshold in the result.
 */
export function requireFaithfulness(result: FaithfulnessResult): Result<void> {
  if (!result.passed) {
    return err({
      code: ERROR_CODES.FAITHFULNESS_BELOW_THRESHOLD,
      i18nKey: 'error.faithfulness.below_threshold',
      params: {
        score: result.score.toFixed(2),
        markers: result.speculationMarkers.join(', '),
      },
    })
  }

  return ok(undefined)
}
