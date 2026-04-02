/**
 * Working Tree Activity — detect uncommitted changes in the git working tree.
 * Used by timeout/liveness logic to avoid killing agents mid-work.
 * @module engine/working-tree-activity
 * @see BuildPact concept 12.6
 */

import { execFileSync } from 'node:child_process'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ActivityDetectionResult } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Activity detection
// ---------------------------------------------------------------------------

/**
 * Detect working tree activity by running `git status --porcelain`.
 * Counts modified (M/A/D/R/C) and untracked (??) files separately.
 */
export function detectActivity(projectDir: string): Result<ActivityDetectionResult> {
  let stdout: string
  try {
    stdout = execFileSync('git', ['-C', projectDir, 'status', '--porcelain'], {
      encoding: 'utf-8',
      timeout: 10_000,
    })
  } catch {
    return err({
      code: ERROR_CODES.ACTIVITY_DETECTION_FAILED,
      i18nKey: 'error.activity.detection_failed',
      params: { dir: projectDir },
    })
  }

  const lines = stdout
    .split('\n')
    .filter(line => line.trim().length > 0)

  let modifiedFiles = 0
  let untrackedFiles = 0

  for (const line of lines) {
    if (line.startsWith('??')) {
      untrackedFiles++
    } else {
      modifiedFiles++
    }
  }

  const hasUncommittedChanges = modifiedFiles > 0 || untrackedFiles > 0

  return ok({
    hasUncommittedChanges,
    modifiedFiles,
    untrackedFiles,
    isActive: hasUncommittedChanges,
  })
}

// ---------------------------------------------------------------------------
// Timeout extension
// ---------------------------------------------------------------------------

/**
 * Determine if a timeout should be extended based on working tree activity.
 * Returns true if there are uncommitted changes (agent is likely mid-work).
 */
export function shouldExtendTimeout(activity: ActivityDetectionResult): boolean {
  return activity.hasUncommittedChanges
}
