/**
 * Squads — Squad loading, validation, routing, and plugin hooks.
 * @module squads
 * @see FR-905 Squad validation — structural and security compliance
 * @see FR-901 Squad routing by domain
 * @see FR-906 Lazy loading cap at ≤1KB agent index
 */
export { validateSquad } from './validator.js'
export type { SquadCheckResult, SquadValidationReport, ValidateSquadOptions } from './validator.js'
export { defaultLevelForTier, getAgentLevel, requiresWriteConfirmation, scanAgentSuggestions, recordApproval, applyLevelChange, checkPromotion, checkDemotion, readApprovalStore } from './leveling.js'
export type { AgentApprovalRecord, AgentLevelState, AgentApprovalStore, LevelChangeSuggestion } from './leveling.js'
export { readSquadManifest, buildAgentIndex, loadAgentDefinition } from './loader.js'
export type { AgentFileRef, SquadFileManifest, AgentIndexEntry, AgentIndex } from './loader.js'
export { generateWebBundle, applyDegradationTier, DegradationTier } from './web-bundle.js'
export type { WebBundleOptions, WebBundleResult } from './web-bundle.js'
