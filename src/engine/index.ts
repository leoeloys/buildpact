/**
 * Pipeline Engine — subagent isolation, orchestrator validation, and wave execution.
 * All heavy computation is dispatched through this module to ensure clean context windows.
 * @module engine
 * @see FR-301 — Orchestrator size limits
 * @see FR-302 — Subagent Isolation with Mandatory Session Reset
 */

export { buildTaskPayload, validatePayloadSize, serializePayload } from './subagent.js'
export { loadOrchestratorTemplate, validateOrchestratorFile } from './orchestrator.js'
export { executeWave, executeWaves } from './wave-executor.js'
export type { WaveTask, TaskExecutionResult, WaveExecutionResult, WaveExecutionOptions } from './wave-executor.js'
export { createLimiter, withTimeout } from './concurrency.js'
export type { CancellableLimiter } from './concurrency.js'
export { WaveProgressRenderer, formatElapsed } from './progress-renderer.js'
export type { TuiAdapter } from './progress-renderer.js'
export { validateTaskResult, simplifyPayload } from './result-validator.js'
export { estimateExecutionCost, formatCostProjection, calculateProfileComparison, formatExecutionCostSummary, persistToAudit } from './cost-projector.js'
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
export {
  buildFeedbackEntry,
  appendWithFifoCap,
  deriveOutcome,
  formatFeedbackForContext,
  loadFeedbackFile,
  writeFeedbackFile,
  loadRecentFeedbacks,
  captureSessionFeedback,
  FEEDBACK_FIFO_CAP,
  FEEDBACK_RECENT_LIMIT,
} from './session-feedback.js'
export {
  shouldDistill,
  slugifyAc,
  buildRecommendation,
  analyzePatterns,
  buildLessonEntry,
  countTotalSessions,
  distillLessons,
  formatLessonsForContext,
  loadLessonsFile,
  writeLessonsFile,
  captureDistilledLessons,
  LESSONS_DISTILL_THRESHOLD,
  LESSONS_MIN_FAIL_COUNT,
} from './lessons-distiller.js'
export {
  slugifyTitle,
  buildDecisionEntry,
  formatDecisionsForContext,
  writeDecisionFile,
  loadAllDecisions,
  captureDecision,
} from './decisions-log.js'
export {
  inferAgentTier,
  formatRoleName,
  formatAgentIndex,
  createAgentSession,
  getLoadedAgentIds,
  releaseAgent,
  formatLoadedAgentForContext,
  buildAgentIndex,
  loadChiefAgent,
  loadSpecialistAgent,
  loadAndRegisterAgent,
  listAvailableAgents,
  MAX_INDEX_BYTES,
} from './lazy-agent-loader.js'
export {
  isRegistryName,
  buildSquadFileUrl,
  buildValidationBadge,
  formatRegistryIndex,
  parseSquadManifest,
  fetchSquadManifest,
  downloadManifestFiles,
  downloadSquadFromHub,
  REGISTRY_BASE_URL,
  SQUAD_MANIFEST_FILE,
} from './community-hub.js'
export {
  notifyStageCompletion,
  readNotificationConfig,
  buildWebhookPayload,
  sendWithRetry,
} from './webhook-notifier.js'
export type {
  WebhookEvent,
  WebhookStatus,
  WebhookPayload,
  NotificationConfig,
} from './webhook-notifier.js'

// ── Fase 0: Multi-Agent Orchestration ──────────────────────────────────────

// Role Boundary (concept 16.1)
export {
  ORCHESTRATOR_BOUNDARY,
  DEVELOPER_BOUNDARY,
  REVIEWER_BOUNDARY,
  BUILT_IN_BOUNDARIES,
  matchesPattern,
  checkRoleBoundary,
  getBoundaryForRole,
  createViolationRecord,
} from './role-boundary.js'
export type { AgentAction } from './role-boundary.js'

// Handoff Protocol (concept 16.2)
export {
  createHandoffPacket,
  validateHandoffPacket,
  requireValidHandoff,
  formatHandoffBriefing,
  resetHandoffCounter,
} from './handoff-protocol.js'
export type { CreateHandoffOptions } from './handoff-protocol.js'

// Stateless Orchestrator (concept 16.3)
export {
  readPipelineState,
  writePipelineState,
  parseStateContent,
  formatStateContent,
  orchestratorCycle,
} from './stateless-orchestrator.js'
export type { PipelineState, CycleOutcome } from './stateless-orchestrator.js'

// Artifact Changelog (concept 16.5)
export {
  detectArtifactType,
  isOfficialArtifact,
  createChangeEntry,
  validateChangeEntry,
  appendToChangelog,
  formatChangeEntry,
  resetChangeCounter,
} from './artifact-changelog.js'

// Project Ledger (concept 16.6)
export {
  formatLedgerEntry,
  appendToLedger,
  parseLedgerEntries,
  readLedger,
  generateMapContent,
  initializeLedger,
  registerEvent,
} from './project-ledger.js'

// Orchestration Rules (Fase 0 constitution — programmatic enforcement)
export {
  checkR1RoleBoundary,
  checkR2HandoffCompleteness,
  checkR3GoalAncestry,
  checkR4ArtifactAccountability,
  checkR5ContextPollution,
  checkR6NoSelfDispatch,
  enforceOrchestrationRules,
  formatRuleViolations,
  MAX_STATE_LINES as RULE_MAX_STATE_LINES,
  MAX_BRIEFING_BYTES as RULE_MAX_BRIEFING_BYTES,
} from './orchestration-rules.js'
export type {
  OrchestrationRuleId,
  RuleViolation,
  RuleCheckResult,
  DispatchRuleContext,
} from './orchestration-rules.js'

// Integrated Dispatch Pipeline (Fase 0 integration)
export {
  dispatchWithSafetyChecks,
  recordArtifactChange,
} from './dispatch-pipeline.js'
export type { DispatchRequest, DispatchResult } from './dispatch-pipeline.js'

// ── Fase 1: Foundations ────────────────────────────────────────────────────

// Verification Gate (concept 3.1)
export {
  createVerificationEvidence,
  isEvidenceStale,
  validateEvidence,
  detectRedFlags,
  requireVerificationForClaim,
  DEFAULT_MAX_AGE_MS,
  MAX_OUTPUT_LENGTH,
  RED_FLAG_PATTERNS,
} from './verification-gate.js'

// Debug Protocol (concept 3.2)
export {
  createDebugSession,
  addEvidence as addDebugEvidence,
  addHypothesis,
  testHypothesis,
  recordFixAttempt,
  advancePhase,
  checkFixLimit,
  formatDebugBriefing,
  DEFAULT_MAX_FIX_ATTEMPTS,
} from './debug-protocol.js'

// Clarify Engine (concept 6.1)
export {
  createClarificationSession,
  addMarker,
  resolveMarker,
  completeRound,
  getUnresolvedCount,
  getUnresolvedMarkers,
  canProceedToPlan,
  formatMarkersForSpec,
  formatClarificationReport,
  resetMarkerCounter,
  AMBIGUITY_CATEGORIES,
  DEFAULT_MAX_UNRESOLVED,
} from './clarify-engine.js'

// Requirement Quality (concept 6.3)
export {
  createChecklist,
  createCheckItem,
  evaluateItem,
  calculateTraceability,
  calculatePassRate,
  checkQualityThreshold,
  resetCheckCounter,
  QUALITY_DIMENSIONS,
  DEFAULT_MIN_PASS_RATE,
  DEFAULT_MIN_TRACEABILITY,
} from './requirement-quality.js'

// Build Checkpoint (concept 8.3)
export {
  createBuildState,
  addCheckpoint,
  setCurrentTask,
  updateStatus as updateBuildStatus,
  resumeFromCheckpoint,
  detectAbandoned,
  saveBuildState,
  loadBuildState,
  DEFAULT_ABANDON_THRESHOLD_MS,
} from './build-checkpoint.js'

// Distillator (concept 10.1)
export {
  estimateTokens,
  extractHeadings,
  extractNamedEntities,
  applyRule as applyCompressionRule,
  applyCompressionRules,
  validateRoundTrip,
  distill,
} from './distillator.js'

// Dispatch Table (concept 12.1)
export {
  createDispatchRule,
  evaluateRules,
  formatRulesTable,
  DEFAULT_DISPATCH_RULES,
  RULE_ALL_TASKS_DONE,
  RULE_WAVE_COMPLETE,
  RULE_TASK_FAILED_3X,
  RULE_BUDGET_EXCEEDED,
  RULE_PAUSED,
  RULE_DISPATCH_NEXT,
} from './dispatch-table.js'
export type { DispatchRule } from './dispatch-table.js'

// Metrics Ledger (concept 12.3)
export {
  createMetricsLedger,
  createUnitMetrics,
  recordUnit,
  totalCostByPhase,
  totalCost as totalMetricsCost,
  averageCostPerTask,
  projectedTotalCost,
  costBurnRate,
  totalTokens,
  loadMetricsLedger,
  saveMetricsLedger,
} from './metrics-ledger.js'

// Budget Policies (concept 14.2)
export {
  createPolicy,
  checkPolicyStatus,
  findApplicablePolicy,
  createIncident,
  resolveIncident as resolveBudgetIncident,
  loadPolicies,
  savePolicies,
  recordIncident,
  DEFAULT_WARN_PERCENT,
} from './budget-policies.js'
