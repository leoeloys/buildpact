import { describe, it, expect, vi } from 'vitest'
import {
  RESULTS_TSV_HEADER,
  formatResultsTsvRow,
  buildResultsTsvRow,
  buildOptimizationReport,
  writeOptimizationReport,
  appendResultsTsv,
} from '../../../src/optimize/optimization-report.js'
import type {
  OptimizationReportInput,
  KeptImprovement,
  ResultsTsvRow,
} from '../../../src/optimize/optimization-report.js'
import type { ExperimentResult } from '../../../src/optimize/experiment-loop.js'
import type { RatchetSession } from '../../../src/optimize/ratchet.js'
import type { MetricComparison, MetricDefinition, MetricSample } from '../../../src/optimize/domain-metrics.js'

const NOW = 1_700_000_000_000

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeSession = (overrides?: Partial<RatchetSession>): RatchetSession => ({
  targetType: 'code',
  sessionName: 'session-1',
  branchName: 'optimize/code/session-1/2026',
  lastGoodCommitRef: 'abc123',
  ...overrides,
})

const makeExperiment = (n: number, outcome = 'improved'): ExperimentResult => ({
  experimentNumber: n,
  startedAtMs: NOW,
  completedAtMs: NOW + 60_000,
  outcome: outcome as ExperimentResult['outcome'],
  description: `Experiment ${n}`,
})

const makeDef = (id: string, polarity: 'higher_is_better' | 'lower_is_better' = 'higher_is_better'): MetricDefinition => ({
  id,
  name: id.replace(/_/g, ' '),
  domain: 'software',
  unit: '%',
  polarity,
})

const makeSample = (value: number): MetricSample => ({
  metricId: 'test',
  value,
  collectedAtMs: NOW,
  source: 'stub',
})

const makeComparison = (id: string, before: number, after: number, polarity: 'higher_is_better' | 'lower_is_better' = 'higher_is_better'): MetricComparison => {
  const def = makeDef(id, polarity)
  const delta = after - before
  const direction = polarity === 'higher_is_better'
    ? delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'unchanged'
    : delta < 0 ? 'improved' : delta > 0 ? 'regressed' : 'unchanged'
  return { definition: def, before: makeSample(before), after: makeSample(after), delta, direction }
}

const makeImprovement = (n: number, metrics: MetricComparison[] = []): KeptImprovement => ({
  experimentNumber: n,
  description: `Improvement ${n}`,
  diffContent: `+console.log('improved')`,
  metrics,
})

const makeInput = (overrides?: Partial<OptimizationReportInput>): OptimizationReportInput => ({
  session: makeSession(),
  experiments: [makeExperiment(1), makeExperiment(2, 'no_change')],
  keptImprovements: [makeImprovement(1)],
  aggregateMetrics: [makeComparison('test_pass_rate', 90, 95)],
  generatedAt: '2026-03-16T00:00:00.000Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// RESULTS_TSV_HEADER
// ---------------------------------------------------------------------------

describe('RESULTS_TSV_HEADER', () => {
  it('contains expected columns', () => {
    expect(RESULTS_TSV_HEADER).toContain('timestamp')
    expect(RESULTS_TSV_HEADER).toContain('branch')
    expect(RESULTS_TSV_HEADER).toContain('experiment_number')
    expect(RESULTS_TSV_HEADER).toContain('outcome')
    expect(RESULTS_TSV_HEADER).toContain('committed')
    expect(RESULTS_TSV_HEADER).toContain('metric_summary')
  })

  it('uses tab separators', () => {
    expect(RESULTS_TSV_HEADER).toContain('\t')
  })
})

// ---------------------------------------------------------------------------
// formatResultsTsvRow
// ---------------------------------------------------------------------------

describe('formatResultsTsvRow', () => {
  const row: ResultsTsvRow = {
    timestamp: '2026-03-16T00:00:00.000Z',
    branchName: 'optimize/code/session-1/2026',
    experimentNumber: 1,
    outcome: 'improved',
    description: 'Extract helper',
    committed: 'Y',
    metricSummary: 'test_pass_rate +2.5%',
  }

  it('formats row with tab separators', () => {
    const formatted = formatResultsTsvRow(row)
    const cols = formatted.split('\t')
    expect(cols).toHaveLength(7)
  })

  it('includes all field values', () => {
    const formatted = formatResultsTsvRow(row)
    expect(formatted).toContain('2026-03-16T00:00:00.000Z')
    expect(formatted).toContain('optimize/code/session-1/2026')
    expect(formatted).toContain('improved')
    expect(formatted).toContain('Extract helper')
    expect(formatted).toContain('Y')
  })

  it('sanitizes tab characters in fields', () => {
    const rowWithTabs: ResultsTsvRow = { ...row, description: 'foo\tbar' }
    const formatted = formatResultsTsvRow(rowWithTabs)
    const cols = formatted.split('\t')
    expect(cols).toHaveLength(7)
    expect(formatted).toContain('foo bar')
  })

  it('sanitizes newlines in fields', () => {
    const rowWithNewline: ResultsTsvRow = { ...row, description: 'foo\nbar' }
    const formatted = formatResultsTsvRow(rowWithNewline)
    expect(formatted).not.toContain('\n')
    expect(formatted).toContain('foo bar')
  })
})

// ---------------------------------------------------------------------------
// buildResultsTsvRow
// ---------------------------------------------------------------------------

describe('buildResultsTsvRow', () => {
  it('marks committed as Y when experiment number is in keptNums', () => {
    const exp = makeExperiment(3)
    const keptNums = new Set([3, 5])
    const row = buildResultsTsvRow(exp, 'my-branch', keptNums, 'no metrics')
    expect(row.committed).toBe('Y')
    expect(row.branchName).toBe('my-branch')
  })

  it('marks committed as N when experiment number is not in keptNums', () => {
    const exp = makeExperiment(2)
    const row = buildResultsTsvRow(exp, 'my-branch', new Set([3]), 'no metrics')
    expect(row.committed).toBe('N')
  })

  it('uses ISO timestamp from completedAtMs', () => {
    const exp = makeExperiment(1)
    const row = buildResultsTsvRow(exp, 'branch', new Set(), '')
    expect(row.timestamp).toBe(new Date(exp.completedAtMs).toISOString())
  })

  it('includes description from experiment', () => {
    const exp = makeExperiment(1)
    const row = buildResultsTsvRow(exp, 'branch', new Set(), '')
    expect(row.description).toBe(exp.description)
  })
})

// ---------------------------------------------------------------------------
// buildOptimizationReport
// ---------------------------------------------------------------------------

describe('buildOptimizationReport', () => {
  it('contains session information in header', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('session-1')
    expect(report).toContain('optimize/code/session-1/2026')
    expect(report).toContain('2026-03-16T00:00:00.000Z')
  })

  it('shows correct experiment count in summary', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('Experiments Run | 2')
    expect(report).toContain('Improvements Kept | 1')
  })

  it('lists experiments in experiments table', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('Experiment 1')
    expect(report).toContain('Experiment 2')
  })

  it('marks committed experiments with checkmark', () => {
    const report = buildOptimizationReport(makeInput())
    // Experiment 1 is kept, Experiment 2 is not
    expect(report).toContain('✅ Yes')
    expect(report).toContain('❌ No')
  })

  it('shows kept improvement description', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('Improvement 1')
  })

  it('shows diff content in code block', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('```diff')
    expect(report).toContain("+console.log('improved')")
    expect(report).toContain('```')
  })

  it('shows aggregate metrics table', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('Before/After Metrics')
    expect(report).toContain('test pass rate')
    expect(report).toContain('90.00')
    expect(report).toContain('95.00')
    expect(report).toContain('✅')
  })

  it('shows branch to merge section', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('Branch to Merge')
    expect(report).toContain('optimize/code/session-1/2026')
  })

  it('shows expected metric impact for improved metrics', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('Expected Impact')
    expect(report).toContain('Improvements')
  })

  it('shows last known-good commit ref when present', () => {
    const report = buildOptimizationReport(makeInput())
    expect(report).toContain('abc123')
  })

  it('handles empty experiments gracefully', () => {
    const input = makeInput({ experiments: [], keptImprovements: [], aggregateMetrics: [] })
    const report = buildOptimizationReport(input)
    expect(report).toContain('no experiments run')
    expect(report).toContain('no improvements were committed')
  })

  it('shows discard message when no improvements found', () => {
    const input = makeInput({ keptImprovements: [] })
    const report = buildOptimizationReport(input)
    expect(report).toContain('can be discarded')
  })

  it('shows regression warning when metrics regressed', () => {
    const regressedMetric = makeComparison('bundle_size', 100, 120, 'lower_is_better')
    const input = makeInput({ aggregateMetrics: [regressedMetric] })
    const report = buildOptimizationReport(input)
    expect(report).toContain('Regressions')
  })

  it('shows placeholder when no metrics', () => {
    const input = makeInput({ aggregateMetrics: [] })
    const report = buildOptimizationReport(input)
    expect(report).toContain('no metrics collected')
  })
})

// ---------------------------------------------------------------------------
// writeOptimizationReport
// ---------------------------------------------------------------------------

describe('writeOptimizationReport', () => {
  it('calls writeFn with path and content', () => {
    const writeFn = vi.fn()
    const result = writeOptimizationReport('/path/to/report.md', '# Report', writeFn)
    expect(result.ok).toBe(true)
    expect(writeFn).toHaveBeenCalledWith('/path/to/report.md', '# Report')
  })

  it('returns err when writeFn throws', () => {
    const writeFn = vi.fn(() => { throw new Error('disk full') })
    const result = writeOptimizationReport('/path/to/report.md', '# Report', writeFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FILE_WRITE_FAILED')
  })
})

// ---------------------------------------------------------------------------
// appendResultsTsv
// ---------------------------------------------------------------------------

describe('appendResultsTsv', () => {
  const makeRow = (): ResultsTsvRow => ({
    timestamp: '2026-03-16T00:00:00.000Z',
    branchName: 'optimize/code/s1/t',
    experimentNumber: 1,
    outcome: 'improved',
    description: 'test',
    committed: 'Y',
    metricSummary: '',
  })

  it('writes header + row when file does not exist', () => {
    const appendFn = vi.fn()
    const existsFn = () => false
    const result = appendResultsTsv('/results.tsv', [makeRow()], existsFn, appendFn)
    expect(result.ok).toBe(true)
    expect(appendFn).toHaveBeenCalledTimes(1)
    const written = appendFn.mock.calls[0]![1] as string
    expect(written).toContain(RESULTS_TSV_HEADER)
    expect(written).toContain('2026-03-16T00:00:00.000Z')
  })

  it('does not write header when file already exists', () => {
    const appendFn = vi.fn()
    const existsFn = () => true
    appendResultsTsv('/results.tsv', [makeRow()], existsFn, appendFn)
    const written = appendFn.mock.calls[0]![1] as string
    expect(written).not.toContain(RESULTS_TSV_HEADER)
  })

  it('appends multiple rows', () => {
    const appendFn = vi.fn()
    const existsFn = () => true
    const rows = [makeRow(), { ...makeRow(), experimentNumber: 2 }]
    appendResultsTsv('/results.tsv', rows, existsFn, appendFn)
    const written = appendFn.mock.calls[0]![1] as string
    const lines = written.trim().split('\n')
    expect(lines).toHaveLength(2)
  })

  it('returns err when appendFn throws', () => {
    const appendFn = vi.fn(() => { throw new Error('disk full') })
    const existsFn = () => false
    const result = appendResultsTsv('/results.tsv', [makeRow()], existsFn, appendFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FILE_WRITE_FAILED')
  })

  it('does nothing and returns ok for empty rows array with existing file', () => {
    const appendFn = vi.fn()
    const existsFn = () => true
    const result = appendResultsTsv('/results.tsv', [], existsFn, appendFn)
    expect(result.ok).toBe(true)
    expect(appendFn).not.toHaveBeenCalled()
  })
})
