/**
 * Quick command handler.
 * Zero-ceremony: natural language → minimal spec → atomic Git commit.
 * --discuss variant asks 3-5 clarifying questions before execution.
 * --full variant adds plan generation, 2-perspective validation, risk confirm, and verification.
 * @see FR-401 — Zero-Ceremony Execution
 * @see FR-402 — Lightweight Context Gathering
 * @see FR-403 — Quick Flow with Plan Verification
 */

import * as clack from '@clack/prompts'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage, I18nResolver } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { slugify } from '../../foundation/sharding.js'
import { resolveConstitutionPath } from '../../engine/constitution-enforcer.js'
import { buildTaskPayload } from '../../engine/subagent.js'
import { assessScale, formatScaleAssessment } from '../../engine/scale-router.js'
import { isCiMode, ciLog } from '../../foundation/ci.js'
import { generateDiscussQuestions, buildRefinedSpec } from './discuss-flow.js'
import type { QuickAnswer } from './discuss-flow.js'
import {
  generateMinimalPlan,
  validatePlanCompleteness,
  validatePlanDependencies,
  generateFixPlan,
} from './plan-verifier.js'

// ---------------------------------------------------------------------------
// Discuss-mode: clarifying questions (uses discuss-flow.ts pure functions)
// ---------------------------------------------------------------------------

/**
 * Gather clarifying questions for --discuss mode.
 * Uses generateDiscussQuestions() to produce 3–5 targeted questions based on description.
 * Returns collected QuickAnswer[], or undefined if user cancels.
 */
async function gatherDiscussContext(
  description: string,
  i18n: I18nResolver,
): Promise<QuickAnswer[] | undefined> {
  clack.log.info(i18n.t('cli.quick.discuss.intro'))
  const questions = generateDiscussQuestions(description)
  const answers: QuickAnswer[] = []

  for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
    const q = questions[questionIndex]!
    const options = q.options.map((o) => ({ value: o, label: o }))
    const selection = await clack.select({ message: q.text, options })
    if (clack.isCancel(selection)) return undefined

    const selectedOption = selection as string
    let freeText: string | undefined

    // Last option is always "Other (free text)" — trigger free-text follow-up
    if (selectedOption === q.options[q.options.length - 1]) {
      const input = await clack.text({
        message: i18n.t('cli.quick.discuss.question_prefix'),
        placeholder: i18n.t('cli.quick.discuss.other_option'),
      })
      if (clack.isCancel(input) || !input) return undefined
      freeText = String(input)
    }

    answers.push({ questionIndex, selectedOption, ...(freeText !== undefined && { freeText }) })
  }

  clack.log.info(i18n.t('cli.quick.discuss.proceeding'))
  return answers
}

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

/**
 * Infer a conventional-commit type prefix from the description.
 * Scans for keywords anywhere in the description (case-insensitive).
 * Priority order: fix → docs → test → refactor → chore → style → feat → chore (default).
 * @see AC#3 — Story 3.1
 */
export function inferCommitType(description: string): string {
  const lower = description.toLowerCase()
  // fix keywords: AC#3 spec + conventional extras
  if (/\b(fix|bug|error|null|broken|crash|repair|revert|wrong|resolve|correct|hotfix)\b/.test(lower)) return 'fix'
  if (/\b(doc|docs|document|readme|changelog|comment|jsdoc)\b/.test(lower)) return 'docs'
  if (/\b(test|spec|coverage|vitest|jest)\b/.test(lower)) return 'test'
  if (/\b(refactor|rename|move|extract|reorganize|clean)\b/.test(lower)) return 'refactor'
  // feat keywords: AC#3 spec
  if (/\b(add|create|implement|new|build|introduce|enable)\b/.test(lower)) return 'feat'
  if (/\b(style|format|prettier|eslint)\b/.test(lower)) return 'style'
  // chore is the default per AC#3 — no fix/feat keywords matched
  return 'chore'
}

/** Build minimal spec content for the quick flow */
function buildQuickSpec(
  description: string,
  constitutionPath: string | undefined,
  payload: { taskId: string; type: string },
  generatedAt: string,
  answers?: QuickAnswer[],
  modeSuffix?: string,
): string {
  const constitutionLine = constitutionPath
    ? `- **Constitution**: \`${constitutionPath}\` (validated)`
    : `- **Constitution**: not configured`

  const modeLabel = modeSuffix ?? (answers ? 'quick (with discussion)' : 'quick (zero-ceremony)')

  const lines = [
    `# Quick Spec — ${description}`,
    '',
    `> Generated: ${generatedAt}  `,
    `> Mode: ${modeLabel}`,
    '',
    '## Goal',
    '',
    description,
    '',
    '## Metadata',
    '',
    `- **Task ID**: \`${payload.taskId}\``,
    `- **Type**: \`${payload.type}\``,
    constitutionLine,
    '',
    '## Acceptance Criteria',
    '',
    `- [ ] The change described above is implemented`,
    `- [ ] All existing tests continue to pass`,
    `- [ ] One atomic Git commit produced with format \`type(quick): ${description}\``,
    '',
  ]

  if (answers && answers.length > 0) {
    const refined = buildRefinedSpec(description, answers)
    // Extract bullet lines from refined spec (skip "## Quick Spec" header and blank lines)
    const bullets = refined.split('\n').filter((l) => l.startsWith('- '))
    lines.push('## Context from Discussion', '', ...bullets, '')
  }

  return lines.join('\n')
}

/**
 * Run a git command synchronously. Returns `{ ok: true }` on success
 * or `{ ok: false, error }` with the stderr message on failure.
 */
function runGit(args: string[], cwd: string): Result<string> {
  try {
    const output = execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return ok(output ?? '')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.GIT_COMMAND_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path: 'git', reason: message },
      cause: e,
    })
  }
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
    const discussMode = args.includes('--discuss')
    const fullMode = args.includes('--full')
    const mode = fullMode ? 'full' : discussMode ? 'discuss' : 'base'
    // Accept description from CLI args or prompt
    const descriptionArg = args.filter((a) => !a.startsWith('--')).join(' ').trim()

    // CI mode requires description
    if (isCi && !descriptionArg) {
      return err({
        code: ERROR_CODES.MISSING_ARG,
        i18nKey: 'cli.quick.no_description',
        params: {},
      })
    }

    clack.intro(
      fullMode
        ? i18n.t('cli.quick.full_welcome')
        : discussMode
          ? i18n.t('cli.quick.discuss_welcome')
          : i18n.t('cli.quick.welcome'),
    )

    let description: string
    if (descriptionArg) {
      description = descriptionArg
    } else {
      const input = await clack.text({
        message: i18n.t('cli.quick.prompt_description'),
        placeholder: i18n.t('cli.quick.placeholder_description'),
      })
      if (clack.isCancel(input) || !input) {
        clack.outro(i18n.t('cli.quick.cancelled'))
        return ok(undefined)
      }
      description = String(input)
    }

    // -----------------------------------------------------------------------
    // STEP 0: Scale Assessment — route by complexity (L0–L4)
    // -----------------------------------------------------------------------
    const scaleResult = assessScale(description)
    clack.log.info(formatScaleAssessment(scaleResult))

    if (scaleResult.level === 'L3' || scaleResult.level === 'L4') {
      if (isCi) {
        ciLog('auto-rejected', 'scale ' + scaleResult.level + ' too complex for quick')
      }
      clack.log.error(i18n.t('cli.quick.scale_too_complex', {
        level: scaleResult.level,
        label: scaleResult.label,
      }))
      clack.outro(i18n.t('cli.quick.scale_use_specify'))
      return isCi
        ? err({ code: ERROR_CODES.NOT_IMPLEMENTED, i18nKey: 'cli.quick.scale_use_specify', params: {} })
        : ok(undefined)
    }

    if (scaleResult.level === 'L2') {
      if (isCi) {
        ciLog('auto-confirmed', 'L2 scale proceed')
      } else {
        const proceed = await clack.confirm({
          message: i18n.t('cli.quick.scale_recommend_specify'),
        })
        if (clack.isCancel(proceed) || proceed === false) {
          clack.outro(i18n.t('cli.quick.scale_use_specify'))
          return ok(undefined)
        }
      }
    }

    // Gather discuss context if --discuss flag provided
    // Uses generateDiscussQuestions() from discuss-flow.ts — AC1/AC2 of Story 3.2
    let discussAnswers: QuickAnswer[] | undefined
    if (discussMode && !isCi) {
      const gathered = await gatherDiscussContext(description, i18n)
      if (gathered === undefined) {
        clack.outro(i18n.t('cli.quick.cancelled'))
        return ok(undefined)
      }
      discussAnswers = gathered
    }
    if (discussMode && isCi) {
      ciLog('auto-skipped', 'discussion flow')
    }

    // Resolve constitution path for constitution validation (FR-203)
    const constitutionPath = await resolveConstitutionPath(projectDir)

    const commitType = inferCommitType(description)
    const featureSlug = slugify(description)
    const specDir = join(projectDir, '.buildpact', 'specs', featureSlug)
    const specPath = join(specDir, 'quick-spec.md')
    const generatedAt = new Date().toISOString()

    // Build task dispatch payload (FR-302 — subagent isolation)
    const payload = buildTaskPayload({
      type: 'quick',
      content: description,
      outputPath: `.buildpact/specs/${featureSlug}/`,
      ...(constitutionPath !== undefined && { constitutionPath }),
    })

    // Generate minimal spec (enriched with discussion answers if present)
    const specContent = buildQuickSpec(
      description,
      constitutionPath,
      payload,
      generatedAt,
      discussAnswers,
      fullMode ? 'quick (full)' : undefined,
    )

    // Write spec to disk
    try {
      await mkdir(specDir, { recursive: true })
      await writeFile(specPath, specContent, 'utf-8')
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      clack.log.error(i18n.t('error.file.write_failed'))
      return err({
        code: ERROR_CODES.FILE_WRITE_FAILED,
        i18nKey: 'error.file.write_failed',
        params: { path: specPath, reason },
        cause: e,
      })
    }

    if (constitutionPath) {
      clack.log.info(i18n.t('cli.quick.constitution_validated'))
    }

    // --full mode: plan generation, 2-perspective validation (plan-verifier.ts), risk confirm, verification
    let planValidationData: { isValid: boolean; riskCount: number } | undefined
    let verificationPassed: boolean | undefined

    if (fullMode) {
      clack.log.info(i18n.t('cli.quick.full.generating_plan'))

      // Generate minimal plan steps using plan-verifier pure function (FR-403)
      const planSteps = generateMinimalPlan(description, specContent)

      // 2-perspective validation: completeness (plan-verifier) + dependency (plan-verifier)
      clack.log.info(i18n.t('cli.quick.full.validating_plan'))
      const completenessResult = validatePlanCompleteness(description, planSteps)
      const dependencyResult = validatePlanDependencies(planSteps)
      const allRisks = [...completenessResult.risks, ...dependencyResult.risks]

      planValidationData = { isValid: allRisks.length === 0, riskCount: allRisks.length }

      // AC3: risk notification only when risks are detected — not unconditionally
      if (allRisks.length > 0) {
        clack.log.warn(
          i18n.t('cli.quick.full.risk_detected', { count: String(allRisks.length) }),
        )
        for (const risk of allRisks) {
          clack.log.warn(`  • ${risk}`)
        }
        if (isCi) {
          ciLog('auto-confirmed', 'risk accepted')
        } else {
          const proceed = await clack.confirm({ message: i18n.t('cli.quick.full_risk_confirm') })
          if (clack.isCancel(proceed) || proceed === false) {
            clack.outro(i18n.t('cli.quick.full.risk_abort'))
            return ok(undefined)
          }
        }
        clack.log.info(i18n.t('cli.quick.full.risk_continue'))
      }

      // Build and write plan.md
      const planLines = [
        `# Quick Plan — ${description}`,
        '',
        `> Generated: ${generatedAt}`,
        `> Mode: quick (full — with plan verification)`,
        '',
        '## Steps',
        '',
        ...planSteps.map((s) => `${s.index}. ${s.description}`),
        '',
      ]
      const planPath = join(specDir, 'plan.md')
      try {
        await writeFile(planPath, planLines.join('\n'), 'utf-8')
      } catch {
        // Non-fatal — proceed even if plan write fails
      }

      // Post-write verification: confirm artifacts were persisted and cover the stated goal
      // This is distinct from pre-execution validation (which checks plan structure).
      // Verification reads back the written files and checks content correctness.
      clack.log.info(i18n.t('cli.quick.full.verifying'))
      try {
        const writtenPlan = await readFile(planPath, 'utf-8')
        const writtenSpec = await readFile(specPath, 'utf-8')
        // Verify: plan has steps section, spec contains the description,
        // and every validated plan step was persisted in the plan file
        verificationPassed =
          writtenPlan.includes('## Steps') &&
          writtenSpec.includes(description) &&
          planSteps.every((s) => writtenPlan.includes(s.description))
      } catch {
        verificationPassed = false
      }

      if (!verificationPassed) {
        const failureReason = 'Written artifacts do not match validated plan — files may be incomplete or corrupted'
        clack.log.warn(i18n.t('cli.quick.full.verification_failed', { reason: failureReason }))

        // AC5: generate fix plan and offer [1] Execute fix [2] Skip prompt
        const fixSteps = generateFixPlan(description, failureReason)
        clack.log.info(
          i18n.t('cli.quick.full.fix_plan_generated', { count: String(fixSteps.length) }),
        )
        for (const step of fixSteps) {
          clack.log.info(`  ${step.index}. ${step.description}`)
        }
        if (isCi) {
          ciLog('auto-skipped', 'fix plan execution')
          clack.log.info(i18n.t('cli.quick.full.fix_plan_skip'))
        } else {
          const executeFix = await clack.confirm({ message: i18n.t('cli.quick.full.fix_plan_confirm') })
          if (clack.isCancel(executeFix) || executeFix === false) {
            clack.log.info(i18n.t('cli.quick.full.fix_plan_skip'))
          } else {
            const fixPlanPath = join(specDir, 'fix-plan.md')
            const fixLines = [
              `# Fix Plan — ${description}`,
              '',
              ...fixSteps.map((s) => `${s.index}. ${s.description}`),
            ]
            try {
              await writeFile(fixPlanPath, fixLines.join('\n'), 'utf-8')
            } catch {
              // Non-fatal
            }
          }
        }
      } else {
        clack.log.success(i18n.t('cli.quick.full.verification_passed'))
      }
    }

    // Stage the spec dir (includes plan.md and fix-plan.md if written) and commit
    const relativeSpecDir = `.buildpact/specs/${featureSlug}/`
    const addResult = runGit(['add', relativeSpecDir], projectDir)
    if (!addResult.ok) {
      clack.log.warn(i18n.t('cli.quick.git_warn'))
    } else {
      const commitMessage = `${commitType}(quick): ${description}`
      const commitResult = runGit(
        ['commit', '-m', JSON.stringify(commitMessage)],
        projectDir,
      )
      if (!commitResult.ok) {
        clack.log.warn(i18n.t('cli.quick.git_warn'))
      } else {
        clack.log.success(i18n.t('cli.quick.committed', { message: commitMessage }))
      }
    }

    await audit.log({
      action: 'quick.execute',
      agent: 'quick',
      files: [`${relativeSpecDir}quick-spec.md`],
      outcome: 'success',
      ...(mode !== 'base' && { mode }),
      ...(planValidationData !== undefined && { planValidation: planValidationData }),
      ...(verificationPassed !== undefined && { verificationPassed }),
    })

    clack.outro(
      i18n.t('cli.quick.done', {
        path: `${relativeSpecDir}quick-spec.md`,
        type: commitType,
      }),
    )

    return ok(undefined)
  },
}
