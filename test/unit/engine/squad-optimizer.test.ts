import { describe, it, expect } from 'vitest'
import {
  createOptimizationSession,
  generateVariant,
  evaluateVariant,
  selectWinner,
} from '../../../src/engine/squad-optimizer.js'
import type {
  OptimizationConfig,
  OptimizationVariant,
  OptimizationSession,
} from '../../../src/engine/squad-optimizer.js'
import type { BenchmarkTask } from '../../../src/engine/benchmark-sets.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<OptimizationConfig>): OptimizationConfig {
  return {
    squadDir: '/tmp/test-squad',
    targetAgent: 'developer',
    metric: 'quality',
    variantCount: 3,
    budgetUsd: 1.0,
    ...overrides,
  }
}

function makeBenchmark(overrides?: Partial<BenchmarkTask>): BenchmarkTask {
  return {
    id: 'bench-01',
    name: 'Test Benchmark',
    domain: 'software',
    input: 'Write a function',
    expectedPatterns: ['function', 'return'],
    qualityRubric: { maxScore: 10, criteria: ['Works'] },
    maxCostUsd: 0.05,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createOptimizationSession
// ---------------------------------------------------------------------------

describe('createOptimizationSession', () => {
  it('initializes session with baseline variant', () => {
    const session = createOptimizationSession(makeConfig())
    expect(session.baseline.id).toBe('baseline')
    expect(session.baseline.metrics.mean).toBe(0)
    expect(session.variants).toEqual([])
    expect(session.winner).toBeNull()
  })

  it('sets branch name from agent and metric', () => {
    const session = createOptimizationSession(
      makeConfig({ targetAgent: 'architect', metric: 'speed' }),
    )
    expect(session.branchName).toBe('optimize/architect-speed')
  })

  it('sanitizes special characters in branch name', () => {
    const session = createOptimizationSession(
      makeConfig({ targetAgent: 'My Agent!@#' }),
    )
    expect(session.branchName).toMatch(/^optimize\/my-agent---/)
  })

  it('preserves config in session', () => {
    const config = makeConfig({ budgetUsd: 5.0, variantCount: 7 })
    const session = createOptimizationSession(config)
    expect(session.config).toEqual(config)
  })

  it('starts with zero spend', () => {
    const session = createOptimizationSession(makeConfig())
    expect(session.sessionSpendUsd).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// generateVariant
// ---------------------------------------------------------------------------

describe('generateVariant', () => {
  it('appends optimization marker to baseline', () => {
    const result = generateVariant('# Agent Definition', 'quality', 'v1')
    expect(result).toContain('# Agent Definition')
    expect(result).toContain('optimization-variant: v1')
    expect(result).toContain('metric: quality')
  })

  it('includes variant ID in marker', () => {
    const result = generateVariant('base', 'speed', 'variant-alpha')
    expect(result).toContain('variant-alpha')
  })

  it('preserves baseline content', () => {
    const baseline = '# Complex\n## Multi-line\nContent here'
    const result = generateVariant(baseline, 'cost', 'v2')
    expect(result).toContain(baseline)
  })

  it('produces different output for different variant IDs', () => {
    const a = generateVariant('base', 'quality', 'v1')
    const b = generateVariant('base', 'quality', 'v2')
    expect(a).not.toBe(b)
  })

  it('includes metric in the marker', () => {
    const result = generateVariant('base', 'cost', 'v1')
    expect(result).toContain('metric: cost')
  })
})

// ---------------------------------------------------------------------------
// evaluateVariant
// ---------------------------------------------------------------------------

describe('evaluateVariant', () => {
  it('returns zero metrics for empty benchmarks', () => {
    const variant: OptimizationVariant = {
      id: 'v1',
      agentContent: 'function return',
      metrics: { mean: 0, stdDev: 0, pValue: 1 },
      isSignificant: false,
    }
    const result = evaluateVariant(variant, [])
    expect(result.metrics.mean).toBe(0)
    expect(result.isSignificant).toBe(false)
  })

  it('scores based on pattern matching in agent content', () => {
    const variant: OptimizationVariant = {
      id: 'v1',
      agentContent: 'function that will return a value',
      metrics: { mean: 0, stdDev: 0, pValue: 1 },
      isSignificant: false,
    }
    const result = evaluateVariant(variant, [makeBenchmark()])
    expect(result.metrics.mean).toBeGreaterThan(0)
  })

  it('gives zero score when no patterns match', () => {
    const variant: OptimizationVariant = {
      id: 'v1',
      agentContent: 'nothing matches here',
      metrics: { mean: 0, stdDev: 0, pValue: 1 },
      isSignificant: false,
    }
    const task = makeBenchmark({ expectedPatterns: ['xyznotfound'] })
    const result = evaluateVariant(variant, [task])
    expect(result.metrics.mean).toBe(0)
  })

  it('computes stdDev across multiple benchmarks', () => {
    const variant: OptimizationVariant = {
      id: 'v1',
      agentContent: 'function code',
      metrics: { mean: 0, stdDev: 0, pValue: 1 },
      isSignificant: false,
    }
    const tasks = [
      makeBenchmark({ id: 'a', expectedPatterns: ['function'] }),
      makeBenchmark({ id: 'b', expectedPatterns: ['notfound'] }),
    ]
    const result = evaluateVariant(variant, tasks)
    expect(result.metrics.stdDev).toBeGreaterThan(0)
  })

  it('caps score at maxScore', () => {
    const variant: OptimizationVariant = {
      id: 'v1',
      agentContent: 'function return everything',
      metrics: { mean: 0, stdDev: 0, pValue: 1 },
      isSignificant: false,
    }
    const task = makeBenchmark({
      expectedPatterns: ['function', 'return'],
      qualityRubric: { maxScore: 10, criteria: ['ok'] },
    })
    const result = evaluateVariant(variant, [task])
    expect(result.metrics.mean).toBeLessThanOrEqual(10)
  })
})

// ---------------------------------------------------------------------------
// selectWinner
// ---------------------------------------------------------------------------

describe('selectWinner', () => {
  it('returns null when no variants exist', () => {
    const session: OptimizationSession = {
      config: makeConfig(),
      baseline: {
        id: 'baseline',
        agentContent: '',
        metrics: { mean: 5, stdDev: 1, pValue: 1 },
        isSignificant: false,
      },
      variants: [],
      winner: null,
      sessionSpendUsd: 0,
      branchName: 'optimize/dev-quality',
    }
    expect(selectWinner(session)).toBeNull()
  })

  it('returns null when no variant is significant', () => {
    const session: OptimizationSession = {
      config: makeConfig(),
      baseline: {
        id: 'baseline',
        agentContent: '',
        metrics: { mean: 5, stdDev: 1, pValue: 1 },
        isSignificant: false,
      },
      variants: [
        {
          id: 'v1',
          agentContent: '',
          metrics: { mean: 8, stdDev: 1, pValue: 0.1 },
          isSignificant: false,
        },
      ],
      winner: null,
      sessionSpendUsd: 0,
      branchName: 'optimize/dev-quality',
    }
    expect(selectWinner(session)).toBeNull()
  })

  it('returns null when significant variant scores below baseline', () => {
    const session: OptimizationSession = {
      config: makeConfig(),
      baseline: {
        id: 'baseline',
        agentContent: '',
        metrics: { mean: 9, stdDev: 1, pValue: 1 },
        isSignificant: false,
      },
      variants: [
        {
          id: 'v1',
          agentContent: '',
          metrics: { mean: 3, stdDev: 0.5, pValue: 0.01 },
          isSignificant: true,
        },
      ],
      winner: null,
      sessionSpendUsd: 0,
      branchName: 'optimize/dev-quality',
    }
    expect(selectWinner(session)).toBeNull()
  })

  it('selects the best significant variant above baseline', () => {
    const session: OptimizationSession = {
      config: makeConfig(),
      baseline: {
        id: 'baseline',
        agentContent: '',
        metrics: { mean: 5, stdDev: 1, pValue: 1 },
        isSignificant: false,
      },
      variants: [
        {
          id: 'v1',
          agentContent: 'improved',
          metrics: { mean: 7, stdDev: 0.5, pValue: 0.02 },
          isSignificant: true,
        },
        {
          id: 'v2',
          agentContent: 'best',
          metrics: { mean: 9, stdDev: 0.3, pValue: 0.01 },
          isSignificant: true,
        },
      ],
      winner: null,
      sessionSpendUsd: 0,
      branchName: 'optimize/dev-quality',
    }
    const winner = selectWinner(session)
    expect(winner).not.toBeNull()
    expect(winner!.id).toBe('v2')
  })

  it('picks single significant variant when only one qualifies', () => {
    const session: OptimizationSession = {
      config: makeConfig(),
      baseline: {
        id: 'baseline',
        agentContent: '',
        metrics: { mean: 5, stdDev: 1, pValue: 1 },
        isSignificant: false,
      },
      variants: [
        {
          id: 'v1',
          agentContent: '',
          metrics: { mean: 6, stdDev: 0.4, pValue: 0.03 },
          isSignificant: true,
        },
        {
          id: 'v2',
          agentContent: '',
          metrics: { mean: 8, stdDev: 1, pValue: 0.2 },
          isSignificant: false,
        },
      ],
      winner: null,
      sessionSpendUsd: 0,
      branchName: 'optimize/dev-quality',
    }
    const winner = selectWinner(session)
    expect(winner!.id).toBe('v1')
  })
})
