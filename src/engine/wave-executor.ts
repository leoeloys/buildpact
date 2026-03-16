/**
 * Wave executor — parallel subagent dispatch in coordinated waves.
 * @module engine/wave-executor
 * @see FR-701 — Wave Execution (Epic 6)
 */

import type { TaskDispatchPayload } from '../contracts/task.js'
import type { Result } from '../contracts/errors.js'
import { ERROR_CODES } from '../contracts/errors.js'

/**
 * Executes a set of tasks in parallel as a single wave.
 * Each task receives an isolated subagent with clean context.
 * @stub Deferred to Epic 6 — FR-701
 */
export function executeWave(_tasks: TaskDispatchPayload[]): Result<void> {
  // TODO: implement in Epic 6 — FR-701 wave-parallel execution with subagent isolation
  return { ok: false, error: { code: ERROR_CODES.NOT_IMPLEMENTED, i18nKey: 'error.stub.not_implemented', phase: 'Epic 6' } }
}
