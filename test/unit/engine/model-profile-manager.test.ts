import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseModelProfiles,
  readActiveProfileTier,
  resolveModelForOperation,
  buildFailoverChain,
  advanceFailover,
  getCurrentModel,
  MODEL_CATALOG,
} from '../../../src/engine/model-profile-manager.js'

// ---------------------------------------------------------------------------
// parseModelProfiles
// ---------------------------------------------------------------------------

describe('parseModelProfiles', () => {
  it('returns balanced as default active tier when no config provided', () => {
    const result = parseModelProfiles('language: en')
    expect(result.activeTier).toBe('balanced')
  })

  it('reads active tier from model_profile_active key', () => {
    const result = parseModelProfiles('model_profile_active: quality')
    expect(result.activeTier).toBe('quality')
  })

  it('reads budget tier correctly', () => {
    const result = parseModelProfiles('model_profile_active: budget')
    expect(result.activeTier).toBe('budget')
  })

  it('falls back to balanced for unknown tier value', () => {
    const result = parseModelProfiles('model_profile_active: unknown-tier')
    expect(result.activeTier).toBe('balanced')
  })

  it('includes all three tiers in profiles', () => {
    const result = parseModelProfiles('')
    expect(result.profiles.quality).toBeDefined()
    expect(result.profiles.balanced).toBeDefined()
    expect(result.profiles.budget).toBeDefined()
  })

  it('quality default uses opus for research', () => {
    const result = parseModelProfiles('')
    const model = result.profiles.quality.operationModels.research
    expect(model.modelId).toBe('claude-opus-4-6')
  })

  it('quality default uses sonnet for plan_writing', () => {
    const result = parseModelProfiles('')
    const model = result.profiles.quality.operationModels.plan_writing
    expect(model.modelId).toBe('claude-sonnet-4-6')
  })

  it('balanced default uses sonnet for all operations', () => {
    const result = parseModelProfiles('')
    const ops = result.profiles.balanced.operationModels
    expect(ops.research.modelId).toBe('claude-sonnet-4-6')
    expect(ops.plan_writing.modelId).toBe('claude-sonnet-4-6')
    expect(ops.default.modelId).toBe('claude-sonnet-4-6')
  })

  it('budget default uses haiku for all operations', () => {
    const result = parseModelProfiles('')
    const ops = result.profiles.budget.operationModels
    expect(ops.research.modelId).toBe('claude-haiku-4-5-20251001')
    expect(ops.default.modelId).toBe('claude-haiku-4-5-20251001')
  })

  it('overrides a specific operation model when key is present', () => {
    const yaml = 'model_profile_balanced_research: claude-opus-4-6'
    const result = parseModelProfiles(yaml)
    expect(result.profiles.balanced.operationModels.research.modelId).toBe('claude-opus-4-6')
    // other ops unchanged
    expect(result.profiles.balanced.operationModels.plan_writing.modelId).toBe('claude-sonnet-4-6')
  })

  it('ignores unknown model IDs in operation override', () => {
    const yaml = 'model_profile_quality_research: gpt-9000'
    const result = parseModelProfiles(yaml)
    // should keep default (opus) since gpt-9000 not in catalog
    expect(result.profiles.quality.operationModels.research.modelId).toBe('claude-opus-4-6')
  })

  it('parses custom failover chain from comma-separated list', () => {
    const yaml = 'model_profile_quality_failover: claude-haiku-4-5-20251001'
    const result = parseModelProfiles(yaml)
    expect(result.profiles.quality.failoverChain).toHaveLength(1)
    expect(result.profiles.quality.failoverChain[0].modelId).toBe('claude-haiku-4-5-20251001')
  })

  it('sets empty failover chain when key is present but empty', () => {
    const yaml = 'model_profile_budget_failover: '
    const result = parseModelProfiles(yaml)
    expect(result.profiles.budget.failoverChain).toHaveLength(0)
  })

  it('reads custom retry_delay_ms', () => {
    const yaml = 'model_profile_retry_delay_ms: 2500'
    const result = parseModelProfiles(yaml)
    expect(result.profiles.quality.retryDelayMs).toBe(2500)
  })

  it('reads custom max_wait_ms', () => {
    const yaml = 'model_profile_max_wait_ms: 60000'
    const result = parseModelProfiles(yaml)
    expect(result.profiles.balanced.maxWaitMs).toBe(60000)
  })
})

// ---------------------------------------------------------------------------
// readActiveProfileTier
// ---------------------------------------------------------------------------

describe('readActiveProfileTier', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-profile-test-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns balanced when config.yaml is missing', async () => {
    const tier = await readActiveProfileTier(tmpDir)
    expect(tier).toBe('balanced')
  })

  it('returns quality when config.yaml has model_profile_active: quality', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'language: en\nmodel_profile_active: quality\n',
    )
    const tier = await readActiveProfileTier(tmpDir)
    expect(tier).toBe('quality')
  })

  it('returns budget when configured', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'model_profile_active: budget\n',
    )
    const tier = await readActiveProfileTier(tmpDir)
    expect(tier).toBe('budget')
  })

  it('returns balanced when key is absent from config', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'language: en\n')
    const tier = await readActiveProfileTier(tmpDir)
    expect(tier).toBe('balanced')
  })
})

// ---------------------------------------------------------------------------
// resolveModelForOperation
// ---------------------------------------------------------------------------

describe('resolveModelForOperation', () => {
  const config = parseModelProfiles('')

  it('returns opus for quality research', () => {
    const model = resolveModelForOperation(config, 'quality', 'research')
    expect(model.modelId).toBe('claude-opus-4-6')
  })

  it('returns sonnet for quality plan_writing', () => {
    const model = resolveModelForOperation(config, 'quality', 'plan_writing')
    expect(model.modelId).toBe('claude-sonnet-4-6')
  })

  it('returns sonnet for balanced default', () => {
    const model = resolveModelForOperation(config, 'balanced', 'default')
    expect(model.modelId).toBe('claude-sonnet-4-6')
  })

  it('returns haiku for budget execution', () => {
    const model = resolveModelForOperation(config, 'budget', 'execution')
    expect(model.modelId).toBe('claude-haiku-4-5-20251001')
  })
})

// ---------------------------------------------------------------------------
// buildFailoverChain
// ---------------------------------------------------------------------------

describe('buildFailoverChain', () => {
  const config = parseModelProfiles('')

  it('starts at index 0', () => {
    const chain = buildFailoverChain(config, 'quality', 'research')
    expect(chain.currentIndex).toBe(0)
  })

  it('phase label matches input', () => {
    const chain = buildFailoverChain(config, 'balanced', 'plan_writing')
    expect(chain.phase).toBe('plan_writing')
  })

  it('quality research chain starts with opus as primary', () => {
    const chain = buildFailoverChain(config, 'quality', 'research')
    expect(chain.models[0].modelId).toBe('claude-opus-4-6')
  })

  it('quality chain has failover models after primary', () => {
    const chain = buildFailoverChain(config, 'quality', 'research')
    // default quality failover: sonnet, haiku
    expect(chain.models).toHaveLength(3)
    expect(chain.models[1].modelId).toBe('claude-sonnet-4-6')
    expect(chain.models[2].modelId).toBe('claude-haiku-4-5-20251001')
  })

  it('budget chain has only primary (empty failover)', () => {
    const chain = buildFailoverChain(config, 'budget', 'execution')
    expect(chain.models).toHaveLength(1)
    expect(chain.models[0].modelId).toBe('claude-haiku-4-5-20251001')
  })

  it('unknown phase falls back to default operation model', () => {
    const chain = buildFailoverChain(config, 'balanced', 'unknown_phase')
    expect(chain.models[0].modelId).toBe('claude-sonnet-4-6')
  })
})

// ---------------------------------------------------------------------------
// getCurrentModel
// ---------------------------------------------------------------------------

describe('getCurrentModel', () => {
  it('returns first model when currentIndex is 0', () => {
    const chain = buildFailoverChain(parseModelProfiles(''), 'quality', 'research')
    const model = getCurrentModel(chain)
    expect(model.modelId).toBe('claude-opus-4-6')
  })

  it('returns correct model after advancing', () => {
    const config = parseModelProfiles('')
    const chain = buildFailoverChain(config, 'quality', 'research')
    const result = advanceFailover(chain)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const model = getCurrentModel(result.value)
      expect(model.modelId).toBe('claude-sonnet-4-6')
    }
  })
})

// ---------------------------------------------------------------------------
// advanceFailover
// ---------------------------------------------------------------------------

describe('advanceFailover', () => {
  const config = parseModelProfiles('')

  it('advances index by 1 on success', () => {
    const chain = buildFailoverChain(config, 'quality', 'research')
    const result = advanceFailover(chain)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.currentIndex).toBe(1)
  })

  it('returns FAILOVER_EXHAUSTED when chain is at last model', () => {
    const chain = buildFailoverChain(config, 'budget', 'execution')
    // budget has only 1 model — advancing from 0 exhausts chain
    const result = advanceFailover(chain)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FAILOVER_EXHAUSTED')
  })

  it('FAILOVER_EXHAUSTED error includes phase in params', () => {
    const chain = buildFailoverChain(config, 'budget', 'verification')
    const result = advanceFailover(chain)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.params?.['phase']).toBe('verification')
  })

  it('can advance through all models in quality chain', () => {
    const chain = buildFailoverChain(config, 'quality', 'research')
    // 3 models total (opus + sonnet + haiku)
    const r1 = advanceFailover(chain)
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    const r2 = advanceFailover(r1.value)
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    // now exhausted
    const r3 = advanceFailover(r2.value)
    expect(r3.ok).toBe(false)
  })

  it('does not mutate the original chain', () => {
    const chain = buildFailoverChain(config, 'quality', 'research')
    advanceFailover(chain)
    expect(chain.currentIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// MODEL_CATALOG
// ---------------------------------------------------------------------------

describe('MODEL_CATALOG', () => {
  it('contains claude-opus-4-6 with correct provider', () => {
    expect(MODEL_CATALOG['claude-opus-4-6'].provider).toBe('anthropic')
  })

  it('contains claude-sonnet-4-6', () => {
    expect(MODEL_CATALOG['claude-sonnet-4-6']).toBeDefined()
  })

  it('contains claude-haiku-4-5-20251001', () => {
    expect(MODEL_CATALOG['claude-haiku-4-5-20251001']).toBeDefined()
  })
})
