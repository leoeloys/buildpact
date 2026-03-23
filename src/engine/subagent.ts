/**
 * Subagent isolation — Task() payload builder and size validator.
 * Ensures every dispatched subagent receives a minimal, clean context payload.
 * @module engine/subagent
 * @see FR-302 — Subagent Isolation with Mandatory Session Reset
 */

import { randomUUID } from 'node:crypto'
import type { TaskDispatchPayload } from '../contracts/task.js'
import { err, ok, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

/** Maximum payload size in bytes (NFR-02: agent payloads ≤ 20KB) */
const MAX_PAYLOAD_BYTES = 20 * 1024 // 20,480 bytes

/** Input parameters for assembling a clean task payload */
interface BuildPayloadParams {
  type: TaskDispatchPayload['type']
  /** Human-readable task summary */
  description?: string
  /** The specific plan or spec content for this subagent — the only required input */
  content: string
  /** Task-specific context (codebase snippets, prior outputs) — keep minimal */
  context?: string
  /** Target output path for generated artifacts */
  outputPath?: string
  /** Budget constraint for this task in USD */
  budgetUsd?: number
  /** Path to .buildpact/constitution.md if it exists (FR-202). Omit if constitution not yet created. */
  constitutionPath?: string
  /** Path to .buildpact/project-context.md if it exists */
  projectContextPath?: string
  /** Path to active squad agent definition file */
  squadAgentPath?: string
  /** Active model profile tier */
  modelProfile?: string
  /** Remaining session budget in USD */
  budgetRemainingUsd?: number
  /** Atomic commit message format template */
  commitFormat?: string
  /** Override taskId instead of generating UUID (for deterministic IDs) */
  taskId?: string
}

/**
 * Assembles a minimal TaskDispatchPayload for subagent dispatch.
 * Generates a unique taskId automatically — callers do not supply it.
 * Include only what the subagent strictly needs; omit optional fields unless required.
 */
export function buildTaskPayload(params: BuildPayloadParams): TaskDispatchPayload {
  const payload: TaskDispatchPayload = {
    taskId: params.taskId ?? randomUUID(),
    type: params.type,
    content: params.content,
  }

  if (params.description !== undefined) payload.description = params.description
  if (params.context !== undefined) payload.context = params.context
  if (params.outputPath !== undefined) payload.outputPath = params.outputPath
  if (params.budgetUsd !== undefined) payload.budgetUsd = params.budgetUsd
  if (params.constitutionPath !== undefined) payload.constitutionPath = params.constitutionPath
  if (params.projectContextPath !== undefined) payload.projectContextPath = params.projectContextPath
  if (params.squadAgentPath !== undefined) payload.squadAgentPath = params.squadAgentPath
  if (params.modelProfile !== undefined) payload.modelProfile = params.modelProfile
  if (params.budgetRemainingUsd !== undefined) payload.budgetRemainingUsd = params.budgetRemainingUsd
  if (params.commitFormat !== undefined) payload.commitFormat = params.commitFormat

  return payload
}

/**
 * Format a deterministic task ID from phase, plan index, and task sequence.
 * Returns `task-{phase}-{planIndex}-{taskSequence}` with zero-padded numbers.
 * @see FR-302 — Task Dispatch Payload Schema
 */
export function formatTaskId(phase: string, planIndex: number, taskSequence: number): string {
  const pi = String(planIndex).padStart(2, '0')
  const ts = String(taskSequence).padStart(2, '0')
  return `task-${phase}-${pi}-${ts}`
}

/**
 * Serializes a TaskDispatchPayload to the canonical JSON string that would be
 * passed to Task() dispatch. Used for size validation and logging.
 */
export function serializePayload(payload: TaskDispatchPayload): string {
  return JSON.stringify(payload)
}

/**
 * Validates that a task payload does not exceed the 20KB size limit (NFR-02).
 * Uses byte-accurate measurement via Buffer.byteLength — not character count.
 */
export function validatePayloadSize(payload: TaskDispatchPayload): Result<void> {
  const json = serializePayload(payload)
  const bytes = Buffer.byteLength(json, 'utf-8')

  if (bytes > MAX_PAYLOAD_BYTES) {
    return err({
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      i18nKey: 'error.engine.payload_too_large',
      params: { bytes: String(bytes), max: String(MAX_PAYLOAD_BYTES) },
    })
  }

  return ok(undefined)
}
