// Foundation module — public API (named exports only)
export { AuditLogger } from './audit.js'
export type { AuditEntry, AuditLogPayload, AuditOutcome } from './audit.js'
export { createI18n } from './i18n.js'
export { install } from './installer.js'
export type { InstallOptions, InstallResult, IdeId } from './installer.js'
export { checkContextAlert, getContextUsage, getCostState, CONTEXT_WARNING_THRESHOLD, CONTEXT_CRITICAL_THRESHOLD } from './monitor.js'
export type { AlertLevel, MonitorState, CostState } from './monitor.js'
export { countLines, shouldShard, slugify, splitIntoSections, buildShardManifest, writeShards, SHARD_LINE_THRESHOLD } from './sharding.js'
export type { ShardSection, ShardManifest } from './sharding.js'
export { appendDecision } from './decisions.js'
export type { DecisionEntry } from './decisions.js'
export {
  loadConstitution,
  saveConstitution,
  constitutionExists,
  resolveConstitutionPath,
  parseConstitutionPrinciples,
  checkModificationAttempt,
  enforceConstitution,
  formatViolationWarning,
  PROHIBITION_KEYWORDS,
  extractProhibitedTerm,
} from './constitution.js'
export { readExperienceLevel } from './context.js'
export { checkProjectVersion, readProjectSchema, CURRENT_SCHEMA_VERSION } from './version-guard.js'
export { runMigrations, listPendingMigrations } from './migrator.js'
export { scanProject, formatScanSummary } from './scanner.js'
export type { ScanResult } from './scanner.js'
export { adopt } from './adopter.js'
export type { AdoptOptions, AdoptResult } from './adopter.js'
export { diagnoseProject, formatDiagnosticReport } from './diagnostician.js'
export type { DiagnosticReport, FoundDocument, PhaseProgress, CodeMetrics, QualitySignal, RequirementStatus } from './diagnostician.js'
export { loadProfile, resolveModelForPhase, resolveModelForOperation, executeWithFailover } from './profile.js'
export {
  estimateTokens,
  PLATFORM_LIMITS,
  checkTokenBudget,
  assembleBundle,
  compressConstitution,
  filterActiveAgents,
  applyStandardCompression,
} from './bundle.js'
export type { TokenBudgetResult, BundlePart, AgentFile, BundlePartMap, CompressedBundle } from './bundle.js'
export {
  getPerformanceMode,
  formatPerformanceMode,
  getAvailableModes,
  PERFORMANCE_MODES,
} from './performance-mode.js'
export type { PerformanceMode, PerformanceModeConfig } from './performance-mode.js'
export { isCiMode, ciLog, stripCiFlag } from './ci.js'
