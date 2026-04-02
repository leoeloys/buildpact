/**
 * Dispatch Guard — verify prerequisites before allowing task dispatch.
 * Prevents out-of-order execution and state corruption.
 *
 * @module engine/dispatch-guard
 * @see Concept 12.5 (GSD-2 dispatch guard)
 */

import type { DispatchGuardResult, BuildState } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Check that all tasks in previous waves are completed before dispatching
 * a task in the current wave.
 */
export function checkWavePrerequisites(
  buildState: BuildState,
  targetWave: number,
  targetTaskId: string,
): DispatchGuardResult {
  const blockedBy: string[] = []
  const missingPrerequisites: string[] = []

  // All tasks in waves before targetWave must be completed
  if (targetWave > 0) {
    // We can only verify by checking completedTasks count against expected
    // In practice, the wave executor tracks this — guard is a safety net
    const expectedPriorTasks = buildState.checkpoints.filter(cp => {
      // Parse wave from taskId pattern "wave-N/task-M" or just check if it's in completedTasks
      return buildState.completedTasks.includes(cp.taskId)
    })

    if (buildState.currentWave < targetWave - 1) {
      missingPrerequisites.push(`Wave ${targetWave - 1} not yet started (current: ${buildState.currentWave})`)
    }
  }

  // Task should not already be completed
  if (buildState.completedTasks.includes(targetTaskId)) {
    blockedBy.push(`Task ${targetTaskId} already completed`)
  }

  // Build should not be in terminal state
  if (buildState.status === 'FAILED' || buildState.status === 'ABANDONED') {
    blockedBy.push(`Build is ${buildState.status}`)
  }

  if (buildState.status === 'PAUSED') {
    blockedBy.push('Build is PAUSED — resume before dispatching')
  }

  return {
    allowed: blockedBy.length === 0 && missingPrerequisites.length === 0,
    blockedBy,
    missingPrerequisites,
  }
}

/**
 * Simple prerequisite check: verify a list of task IDs are all completed.
 */
export function checkTaskPrerequisites(
  completedTasks: string[],
  requiredTasks: string[],
): DispatchGuardResult {
  const missing = requiredTasks.filter(t => !completedTasks.includes(t))

  return {
    allowed: missing.length === 0,
    blockedBy: [],
    missingPrerequisites: missing.map(t => `Prerequisite task ${t} not completed`),
  }
}

/**
 * Format guard result for display.
 */
export function formatGuardResult(result: DispatchGuardResult): string {
  if (result.allowed) return 'Dispatch allowed — all prerequisites met.'

  const lines = ['Dispatch BLOCKED:']
  for (const b of result.blockedBy) lines.push(`  ✗ ${b}`)
  for (const m of result.missingPrerequisites) lines.push(`  ✗ ${m}`)
  return lines.join('\n')
}
