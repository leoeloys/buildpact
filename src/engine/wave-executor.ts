/**
 * Wave executor — parallel subagent dispatch in coordinated waves.
 * @module engine/wave-executor
 * @see FR-701 — Wave Execution (Epic 6)
 */

import { randomUUID } from 'node:crypto'
import { buildTaskPayload } from './subagent.js'
import { validatePayloadSize } from './subagent.js'
import type { TaskDispatchPayload, TaskResult } from '../contracts/task.js'
import type { Result } from '../contracts/errors.js'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single task to be dispatched to an isolated subagent */
export interface WaveTask {
  taskId: string
  title: string
  /** Wave number this task belongs to (0-indexed) */
  waveNumber: number
  /** The plan file content relevant to this task — the only input the subagent sees */
  planContent: string
  /** Optional codebase context snippets to include */
  codebaseContext?: string
  /** Optional budget in USD for this task */
  budgetUsd?: number
  /** Optional path to .buildpact/constitution.md */
  constitutionPath?: string
}

/** Result for a single task executed in a wave */
export interface TaskExecutionResult {
  taskId: string
  title: string
  waveNumber: number
  success: boolean
  /** Artifacts generated (file paths) — empty in Alpha stub */
  artifacts: string[]
  /** Error message if task failed */
  error?: string
}

/** Aggregated result for all tasks in a single wave */
export interface WaveExecutionResult {
  waveNumber: number
  tasks: TaskExecutionResult[]
  allSucceeded: boolean
}

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Build an isolated TaskDispatchPayload for a wave task.
 * The subagent receives ONLY the plan content + task context — no orchestrator state.
 * Pure function — no side effects.
 */
export function buildSubagentContext(task: WaveTask): TaskDispatchPayload {
  const content = [
    `# Task: ${task.title}`,
    '',
    '## Plan Context',
    '',
    task.planContent,
    ...(task.codebaseContext ? ['', '## Codebase Context', '', task.codebaseContext] : []),
  ].join('\n')

  return buildTaskPayload({
    type: 'execute',
    content,
    ...(task.budgetUsd !== undefined && { budgetUsd: task.budgetUsd }),
    ...(task.constitutionPath !== undefined && { constitutionPath: task.constitutionPath }),
  })
}

/**
 * Alpha stub: simulate execution of a single task by a subagent.
 * In production, this would be replaced by a real Task() dispatch.
 * Pure function — no side effects.
 */
export function executeTaskStub(task: WaveTask): TaskExecutionResult {
  const payload = buildSubagentContext(task)
  const sizeCheck = validatePayloadSize(payload)

  if (!sizeCheck.ok) {
    return {
      taskId: task.taskId,
      title: task.title,
      waveNumber: task.waveNumber,
      success: false,
      artifacts: [],
      error: `Payload too large: ${sizeCheck.error.code}`,
    }
  }

  // In Alpha: stub success — real Task() dispatch happens in production
  return {
    taskId: task.taskId,
    title: task.title,
    waveNumber: task.waveNumber,
    success: true,
    artifacts: [],
  }
}

/**
 * Executes a set of tasks in parallel as a single wave.
 * Each task receives an isolated subagent with clean context.
 * All tasks are dispatched simultaneously; the wave completes only when all tasks finish.
 * In Alpha: uses stub execution. In production, replaces executeTaskStub with Task().
 * @see FR-701 — Wave-Parallel Execution
 */
export function executeWave(tasks: WaveTask[]): WaveExecutionResult {
  if (tasks.length === 0) {
    return { waveNumber: 0, tasks: [], allSucceeded: true }
  }

  const waveNumber = tasks[0]!.waveNumber

  // Parallel dispatch: in Alpha all are sync stubs; in production these would be
  // concurrent Task() calls that resolve when their subagent completes.
  const results = tasks.map(task => executeTaskStub(task))
  const allSucceeded = results.every(r => r.success)

  return { waveNumber, tasks: results, allSucceeded }
}

/**
 * Executes all waves sequentially: wave N+1 begins only after wave N completes.
 * Within each wave, tasks run in parallel.
 * Returns all wave results, halting on the first wave failure if haltOnFailure is true.
 * Pure function — no side effects.
 */
export function executeWaves(
  waves: WaveTask[][],
  haltOnFailure = true,
): Result<WaveExecutionResult[]> {
  const waveResults: WaveExecutionResult[] = []

  for (const waveTasks of waves) {
    const result = executeWave(waveTasks)
    waveResults.push(result)

    if (!result.allSucceeded && haltOnFailure) {
      return err({
        code: ERROR_CODES.NOT_IMPLEMENTED,
        i18nKey: 'error.execute.wave_failed',
        params: { wave: String(result.waveNumber + 1) },
        phase: 'Epic 6',
      })
    }
  }

  return ok(waveResults)
}

/**
 * Convert a plan file's task list lines into WaveTasks for execution.
 * Parses [AGENT] / [HUMAN] prefixes from plan-wave-N.md content.
 * Pure function — no side effects.
 */
export function parseWaveTasksFromPlanFile(
  planContent: string,
  waveNumber: number,
  constitutionPath?: string,
): WaveTask[] {
  const tasks: WaveTask[] = []
  const lines = planContent.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Match: - [ ] [AGENT] Title or - [ ] [HUMAN] Title
    const match = /^-\s+\[\s*\]\s+\[(AGENT|HUMAN)\]\s+(.+)$/.exec(trimmed)
    if (!match) continue
    const [, , rawTitle] = match
    const title = rawTitle?.replace(/\s*_\(after:.*\)_\s*$/, '').trim() ?? ''
    if (!title) continue

    tasks.push({
      taskId: randomUUID(),
      title,
      waveNumber,
      planContent,
      ...(constitutionPath !== undefined && { constitutionPath }),
    })
  }

  return tasks
}
