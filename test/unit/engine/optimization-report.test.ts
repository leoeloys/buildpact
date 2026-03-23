import { describe, it, expect } from 'vitest'
import {
  generateReport,
  generateJsonResults,
  formatStatSignificance,
} from '../../../src/engine/optimization-report.js'
import type {
  OptimizationSession,
  OptimizationVariant,
  OptimizationConfig,
} from '../../../src/engine/squad-optimizer.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides?: Partial<OptimizationSession>): OptimizationSession {
  const config: OptimizationConfig = {
    squadDir: '/tmp/squad',
    targetAgent: 'developer',
    metric: 'quality',
    variantCount: 2,
    budgetUsd: 1.0,
  }

  const baseline: OptimizationVariant = {
    id: 'baseline',
    agentContent: '# Baseline',
    metrics: { mean: 5.0, stdDev: 1.0, pValue: 1.0 },
    isSignificant: false,
  }

  return {
    config,
    baseline,
    variants: [],
    winner: null,
    sessionSpendUsd: 0.25,
    branchName: 'optimize/developer-quality',
    ...overrides,
  }
}

function makeVariant(overrides?: Partial<OptimizationVariant>): OptimizationVariant {
  return {
    id: 'v1',
    agentContent: '# Variant',
    metrics: { mean: 7.5, stdDev: 0.5, pValue: 0.03 },
    isSignificant: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// formatStatSignificance
// ---------------------------------------------------------------------------

describe('formatStatSignificance', () => {
  it('reports significant for p < 0.05', () => {
    const result = formatStatSignificance(0.02)
    expect(result).toBe('Statistically significant (p=0.02)')
  })

  it('reports not significant for p >= 0.05', () => {
    const result = formatStatSignificance(0.15)
    expect(result).toBe('Not statistically significant (p=0.15)')
  })

  it('reports not significant for p = 0.05 (boundary)', () => {
    const result = formatStatSignificance(0.05)
    expect(result).toBe('Not statistically significant (p=0.05)')
  })

  it('handles p = 0', () => {
    const result = formatStatSignificance(0)
    expect(result).toBe('Statistically significant (p=0.00)')
  })

  it('handles p = 1', () => {
    const result = formatStatSignificance(1.0)
    expect(result).toBe('Not statistically significant (p=1.00)')
  })
})

// ---------------------------------------------------------------------------
// generateReport
// ---------------------------------------------------------------------------

describe('generateReport', () => {
  it('includes experiment summary section', () => {
    const report = generateReport(makeSession())
    expect(report).toContain('# Optimization Report')
    expect(report).toContain('**Target agent:** developer')
    expect(report).toContain('**Metric:** quality')
  })

  it('includes baseline metrics', () => {
    const report = generateReport(makeSession())
    expect(report).toContain('## Baseline')
    expect(report).toContain('mean=5.00')
  })

  it('includes variant table when variants exist', () => {
    const v = makeVariant()
    const report = generateReport(makeSession({ variants: [v] }))
    expect(report).toContain('## Variants')
    expect(report).toContain('| v1 |')
    expect(report).toContain('7.50')
  })

  it('shows winner when present', () => {
    const winner = makeVariant({ id: 'winner-v2', metrics: { mean: 9, stdDev: 0.3, pValue: 0.01 }, isSignificant: true })
    const report = generateReport(
      makeSession({ variants: [winner], winner }),
    )
    expect(report).toContain('**winner-v2**')
    expect(report).toContain('Statistically significant')
    expect(report).toContain('5.00')
    expect(report).toContain('9.00')
  })

  it('shows no-winner message when no variant beats baseline', () => {
    const report = generateReport(makeSession())
    expect(report).toContain('No variant outperformed the baseline')
  })

  it('includes cost summary', () => {
    const report = generateReport(
      makeSession({ sessionSpendUsd: 0.35 }),
    )
    expect(report).toContain('$0.35')
    expect(report).toContain('$0.65') // 1.00 - 0.35
  })

  it('includes branch name', () => {
    const report = generateReport(makeSession())
    expect(report).toContain('`optimize/developer-quality`')
  })
})

// ---------------------------------------------------------------------------
// generateJsonResults
// ---------------------------------------------------------------------------

describe('generateJsonResults', () => {
  it('returns valid JSON', () => {
    const json = generateJsonResults(makeSession())
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('includes config fields', () => {
    const json = generateJsonResults(makeSession())
    const parsed = JSON.parse(json)
    expect(parsed.config.targetAgent).toBe('developer')
    expect(parsed.config.metric).toBe('quality')
  })

  it('includes baseline metrics', () => {
    const json = generateJsonResults(makeSession())
    const parsed = JSON.parse(json)
    expect(parsed.baseline.id).toBe('baseline')
    expect(parsed.baseline.mean).toBe(5.0)
  })

  it('includes variants array', () => {
    const v = makeVariant()
    const json = generateJsonResults(makeSession({ variants: [v] }))
    const parsed = JSON.parse(json)
    expect(parsed.variants).toHaveLength(1)
    expect(parsed.variants[0].id).toBe('v1')
  })

  it('sets winner to null when no winner', () => {
    const json = generateJsonResults(makeSession())
    const parsed = JSON.parse(json)
    expect(parsed.winner).toBeNull()
  })

  it('includes winner metrics when present', () => {
    const winner = makeVariant({ id: 'w1' })
    const json = generateJsonResults(makeSession({ winner }))
    const parsed = JSON.parse(json)
    expect(parsed.winner.id).toBe('w1')
    expect(parsed.winner.isSignificant).toBe(true)
  })

  it('includes session spend', () => {
    const json = generateJsonResults(makeSession({ sessionSpendUsd: 0.42 }))
    const parsed = JSON.parse(json)
    expect(parsed.sessionSpendUsd).toBe(0.42)
  })
})
