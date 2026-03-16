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
}

/**
 * Assembles a minimal TaskDispatchPayload for subagent dispatch.
 * Generates a unique taskId automatically — callers do not supply it.
 * Include only what the subagent strictly needs; omit optional fields unless required.
 */
export function buildTaskPayload(params: BuildPayloadParams): TaskDispatchPayload {
  const payload: TaskDispatchPayload = {
    taskId: randomUUID(),
    type: params.type,
    content: params.content,
  }

  if (params.context !== undefined) {
    payload.context = params.context
  }
  if (params.outputPath !== undefined) {
    payload.outputPath = params.outputPath
  }
  if (params.budgetUsd !== undefined) {
    payload.budgetUsd = params.budgetUsd
  }
  if (params.constitutionPath !== undefined) {
    payload.constitutionPath = params.constitutionPath
  }

  return payload
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
