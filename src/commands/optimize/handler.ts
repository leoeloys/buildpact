/**
 * Optimize command handler.
 * AutoResearch: autonomous experimentation loop on a target file.
 * Expert-only: blocked for beginner/intermediate experience levels.
 * Shard-first guard: target files >600 lines are blocked with a shard instruction.
 * @see FR-AutoResearch — Autonomous Optimization Loop
 */

import * as clack from '@clack/prompts'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { slugify } from '../../foundation/sharding.js'
import {
  parseBudgetFromArgs,
  createExperimentSession,
  isSessionBudgetExhausted,
  startNextExperiment,
  completeExperiment,
  stopSession,
  addSessionSpend,
  isCostLimitReached,
  formatLoopStatus,
  buildLoopSummary,
} from '../../optimize/experiment-loop.js'
import { readBudgetConfig } from '../../engine/budget-guard.js'

/** Maximum line count for a target file before shard-first guard triggers */
export const MAX_TARGET_LINES = 600

// ---------------------------------------------------------------------------
// Helpers
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
    // Config missing or unreadable — fall back to English
  }
  return 'en'
}

/** Read experience_level from .buildpact/config.yaml, fallback to 'beginner' */
export async function readExperienceLevel(projectDir: string): Promise<string> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('experience_level:')) {
        return trimmed.slice('experience_level:'.length).trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // Config missing or unreadable — fall back to beginner (safe default)
  }
  return 'beginner'
}

/** Count lines in a file. Returns 0 if file cannot be read. */
export async function countFileLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

/**
 * Build the program.md content for an AutoResearch optimization run.
 * Defines: optimization goal, constraints, experiment directions, acceptance criteria.
 */
export function buildProgramMd(
  target: string,
  generatedAt: string,
): string {
  const lines = [
    `# AutoResearch Program — ${target}`,
    '',
    `> Generated: ${generatedAt}  `,
    `> Mode: optimize (autonomous experimentation loop)`,
    '',
    '## Optimization Goal',
    '',
    `Improve the quality, performance, and maintainability of \`${target}\` through`,
    'systematic experimentation while preserving all existing functionality.',
    '',
    '## Constraints',
    '',
    '- All existing tests must continue to pass after each experiment',
    '- No breaking changes to the public API or exported interfaces',
    '- Each experiment must be atomic — reversible via a single git revert',
    '- Constitution rules apply to all generated or modified code',
    '',
    '## Experiment Directions',
    '',
    '### Direction 1: Readability & Structure',
    '- Extract complex logic into well-named helper functions',
    '- Simplify nested conditionals with early returns or guard clauses',
    '- Remove dead code and unused imports',
    '',
    '### Direction 2: Performance',
    '- Identify hot paths and reduce redundant computation',
    '- Replace synchronous I/O with async alternatives where applicable',
    '- Minimize re-renders or repeated traversals (if applicable)',
    '',
    '### Direction 3: Robustness',
    '- Add explicit error handling for all I/O and async operations',
    '- Replace implicit type coercions with explicit conversions',
    '- Ensure all edge cases identified in tests are handled',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] All existing tests pass after each experiment',
    '- [ ] Cyclomatic complexity does not increase',
    '- [ ] No new TypeScript errors introduced',
    `- [ ] At least one measurable improvement applied to \`${target}\``,
    '- [ ] Each experiment committed atomically with a descriptive message',
    '',
    '## Experiment Log',
    '',
    '| # | Direction | Hypothesis | Outcome |',
    '|---|-----------|------------|---------|',
    '| 1 | — | — | pending |',
    '',
  ]

  return lines.join('\n')
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

    clack.intro(i18n.t('cli.optimize.welcome'))

    // Guard: Expert-only command
    const experienceLevel = await readExperienceLevel(projectDir)
    if (experienceLevel !== 'expert') {
      clack.log.error(i18n.t('cli.optimize.expert_only'))
      clack.outro(i18n.t('cli.optimize.expert_only_outro'))
      return err({
        code: ERROR_CODES.EXPERT_ONLY,
        i18nKey: 'cli.optimize.expert_only',
      })
    }

    // Resolve target from args
    const target = args.filter((a) => !a.startsWith('--')).join(' ').trim()
    if (!target) {
      clack.log.error(i18n.t('cli.optimize.missing_target'))
      clack.outro(i18n.t('cli.optimize.missing_target_outro'))
      return err({
        code: ERROR_CODES.FILE_READ_FAILED,
        i18nKey: 'cli.optimize.missing_target',
        params: { path: '<target>' },
      })
    }

    // Guard: Target file must not exceed MAX_TARGET_LINES
    const targetPath = join(projectDir, target)
    const lineCount = await countFileLines(targetPath)
    if (lineCount > MAX_TARGET_LINES) {
      clack.log.error(
        i18n.t('cli.optimize.shard_first', {
          target,
          lines: String(lineCount),
          max: String(MAX_TARGET_LINES),
        }),
      )
      clack.outro(i18n.t('cli.optimize.shard_first_outro'))
      return err({
        code: ERROR_CODES.TARGET_TOO_LARGE,
        i18nKey: 'cli.optimize.shard_first',
        params: { target, lines: String(lineCount), max: String(MAX_TARGET_LINES) },
      })
    }

    // Build and write program.md
    const slug = slugify(target)
    const optimizeDir = join(projectDir, '.buildpact', 'optimize', slug)
    const programPath = join(optimizeDir, 'program.md')
    const generatedAt = new Date().toISOString()

    const programContent = buildProgramMd(target, generatedAt)

    try {
      await mkdir(optimizeDir, { recursive: true })
      await writeFile(programPath, programContent, 'utf-8')
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      clack.log.error(i18n.t('error.file.write_failed'))
      return err({
        code: ERROR_CODES.FILE_WRITE_FAILED,
        i18nKey: 'error.file.write_failed',
        params: { path: programPath, reason },
        cause: e,
      })
    }

    await audit.log({
      action: 'optimize.program',
      agent: 'optimize',
      files: [`.buildpact/optimize/${slug}/program.md`],
      outcome: 'success',
    })

    clack.log.success(
      i18n.t('cli.optimize.program_written', {
        path: `.buildpact/optimize/${slug}/program.md`,
      }),
    )

    // --loop flag: run the fixed-budget experiment loop
    const hasLoop = args.includes('--loop')

    if (!hasLoop) {
      clack.outro(
        i18n.t('cli.optimize.loop_no_flag', { target }),
      )
      return ok(undefined)
    }

    // Parse time budgets from args
    const budget = parseBudgetFromArgs(args)
    const budgetConfig = await readBudgetConfig(projectDir)

    const expMinutes = Math.round(budget.experimentMs / 60_000)
    const sessMinutes = Math.round(budget.sessionMs / 60_000)

    clack.log.info(
      i18n.t('cli.optimize.loop_start', {
        exp: String(expMinutes),
        session: String(sessMinutes),
      }),
    )

    let session = createExperimentSession(budget, Date.now())

    // Experiment loop — stub execution in Alpha (real execution via subagents in production)
    while (!session.stopped) {
      // Check session time budget
      if (isSessionBudgetExhausted(session, Date.now())) {
        session = stopSession(session, 'session_time_exhausted')
        clack.log.warn(
          i18n.t('cli.optimize.loop_session_exhausted', {
            budget: String(sessMinutes),
            count: String(session.completedExperiments.length),
          }),
        )
        break
      }

      // Check cost budget (Budget Guard integration)
      if (isCostLimitReached(session.sessionSpendUsd, budgetConfig.sessionLimitUsd)) {
        clack.log.warn(
          i18n.t('cli.optimize.loop_cost_limit', {
            cost: session.sessionSpendUsd.toFixed(4),
          }),
        )

        const choice = await clack.select({
          message: i18n.t('cli.optimize.loop_cost_question'),
          options: [
            { value: 'continue', label: i18n.t('cli.optimize.loop_cost_continue') },
            { value: 'switch', label: i18n.t('cli.optimize.loop_cost_switch') },
            { value: 'stop', label: i18n.t('cli.optimize.loop_cost_stop') },
          ],
        })

        if (clack.isCancel(choice) || choice === 'stop' || choice === 'switch') {
          session = stopSession(session, 'cost_limit_reached')
          break
        }
        // 'continue' — user chose to keep going (limit check bypassed for this iteration)
      }

      // Start next experiment
      session = startNextExperiment(session, Date.now())
      clack.log.info(
        i18n.t('cli.optimize.loop_experiment_start', {
          n: String(session.currentExperimentNumber),
        }),
      )

      // Alpha stub: record a no_change result immediately (real implementation dispatches subagent)
      const nowMs = Date.now()
      const stubSpend = 0.001
      session = addSessionSpend(session, stubSpend)

      // In Alpha, complete with no_change to avoid infinite loop — real loop runs until budget exhausted
      session = completeExperiment(session, {
        completedAtMs: nowMs,
        outcome: 'no_change',
        description: `Experiment #${session.currentExperimentNumber} stub (Alpha)`,
      })

      clack.log.info(
        i18n.t('cli.optimize.loop_experiment_complete', {
          n: String(session.currentExperimentNumber),
          outcome: 'no_change',
        }),
      )

      // Show status
      clack.log.info(formatLoopStatus(session, Date.now()))

      // Stop after one stub iteration in Alpha to prevent infinite loop
      session = stopSession(session, 'session_time_exhausted')
    }

    // Log loop completion
    const summary = buildLoopSummary(session, Date.now())
    clack.log.success(summary)

    await audit.log({
      action: 'optimize.loop',
      agent: 'optimize',
      files: [`.buildpact/optimize/${slug}/program.md`],
      outcome: 'success',
    })

    clack.outro(
      i18n.t('cli.optimize.loop_stopped', {
        count: String(session.completedExperiments.length),
      }),
    )

    return ok(undefined)
  },
}
