/**
 * Model Profile Manager — configure quality/balanced/budget model profiles
 * with per-operation routing and automatic failover chains.
 * @module engine/model-profile-manager
 * @see FR-604 — Model Profile Configuration
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ProfileTier, ModelConfig, FailoverChain } from '../contracts/profile.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Operation types within a pipeline phase for per-operation model routing */
export type OperationType =
  | 'research'
  | 'plan_writing'
  | 'execution'
  | 'verification'
  | 'default'

/** Configuration for a single profile tier including per-operation routing */
export interface TierProfile {
  /** Maps each operation type to its primary model */
  operationModels: Record<OperationType, ModelConfig>
  /** Ordered list of fallback models to try when the primary fails */
  failoverChain: ModelConfig[]
  /** Milliseconds to wait before retrying with the next model */
  retryDelayMs: number
  /** Maximum total milliseconds to spend on failover attempts */
  maxWaitMs: number
}

/** Parsed model profile configuration (from config.yaml) */
export interface ProfileConfig {
  activeTier: ProfileTier
  profiles: Record<ProfileTier, TierProfile>
}

// ---------------------------------------------------------------------------
// Built-in model catalog
// ---------------------------------------------------------------------------

/** Known Anthropic models with cost and token information */
export const MODEL_CATALOG: Record<string, ModelConfig> = {
  'claude-opus-4-6': {
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    maxTokens: 8192,
    costPer1kOutputUsd: 0.075,
  },
  'claude-sonnet-4-6': {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    maxTokens: 8192,
    costPer1kOutputUsd: 0.015,
  },
  'claude-haiku-4-5-20251001': {
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    maxTokens: 8192,
    costPer1kOutputUsd: 0.00125,
  },
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RETRY_DELAY_MS = 1000
const DEFAULT_MAX_WAIT_MS = 30000

const ALL_OPS: OperationType[] = [
  'research',
  'plan_writing',
  'execution',
  'verification',
  'default',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a uniform operation map using the same model for all operations */
function uniformOps(model: ModelConfig): Record<OperationType, ModelConfig> {
  return {
    research: model,
    plan_writing: model,
    execution: model,
    verification: model,
    default: model,
  }
}

// ---------------------------------------------------------------------------
// Default profiles — used when config.yaml has no model_profile_* keys
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-non-null-assertion */
const DEFAULT_PROFILES: Record<ProfileTier, TierProfile> = {
  quality: {
    operationModels: {
      ...uniformOps(MODEL_CATALOG['claude-sonnet-4-6']!),
      research: MODEL_CATALOG['claude-opus-4-6']!,
      execution: MODEL_CATALOG['claude-opus-4-6']!,
    },
    failoverChain: [
      MODEL_CATALOG['claude-sonnet-4-6']!,
      MODEL_CATALOG['claude-haiku-4-5-20251001']!,
    ],
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    maxWaitMs: DEFAULT_MAX_WAIT_MS,
  },
  balanced: {
    operationModels: uniformOps(MODEL_CATALOG['claude-sonnet-4-6']!),
    failoverChain: [MODEL_CATALOG['claude-haiku-4-5-20251001']!],
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    maxWaitMs: 20000,
  },
  budget: {
    operationModels: uniformOps(MODEL_CATALOG['claude-haiku-4-5-20251001']!),
    failoverChain: [],
    retryDelayMs: 2000,
    maxWaitMs: 10000,
  },
}
/* eslint-enable @typescript-eslint/no-non-null-assertion */

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Parse model profile configuration from config.yaml content.
 * Reads `model_profile_*` flat keys and merges with defaults.
 * Falls back to built-in defaults for any unconfigured tier or operation.
 *
 * Supported config.yaml keys (all optional):
 *   model_profile_active: quality|balanced|budget
 *   model_profile_retry_delay_ms: <number>
 *   model_profile_max_wait_ms: <number>
 *   model_profile_<tier>_<operation>: <modelId>      (e.g. model_profile_quality_research)
 *   model_profile_<tier>_failover: <modelId1>,<modelId2>,...
 */
export function parseModelProfiles(configYaml: string): ProfileConfig {
  const kv: Record<string, string> = {}
  for (const raw of configYaml.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (key) kv[key] = value
  }

  const rawTier = kv['model_profile_active']
  const activeTier: ProfileTier =
    rawTier === 'quality' || rawTier === 'balanced' || rawTier === 'budget'
      ? rawTier
      : 'balanced'

  const retryDelayMs = kv['model_profile_retry_delay_ms']
    ? parseInt(kv['model_profile_retry_delay_ms'], 10)
    : DEFAULT_RETRY_DELAY_MS
  const maxWaitMs = kv['model_profile_max_wait_ms']
    ? parseInt(kv['model_profile_max_wait_ms'], 10)
    : DEFAULT_MAX_WAIT_MS

  const tiers: ProfileTier[] = ['quality', 'balanced', 'budget']
  const profiles = {} as Record<ProfileTier, TierProfile>

  for (const tier of tiers) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const defaults = DEFAULT_PROFILES[tier]!
    const operationModels = { ...defaults.operationModels }

    for (const op of ALL_OPS) {
      const key = `model_profile_${tier}_${op}`
      if (kv[key]) {
        const catalog = MODEL_CATALOG[kv[key]]
        if (catalog) {
          operationModels[op] = catalog
        }
      }
    }

    const failoverKey = `model_profile_${tier}_failover`
    let failoverChain: ModelConfig[] = [...defaults.failoverChain]
    if (kv[failoverKey] !== undefined) {
      if (kv[failoverKey] === '') {
        failoverChain = []
      } else {
        failoverChain = kv[failoverKey]
          .split(',')
          .map((id) => id.trim())
          .filter((id) => MODEL_CATALOG[id] !== undefined)
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          .map((id) => MODEL_CATALOG[id]!)
      }
    }

    profiles[tier] = {
      operationModels,
      failoverChain,
      retryDelayMs,
      maxWaitMs,
    }
  }

  return { activeTier, profiles }
}

/**
 * Read the active model profile tier from .buildpact/config.yaml.
 * Returns 'balanced' if the file is missing or the key is absent.
 */
export async function readActiveProfileTier(projectDir: string): Promise<ProfileTier> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const raw of content.split('\n')) {
      const line = raw.trim()
      if (line.startsWith('model_profile_active:')) {
        const value = line
          .slice('model_profile_active:'.length)
          .trim()
          .replace(/^["']|["']$/g, '')
        if (value === 'quality' || value === 'balanced' || value === 'budget') return value
      }
    }
  } catch {
    // file not found or unreadable — use default
  }
  return 'balanced'
}

/**
 * Resolve the ModelConfig for a specific operation within a tier.
 * Falls back to the 'default' operation model when the operation has no dedicated config.
 */
export function resolveModelForOperation(
  config: ProfileConfig,
  tier: ProfileTier,
  operation: OperationType,
): ModelConfig {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const profile = config.profiles[tier]!
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return profile.operationModels[operation] ?? profile.operationModels.default!
}

/**
 * Build a FailoverChain for the given tier and phase.
 * The chain starts with the primary model for that phase, then the tier's failover models.
 */
export function buildFailoverChain(
  config: ProfileConfig,
  tier: ProfileTier,
  phase: string,
): FailoverChain {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const profile = config.profiles[tier]!
  const op: OperationType = ALL_OPS.includes(phase as OperationType)
    ? (phase as OperationType)
    : 'default'
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const primary = profile.operationModels[op]!
  const models = [primary, ...profile.failoverChain]
  return { phase, models, currentIndex: 0 }
}

/**
 * Get the currently active ModelConfig from a failover chain.
 */
export function getCurrentModel(chain: FailoverChain): ModelConfig {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return chain.models[chain.currentIndex]!
}

/**
 * Advance the failover chain to the next model in the chain.
 * Returns an error with FAILOVER_EXHAUSTED if no more models are available.
 */
export function advanceFailover(chain: FailoverChain): Result<FailoverChain> {
  const nextIndex = chain.currentIndex + 1
  if (nextIndex >= chain.models.length) {
    return err({
      code: ERROR_CODES.FAILOVER_EXHAUSTED,
      i18nKey: 'error.model.failover_exhausted',
      params: { phase: chain.phase },
    })
  }
  return ok({ ...chain, currentIndex: nextIndex })
}
