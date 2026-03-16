/**
 * Git Ratchet — auto-commit proven improvements, revert everything else.
 * Pure functions with injected execFn for testability.
 * @module optimize/ratchet
 * @see FR-AutoResearch Epic 12.3 — Git Ratchet
 */

import { execSync } from 'node:child_process'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A single metric measurement before and after an experiment */
export interface MetricResult {
  /** Human-readable metric name, e.g. "test pass rate" or "bundle size" */
  name: string
  /** Metric value before the experiment */
  before: number
  /** Metric value after the experiment */
  after: number
}

/** Decision produced by the ratchet */
export type RatchetDecision = 'commit' | 'revert'

/** Output of a ratchet evaluation */
export interface RatchetResult {
  decision: RatchetDecision
  /** Formatted commit message when decision === 'commit' */
  commitMessage?: string
}

/** Immutable state for an isolated ratchet branch session */
export interface RatchetSession {
  /** Category of the optimization target, e.g. "code" or "docs" */
  targetType: string
  /** Short session identifier chosen by the user */
  sessionName: string
  /** Fully-formed isolated branch name */
  branchName: string
  /** git commit ref of the last known-good state (null before first commit) */
  lastGoodCommitRef: string | null
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Build the isolated branch name for an AutoResearch session.
 * Format: optimize/{targetType}/{sessionName}/{timestamp}
 *
 * @param targetType - Category of the optimization target (e.g. "code")
 * @param sessionName - Short session identifier (e.g. "experiment-1")
 * @param timestamp - Timestamp string for uniqueness (e.g. ISO date or epoch)
 */
export function buildIsolatedBranchName(
  targetType: string,
  sessionName: string,
  timestamp: string,
): string {
  // Sanitise components: lowercase, replace whitespace/special chars with hyphens
  const safe = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  return `optimize/${safe(targetType)}/${safe(sessionName)}/${safe(timestamp)}`
}

/**
 * Format a ratchet commit message for an improvement.
 * Format: optimize(N): description | metric: X.XX → Y.YY
 *
 * @param experimentNumber - Sequence number of the experiment
 * @param description - Short description of what was improved
 * @param metric - Metric result showing before/after values
 */
export function formatRatchetCommitMessage(
  experimentNumber: number,
  description: string,
  metric: MetricResult,
): string {
  const before = metric.before.toFixed(2)
  const after = metric.after.toFixed(2)
  return `optimize(${experimentNumber}): ${description} | ${metric.name}: ${before} → ${after}`
}

/**
 * Returns true when `after` is strictly greater than `before`,
 * indicating a measurable improvement worth committing.
 */
export function shouldCommit(before: number, after: number): boolean {
  return after > before
}

/**
 * Evaluate an experiment result and produce a ratchet decision.
 * Returns 'commit' with a formatted message when the metric improves,
 * or 'revert' when the metric is equal or worse.
 */
export function decideRatchet(
  before: number,
  after: number,
  experimentNumber: number,
  description: string,
  metricName: string,
): RatchetResult {
  if (!shouldCommit(before, after)) {
    return { decision: 'revert' }
  }
  const metric: MetricResult = { name: metricName, before, after }
  return {
    decision: 'commit',
    commitMessage: formatRatchetCommitMessage(experimentNumber, description, metric),
  }
}

/**
 * Build human-readable merge review instructions.
 * The isolated branch must not be merged automatically — human review is required.
 */
export function buildReviewInstructions(branchName: string, mainBranch = 'main'): string {
  return [
    '# AutoResearch Merge Review',
    '',
    `Branch: \`${branchName}\`  `,
    `Merge target: \`${mainBranch}\``,
    '',
    '## Steps',
    '',
    `1. Review all commits on \`${branchName}\` — each represents a proven improvement.`,
    `2. Run the full test suite on \`${branchName}\` before merging.`,
    '3. Confirm the metric improvements are acceptable for your use case.',
    `4. Merge via pull request — **do not auto-merge or force-push to \`${mainBranch}\`**.`,
    '',
    '> Auto-merge is intentionally disabled. Human review is required before merging.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// I/O functions (git operations)
// ---------------------------------------------------------------------------

/**
 * Create and check out an isolated branch for the ratchet session.
 * Fails if the branch already exists.
 */
export function createIsolatedBranch(
  branchName: string,
  projectDir: string,
  execFn: typeof execSync = execSync,
): Result<string> {
  try {
    execFn(`git checkout -b ${JSON.stringify(branchName)}`, {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    })
    return ok(branchName)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.RATCHET_BRANCH_FAILED,
      i18nKey: 'error.ratchet.branch_failed',
      params: { branch: branchName, reason },
      cause: e,
    })
  }
}

/**
 * Capture the current HEAD commit ref for use as the last-good rollback point.
 */
export function getRatchetCommitRef(
  projectDir: string,
  execFn: typeof execSync = execSync,
): Result<string> {
  try {
    const ref = execFn('git rev-parse HEAD', {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }) as string
    return ok(ref.trim())
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.RATCHET_COMMIT_FAILED,
      i18nKey: 'error.ratchet.commit_failed',
      params: { reason },
      cause: e,
    })
  }
}

/**
 * Stage all changes and commit with the given message.
 * Returns the new HEAD commit ref on success.
 */
export function runRatchetCommit(
  message: string,
  projectDir: string,
  execFn: typeof execSync = execSync,
): Result<string> {
  try {
    execFn('git add -A', {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    })
    execFn(`git commit -m ${JSON.stringify(message)}`, {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    })
    const ref = execFn('git rev-parse HEAD', {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }) as string
    return ok(ref.trim())
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.RATCHET_COMMIT_FAILED,
      i18nKey: 'error.ratchet.commit_failed',
      params: { reason },
      cause: e,
    })
  }
}

/**
 * Revert to a known-good commit ref via `git reset --hard`.
 * This is destructive — all uncommitted changes are discarded.
 */
export function runRatchetRevert(
  commitRef: string,
  projectDir: string,
  execFn: typeof execSync = execSync,
): Result<string> {
  try {
    execFn(`git reset --hard ${JSON.stringify(commitRef)}`, {
      cwd: projectDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    })
    return ok(commitRef)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.RATCHET_REVERT_FAILED,
      i18nKey: 'error.ratchet.revert_failed',
      params: { ref: commitRef, reason },
      cause: e,
    })
  }
}
