/**
 * Squad Optimizer — self-optimizing agent definitions via A/B experimentation.
 * Generates agent variants, evaluates them against benchmarks, and selects
 * statistically significant winners.
 * @module engine/squad-optimizer
 * @see Epic 23.1: Squad Optimization Command
 */

import type { BenchmarkTask } from './benchmark-sets.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptimizationConfig {
  squadDir: string
  targetAgent: string
  metric: 'quality' | 'speed' | 'cost'
  variantCount: number
  budgetUsd: number
}

export interface OptimizationVariant {
  id: string
  agentContent: string
  metrics: { mean: number; stdDev: number; pValue: number }
  isSignificant: boolean // p < 0.05
}

export interface OptimizationSession {
  config: OptimizationConfig
  baseline: OptimizationVariant
  variants: OptimizationVariant[]
  winner: OptimizationVariant | null // null if no variant beats baseline
  sessionSpendUsd: number
  branchName: string
}

// ---------------------------------------------------------------------------
// Significance threshold
// ---------------------------------------------------------------------------

const P_VALUE_THRESHOLD = 0.05

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

/**
 * Initialize a new optimization session with the given config.
 * Sets up the baseline variant with zeroed metrics.
 */
export function createOptimizationSession(
  config: OptimizationConfig,
): OptimizationSession {
  const baseline: OptimizationVariant = {
    id: 'baseline',
    agentContent: '',
    metrics: { mean: 0, stdDev: 0, pValue: 1 },
    isSignificant: false,
  }

  const slug = config.targetAgent.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const branchName = `optimize/${slug}-${config.metric}`

  return {
    config,
    baseline,
    variants: [],
    winner: null,
    sessionSpendUsd: 0,
    branchName,
  }
}

// ---------------------------------------------------------------------------
// Variant generation
// ---------------------------------------------------------------------------

/**
 * Create a modified agent definition variant.
 * Placeholder implementation: appends a comment marker identifying the variant
 * and optimisation metric. Real implementation would use LLM-driven rewriting.
 */
export function generateVariant(
  baseline: string,
  metric: string,
  variantId: string,
): string {
  const marker = `<!-- optimization-variant: ${variantId} | metric: ${metric} -->`
  return `${baseline}\n${marker}\n`
}

// ---------------------------------------------------------------------------
// Variant evaluation
// ---------------------------------------------------------------------------

/**
 * Run benchmarks against a variant and compute aggregate metrics.
 * Returns a new variant object with populated metrics.
 */
export function evaluateVariant(
  variant: OptimizationVariant,
  benchmarks: BenchmarkTask[],
): OptimizationVariant {
  if (benchmarks.length === 0) {
    return {
      ...variant,
      metrics: { mean: 0, stdDev: 0, pValue: 1 },
      isSignificant: false,
    }
  }

  // Placeholder scoring: score each benchmark task by counting how many
  // expectedPatterns appear in the agent content (simulating execution output).
  const scores = benchmarks.map((task) => {
    let score = 0
    for (const pattern of task.expectedPatterns) {
      const re = new RegExp(pattern, 'i')
      if (re.test(variant.agentContent)) {
        score += task.qualityRubric.maxScore / task.expectedPatterns.length
      }
    }
    return Math.min(score, task.qualityRubric.maxScore)
  })

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length

  const variance =
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length
  const stdDev = Math.sqrt(variance)

  // Placeholder p-value: use a simple heuristic based on stdDev.
  // Real implementation would use Welch's t-test against the baseline.
  const pValue = stdDev === 0 ? 1 : Math.min(1, stdDev / (mean || 1))

  const isSignificant = pValue < P_VALUE_THRESHOLD

  return {
    ...variant,
    metrics: { mean, stdDev, pValue },
    isSignificant,
  }
}

// ---------------------------------------------------------------------------
// Winner selection
// ---------------------------------------------------------------------------

/**
 * Select the variant that outperforms the baseline with p < 0.05.
 * Returns null if no variant is statistically significant or all
 * perform worse than the baseline.
 */
export function selectWinner(
  session: OptimizationSession,
): OptimizationVariant | null {
  const candidates = session.variants.filter(
    (v) => v.isSignificant && v.metrics.mean > session.baseline.metrics.mean,
  )

  if (candidates.length === 0) return null

  // Pick the candidate with the highest mean score
  let best = candidates[0]!
  for (const c of candidates) {
    if (c.metrics.mean > best.metrics.mean) {
      best = c
    }
  }

  return best
}
