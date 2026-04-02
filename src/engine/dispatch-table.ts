/**
 * Dispatch Table — declarative rules-based pipeline routing.
 * Rules evaluated in order, first match wins. Inspectable, testable, extensible.
 *
 * Replaces procedural if-else dispatch logic with pure, composable rules.
 *
 * @module engine/dispatch-table
 * @see Concept 12.1 (GSD-2 declarative dispatch)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { DispatchAction, DispatchContext } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single dispatch rule: name + priority + match function */
export interface DispatchRule {
  /** Human-readable rule name (e.g. "all-tasks-done → verify") */
  name: string
  /** Evaluation priority — higher numbers run first. Default: 0. Use -1 for fallback. */
  priority: number
  /** Pure function: given context, return action or null (no match) */
  match: (ctx: DispatchContext) => DispatchAction | null
}

// ---------------------------------------------------------------------------
// Rule factory
// ---------------------------------------------------------------------------

/**
 * Create a dispatch rule.
 */
export function createDispatchRule(
  name: string,
  matchFn: (ctx: DispatchContext) => DispatchAction | null,
  priority: number = 0,
): DispatchRule {
  return { name, priority, match: matchFn }
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

export const RULE_PAUSED = createDispatchRule(
  'paused → stop',
  (ctx) => {
    if (ctx.currentPhase === 'paused') {
      return { action: 'stop', reason: 'Pipeline is paused', level: 'info' }
    }
    return null
  },
  100, // highest priority
)

export const RULE_BUDGET_EXCEEDED = createDispatchRule(
  'budget-exceeded → stop',
  (ctx) => {
    if (ctx.budgetRemaining <= 0) {
      return { action: 'stop', reason: 'Budget exhausted', level: 'error' }
    }
    return null
  },
  90,
)

export const RULE_TASK_FAILED_3X = createDispatchRule(
  'task-failed-3x → stop',
  (ctx) => {
    if (ctx.consecutiveFailures >= 3) {
      return {
        action: 'stop',
        reason: `${ctx.consecutiveFailures} consecutive failures — halting pipeline`,
        level: 'error',
      }
    }
    return null
  },
  80,
)

export const RULE_ALL_TASKS_DONE = createDispatchRule(
  'all-tasks-done → verify',
  (ctx) => {
    if (ctx.taskIndex >= ctx.totalTasks && ctx.waveNumber >= ctx.totalWaves - 1) {
      return { action: 'stop', reason: 'All tasks complete — proceed to verification', level: 'info' }
    }
    return null
  },
  50,
)

export const RULE_WAVE_COMPLETE = createDispatchRule(
  'wave-complete → next-wave',
  (ctx) => {
    if (ctx.taskIndex >= ctx.totalTasks && ctx.waveNumber < ctx.totalWaves - 1) {
      return {
        action: 'dispatch',
        unitType: 'wave',
        unitId: `wave-${ctx.waveNumber + 1}`,
      }
    }
    return null
  },
  40,
)

export const RULE_DISPATCH_NEXT = createDispatchRule(
  'default → dispatch-next-task',
  (ctx) => {
    return {
      action: 'dispatch',
      unitType: 'task',
      unitId: `wave-${ctx.waveNumber}/task-${ctx.taskIndex}`,
    }
  },
  -1, // fallback — always matches, lowest priority
)

/** Default dispatch rules sorted by priority (highest first) */
export const DEFAULT_DISPATCH_RULES: DispatchRule[] = [
  RULE_PAUSED,
  RULE_BUDGET_EXCEEDED,
  RULE_TASK_FAILED_3X,
  RULE_ALL_TASKS_DONE,
  RULE_WAVE_COMPLETE,
  RULE_DISPATCH_NEXT,
]

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate dispatch rules against a context.
 * Rules are sorted by priority (highest first). First match wins.
 * Returns error if no rule matches.
 */
export function evaluateRules(
  rules: DispatchRule[],
  ctx: DispatchContext,
): Result<{ rule: string; action: DispatchAction }> {
  // Sort by priority descending (highest first)
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)

  for (const rule of sorted) {
    const action = rule.match(ctx)
    if (action !== null) {
      return ok({ rule: rule.name, action })
    }
  }

  return err({
    code: ERROR_CODES.DISPATCH_NO_MATCHING_RULE,
    i18nKey: 'error.dispatch.no_matching_rule',
    params: {
      phase: ctx.currentPhase,
      wave: String(ctx.waveNumber),
      task: String(ctx.taskIndex),
    },
  })
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format all dispatch rules as a human-readable table.
 */
export function formatRulesTable(rules: DispatchRule[]): string {
  const lines = [
    '| # | Rule | Description |',
    '|---|------|-------------|',
  ]

  for (let i = 0; i < rules.length; i++) {
    lines.push(`| ${i + 1} | ${rules[i]!.name} | First-match rule |`)
  }

  return lines.join('\n')
}
