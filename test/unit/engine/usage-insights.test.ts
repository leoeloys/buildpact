import { describe, it, expect } from 'vitest'
import {
  computeInsights,
  formatInsightsReport,
} from '../../../src/engine/usage-insights.js'
import type { MetricsLedger } from '../../../src/contracts/task.js'

function makeLedger(units: MetricsLedger['units'] = []): MetricsLedger {
  return {
    version: 1,
    projectStartedAt: new Date().toISOString(),
    units,
  }
}

function makeUnit(model: string, costUsd: number, totalTokens: number, hoursAgo = 1) {
  const started = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
  return {
    unitType: 'execute-task',
    unitId: `wave-1/task-${Math.random().toString(36).slice(2, 6)}`,
    model,
    startedAt: started.toISOString(),
    finishedAt: new Date(started.getTime() + 60000).toISOString(),
    tokens: { input: totalTokens / 2, output: totalTokens / 2, cacheRead: 0, cacheWrite: 0, total: totalTokens },
    costUsd,
    toolCalls: 5,
    phase: 'execution' as const,
  }
}

describe('computeInsights', () => {
  it('returns zeroes for empty ledger', () => {
    const insight = computeInsights(makeLedger(), 'daily')
    expect(insight.totalTokens).toBe(0)
    expect(insight.totalCostUsd).toBe(0)
    expect(insight.taskCount).toBe(0)
    expect(insight.avgCostPerTask).toBe(0)
    expect(insight.topModels).toEqual([])
  })

  it('computes totals for recent units', () => {
    const ledger = makeLedger([
      makeUnit('opus', 0.50, 1000, 1),
      makeUnit('haiku', 0.05, 500, 2),
    ])
    const insight = computeInsights(ledger, 'daily')
    expect(insight.totalTokens).toBe(1500)
    expect(insight.totalCostUsd).toBeCloseTo(0.55)
    expect(insight.taskCount).toBe(2)
    expect(insight.avgCostPerTask).toBeCloseTo(0.275)
  })

  it('excludes units outside period', () => {
    const ledger = makeLedger([
      makeUnit('opus', 1.0, 2000, 1),      // 1 hour ago — within daily
      makeUnit('haiku', 0.5, 1000, 48),     // 48 hours ago — outside daily
    ])
    const insight = computeInsights(ledger, 'daily')
    expect(insight.taskCount).toBe(1)
    expect(insight.totalCostUsd).toBeCloseTo(1.0)
  })

  it('aggregates by model in topModels sorted by cost desc', () => {
    const ledger = makeLedger([
      makeUnit('opus', 2.0, 4000, 1),
      makeUnit('opus', 1.0, 2000, 2),
      makeUnit('haiku', 0.1, 500, 1),
    ])
    const insight = computeInsights(ledger, 'weekly')
    expect(insight.topModels[0]!.model).toBe('opus')
    expect(insight.topModels[0]!.cost).toBeCloseTo(3.0)
    expect(insight.topModels[1]!.model).toBe('haiku')
  })
})

describe('formatInsightsReport', () => {
  it('includes period in header', () => {
    const insight = computeInsights(makeLedger(), 'weekly')
    const report = formatInsightsReport(insight)
    expect(report).toContain('## Usage Insights (weekly)')
  })

  it('includes metrics table', () => {
    const ledger = makeLedger([makeUnit('opus', 1.5, 3000, 1)])
    const insight = computeInsights(ledger, 'daily')
    const report = formatInsightsReport(insight)
    expect(report).toContain('Total tokens')
    expect(report).toContain('Total cost')
    expect(report).toContain('Task count')
  })
})
