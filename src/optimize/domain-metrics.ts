/**
 * Domain-Specific Metrics — built-in metrics for code/marketing/agents
 * plus custom metric support via executable scripts.
 * Pure functions with injected dependencies for testability.
 * @module optimize/domain-metrics
 * @see FR-AutoResearch Epic 12.4 — Domain-Specific Metrics
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported metric domains */
export type MetricDomain = 'software' | 'marketing' | 'custom'

/** Direction of change for a metric delta */
export type MetricDirection = 'improved' | 'regressed' | 'unchanged'

/** Whether higher values are better (e.g. test pass rate) or lower (e.g. build time) */
export type MetricPolarity = 'higher_is_better' | 'lower_is_better'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Descriptor for a built-in or user-defined metric */
export interface MetricDefinition {
  /** Unique short identifier (e.g. 'test_pass_rate') */
  id: string
  /** Human-readable name */
  name: string
  /** Which domain this metric belongs to */
  domain: MetricDomain
  /** Unit label shown next to the value (e.g. '%', 'ms', 'bytes') */
  unit: string
  /** Whether a higher numeric value means better performance */
  polarity: MetricPolarity
}

/** Configuration for a custom executable metric */
export interface CustomMetricConfig {
  /** Absolute or relative path to the executable script */
  scriptPath: string
  /** Human-readable name for display */
  name: string
  /** Whether a higher returned value is better */
  polarity: MetricPolarity
}

/** A single collected metric sample */
export interface MetricSample {
  /** Matches MetricDefinition.id or CustomMetricConfig.scriptPath */
  metricId: string
  /** Numeric value at the time of collection */
  value: number
  /** Epoch ms when this sample was collected */
  collectedAtMs: number
  /** Where the value came from ('stub' in Alpha, 'executable' for custom) */
  source: 'stub' | 'executable'
}

/** Before/after comparison for a single metric */
export interface MetricComparison {
  definition: MetricDefinition
  before: MetricSample
  after: MetricSample
  delta: number
  direction: MetricDirection
}

// ---------------------------------------------------------------------------
// Built-in Software Metrics Catalog
// ---------------------------------------------------------------------------

/** All built-in software metrics */
export const SOFTWARE_METRICS: readonly MetricDefinition[] = [
  {
    id: 'test_pass_rate',
    name: 'Test Pass Rate',
    domain: 'software',
    unit: '%',
    polarity: 'higher_is_better',
  },
  {
    id: 'bundle_size',
    name: 'Bundle Size',
    domain: 'software',
    unit: 'bytes',
    polarity: 'lower_is_better',
  },
  {
    id: 'lighthouse_score',
    name: 'Lighthouse Score',
    domain: 'software',
    unit: '/100',
    polarity: 'higher_is_better',
  },
  {
    id: 'build_time',
    name: 'Build Time',
    domain: 'software',
    unit: 'ms',
    polarity: 'lower_is_better',
  },
  {
    id: 'coverage',
    name: 'Code Coverage',
    domain: 'software',
    unit: '%',
    polarity: 'higher_is_better',
  },
  {
    id: 'type_check',
    name: 'Type Check Errors',
    domain: 'software',
    unit: 'errors',
    polarity: 'lower_is_better',
  },
] as const

// ---------------------------------------------------------------------------
// Built-in Marketing Metrics Catalog
// ---------------------------------------------------------------------------

/**
 * Marketing metrics deliberately use a separate evaluator from the generator.
 * The evaluator model is resolved via selectEvaluatorModel().
 */
export const MARKETING_METRICS: readonly MetricDefinition[] = [
  {
    id: 'readability_score',
    name: 'Readability Score',
    domain: 'marketing',
    unit: 'pts',
    polarity: 'higher_is_better',
  },
  {
    id: 'compliance_pass_rate',
    name: 'Compliance Pass Rate',
    domain: 'marketing',
    unit: '%',
    polarity: 'higher_is_better',
  },
  {
    id: 'keyword_density',
    name: 'Keyword Density',
    domain: 'marketing',
    unit: '%',
    polarity: 'higher_is_better',
  },
  {
    id: 'cta_clarity',
    name: 'CTA Clarity',
    domain: 'marketing',
    unit: 'pts',
    polarity: 'higher_is_better',
  },
] as const

// ---------------------------------------------------------------------------
// Domain catalog lookup
// ---------------------------------------------------------------------------

/**
 * Return all built-in metric definitions for the given domain.
 * Returns empty array for 'custom' (no built-ins).
 */
export function getMetricsForDomain(domain: MetricDomain): readonly MetricDefinition[] {
  if (domain === 'software') return SOFTWARE_METRICS
  if (domain === 'marketing') return MARKETING_METRICS
  return []
}

/**
 * Look up a built-in metric definition by id.
 * Returns undefined when not found.
 */
export function findMetricById(id: string): MetricDefinition | undefined {
  return [...SOFTWARE_METRICS, ...MARKETING_METRICS].find((m) => m.id === id)
}

// ---------------------------------------------------------------------------
// Evaluator model selection (marketing metrics)
// ---------------------------------------------------------------------------

/** Known model identifiers used in the system */
const KNOWN_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const

/**
 * Select an evaluator model that is different from the generator model.
 * Marketing CTA clarity evaluation must use a different model from generation
 * to avoid self-congratulatory bias.
 *
 * @param generatorModel - The model used to generate the content
 * @returns A different model for evaluation
 */
export function selectEvaluatorModel(generatorModel: string): string {
  const preferred = KNOWN_MODELS.find((m) => m !== generatorModel)
  return preferred ?? KNOWN_MODELS[1]!
}

// ---------------------------------------------------------------------------
// Alpha stubs — real collection wired in production
// ---------------------------------------------------------------------------

/**
 * Collect a software metric sample (Alpha stub — returns synthetic values).
 * In production, each metric id maps to a real collection command.
 *
 * @param metricId - One of the SOFTWARE_METRICS ids
 * @param _projectDir - Root directory of the project being measured
 * @param nowMs - Current timestamp (injected for testability)
 */
export function collectSoftwareMetricStub(
  metricId: string,
  _projectDir: string,
  nowMs: number,
): MetricSample {
  // Synthetic baseline values for Alpha — real collection replaces these
  const STUB_VALUES: Record<string, number> = {
    test_pass_rate: 95.0,
    bundle_size: 250_000,
    lighthouse_score: 85.0,
    build_time: 3_500,
    coverage: 78.5,
    type_check: 0,
  }
  const value = STUB_VALUES[metricId] ?? 0
  return { metricId, value, collectedAtMs: nowMs, source: 'stub' }
}

/**
 * Collect a marketing metric sample (Alpha stub — returns synthetic values).
 * In production, readability/compliance/keyword/CTA metrics are computed from content.
 *
 * @param metricId - One of the MARKETING_METRICS ids
 * @param _content - The marketing content to measure
 * @param nowMs - Current timestamp (injected for testability)
 */
export function collectMarketingMetricStub(
  metricId: string,
  _content: string,
  nowMs: number,
): MetricSample {
  const STUB_VALUES: Record<string, number> = {
    readability_score: 72.0,
    compliance_pass_rate: 88.0,
    keyword_density: 2.5,
    cta_clarity: 65.0,
  }
  const value = STUB_VALUES[metricId] ?? 0
  return { metricId, value, collectedAtMs: nowMs, source: 'stub' }
}

// ---------------------------------------------------------------------------
// Custom metric collection
// ---------------------------------------------------------------------------

/** Injectable exec function type for custom metric scripts */
export type ExecFn = (command: string) => string

/**
 * Collect a custom metric by running an executable script.
 * The script must print a single numeric value to stdout.
 *
 * @param config - Custom metric configuration
 * @param nowMs - Current timestamp (injected for testability)
 * @param execFn - Injectable exec function (default: wraps execSync)
 */
export function collectCustomMetric(
  config: CustomMetricConfig,
  nowMs: number,
  execFn: ExecFn,
): Result<MetricSample> {
  let stdout: string
  try {
    stdout = execFn(config.scriptPath)
  } catch (e) {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.metrics.custom_exec_failed',
      params: { script: config.scriptPath },
      cause: e,
    })
  }

  const trimmed = stdout.trim()
  const value = parseFloat(trimmed)
  if (!Number.isFinite(value)) {
    return err({
      code: ERROR_CODES.CONFIG_INVALID,
      i18nKey: 'error.metrics.custom_non_numeric',
      params: { script: config.scriptPath, output: trimmed.slice(0, 50) },
    })
  }

  return ok({
    metricId: config.scriptPath,
    value,
    collectedAtMs: nowMs,
    source: 'executable',
  })
}

// ---------------------------------------------------------------------------
// Delta computation
// ---------------------------------------------------------------------------

/**
 * Compute the numeric delta between before and after samples.
 * Returns the raw arithmetic difference (after.value - before.value).
 */
export function computeMetricDelta(before: MetricSample, after: MetricSample): number {
  return after.value - before.value
}

/**
 * Determine whether a metric changed in the 'improved' or 'regressed' direction,
 * accounting for polarity (higher_is_better vs lower_is_better).
 *
 * @param delta - Arithmetic delta (after - before)
 * @param polarity - Whether higher values are better
 */
export function classifyMetricDirection(delta: number, polarity: MetricPolarity): MetricDirection {
  if (delta === 0) return 'unchanged'
  if (polarity === 'higher_is_better') return delta > 0 ? 'improved' : 'regressed'
  return delta < 0 ? 'improved' : 'regressed'
}

/**
 * Build a full MetricComparison from two samples and a definition.
 */
export function compareMetricSamples(
  definition: MetricDefinition,
  before: MetricSample,
  after: MetricSample,
): MetricComparison {
  const delta = computeMetricDelta(before, after)
  const direction = classifyMetricDirection(delta, definition.polarity)
  return { definition, before, after, delta, direction }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a human-readable metric change string.
 * Examples:
 *   "Test Pass Rate: 95.00% → 97.50% (+2.50%) [improved]"
 *   "Bundle Size: 250000 bytes → 240000 bytes (-10000) [improved]"
 */
export function formatMetricChange(comparison: MetricComparison): string {
  const { definition, before, after, delta, direction } = comparison
  const sign = delta >= 0 ? '+' : ''
  const unit = definition.unit
  const beforeStr = `${before.value.toFixed(2)}${unit}`
  const afterStr = `${after.value.toFixed(2)}${unit}`
  const deltaStr = `${sign}${delta.toFixed(2)}`
  return `${definition.name}: ${beforeStr} → ${afterStr} (${deltaStr}) [${direction}]`
}

/**
 * Format a markdown table row for a metric comparison.
 * Columns: Metric | Before | After | Delta | Status
 */
export function formatMetricTableRow(comparison: MetricComparison): string {
  const { definition, before, after, delta, direction } = comparison
  const sign = delta >= 0 ? '+' : ''
  const unit = definition.unit
  const statusEmoji = direction === 'improved' ? '✅' : direction === 'regressed' ? '❌' : '➖'
  return `| ${definition.name} | ${before.value.toFixed(2)} ${unit} | ${after.value.toFixed(2)} ${unit} | ${sign}${delta.toFixed(2)} | ${statusEmoji} ${direction} |`
}

/**
 * Format a full markdown metric report from a list of comparisons.
 */
export function formatMetricReport(comparisons: readonly MetricComparison[]): string {
  if (comparisons.length === 0) return '_(no metrics collected)_'

  const header = '| Metric | Before | After | Delta | Status |'
  const separator = '|--------|--------|-------|-------|--------|'
  const rows = comparisons.map(formatMetricTableRow)

  return [header, separator, ...rows].join('\n')
}
