/** Status of a single health check */
export type CheckStatus = 'pass' | 'warn' | 'fail'

/** Result of a single health check */
export interface CheckResult {
  /** Check outcome */
  status: CheckStatus
  /** Human-readable message describing the result */
  message: string
  /** Actionable fix when status is warn or fail */
  remediation?: string
}
