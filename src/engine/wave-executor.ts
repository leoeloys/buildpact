/**
 * Wave executor — parallel subagent dispatch in coordinated waves.
 * @module engine/wave-executor
 * @see FR-701 — Wave Execution (Epic 6)
 */

import { randomUUID } from 'node:crypto'
import { buildTaskPayload } from './subagent.js'
import { validatePayloadSize } from './subagent.js'
import { formatCommitMessage } from './atomic-commit.js'
import { validateTaskResult } from './result-validator.js'
import type { WaveProgressRenderer } from './progress-renderer.js'
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
  /** Plan slug used as scope in the atomic commit message — type(phaseSlug): title */
  phaseSlug?: string
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
  /** Token usage from provider dispatch */
  tokensUsed?: number
  /** Cost in USD from provider dispatch */
  costUsd?: number
  /**
   * Formatted atomic commit message for this task — `type(phaseSlug): title`.
   * Present only when the task succeeded.
   * In Alpha: populated by the stub to confirm one commit would be produced per task.
   * In production: the subagent executes this commit before returning its result.
   */
  commitMessage?: string
}

/** Aggregated result for all tasks in a single wave */
export interface WaveExecutionResult {
  waveNumber: number
  tasks: TaskExecutionResult[]
  allSucceeded: boolean
}

/** Options for executeWave and executeWaves */
export interface WaveExecutionOptions {
  /** Progress renderer for real-time terminal feedback */
  renderer?: WaveProgressRenderer
  /** Total number of waves (for progress display) */
  totalWaves?: number
  /** Max retries per task when result validation returns retry */
  maxRetries?: number
  /** Signal to check for graceful cancellation */
  cancelled?: () => boolean
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

  // In Alpha: stub success — real Task() dispatch happens in production.
  // Populate commitMessage to confirm exactly one commit per task (FR-702).
  const phaseSlug = task.phaseSlug ?? 'execute'
  const commitMessage = formatCommitMessage(task.title, phaseSlug)

  return {
    taskId: task.taskId,
    title: task.title,
    waveNumber: task.waveNumber,
    success: true,
    artifacts: [],
    commitMessage,
  }
}

/**
 * Execute a single task with result validation and optional retry.
 * Wraps executeTaskStub with validateTaskResult checks.
 * If validation returns an invalid result and retries remain, retry the task.
 */
function executeTaskWithValidation(task: WaveTask, maxRetries: number): TaskExecutionResult {
  let lastResult: TaskExecutionResult | undefined
  const attempts = maxRetries + 1 // first attempt + retries

  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = executeTaskStub(task)
    lastResult = result

    if (!result.success) {
      // Validate the failure — check if it's retryable
      const validation = validateTaskResult(
        { taskId: result.taskId, success: false, artifacts: result.artifacts, error: result.error ?? 'unknown error' },
        result.title,
      )

      if (!validation.ok && attempt < maxRetries) {
        // Retry: validation failed, retries available
        continue
      }
      // No more retries or abort — return the failed result
      return result
    }

    // Task succeeded — validate the result content
    const validation = validateTaskResult(
      { taskId: result.taskId, success: true, artifacts: result.artifacts },
      result.title,
    )

    if (validation.ok) {
      return result
    }

    // Validation failed on a "successful" result — retry if possible
    if (attempt < maxRetries) {
      continue
    }

    // Out of retries — mark as failed
    return {
      ...result,
      success: false,
      error: `Result validation failed after ${attempts} attempts`,
    }
  }

  return lastResult!
}

/**
 * Executes a set of tasks in parallel as a single wave.
 * Each task receives an isolated subagent with clean context.
 * All tasks are dispatched simultaneously; the wave completes only when all tasks finish.
 * Integrates ProgressRenderer for real-time feedback and ResultValidator for output checks.
 * In Alpha: uses stub execution. In production, replaces executeTaskStub with Task().
 * @see FR-701 — Wave-Parallel Execution
 */
export function executeWave(tasks: WaveTask[], opts?: WaveExecutionOptions): WaveExecutionResult {
  if (tasks.length === 0) {
    return { waveNumber: 0, tasks: [], allSucceeded: true }
  }

  const waveNumber = tasks[0]!.waveNumber
  const renderer = opts?.renderer
  const totalWaves = opts?.totalWaves ?? 1
  const maxRetries = opts?.maxRetries ?? 0

  // Start wave progress
  renderer?.startWave(waveNumber, totalWaves, tasks.length)

  // Parallel dispatch: in Alpha all are sync stubs; in production these would be
  // concurrent Task() calls that resolve when their subagent completes.
  const results = tasks.map(task => {
    // Check cancellation before starting each task
    if (opts?.cancelled?.()) {
      return {
        taskId: task.taskId,
        title: task.title,
        waveNumber: task.waveNumber,
        success: false,
        artifacts: [],
        error: 'Execution cancelled',
      } satisfies TaskExecutionResult
    }

    renderer?.startTask(task.taskId, task.title)
    const result = executeTaskWithValidation(task, maxRetries)
    renderer?.completeTask(task.taskId, result)
    return result
  })

  const allSucceeded = results.every(r => r.success)
  const waveResult: WaveExecutionResult = { waveNumber, tasks: results, allSucceeded }

  // End wave progress
  renderer?.endWave(waveNumber, waveResult)

  return waveResult
}

/**
 * Executes all waves sequentially: wave N+1 begins only after wave N completes.
 * Within each wave, tasks run in parallel.
 * Returns all wave results, halting on the first wave failure if haltOnFailure is true.
 * Integrates ProgressRenderer and cancellation support.
 */
export function executeWaves(
  waves: WaveTask[][],
  haltOnFailure = true,
  opts?: WaveExecutionOptions,
): Result<WaveExecutionResult[]> {
  const waveResults: WaveExecutionResult[] = []
  const waveOpts = opts ? { ...opts, totalWaves: opts.totalWaves ?? waves.length } : { totalWaves: waves.length }

  for (const waveTasks of waves) {
    // Check cancellation before starting each wave
    if (opts?.cancelled?.()) {
      return err({
        code: ERROR_CODES.NOT_IMPLEMENTED,
        i18nKey: 'error.execute.cancelled',
        params: {},
        phase: 'Epic 13',
      })
    }

    const result = executeWave(waveTasks, waveOpts)
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
  phaseSlug?: string,
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
      ...(phaseSlug !== undefined && { phaseSlug }),
    })
  }

  return tasks
}

// ---------------------------------------------------------------------------
// Wave analysis — topological sort of task dependency graph
// ---------------------------------------------------------------------------

import type { TaskNode, WaveGroup, PlanFile } from './types.js'

/**
 * Analyze a list of tasks and group them into parallel execution waves
 * using topological sort. Tasks with no unresolved dependencies go into
 * the earliest possible wave.
 */
export function analyzeWaves(tasks: TaskNode[]): WaveGroup[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  // Initialize
  for (const t of tasks) {
    inDegree.set(t.id, 0)
    dependents.set(t.id, [])
  }

  // Build in-degree and adjacency
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (taskMap.has(dep)) {
        inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1)
        dependents.get(dep)!.push(t.id)
      }
    }
  }

  const waves: WaveGroup[] = []

  // BFS by level
  let queue = tasks.filter(t => (inDegree.get(t.id) ?? 0) === 0)
  let waveNumber = 0

  while (queue.length > 0) {
    waves.push({
      waveNumber,
      tasks: queue,
      isParallel: true, // all tasks in a wave are independent
    })

    const next: TaskNode[] = []
    for (const t of queue) {
      for (const depId of dependents.get(t.id) ?? []) {
        const newDegree = (inDegree.get(depId) ?? 1) - 1
        inDegree.set(depId, newDegree)
        if (newDegree === 0) {
          const node = taskMap.get(depId)
          if (node) next.push(node)
        }
      }
    }

    queue = next
    waveNumber++
  }

  return waves
}

/**
 * Split wave groups into plan files, each containing at most maxTasksPerFile tasks.
 */
export function splitIntoPlanFiles(
  waves: WaveGroup[],
  maxTasksPerFile = 3,
): PlanFile[] {
  const files: PlanFile[] = []

  for (const wave of waves) {
    const chunks: TaskNode[][] = []
    for (let i = 0; i < wave.tasks.length; i += maxTasksPerFile) {
      chunks.push(wave.tasks.slice(i, i + maxTasksPerFile))
    }

    for (let planIdx = 0; planIdx < chunks.length; planIdx++) {
      files.push({
        filename: `wave-${wave.waveNumber + 1}-plan-${planIdx + 1}.md`,
        waveNumber: wave.waveNumber,
        planNumber: planIdx + 1,
        tasks: chunks[planIdx]!,
      })
    }
  }

  return files
}
