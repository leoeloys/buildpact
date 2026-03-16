/**
 * Atomic Git commit utilities — one commit per executed task.
 * Ensures every successful task produces exactly one Git commit with standardized format.
 * @module engine/atomic-commit
 * @see FR-702 — Atomic Git Commits per Task (Epic 6.2)
 */

import { execSync } from 'node:child_process'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Infer conventional commit type from a task title.
 * Maps keywords to standard commit types; defaults to 'feat'.
 * Pure function — no side effects.
 */
export function inferCommitType(description: string): string {
  const lower = description.toLowerCase()
  if (/fix|resolve|correct|repair|revert|bug|hotfix/.test(lower)) return 'fix'
  if (/doc|docs|document|readme/.test(lower)) return 'docs'
  if (/test|spec|coverage/.test(lower)) return 'test'
  if (/refactor|rename|move|extract|clean/.test(lower)) return 'refactor'
  if (/chore|bump|upgrade|update/.test(lower)) return 'chore'
  if (/style|format|prettier/.test(lower)) return 'style'
  return 'feat'
}

/**
 * Format an atomic commit message in the standardized format: `type(phaseSlug): taskTitle`.
 * Matches the convention used by /bp:quick for a consistent Git history.
 * Pure function — no side effects.
 *
 * @example
 *   formatCommitMessage('Implement auth module', 'auth-service') → 'feat(auth-service): Implement auth module'
 *   formatCommitMessage('Fix login redirect', 'auth-service')    → 'fix(auth-service): Fix login redirect'
 */
export function formatCommitMessage(taskTitle: string, phaseSlug: string): string {
  const type = inferCommitType(taskTitle)
  return `${type}(${phaseSlug}): ${taskTitle}`
}

/**
 * Run an atomic Git commit for a completed task.
 * Stages all changed files and creates exactly one commit with the standardized message.
 * Returns the commit message on success, or an error if the git operation fails.
 *
 * NOTE: In Alpha stub execution this function is NOT called directly by executeTaskStub.
 * It is exposed for use by production task runners and integration tests.
 */
export function runAtomicCommit(
  taskTitle: string,
  phaseSlug: string,
  projectDir: string,
): Result<string> {
  const message = formatCommitMessage(taskTitle, phaseSlug)
  try {
    execSync('git add -A', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    execSync(`git commit -m ${JSON.stringify(message)}`, {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return ok(message)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path: 'git', reason },
      cause: e,
    })
  }
}
