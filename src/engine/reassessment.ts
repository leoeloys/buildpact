/**
 * Reassessment — adaptive plan adjustment after failures or new information.
 * Triggers on consecutive failures, contradicting info, wave completion,
 * or budget alerts. Produces plan changes (add, remove, reorder, modify).
 *
 * @module engine/reassessment
 * @see Concept 12.4 (Mid-execution plan reassessment)
 */

import type {
  ReassessmentTrigger,
  ReassessmentResult,
  PlanChange,
} from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Trigger detection
// ---------------------------------------------------------------------------

/**
 * Determine whether a reassessment should be triggered.
 * Returns null if no reassessment is needed.
 *
 * Rules:
 * - 2+ consecutive failures → 'task-failed-2x'
 * - New contradicting information → 'new-contradicting-info'
 */
export function shouldReassess(
  consecutiveFailures: number,
  newInfo: boolean,
): ReassessmentTrigger | null {
  if (consecutiveFailures >= 2) return 'task-failed-2x'
  if (newInfo) return 'new-contradicting-info'
  return null
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a reassessment result from a trigger and proposed changes.
 */
export function createReassessment(
  trigger: ReassessmentTrigger,
  changes: PlanChange[],
): ReassessmentResult {
  return {
    trigger,
    planChanged: changes.length > 0,
    changes,
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Plan mutation
// ---------------------------------------------------------------------------

/**
 * Apply plan changes to an existing task list.
 * Returns a new task list with additions, removals, and reorderings applied.
 *
 * Processing order: remove first, then add, then reorder/modify are informational.
 */
export function applyChanges(
  existingTasks: string[],
  changes: PlanChange[],
): string[] {
  let tasks = [...existingTasks]

  // Phase 1: Remove tasks
  const removals = new Set(
    changes
      .filter(c => c.type === 'remove')
      .map(c => c.taskId),
  )
  tasks = tasks.filter(t => !removals.has(t))

  // Phase 2: Add tasks (append to end)
  const additions = changes
    .filter(c => c.type === 'add')
    .map(c => c.taskId)
  tasks.push(...additions)

  return tasks
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a reassessment result as a human-readable report.
 */
export function formatReassessmentReport(result: ReassessmentResult): string {
  const lines: string[] = []

  lines.push('## Reassessment Report')
  lines.push('')
  lines.push(`- Trigger: ${result.trigger}`)
  lines.push(`- Plan changed: ${result.planChanged ? 'Yes' : 'No'}`)
  lines.push(`- Timestamp: ${result.timestamp}`)
  lines.push('')

  if (result.changes.length === 0) {
    lines.push('No changes to the plan.')
  } else {
    lines.push(`### Changes (${result.changes.length})`)
    lines.push('')
    for (const change of result.changes) {
      lines.push(`- **${change.type.toUpperCase()}** ${change.taskId}: ${change.reason}`)
    }
  }

  return lines.join('\n')
}
