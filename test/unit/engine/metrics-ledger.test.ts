import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createMetricsLedger,
  createUnitMetrics,
  recordUnit,
  totalCostByPhase,
  totalCost,
  averageCostPerTask,
  projectedTotalCost,
  costBurnRate,
  totalTokens,
  loadMetricsLedger,
  saveMetricsLedger,
} from '../../../src/engine/metrics-ledger.js'
import type { UnitMetrics } from '../../../src/contracts/task.js'

const makeUnit = (overrides?: Partial<UnitMetrics>): UnitMetrics => ({
  unitType: 'execute-task',
  unitId: 'wave-0/task-0',
  model: 'claude-opus-4-6',
  startedAt: '2026-04-01T10:00:00Z',
  finishedAt: '2026-04-01T10:05:00Z',
  tokens: { input: 5000, output: 2000, cacheRead: 1000, cacheWrite: 500, total: 8500 },
  costUsd: 0.25,
  toolCalls: 12,
  phase: 'execution',
  ...overrides,
})

describe('createMetricsLedger', () => {
  it('creates empty ledger', () => {
    const l = createMetricsLedger()
    expect(l.version).toBe(1)
    expect(l.units).toEqual([])
    expect(l.projectStartedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('recordUnit', () => {
  it('appends unit to ledger', () => {
    let l = createMetricsLedger()
    l = recordUnit(l, makeUnit())
    l = recordUnit(l, makeUnit({ unitId: 'wave-0/task-1', costUsd: 0.30 }))
    expect(l.units).toHaveLength(2)
    expect(l.units[1]!.costUsd).toBe(0.30)
  })
})

describe('totalCostByPhase', () => {
  it('sums cost for a specific phase', () => {
    let l = createMetricsLedger()
    l = recordUnit(l, makeUnit({ phase: 'execution', costUsd: 0.25 }))
    l = recordUnit(l, makeUnit({ phase: 'execution', costUsd: 0.30 }))
    l = recordUnit(l, makeUnit({ phase: 'planning', costUsd: 0.10 }))
    expect(totalCostByPhase(l, 'execution')).toBeCloseTo(0.55)
    expect(totalCostByPhase(l, 'planning')).toBeCloseTo(0.10)
    expect(totalCostByPhase(l, 'research')).toBe(0)
  })
})

describe('totalCost', () => {
  it('sums all costs', () => {
    let l = createMetricsLedger()
    l = recordUnit(l, makeUnit({ costUsd: 0.25 }))
    l = recordUnit(l, makeUnit({ costUsd: 0.30 }))
    expect(totalCost(l)).toBeCloseTo(0.55)
  })
})

describe('averageCostPerTask', () => {
  it('returns average of execution phase units', () => {
    let l = createMetricsLedger()
    l = recordUnit(l, makeUnit({ phase: 'execution', costUsd: 0.20 }))
    l = recordUnit(l, makeUnit({ phase: 'execution', costUsd: 0.40 }))
    l = recordUnit(l, makeUnit({ phase: 'planning', costUsd: 1.00 })) // excluded
    expect(averageCostPerTask(l)).toBeCloseTo(0.30)
  })

  it('returns 0 for no execution units', () => {
    const l = createMetricsLedger()
    expect(averageCostPerTask(l)).toBe(0)
  })
})

describe('projectedTotalCost', () => {
  it('extrapolates from average cost', () => {
    let l = createMetricsLedger()
    l = recordUnit(l, makeUnit({ phase: 'execution', costUsd: 0.20 }))
    l = recordUnit(l, makeUnit({ phase: 'execution', costUsd: 0.40 }))
    // avg = 0.30, 2 done, total = 10, remaining = 8
    // projected = current(0.60) + avg(0.30) * remaining(8) = 0.60 + 2.40 = 3.00
    const projected = projectedTotalCost(l, 10)
    expect(projected).toBeCloseTo(3.0)
  })
})

describe('costBurnRate', () => {
  it('returns $/hour', () => {
    let l = createMetricsLedger()
    l.projectStartedAt = '2026-04-01T10:00:00Z'
    l = recordUnit(l, makeUnit({ costUsd: 1.00, finishedAt: '2026-04-01T11:00:00Z' }))
    // 1 hour elapsed, $1 spent = $1/hr
    expect(costBurnRate(l)).toBeCloseTo(1.0)
  })

  it('returns 0 for empty ledger', () => {
    expect(costBurnRate(createMetricsLedger())).toBe(0)
  })
})

describe('totalTokens', () => {
  it('sums all token counts', () => {
    let l = createMetricsLedger()
    l = recordUnit(l, makeUnit({ tokens: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, total: 150 } }))
    l = recordUnit(l, makeUnit({ tokens: { input: 200, output: 100, cacheRead: 0, cacheWrite: 0, total: 300 } }))
    expect(totalTokens(l)).toBe(450)
  })
})

describe('saveMetricsLedger / loadMetricsLedger', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('round-trips ledger through disk', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-metrics-'))
    let l = createMetricsLedger()
    l = recordUnit(l, makeUnit())
    l = recordUnit(l, makeUnit({ unitId: 'wave-1/task-0', costUsd: 0.50 }))

    const saveResult = await saveMetricsLedger(tempDir, l)
    expect(saveResult.ok).toBe(true)

    const loadResult = await loadMetricsLedger(tempDir)
    expect(loadResult.ok).toBe(true)
    if (loadResult.ok) {
      expect(loadResult.value.units).toHaveLength(2)
      expect(totalCost(loadResult.value)).toBeCloseTo(0.75)
    }
  })

  it('returns empty ledger when file does not exist', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-metrics-'))
    const result = await loadMetricsLedger(tempDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.units).toEqual([])
  })
})
