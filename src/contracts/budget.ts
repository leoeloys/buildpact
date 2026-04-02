// Budget Guard Configuration — FR-705
// Contracts are stubs in Alpha — shapes stable from commit one

/** Three-level budget limits (session / phase / day) */
export interface BudgetConfig {
  /** Maximum spend per session in USD (0 = unlimited) */
  sessionLimitUsd: number
  /** Maximum spend per pipeline phase in USD (0 = unlimited) */
  phaseLimitUsd: number
  /** Maximum spend per calendar day in USD (0 = unlimited) */
  dailyLimitUsd: number
  /** Warn at this % of limit (0–1) */
  warningThreshold: number
}

/** Input to checkBudget — current spend across all three dimensions */
export interface BudgetCheckInput {
  config: BudgetConfig
  /** Spend accumulated this session (current process invocation) */
  sessionSpendUsd: number
  /** Spend accumulated this plan phase */
  phaseSpendUsd: number
  /** Spend accumulated today (from persisted daily tracker) */
  dailySpendUsd: number
}

/** Result of a budget guard check */
export interface BudgetGuardResult {
  allowed: boolean
  /** Current spend in USD (for the limit type that was checked) */
  currentSpendUsd: number
  /** Active limit that was checked in USD */
  limitUsd: number
  /** Type of limit that was hit (if any) */
  limitType?: 'session' | 'phase' | 'daily'
  /** Human-readable message for display */
  message?: string
}

// ---------------------------------------------------------------------------
// Budget Policies — scoped budgets with windows and incidents (Concept 14.2)
// ---------------------------------------------------------------------------

/** Scope level for a budget policy */
export type BudgetScopeType = 'project' | 'squad' | 'agent'

/** Time window for budget tracking */
export type BudgetWindowKind = 'monthly' | 'lifetime'

/** Current status of a budget policy */
export type BudgetStatusLevel = 'ok' | 'warning' | 'hard_stop'

/** A budget policy defining spend limits for a specific scope */
export interface BudgetPolicy {
  /** Unique policy identifier */
  id: string
  /** What level this policy applies to */
  scopeType: BudgetScopeType
  /** Identifier of the scope (project name, squad id, or agent id) */
  scopeId: string
  /** Time window for tracking spend */
  windowKind: BudgetWindowKind
  /** Maximum allowed spend in USD */
  amountUsd: number
  /** Warning threshold as percentage (default: 80) */
  warnPercent: number
  /** Whether this policy is active */
  enabled: boolean
}

/** Current status of a budget policy based on observed spend */
export interface BudgetPolicyStatus {
  /** The policy being checked */
  policy: BudgetPolicy
  /** Observed spend in the current window */
  observed: number
  /** Current status level */
  status: BudgetStatusLevel
  /** Remaining budget in USD */
  remainingUsd: number
}

/** A recorded budget policy violation incident */
export interface BudgetIncident {
  /** Policy that was violated */
  policyId: string
  /** ISO timestamp of when the incident was triggered */
  triggeredAt: string
  /** Observed spend amount at trigger time */
  observedAmount: number
  /** Threshold that was exceeded */
  threshold: number
  /** How the incident was resolved (null = unresolved) */
  resolution: 'acknowledged' | 'increased' | 'paused' | null
}
