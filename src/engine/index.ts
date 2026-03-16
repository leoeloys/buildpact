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
export { recoverSession } from './recovery.js'
export { checkBudget } from './budget-guard.js'
