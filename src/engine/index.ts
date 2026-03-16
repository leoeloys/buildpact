/**
 * Pipeline Engine — subagent isolation, orchestrator validation, and wave execution.
 * All heavy computation is dispatched through this module to ensure clean context windows.
 * @module engine
 * @see FR-301 — Orchestrator size limits
 * @see FR-302 — Subagent Isolation with Mandatory Session Reset
 */

export { buildTaskPayload, validatePayloadSize, serializePayload } from './subagent.js'
export { loadOrchestratorTemplate, validateOrchestratorFile } from './orchestrator.js'
export { executeWave } from './wave-executor.js'
export {
  mapAcsToWave,
  verifyWaveAcs,
  formatWaveVerificationReport,
  buildWaveFixPlan,
} from './wave-verifier.js'
export {
  selectNextStrategy,
  isStuckLoop,
  buildFailureSummary,
  handleTaskFailure,
  createRecoverySession,
  executeRollback,
} from './recovery.js'
export {
  checkBudget,
  readBudgetConfig,
  readDailySpend,
  updateDailySpend,
  writeBudgetLimit,
  formatCostSummary,
  STUB_COST_PER_TASK_USD,
} from './budget-guard.js'
export { inferCommitType, formatCommitMessage, runAtomicCommit } from './atomic-commit.js'
