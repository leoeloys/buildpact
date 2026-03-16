import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  checkBudget,
  formatCostSummary,
  readBudgetConfig,
  readDailySpend,
  updateDailySpend,
  writeBudgetLimit,
  STUB_COST_PER_TASK_USD,
  today,
} from '../../../src/engine/budget-guard.js'
import type { BudgetConfig, BudgetCheckInput } from '../../../src/contracts/budget.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const unlimitedConfig = (): BudgetConfig => ({
  sessionLimitUsd: 0,
  phaseLimitUsd: 0,
  dailyLimitUsd: 0,
  warningThreshold: 0.8,
})

const limitedConfig = (): BudgetConfig => ({
  sessionLimitUsd: 1.0,
  phaseLimitUsd: 0.5,
  dailyLimitUsd: 5.0,
  warningThreshold: 0.8,
})

const input = (overrides?: Partial<BudgetCheckInput>): BudgetCheckInput => ({
  config: limitedConfig(),
  sessionSpendUsd: 0,
  phaseSpendUsd: 0,
  dailySpendUsd: 0,
  ...overrides,
})

// ---------------------------------------------------------------------------
// STUB_COST_PER_TASK_USD
// ---------------------------------------------------------------------------

describe('STUB_COST_PER_TASK_USD', () => {
  it('is a positive number', () => {
    expect(STUB_COST_PER_TASK_USD).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// today()
// ---------------------------------------------------------------------------

describe('today()', () => {
  it('returns an ISO date string (YYYY-MM-DD)', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ---------------------------------------------------------------------------
// checkBudget
// ---------------------------------------------------------------------------

describe('checkBudget', () => {
  it('allows when all limits are 0 (unlimited)', () => {
    const result = checkBudget(input({ config: unlimitedConfig() }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.allowed).toBe(true)
  })

  it('allows when spend is below all limits', () => {
    const result = checkBudget(input({ sessionSpendUsd: 0.1, phaseSpendUsd: 0.1, dailySpendUsd: 0.1 }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.allowed).toBe(true)
  })

  it('blocks when phase limit is reached', () => {
    const result = checkBudget(input({ phaseSpendUsd: 0.5 }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.allowed).toBe(false)
      expect(result.value.limitType).toBe('phase')
      expect(result.value.limitUsd).toBe(0.5)
      expect(result.value.currentSpendUsd).toBe(0.5)
    }
  })

  it('blocks when phase spend exceeds limit', () => {
    const result = checkBudget(input({ phaseSpendUsd: 0.6 }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.allowed).toBe(false)
      expect(result.value.limitType).toBe('phase')
    }
  })

  it('blocks when session limit is reached (phase unlimited)', () => {
    const cfg = { ...limitedConfig(), phaseLimitUsd: 0 }
    const result = checkBudget(input({ config: cfg, sessionSpendUsd: 1.0 }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.allowed).toBe(false)
      expect(result.value.limitType).toBe('session')
    }
  })

  it('blocks when daily limit is reached (session and phase unlimited)', () => {
    const cfg = { ...limitedConfig(), sessionLimitUsd: 0, phaseLimitUsd: 0 }
    const result = checkBudget(input({ config: cfg, dailySpendUsd: 5.0 }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.allowed).toBe(false)
      expect(result.value.limitType).toBe('daily')
    }
  })

  it('phase limit takes precedence over session when both exceeded', () => {
    const result = checkBudget(input({ sessionSpendUsd: 2.0, phaseSpendUsd: 0.6, dailySpendUsd: 10.0 }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.allowed).toBe(false)
      expect(result.value.limitType).toBe('phase')
    }
  })

  it('includes message when blocked', () => {
    const result = checkBudget(input({ phaseSpendUsd: 0.5 }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.message).toBeTruthy()
      expect(result.value.message).toContain('0.50')
    }
  })

  it('limitUsd is 0 when all limits are unlimited and allowed', () => {
    const result = checkBudget(input({ config: unlimitedConfig() }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.limitUsd).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// formatCostSummary
// ---------------------------------------------------------------------------

describe('formatCostSummary', () => {
  it('shows spend and limits for all 3 dimensions', () => {
    const summary = formatCostSummary(input({ sessionSpendUsd: 0.1, phaseSpendUsd: 0.05, dailySpendUsd: 0.5 }))
    expect(summary).toContain('Session')
    expect(summary).toContain('Phase')
    expect(summary).toContain('Daily')
  })

  it('shows ∞ for unlimited (0) limits', () => {
    const summary = formatCostSummary(input({ config: unlimitedConfig() }))
    expect(summary).toContain('∞')
  })

  it('shows formatted limit values when set', () => {
    const summary = formatCostSummary(input({ sessionSpendUsd: 0.0012 }))
    expect(summary).toContain('$1.00')  // session limit
    expect(summary).toContain('0.0012') // spend
  })
})

// ---------------------------------------------------------------------------
// readBudgetConfig
// ---------------------------------------------------------------------------

describe('readBudgetConfig', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bp-budget-test-'))
    await mkdir(join(dir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns default (all 0) when config.yaml does not exist', async () => {
    const config = await readBudgetConfig(dir)
    expect(config.sessionLimitUsd).toBe(0)
    expect(config.phaseLimitUsd).toBe(0)
    expect(config.dailyLimitUsd).toBe(0)
    expect(config.warningThreshold).toBe(0.8)
  })

  it('parses budget section from config.yaml', async () => {
    await writeFile(
      join(dir, '.buildpact', 'config.yaml'),
      'language: en\nbudget:\n  per_session_usd: 2.00\n  per_phase_usd: 0.50\n  per_day_usd: 10.00\n',
      'utf-8',
    )
    const config = await readBudgetConfig(dir)
    expect(config.sessionLimitUsd).toBe(2.0)
    expect(config.phaseLimitUsd).toBe(0.5)
    expect(config.dailyLimitUsd).toBe(10.0)
  })

  it('returns defaults when config.yaml has no budget section', async () => {
    await writeFile(join(dir, '.buildpact', 'config.yaml'), 'language: en\n', 'utf-8')
    const config = await readBudgetConfig(dir)
    expect(config.sessionLimitUsd).toBe(0)
  })

  it('parses warning_threshold when present', async () => {
    await writeFile(
      join(dir, '.buildpact', 'config.yaml'),
      'budget:\n  per_session_usd: 1.00\n  warning_threshold: 0.9\n',
      'utf-8',
    )
    const config = await readBudgetConfig(dir)
    expect(config.warningThreshold).toBe(0.9)
  })
})

// ---------------------------------------------------------------------------
// readDailySpend / updateDailySpend
// ---------------------------------------------------------------------------

describe('readDailySpend', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bp-budget-test-'))
    await mkdir(join(dir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns 0 when budget-usage.json does not exist', async () => {
    expect(await readDailySpend(dir)).toBe(0)
  })

  it('returns 0 when file is from a different day', async () => {
    await writeFile(
      join(dir, '.buildpact', 'budget-usage.json'),
      JSON.stringify({ date: '2000-01-01', spendUsd: 5.0 }),
      'utf-8',
    )
    expect(await readDailySpend(dir)).toBe(0)
  })

  it('returns spend when file date is today', async () => {
    await writeFile(
      join(dir, '.buildpact', 'budget-usage.json'),
      JSON.stringify({ date: today(), spendUsd: 1.23 }),
      'utf-8',
    )
    expect(await readDailySpend(dir)).toBe(1.23)
  })
})

describe('updateDailySpend', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bp-budget-test-'))
    await mkdir(join(dir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('creates budget-usage.json with today and spend', async () => {
    await updateDailySpend(dir, 0.01)
    const content = JSON.parse(await readFile(join(dir, '.buildpact', 'budget-usage.json'), 'utf-8')) as { date: string; spendUsd: number }
    expect(content.date).toBe(today())
    expect(content.spendUsd).toBeCloseTo(0.01)
  })

  it('accumulates spend on successive calls', async () => {
    await updateDailySpend(dir, 0.01)
    await updateDailySpend(dir, 0.02)
    expect(await readDailySpend(dir)).toBeCloseTo(0.03)
  })
})

// ---------------------------------------------------------------------------
// writeBudgetLimit
// ---------------------------------------------------------------------------

describe('writeBudgetLimit', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bp-budget-test-'))
    await mkdir(join(dir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('does nothing when config.yaml does not exist', async () => {
    // Should not throw
    await expect(writeBudgetLimit(dir, 'session', 5.0)).resolves.not.toThrow()
  })

  it('updates per_session_usd in config.yaml', async () => {
    await writeFile(
      join(dir, '.buildpact', 'config.yaml'),
      'budget:\n  per_session_usd: 1.00\n  per_phase_usd: 0.50\n',
      'utf-8',
    )
    await writeBudgetLimit(dir, 'session', 3.0)
    const content = await readFile(join(dir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(content).toContain('per_session_usd: 3.00')
    expect(content).toContain('per_phase_usd: 0.50')
  })

  it('updates per_phase_usd in config.yaml', async () => {
    await writeFile(
      join(dir, '.buildpact', 'config.yaml'),
      'budget:\n  per_session_usd: 1.00\n  per_phase_usd: 0.50\n',
      'utf-8',
    )
    await writeBudgetLimit(dir, 'phase', 2.0)
    const content = await readFile(join(dir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(content).toContain('per_phase_usd: 2.00')
  })

  it('updates per_day_usd in config.yaml', async () => {
    await writeFile(
      join(dir, '.buildpact', 'config.yaml'),
      'budget:\n  per_day_usd: 5.00\n',
      'utf-8',
    )
    await writeBudgetLimit(dir, 'daily', 20.0)
    const content = await readFile(join(dir, '.buildpact', 'config.yaml'), 'utf-8')
    expect(content).toContain('per_day_usd: 20.00')
  })
})
