/**
 * Cost projector — pre-execution cost estimation and post-execution summary.
 * @module engine/cost-projector
 * @see FR-705 — Budget Guards, FR-604 — Model Profiles (Epic 13)
 */

import { appendFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { MODEL_CATALOG } from './model-profile-manager.js'
import type { ProfileTier, ModelConfig } from '../contracts/profile.js'
import type { TaskExecutionResult } from './wave-executor.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pre-execution cost projection */
export interface CostProjection {
  estimatedCostUsd: number
  taskCount: number
  modelId: string
  profileTier: string
  estimatedTokensPerTask: number
  exceedsBudget: boolean
  budgetRemainingUsd?: number
}

/** Profile comparison for post-execution summary */
export interface ProfileComparison {
  tier: string
  estimatedCostUsd: number
  savingsPercent: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default estimated average output tokens per task */
const DEFAULT_AVG_TOKENS_PER_TASK = 2000

/** Map profile tiers to their primary execution models */
const TIER_EXECUTION_MODELS: Record<ProfileTier, string> = {
  quality: 'claude-opus-4-6',
  balanced: 'claude-sonnet-4-6',
  budget: 'claude-haiku-4-5-20251001',
}

// ---------------------------------------------------------------------------
// Cost projection — pre-execution
// ---------------------------------------------------------------------------

/**
 * Estimate the cost of executing a plan based on task count and model profile.
 * Uses the active profile's execution model and an average token estimate.
 * Pure function — no side effects.
 */
export function estimateExecutionCost(
  taskCount: number,
  profileTier: ProfileTier,
  budgetRemainingUsd?: number,
): CostProjection {
  const modelId = TIER_EXECUTION_MODELS[profileTier]
  const model = MODEL_CATALOG[modelId]
  const costRate = model?.costPer1kOutputUsd ?? 0.015

  const estimatedCostUsd = taskCount * DEFAULT_AVG_TOKENS_PER_TASK * costRate / 1000
  const exceedsBudget = budgetRemainingUsd !== undefined && estimatedCostUsd > budgetRemainingUsd

  return {
    estimatedCostUsd,
    taskCount,
    modelId: modelId ?? 'claude-sonnet-4-6',
    profileTier,
    estimatedTokensPerTask: DEFAULT_AVG_TOKENS_PER_TASK,
    exceedsBudget,
    ...(budgetRemainingUsd !== undefined && { budgetRemainingUsd }),
  }
}

/**
 * Format a cost projection for display.
 * Pure function — no side effects.
 */
export function formatCostProjection(projection: CostProjection): string {
  const lines = [
    `Estimated cost: $${projection.estimatedCostUsd.toFixed(2)} (${projection.taskCount} tasks x ~${projection.estimatedTokensPerTask} tokens on ${projection.profileTier})`,
  ]

  if (projection.exceedsBudget && projection.budgetRemainingUsd !== undefined) {
    lines.push(
      `Warning: estimated cost exceeds remaining budget ($${projection.budgetRemainingUsd.toFixed(2)} remaining)`,
    )
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Profile comparison — post-execution
// ---------------------------------------------------------------------------

/**
 * Calculate cost comparison across model profiles for the given token count.
 * Returns alternatives sorted by cost (cheapest first), excluding the current tier.
 * Pure function — no side effects.
 */
export function calculateProfileComparison(
  totalTokens: number,
  currentTier: ProfileTier,
): ProfileComparison[] {
  const currentModelId = TIER_EXECUTION_MODELS[currentTier]
  const currentRate = MODEL_CATALOG[currentModelId]?.costPer1kOutputUsd ?? 0.015
  const currentCost = totalTokens * currentRate / 1000

  const tiers: ProfileTier[] = ['quality', 'balanced', 'budget']
  const comparisons: ProfileComparison[] = []

  for (const tier of tiers) {
    if (tier === currentTier) continue

    const modelId = TIER_EXECUTION_MODELS[tier]
    const rate = MODEL_CATALOG[modelId]?.costPer1kOutputUsd ?? 0.015
    const estimatedCostUsd = totalTokens * rate / 1000
    const savingsPercent = currentCost > 0
      ? Math.round((1 - estimatedCostUsd / currentCost) * 100)
      : 0

    comparisons.push({ tier, estimatedCostUsd, savingsPercent })
  }

  return comparisons.sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd)
}

// ---------------------------------------------------------------------------
// Post-execution cost summary
// ---------------------------------------------------------------------------

/**
 * Format a post-execution cost summary with wave breakdown and profile comparison.
 * @param waveResults — task results grouped by wave (array of arrays)
 * @param profileTier — the profile tier that was used during execution
 * Pure function — no side effects.
 */
export function formatExecutionCostSummary(
  waveResults: TaskExecutionResult[][],
  profileTier: ProfileTier,
): string {
  let totalTokens = 0
  let totalCost = 0

  const waveLines: string[] = []

  for (let i = 0; i < waveResults.length; i++) {
    const wave = waveResults[i]!
    let waveCost = 0
    for (const task of wave) {
      totalTokens += task.tokensUsed ?? 0
      const taskCost = task.costUsd ?? 0
      totalCost += taskCost
      waveCost += taskCost
    }
    waveLines.push(`  Wave ${i + 1}: $${waveCost.toFixed(4)} (${wave.length} tasks)`)
  }

  const lines: string[] = [
    'Execution Cost Summary',
    '',
    `Total tokens: ${totalTokens}`,
    `Total cost:   $${totalCost.toFixed(4)}`,
    '',
    ...waveLines,
  ]

  // Profile comparison (only meaningful with real costs)
  if (totalTokens > 0) {
    const comparisons = calculateProfileComparison(totalTokens, profileTier)
    if (comparisons.length > 0) {
      lines.push('')
      lines.push('Profile comparison:')
      for (const comp of comparisons) {
        const savingsLabel = comp.savingsPercent > 0
          ? `${comp.savingsPercent}% savings`
          : comp.savingsPercent < 0
            ? `${Math.abs(comp.savingsPercent)}% more expensive`
            : 'same cost'
        lines.push(`  ${comp.tier} → $${comp.estimatedCostUsd.toFixed(4)} (${savingsLabel})`)
      }
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Audit trail persistence
// ---------------------------------------------------------------------------

/**
 * Persist cost data to the audit trail as a JSONL entry.
 * Appends to `.buildpact/audit/costs.jsonl`.
 */
export async function persistToAudit(
  projectRoot: string,
  waveResults: TaskExecutionResult[][],
  profileTier: ProfileTier,
): Promise<void> {
  let totalTokens = 0
  let totalCost = 0
  let totalTasks = 0

  for (const wave of waveResults) {
    for (const task of wave) {
      totalTokens += task.tokensUsed ?? 0
      totalCost += task.costUsd ?? 0
      totalTasks++
    }
  }

  const entry = {
    ts: new Date().toISOString(),
    action: 'execute.cost',
    profileTier,
    totalTasks,
    totalTokens,
    totalCostUsd: totalCost,
    waveCount: waveResults.length,
  }

  const auditPath = join(projectRoot, '.buildpact', 'audit', 'costs.jsonl')
  await mkdir(dirname(auditPath), { recursive: true })
  await appendFile(auditPath, JSON.stringify(entry) + '\n', 'utf-8')
}
