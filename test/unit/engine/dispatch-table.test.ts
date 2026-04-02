import { describe, it, expect } from 'vitest'
import {
  createDispatchRule,
  evaluateRules,
  formatRulesTable,
  DEFAULT_DISPATCH_RULES,
  RULE_ALL_TASKS_DONE,
  RULE_WAVE_COMPLETE,
  RULE_TASK_FAILED_3X,
  RULE_BUDGET_EXCEEDED,
  RULE_PAUSED,
  RULE_DISPATCH_NEXT,
} from '../../../src/engine/dispatch-table.js'
import type { DispatchContext } from '../../../src/contracts/task.js'

const baseCtx: DispatchContext = {
  projectDir: '/tmp/proj',
  currentPhase: 'execute',
  waveNumber: 0,
  taskIndex: 0,
  totalTasks: 5,
  totalWaves: 3,
  lastTaskSucceeded: true,
  consecutiveFailures: 0,
  budgetRemaining: 10,
}

describe('individual rules', () => {
  it('RULE_ALL_TASKS_DONE triggers when all waves and tasks done', () => {
    const ctx = { ...baseCtx, taskIndex: 5, totalTasks: 5, waveNumber: 2, totalWaves: 3 }
    const action = RULE_ALL_TASKS_DONE.match(ctx)
    expect(action).not.toBeNull()
    expect(action!.action).toBe('stop')
    expect(action!.reason).toContain('verification')
  })

  it('RULE_ALL_TASKS_DONE does not trigger mid-execution', () => {
    expect(RULE_ALL_TASKS_DONE.match(baseCtx)).toBeNull()
  })

  it('RULE_WAVE_COMPLETE triggers when tasks done but waves remain', () => {
    const ctx = { ...baseCtx, taskIndex: 5, totalTasks: 5, waveNumber: 0, totalWaves: 3 }
    const action = RULE_WAVE_COMPLETE.match(ctx)
    expect(action).not.toBeNull()
    expect(action!.action).toBe('dispatch')
    expect(action!.unitType).toBe('wave')
    expect(action!.unitId).toBe('wave-1')
  })

  it('RULE_TASK_FAILED_3X triggers after 3 failures', () => {
    const ctx = { ...baseCtx, consecutiveFailures: 3 }
    const action = RULE_TASK_FAILED_3X.match(ctx)
    expect(action).not.toBeNull()
    expect(action!.action).toBe('stop')
    expect(action!.level).toBe('error')
  })

  it('RULE_TASK_FAILED_3X does not trigger for 2 failures', () => {
    const ctx = { ...baseCtx, consecutiveFailures: 2 }
    expect(RULE_TASK_FAILED_3X.match(ctx)).toBeNull()
  })

  it('RULE_BUDGET_EXCEEDED triggers when budget <= 0', () => {
    const ctx = { ...baseCtx, budgetRemaining: 0 }
    const action = RULE_BUDGET_EXCEEDED.match(ctx)
    expect(action).not.toBeNull()
    expect(action!.action).toBe('stop')
  })

  it('RULE_BUDGET_EXCEEDED does not trigger with remaining budget', () => {
    expect(RULE_BUDGET_EXCEEDED.match(baseCtx)).toBeNull()
  })

  it('RULE_PAUSED triggers when phase is paused', () => {
    const ctx = { ...baseCtx, currentPhase: 'paused' }
    const action = RULE_PAUSED.match(ctx)
    expect(action).not.toBeNull()
    expect(action!.action).toBe('stop')
  })

  it('RULE_DISPATCH_NEXT always returns dispatch', () => {
    const action = RULE_DISPATCH_NEXT.match(baseCtx)
    expect(action).not.toBeNull()
    expect(action!.action).toBe('dispatch')
    expect(action!.unitType).toBe('task')
    expect(action!.unitId).toBe('wave-0/task-0')
  })
})

describe('evaluateRules', () => {
  it('returns first matching rule', () => {
    const ctx = { ...baseCtx, consecutiveFailures: 3 }
    const result = evaluateRules(DEFAULT_DISPATCH_RULES, ctx)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.rule).toBe('task-failed-3x → stop')
      expect(result.value.action.action).toBe('stop')
    }
  })

  it('falls through to default dispatch', () => {
    const result = evaluateRules(DEFAULT_DISPATCH_RULES, baseCtx)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.rule).toBe('default → dispatch-next-task')
      expect(result.value.action.action).toBe('dispatch')
    }
  })

  it('returns error when no rules match', () => {
    const noMatchRules = [createDispatchRule('never', () => null)]
    const result = evaluateRules(noMatchRules, baseCtx)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DISPATCH_NO_MATCHING_RULE')
  })

  it('budget-exceeded takes priority over failures', () => {
    const ctx = { ...baseCtx, consecutiveFailures: 5, budgetRemaining: 0 }
    const result = evaluateRules(DEFAULT_DISPATCH_RULES, ctx)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.rule).toBe('budget-exceeded → stop')
    }
  })

  it('paused takes highest priority', () => {
    const ctx = { ...baseCtx, currentPhase: 'paused', consecutiveFailures: 5, budgetRemaining: 0 }
    const result = evaluateRules(DEFAULT_DISPATCH_RULES, ctx)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.rule).toBe('paused → stop')
    }
  })
})

describe('createDispatchRule', () => {
  it('creates a rule with name and match function', () => {
    const rule = createDispatchRule('custom', (ctx) =>
      ctx.waveNumber > 5 ? { action: 'stop', reason: 'too many waves' } : null,
    )
    expect(rule.name).toBe('custom')
    expect(rule.match(baseCtx)).toBeNull()
    expect(rule.match({ ...baseCtx, waveNumber: 6 })).not.toBeNull()
  })
})

describe('formatRulesTable', () => {
  it('produces markdown table', () => {
    const table = formatRulesTable(DEFAULT_DISPATCH_RULES)
    expect(table).toContain('| # | Rule')
    expect(table).toContain('all-tasks-done')
    expect(table).toContain('budget-exceeded')
  })
})
