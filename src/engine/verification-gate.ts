/**
 * Verification Gate — evidence-based completion claims.
 * "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"
 *
 * Agents must prove their claims by running commands and presenting output.
 * Stale evidence, missing evidence, and red-flag language all block completion.
 *
 * @module engine/verification-gate
 * @see Concept 3.1 (Superpowers verification-before-completion)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { VerificationClaim, VerificationEvidence } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default max age for evidence before it's considered stale (5 minutes) */
export const DEFAULT_MAX_AGE_MS = 300_000

/** Maximum output length stored in evidence (chars) */
export const MAX_OUTPUT_LENGTH = 2000

/** Red-flag phrases that indicate unverified claims */
export const RED_FLAG_PATTERNS = [
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
]

/** Claims that require exit code 0 to be valid */
const ZERO_EXIT_CLAIMS: VerificationClaim[] = ['TESTS_PASS', 'BUILD_SUCCEEDS', 'LINT_CLEAN']

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a verification evidence record.
 * Automatically truncates output and sets stale=false at creation time.
 */
export function createVerificationEvidence(
  command: string,
  exitCode: number,
  output: string,
  claimType: VerificationClaim,
): VerificationEvidence {
  return {
    command,
    exitCode,
    output: output.length > MAX_OUTPUT_LENGTH ? output.slice(0, MAX_OUTPUT_LENGTH) : output,
    timestamp: new Date().toISOString(),
    claimType,
    stale: false,
  }
}

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------

/**
 * Check if evidence is stale (older than maxAgeMs).
 */
export function isEvidenceStale(
  evidence: VerificationEvidence,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): boolean {
  const age = Date.now() - new Date(evidence.timestamp).getTime()
  return age > maxAgeMs
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a piece of verification evidence.
 * Checks: not stale, has output, exit code matches claim type.
 */
export function validateEvidence(
  evidence: VerificationEvidence,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Result<void> {
  // Stale check
  if (isEvidenceStale(evidence, maxAgeMs)) {
    return err({
      code: ERROR_CODES.VERIFICATION_EVIDENCE_STALE,
      i18nKey: 'error.verification.evidence_stale',
      params: { command: evidence.command, claimType: evidence.claimType },
    })
  }

  // Claims requiring exit 0
  if (ZERO_EXIT_CLAIMS.includes(evidence.claimType) && evidence.exitCode !== 0) {
    return err({
      code: ERROR_CODES.VERIFICATION_CLAIM_UNSUBSTANTIATED,
      i18nKey: 'error.verification.claim_unsubstantiated',
      params: {
        claimType: evidence.claimType,
        exitCode: String(evidence.exitCode),
      },
    })
  }

  // Must have output
  if (!evidence.output || evidence.output.trim() === '') {
    return err({
      code: ERROR_CODES.VERIFICATION_CLAIM_UNSUBSTANTIATED,
      i18nKey: 'error.verification.empty_output',
      params: { command: evidence.command },
    })
  }

  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Red flags
// ---------------------------------------------------------------------------

/**
 * Scan output text for red-flag phrases that indicate unverified claims.
 * Returns all matched phrases.
 */
export function detectRedFlags(output: string): string[] {
  const lower = output.toLowerCase()
  return RED_FLAG_PATTERNS.filter(phrase => lower.includes(phrase))
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Require verification evidence for a claim. BLOCKS if:
 * - No evidence provided
 * - Evidence is stale
 * - Evidence doesn't support the claim (wrong exit code, empty output)
 */
export function requireVerificationForClaim(
  claim: VerificationClaim,
  evidence?: VerificationEvidence | undefined,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Result<VerificationEvidence> {
  if (!evidence) {
    return err({
      code: ERROR_CODES.VERIFICATION_EVIDENCE_MISSING,
      i18nKey: 'error.verification.evidence_missing',
      params: { claimType: claim },
    })
  }

  const validation = validateEvidence(evidence, maxAgeMs)
  if (!validation.ok) return validation as Result<never>

  return ok(evidence)
}
