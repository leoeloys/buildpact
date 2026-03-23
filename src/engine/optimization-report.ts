/**
 * Optimization Report — human-readable and machine-readable reports
 * for squad optimization experiments.
 * @module engine/optimization-report
 * @see Epic 23.4: Optimization Reports
 */

import type { OptimizationSession, OptimizationVariant } from './squad-optimizer.js'

// ---------------------------------------------------------------------------
// Statistical significance formatting
// ---------------------------------------------------------------------------

/**
 * Format a p-value into a human-readable significance statement.
 */
export function formatStatSignificance(pValue: number): string {
  const formatted = pValue.toFixed(2)
  if (pValue < 0.05) {
    return `Statistically significant (p=${formatted})`
  }
  return `Not statistically significant (p=${formatted})`
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

/**
 * Generate a full markdown report for an optimization session.
 * Includes: experiment summary, per-variant metrics, winning variant diff,
 * and cost summary.
 */
export function generateReport(session: OptimizationSession): string {
  const lines: string[] = []

  // Header
  lines.push(`# Optimization Report`)
  lines.push('')

  // Experiment summary
  lines.push(`## Experiment Summary`)
  lines.push('')
  lines.push(`- **Target agent:** ${session.config.targetAgent}`)
  lines.push(`- **Metric:** ${session.config.metric}`)
  lines.push(`- **Variants tested:** ${session.variants.length}`)
  lines.push(`- **Budget:** $${session.config.budgetUsd.toFixed(2)}`)
  lines.push(`- **Spent:** $${session.sessionSpendUsd.toFixed(2)}`)
  lines.push(`- **Branch:** \`${session.branchName}\``)
  lines.push('')

  // Baseline
  lines.push(`## Baseline`)
  lines.push('')
  lines.push(formatVariantRow(session.baseline))
  lines.push('')

  // Variants table
  if (session.variants.length > 0) {
    lines.push(`## Variants`)
    lines.push('')
    lines.push(`| Variant | Mean | StdDev | p-value | Significant |`)
    lines.push(`|---------|------|--------|---------|-------------|`)
    for (const v of session.variants) {
      const sig = v.isSignificant ? 'Yes' : 'No'
      lines.push(
        `| ${v.id} | ${v.metrics.mean.toFixed(2)} | ${v.metrics.stdDev.toFixed(2)} | ${v.metrics.pValue.toFixed(4)} | ${sig} |`,
      )
    }
    lines.push('')
  }

  // Winner
  lines.push(`## Winner`)
  lines.push('')
  if (session.winner) {
    lines.push(
      `**${session.winner.id}** — ${formatStatSignificance(session.winner.metrics.pValue)}`,
    )
    lines.push('')
    lines.push(
      `Improvement: ${session.baseline.metrics.mean.toFixed(2)} → ${session.winner.metrics.mean.toFixed(2)}`,
    )
  } else {
    lines.push(`No variant outperformed the baseline with statistical significance.`)
  }
  lines.push('')

  // Cost summary
  lines.push(`## Cost Summary`)
  lines.push('')
  lines.push(`- Total spend: $${session.sessionSpendUsd.toFixed(2)}`)
  lines.push(
    `- Budget remaining: $${(session.config.budgetUsd - session.sessionSpendUsd).toFixed(2)}`,
  )
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// JSON report
// ---------------------------------------------------------------------------

/**
 * Generate a JSON string with raw metrics for machine consumption.
 */
export function generateJsonResults(session: OptimizationSession): string {
  const payload = {
    config: {
      targetAgent: session.config.targetAgent,
      metric: session.config.metric,
      variantCount: session.config.variantCount,
      budgetUsd: session.config.budgetUsd,
    },
    baseline: extractMetrics(session.baseline),
    variants: session.variants.map(extractMetrics),
    winner: session.winner ? extractMetrics(session.winner) : null,
    sessionSpendUsd: session.sessionSpendUsd,
    branchName: session.branchName,
  }

  return JSON.stringify(payload, null, 2)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatVariantRow(v: OptimizationVariant): string {
  return `- **${v.id}**: mean=${v.metrics.mean.toFixed(2)}, stdDev=${v.metrics.stdDev.toFixed(2)}, p=${v.metrics.pValue.toFixed(4)} — ${formatStatSignificance(v.metrics.pValue)}`
}

function extractMetrics(
  v: OptimizationVariant,
): { id: string; mean: number; stdDev: number; pValue: number; isSignificant: boolean } {
  return {
    id: v.id,
    mean: v.metrics.mean,
    stdDev: v.metrics.stdDev,
    pValue: v.metrics.pValue,
    isSignificant: v.isSignificant,
  }
}
