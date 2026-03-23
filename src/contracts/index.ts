// Contracts barrel — single entry point for all contract types
// External code only imports from this file, never from internal files.

export type { TaskDispatchPayload, TaskResult, ConstitutionPrinciple, ConstitutionViolation, EnforcementResult } from './task.js'
export type { SquadManifest, SquadHook, SquadHookPoint, AgentDefinition, AutomationLevel, BundleDisclaimer, DomainType } from './squad.js'
export type { ModelProfile, FailoverChain, PhaseModelConfig, OperationModelConfig } from './profile.js'
export type { BudgetConfig, BudgetGuardResult, BudgetCheckInput } from './budget.js'
export type { I18nResolver, SupportedLanguage } from './i18n.js'
export type { SubagentProvider } from './provider.js'
export type { CrossSquadMessage, HandoffPayload, ContextBoundary, RoutingRule } from './cross-squad.js'
export { validateMessage, evaluateRoutingRules, buildDefaultBoundary } from './cross-squad.js'
export type { CliError, Result, ErrorCode } from './errors.js'
export { ok, err, ERROR_CODES } from './errors.js'
