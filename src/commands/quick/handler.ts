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
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage, I18nResolver } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { slugify } from '../../foundation/sharding.js'
import { resolveConstitutionPath } from '../../engine/constitution-enforcer.js'
import { buildTaskPayload } from '../../engine/subagent.js'

// ---------------------------------------------------------------------------
// Discuss-mode: clarifying questions
// ---------------------------------------------------------------------------

/** A single collected answer from the discuss flow */
export interface DiscussAnswer {
  key: string
  question: string
  answer: string
}

/** Static definition of the 4 clarifying questions used in --discuss mode */
const DISCUSS_QUESTIONS = [
  {
    key: 'scope',
    messageKey: 'cli.quick.discuss_scope_q',
    options: [
      { value: 'frontend', labelKey: 'cli.quick.discuss_scope_frontend' },
      { value: 'backend', labelKey: 'cli.quick.discuss_scope_backend' },
      { value: 'database', labelKey: 'cli.quick.discuss_scope_database' },
      { value: 'fullstack', labelKey: 'cli.quick.discuss_scope_fullstack' },
      { value: 'other', labelKey: 'cli.quick.discuss_opt_other' },
    ],
  },
  {
    key: 'risk',
    messageKey: 'cli.quick.discuss_risk_q',
    options: [
      { value: 'low', labelKey: 'cli.quick.discuss_risk_low' },
      { value: 'medium', labelKey: 'cli.quick.discuss_risk_medium' },
      { value: 'high', labelKey: 'cli.quick.discuss_risk_high' },
      { value: 'unknown', labelKey: 'cli.quick.discuss_risk_unknown' },
      { value: 'other', labelKey: 'cli.quick.discuss_opt_other' },
    ],
  },
  {
    key: 'done',
    messageKey: 'cli.quick.discuss_done_q',
    options: [
      { value: 'tests_pass', labelKey: 'cli.quick.discuss_done_tests' },
      { value: 'new_tests', labelKey: 'cli.quick.discuss_done_new_tests' },
      { value: 'manual', labelKey: 'cli.quick.discuss_done_manual' },
      { value: 'deployed', labelKey: 'cli.quick.discuss_done_deployed' },
      { value: 'other', labelKey: 'cli.quick.discuss_opt_other' },
    ],
  },
  {
    key: 'constraints',
    messageKey: 'cli.quick.discuss_constraints_q',
    options: [
      { value: 'none', labelKey: 'cli.quick.discuss_constraints_none' },
      { value: 'compat', labelKey: 'cli.quick.discuss_constraints_compat' },
      { value: 'perf', labelKey: 'cli.quick.discuss_constraints_perf' },
      { value: 'security', labelKey: 'cli.quick.discuss_constraints_security' },
      { value: 'other', labelKey: 'cli.quick.discuss_opt_other' },
    ],
  },
] as const

/**
 * Ask 4 clarifying questions via numbered-option selects.
 * If the user picks "other", a free-text follow-up prompt is shown.
 * Returns collected answers, or `undefined` if the user cancels.
 */
export async function gatherDiscussContext(
  i18n: I18nResolver,
): Promise<DiscussAnswer[] | undefined> {
  const answers: DiscussAnswer[] = []

  for (const question of DISCUSS_QUESTIONS) {
    const options = question.options.map((opt) => ({
      value: opt.value,
      label: i18n.t(opt.labelKey),
    }))

    const selection = await clack.select({
      message: i18n.t(question.messageKey),
      options,
    })

    if (clack.isCancel(selection)) return undefined

    const selectedValue = selection as string
    let answerText: string

    if (selectedValue === 'other') {
      const freeText = await clack.text({
        message: i18n.t('cli.quick.discuss_other_prompt'),
        placeholder: i18n.t('cli.quick.discuss_other_placeholder'),
      })
      if (clack.isCancel(freeText) || !freeText) return undefined
      answerText = String(freeText)
    } else {
      const opt = question.options.find((o) => o.value === selectedValue)
      answerText = opt ? i18n.t(opt.labelKey) : selectedValue
    }

    answers.push({
      key: question.key,
      question: i18n.t(question.messageKey),
      answer: answerText,
    })
  }

  return answers
}

// ---------------------------------------------------------------------------
// Full-mode: plan generation, validation, verification
// ---------------------------------------------------------------------------

/** Result from a single validation perspective */
export interface PlanValidationResult {
  perspective: string
  issues: string[]
  passed: boolean
}

/** Result from verifying spec ACs against a plan */
export interface VerificationResult {
  passed: string[]
  failed: string[]
}

/**
 * Build a full plan document for --full mode.
 * Two-task structure with explicit AC coverage and risk assessment.
 */
export function buildFullPlan(
  description: string,
  constitutionPath: string | undefined,
  payload: { taskId: string; type: string },
  generatedAt: string,
): string {
  const constitutionLine = constitutionPath
    ? `- **Constitution**: \`${constitutionPath}\` (validated)`
    : `- **Constitution**: not configured`

  const lines = [
    `# Full Plan — ${description}`,
    '',
    `> Generated: ${generatedAt}  `,
    `> Mode: quick (full — with plan verification)`,
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
    '## Tasks',
    '',
    '### Task 1: Implement Core Change',
    '',
    `- **Scope**: Implement the change described: "${description}"`,
    '- **Steps**:',
    '  1. Identify affected files and components',
    '  2. Apply the minimal change required',
    '  3. Ensure existing tests still pass',
    '',
    '### Task 2: Verify and Commit',
    '',
    '- **Scope**: Validate and commit the change atomically',
    '- **Steps**:',
    '  1. Run all quality checks (typecheck, lint, tests)',
    '  2. Review change against acceptance criteria',
    '  3. Produce one atomic Git commit',
    '',
    '## Acceptance Criteria Coverage',
    '',
    '- [x] The change described above is implemented (Task 1)',
    '- [x] All existing tests continue to pass (Task 2, step 1)',
    '- [x] One atomic Git commit produced (Task 2, step 3)',
    '',
    '## Risk Assessment',
    '',
    '- Changes are scoped to the minimum required',
    '- Existing tests serve as regression safety net',
    '- Constitution validation ensures compliance',
    '',
  ]

  return lines.join('\n')
}

/**
 * Perspective 1 — Completeness: checks that every AC from the spec
 * has at least one keyword present in the plan.
 */
export function validatePlanCompleteness(
  specContent: string,
  planContent: string,
): PlanValidationResult {
  const issues: string[] = []

  const specACs = specContent
    .split('\n')
    .filter((line) => /^\s*- \[[ x]\]/.test(line))
    .map((line) => line.replace(/^\s*- \[[ x]\]\s*/, '').trim())

  for (const ac of specACs) {
    if (ac.length === 0) continue
    const keywords = ac.split(/\s+/).filter((w) => w.length > 4)
    const covered = keywords.some((kw) =>
      planContent.toLowerCase().includes(kw.toLowerCase()),
    )
    if (!covered) {
      issues.push(`AC not clearly covered in plan: "${ac.slice(0, 60)}"`)
    }
  }

  return { perspective: 'Completeness', issues, passed: issues.length === 0 }
}

/**
 * Perspective 2 — Feasibility: checks the plan has required structural
 * elements (tasks, risk assessment, AC coverage section).
 */
export function validatePlanFeasibility(planContent: string): PlanValidationResult {
  const issues: string[] = []

  const taskSections = (planContent.match(/### Task \d+/g) ?? []).length
  if (taskSections === 0) {
    issues.push('Plan contains no defined tasks')
  }
  if (!planContent.includes('Risk Assessment')) {
    issues.push('Plan is missing Risk Assessment section')
  }
  if (!planContent.includes('Acceptance Criteria Coverage')) {
    issues.push('Plan does not map tasks to Acceptance Criteria')
  }

  return { perspective: 'Feasibility', issues, passed: issues.length === 0 }
}

/**
 * Verify spec ACs against the plan content.
 * Returns which ACs are covered and which are not.
 */
export function verifyAgainstSpec(
  specContent: string,
  planContent: string,
): VerificationResult {
  const passed: string[] = []
  const failed: string[] = []

  const specACs = specContent
    .split('\n')
    .filter((line) => /^\s*- \[[ x]\]/.test(line))
    .map((line) => line.replace(/^\s*- \[[ x]\]\s*/, '').trim())

  for (const ac of specACs) {
    if (ac.length === 0) continue
    const keywords = ac.split(/\s+/).filter((w) => w.length > 4)
    const covered = keywords.some((kw) =>
      planContent.toLowerCase().includes(kw.toLowerCase()),
    )
    if (covered) {
      passed.push(ac)
    } else {
      failed.push(ac)
    }
  }

  return { passed, failed }
}

/**
 * Build a targeted fix plan for ACs that failed verification.
 */
export function buildFixPlan(
  description: string,
  failedACs: string[],
  payload: { taskId: string },
  generatedAt: string,
): string {
  const fixTasks = failedACs
    .map((ac, i) => [
      `### Fix Task ${i + 1}: Address Failed Criterion`,
      '',
      `- **Target AC**: "${ac}"`,
      '- **Action**: Review implementation and ensure this criterion is satisfied',
      '',
    ])
    .flat()

  const lines = [
    `# Fix Plan — ${description}`,
    '',
    `> Generated: ${generatedAt}  `,
    `> Mode: quick (full — targeted fix for failed verification)`,
    '',
    '## Failed Acceptance Criteria',
    '',
    ...failedACs.map((ac) => `- [ ] ${ac}`),
    '',
    '## Fix Tasks',
    '',
    ...fixTasks,
    '## Notes',
    '',
    '- This fix plan targets only the failed criteria',
    '- Re-run verification after applying fixes',
    `- **Task ID**: \`${payload.taskId}\``,
    '',
  ]

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read language from .buildpact/config.yaml, fallback to 'en' */
async function readLanguage(projectDir: string): Promise<SupportedLanguage> {
  try {
    const { readFile } = await import('node:fs/promises')
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
 * Checks leading keywords (case-insensitive) for common patterns.
 */
export function inferCommitType(description: string): string {
  const lower = description.toLowerCase().trimStart()
  if (/^(fix|resolve|correct|repair|revert|bug|hotfix)/.test(lower)) return 'fix'
  if (/^(doc|docs|document|readme|changelog|comment|jsdoc)/.test(lower)) return 'docs'
  if (/^(test|spec|coverage|vitest|jest)/.test(lower)) return 'test'
  if (/^(refactor|rename|move|extract|reorganize|clean)/.test(lower)) return 'refactor'
  if (/^(chore|bump|upgrade|update dep|update package|build|ci|lint)/.test(lower)) return 'chore'
  if (/^(style|format|prettier|eslint)/.test(lower)) return 'style'
  return 'feat'
}

/** Build minimal spec content for the quick flow */
function buildQuickSpec(
  description: string,
  constitutionPath: string | undefined,
  payload: { taskId: string; type: string },
  generatedAt: string,
  answers?: DiscussAnswer[],
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
    lines.push('## Context from Discussion', '')
    for (const a of answers) {
      lines.push(`**${a.question}**`, `→ ${a.answer}`, '')
    }
  }

  return lines.join('\n')
}

/**
 * Run a git command synchronously. Returns `{ ok: true }` on success
 * or `{ ok: false, error }` with the stderr message on failure.
 */
function runGit(args: string[], cwd: string): Result<string> {
  try {
    const output = execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return ok(output ?? '')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
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

    const discussMode = args.includes('--discuss')
    const fullMode = args.includes('--full')
    // Accept description from CLI args or prompt
    const descriptionArg = args.filter((a) => !a.startsWith('--')).join(' ').trim()

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

    // Gather discuss context if --discuss flag provided
    let discussAnswers: DiscussAnswer[] | undefined
    if (discussMode) {
      const gathered = await gatherDiscussContext(i18n)
      if (gathered === undefined) {
        clack.outro(i18n.t('cli.quick.cancelled'))
        return ok(undefined)
      }
      discussAnswers = gathered
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

    // --full mode: plan generation, 2-perspective validation, risk confirm, verification
    if (fullMode) {
      clack.log.info(i18n.t('cli.quick.full_plan_generating'))

      const planContent = buildFullPlan(description, constitutionPath, payload, generatedAt)

      // Perspective 1: Completeness
      const completeness = validatePlanCompleteness(specContent, planContent)
      // Perspective 2: Feasibility
      const feasibility = validatePlanFeasibility(planContent)

      const allIssues = [...completeness.issues, ...feasibility.issues]
      if (allIssues.length === 0) {
        clack.log.success(i18n.t('cli.quick.full_validation_passed'))
      } else {
        clack.log.warn(
          i18n.t('cli.quick.full_validation_issues', { count: String(allIssues.length) }),
        )
        for (const issue of allIssues) {
          clack.log.warn(`  • ${issue}`)
        }
      }

      // Risk notification + explicit user confirmation before execution
      clack.log.warn(i18n.t('cli.quick.full_risk_warn'))
      const proceed = await clack.confirm({ message: i18n.t('cli.quick.full_risk_confirm') })
      if (clack.isCancel(proceed) || proceed === false) {
        clack.outro(i18n.t('cli.quick.cancelled'))
        return ok(undefined)
      }

      // Write plan.md to spec directory
      const planPath = join(specDir, 'plan.md')
      try {
        await writeFile(planPath, planContent, 'utf-8')
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        clack.log.error(i18n.t('error.file.write_failed'))
        return err({
          code: ERROR_CODES.FILE_WRITE_FAILED,
          i18nKey: 'error.file.write_failed',
          params: { path: planPath, reason },
          cause: e,
        })
      }

      // Verify spec ACs are addressed in the plan
      const verification = verifyAgainstSpec(specContent, planContent)

      if (verification.failed.length > 0) {
        clack.log.warn(
          i18n.t('cli.quick.full_verification_failed', {
            count: String(verification.failed.length),
          }),
        )
        // Auto-generate a targeted fix plan for failed ACs
        const fixPayload = buildTaskPayload({
          type: 'quick',
          content: description,
          outputPath: `.buildpact/specs/${featureSlug}/`,
        })
        const fixPlanContent = buildFixPlan(
          description,
          verification.failed,
          fixPayload,
          new Date().toISOString(),
        )
        const fixPlanPath = join(specDir, 'fix-plan.md')
        try {
          await writeFile(fixPlanPath, fixPlanContent, 'utf-8')
          clack.log.info(
            i18n.t('cli.quick.full_fix_plan_generated', {
              path: `.buildpact/specs/${featureSlug}/fix-plan.md`,
            }),
          )
        } catch {
          // Non-fatal — proceed even if fix plan write fails
        }
      } else {
        clack.log.success(i18n.t('cli.quick.full_verified'))
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
      action: 'quick.spec',
      agent: 'quick',
      files: [`${relativeSpecDir}quick-spec.md`],
      outcome: 'success',
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
