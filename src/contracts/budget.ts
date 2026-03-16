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
