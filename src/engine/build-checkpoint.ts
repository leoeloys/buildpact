/**
 * Build Checkpoint — granular recovery checkpoints for the execution pipeline.
 * Checkpoint saved after each task; resume from last; abandoned detection >1h.
 *
 * @module engine/build-checkpoint
 * @see Concept 8.3 (AIOX build recovery)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { BuildStatus, BuildCheckpoint, BuildState } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default inactivity threshold for abandoned detection (1 hour) */
export const DEFAULT_ABANDON_THRESHOLD_MS = 3_600_000

/** Build state file path within .buildpact/ */
const BUILD_STATE_FILE = 'build-state.json'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new build state for a session.
 */
export function createBuildState(sessionId: string, totalTasks: number): BuildState {
  const now = new Date().toISOString()
  return {
    sessionId,
    status: 'PENDING',
    startedAt: now,
    lastCheckpoint: now,
    currentWave: 0,
    currentTask: '',
    completedTasks: [],
    checkpoints: [],
    metrics: {
      totalTasks,
      completedTasks: 0,
      totalCostUsd: 0,
      elapsedSeconds: 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Checkpoint management
// ---------------------------------------------------------------------------

/**
 * Save a checkpoint after a completed task.
 * Updates state with new checkpoint and recalculates metrics.
 */
export function addCheckpoint(
  state: BuildState,
  taskId: string,
  artifacts: string[],
  costUsd: number,
): BuildState {
  const now = new Date().toISOString()
  const checkpoint: BuildCheckpoint = {
    taskId,
    completedAt: now,
    artifacts,
    costUsd,
  }

  const completedTasks = [...state.completedTasks, taskId]
  const totalCost = state.metrics.totalCostUsd + costUsd
  const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 1000

  return {
    ...state,
    status: 'IN_PROGRESS',
    lastCheckpoint: now,
    completedTasks,
    checkpoints: [...state.checkpoints, checkpoint],
    metrics: {
      ...state.metrics,
      completedTasks: completedTasks.length,
      totalCostUsd: totalCost,
      elapsedSeconds: Math.round(elapsed),
    },
  }
}

/**
 * Update the current wave and task being worked on.
 */
export function setCurrentTask(state: BuildState, wave: number, taskId: string): BuildState {
  return {
    ...state,
    status: 'IN_PROGRESS',
    currentWave: wave,
    currentTask: taskId,
  }
}

/**
 * Update build status.
 */
export function updateStatus(state: BuildState, status: BuildStatus): BuildState {
  return { ...state, status }
}

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

/**
 * Determine resume point from the last checkpoint.
 * Returns the index of the first uncompleted task.
 */
export function resumeFromCheckpoint(state: BuildState): { nextWave: number; nextTaskIndex: number } {
  return {
    nextWave: state.currentWave,
    nextTaskIndex: state.completedTasks.length,
  }
}

// ---------------------------------------------------------------------------
// Abandoned detection
// ---------------------------------------------------------------------------

/**
 * Check if the build has been abandoned (no activity for threshold).
 */
export function detectAbandoned(
  state: BuildState,
  thresholdMs: number = DEFAULT_ABANDON_THRESHOLD_MS,
): boolean {
  if (state.status === 'COMPLETED' || state.status === 'FAILED') return false
  const lastActivity = new Date(state.lastCheckpoint).getTime()
  return (Date.now() - lastActivity) > thresholdMs
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Save build state to .buildpact/build-state.json.
 */
export async function saveBuildState(projectDir: string, state: BuildState): Promise<Result<void>> {
  const dir = join(projectDir, '.buildpact')
  await mkdir(dir, { recursive: true })
  const path = join(dir, BUILD_STATE_FILE)
  try {
    await writeFile(path, JSON.stringify(state, null, 2), 'utf-8')
    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path },
    })
  }
}

/**
 * Load build state from .buildpact/build-state.json.
 */
export async function loadBuildState(projectDir: string): Promise<Result<BuildState>> {
  const path = join(projectDir, '.buildpact', BUILD_STATE_FILE)
  try {
    const content = await readFile(path, 'utf-8')
    const state = JSON.parse(content) as BuildState
    return ok(state)
  } catch {
    return err({
      code: ERROR_CODES.BUILD_CHECKPOINT_CORRUPT,
      i18nKey: 'error.build.checkpoint_corrupt',
      params: { path },
    })
  }
}
