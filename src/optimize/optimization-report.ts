/**
 * Optimization Report — auto-generates optimization-report.md and results.tsv
 * summarizing experiments, improvements, metrics, and diffs from a session.
 * Pure functions with injected I/O for testability.
 * @module optimize/optimization-report
 * @see FR-AutoResearch Epic 12.5 — Optimization Report
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ExperimentResult } from './experiment-loop.js'
import type { RatchetSession } from './ratchet.js'
import type { MetricComparison } from './domain-metrics.js'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A single improvement kept in the session (experiment that was committed) */
export interface KeptImprovement {
  /** Experiment number that produced this improvement */
  experimentNumber: number
  /** Short description of the change */
  description: string
  /** Git diff content of the committed change */
  diffContent: string
  /** Metrics that improved in this experiment */
  metrics: readonly MetricComparison[]
}

/** Full input data for building an optimization report */
export interface OptimizationReportInput {
  /** The ratchet session (contains branch name, target type) */
  session: RatchetSession
  /** All experiments run during the session */
  experiments: readonly ExperimentResult[]
  /** Improvements that were kept (committed) */
  keptImprovements: readonly KeptImprovement[]
  /** Aggregate metric comparisons across all kept improvements */
  aggregateMetrics: readonly MetricComparison[]
  /** ISO timestamp for when the report was generated */
  generatedAt: string
}

/** Single row of the results TSV log */
export interface ResultsTsvRow {
  /** ISO timestamp when experiment completed */
  timestamp: string
  /** Branch name for this session */
  branchName: string
  /** Experiment number (1-based) */
  experimentNumber: number
  /** Outcome of the experiment */
  outcome: string
  /** Description of the experiment */
  description: string
  /** Whether this experiment was committed (Y/N) */
  committed: string
  /** Comma-separated metric summaries */
  metricSummary: string
}

// ---------------------------------------------------------------------------
// TSV helpers
// ---------------------------------------------------------------------------

/** TSV header row for results.tsv */
export const RESULTS_TSV_HEADER =
  'timestamp\tbranch\texperiment_number\toutcome\tdescription\tcommitted\tmetric_summary'

/**
 * Format a single TSV row for the results log.
 * All tab characters within field values are replaced with spaces.
 */
export function formatResultsTsvRow(row: ResultsTsvRow): string {
  const sanitize = (s: string) => s.replace(/\t/g, ' ').replace(/\n/g, ' ')
  return [
    sanitize(row.timestamp),
    sanitize(row.branchName),
    String(row.experimentNumber),
    sanitize(row.outcome),
    sanitize(row.description),
    sanitize(row.committed),
    sanitize(row.metricSummary),
  ].join('\t')
}

/**
 * Build a ResultsTsvRow from an experiment result.
 * keptNums is the set of experiment numbers that were committed.
 */
export function buildResultsTsvRow(
  experiment: ExperimentResult,
  branchName: string,
  keptNums: ReadonlySet<number>,
  metricSummary: string,
): ResultsTsvRow {
  return {
    timestamp: new Date(experiment.completedAtMs).toISOString(),
    branchName,
    experimentNumber: experiment.experimentNumber,
    outcome: experiment.outcome,
    description: experiment.description,
    committed: keptNums.has(experiment.experimentNumber) ? 'Y' : 'N',
    metricSummary,
  }
}

// ---------------------------------------------------------------------------
// Report content builder
// ---------------------------------------------------------------------------

/**
 * Build the markdown content for optimization-report.md.
 *
 * Sections:
 * 1. Header (session info, generated timestamp)
 * 2. Summary (experiments run, improvements found)
 * 3. Experiments Run table
 * 4. Improvements Kept (per improvement: description + diff + metrics)
 * 5. Before/After Metrics table (aggregate)
 * 6. Branch to Merge & Expected Impact
 */
export function buildOptimizationReport(input: OptimizationReportInput): string {
  const {
    session,
    experiments,
    keptImprovements,
    aggregateMetrics,
    generatedAt,
  } = input

  const totalExperiments = experiments.length
  const improvementsFound = keptImprovements.length
  const improvedMetrics = aggregateMetrics.filter((m) => m.direction === 'improved').length
  const regressedMetrics = aggregateMetrics.filter((m) => m.direction === 'regressed').length

  const lines: string[] = []

  // --- Header ---
  lines.push(`# Optimization Report`)
  lines.push(``)
  lines.push(`**Session:** ${session.sessionName}`)
  lines.push(`**Target:** ${session.targetType}`)
  lines.push(`**Branch:** \`${session.branchName}\``)
  lines.push(`**Generated:** ${generatedAt}`)
  lines.push(``)

  // --- Summary ---
  lines.push(`## Summary`)
  lines.push(``)
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Experiments Run | ${totalExperiments} |`)
  lines.push(`| Improvements Kept | ${improvementsFound} |`)
  lines.push(`| Metrics Improved | ${improvedMetrics} |`)
  lines.push(`| Metrics Regressed | ${regressedMetrics} |`)
  lines.push(``)

  // --- Experiments Run ---
  lines.push(`## Experiments Run`)
  lines.push(``)
  if (totalExperiments === 0) {
    lines.push(`_(no experiments run)_`)
  } else {
    lines.push(`| # | Description | Outcome | Committed |`)
    lines.push(`|---|-------------|---------|-----------|`)
    const keptNums = new Set(keptImprovements.map((k) => k.experimentNumber))
    for (const exp of experiments) {
      const committed = keptNums.has(exp.experimentNumber) ? '✅ Yes' : '❌ No'
      lines.push(`| ${exp.experimentNumber} | ${exp.description} | ${exp.outcome} | ${committed} |`)
    }
  }
  lines.push(``)

  // --- Improvements Kept ---
  lines.push(`## Improvements Kept`)
  lines.push(``)
  if (keptImprovements.length === 0) {
    lines.push(`_(no improvements were committed)_`)
  } else {
    for (const improvement of keptImprovements) {
      lines.push(`### Experiment #${improvement.experimentNumber}: ${improvement.description}`)
      lines.push(``)
      if (improvement.metrics.length > 0) {
        lines.push(`**Metrics:**`)
        lines.push(``)
        for (const m of improvement.metrics) {
          const sign = m.delta >= 0 ? '+' : ''
          lines.push(`- ${m.definition.name}: ${m.before.value.toFixed(2)} → ${m.after.value.toFixed(2)} (${sign}${m.delta.toFixed(2)} ${m.definition.unit}) [${m.direction}]`)
        }
        lines.push(``)
      }
      if (improvement.diffContent.trim().length > 0) {
        lines.push(`**Diff:**`)
        lines.push(``)
        lines.push(`\`\`\`diff`)
        lines.push(improvement.diffContent.trim())
        lines.push(`\`\`\``)
        lines.push(``)
      }
    }
  }

  // --- Before/After Metrics ---
  lines.push(`## Before/After Metrics`)
  lines.push(``)
  if (aggregateMetrics.length === 0) {
    lines.push(`_(no metrics collected)_`)
  } else {
    lines.push(`| Metric | Before | After | Delta | Status |`)
    lines.push(`|--------|--------|-------|-------|--------|`)
    for (const m of aggregateMetrics) {
      const sign = m.delta >= 0 ? '+' : ''
      const emoji = m.direction === 'improved' ? '✅' : m.direction === 'regressed' ? '❌' : '➖'
      lines.push(`| ${m.definition.name} | ${m.before.value.toFixed(2)} ${m.definition.unit} | ${m.after.value.toFixed(2)} ${m.definition.unit} | ${sign}${m.delta.toFixed(2)} | ${emoji} ${m.direction} |`)
    }
  }
  lines.push(``)

  // --- Branch to Merge ---
  lines.push(`## Branch to Merge`)
  lines.push(``)
  if (improvementsFound === 0) {
    lines.push(`No improvements were found in this session. The isolated branch \`${session.branchName}\` can be discarded.`)
  } else {
    lines.push(`**Merge branch:** \`${session.branchName}\``)
    lines.push(``)
    lines.push(`### Expected Impact`)
    lines.push(``)
    if (aggregateMetrics.length === 0) {
      lines.push(`_(no metric data available)_`)
    } else {
      const improved = aggregateMetrics.filter((m) => m.direction === 'improved')
      const regressed = aggregateMetrics.filter((m) => m.direction === 'regressed')
      if (improved.length > 0) {
        lines.push(`**Improvements:**`)
        for (const m of improved) {
          const sign = m.delta >= 0 ? '+' : ''
          lines.push(`- ${m.definition.name}: ${sign}${m.delta.toFixed(2)} ${m.definition.unit}`)
        }
        lines.push(``)
      }
      if (regressed.length > 0) {
        lines.push(`**Regressions (review before merging):**`)
        for (const m of regressed) {
          lines.push(`- ${m.definition.name}: ${m.delta.toFixed(2)} ${m.definition.unit}`)
        }
        lines.push(``)
      }
      if (session.lastGoodCommitRef !== null) {
        lines.push(`Last known-good commit: \`${session.lastGoodCommitRef}\``)
        lines.push(``)
      }
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// I/O helpers with injected functions
// ---------------------------------------------------------------------------

/** Injectable file write function */
export type WriteFileFn = (path: string, content: string) => void

/** Injectable file append function */
export type AppendFileFn = (path: string, content: string) => void

/**
 * Write the optimization report to a file.
 * Creates or overwrites the file at the given path.
 */
export function writeOptimizationReport(
  reportPath: string,
  content: string,
  writeFn: WriteFileFn,
): Result<void> {
  try {
    writeFn(reportPath, content)
    return ok(undefined)
  } catch (e) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.optimize.report_write_failed',
      params: { path: reportPath },
      cause: e,
    })
  }
}

/**
 * Append one or more TSV rows to results.tsv.
 * Writes the header first if the file does not yet exist (detected via existsFn).
 *
 * @param tsvPath - Absolute path to results.tsv
 * @param rows - Rows to append
 * @param existsFn - Returns true if the file already exists (injectable)
 * @param appendFn - Append content to file (injectable)
 */
export function appendResultsTsv(
  tsvPath: string,
  rows: readonly ResultsTsvRow[],
  existsFn: (path: string) => boolean,
  appendFn: AppendFileFn,
): Result<void> {
  try {
    const needsHeader = !existsFn(tsvPath)
    const lines: string[] = []
    if (needsHeader) {
      lines.push(RESULTS_TSV_HEADER)
    }
    for (const row of rows) {
      lines.push(formatResultsTsvRow(row))
    }
    if (lines.length > 0) {
      appendFn(tsvPath, lines.join('\n') + '\n')
    }
    return ok(undefined)
  } catch (e) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.optimize.tsv_write_failed',
      params: { path: tsvPath },
      cause: e,
    })
  }
}
