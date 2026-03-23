// Model Profile + Failover Chain — FR-604
// Contracts are stable from commit one

/** A failover chain for a pipeline phase */
export interface FailoverChain {
  /** Ordered list: [primary, secondary, tertiary...] */
  models: string[]
  /** Wait between failover attempts in ms */
  retry_delay_ms: number
  /** Total max wait before escalation in ms */
  max_wait_ms: number
}

/** Operation-level model override within a phase */
export interface OperationModelConfig {
  /** e.g. "research", "plan-writing", "validation" */
  operation: string
  /** e.g. "claude-opus-4-6", "claude-sonnet-4-6" */
  model: string
}

/** Configuration for a specific pipeline phase */
export interface PhaseModelConfig {
  primary: string
  failover: FailoverChain
  /** Operation-level overrides within this phase */
  operations?: OperationModelConfig[]
}

/** A named model profile mapping phases to model configs */
export interface ModelProfile {
  name: string
  /** phase name → config. Keys: "research", "plan", "execute", "verify", "specify" */
  phases: Record<string, PhaseModelConfig>
}
