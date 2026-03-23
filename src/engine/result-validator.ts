/**
 * Result validator — validates TaskResult from subagent dispatch.
 * Catches cases where the API returns 200 OK but content is invalid.
 * @module engine/result-validator
 * @see FR-703 — Result Validation (Epic 13)
 */

import type { TaskResult, TaskDispatchPayload } from '../contracts/task.js'
import type { Result } from '../contracts/errors.js'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Result validation
// ---------------------------------------------------------------------------

/**
 * Validate a TaskResult against expected requirements.
 * Checks: success flag, non-empty response content, artifacts array presence.
 * Returns the validated result on success, or a descriptive error on failure.
 * Pure function — no side effects.
 */
export function validateTaskResult(
  result: TaskResult,
  taskTitle: string,
): Result<TaskResult> {
  if (!result.success) {
    return err({
      code: ERROR_CODES.TASK_RESULT_INVALID,
      i18nKey: 'error.execute.task_result_invalid',
      params: {
        title: taskTitle,
        reason: result.error ?? 'Task returned failure status',
      },
    })
  }

  if (result.response !== undefined && result.response.trim().length === 0) {
    return err({
      code: ERROR_CODES.TASK_RESULT_INVALID,
      i18nKey: 'error.execute.task_result_invalid',
      params: {
        title: taskTitle,
        reason: 'Task returned empty response content',
      },
    })
  }

  return ok(result)
}

// ---------------------------------------------------------------------------
// Payload simplification for recovery
// ---------------------------------------------------------------------------

/**
 * Simplify a TaskDispatchPayload for the "simplify" recovery strategy.
 * Removes optional context and adds a simplification prefix to the content.
 * Pure function — no side effects.
 */
export function simplifyPayload(payload: TaskDispatchPayload): TaskDispatchPayload {
  const simplified: TaskDispatchPayload = {
    taskId: payload.taskId,
    type: payload.type,
    content: `SIMPLIFICATION MODE: Produce a minimal, working implementation. Focus on core functionality only.\n\n${payload.content}`,
    ...(payload.budgetUsd !== undefined && { budgetUsd: payload.budgetUsd }),
    ...(payload.constitutionPath !== undefined && { constitutionPath: payload.constitutionPath }),
  }

  // Intentionally omit context to reduce complexity
  return simplified
}
