import { describe, it, expect } from 'vitest'
import {
  SOFTWARE_METRICS,
  MARKETING_METRICS,
  getMetricsForDomain,
  findMetricById,
  selectEvaluatorModel,
  collectSoftwareMetricStub,
  collectMarketingMetricStub,
  collectCustomMetric,
  computeMetricDelta,
  classifyMetricDirection,
  compareMetricSamples,
  formatMetricChange,
  formatMetricTableRow,
  formatMetricReport,
} from '../../../src/optimize/domain-metrics.js'
import type { MetricDefinition, MetricSample } from '../../../src/optimize/domain-metrics.js'

const NOW = 1_700_000_000_000

// ---------------------------------------------------------------------------
// SOFTWARE_METRICS catalog
// ---------------------------------------------------------------------------

describe('SOFTWARE_METRICS', () => {
  it('contains exactly 6 entries', () => {
    expect(SOFTWARE_METRICS).toHaveLength(6)
  })

  it('includes test_pass_rate as higher_is_better', () => {
    const m = SOFTWARE_METRICS.find((m) => m.id === 'test_pass_rate')
    expect(m).toBeDefined()
    expect(m!.polarity).toBe('higher_is_better')
    expect(m!.domain).toBe('software')
    expect(m!.unit).toBe('%')
  })

  it('includes bundle_size as lower_is_better', () => {
    const m = SOFTWARE_METRICS.find((m) => m.id === 'bundle_size')
    expect(m).toBeDefined()
    expect(m!.polarity).toBe('lower_is_better')
  })

  it('includes lighthouse_score as higher_is_better', () => {
    const m = SOFTWARE_METRICS.find((m) => m.id === 'lighthouse_score')
    expect(m).toBeDefined()
    expect(m!.polarity).toBe('higher_is_better')
  })

  it('includes build_time as lower_is_better', () => {
    const m = SOFTWARE_METRICS.find((m) => m.id === 'build_time')
    expect(m).toBeDefined()
    expect(m!.polarity).toBe('lower_is_better')
  })

  it('includes coverage as higher_is_better', () => {
    const m = SOFTWARE_METRICS.find((m) => m.id === 'coverage')
    expect(m).toBeDefined()
    expect(m!.polarity).toBe('higher_is_better')
  })

  it('includes type_check as lower_is_better', () => {
    const m = SOFTWARE_METRICS.find((m) => m.id === 'type_check')
    expect(m).toBeDefined()
    expect(m!.polarity).toBe('lower_is_better')
    expect(m!.unit).toBe('errors')
  })
})

// ---------------------------------------------------------------------------
// MARKETING_METRICS catalog
// ---------------------------------------------------------------------------

describe('MARKETING_METRICS', () => {
  it('contains exactly 4 entries', () => {
    expect(MARKETING_METRICS).toHaveLength(4)
  })

  it('includes readability_score as higher_is_better', () => {
    const m = MARKETING_METRICS.find((m) => m.id === 'readability_score')
    expect(m).toBeDefined()
    expect(m!.polarity).toBe('higher_is_better')
    expect(m!.domain).toBe('marketing')
  })

  it('includes compliance_pass_rate', () => {
    const m = MARKETING_METRICS.find((m) => m.id === 'compliance_pass_rate')
    expect(m).toBeDefined()
    expect(m!.unit).toBe('%')
  })

  it('includes keyword_density', () => {
    const m = MARKETING_METRICS.find((m) => m.id === 'keyword_density')
    expect(m).toBeDefined()
    expect(m!.unit).toBe('%')
  })

  it('includes cta_clarity', () => {
    const m = MARKETING_METRICS.find((m) => m.id === 'cta_clarity')
    expect(m).toBeDefined()
    expect(m!.polarity).toBe('higher_is_better')
  })
})

// ---------------------------------------------------------------------------
// getMetricsForDomain
// ---------------------------------------------------------------------------

describe('getMetricsForDomain', () => {
  it('returns software metrics for "software"', () => {
    const metrics = getMetricsForDomain('software')
    expect(metrics).toBe(SOFTWARE_METRICS)
    expect(metrics.length).toBeGreaterThan(0)
  })

  it('returns marketing metrics for "marketing"', () => {
    const metrics = getMetricsForDomain('marketing')
    expect(metrics).toBe(MARKETING_METRICS)
    expect(metrics.length).toBeGreaterThan(0)
  })

  it('returns empty array for "custom"', () => {
    const metrics = getMetricsForDomain('custom')
    expect(metrics).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// findMetricById
// ---------------------------------------------------------------------------

describe('findMetricById', () => {
  it('finds a software metric by id', () => {
    const m = findMetricById('test_pass_rate')
    expect(m).toBeDefined()
    expect(m!.domain).toBe('software')
  })

  it('finds a marketing metric by id', () => {
    const m = findMetricById('cta_clarity')
    expect(m).toBeDefined()
    expect(m!.domain).toBe('marketing')
  })

  it('returns undefined for unknown id', () => {
    expect(findMetricById('unknown_metric')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// selectEvaluatorModel
// ---------------------------------------------------------------------------

describe('selectEvaluatorModel', () => {
  it('returns a different model from the generator', () => {
    const generator = 'claude-sonnet-4-6'
    const evaluator = selectEvaluatorModel(generator)
    expect(evaluator).not.toBe(generator)
  })

  it('returns a different model for opus generator', () => {
    const generator = 'claude-opus-4-6'
    const evaluator = selectEvaluatorModel(generator)
    expect(evaluator).not.toBe(generator)
  })

  it('returns a different model for haiku generator', () => {
    const generator = 'claude-haiku-4-5-20251001'
    const evaluator = selectEvaluatorModel(generator)
    expect(evaluator).not.toBe(generator)
  })

  it('returns a string for unknown generator model', () => {
    const evaluator = selectEvaluatorModel('unknown-model')
    expect(typeof evaluator).toBe('string')
    expect(evaluator.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// collectSoftwareMetricStub
// ---------------------------------------------------------------------------

describe('collectSoftwareMetricStub', () => {
  it('returns a sample for test_pass_rate', () => {
    const sample = collectSoftwareMetricStub('test_pass_rate', '/project', NOW)
    expect(sample.metricId).toBe('test_pass_rate')
    expect(sample.value).toBeGreaterThan(0)
    expect(sample.collectedAtMs).toBe(NOW)
    expect(sample.source).toBe('stub')
  })

  it('returns a sample for bundle_size', () => {
    const sample = collectSoftwareMetricStub('bundle_size', '/project', NOW)
    expect(sample.metricId).toBe('bundle_size')
    expect(sample.value).toBeGreaterThan(0)
  })

  it('returns 0 for unknown metric id', () => {
    const sample = collectSoftwareMetricStub('unknown_id', '/project', NOW)
    expect(sample.value).toBe(0)
  })

  it('uses injected nowMs for collectedAtMs', () => {
    const t = 9_999_999_999
    const sample = collectSoftwareMetricStub('coverage', '/project', t)
    expect(sample.collectedAtMs).toBe(t)
  })
})

// ---------------------------------------------------------------------------
// collectMarketingMetricStub
// ---------------------------------------------------------------------------

describe('collectMarketingMetricStub', () => {
  it('returns a sample for readability_score', () => {
    const sample = collectMarketingMetricStub('readability_score', 'some content', NOW)
    expect(sample.metricId).toBe('readability_score')
    expect(sample.value).toBeGreaterThan(0)
    expect(sample.source).toBe('stub')
  })

  it('returns a sample for cta_clarity', () => {
    const sample = collectMarketingMetricStub('cta_clarity', 'buy now!', NOW)
    expect(sample.value).toBeGreaterThan(0)
  })

  it('returns 0 for unknown marketing metric id', () => {
    const sample = collectMarketingMetricStub('unknown', 'content', NOW)
    expect(sample.value).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// collectCustomMetric
// ---------------------------------------------------------------------------

describe('collectCustomMetric', () => {
  const config = {
    scriptPath: './scripts/measure.sh',
    name: 'Custom Score',
    polarity: 'higher_is_better' as const,
  }

  it('returns ok with sample when exec returns numeric string', () => {
    const execFn = () => '42.5\n'
    const result = collectCustomMetric(config, NOW, execFn)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.value).toBe(42.5)
      expect(result.value.source).toBe('executable')
      expect(result.value.collectedAtMs).toBe(NOW)
      expect(result.value.metricId).toBe('./scripts/measure.sh')
    }
  })

  it('returns ok for integer output', () => {
    const execFn = () => '100'
    const result = collectCustomMetric(config, NOW, execFn)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.value).toBe(100)
  })

  it('returns err when exec throws', () => {
    const execFn = () => {
      throw new Error('script not found')
    }
    const result = collectCustomMetric(config, NOW, execFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FILE_READ_FAILED')
  })

  it('returns err when output is non-numeric', () => {
    const execFn = () => 'not a number'
    const result = collectCustomMetric(config, NOW, execFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CONFIG_INVALID')
  })

  it('returns err when output is empty', () => {
    const execFn = () => ''
    const result = collectCustomMetric(config, NOW, execFn)
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeMetricDelta
// ---------------------------------------------------------------------------

describe('computeMetricDelta', () => {
  const makeSample = (value: number): MetricSample => ({
    metricId: 'test',
    value,
    collectedAtMs: NOW,
    source: 'stub',
  })

  it('returns positive delta when after > before', () => {
    expect(computeMetricDelta(makeSample(80), makeSample(90))).toBe(10)
  })

  it('returns negative delta when after < before', () => {
    expect(computeMetricDelta(makeSample(90), makeSample(80))).toBe(-10)
  })

  it('returns 0 when values are equal', () => {
    expect(computeMetricDelta(makeSample(50), makeSample(50))).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// classifyMetricDirection
// ---------------------------------------------------------------------------

describe('classifyMetricDirection', () => {
  it('improved when delta > 0 and higher_is_better', () => {
    expect(classifyMetricDirection(5, 'higher_is_better')).toBe('improved')
  })

  it('regressed when delta < 0 and higher_is_better', () => {
    expect(classifyMetricDirection(-5, 'higher_is_better')).toBe('regressed')
  })

  it('improved when delta < 0 and lower_is_better', () => {
    expect(classifyMetricDirection(-5, 'lower_is_better')).toBe('improved')
  })

  it('regressed when delta > 0 and lower_is_better', () => {
    expect(classifyMetricDirection(5, 'lower_is_better')).toBe('regressed')
  })

  it('unchanged when delta === 0', () => {
    expect(classifyMetricDirection(0, 'higher_is_better')).toBe('unchanged')
    expect(classifyMetricDirection(0, 'lower_is_better')).toBe('unchanged')
  })
})

// ---------------------------------------------------------------------------
// compareMetricSamples
// ---------------------------------------------------------------------------

describe('compareMetricSamples', () => {
  const def: MetricDefinition = {
    id: 'test_pass_rate',
    name: 'Test Pass Rate',
    domain: 'software',
    unit: '%',
    polarity: 'higher_is_better',
  }
  const before: MetricSample = { metricId: 'test_pass_rate', value: 90, collectedAtMs: NOW, source: 'stub' }
  const after: MetricSample = { metricId: 'test_pass_rate', value: 95, collectedAtMs: NOW + 1000, source: 'stub' }

  it('computes positive delta for test_pass_rate improvement', () => {
    const cmp = compareMetricSamples(def, before, after)
    expect(cmp.delta).toBe(5)
    expect(cmp.direction).toBe('improved')
  })

  it('computes negative delta for regression', () => {
    const cmp = compareMetricSamples(def, after, before)
    expect(cmp.delta).toBe(-5)
    expect(cmp.direction).toBe('regressed')
  })

  it('direction improved for lower_is_better metric when delta < 0', () => {
    const bundleDef: MetricDefinition = { ...def, id: 'bundle_size', name: 'Bundle Size', polarity: 'lower_is_better', unit: 'bytes' }
    const b: MetricSample = { ...before, metricId: 'bundle_size', value: 300_000 }
    const a: MetricSample = { ...after, metricId: 'bundle_size', value: 250_000 }
    const cmp = compareMetricSamples(bundleDef, b, a)
    expect(cmp.direction).toBe('improved')
    expect(cmp.delta).toBe(-50_000)
  })
})

// ---------------------------------------------------------------------------
// formatMetricChange
// ---------------------------------------------------------------------------

describe('formatMetricChange', () => {
  const def: MetricDefinition = {
    id: 'test_pass_rate',
    name: 'Test Pass Rate',
    domain: 'software',
    unit: '%',
    polarity: 'higher_is_better',
  }
  const before: MetricSample = { metricId: 'test_pass_rate', value: 95, collectedAtMs: NOW, source: 'stub' }
  const after: MetricSample = { metricId: 'test_pass_rate', value: 97.5, collectedAtMs: NOW + 1000, source: 'stub' }

  it('formats improvement with + sign', () => {
    const cmp = compareMetricSamples(def, before, after)
    const str = formatMetricChange(cmp)
    expect(str).toContain('Test Pass Rate')
    expect(str).toContain('95.00%')
    expect(str).toContain('97.50%')
    expect(str).toContain('+2.50')
    expect(str).toContain('[improved]')
  })

  it('formats regression with - sign', () => {
    const cmp = compareMetricSamples(def, after, before)
    const str = formatMetricChange(cmp)
    expect(str).toContain('-2.50')
    expect(str).toContain('[regressed]')
  })

  it('formats unchanged with + sign for 0 delta', () => {
    const cmp = compareMetricSamples(def, before, before)
    const str = formatMetricChange(cmp)
    expect(str).toContain('[unchanged]')
  })
})

// ---------------------------------------------------------------------------
// formatMetricTableRow
// ---------------------------------------------------------------------------

describe('formatMetricTableRow', () => {
  const def: MetricDefinition = {
    id: 'coverage',
    name: 'Code Coverage',
    domain: 'software',
    unit: '%',
    polarity: 'higher_is_better',
  }
  const before: MetricSample = { metricId: 'coverage', value: 78, collectedAtMs: NOW, source: 'stub' }
  const after: MetricSample = { metricId: 'coverage', value: 82, collectedAtMs: NOW + 1000, source: 'stub' }

  it('formats as markdown table row', () => {
    const cmp = compareMetricSamples(def, before, after)
    const row = formatMetricTableRow(cmp)
    expect(row).toMatch(/^\|/)
    expect(row).toContain('Code Coverage')
    expect(row).toContain('78.00 %')
    expect(row).toContain('82.00 %')
    expect(row).toContain('✅')
  })

  it('uses ❌ for regressed direction', () => {
    const cmp = compareMetricSamples(def, after, before)
    const row = formatMetricTableRow(cmp)
    expect(row).toContain('❌')
  })
})

// ---------------------------------------------------------------------------
// formatMetricReport
// ---------------------------------------------------------------------------

describe('formatMetricReport', () => {
  it('returns placeholder for empty comparisons', () => {
    expect(formatMetricReport([])).toBe('_(no metrics collected)_')
  })

  it('returns markdown table with header and rows for comparisons', () => {
    const def: MetricDefinition = {
      id: 'test_pass_rate',
      name: 'Test Pass Rate',
      domain: 'software',
      unit: '%',
      polarity: 'higher_is_better',
    }
    const b: MetricSample = { metricId: 'test_pass_rate', value: 90, collectedAtMs: NOW, source: 'stub' }
    const a: MetricSample = { metricId: 'test_pass_rate', value: 95, collectedAtMs: NOW + 1000, source: 'stub' }
    const cmp = compareMetricSamples(def, b, a)
    const report = formatMetricReport([cmp])
    expect(report).toContain('| Metric |')
    expect(report).toContain('Test Pass Rate')
    expect(report).toContain('✅')
  })
})
