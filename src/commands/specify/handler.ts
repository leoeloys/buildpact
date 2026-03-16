/**
 * Specify command handler.
 * Natural language → structured spec.md with user stories, ACs, FRs, NFRs, assumptions, and Constitution self-assessment.
 * Beginner mode: guided sequential wizard questions.
 * Expert mode: single natural language prompt.
 * @see FR-401 — Natural Language Specification Capture
 */

import * as clack from '@clack/prompts'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage, I18nResolver } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { slugify } from '../../foundation/sharding.js'
import { resolveConstitutionPath } from '../../engine/constitution-enforcer.js'
import { buildTaskPayload } from '../../engine/subagent.js'

// ---------------------------------------------------------------------------
// Implementation-detail detection
// ---------------------------------------------------------------------------

/** Keywords indicating the user is describing implementation details, not requirements */
const IMPL_KEYWORDS = [
  'function ',
  'class ',
  'database schema',
  'sql query',
  'api endpoint',
  'rest api',
  'graphql',
  'migration',
  'controller',
  'repository pattern',
  'dependency injection',
  'import ',
  'export ',
  'const ',
  'let ',
  'var ',
]

/**
 * Detect if user input contains implementation details that should be rejected at spec phase.
 * Returns the first matched keyword, or undefined if clean.
 */
export function detectImplementationDetails(input: string): string | undefined {
  const lower = input.toLowerCase()
  for (const kw of IMPL_KEYWORDS) {
    if (lower.includes(kw)) return kw
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Config readers
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

/** Read experience level from .buildpact/config.yaml, fallback to 'intermediate' */
export async function readExperienceLevel(projectDir: string): Promise<string> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('experience:')) {
        return trimmed.slice('experience:'.length).trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // Config missing — fall back
  }
  return 'intermediate'
}

// ---------------------------------------------------------------------------
// Wizard mode (beginner)
// ---------------------------------------------------------------------------

/** Answers collected from the beginner wizard */
export interface WizardAnswers {
  persona: string
  goal: string
  motivation: string
  successOutcome: string
  constraints: string
}

/**
 * Guided wizard for beginner mode — 5 sequential questions covering
 * WHO / WHAT / WHY / SUCCESS / CONSTRAINTS.
 * Returns undefined if the user cancels at any step.
 */
export async function runBeginnerWizard(
  i18n: I18nResolver,
): Promise<WizardAnswers | undefined> {
  const persona = await clack.text({
    message: i18n.t('cli.specify.wizard_persona'),
    placeholder: i18n.t('cli.specify.wizard_persona_placeholder'),
  })
  if (clack.isCancel(persona) || !persona) return undefined

  const goal = await clack.text({
    message: i18n.t('cli.specify.wizard_goal'),
    placeholder: i18n.t('cli.specify.wizard_goal_placeholder'),
  })
  if (clack.isCancel(goal) || !goal) return undefined

  const motivation = await clack.text({
    message: i18n.t('cli.specify.wizard_motivation'),
    placeholder: i18n.t('cli.specify.wizard_motivation_placeholder'),
  })
  if (clack.isCancel(motivation) || !motivation) return undefined

  const successOutcome = await clack.text({
    message: i18n.t('cli.specify.wizard_success'),
    placeholder: i18n.t('cli.specify.wizard_success_placeholder'),
  })
  if (clack.isCancel(successOutcome) || !successOutcome) return undefined

  const constraints = await clack.text({
    message: i18n.t('cli.specify.wizard_constraints'),
    placeholder: i18n.t('cli.specify.wizard_constraints_placeholder'),
  })
  if (clack.isCancel(constraints)) return undefined

  return {
    persona: String(persona),
    goal: String(goal),
    motivation: String(motivation),
    successOutcome: String(successOutcome),
    constraints: constraints ? String(constraints) : 'None specified',
  }
}

// ---------------------------------------------------------------------------
// Spec content generation
// ---------------------------------------------------------------------------

/** Input to buildSpecContent — either wizard answers or a raw NL description */
export interface SpecInput {
  mode: 'beginner' | 'expert'
  wizardAnswers?: WizardAnswers
  rawDescription?: string
  constitutionPath: string | undefined
  payload: { taskId: string; type: string }
  generatedAt: string
  slug: string
}

/**
 * Build a structured spec.md from either wizard answers (beginner)
 * or a raw natural-language description (expert).
 *
 * Sections: User Story, Acceptance Criteria (Given/When/Then),
 * Functional Requirements, Non-Functional Requirements,
 * Assumptions, Constitution Self-Assessment.
 */
export function buildSpecContent(input: SpecInput): string {
  const { mode, wizardAnswers, rawDescription, constitutionPath, payload, generatedAt } = input

  const constitutionLine = constitutionPath
    ? `- **Constitution**: \`${constitutionPath}\` (validated before acceptance)`
    : `- **Constitution**: not configured`

  const lines: string[] = [
    `# Spec — ${input.slug}`,
    '',
    `> Generated: ${generatedAt}`,
    `> Mode: specify (${mode})`,
    '',
    '## Metadata',
    '',
    `- **Task ID**: \`${payload.taskId}\``,
    `- **Type**: \`${payload.type}\``,
    constitutionLine,
    '',
  ]

  if (mode === 'beginner' && wizardAnswers) {
    const { persona, goal, motivation, successOutcome, constraints } = wizardAnswers

    lines.push(
      '## User Story',
      '',
      `**As a** ${persona},`,
      `**I want to** ${goal},`,
      `**So that** ${motivation}.`,
      '',
      '## Acceptance Criteria',
      '',
      '### Given/When/Then',
      '',
      `**Given** I am a ${persona}`,
      `**When** I ${goal}`,
      `**Then** ${successOutcome}`,
      '',
      '## Functional Requirements',
      '',
      `- [ ] ${goal}`,
      `- [ ] The outcome satisfies: ${successOutcome}`,
      '',
      '## Non-Functional Requirements',
      '',
      `- [ ] ${constraints !== 'None specified' ? constraints : 'No specific non-functional constraints identified'}`,
      '',
      '## Assumptions',
      '',
      `- The user persona is: ${persona}`,
      `- Success is defined as: ${successOutcome}`,
      constraints !== 'None specified' ? `- Constraints noted: ${constraints}` : '- No assumptions beyond stated requirements',
      '',
    )
  } else {
    // Expert mode — raw description
    const description = rawDescription ?? ''

    lines.push(
      '## User Story',
      '',
      description,
      '',
      '## Acceptance Criteria',
      '',
      '### Given/When/Then',
      '',
      '**Given** the feature described above exists',
      '**When** a user interacts with it as described',
      '**Then** the stated goals are achieved',
      '',
      '## Functional Requirements',
      '',
      '- [ ] The feature described above is fully implemented',
      '- [ ] All edge cases mentioned are handled',
      '',
      '## Non-Functional Requirements',
      '',
      '- [ ] Implementation follows project quality gates',
      '- [ ] No regressions introduced',
      '',
      '## Assumptions',
      '',
      '- Requirements are as described above',
      '- Implementation details are deferred to the plan phase',
      '',
    )
  }

  // Constitution self-assessment section
  lines.push(
    '## Constitution Self-Assessment',
    '',
    constitutionPath
      ? `- Constitution located at \`${constitutionPath}\``
      : '- No constitution configured — consider running /bp:constitution first',
    constitutionPath
      ? '- [ ] Spec has been reviewed against all Constitution principles'
      : '- [ ] (Optional) Run /bp:constitution to establish immutable project rules',
    '',
  )

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

    const experienceLevel = await readExperienceLevel(projectDir)
    const isBeginnerMode = experienceLevel === 'beginner'

    // Accept description from CLI args
    const descriptionArg = args.filter((a) => !a.startsWith('--')).join(' ').trim()

    clack.intro(i18n.t(isBeginnerMode ? 'cli.specify.welcome_beginner' : 'cli.specify.welcome'))

    let specInput: SpecInput | undefined

    if (isBeginnerMode) {
      // -----------------------------------------------------------------------
      // BEGINNER MODE — sequential wizard questions
      // -----------------------------------------------------------------------
      clack.log.info(i18n.t('cli.specify.beginner_intro'))

      const wizardAnswers = await runBeginnerWizard(i18n)
      if (wizardAnswers === undefined) {
        clack.outro(i18n.t('cli.specify.cancelled'))
        return ok(undefined)
      }

      // Check for implementation details in any answer
      const allText = Object.values(wizardAnswers).join(' ')
      const implKw = detectImplementationDetails(allText)
      if (implKw) {
        clack.log.warn(i18n.t('cli.specify.impl_detail_warn', { keyword: implKw }))
      }

      const featureSlug = slugify(wizardAnswers.goal)
      const constitutionPath = await resolveConstitutionPath(projectDir)
      const payload = buildTaskPayload({
        type: 'specify',
        content: wizardAnswers.goal,
        outputPath: `.buildpact/specs/${featureSlug}/`,
        ...(constitutionPath !== undefined && { constitutionPath }),
      })

      specInput = {
        mode: 'beginner',
        wizardAnswers,
        constitutionPath,
        payload,
        generatedAt: new Date().toISOString(),
        slug: featureSlug,
      }
    } else {
      // -----------------------------------------------------------------------
      // EXPERT MODE — single natural language prompt or CLI arg
      // -----------------------------------------------------------------------
      let description: string

      if (descriptionArg) {
        description = descriptionArg
      } else {
        const input = await clack.text({
          message: i18n.t('cli.specify.prompt_description'),
          placeholder: i18n.t('cli.specify.placeholder_description'),
        })
        if (clack.isCancel(input) || !input) {
          clack.outro(i18n.t('cli.specify.cancelled'))
          return ok(undefined)
        }
        description = String(input)
      }

      // Check for implementation details
      const implKw = detectImplementationDetails(description)
      if (implKw) {
        clack.log.warn(i18n.t('cli.specify.impl_detail_warn', { keyword: implKw }))
      }

      const featureSlug = slugify(description)
      const constitutionPath = await resolveConstitutionPath(projectDir)
      const payload = buildTaskPayload({
        type: 'specify',
        content: description,
        outputPath: `.buildpact/specs/${featureSlug}/`,
        ...(constitutionPath !== undefined && { constitutionPath }),
      })

      specInput = {
        mode: 'expert',
        rawDescription: description,
        constitutionPath,
        payload,
        generatedAt: new Date().toISOString(),
        slug: featureSlug,
      }
    }

    // Build and write the spec
    const specContent = buildSpecContent(specInput)
    const specDir = join(projectDir, '.buildpact', 'specs', specInput.slug)
    const specPath = join(specDir, 'spec.md')

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

    if (specInput.constitutionPath) {
      clack.log.info(i18n.t('cli.specify.constitution_noted'))
    }

    await audit.log({
      action: 'specify.create',
      agent: 'specify',
      files: [`.buildpact/specs/${specInput.slug}/spec.md`],
      outcome: 'success',
    })

    clack.outro(
      i18n.t('cli.specify.done', {
        path: `.buildpact/specs/${specInput.slug}/spec.md`,
      }),
    )

    return ok(undefined)
  },
}
