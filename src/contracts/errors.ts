// CliError — canonical error type for all business logic
// Contracts are stubs in Alpha — shapes stable from commit one

/**
 * Canonical error type — used as E in Result<T, E>.
 * Business logic NEVER throws; it returns Result<T, CliError>.
 * Only programming errors (invariant violations) use throw.
 */
export interface CliError {
  /** SCREAMING_SNAKE_CASE error code: 'SQUAD_NOT_FOUND' */
  code: string
  /** dot-notation i18n key: 'error.squad.not_found' */
  i18nKey: string
  /** Interpolation params for the i18n message */
  params?: Record<string, string>
  /** Release phase when this will be implemented: 'v1.0' for stubs */
  phase?: string
  /** Original underlying error if wrapping */
  cause?: unknown
}

/**
 * Result type — all fallible business functions return this.
 * Never throw for business logic errors.
 */
export type Result<T, E = CliError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/** Convenience constructor for success */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

/** Convenience constructor for failure */
export function err<T = never>(error: CliError): Result<T> {
  return { ok: false, error }
}

/** Predefined error codes */
export const ERROR_CODES = {
  SQUAD_NOT_FOUND: 'SQUAD_NOT_FOUND',
  SQUAD_VALIDATION_FAILED: 'SQUAD_VALIDATION_FAILED',
  IDE_CONFIG_FAILED: 'IDE_CONFIG_FAILED',
  REMOTE_FETCH_FAILED: 'REMOTE_FETCH_FAILED',
  CONFIG_INVALID: 'CONFIG_INVALID',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  FILE_WRITE_FAILED: 'FILE_WRITE_FAILED',
  FILE_READ_FAILED: 'FILE_READ_FAILED',
  ORCHESTRATOR_TOO_LONG: 'ORCHESTRATOR_TOO_LONG',
  MISSING_ORCHESTRATOR_HEADER: 'MISSING_ORCHESTRATOR_HEADER',
  MISSING_IMPLEMENTATION_NOTES: 'MISSING_IMPLEMENTATION_NOTES',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  CONSTITUTION_NOT_FOUND: 'CONSTITUTION_NOT_FOUND',
  CONSTITUTION_EMPTY: 'CONSTITUTION_EMPTY',
  CONSTITUTION_VIOLATION: 'CONSTITUTION_VIOLATION',
  FAILOVER_EXHAUSTED: 'FAILOVER_EXHAUSTED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  SPEC_NOT_FOUND: 'SPEC_NOT_FOUND',
  SQUAD_INVALID_NAME: 'SQUAD_INVALID_NAME',
  AGENT_LEVEL_STORE_FAILED: 'AGENT_LEVEL_STORE_FAILED',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
