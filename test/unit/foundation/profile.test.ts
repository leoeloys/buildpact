import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  loadProfile,
  resolveModelForPhase,
  resolveModelForOperation,
  executeWithFailover,
} from '../../../src/foundation/profile.js'
import type { FailoverChain, ModelProfile } from '../../../src/contracts/profile.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMPLATES_DIR = resolve(process.cwd(), 'templates')

/** Create a temp project dir with a .buildpact/profiles/ subfolder. */
async function makeTmpProject(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), 'buildpact-profile-'))
  await mkdir(join(tmp, '.buildpact', 'profiles'), { recursive: true })
  return tmp
}

/** Write a minimal profile YAML file to the temp project. */
async function writeProfileYaml(projectDir: string, name: string, yaml: string): Promise<void> {
  await writeFile(join(projectDir, '.buildpact', 'profiles', `${name}.yaml`), yaml, 'utf-8')
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(async () => {
  tmpDir = await makeTmpProject()
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// loadProfile
// ---------------------------------------------------------------------------

describe('loadProfile', () => {
  it('returns a valid ModelProfile for the quality template', async () => {
    // Copy quality.yaml from templates for this test
    const qualityYaml = await (await import('node:fs/promises')).readFile(
      join(TEMPLATES_DIR, 'profiles', 'quality.yaml'),
      'utf-8',
    )
    await writeProfileYaml(tmpDir, 'quality', qualityYaml)

    const result = await loadProfile('quality', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.name).toBe('quality')
    expect(typeof result.value.phases).toBe('object')
    expect(result.value.phases['research']).toBeDefined()
    expect(result.value.phases['plan']).toBeDefined()
    expect(result.value.phases['execute']).toBeDefined()
    expect(result.value.phases['verify']).toBeDefined()
    expect(result.value.phases['specify']).toBeDefined()
  })

  it('resolves "default" to the balanced profile', async () => {
    const balancedYaml = await (await import('node:fs/promises')).readFile(
      join(TEMPLATES_DIR, 'profiles', 'balanced.yaml'),
      'utf-8',
    )
    await writeProfileYaml(tmpDir, 'balanced', balancedYaml)

    const result = await loadProfile('default', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.name).toBe('balanced')
  })

  it('returns ok: false with CliError when profile file does not exist', async () => {
    const result = await loadProfile('nonexistent', tmpDir)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('FILE_READ_FAILED')
  })

  it('returns ok: false with CliError when YAML schema is invalid', async () => {
    await writeProfileYaml(tmpDir, 'broken', '# missing required fields\nfoo: bar\n')

    const result = await loadProfile('broken', tmpDir)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('CONFIG_INVALID')
  })

  it('parses phases.primary and failover correctly', async () => {
    const yaml = [
      'name: test',
      'phases:',
      '  research:',
      '    primary: "claude-sonnet-4-6"',
      '    failover:',
      '      models: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]',
      '      retry_delay_ms: 500',
      '      max_wait_ms: 15000',
    ].join('\n')
    await writeProfileYaml(tmpDir, 'test', yaml)

    const result = await loadProfile('test', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const research = result.value.phases['research']
    expect(research?.primary).toBe('claude-sonnet-4-6')
    expect(research?.failover.models).toEqual(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'])
    expect(research?.failover.retry_delay_ms).toBe(500)
    expect(research?.failover.max_wait_ms).toBe(15000)
  })

  it('parses per-phase operations array correctly', async () => {
    const yaml = [
      'name: test',
      'phases:',
      '  plan:',
      '    primary: "claude-opus-4-6"',
      '    failover:',
      '      models: ["claude-opus-4-6"]',
      '      retry_delay_ms: 1000',
      '      max_wait_ms: 30000',
      '    operations:',
      '      - operation: research',
      '        model: "claude-opus-4-6"',
      '      - operation: plan-writing',
      '        model: "claude-sonnet-4-6"',
    ].join('\n')
    await writeProfileYaml(tmpDir, 'test', yaml)

    const result = await loadProfile('test', tmpDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ops = result.value.phases['plan']?.operations
    expect(ops).toBeDefined()
    expect(ops?.find(o => o.operation === 'research')?.model).toBe('claude-opus-4-6')
    expect(ops?.find(o => o.operation === 'plan-writing')?.model).toBe('claude-sonnet-4-6')
  })
})

// ---------------------------------------------------------------------------
// resolveModelForPhase
// ---------------------------------------------------------------------------

describe('resolveModelForPhase', () => {
  const profile: ModelProfile = {
    name: 'test',
    phases: {
      research: {
        primary: 'claude-opus-4-6',
        failover: { models: ['claude-opus-4-6'], retry_delay_ms: 0, max_wait_ms: 0 },
      },
      plan: {
        primary: 'claude-sonnet-4-6',
        failover: { models: ['claude-sonnet-4-6'], retry_delay_ms: 0, max_wait_ms: 0 },
      },
    },
  }

  it('returns the primary model for a known phase', () => {
    expect(resolveModelForPhase(profile, 'research')).toBe('claude-opus-4-6')
    expect(resolveModelForPhase(profile, 'plan')).toBe('claude-sonnet-4-6')
  })

  it('falls back to first phase primary when phase is unknown', () => {
    const result = resolveModelForPhase(profile, 'unknown-phase')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// resolveModelForOperation
// ---------------------------------------------------------------------------

describe('resolveModelForOperation', () => {
  const profile: ModelProfile = {
    name: 'test',
    phases: {
      plan: {
        primary: 'claude-opus-4-6',
        failover: { models: ['claude-opus-4-6'], retry_delay_ms: 0, max_wait_ms: 0 },
        operations: [
          { operation: 'research', model: 'claude-opus-4-6' },
          { operation: 'plan-writing', model: 'claude-sonnet-4-6' },
        ],
      },
    },
  }

  it('returns the operation-specific model when configured', () => {
    expect(resolveModelForOperation(profile, 'plan', 'research')).toBe('claude-opus-4-6')
    expect(resolveModelForOperation(profile, 'plan', 'plan-writing')).toBe('claude-sonnet-4-6')
  })

  it('falls back to phase primary when operation is not defined', () => {
    expect(resolveModelForOperation(profile, 'plan', 'validation')).toBe('claude-opus-4-6')
  })

  it('falls back gracefully when phase is unknown', () => {
    const result = resolveModelForOperation(profile, 'unknown', 'research')
    expect(typeof result).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// executeWithFailover
// ---------------------------------------------------------------------------

describe('executeWithFailover', () => {
  it('returns ok result from primary model when it succeeds', async () => {
    const chain: FailoverChain = {
      models: ['model-a', 'model-b'],
      retry_delay_ms: 0,
      max_wait_ms: 1000,
    }
    const fn = vi.fn().mockResolvedValue('success-from-model-a')

    const result = await executeWithFailover(chain, fn)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('success-from-model-a')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('model-a')
  })

  it('tries secondary model when primary fails', async () => {
    const chain: FailoverChain = {
      models: ['model-a', 'model-b'],
      retry_delay_ms: 0,
      max_wait_ms: 1000,
    }
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('model-a unavailable'))
      .mockResolvedValueOnce('success-from-model-b')

    const result = await executeWithFailover(chain, fn)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('success-from-model-b')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 'model-a')
    expect(fn).toHaveBeenNthCalledWith(2, 'model-b')
  })

  it('returns err when all models in the chain fail', async () => {
    const chain: FailoverChain = {
      models: ['model-a', 'model-b'],
      retry_delay_ms: 0,
      max_wait_ms: 1000,
    }
    const fn = vi.fn().mockRejectedValue(new Error('unavailable'))

    const result = await executeWithFailover(chain, fn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FAILOVER_EXHAUSTED')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('returns err with FAILOVER_EXHAUSTED code after chain is exhausted', async () => {
    const chain: FailoverChain = {
      models: ['only-model'],
      retry_delay_ms: 0,
      max_wait_ms: 1000,
    }
    const fn = vi.fn().mockRejectedValue(new Error('critical failure'))

    const result = await executeWithFailover(chain, fn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FAILOVER_EXHAUSTED')
  })

  it('passes the model name to the function on each attempt', async () => {
    const chain: FailoverChain = {
      models: ['first', 'second', 'third'],
      retry_delay_ms: 0,
      max_wait_ms: 5000,
    }
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('first failed'))
      .mockRejectedValueOnce(new Error('second failed'))
      .mockResolvedValueOnce('third succeeded')

    const result = await executeWithFailover(chain, fn)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('third succeeded')
    expect(fn).toHaveBeenCalledWith('first')
    expect(fn).toHaveBeenCalledWith('second')
    expect(fn).toHaveBeenCalledWith('third')
  })
})
