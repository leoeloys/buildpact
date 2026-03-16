// Model Profile + Failover Chain — FR-604
// Contracts are stubs in Alpha — shapes stable from commit one

/** Available model profile tiers */
export type ProfileTier = 'quality' | 'balanced' | 'budget'

/** Configuration for a specific model */
export interface ModelConfig {
  provider: string
  modelId: string
  maxTokens: number
  /** Estimated cost per 1k output tokens in USD */
  costPer1kOutputUsd: number
}

/** A named model profile mapping tier to model config */
export interface ModelProfile {
  name: string
  tier: ProfileTier
  primary: ModelConfig
  /** Models to try in order if primary fails */
  failover: ModelConfig[]
}

/** Failover chain configuration for a pipeline phase */
export interface FailoverChain {
  phase: string
  models: ModelConfig[]
  /** Current index in the chain (0 = primary) */
  currentIndex: number
}
