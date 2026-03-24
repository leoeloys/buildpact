/**
 * State Persistence — flat-file JSON with WAL (Write-Ahead Log) pattern.
 * Zero native deps, simple, recoverable. Atomic writes via temp + rename.
 * @module engine/state-persistence
 * @see Epic 22 — Story 22.5
 */

import { writeFile, rename, readFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentState {
  version: 1
  supervisorPid: number
  startedAt: string
  lastCheckpoint: string
  completedTasks: string[]  // task IDs
  pendingTasks: string[]    // task IDs
  currentWave: number
  totalCostUsd: number
  customData: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_FILENAME = 'agent-state.json'

// ---------------------------------------------------------------------------
// checkpoint
// ---------------------------------------------------------------------------

/**
 * Atomically write agent state to disk via temp file + rename (WAL pattern).
 * Ensures that a crash mid-write leaves either the old state or no state,
 * never a partial file.
 */
export async function checkpoint(stateDir: string, state: AgentState): Promise<Result<void>> {
  try {
    const dir = dirname(join(stateDir, STATE_FILENAME))
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    const statePath = join(stateDir, STATE_FILENAME)
    const tmpPath = join(stateDir, `agent-state.${randomUUID()}.tmp`)
    const data = JSON.stringify(state, null, 2)

    // Write to temp file first
    await writeFile(tmpPath, data, 'utf8')
    // Atomic rename
    await rename(tmpPath, statePath)

    return ok(undefined)
  } catch (cause) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.state.checkpoint_failed',
      cause,
    })
  }
}

// ---------------------------------------------------------------------------
// loadState
// ---------------------------------------------------------------------------

/**
 * Load the last checkpoint from disk. Returns null if no state file exists.
 */
export async function loadState(stateDir: string): Promise<Result<AgentState | null>> {
  const statePath = join(stateDir, STATE_FILENAME)

  if (!existsSync(statePath)) {
    return ok(null)
  }

  try {
    const data = await readFile(statePath, 'utf8')
    const state = JSON.parse(data) as AgentState
    return ok(state)
  } catch (cause) {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.state.load_failed',
      cause,
    })
  }
}

// ---------------------------------------------------------------------------
// clearState
// ---------------------------------------------------------------------------

/**
 * Remove the state file. No-op if the file doesn't exist.
 */
export async function clearState(stateDir: string): Promise<Result<void>> {
  const statePath = join(stateDir, STATE_FILENAME)

  if (!existsSync(statePath)) {
    return ok(undefined)
  }

  try {
    await unlink(statePath)
    return ok(undefined)
  } catch (cause) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.state.clear_failed',
      cause,
    })
  }
}
