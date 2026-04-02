/**
 * Smart Routing — model selection by task complexity.
 * Trivial tasks use cheap models; complex tasks get full-power models.
 * @module engine/smart-routing
 * @see BuildPact concept 18.2
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ComplexityTier, RoutingDecision } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Default model tiers
// ---------------------------------------------------------------------------

/** Default model mapping for each complexity tier */
export const DEFAULT_MODEL_TIERS: Record<ComplexityTier, string> = {
  trivial: 'haiku',
  simple: 'haiku',
  moderate: 'sonnet',
  complex: 'opus',
  expert: 'opus',
}

// ---------------------------------------------------------------------------
// Complexity assessment
// ---------------------------------------------------------------------------

/**
 * Assess task complexity from description length, file count, and token estimate.
 */
export function assessComplexity(
  taskDescription: string,
  fileCount: number,
  tokenEstimate: number,
): ComplexityTier {
  const descLength = taskDescription.length

  // Score from 0-100
  let score = 0

  // Description complexity (longer = more complex)
  if (descLength > 2000) score += 30
  else if (descLength > 500) score += 20
  else if (descLength > 100) score += 10

  // File count
  if (fileCount > 20) score += 30
  else if (fileCount > 10) score += 20
  else if (fileCount > 3) score += 10

  // Token estimate
  if (tokenEstimate > 50_000) score += 40
  else if (tokenEstimate > 10_000) score += 25
  else if (tokenEstimate > 2_000) score += 10

  if (score >= 80) return 'expert'
  if (score >= 60) return 'complex'
  if (score >= 35) return 'moderate'
  if (score >= 15) return 'simple'
  return 'trivial'
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

/** Available model descriptor */
export interface ModelDescriptor {
  name: string
  maxTokens: number
  costPer1k: number
}

/**
 * Select the best model for a complexity tier from available models.
 * Prefers the default tier model if available, otherwise picks closest match.
 */
export function selectModel(
  tier: ComplexityTier,
  availableModels: readonly ModelDescriptor[],
): Result<RoutingDecision> {
  if (availableModels.length === 0) {
    return err({
      code: ERROR_CODES.ROUTING_NO_MODEL_AVAILABLE,
      i18nKey: 'error.routing.no_model_available',
      params: { tier },
    })
  }

  const preferredName = DEFAULT_MODEL_TIERS[tier]

  // Try exact match first
  const exact = availableModels.find(m => m.name === preferredName)
  if (exact) {
    return ok({
      tier,
      selectedModel: exact.name,
      reason: `Default model for ${tier} tier`,
      estimatedCost: exact.costPer1k,
    })
  }

  // Fallback: pick cheapest for trivial/simple, most capable for complex/expert
  const sorted = [...availableModels].sort((a, b) => a.costPer1k - b.costPer1k)

  const selected = (tier === 'trivial' || tier === 'simple')
    ? sorted[0]!
    : sorted[sorted.length - 1]!

  return ok({
    tier,
    selectedModel: selected.name,
    reason: `Fallback: ${preferredName} not available, using ${selected.name}`,
    estimatedCost: selected.costPer1k,
  })
}
