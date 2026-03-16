// Contracts barrel — single entry point for all contract types
// External code only imports from this file, never from internal files.

export type { TaskDispatchPayload, TaskResult } from './task.js'
export type { SquadManifest, SquadHook, SquadHookPoint, AgentDefinition, AutomationLevel, BundleDisclaimer } from './squad.js'
export type { ModelProfile, ModelConfig, FailoverChain, ProfileTier } from './profile.js'
export type { BudgetConfig, BudgetGuardResult } from './budget.js'
export type { I18nResolver, SupportedLanguage } from './i18n.js'
export type { CliError, Result, ErrorCode } from './errors.js'
export { ok, err, ERROR_CODES } from './errors.js'
