/**
 * Budget guard — session/phase/day cost limits before execution.
 * @module engine/budget-guard
 * @see FR-705 — Budget Guards
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { BudgetConfig, BudgetCheckInput, BudgetGuardResult } from '../contracts/budget.js'
import type { Result } from '../contracts/errors.js'
import { ok } from '../contracts/errors.js'

/** Alpha stub cost per dispatched task (USD) */
export const STUB_COST_PER_TASK_USD = 0.001

/** ISO date string for today (YYYY-MM-DD) used for daily spend tracking */
export const today = (): string => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Budget config reader
// ---------------------------------------------------------------------------

/**
 * Read budget limits from .buildpact/config.yaml.
 * Looks for a `budget:` section with `per_session_usd`, `per_phase_usd`, `per_day_usd`.
 * Returns 0 (unlimited) for any limit not configured.
 * Pure in intent — reads file system; safe to call multiple times.
 */
export async function readBudgetConfig(projectDir: string): Promise<BudgetConfig> {
  const defaults: BudgetConfig = {
    sessionLimitUsd: 0,
    phaseLimitUsd: 0,
    dailyLimitUsd: 0,
    warningThreshold: 0.8,
  }
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    let inBudget = false
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === 'budget:') {
        inBudget = true
        continue
      }
      if (!inBudget) continue
      // Detect end of budget block (non-indented non-comment line)
      if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.length > 0 && !trimmed.startsWith('#')) {
        inBudget = false
        continue
      }
      if (trimmed.startsWith('per_session_usd:')) {
        defaults.sessionLimitUsd = parseFloat(trimmed.slice('per_session_usd:'.length).trim()) || 0
      } else if (trimmed.startsWith('per_phase_usd:')) {
        defaults.phaseLimitUsd = parseFloat(trimmed.slice('per_phase_usd:'.length).trim()) || 0
      } else if (trimmed.startsWith('per_day_usd:')) {
        defaults.dailyLimitUsd = parseFloat(trimmed.slice('per_day_usd:'.length).trim()) || 0
      } else if (trimmed.startsWith('warning_threshold:')) {
        defaults.warningThreshold = parseFloat(trimmed.slice('warning_threshold:'.length).trim()) || 0.8
      }
    }
  } catch {
    // Return defaults if config not found
  }
  return defaults
}

/**
 * Write updated budget limit to config.yaml.
 * Updates `per_session_usd`, `per_phase_usd`, or `per_day_usd` in the budget block.
 */
export async function writeBudgetLimit(
  projectDir: string,
  limitType: 'session' | 'phase' | 'daily',
  newLimitUsd: number,
): Promise<void> {
  const configPath = join(projectDir, '.buildpact', 'config.yaml')
  let content = ''
  try {
    content = await readFile(configPath, 'utf-8')
  } catch {
    return
  }

  const keyMap: Record<'session' | 'phase' | 'daily', string> = {
    session: 'per_session_usd',
    phase: 'per_phase_usd',
    daily: 'per_day_usd',
  }
  const key = keyMap[limitType]!
  const pattern = new RegExp(`(^[\\t ]*${key}:\\s*).*$`, 'm')
  if (pattern.test(content)) {
    content = content.replace(pattern, `$1${newLimitUsd.toFixed(2)}`)
  }
  await writeFile(configPath, content, 'utf-8')
}

// ---------------------------------------------------------------------------
// Daily spend persistence
// ---------------------------------------------------------------------------

interface DailyUsage {
  date: string
  spendUsd: number
}

/**
 * Read today's cumulative spend from .buildpact/budget-usage.json.
 * Returns 0 if the file does not exist or is from a different day.
 */
export async function readDailySpend(projectDir: string): Promise<number> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'budget-usage.json'), 'utf-8')
    const usage = JSON.parse(content) as DailyUsage
    if (usage.date === today()) return usage.spendUsd
  } catch {
    // ignore
  }
  return 0
}

/**
 * Persist updated daily spend to .buildpact/budget-usage.json.
 * Accumulates on top of the existing today value.
 */
export async function updateDailySpend(projectDir: string, additionalSpendUsd: number): Promise<void> {
  const current = await readDailySpend(projectDir)
  const updated: DailyUsage = { date: today(), spendUsd: current + additionalSpendUsd }
  try {
    await mkdir(join(projectDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(projectDir, '.buildpact', 'budget-usage.json'),
      JSON.stringify(updated, null, 2),
      'utf-8',
    )
  } catch {
    // ignore — budget tracking failure must not block execution
  }
}

// ---------------------------------------------------------------------------
// Budget check
// ---------------------------------------------------------------------------

/**
 * Check whether the current spend is within all configured budget limits.
 * Checks phase → session → daily (most specific first).
 * A limit of 0 means unlimited for that dimension.
 * Returns ok({ allowed: true }) when all limits are satisfied.
 * Returns ok({ allowed: false, limitType, ... }) when a limit is reached.
 */
export function checkBudget(input: BudgetCheckInput): Result<BudgetGuardResult> {
  const { config, sessionSpendUsd, phaseSpendUsd, dailySpendUsd } = input

  // Phase limit (most granular)
  if (config.phaseLimitUsd > 0 && phaseSpendUsd >= config.phaseLimitUsd) {
    return ok({
      allowed: false,
      currentSpendUsd: phaseSpendUsd,
      limitUsd: config.phaseLimitUsd,
      limitType: 'phase',
      message: `Phase budget of $${config.phaseLimitUsd.toFixed(2)} reached (spent: $${phaseSpendUsd.toFixed(4)})`,
    })
  }

  // Session limit
  if (config.sessionLimitUsd > 0 && sessionSpendUsd >= config.sessionLimitUsd) {
    return ok({
      allowed: false,
      currentSpendUsd: sessionSpendUsd,
      limitUsd: config.sessionLimitUsd,
      limitType: 'session',
      message: `Session budget of $${config.sessionLimitUsd.toFixed(2)} reached (spent: $${sessionSpendUsd.toFixed(4)})`,
    })
  }

  // Daily limit
  if (config.dailyLimitUsd > 0 && dailySpendUsd >= config.dailyLimitUsd) {
    return ok({
      allowed: false,
      currentSpendUsd: dailySpendUsd,
      limitUsd: config.dailyLimitUsd,
      limitType: 'daily',
      message: `Daily budget of $${config.dailyLimitUsd.toFixed(2)} reached (spent: $${dailySpendUsd.toFixed(4)})`,
    })
  }

  const effectiveLimit = Math.min(
    config.sessionLimitUsd > 0 ? config.sessionLimitUsd : Infinity,
    config.phaseLimitUsd > 0 ? config.phaseLimitUsd : Infinity,
    config.dailyLimitUsd > 0 ? config.dailyLimitUsd : Infinity,
  )

  return ok({
    allowed: true,
    currentSpendUsd: sessionSpendUsd,
    limitUsd: effectiveLimit === Infinity ? 0 : effectiveLimit,
  })
}

// ---------------------------------------------------------------------------
// Cost summary formatter
// ---------------------------------------------------------------------------

/**
 * Format a human-readable cost summary showing spend vs. limits for all 3 dimensions.
 * Uses '∞' when a limit is 0 (unlimited).
 * Pure function — no side effects.
 */
export function formatCostSummary(input: BudgetCheckInput): string {
  const fmtLimit = (l: number) => (l > 0 ? `$${l.toFixed(2)}` : '∞')
  const lines = [
    `Session: $${input.sessionSpendUsd.toFixed(4)} / ${fmtLimit(input.config.sessionLimitUsd)}`,
    `Phase:   $${input.phaseSpendUsd.toFixed(4)} / ${fmtLimit(input.config.phaseLimitUsd)}`,
    `Daily:   $${input.dailySpendUsd.toFixed(4)} / ${fmtLimit(input.config.dailyLimitUsd)}`,
  ]
  return lines.join('\n')
}
