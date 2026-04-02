// Contracts barrel — single entry point for all contract types
// External code only imports from this file, never from internal files.

export type {
  TaskDispatchPayload, TaskResult, ConstitutionPrinciple, ConstitutionViolation, EnforcementResult,
  // Fase 0
  GoalAncestry, ActionPatternType, ActionPattern, RoleBoundary, RoleBoundaryViolation,
  HandoffPacket, HandoffValidation, ArtifactType, ArtifactChangeEntry,
  LedgerCategory, LedgerEntry,
  // Fase 1
  VerificationClaim, VerificationEvidence,
  DebugPhase, Hypothesis, DebugSession,
  BuildStatus, BuildCheckpoint, BuildState,
  DispatchActionType, DispatchAction, DispatchContext,
  MetricsPhase, UnitMetrics, MetricsLedger,
  QualityDimension, RequirementCheckItem, RequirementChecklist,
  DistillateConfig, DistillateResult,
  CompressionAction, CompressionRule,
  // Fase 2
  TddPhase, TddCycleState, TestRunResult,
  PredictedIssue, SelfCritiqueReport,
  AdversarialReviewConfig, AdversarialReviewResult, AdversarialFinding,
  EdgeCaseFinding, EdgeCaseHuntResult,
  TracedToolCall, ExecutionTrace, RecoveryBriefing,
  ApprovalType, ApprovalStatus, ApprovalRequest,
  TechnicalUnknown, ResearchFinding, ResearchPhaseState,
  ExperimentResult, ExperimentLoopState,
  ConstitutionVersion, ConstitutionVersionChange, SyncImpactReport,
  DispatchGuardResult,
  // Fase 3
  ReviewIssue, ReviewStage, TwoStageReviewResult,
  ConsistencyCategory, ConsistencyFinding, ConsistencyReport,
  QualityGateMode, QualityGateResult,
  ReadinessVerdict, ReadinessStep, ReadinessAssessment,
  ReassessmentTrigger, PlanChange, ReassessmentResult,
  VerificationLevel, MustHave,
  OutputClaim, FaithfulnessResult,
  SimplicityCheck, ParallelizationAnalysis,
  // Fase 4
  MemoryTemperature, ScoredMemoryEntry,
  Gotcha,
  CompactionConfig, CompactionResult,
  ComplexityTier, RoutingDecision,
  HeartbeatConfig, HeartbeatRun,
  ActivityDetectionResult,
  RetrievalPipeline, RetrievalRoute,
  UsageInsight,
} from './task.js'
export type { SquadManifest, SquadHook, SquadHookPoint, AgentDefinition, AutomationLevel, BundleDisclaimer, DomainType } from './squad.js'
export type { ModelProfile, FailoverChain, PhaseModelConfig, OperationModelConfig } from './profile.js'
export type {
  BudgetConfig, BudgetGuardResult, BudgetCheckInput,
  BudgetScopeType, BudgetWindowKind, BudgetStatusLevel,
  BudgetPolicy, BudgetPolicyStatus, BudgetIncident,
} from './budget.js'
export type { OptimizationTarget } from './experiment.js'
export type {
  AmbiguityCategory, ClarificationMarker, ClarificationSession,
} from './clarify.js'
export type { I18nResolver, SupportedLanguage } from './i18n.js'
export type { SubagentProvider } from './provider.js'
export type { CrossSquadMessage, HandoffPayload, ContextBoundary, RoutingRule } from './cross-squad.js'
export { validateMessage } from './cross-squad.js'
export type { CliError, Result, ErrorCode } from './errors.js'
export { ok, err, ERROR_CODES } from './errors.js'
