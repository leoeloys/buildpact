/**
 * Usage Insights — aggregate metrics into actionable cost/usage reports.
 * @module engine/usage-insights
 * @see BuildPact concept 18.5
 */

import type { MetricsLedger, UsageInsight } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Insight computation
// ---------------------------------------------------------------------------

/**
 * Compute usage insights from a metrics ledger for a given period.
 */
export function computeInsights(
  ledger: MetricsLedger,
  period: UsageInsight['period'],
): UsageInsight {
  const now = Date.now()
  const periodMs = periodToMs(period)
  const cutoff = now - periodMs

  const recentUnits = ledger.units.filter(u => {
    const started = new Date(u.startedAt).getTime()
    return started >= cutoff
  })

  const totalTokens = recentUnits.reduce((sum, u) => sum + u.tokens.total, 0)
  const totalCostUsd = recentUnits.reduce((sum, u) => sum + u.costUsd, 0)
  const taskCount = recentUnits.length
  const avgCostPerTask = taskCount > 0 ? totalCostUsd / taskCount : 0

  // Aggregate by model
  const modelMap = new Map<string, { tokens: number; cost: number }>()
  for (const u of recentUnits) {
    const existing = modelMap.get(u.model) ?? { tokens: 0, cost: 0 }
    existing.tokens += u.tokens.total
    existing.cost += u.costUsd
    modelMap.set(u.model, existing)
  }

  const topModels = [...modelMap.entries()]
    .map(([model, stats]) => ({ model, tokens: stats.tokens, cost: stats.cost }))
    .sort((a, b) => b.cost - a.cost)

  return {
    period,
    totalTokens,
    totalCostUsd,
    taskCount,
    avgCostPerTask,
    topModels,
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format usage insights into a human-readable report.
 */
export function formatInsightsReport(insight: UsageInsight): string {
  const lines: string[] = [
    `## Usage Insights (${insight.period})`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total tokens | ${insight.totalTokens.toLocaleString()} |`,
    `| Total cost | $${insight.totalCostUsd.toFixed(4)} |`,
    `| Task count | ${insight.taskCount} |`,
    `| Avg cost/task | $${insight.avgCostPerTask.toFixed(4)} |`,
    '',
  ]

  if (insight.topModels.length > 0) {
    lines.push('### Top Models by Cost')
    lines.push('')
    lines.push('| Model | Tokens | Cost |')
    lines.push('|-------|--------|------|')
    for (const m of insight.topModels) {
      lines.push(`| ${m.model} | ${m.tokens.toLocaleString()} | $${m.cost.toFixed(4)} |`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function periodToMs(period: UsageInsight['period']): number {
  switch (period) {
    case 'daily': return 24 * 60 * 60 * 1000
    case 'weekly': return 7 * 24 * 60 * 60 * 1000
    case 'monthly': return 30 * 24 * 60 * 60 * 1000
  }
}
