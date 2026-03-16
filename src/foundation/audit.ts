import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Outcome of an audited operation */
export type AuditOutcome = 'success' | 'failure' | 'rollback'

/** Mandatory fields for every audit log entry */
export interface AuditEntry {
  /** ISO 8601 timestamp */
  ts: string
  /** module.operation format: 'install.start' */
  action: string
  /** Agent or module that performed the action */
  agent: string
  /** Files created/modified/deleted by this action */
  files: string[]
  /** Result of the operation */
  outcome: AuditOutcome
  /** Error message if outcome is failure */
  error?: string
  /** Estimated cost in USD (if applicable) */
  cost_usd?: number
  /** Token usage (if applicable) */
  tokens?: number
}

/** Payload for logging — ts is auto-generated */
export type AuditLogPayload = Omit<AuditEntry, 'ts'>

/**
 * Append-only JSON Lines audit logger.
 * Every operation is logged before and after execution (NFR-23).
 * Creates parent directories automatically.
 */
export class AuditLogger {
  constructor(private readonly logPath: string) {}

  /**
   * Append a single JSON Lines entry to the audit log.
   * Creates parent directories if they do not exist.
   */
  async log(payload: AuditLogPayload): Promise<void> {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      ...payload,
    }
    const line = JSON.stringify(entry) + '\n'
    await mkdir(dirname(this.logPath), { recursive: true })
    await appendFile(this.logPath, line, 'utf-8')
  }
}
