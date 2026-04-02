/**
 * Metrics Ledger — per-unit cost/token tracking with projections.
 * Every unit of work (task, research, verification) has granular metrics
 * persisted to `.buildpact/metrics.json`.
 *
 * Replaces STUB_COST_PER_TASK_USD with real measurements.
 *
 * @module engine/metrics-ledger
 * @see Concept 12.3 (GSD-2 per-unit cost ledger)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { MetricsPhase, UnitMetrics, MetricsLedger } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METRICS_FILE = 'metrics.json'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new empty metrics ledger.
 */
export function createMetricsLedger(): MetricsLedger {
  return {
    version: 1,
    projectStartedAt: new Date().toISOString(),
    units: [],
  }
}

/**
 * Create a unit metrics record.
 */
export function createUnitMetrics(
  unitType: string,
  unitId: string,
  model: string,
  phase: MetricsPhase,
  tokens: UnitMetrics['tokens'],
  costUsd: number,
  toolCalls: number,
  startedAt: string,
  finishedAt: string,
): UnitMetrics {
  return {
    unitType,
    unitId,
    model,
    startedAt,
    finishedAt,
    tokens,
    costUsd,
    toolCalls,
    phase,
  }
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Record a completed unit's metrics in the ledger.
 */
export function recordUnit(ledger: MetricsLedger, unit: UnitMetrics): MetricsLedger {
  return {
    ...ledger,
    units: [...ledger.units, unit],
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Total cost for a specific pipeline phase.
 */
export function totalCostByPhase(ledger: MetricsLedger, phase: MetricsPhase): number {
  return ledger.units
    .filter(u => u.phase === phase)
    .reduce((sum, u) => sum + u.costUsd, 0)
}

/**
 * Total cost across all units.
 */
export function totalCost(ledger: MetricsLedger): number {
  return ledger.units.reduce((sum, u) => sum + u.costUsd, 0)
}

/**
 * Average cost per task (execution phase units only).
 */
export function averageCostPerTask(ledger: MetricsLedger): number {
  const executionUnits = ledger.units.filter(u => u.phase === 'execution')
  if (executionUnits.length === 0) return 0
  const total = executionUnits.reduce((sum, u) => sum + u.costUsd, 0)
  return total / executionUnits.length
}

/**
 * Projected total cost based on average cost per task and remaining tasks.
 */
export function projectedTotalCost(ledger: MetricsLedger, totalTasks: number): number {
  const current = totalCost(ledger)
  const avgPerTask = averageCostPerTask(ledger)
  const completedTasks = ledger.units.filter(u => u.phase === 'execution').length
  const remaining = Math.max(0, totalTasks - completedTasks)
  return current + (avgPerTask * remaining)
}

/**
 * Cost burn rate in $/hour based on elapsed time.
 */
export function costBurnRate(ledger: MetricsLedger): number {
  if (ledger.units.length === 0) return 0

  const firstStart = new Date(ledger.projectStartedAt).getTime()
  const lastFinish = Math.max(
    ...ledger.units.map(u => new Date(u.finishedAt).getTime()),
  )
  const elapsedHours = (lastFinish - firstStart) / (1000 * 60 * 60)
  if (elapsedHours <= 0) return 0

  return totalCost(ledger) / elapsedHours
}

/**
 * Total tokens across all units.
 */
export function totalTokens(ledger: MetricsLedger): number {
  return ledger.units.reduce((sum, u) => sum + u.tokens.total, 0)
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Load metrics ledger from .buildpact/metrics.json.
 */
export async function loadMetricsLedger(projectDir: string): Promise<Result<MetricsLedger>> {
  const path = join(projectDir, '.buildpact', METRICS_FILE)
  try {
    const content = await readFile(path, 'utf-8')
    return ok(JSON.parse(content) as MetricsLedger)
  } catch {
    return ok(createMetricsLedger()) // No ledger yet — return empty
  }
}

/**
 * Save metrics ledger to .buildpact/metrics.json.
 */
export async function saveMetricsLedger(
  projectDir: string,
  ledger: MetricsLedger,
): Promise<Result<void>> {
  const dir = join(projectDir, '.buildpact')
  await mkdir(dir, { recursive: true })
  const path = join(dir, METRICS_FILE)
  try {
    await writeFile(path, JSON.stringify(ledger, null, 2), 'utf-8')
    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.METRICS_WRITE_FAILED,
      i18nKey: 'error.metrics.write_failed',
      params: { path },
    })
  }
}
