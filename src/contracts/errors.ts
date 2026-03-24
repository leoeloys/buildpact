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
  AGENT_LOAD_FAILED: 'AGENT_LOAD_FAILED',
  TARGET_TOO_LARGE: 'TARGET_TOO_LARGE',
  EXPERT_ONLY: 'EXPERT_ONLY',
  RATCHET_BRANCH_FAILED: 'RATCHET_BRANCH_FAILED',
  RATCHET_COMMIT_FAILED: 'RATCHET_COMMIT_FAILED',
  RATCHET_REVERT_FAILED: 'RATCHET_REVERT_FAILED',
  TASK_RESULT_INVALID: 'TASK_RESULT_INVALID',
  MISSING_ARG: 'MISSING_ARG',
  CONSTITUTION_MODIFICATION_BLOCKED: 'CONSTITUTION_MODIFICATION_BLOCKED',
  GIT_COMMAND_FAILED: 'GIT_COMMAND_FAILED',
  SCHEMA_INCOMPATIBLE: 'SCHEMA_INCOMPATIBLE',
  CLI_TOO_OLD: 'CLI_TOO_OLD',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  ADOPT_FAILED: 'ADOPT_FAILED',
  ADOPT_SCAN_FAILED: 'ADOPT_SCAN_FAILED',
  HUB_NO_RESULTS: 'HUB_NO_RESULTS',
  HUB_SQUAD_NOT_FOUND: 'HUB_SQUAD_NOT_FOUND',
  READONLY_MODE: 'READONLY_MODE',
  AGENT_ALREADY_RUNNING: 'AGENT_ALREADY_RUNNING',
  AGENT_NOT_RUNNING: 'AGENT_NOT_RUNNING',
  AGENT_STALE_PID: 'AGENT_STALE_PID',
  AGENT_PAUSED: 'AGENT_PAUSED',
  RBAC_CONFIG_INVALID: 'RBAC_CONFIG_INVALID',
  RBAC_DENIED: 'RBAC_DENIED',
  REVIEW_INVALID: 'REVIEW_INVALID',
  REVIEW_SUBMIT_FAILED: 'REVIEW_SUBMIT_FAILED',
  REVIEW_FETCH_FAILED: 'REVIEW_FETCH_FAILED',
  CERTIFICATION_FAILED: 'CERTIFICATION_FAILED',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
