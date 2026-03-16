/**
 * Crash recovery with automatic retry — up to 3 recovery strategies before escalation.
 * @module engine/recovery
 * @see FR-703 — Recovery System (US-024)
 */

import { execSync } from 'node:child_process'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Recovery strategy to try after a task failure */
export type RecoveryStrategy = 'retry' | 'simplify' | 'skip'

/** Record of a single failed attempt for a task */
export interface TaskFailure {
  taskId: string
  taskTitle: string
  strategy: RecoveryStrategy
  attemptNumber: number
  error: string
}

/** Context for a recovery session — tracks failures and last known good state */
export interface RecoverySession {
  /** Last good git commit ref (SHA) before task execution began */
  lastGoodCommitRef: string
  /** All failure records accumulated during this session */
  failures: TaskFailure[]
}

/** Result of a recovery attempt — either recovered or escalated */
export interface RecoveryResult {
  recovered: boolean
  /** Strategy that will be applied in the next attempt — undefined when escalating */
  nextStrategy?: RecoveryStrategy
  /** Failure summary when all strategies are exhausted */
  failureSummary?: string
  /** Whether a rollback was performed */
  rolledBack?: boolean
}

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Select the next recovery strategy based on attempt number (0-indexed).
 * Strategy progression: retry → simplify → skip → exhausted.
 * Pure function — no side effects.
 */
export function selectNextStrategy(attemptNumber: number): RecoveryStrategy | undefined {
  const strategies: RecoveryStrategy[] = ['retry', 'simplify', 'skip']
  return strategies[attemptNumber]
}

/**
 * Detect if execution is stuck in a loop — same error repeating across consecutive attempts.
 * A loop is detected when the last 2+ failures for the same task have identical error messages.
 * Pure function — no side effects.
 */
export function isStuckLoop(failures: TaskFailure[], taskId: string): boolean {
  const taskFailures = failures.filter(f => f.taskId === taskId)
  if (taskFailures.length < 2) return false
  const last = taskFailures[taskFailures.length - 1]!
  const prev = taskFailures[taskFailures.length - 2]!
  return last.error === prev.error
}

/**
 * Build a human-readable failure summary for user escalation.
 * Includes all failed tasks, strategies tried, and error messages.
 * Pure function — no side effects.
 */
export function buildFailureSummary(failures: TaskFailure[]): string {
  if (failures.length === 0) return 'No failures recorded.'

  const lines: string[] = [
    '## Recovery Exhausted — Failure Summary',
    '',
    `All ${failures.length} recovery attempt(s) failed. Manual intervention required.`,
    '',
    '### Failed Tasks',
    '',
  ]

  // Group by taskId
  const byTask = new Map<string, TaskFailure[]>()
  for (const f of failures) {
    const existing = byTask.get(f.taskId) ?? []
    existing.push(f)
    byTask.set(f.taskId, existing)
  }

  for (const [taskId, taskFailures] of byTask) {
    const title = taskFailures[0]!.taskTitle
    lines.push(`**Task:** ${title} (${taskId})`)
    for (const f of taskFailures) {
      lines.push(`  - Attempt ${f.attemptNumber + 1} [${f.strategy}]: ${f.error}`)
    }
    lines.push('')
  }

  lines.push('### Next Steps')
  lines.push('')
  lines.push('1. Review error messages above')
  lines.push('2. Fix the underlying issue manually')
  lines.push('3. Re-run the execution after the fix')

  return lines.join('\n')
}

/**
 * Create a new recovery session, capturing the current HEAD commit as the last known good state.
 * Returns an error if the git command fails.
 */
export function createRecoverySession(projectDir: string): Result<RecoverySession> {
  try {
    const commitRef = execSync('git rev-parse HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    return ok({
      lastGoodCommitRef: commitRef,
      failures: [],
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.recovery.session_create_failed',
      params: { reason },
      cause: e,
    })
  }
}

/**
 * Roll back the working directory to the last good commit ref using git reset --hard.
 * This ensures no partial or broken changes remain in the codebase.
 * Returns the commit ref that was restored on success.
 */
export function executeRollback(
  projectDir: string,
  commitRef: string,
): Result<string> {
  try {
    execSync(`git reset --hard ${commitRef}`, {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return ok(commitRef)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.recovery.rollback_failed',
      params: { ref: commitRef, reason },
      cause: e,
    })
  }
}

/**
 * Record a task failure in the session and determine the next recovery action.
 * - If more strategies remain and no stuck loop: return next strategy.
 * - If stuck loop detected: advance past the looping strategy.
 * - If all strategies exhausted: trigger rollback and return failure summary.
 *
 * Returns the updated session and the recovery result.
 * Pure function over session state; side effects (rollback) use executeRollback separately.
 */
export function handleTaskFailure(
  session: RecoverySession,
  taskId: string,
  taskTitle: string,
  error: string,
): { session: RecoverySession; recovery: RecoveryResult } {
  // Count prior attempts for this task
  const priorAttempts = session.failures.filter(f => f.taskId === taskId).length
  const attemptNumber = priorAttempts
  const strategy = selectNextStrategy(attemptNumber) ?? 'skip'

  const newFailure: TaskFailure = {
    taskId,
    taskTitle,
    strategy,
    attemptNumber,
    error,
  }

  const updatedSession: RecoverySession = {
    ...session,
    failures: [...session.failures, newFailure],
  }

  // Check if we've exhausted all 3 strategies for this task
  const taskAttempts = updatedSession.failures.filter(f => f.taskId === taskId).length
  if (taskAttempts >= 3) {
    const failureSummary = buildFailureSummary(updatedSession.failures)
    return {
      session: updatedSession,
      recovery: {
        recovered: false,
        failureSummary,
        rolledBack: true,
      },
    }
  }

  // Detect stuck loop — if same error repeating, advance strategy
  const stuck = isStuckLoop(updatedSession.failures, taskId)
  const nextAttemptNumber = stuck ? taskAttempts + 1 : taskAttempts
  const nextStrategy = selectNextStrategy(nextAttemptNumber)

  if (!nextStrategy) {
    const failureSummary = buildFailureSummary(updatedSession.failures)
    return {
      session: updatedSession,
      recovery: {
        recovered: false,
        failureSummary,
        rolledBack: true,
      },
    }
  }

  return {
    session: updatedSession,
    recovery: {
      recovered: true,
      nextStrategy,
    },
  }
}
