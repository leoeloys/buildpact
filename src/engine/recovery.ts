/**
 * Session recovery — crash recovery with automatic retry.
 * @module engine/recovery
 * @see FR-703 — Recovery System (v1.0)
 */

import type { Result } from '../contracts/errors.js'
import { ERROR_CODES } from '../contracts/errors.js'

/**
 * Recovers an interrupted session from the last checkpoint.
 * @stub Deferred to v1.0 — FR-703
 */
export function recoverSession(_sessionId: string): Result<void> {
  // TODO: implement in v1.0 — FR-703 crash recovery with automatic retry
  return { ok: false, error: { code: ERROR_CODES.NOT_IMPLEMENTED, i18nKey: 'error.stub.not_implemented', phase: 'v1.0' } }
}
