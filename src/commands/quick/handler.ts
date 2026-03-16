/**
 * Quick command handler.
 * Zero-ceremony: natural language → minimal spec → atomic Git commit.
 * --discuss variant asks 3-5 clarifying questions before execution.
 * @see FR-401 — Zero-Ceremony Execution
 * @see FR-402 — Lightweight Context Gathering
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
): string {
  const constitutionLine = constitutionPath
    ? `- **Constitution**: \`${constitutionPath}\` (validated)`
    : `- **Constitution**: not configured`

  const modeLabel = answers ? 'quick (with discussion)' : 'quick (zero-ceremony)'

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
    // Accept description from CLI args or prompt
    const descriptionArg = args.filter((a) => !a.startsWith('--')).join(' ').trim()

    clack.intro(
      discussMode ? i18n.t('cli.quick.discuss_welcome') : i18n.t('cli.quick.welcome'),
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

    // Stage the spec and commit (one atomic commit per quick execution)
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
