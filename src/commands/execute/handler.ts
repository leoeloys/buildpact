/**
 * Execute command handler.
 * Reads a wave-based plan and dispatches each wave's tasks to isolated subagents in parallel.
 * Waves are executed sequentially — next wave begins only after all tasks in the current wave complete.
 * @see FR-701 — Wave-Parallel Execution with Subagent Isolation (Epic 6)
 */

import * as clack from '@clack/prompts'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage, I18nResolver } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { resolveConstitutionPath } from '../../engine/constitution-enforcer.js'
import {
  parseWaveTasksFromPlanFile,
  executeWave,
} from '../../engine/wave-executor.js'
import type { WaveTask, WaveExecutionResult } from '../../engine/wave-executor.js'
import { WaveProgressRenderer } from '../../engine/progress-renderer.js'
import type { TuiAdapter } from '../../engine/progress-renderer.js'
import { persistToAudit } from '../../engine/cost-projector.js'
import {
  verifyWaveAcs,
  formatWaveVerificationReport,
  buildWaveFixPlan,
} from '../../engine/wave-verifier.js'
import {
  readBudgetConfig,
  readDailySpend,
  updateDailySpend,
  writeBudgetLimit,
  checkBudget,
  formatCostSummary,
  STUB_COST_PER_TASK_USD,
} from '../../engine/budget-guard.js'
import {
  readApprovalStore,
  getAgentLevel,
  requiresWriteConfirmation,
} from '../../engine/autonomy-manager.js'
import { registerEvent } from '../../engine/project-ledger.js'
import { refreshBuildpactMaps } from '../../engine/directory-map.js'
import { isCiMode, ciLog } from '../../foundation/ci.js'

// ---------------------------------------------------------------------------
// Plan discovery — pure functions exported for unit testing
// ---------------------------------------------------------------------------

/** Plan entry found in .buildpact/plans/ */
export interface PlanEntry {
  slug: string
  planDir: string
}

/** A loaded wave file ready for task extraction */
export interface WaveFile {
  filename: string
  waveNumber: number
  content: string
}

/**
 * Find the most recent plan directory in .buildpact/plans/.
 * Uses last alphabetical entry (slug format ensures ordering).
 * Pure function — no side effects.
 */
export async function findLatestPlan(projectDir: string): Promise<PlanEntry | undefined> {
  try {
    const plansDir = join(projectDir, '.buildpact', 'plans')
    const entries = await readdir(plansDir)
    if (entries.length === 0) return undefined
    const slug = entries[entries.length - 1] ?? ''
    if (!slug) return undefined
    return { slug, planDir: join(plansDir, slug) }
  } catch {
    return undefined
  }
}

/**
 * Load all wave plan files (plan-wave-N.md, plan-wave-Nb.md, ...) from a plan directory.
 * Extracts the wave number from the filename.
 * Pure function — no side effects (takes planDir as param).
 */
export async function loadWaveFiles(planDir: string): Promise<WaveFile[]> {
  const waveFiles: WaveFile[] = []
  try {
    const entries = await readdir(planDir)
    const waveFilenames = entries
      .filter(f => /^plan-wave-\d+[a-z]?\.md$/.test(f))
      .sort()

    for (const filename of waveFilenames) {
      const match = /^plan-wave-(\d+)[a-z]?\.md$/.exec(filename)
      if (!match) continue
      const waveNumber = parseInt(match[1] ?? '1', 10) - 1 // 0-indexed
      const content = await readFile(join(planDir, filename), 'utf-8')
      waveFiles.push({ filename, waveNumber, content })
    }
  } catch {
    // Return whatever was loaded so far
  }
  return waveFiles
}

/**
 * Group wave files by wave number and build WaveTask[][] — parallel task groups.
 * Multiple part files for the same wave (plan-wave-1.md + plan-wave-1b.md) are merged.
 * Pure function — no side effects.
 */
export function buildWaveTaskGroups(
  waveFiles: WaveFile[],
  constitutionPath?: string,
  phaseSlug?: string,
): WaveTask[][] {
  const waveMap = new Map<number, WaveTask[]>()

  for (const wf of waveFiles) {
    const tasks = parseWaveTasksFromPlanFile(wf.content, wf.waveNumber, constitutionPath, phaseSlug)
    const existing = waveMap.get(wf.waveNumber) ?? []
    waveMap.set(wf.waveNumber, [...existing, ...tasks])
  }

  return Array.from(waveMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, tasks]) => tasks)
    .filter(tasks => tasks.length > 0)
}

/**
 * Format a summary of wave execution results for display.
 * Pure function — no side effects.
 */
export function formatExecutionSummary(results: WaveExecutionResult[], i18n: I18nResolver): string {
  const lines: string[] = []
  for (const wave of results) {
    const passed = wave.tasks.filter(t => t.success).length
    const failed = wave.tasks.filter(t => !t.success).length
    lines.push(
      i18n.t('cli.execute.wave_summary', {
        wave: String(wave.waveNumber + 1),
        passed: String(passed),
        failed: String(failed),
        total: String(wave.tasks.length),
      }),
    )
    for (const task of wave.tasks.filter(t => !t.success)) {
      lines.push(i18n.t('cli.execute.task_failed', { title: task.title, error: task.error ?? '' }))
    }
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Config reader
// ---------------------------------------------------------------------------

/**
 * Load spec content for a plan slug.
 * Returns undefined if the spec file is not found.
 */
async function loadSpecContent(projectDir: string, planSlug: string): Promise<string | undefined> {
  try {
    const specPath = join(projectDir, '.buildpact', 'specs', planSlug, 'spec.md')
    return await readFile(specPath, 'utf-8')
  } catch {
    return undefined
  }
}

/** Read active_squad name from .buildpact/config.yaml, or undefined if none/missing */
async function readActiveSquadName(projectDir: string): Promise<string | undefined> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('active_squad:')) {
        const value = trimmed.slice('active_squad:'.length).trim().replace(/^["']|["']$/g, '')
        if (value && value !== 'none') return value
      }
    }
  } catch {
    // ignore
  }
  return undefined
}

/** Read language from .buildpact/config.yaml, fallback to 'en' */
async function readLanguage(projectDir: string): Promise<SupportedLanguage> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('language:')) {
        const value = trimmed.slice('language:'.length).trim().replace(/^["']|["']$/g, '')
        if (value === 'pt-br' || value === 'en') return value
      }
    }
  } catch {
    // ignore
  }
  return 'en'
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(args: string[]) {
    const projectDir = process.cwd()
    const lang = await readLanguage(projectDir)
    const i18n = createI18n(lang)
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))
    const isCi = isCiMode(args)

    clack.intro(i18n.t('cli.execute.welcome'))

    // Resolve plan directory — from arg (path to plan dir) or latest in .buildpact/plans/
    let planDir: string
    let planSlug: string

    if (args[0]) {
      planDir = args[0]
      planSlug = args[0].split('/').at(-1) ?? 'unknown'
    } else {
      const latest = await findLatestPlan(projectDir)
      if (!latest) {
        clack.log.warn(i18n.t('cli.execute.no_plan_found'))
        clack.outro(i18n.t('cli.execute.no_plan_outro'))
        return ok(undefined)
      }
      planDir = latest.planDir
      planSlug = latest.slug
    }

    const constitutionPath = await resolveConstitutionPath(projectDir)

    // Load wave files
    const spinner = clack.spinner()
    spinner.start(i18n.t('cli.execute.loading_waves'))
    const waveFiles = await loadWaveFiles(planDir)
    spinner.stop(i18n.t('cli.execute.waves_loaded', { count: String(waveFiles.length) }))

    if (waveFiles.length === 0) {
      clack.log.warn(i18n.t('cli.execute.no_wave_files', { dir: planDir }))
      clack.outro(i18n.t('cli.execute.no_wave_outro'))
      return ok(undefined)
    }

    // Build wave task groups — parallel tasks per wave
    // Pass planSlug so each task's atomic commit message carries the plan scope (FR-702)
    const waveGroups = buildWaveTaskGroups(waveFiles, constitutionPath, planSlug)

    const totalTasks = waveGroups.reduce((sum, g) => sum + g.length, 0)
    clack.log.info(
      i18n.t('cli.execute.plan_summary', {
        slug: planSlug,
        waves: String(waveGroups.length),
        tasks: String(totalTasks),
      }),
    )

    // Load spec content for goal-backward AC verification (FR-751)
    const specContent = await loadSpecContent(projectDir, planSlug)
    if (!specContent) {
      clack.log.warn(i18n.t('cli.execute.no_spec_for_verification'))
    }

    // Load budget config and daily spend baseline (FR-705)
    const budgetConfig = await readBudgetConfig(projectDir)
    const dailySpendBaseline = await readDailySpend(projectDir)
    let sessionSpendUsd = 0
    let phaseSpendUsd = 0

    // Autonomy level check — L1 agents require user confirmation before write operations (FR-851)
    const activeSquadName = await readActiveSquadName(projectDir)
    const approvalStore = await readApprovalStore(projectDir)
    const agentLevel = getAgentLevel(activeSquadName ?? '__default__', approvalStore, 'L2')
    const needsWriteConfirm = requiresWriteConfirmation(agentLevel)

    // Set up progress renderer for real-time terminal feedback
    const tuiAdapter: TuiAdapter = {
      spinner: () => clack.spinner(),
      log: clack.log,
    }
    const renderer = new WaveProgressRenderer(tuiAdapter)

    // Graceful shutdown — register SIGINT/SIGTERM handlers
    let cancelled = false
    const signalHandler = () => {
      cancelled = true
      clack.log.warn(i18n.t('cli.execute.cancelling') || 'Cancelling execution, waiting for current tasks to finish...')
    }
    process.on('SIGINT', signalHandler)
    process.on('SIGTERM', signalHandler)

    // Execute waves sequentially with goal-backward verification after each wave
    const executeSpinner = clack.spinner()
    executeSpinner.start(i18n.t('cli.execute.executing'))

    const waveResults: WaveExecutionResult[] = []
    let waveExecutionFailed = false
    let verificationFailed = false

    for (const waveTasks of waveGroups) {
      // Graceful shutdown check
      if (cancelled) {
        executeSpinner.stop(i18n.t('cli.execute.cancelled') || 'Execution cancelled.')
        break
      }

      // Budget guard — check before dispatching any AI calls for this wave (FR-705)
      const budgetCheck = checkBudget({
        config: budgetConfig,
        sessionSpendUsd,
        phaseSpendUsd,
        dailySpendUsd: dailySpendBaseline + sessionSpendUsd,
      })
      if (budgetCheck.ok && !budgetCheck.value.allowed) {
        executeSpinner.stop(i18n.t('cli.execute.budget_exceeded', { type: budgetCheck.value.limitType ?? 'unknown', limit: budgetCheck.value.limitUsd.toFixed(2) }))
        const summary = formatCostSummary({ config: budgetConfig, sessionSpendUsd, phaseSpendUsd, dailySpendUsd: dailySpendBaseline + sessionSpendUsd })
        clack.log.warn(i18n.t('cli.execute.budget_summary') + '\n' + summary)

        if (isCi) {
          // CI mode: strict budget enforcement — no override prompt
          ciLog('budget-exceeded', (budgetCheck.value.limitType ?? 'unknown') + ' limit $' + budgetCheck.value.limitUsd.toFixed(2))
          waveExecutionFailed = true
          break
        }

        const action = await clack.select({
          message: i18n.t('cli.execute.budget_action_prompt'),
          options: [
            { value: 'increase', label: i18n.t('cli.execute.budget_increase_limit') },
            { value: 'profile', label: i18n.t('cli.execute.budget_switch_profile') },
            { value: 'stop', label: i18n.t('cli.execute.budget_stop_preserve') },
          ],
        })

        if (clack.isCancel(action) || action === 'stop') {
          clack.log.warn(i18n.t('cli.execute.budget_stopped'))
          break
        }

        if (action === 'increase') {
          const newLimitRaw = await clack.text({
            message: i18n.t('cli.execute.budget_limit_prompt'),
            placeholder: '5.00',
          })
          if (!clack.isCancel(newLimitRaw)) {
            const newLimit = parseFloat(String(newLimitRaw)) || budgetCheck.value.limitUsd * 2
            await writeBudgetLimit(projectDir, budgetCheck.value.limitType!, newLimit)
            if (budgetCheck.value.limitType === 'session') budgetConfig.sessionLimitUsd = newLimit
            else if (budgetCheck.value.limitType === 'phase') budgetConfig.phaseLimitUsd = newLimit
            else budgetConfig.dailyLimitUsd = newLimit
            clack.log.success(i18n.t('cli.execute.budget_limit_increased', { limit: newLimit.toFixed(2) }))
          }
        } else if (action === 'profile') {
          // Profile switching stub — budget profile applies cheaper model (full impl in model-profile-manager)
          budgetConfig.sessionLimitUsd = budgetConfig.sessionLimitUsd > 0 ? budgetConfig.sessionLimitUsd * 2 : 0
          budgetConfig.phaseLimitUsd = budgetConfig.phaseLimitUsd > 0 ? budgetConfig.phaseLimitUsd * 2 : 0
          budgetConfig.dailyLimitUsd = budgetConfig.dailyLimitUsd > 0 ? budgetConfig.dailyLimitUsd * 2 : 0
          clack.log.success(i18n.t('cli.execute.budget_profile_switched'))
        }

        executeSpinner.start(i18n.t('cli.execute.executing'))
      }
      const waveNumber = waveTasks[0]?.waveNumber ?? 0

      // L1 autonomy confirmation — L1 agents require explicit approval before any write op (FR-851)
      if (needsWriteConfirm) {
        if (isCi) {
          ciLog('auto-confirmed', 'L1 write operation')
        } else {
          executeSpinner.stop(i18n.t('cli.execute.executing'))
          const firstTask = waveTasks[0]?.title ?? ''
          const confirmed = await clack.confirm({
            message: i18n.t('cli.autonomy.l1_write_confirm', {
              agent: activeSquadName ?? 'agent',
              task: firstTask,
            }),
          })
          if (clack.isCancel(confirmed) || confirmed === false) {
            clack.log.warn(i18n.t('cli.autonomy.l1_write_cancelled', { agent: activeSquadName ?? 'agent' }))
            break
          }
          executeSpinner.start(i18n.t('cli.execute.executing'))
        }
      }

      const waveResult = executeWave(waveTasks, {
        renderer,
        totalWaves: waveGroups.length,
        cancelled: () => cancelled,
      })
      waveResults.push(waveResult)

      // Accumulate stub spend for this wave (FR-705)
      const waveSpend = waveTasks.length * STUB_COST_PER_TASK_USD
      sessionSpendUsd += waveSpend
      phaseSpendUsd += waveSpend
      await updateDailySpend(projectDir, waveSpend)

      // Goal-backward verification: always verify ACs when spec is available (FR-751)
      if (specContent) {
        const verReport = verifyWaveAcs(specContent, waveResult)

        // Write verification report for every wave (pass or fail)
        const reportContent = formatWaveVerificationReport(verReport)
        await writeFile(
          join(planDir, `verification-wave-${waveNumber + 1}.md`),
          reportContent,
          'utf-8',
        )

        if (!verReport.allPassed) {
          verificationFailed = true

          // Write targeted fix plan for failed ACs
          const failedAcs = verReport.acResults.filter(r => !r.passed).map(r => r.ac)
          const fixPlanContent = buildWaveFixPlan(failedAcs, waveNumber, planSlug)
          const fixDir = join(planDir, 'fix')
          await mkdir(fixDir, { recursive: true })
          await writeFile(join(fixDir, 'plan-wave-1.md'), fixPlanContent, 'utf-8')

          executeSpinner.stop(
            i18n.t('cli.execute.verification_failed', {
              wave: String(waveNumber + 1),
              count: String(verReport.failCount),
            }),
          )
          clack.log.warn(i18n.t('cli.execute.fix_plan_written', { path: fixDir }))
          break
        }

        if (!waveResult.allSucceeded) {
          // Tasks failed but no mapped ACs — still halt execution
          waveExecutionFailed = true
          executeSpinner.stop(
            i18n.t('cli.execute.wave_failed', { wave: String(waveNumber + 1) }),
          )
          clack.log.error(i18n.t('cli.execute.execution_failed'))
          break
        }

        clack.log.success(
          i18n.t('cli.execute.verification_passed', {
            wave: String(waveNumber + 1),
            count: String(verReport.passCount),
          }),
        )
      } else {
        // No spec — fall back to task success/failure check
        if (!waveResult.allSucceeded) {
          waveExecutionFailed = true
          executeSpinner.stop(
            i18n.t('cli.execute.wave_failed', { wave: String(waveNumber + 1) }),
          )
          clack.log.error(i18n.t('cli.execute.execution_failed'))
          break
        }
      }
    }

    if (!waveExecutionFailed && !verificationFailed) {
      const totalSucceeded = waveResults.reduce(
        (s, w) => s + w.tasks.filter(t => t.success).length,
        0,
      )
      const totalFailed = waveResults.reduce(
        (s, w) => s + w.tasks.filter(t => !t.success).length,
        0,
      )
      executeSpinner.stop(
        i18n.t('cli.execute.done_summary', {
          succeeded: String(totalSucceeded),
          failed: String(totalFailed),
        }),
      )
    }

    // Clean up signal handlers
    process.removeListener('SIGINT', signalHandler)
    process.removeListener('SIGTERM', signalHandler)

    // Persist cost data to audit trail
    const waveTaskResults = waveResults.map(w => w.tasks)
    await persistToAudit(projectDir, waveTaskResults, 'balanced').catch(() => {
      // Best-effort — don't fail execution if audit write fails
    })

    // Report per-wave results
    for (const wave of waveResults) {
      const icon = wave.allSucceeded ? 'success' : 'warn'
      clack.log[icon](
        i18n.t('cli.execute.wave_summary', {
          wave: String(wave.waveNumber + 1),
          passed: String(wave.tasks.filter(t => t.success).length),
          failed: String(wave.tasks.filter(t => !t.success).length),
          total: String(wave.tasks.length),
        }),
      )
    }

    // Audit
    const overallOutcome = waveExecutionFailed || verificationFailed ? 'failure' : 'success'
    await audit.log({
      action: 'execute.run',
      agent: 'execute',
      files: [],
      outcome: overallOutcome,
    })

    // Project ledger — execution event (continuous audit)
    const executedTotal = waveResults.reduce((s, w) => s + w.tasks.length, 0)
    const passedTasks = waveResults.reduce((s, w) => s + w.tasks.filter(t => t.success).length, 0)
    await registerEvent(
      projectDir, 'TASK_COMPLETE', `exec-${planSlug}`,
      `Execution ${overallOutcome}: ${passedTasks}/${executedTotal} tasks passed across ${waveResults.length} wave(s)`,
      join(projectDir, '.buildpact', 'plans', planSlug, 'plan.md'),
    ).catch(() => {})

    // Refresh per-directory MAP.md indexes
    await refreshBuildpactMaps(projectDir).catch(() => {})

    if (waveExecutionFailed) {
      return err({
        code: ERROR_CODES.NOT_IMPLEMENTED,
        i18nKey: 'error.execute.wave_failed',
        params: {},
        phase: 'Epic 6',
      })
    }

    clack.outro(i18n.t('cli.execute.complete', { slug: planSlug }))
    return ok(undefined)
  },
}
