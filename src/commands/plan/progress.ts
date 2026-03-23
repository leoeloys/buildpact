/**
 * Plan progress persistence — save/load/resume session state.
 * Progress is stored as JSON in .buildpact/plans/<slug>/progress.json.
 * @see FR-505 — Non-Software Domain Planning (AC #5)
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExecutionType } from './tagger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Progress entry for a single task in the plan */
export interface TaskProgressEntry {
  taskId: string
  title: string
  executionType: ExecutionType
  completed: boolean
  completedAt?: string
}

/** Full plan progress state — serialized to progress.json */
export interface PlanProgress {
  slug: string
  generatedAt: string
  tasks: TaskProgressEntry[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load progress from .buildpact/plans/<slug>/progress.json.
 * Returns null if the file does not exist (not an error — means fresh session).
 */
export async function loadProgress(planDir: string): Promise<PlanProgress | null> {
  const progressPath = join(planDir, 'progress.json')
  try {
    const content = await readFile(progressPath, 'utf-8')
    const parsed: unknown = JSON.parse(content)
    if (!isValidProgress(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/** Validate that an unknown value has the PlanProgress shape. */
function isValidProgress(v: unknown): v is PlanProgress {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj.slug !== 'string') return false
  if (typeof obj.generatedAt !== 'string') return false
  if (!Array.isArray(obj.tasks)) return false
  return obj.tasks.every(
    (t: unknown) =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as Record<string, unknown>).taskId === 'string' &&
      typeof (t as Record<string, unknown>).title === 'string' &&
      typeof (t as Record<string, unknown>).completed === 'boolean',
  )
}

/**
 * Save progress to .buildpact/plans/<slug>/progress.json.
 */
export async function saveProgress(planDir: string, progress: PlanProgress): Promise<void> {
  const progressPath = join(planDir, 'progress.json')
  await writeFile(progressPath, JSON.stringify(progress, null, 2), 'utf-8')
}

/**
 * Check if a human step is still pending (not yet completed).
 * Returns true if the task is found in progress and NOT completed.
 * Returns true if the task is NOT found in progress (new task).
 */
export function isHumanStepPending(progress: PlanProgress, taskId: string): boolean {
  const entry = progress.tasks.find(t => t.taskId === taskId)
  if (!entry) return true
  return !entry.completed
}
