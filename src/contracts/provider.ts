// SubagentProvider — abstraction for AI task dispatch (NFR-12: agent-agnostic design)
// Enables swapping between stub, Anthropic, and future providers without changing dispatch logic.

import type { TaskDispatchPayload, TaskResult } from './task.js'

/**
 * Contract for dispatching tasks to AI providers.
 * Each provider implements this interface to handle actual AI model calls.
 * @see FR-302 — Subagent Isolation with Mandatory Session Reset
 * @see NFR-12 — Agent-Agnostic Design
 */
export interface SubagentProvider {
  /** Human-readable provider name for logging and diagnostics */
  readonly name: string
  /** Dispatch a task payload to the provider and await the result */
  dispatch(payload: TaskDispatchPayload): Promise<TaskResult>
}
