import { describe, it, expect } from 'vitest'
import {
  estimateExecutionCost,
  formatCostProjection,
  calculateProfileComparison,
  formatExecutionCostSummary,
} from '../../../src/engine/cost-projector.js'
import type { TaskExecutionResult } from '../../../src/engine/wave-executor.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const taskResult = (overrides?: Partial<TaskExecutionResult>): TaskExecutionResult => ({
  taskId: 'task-1',
  title: 'Build auth module',
  waveNumber: 0,
  success: true,
  artifacts: [],
  ...overrides,
})

// ---------------------------------------------------------------------------
// estimateExecutionCost
// ---------------------------------------------------------------------------

describe('estimateExecutionCost', () => {
  it('calculates cost for balanced profile', () => {
    const projection = estimateExecutionCost(10, 'balanced')
    // 10 tasks * 2000 tokens * $0.015/1k = $0.30
    expect(projection.estimatedCostUsd).toBeCloseTo(0.30)
    expect(projection.taskCount).toBe(10)
    expect(projection.profileTier).toBe('balanced')
  })

  it('calculates cost for quality profile', () => {
    const projection = estimateExecutionCost(5, 'quality')
    // 5 tasks * 2000 tokens * $0.075/1k = $0.75
    expect(projection.estimatedCostUsd).toBeCloseTo(0.75)
  })

  it('calculates cost for budget profile', () => {
    const projection = estimateExecutionCost(20, 'budget')
    // 20 tasks * 2000 tokens * $0.00125/1k = $0.05
    expect(projection.estimatedCostUsd).toBeCloseTo(0.05)
  })

  it('sets exceedsBudget when estimated cost exceeds remaining budget', () => {
    const projection = estimateExecutionCost(10, 'quality', 0.50)
    // $0.75 > $0.50
    expect(projection.exceedsBudget).toBe(true)
    expect(projection.budgetRemainingUsd).toBe(0.50)
  })

  it('sets exceedsBudget false when within budget', () => {
    const projection = estimateExecutionCost(2, 'budget', 10.00)
    expect(projection.exceedsBudget).toBe(false)
  })

  it('omits budgetRemainingUsd when not provided', () => {
    const projection = estimateExecutionCost(5, 'balanced')
    expect(projection.budgetRemainingUsd).toBeUndefined()
    expect(projection.exceedsBudget).toBe(false)
  })

  it('includes modelId in projection', () => {
    const projection = estimateExecutionCost(1, 'quality')
    expect(projection.modelId).toBe('claude-opus-4-6')
  })
})

// ---------------------------------------------------------------------------
// formatCostProjection
// ---------------------------------------------------------------------------

describe('formatCostProjection', () => {
  it('formats basic projection', () => {
    const projection = estimateExecutionCost(10, 'balanced')
    const formatted = formatCostProjection(projection)
    expect(formatted).toContain('$0.30')
    expect(formatted).toContain('10 tasks')
    expect(formatted).toContain('balanced')
  })

  it('includes budget warning when exceeding', () => {
    const projection = estimateExecutionCost(10, 'quality', 0.50)
    const formatted = formatCostProjection(projection)
    expect(formatted).toContain('Warning')
    expect(formatted).toContain('$0.50')
  })

  it('does not include warning when within budget', () => {
    const projection = estimateExecutionCost(2, 'budget', 10.00)
    const formatted = formatCostProjection(projection)
    expect(formatted).not.toContain('Warning')
  })
})

// ---------------------------------------------------------------------------
// calculateProfileComparison
// ---------------------------------------------------------------------------

describe('calculateProfileComparison', () => {
  it('returns comparisons for quality profile', () => {
    const comparisons = calculateProfileComparison(50000, 'quality')
    expect(comparisons).toHaveLength(2)

    const balanced = comparisons.find(c => c.tier === 'balanced')
    const budget = comparisons.find(c => c.tier === 'budget')

    expect(balanced).toBeDefined()
    expect(budget).toBeDefined()
    // balanced should be cheaper than quality
    expect(balanced!.savingsPercent).toBeGreaterThan(0)
    expect(budget!.savingsPercent).toBeGreaterThan(balanced!.savingsPercent)
  })

  it('returns comparisons for balanced profile', () => {
    const comparisons = calculateProfileComparison(50000, 'balanced')
    expect(comparisons).toHaveLength(2)

    const quality = comparisons.find(c => c.tier === 'quality')
    const budget = comparisons.find(c => c.tier === 'budget')

    expect(quality).toBeDefined()
    expect(budget).toBeDefined()
    // quality should be more expensive (negative savings)
    expect(quality!.savingsPercent).toBeLessThan(0)
    expect(budget!.savingsPercent).toBeGreaterThan(0)
  })

  it('returns comparisons sorted by cost (cheapest first)', () => {
    const comparisons = calculateProfileComparison(50000, 'quality')
    expect(comparisons[0]!.estimatedCostUsd).toBeLessThan(comparisons[1]!.estimatedCostUsd)
  })

  it('calculates correct savings percentages', () => {
    // quality: 50000 * 0.075 / 1000 = $3.75
    // balanced: 50000 * 0.015 / 1000 = $0.75
    // savings: (1 - 0.75/3.75) * 100 = 80%
    const comparisons = calculateProfileComparison(50000, 'quality')
    const balanced = comparisons.find(c => c.tier === 'balanced')
    expect(balanced!.savingsPercent).toBe(80)
  })

  it('excludes current tier from comparisons', () => {
    const comparisons = calculateProfileComparison(50000, 'balanced')
    const self = comparisons.find(c => c.tier === 'balanced')
    expect(self).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// formatExecutionCostSummary
// ---------------------------------------------------------------------------

describe('formatExecutionCostSummary', () => {
  it('formats summary with wave breakdown', () => {
    const wave1 = [
      taskResult({ tokensUsed: 1500, costUsd: 0.02 }),
      taskResult({ tokensUsed: 2000, costUsd: 0.03 }),
    ]
    const wave2 = [
      taskResult({ tokensUsed: 3000, costUsd: 0.045 }),
    ]

    const summary = formatExecutionCostSummary([wave1, wave2], 'balanced')
    expect(summary).toContain('Execution Cost Summary')
    expect(summary).toContain('6500') // total tokens (may or may not have locale separator)
    expect(summary).toContain('Wave 1:')
    expect(summary).toContain('Wave 2:')
    expect(summary).toContain('2 tasks')
    expect(summary).toContain('1 tasks')
  })

  it('includes profile comparison when tokens > 0', () => {
    const wave = [taskResult({ tokensUsed: 5000, costUsd: 0.375 })]
    const summary = formatExecutionCostSummary([wave], 'quality')
    expect(summary).toContain('Profile comparison:')
    expect(summary).toContain('balanced')
    expect(summary).toContain('budget')
  })

  it('omits profile comparison when no token data', () => {
    const wave = [taskResult()] // no tokensUsed
    const summary = formatExecutionCostSummary([wave], 'balanced')
    expect(summary).not.toContain('Profile comparison:')
  })

  it('handles empty wave results', () => {
    const summary = formatExecutionCostSummary([], 'balanced')
    expect(summary).toContain('Execution Cost Summary')
    expect(summary).toContain('$0.0000')
  })

  it('handles tasks with zero cost gracefully', () => {
    const wave = [taskResult({ costUsd: 0, tokensUsed: 0 })]
    const summary = formatExecutionCostSummary([wave], 'balanced')
    expect(summary).toContain('$0.0000')
  })

  it('handles tasks with undefined cost gracefully', () => {
    const wave = [taskResult()] // costUsd undefined
    const summary = formatExecutionCostSummary([wave], 'balanced')
    expect(summary).toContain('$0.0000')
  })
})
