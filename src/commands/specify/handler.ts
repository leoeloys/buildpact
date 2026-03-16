/**
 * Specify command handler.
 * Natural language → structured spec.md with user stories, ACs, FRs, NFRs, assumptions, and Constitution self-assessment.
 * Beginner mode: guided sequential wizard questions.
 * Expert mode: single natural language prompt.
 * Ambiguity detection triggers a clarification Q&A flow before spec generation.
 * @see FR-401 — Natural Language Specification Capture
 * @see FR-402 — Ambiguity Detection and Clarification Flow
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
// Ambiguity detection and clarification flow
// ---------------------------------------------------------------------------

/** A detected ambiguity with a clarifying question and numbered choices */
export interface Ambiguity {
  phrase: string
  question: string
  options: readonly string[]
}

/** An answer to a clarification question */
export interface ClarificationAnswer {
  phrase: string
  question: string
  answer: string
}

const OTHER_VALUE = '__other__'

/**
 * Known ambiguous phrases with clarifying questions and ≥3 numbered options.
 * Add new patterns here as the vocabulary grows.
 */
const AMBIGUITY_PATTERNS: readonly Ambiguity[] = [
  {
    phrase: 'quickly',
    question: 'How quickly should this happen?',
    options: ['Under 1 second', 'Under 5 seconds', 'Under 30 seconds', 'No specific time limit'],
  },
  {
    phrase: 'fast',
    question: 'What does "fast" mean in this context?',
    options: ['Under 1 second response time', 'Under 5 seconds', 'Faster than current solution', 'No specific threshold'],
  },
  {
    phrase: 'real-time',
    question: 'What latency does "real-time" require?',
    options: ['Under 100 ms (live updates)', 'Under 1 second', 'Under 5 seconds (near real-time)', 'Polling interval — no strict latency'],
  },
  {
    phrase: 'easy',
    question: 'What makes this "easy" for the user?',
    options: ['Learnable in under 5 minutes', 'No training required', 'Self-explanatory UI only', 'Fewer steps than the current process'],
  },
  {
    phrase: 'simple',
    question: 'What does "simple" mean here?',
    options: ['Minimal configuration required', 'Single-step process', 'No technical knowledge needed', 'Fewer fields/options than today'],
  },
  {
    phrase: 'secure',
    question: 'What level of security is expected?',
    options: ['HTTPS and standard auth (session/JWT)', 'Multi-factor authentication required', 'Role-based access control', 'Compliance with a specific standard (OWASP/SOC2/HIPAA)'],
  },
  {
    phrase: 'scalable',
    question: 'What scale are we designing for?',
    options: ['Up to 1,000 concurrent users', 'Up to 10,000 concurrent users', 'Auto-scaling, no hard limit', 'Current load + 10× headroom'],
  },
  {
    phrase: 'some',
    question: 'How many is "some"?',
    options: ['2 to 5 items', '5 to 20 items', '20 to 100 items', 'No fixed limit'],
  },
  {
    phrase: 'several',
    question: 'How many is "several"?',
    options: ['3 to 5', '5 to 10', '10 to 20', 'No fixed limit'],
  },
  {
    phrase: 'appropriate',
    question: 'What counts as "appropriate"?',
    options: ['Follows existing team conventions', 'Determined by user role/permissions', 'Matches an industry standard', 'To be defined per scenario'],
  },
  {
    phrase: 'modern',
    question: 'What does "modern" look like?',
    options: ['Follows the current design system', 'Mobile-first, responsive layout', 'Clean and minimal aesthetic', 'Comparable to a specific reference product'],
  },
  {
    phrase: 'large',
    question: 'What size qualifies as "large"?',
    options: ['Over 1 MB', 'Over 10 MB', 'Over 100 MB', 'Context-dependent — no fixed limit'],
  },
] as const

/**
 * Detect ambiguous phrases in user input.
 * Returns the matching Ambiguity entries (deduped, in pattern order).
 */
export function detectAmbiguities(input: string): Ambiguity[] {
  const lower = input.toLowerCase()
  const seen = new Set<string>()
  const results: Ambiguity[] = []
  for (const pattern of AMBIGUITY_PATTERNS) {
    if (!seen.has(pattern.phrase) && lower.includes(pattern.phrase)) {
      seen.add(pattern.phrase)
      results.push(pattern)
    }
  }
  return results
}

/**
 * Interactive clarification flow — for each detected ambiguity, present
 * ≥3 numbered options plus "Other (free text)" and collect the user's choice.
 * Returns undefined if the user cancels at any point.
 */
export async function runClarificationFlow(
  ambiguities: Ambiguity[],
  i18n: I18nResolver,
): Promise<ClarificationAnswer[] | undefined> {
  const answers: ClarificationAnswer[] = []

  for (const ambiguity of ambiguities) {
    const selectOptions = [
      ...ambiguity.options.map((opt, idx) => ({ label: `${idx + 1}. ${opt}`, value: opt })),
      { label: i18n.t('cli.specify.clarification_other'), value: OTHER_VALUE },
    ]

    const selected = await clack.select({
      message: ambiguity.question,
      options: selectOptions,
    })
    if (clack.isCancel(selected)) return undefined

    let answer: string
    if (selected === OTHER_VALUE) {
      const freeText = await clack.text({
        message: i18n.t('cli.specify.clarification_other_prompt'),
        placeholder: i18n.t('cli.specify.clarification_other_placeholder'),
      })
      if (clack.isCancel(freeText) || !freeText) return undefined
      answer = String(freeText)
    } else {
      answer = String(selected)
    }

    answers.push({ phrase: ambiguity.phrase, question: ambiguity.question, answer })
  }

  return answers
}

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
  clarifications?: ClarificationAnswer[]
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
  const { mode, wizardAnswers, rawDescription, constitutionPath, payload, generatedAt, clarifications } = input

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

  // Clarifications section (only present when ambiguities were resolved)
  if (clarifications && clarifications.length > 0) {
    lines.push(
      '## Clarifications',
      '',
      '| Ambiguity | Question | Answer |',
      '|-----------|----------|--------|',
    )
    for (const c of clarifications) {
      lines.push(`| \`${c.phrase}\` | ${c.question} | ${c.answer} |`)
    }
    lines.push('')
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

      // Ambiguity detection on combined wizard answers
      const allWizardText = Object.values(wizardAnswers).join(' ')
      const wizardAmbiguities = detectAmbiguities(allWizardText)
      let wizardClarifications: ClarificationAnswer[] | undefined
      if (wizardAmbiguities.length > 0) {
        clack.log.info(i18n.t('cli.specify.ambiguity_detected'))
        const answers = await runClarificationFlow(wizardAmbiguities, i18n)
        if (answers === undefined) {
          clack.outro(i18n.t('cli.specify.cancelled'))
          return ok(undefined)
        }
        wizardClarifications = answers
      }

      specInput = {
        mode: 'beginner',
        wizardAnswers,
        constitutionPath,
        payload,
        generatedAt: new Date().toISOString(),
        slug: featureSlug,
        ...(wizardClarifications !== undefined && { clarifications: wizardClarifications }),
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

      // Ambiguity detection and clarification flow
      const ambiguities = detectAmbiguities(description)
      let clarifications: ClarificationAnswer[] | undefined
      if (ambiguities.length > 0) {
        clack.log.info(i18n.t('cli.specify.ambiguity_detected'))
        const answers = await runClarificationFlow(ambiguities, i18n)
        if (answers === undefined) {
          clack.outro(i18n.t('cli.specify.cancelled'))
          return ok(undefined)
        }
        clarifications = answers
      }

      specInput = {
        mode: 'expert',
        rawDescription: description,
        constitutionPath,
        payload,
        generatedAt: new Date().toISOString(),
        slug: featureSlug,
        ...(clarifications !== undefined && { clarifications }),
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
