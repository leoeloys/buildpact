/**
 * StubProvider — Alpha-compatible provider that returns synthetic success.
 * Wraps the existing executeTaskStub behavior behind the SubagentProvider interface.
 * Used when no API key is configured or for testing.
 * @module engine/providers/stub
 */

import type { SubagentProvider } from '../../contracts/provider.js'
import type { TaskDispatchPayload, TaskResult } from '../../contracts/task.js'
import { validatePayloadSize } from '../subagent.js'
import { STUB_COST_PER_TASK_USD } from '../budget-guard.js'

/**
 * Stub provider that returns success without calling any AI model.
 * Validates payload size (NFR-02) and returns a synthetic TaskResult.
 */
export class StubProvider implements SubagentProvider {
  readonly name = 'stub'

  async dispatch(payload: TaskDispatchPayload): Promise<TaskResult> {
    const sizeCheck = validatePayloadSize(payload)

    if (!sizeCheck.ok) {
      return {
        taskId: payload.taskId,
        success: false,
        artifacts: [],
        tokensUsed: 0,
        costUsd: 0,
        error: `Payload too large: ${sizeCheck.error.code}`,
      }
    }

    return {
      taskId: payload.taskId,
      success: true,
      artifacts: [],
      tokensUsed: 0,
      costUsd: STUB_COST_PER_TASK_USD,
    }
  }
}
