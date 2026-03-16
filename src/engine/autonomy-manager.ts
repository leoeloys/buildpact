/**
 * Autonomy Manager — Agent Autonomy Leveling System (L1-L4)
 * Tracks agent approval/rejection records and suggests level promotions or demotions.
 * @see FR-851 — Agent Autonomy Leveling (Epic 8.5)
 *
 * Levels:
 *   L1 Observer    — requires user confirmation for all write operations
 *   L2 Contributor — default for most agents; operates with standard oversight
 *   L3 Specialist  — reduced oversight; high-trust domain expert
 *   L4 Autonomous  — full autonomy; reserved for consistently high performers
 *
 * Default assignment:
 *   T1 (Chief), T2 (Specialist), T4 (Reviewer) → L2
 *   T3 (Support) → L1
 *
 * Promotion criteria: >85% approval rate in rolling 7-day window after ≥7 days of records
 * Demotion criteria: >30% rejection rate in rolling 7-day window
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { AutomationLevel } from '../contracts/squad.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROMOTION_APPROVAL_THRESHOLD = 0.85
export const DEMOTION_REJECTION_THRESHOLD = 0.30
export const LEVEL_WINDOW_DAYS = 7
export const MIN_RECORDS_FOR_PROMOTION = 5

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** One approval or rejection event for an agent */
export interface AgentApprovalRecord {
  /** Identifies the agent (e.g. 'software/developer', 'my-squad/pm') */
  agentId: string
  /** Unix epoch milliseconds */
  timestamp: number
  /** true = approved, false = rejected */
  approved: boolean
}

/** Persisted level state for one agent */
export interface AgentLevelState {
  agentId: string
  level: AutomationLevel
  /** Unix epoch milliseconds of last level change */
  updatedAt: number
}

/** Root store written to .buildpact/agent-levels.json */
export interface AgentApprovalStore {
  records: AgentApprovalRecord[]
  levels: AgentLevelState[]
}

/** A suggested level change (promotion or demotion) */
export interface LevelChangeSuggestion {
  agentId: string
  currentLevel: AutomationLevel
  suggestedLevel: AutomationLevel
  /** 'promotion' or 'demotion' */
  direction: 'promotion' | 'demotion'
  /** Approval rate (0-1) or rejection rate (0-1) that triggered this suggestion */
  rate: number
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Get a level one step higher.
 * Returns undefined if already at L4 (no further promotion possible).
 */
export function nextLevel(level: AutomationLevel): AutomationLevel | undefined {
  const map: Partial<Record<AutomationLevel, AutomationLevel>> = {
    L1: 'L2',
    L2: 'L3',
    L3: 'L4',
  }
  return map[level]
}

/**
 * Get a level one step lower.
 * Returns undefined if already at L1 (no further demotion possible).
 */
export function prevLevel(level: AutomationLevel): AutomationLevel | undefined {
  const map: Partial<Record<AutomationLevel, AutomationLevel>> = {
    L2: 'L1',
    L3: 'L2',
    L4: 'L3',
  }
  return map[level]
}

/**
 * Filter records to the rolling window (last N days from now).
 * Pure function — accepts `nowMs` for testability.
 */
export function filterToWindow(
  records: AgentApprovalRecord[],
  agentId: string,
  windowDays: number,
  nowMs: number = Date.now(),
): AgentApprovalRecord[] {
  const cutoff = nowMs - windowDays * 24 * 60 * 60 * 1000
  return records.filter(r => r.agentId === agentId && r.timestamp >= cutoff)
}

/**
 * Calculate approval rate (0-1) for an agent within the rolling window.
 * Returns 0 if there are no records in the window.
 */
export function calculateApprovalRate(
  records: AgentApprovalRecord[],
  agentId: string,
  windowDays: number = LEVEL_WINDOW_DAYS,
  nowMs: number = Date.now(),
): number {
  const windowRecords = filterToWindow(records, agentId, windowDays, nowMs)
  if (windowRecords.length === 0) return 0
  const approvals = windowRecords.filter(r => r.approved).length
  return approvals / windowRecords.length
}

/**
 * Calculate rejection rate (0-1) for an agent within the rolling window.
 * Returns 0 if there are no records in the window.
 */
export function calculateRejectionRate(
  records: AgentApprovalRecord[],
  agentId: string,
  windowDays: number = LEVEL_WINDOW_DAYS,
  nowMs: number = Date.now(),
): number {
  const windowRecords = filterToWindow(records, agentId, windowDays, nowMs)
  if (windowRecords.length === 0) return 0
  const rejections = windowRecords.filter(r => !r.approved).length
  return rejections / windowRecords.length
}

/**
 * Get the current level for an agent from the store.
 * Falls back to `defaultLevel` (L2) when not found.
 */
export function getAgentLevel(
  agentId: string,
  store: AgentApprovalStore,
  defaultLevel: AutomationLevel = 'L2',
): AutomationLevel {
  const state = store.levels.find(s => s.agentId === agentId)
  return state?.level ?? defaultLevel
}

/**
 * Set the level for an agent in the store (returns a new store — pure function).
 */
export function setAgentLevel(
  agentId: string,
  level: AutomationLevel,
  store: AgentApprovalStore,
  nowMs: number = Date.now(),
): AgentApprovalStore {
  const existing = store.levels.find(s => s.agentId === agentId)
  const updatedLevels = existing
    ? store.levels.map(s => s.agentId === agentId ? { ...s, level, updatedAt: nowMs } : s)
    : [...store.levels, { agentId, level, updatedAt: nowMs }]
  return { ...store, levels: updatedLevels }
}

/**
 * Whether the agent's current level requires user confirmation before write operations.
 * L1 (Observer) is the only level that requires confirmation.
 */
export function requiresWriteConfirmation(level: AutomationLevel): boolean {
  return level === 'L1'
}

/**
 * Check whether an agent qualifies for promotion.
 * Criteria: ≥ MIN_RECORDS_FOR_PROMOTION records in window AND approval rate > PROMOTION_APPROVAL_THRESHOLD.
 * Returns a suggestion or undefined.
 */
export function checkPromotion(
  agentId: string,
  store: AgentApprovalStore,
  nowMs: number = Date.now(),
): LevelChangeSuggestion | undefined {
  const currentLevel = getAgentLevel(agentId, store)
  const promoted = nextLevel(currentLevel)
  if (!promoted) return undefined // already at L4

  const windowRecords = filterToWindow(store.records, agentId, LEVEL_WINDOW_DAYS, nowMs)
  if (windowRecords.length < MIN_RECORDS_FOR_PROMOTION) return undefined

  const approvalRate = calculateApprovalRate(store.records, agentId, LEVEL_WINDOW_DAYS, nowMs)
  if (approvalRate <= PROMOTION_APPROVAL_THRESHOLD) return undefined

  return { agentId, currentLevel, suggestedLevel: promoted, direction: 'promotion', rate: approvalRate }
}

/**
 * Check whether an agent should be demoted.
 * Criteria: rejection rate > DEMOTION_REJECTION_THRESHOLD in rolling window.
 * Returns a suggestion or undefined.
 */
export function checkDemotion(
  agentId: string,
  store: AgentApprovalStore,
  nowMs: number = Date.now(),
): LevelChangeSuggestion | undefined {
  const currentLevel = getAgentLevel(agentId, store)
  const demoted = prevLevel(currentLevel)
  if (!demoted) return undefined // already at L1

  const windowRecords = filterToWindow(store.records, agentId, LEVEL_WINDOW_DAYS, nowMs)
  if (windowRecords.length === 0) return undefined

  const rejectionRate = calculateRejectionRate(store.records, agentId, LEVEL_WINDOW_DAYS, nowMs)
  if (rejectionRate <= DEMOTION_REJECTION_THRESHOLD) return undefined

  return { agentId, currentLevel, suggestedLevel: demoted, direction: 'demotion', rate: rejectionRate }
}

/**
 * Scan all known agents in the store and return all pending suggestions.
 */
export function scanAgentSuggestions(
  store: AgentApprovalStore,
  nowMs: number = Date.now(),
): LevelChangeSuggestion[] {
  // Collect unique agent IDs from records + levels
  const agentIds = new Set([
    ...store.records.map(r => r.agentId),
    ...store.levels.map(s => s.agentId),
  ])
  const suggestions: LevelChangeSuggestion[] = []
  for (const agentId of agentIds) {
    const promotion = checkPromotion(agentId, store, nowMs)
    if (promotion) { suggestions.push(promotion); continue }
    const demotion = checkDemotion(agentId, store, nowMs)
    if (demotion) suggestions.push(demotion)
  }
  return suggestions
}

// ---------------------------------------------------------------------------
// Persistence — async I/O
// ---------------------------------------------------------------------------

const STORE_FILENAME = 'agent-levels.json'

/** Read the approval store from disk. Returns empty store on missing/invalid file. */
export async function readApprovalStore(projectDir: string): Promise<AgentApprovalStore> {
  try {
    const raw = await readFile(join(projectDir, '.buildpact', STORE_FILENAME), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AgentApprovalStore>
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      levels: Array.isArray(parsed.levels) ? parsed.levels : [],
    }
  } catch {
    return { records: [], levels: [] }
  }
}

/** Write the approval store to disk. */
export async function writeApprovalStore(
  store: AgentApprovalStore,
  projectDir: string,
): Promise<Result<void>> {
  try {
    await mkdir(join(projectDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(projectDir, '.buildpact', STORE_FILENAME),
      JSON.stringify(store, null, 2),
      'utf-8',
    )
    return ok(undefined)
  } catch (cause) {
    return err({
      code: 'AGENT_LEVEL_STORE_FAILED',
      i18nKey: 'error.autonomy.store_failed',
      cause,
    })
  }
}

/**
 * Record an approval or rejection event for an agent, persisting to disk.
 * Returns the updated store on success.
 */
export async function recordApproval(
  agentId: string,
  approved: boolean,
  projectDir: string,
  nowMs: number = Date.now(),
): Promise<Result<AgentApprovalStore>> {
  const store = await readApprovalStore(projectDir)
  const newRecord: AgentApprovalRecord = { agentId, timestamp: nowMs, approved }
  const updated: AgentApprovalStore = { ...store, records: [...store.records, newRecord] }
  const writeResult = await writeApprovalStore(updated, projectDir)
  if (!writeResult.ok) return writeResult as Result<AgentApprovalStore>
  return ok(updated)
}

/**
 * Apply a level change suggestion to the store after user confirmation.
 * Persists the updated level to disk.
 */
export async function applyLevelChange(
  suggestion: LevelChangeSuggestion,
  projectDir: string,
  nowMs: number = Date.now(),
): Promise<Result<AgentApprovalStore>> {
  const store = await readApprovalStore(projectDir)
  const updated = setAgentLevel(suggestion.agentId, suggestion.suggestedLevel, store, nowMs)
  const writeResult = await writeApprovalStore(updated, projectDir)
  if (!writeResult.ok) return writeResult as Result<AgentApprovalStore>
  return ok(updated)
}
