/**
 * Execute command handler.
 * Reads a wave-based plan and dispatches each wave's tasks to isolated subagents in parallel.
 * Waves are executed sequentially — next wave begins only after all tasks in the current wave complete.
 * @see FR-701 — Wave-Parallel Execution with Subagent Isolation (Epic 6)
 */

import * as clack from '@clack/prompts'
import { readFile, readdir } from 'node:fs/promises'
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
  executeWaves,
} from '../../engine/wave-executor.js'
import type { WaveTask, WaveExecutionResult } from '../../engine/wave-executor.js'

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
): WaveTask[][] {
  const waveMap = new Map<number, WaveTask[]>()

  for (const wf of waveFiles) {
    const tasks = parseWaveTasksFromPlanFile(wf.content, wf.waveNumber, constitutionPath)
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
    const waveGroups = buildWaveTaskGroups(waveFiles, constitutionPath)

    const totalTasks = waveGroups.reduce((sum, g) => sum + g.length, 0)
    clack.log.info(
      i18n.t('cli.execute.plan_summary', {
        slug: planSlug,
        waves: String(waveGroups.length),
        tasks: String(totalTasks),
      }),
    )

    // Execute waves sequentially — within each wave, tasks run in parallel
    const executeSpinner = clack.spinner()
    executeSpinner.start(i18n.t('cli.execute.executing'))

    const execResult = executeWaves(waveGroups)

    if (!execResult.ok) {
      executeSpinner.stop(i18n.t('cli.execute.wave_failed', { wave: execResult.error.params?.['wave'] ?? '?' }))
      clack.log.error(i18n.t('cli.execute.execution_failed'))
      return err(execResult.error)
    }

    const waveResults = execResult.value
    const totalSucceeded = waveResults.reduce((s, w) => s + w.tasks.filter(t => t.success).length, 0)
    const totalFailed = waveResults.reduce((s, w) => s + w.tasks.filter(t => !t.success).length, 0)

    executeSpinner.stop(
      i18n.t('cli.execute.done_summary', {
        succeeded: String(totalSucceeded),
        failed: String(totalFailed),
      }),
    )

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
    await audit.log({
      action: 'execute.run',
      agent: 'execute',
      files: [],
      outcome: totalFailed === 0 ? 'success' : 'failure',
    })

    clack.outro(i18n.t('cli.execute.complete', { slug: planSlug }))
    return ok(undefined)
  },
}
