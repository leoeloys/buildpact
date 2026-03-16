// Budget Guard Configuration — FR-705
// Contracts are stubs in Alpha — shapes stable from commit one

/** Three-level budget limits (session / phase / day) */
export interface BudgetConfig {
  /** Maximum spend per session in USD */
  sessionLimitUsd: number
  /** Maximum spend per pipeline phase in USD */
  phaseLimitUsd: number
  /** Maximum spend per calendar day in USD */
  dailyLimitUsd: number
  /** Warn at this % of limit (0–1) */
  warningThreshold: number
}

/** Result of a budget guard check */
export interface BudgetGuardResult {
  allowed: boolean
  /** Current spend in USD */
  currentSpendUsd: number
  /** Active limit that was checked in USD */
  limitUsd: number
  /** Type of limit that was hit (if any) */
  limitType?: 'session' | 'phase' | 'daily'
  /** Human-readable message for display */
  message?: string
}
