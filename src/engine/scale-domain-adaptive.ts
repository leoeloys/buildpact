/**
 * Scale-Domain Adaptive — automatic complexity detection and flow recommendation.
 * Small projects skip formality; large projects get full ceremony.
 * @module engine/scale-domain-adaptive
 * @see BuildPact concept 10.8
 */

import type { ComplexityTier } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Complexity detection
// ---------------------------------------------------------------------------

/** Thresholds for complexity tier classification */
interface TierThresholds {
  maxFiles: number
  maxRequirements: number
  maxIntegrations: number
}

const TIER_THRESHOLDS: Record<ComplexityTier, TierThresholds> = {
  trivial: { maxFiles: 5, maxRequirements: 3, maxIntegrations: 0 },
  simple: { maxFiles: 20, maxRequirements: 10, maxIntegrations: 1 },
  moderate: { maxFiles: 100, maxRequirements: 30, maxIntegrations: 5 },
  complex: { maxFiles: 500, maxRequirements: 100, maxIntegrations: 15 },
  expert: { maxFiles: Infinity, maxRequirements: Infinity, maxIntegrations: Infinity },
}

/**
 * Detect project complexity tier from quantitative signals.
 */
export function detectComplexity(
  fileCount: number,
  requirementCount: number,
  integrationCount: number,
): ComplexityTier {
  const tiers: ComplexityTier[] = ['trivial', 'simple', 'moderate', 'complex', 'expert']

  for (const tier of tiers) {
    const t = TIER_THRESHOLDS[tier]
    if (fileCount <= t.maxFiles && requirementCount <= t.maxRequirements && integrationCount <= t.maxIntegrations) {
      return tier
    }
  }

  return 'expert'
}

// ---------------------------------------------------------------------------
// Flow recommendation
// ---------------------------------------------------------------------------

/** Recommended pipeline flow for a complexity tier */
export interface FlowRecommendation {
  skipSpec: boolean
  skipClarify: boolean
  skipResearch: boolean
  planDepth: 'shallow' | 'standard' | 'deep'
}

const FLOW_MAP: Record<ComplexityTier, FlowRecommendation> = {
  trivial: { skipSpec: true, skipClarify: true, skipResearch: true, planDepth: 'shallow' },
  simple: { skipSpec: false, skipClarify: true, skipResearch: true, planDepth: 'shallow' },
  moderate: { skipSpec: false, skipClarify: false, skipResearch: false, planDepth: 'standard' },
  complex: { skipSpec: false, skipClarify: false, skipResearch: false, planDepth: 'deep' },
  expert: { skipSpec: false, skipClarify: false, skipResearch: false, planDepth: 'deep' },
}

/**
 * Recommend pipeline flow based on complexity tier.
 */
export function recommendFlow(tier: ComplexityTier): FlowRecommendation {
  return { ...FLOW_MAP[tier] }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a human-readable recommendation for the detected tier.
 */
export function formatRecommendation(tier: ComplexityTier, flow: FlowRecommendation): string {
  const skips: string[] = []
  if (flow.skipSpec) skips.push('spec')
  if (flow.skipClarify) skips.push('clarify')
  if (flow.skipResearch) skips.push('research')

  const skipText = skips.length > 0 ? `Skip: ${skips.join(', ')}` : 'No phases skipped'
  return `Complexity: ${tier.toUpperCase()} | Plan depth: ${flow.planDepth} | ${skipText}`
}
