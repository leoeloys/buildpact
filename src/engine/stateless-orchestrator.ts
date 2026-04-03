/**
 * Stateless Orchestrator — zero context accumulation between dispatches.
 * Reads state from disk, decides next action, creates handoff, dispatches,
 * reads result from disk, updates state. Never holds execution context in memory.
 * @module engine/stateless-orchestrator
 * @see Original BuildPact concept 16.3
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { HandoffPacket, TaskResult, GoalAncestry, LedgerCategory } from '../contracts/task.js'
import { registerEvent } from './project-ledger.js'
import { refreshBuildpactMaps } from './directory-map.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Compact pipeline state read from STATE.md */
export interface PipelineState {
  /** Current phase: specify | plan | execute | verify | complete */
  phase: string
  /** Current wave number (0-based) within execute phase */
  waveNumber: number
  /** Current task index within wave */
  taskIndex: number
  /** Total tasks in current wave */
  totalTasks: number
  /** Total waves in plan */
  totalWaves: number
  /** Whether the pipeline is paused */
  paused: boolean
  /** Reason for pause (if paused) */
  pauseReason?: string
  /** Last completed task ID */
  lastCompletedTask?: string
  /** Goal ancestry for the current project */
  goalAncestry?: GoalAncestry
}

/** Outcome of one orchestrator cycle */
export interface CycleOutcome {
  /** What was decided */
  action: 'dispatch' | 'complete' | 'paused' | 'error'
  /** Handoff packet created (if dispatch) */
  handoff?: HandoffPacket
  /** Task result read from disk (if complete) */
  result?: TaskResult
  /** Reason (if paused or error) */
  reason?: string
}

// ---------------------------------------------------------------------------
// STATE.md I/O
// ---------------------------------------------------------------------------

const STATE_FILE = join('.buildpact', 'STATE.md')
const MAX_STATE_LINES = 50

/**
 * Read the compact pipeline state from .buildpact/STATE.md.
 * STATE.md is intentionally small (<50 lines) — just enough for decisions.
 */
export async function readPipelineState(projectDir: string): Promise<Result<PipelineState>> {
  const path = join(projectDir, STATE_FILE)
  try {
    const content = await readFile(path, 'utf-8')
    return ok(parseStateContent(content))
  } catch {
    return err({
      code: ERROR_CODES.ORCHESTRATOR_STATE_READ_FAILED,
      i18nKey: 'error.orchestrator.state_read_failed',
      params: { path },
    })
  }
}

/**
 * Write updated pipeline state to STATE.md.
 * Enforces max line count to prevent bloat.
 */
export async function writePipelineState(
  projectDir: string,
  state: PipelineState,
): Promise<Result<void>> {
  const path = join(projectDir, STATE_FILE)
  const content = formatStateContent(state)

  const lineCount = content.split('\n').length
  if (lineCount > MAX_STATE_LINES) {
    return err({
      code: ERROR_CODES.ORCHESTRATOR_CONTEXT_POLLUTION,
      i18nKey: 'error.orchestrator.state_too_large',
      params: { lines: String(lineCount), max: String(MAX_STATE_LINES) },
    })
  }

  await mkdir(join(projectDir, '.buildpact'), { recursive: true })
  try {
    await writeFile(path, content, 'utf-8')
    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path },
    })
  }
}

// ---------------------------------------------------------------------------
// State parsing / formatting
// ---------------------------------------------------------------------------

/**
 * Parse STATE.md content into PipelineState.
 * Format: YAML-like key: value pairs, minimal.
 */
export function parseStateContent(content: string): PipelineState {
  const lines = content.split('\n')
  const state: PipelineState = {
    phase: 'specify',
    waveNumber: 0,
    taskIndex: 0,
    totalTasks: 0,
    totalWaves: 0,
    paused: false,
  }

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (!match) continue
    const [, key, value] = match
    switch (key) {
      case 'phase': state.phase = value!.trim(); break
      case 'wave': state.waveNumber = parseInt(value!, 10) || 0; break
      case 'task': state.taskIndex = parseInt(value!, 10) || 0; break
      case 'totalTasks': state.totalTasks = parseInt(value!, 10) || 0; break
      case 'totalWaves': state.totalWaves = parseInt(value!, 10) || 0; break
      case 'paused': state.paused = value!.trim() === 'true'; break
      case 'pauseReason': state.pauseReason = value!.trim(); break
      case 'lastCompleted': state.lastCompletedTask = value!.trim(); break
      case 'mission': {
        if (!state.goalAncestry) state.goalAncestry = { mission: '', projectGoal: '', phaseGoal: '', taskObjective: '' }
        state.goalAncestry.mission = value!.trim()
        break
      }
      case 'projectGoal': {
        if (!state.goalAncestry) state.goalAncestry = { mission: '', projectGoal: '', phaseGoal: '', taskObjective: '' }
        state.goalAncestry.projectGoal = value!.trim()
        break
      }
    }
  }

  return state
}

/**
 * Format PipelineState as compact STATE.md content.
 */
export function formatStateContent(state: PipelineState): string {
  const lines = [
    '# Pipeline State',
    '',
    `phase: ${state.phase}`,
    `wave: ${state.waveNumber}`,
    `task: ${state.taskIndex}`,
    `totalTasks: ${state.totalTasks}`,
    `totalWaves: ${state.totalWaves}`,
    `paused: ${state.paused}`,
  ]

  if (state.pauseReason) lines.push(`pauseReason: ${state.pauseReason}`)
  if (state.lastCompletedTask) lines.push(`lastCompleted: ${state.lastCompletedTask}`)
  if (state.goalAncestry) {
    lines.push(`mission: ${state.goalAncestry.mission}`)
    lines.push(`projectGoal: ${state.goalAncestry.projectGoal}`)
  }

  lines.push('', `updated: ${new Date().toISOString()}`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Cycle
// ---------------------------------------------------------------------------

/**
 * Execute one stateless orchestrator cycle.
 * 1. Read state from disk
 * 2. Decide next action (caller provides decision logic)
 * 3. Return outcome (caller handles dispatch)
 *
 * The orchestrator itself does NOT dispatch — it returns what to dispatch.
 * This keeps it purely stateless.
 */
export async function orchestratorCycle(
  projectDir: string,
  decide: (state: PipelineState) => CycleOutcome,
): Promise<Result<CycleOutcome>> {
  // 1. Read state from disk
  const stateResult = await readPipelineState(projectDir)
  if (!stateResult.ok) {
    return ok({ action: 'error', reason: 'Failed to read pipeline state' })
  }

  const state = stateResult.value

  // 2. Check if paused
  if (state.paused) {
    return ok({ action: 'paused', reason: state.pauseReason ?? 'Pipeline is paused' })
  }

  // 3. Decide next action (pure function provided by caller)
  const outcome = decide(state)

  // 4. Log the cycle to ledger
  if (outcome.action === 'dispatch' && outcome.handoff) {
    await registerEvent(
      projectDir,
      'HANDOFF',
      outcome.handoff.id,
      `${outcome.handoff.fromAgent} → ${outcome.handoff.toAgent} (${outcome.handoff.taskId})`,
      `.buildpact/handoffs/${outcome.handoff.id}.json`,
    )
  }

  // 5. Refresh per-directory MAP.md indexes (continuous audit)
  await refreshBuildpactMaps(projectDir).catch(() => {})

  return ok(outcome)
}
