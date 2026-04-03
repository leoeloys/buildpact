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

// Directory Map — per-directory MAP.md index (concept 16.6+)
export {
  refreshBuildpactMaps,
  generateMapsRecursive,
} from './directory-map.js'

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

// ── Fase 2: Enforcement ───────────────────────────────────────────────────

// TDD Enforcer (concept 3.3)
export {
  createTddCycle,
  isExemptFromTdd,
  isTestFile,
  recordFileModification,
  recordTestRun,
  advanceTddPhase,
  detectTddAntipatterns,
} from './tdd-enforcer.js'

// Spec-First Gate (concept 3.7)
export {
  requireApprovedSpec,
  specExists,
  hasApprovalMarker,
  countClarificationMarkers,
  createSpecBypass,
} from './spec-first-gate.js'

// Self-Critique (concept 8.1)
export {
  createSelfCritiqueReport,
  createSkippedReport,
  isVagueDescription,
  validateSelfCritique,
  requireSelfCritique,
} from './self-critique.js'

// Adversarial Review (concept 10.2)
export {
  createReviewConfig,
  createFinding as createAdversarialFinding,
  createReviewResult,
  validateReviewResult,
  summarizeFindings,
  formatFindings as formatAdversarialFindings,
} from './adversarial-review.js'

// Edge Case Hunter (concept 10.3)
export {
  createFinding as createEdgeCaseFinding,
  createHuntResult,
  countBySeverity,
  filterBySeverity,
  formatFindings as formatEdgeCaseFindings,
  EDGE_CASE_CATEGORIES,
} from './edge-case-hunter.js'

// Session Forensics (concept 12.2)
export {
  createEmptyTrace,
  addToolCall,
  reconstructTrace,
  generateRecoveryBriefing,
  buildRecoveryFromAudit,
} from './session-forensics.js'

// Experiment Loop (concept 4.1)
export {
  createExperimentLoop,
  setBaseline,
  requireBaseline,
  recordExperiment,
  shouldKeep,
  bestExperiment,
  experimentCount,
  detectPlateau,
} from './experiment-loop.js'

// Research Phase (concept 6.4)
export {
  createResearchPhase,
  addUnknown,
  addFinding as addResearchFinding,
  getBlockingUnresolved,
  getUnresolvedCount as getResearchUnresolvedCount,
  canProceedToPlan as researchCanProceedToPlan,
  completeResearch,
} from './research-phase.js'

// Dispatch Guard (concept 12.5)
export {
  checkWavePrerequisites,
  checkTaskPrerequisites,
  formatGuardResult,
} from './dispatch-guard.js'

// Approval Gates (concept 14.3)
export {
  createApprovalRequest,
  approveRequest,
  rejectRequest,
  requestRevision,
  requireApproval,
  saveApproval,
  loadApproval,
  getPendingCount,
} from './approval-gates.js'

// Constitution Semantic Versioning (concept 6.5)
export {
  createVersion,
  formatVersion,
  parseVersion,
  classifyChange,
  computeNextVersion,
  generateImpactReport,
  createVersionChange,
  formatImpactReport,
} from './constitution-semantic-versioning.js'

// ── Fase 3: Integration ───────────────────────────────────────────────────

// Two-Stage Review (concept 3.4)
export {
  createSpecComplianceReview,
  createCodeQualityReview,
  runTwoStageReview,
  hasCriticalIssues,
  formatReviewReport,
} from './two-stage-review.js'

// Parallelization Heuristics (concept 3.5)
export {
  analyzeParallelization,
  findSharedOutputFiles,
  findSequentialDeps,
  canRunInParallel,
} from './parallelization-heuristics.js'

// Simplicity Criterion (concept 4.3)
export {
  calculateSimplicity,
  shouldAutoDiscard,
  formatSimplicityReport,
} from './simplicity-criterion.js'

// Fixed-Budget Experiment (concept 4.5)
export {
  createExperimentBudget,
  checkBudget as checkExperimentBudget,
} from './fixed-budget-experiment.js'
export type { ExperimentBudget } from './fixed-budget-experiment.js'

// Consistency Analyzer (concept 6.2)
export {
  createConsistencyFinding,
  analyzeConsistency,
  hasCriticalFindings,
  constitutionViolationsAreCritical,
  formatConsistencyReport,
} from './consistency-analyzer.js'

// Story Slicing (concept 6.6-6.8)
export {
  validateStoryIndependence,
  detectParallelMarkers,
  hasCyclicDependencies,
} from './story-slicing.js'
export type { StorySlice } from './story-slicing.js'

// Quality Gates (concept 8.2 + 20.4)
export {
  runLayer1,
  runLayer2,
  runLayer3,
  requireLayerOrder,
} from './quality-gates.js'

// Readiness Formal (concept 10.4)
export {
  createReadinessAssessment,
  completeStep,
  computeVerdict,
  requireReady,
  formatReadinessReport,
} from './readiness-formal.js'

// Reassessment (concept 12.4)
export {
  createReassessment,
  shouldReassess,
  applyChanges,
  formatReassessmentReport,
} from './reassessment.js'

// Faithfulness Checker (concept 20.1)
export {
  extractClaims,
  checkFaithfulness,
  detectSpeculationMarkers,
  requireFaithfulness,
} from './faithfulness-checker.js'

// ── Fase 4: Polish ────────────────────────────────────────────────────────

// Memory Progressive Retrieval (concept 8.4)
export {
  scoreMemoryEntry,
  classifyTemperature,
  selectForContext,
  pruneStale,
} from './memory-progressive-retrieval.js'

// Gotcha Registry (concept 8.5)
export {
  createGotcha,
  matchGotchas,
  formatGotchaWarning,
  formatGotchasForContext,
} from './gotcha-registry.js'

// Micro-File Architecture (concept 10.7)
export {
  parseStepReference,
  loadStep,
  isStepCompleted,
} from './micro-file-architecture.js'

// Scale-Domain Adaptive (concept 10.8)
export {
  detectComplexity,
  recommendFlow,
  formatRecommendation as formatComplexityRecommendation,
} from './scale-domain-adaptive.js'

// Working Tree Activity (concept 12.6)
export {
  detectActivity,
  shouldExtendTimeout,
} from './working-tree-activity.js'

// Heartbeat Scheduler (concept 14.4)
export {
  createHeartbeatConfig,
  createHeartbeatRun,
  startRun,
  completeRun,
  failRun,
  isRunning,
} from './heartbeat-scheduler.js'

// Company Portability (concept 14.5)
export {
  exportProject,
  importProject,
} from './company-portability.js'

// Context Compactor (concept 18.1)
export {
  compactContext,
  protectHeadTail,
  compressMiddle,
} from './context-compactor.js'

// Smart Routing (concept 18.2)
export {
  assessComplexity,
  selectModel,
  DEFAULT_MODEL_TIERS,
} from './smart-routing.js'

// Session Search (concept 18.3)
export {
  indexSession,
  searchSessions,
  extractSearchTerms,
} from './session-search.js'

// Usage Insights (concept 18.5)
export {
  computeInsights,
  formatInsightsReport,
} from './usage-insights.js'

// Retrieval Router (concept 20.2)
export {
  routeQuery,
  selectPipeline,
} from './retrieval-router.js'

// Composite Memory Scoring (concept 20.3)
export {
  computeCompositeScore,
  consolidateMemories,
  pruneByScore,
} from './composite-memory-scoring.js'

// Conclave Roles (concept 20.7)
export {
  FORMALIZED_ROLES,
  selectRolesForReview,
  formatConclaveVote,
} from './conclave-roles.js'
export type { ConclaveRole } from './conclave-roles.js'
