/**
 * Specify command handler.
 * Natural language → structured spec.md with user stories, ACs, FRs, NFRs, assumptions, and Constitution self-assessment.
 * Beginner mode: guided sequential wizard questions.
 * Expert mode: single natural language prompt.
 * Ambiguity detection triggers a clarification Q&A flow before spec generation.
 * Active Squad injects domain-specific question templates after main spec gathering.
 * Web Bundle mode presents squad questions as conversational text prompts.
 * @see FR-401 — Natural Language Specification Capture
 * @see FR-402 — Ambiguity Detection and Clarification Flow
 * @see FR-403 — Domain-Aware Specification with Squad Integration
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
import { enforceConstitutionOnOutput } from '../../engine/orchestrator.js'
import { guardConstitutionModification } from '../registry.js'
import { isCiMode, ciLog } from '../../foundation/ci.js'

// ---------------------------------------------------------------------------
// Squad domain-aware question templates
// ---------------------------------------------------------------------------

/** A domain-specific question with numbered options for Squad integration */
export interface SquadQuestion {
  key: string
  question: string
  options: readonly string[]
}

/** An answer to a Squad domain-specific question */
export interface SquadConstraintAnswer {
  key: string
  question: string
  answer: string
}

/** Active Squad metadata loaded from config + squad.yaml */
export interface ActiveSquad {
  name: string
  domain: string
}

const OTHER_SQUAD_VALUE = '__squad_other__'

/** Domain-specific question templates keyed by squad domain */
const DOMAIN_QUESTIONS: Record<string, SquadQuestion[]> = {
  software: [
    {
      key: 'tech_stack',
      question: 'What is the primary technology stack?',
      options: ['Frontend (React / Vue / Angular)', 'Backend (Node.js / Python / Go / Java)', 'Full-stack (Next.js / Nuxt)', 'Mobile (iOS / Android / React Native)', 'CLI / Tooling'],
    },
    {
      key: 'quality_standards',
      question: 'What quality standards apply?',
      options: ['Unit tests required (≥80% coverage)', 'E2E tests required', 'TypeScript strict mode', 'Linting (ESLint / Prettier)', 'No specific quality gates'],
    },
    {
      key: 'deployment_target',
      question: 'What is the deployment target?',
      options: ['Cloud (AWS / GCP / Azure)', 'Self-hosted / on-premises', 'Docker / Kubernetes', 'Serverless (Lambda / Cloud Functions)', 'Not yet determined'],
    },
  ],
  marketing: [
    {
      key: 'primary_audience',
      question: 'Who is the primary audience?',
      options: ['B2B (businesses)', 'B2C (consumers)', 'Internal (employees)', 'Mixed audience', 'Not yet defined'],
    },
    {
      key: 'key_metric',
      question: 'What is the key success metric?',
      options: ['Conversions / sales', 'Traffic / reach', 'Brand awareness', 'Lead generation', 'Retention / engagement'],
    },
    {
      key: 'compliance',
      question: 'What compliance constraints apply?',
      options: ['GDPR / LGPD (data privacy)', 'ANVISA / CFM (healthcare marketing)', 'None — standard commercial content', 'Industry-specific regulation'],
    },
  ],
  health: [
    {
      key: 'content_type',
      question: 'What type of health content is involved?',
      options: ['Patient information / education', 'Clinical workflows', 'Medical device interface', 'Research data', 'None of the above'],
    },
    {
      key: 'compliance_level',
      question: 'What compliance level applies?',
      options: ['CFM nº 1.974/2011 (medical marketing)', 'HIPAA / LGPD (patient data)', 'ANVISA (device / drug)', 'No specific regulation'],
    },
    {
      key: 'primary_users',
      question: 'Who are the primary users?',
      options: ['Healthcare professionals', 'Patients / caregivers', 'Administrative staff', 'Researchers', 'General public'],
    },
  ],
  research: [
    {
      key: 'methodology',
      question: 'What research methodology applies?',
      options: ['Systematic review / meta-analysis', 'Experimental / RCT', 'Observational study', 'Survey / questionnaire', 'Data analysis (existing datasets)'],
    },
    {
      key: 'review_protocol',
      question: 'What review protocol is required?',
      options: ['PRISMA checklist', 'CONSORT checklist', 'STROBE guidelines', 'No specific protocol required'],
    },
    {
      key: 'statistical_approach',
      question: 'What statistical approach is needed?',
      options: ['Descriptive statistics only', 'Inferential testing (t-test / ANOVA)', 'Regression analysis', 'Survival analysis', 'Not yet determined'],
    },
  ],
}

/**
 * Return domain-specific questions for the given squad domain.
 * Returns an empty array for unknown domains.
 */
export function getSquadQuestions(domain: string): SquadQuestion[] {
  return DOMAIN_QUESTIONS[domain.toLowerCase()] ?? []
}

/**
 * Read the active squad name and domain from config.yaml + squad.yaml.
 * Returns undefined if no squad is active or files are missing.
 */
export async function readActiveSquad(projectDir: string): Promise<ActiveSquad | undefined> {
  try {
    const config = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    let activeSquadName = ''
    for (const line of config.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('active_squad:')) {
        activeSquadName = trimmed.slice('active_squad:'.length).trim().replace(/^["']|["']$/g, '')
        break
      }
    }
    if (!activeSquadName || activeSquadName === 'none') return undefined

    const squadYaml = await readFile(
      join(projectDir, '.buildpact', 'squads', activeSquadName, 'squad.yaml'),
      'utf-8',
    )
    let domain = activeSquadName
    for (const line of squadYaml.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('domain:')) {
        domain = trimmed.slice('domain:'.length).trim().replace(/^["']|["']$/g, '')
        break
      }
    }
    return { name: activeSquadName, domain }
  } catch {
    return undefined
  }
}

/**
 * Check if the project is running in Web Bundle mode.
 * Web Bundle mode is active when config.yaml has `mode: web-bundle`.
 */
export async function readWebBundleMode(projectDir: string): Promise<boolean> {
  try {
    const config = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of config.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('mode:')) {
        const value = trimmed.slice('mode:'.length).trim().replace(/^["']|["']$/g, '')
        return value === 'web-bundle'
      }
    }
  } catch {
    // ignore
  }
  return false
}

/**
 * Run Squad domain-specific question flow.
 * CLI mode: clack.select with numbered options + "Other (free text)".
 * Web Bundle mode: clack.text with numbered options embedded in the message.
 * Returns undefined if the user cancels.
 */
export async function runSquadFlow(
  questions: SquadQuestion[],
  i18n: I18nResolver,
  isWebBundle: boolean,
): Promise<SquadConstraintAnswer[] | undefined> {
  if (questions.length === 0) return []

  const answers: SquadConstraintAnswer[] = []

  for (const question of questions) {
    if (isWebBundle) {
      const optionsList = [
        ...question.options.map((opt, idx) => `${idx + 1}. ${opt}`),
        `${question.options.length + 1}. ${i18n.t('cli.specify.clarification_other')}`,
      ].join('\n')

      const response = await clack.text({
        message: `${question.question}\n${optionsList}`,
        placeholder: i18n.t('cli.specify.squad_web_bundle_placeholder'),
      })
      if (clack.isCancel(response) || !response) return undefined
      answers.push({ key: question.key, question: question.question, answer: String(response) })
    } else {
      const selectOptions = [
        ...question.options.map((opt, idx) => ({ label: `${idx + 1}. ${opt}`, value: opt })),
        { label: i18n.t('cli.specify.clarification_other'), value: OTHER_SQUAD_VALUE },
      ]

      const selected = await clack.select({ message: question.question, options: selectOptions })
      if (clack.isCancel(selected)) return undefined

      let answer: string
      if (selected === OTHER_SQUAD_VALUE) {
        const freeText = await clack.text({
          message: i18n.t('cli.specify.clarification_other_prompt'),
          placeholder: i18n.t('cli.specify.clarification_other_placeholder'),
        })
        if (clack.isCancel(freeText) || !freeText) return undefined
        answer = String(freeText)
      } else {
        answer = String(selected)
      }
      answers.push({ key: question.key, question: question.question, answer })
    }
  }

  return answers
}

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
 * Web Bundle mode: uses clack.text with numbered options embedded in the message.
 * Returns undefined if the user cancels at any point.
 */
export async function runClarificationFlow(
  ambiguities: Ambiguity[],
  i18n: I18nResolver,
  isWebBundle = false,
): Promise<ClarificationAnswer[] | undefined> {
  const answers: ClarificationAnswer[] = []

  for (const ambiguity of ambiguities) {
    if (isWebBundle) {
      const optionsList = [
        ...ambiguity.options.map((opt, idx) => `${idx + 1}. ${opt}`),
        `${ambiguity.options.length + 1}. ${i18n.t('cli.specify.clarification_other')}`,
      ].join('\n')

      const response = await clack.text({
        message: `${ambiguity.question}\n${optionsList}`,
        placeholder: i18n.t('cli.specify.squad_web_bundle_placeholder'),
      })
      if (clack.isCancel(response) || !response) return undefined
      answers.push({ phrase: ambiguity.phrase, question: ambiguity.question, answer: String(response) })
    } else {
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
  }

  return answers
}

// ---------------------------------------------------------------------------
// Automation Maturity Assessment (5-stage model)
// ---------------------------------------------------------------------------

/** The 5 stages of automation maturity */
export type MaturityStage = 1 | 2 | 3 | 4 | 5

/** Inputs used to score automation maturity */
export interface MaturityAssessmentInput {
  frequency: 'multiple_daily' | 'daily' | 'weekly' | 'rarely'
  predictability: 'always_same' | 'mostly_predictable' | 'varies' | 'highly_variable'
  humanDecisions: 'none_needed' | 'minor' | 'significant' | 'complex_expertise'
}

/** Result of the automation maturity assessment */
export interface MaturityAssessmentResult {
  stage: MaturityStage
  name: string
  score: number
  justification: string
  isOverride: boolean
  originalStage?: MaturityStage
}

const STAGE_NAMES: Record<MaturityStage, string> = {
  1: 'Manual',
  2: 'Documented Skill',
  3: 'Alias',
  4: 'Heartbeat Check',
  5: 'Full Automation',
}

const STAGE_DESCRIPTIONS: Record<MaturityStage, string> = {
  1: 'Perform manually each time — suitable for infrequent, high-judgment tasks with variable steps.',
  2: 'Document as a runbook or step-by-step guide — suitable for reproducible but human-executed processes.',
  3: 'Wrap in a single command or alias — suitable for frequent, predictable tasks requiring minimal judgment.',
  4: 'Schedule as an automated heartbeat check — suitable for routine monitoring with no human decisions needed.',
  5: 'Fully automate end-to-end — suitable for high-frequency, highly predictable, judgment-free tasks.',
}

/**
 * Score a set of maturity assessment inputs into a stage recommendation.
 * Pure function — no side effects.
 */
export function scoreMaturity(input: MaturityAssessmentInput): MaturityAssessmentResult {
  const frequencyScore: Record<MaturityAssessmentInput['frequency'], number> = {
    multiple_daily: 3,
    daily: 2,
    weekly: 1,
    rarely: 0,
  }
  const predictabilityScore: Record<MaturityAssessmentInput['predictability'], number> = {
    always_same: 3,
    mostly_predictable: 2,
    varies: 1,
    highly_variable: 0,
  }
  const humanDecisionsScore: Record<MaturityAssessmentInput['humanDecisions'], number> = {
    none_needed: 3,
    minor: 2,
    significant: 1,
    complex_expertise: 0,
  }

  const total =
    frequencyScore[input.frequency] +
    predictabilityScore[input.predictability] +
    humanDecisionsScore[input.humanDecisions]

  let stage: MaturityStage
  if (total <= 1) stage = 1
  else if (total <= 3) stage = 2
  else if (total <= 5) stage = 3
  else if (total <= 7) stage = 4
  else stage = 5

  const freqLabel: Record<MaturityAssessmentInput['frequency'], string> = {
    multiple_daily: 'runs multiple times per day',
    daily: 'runs daily',
    weekly: 'runs weekly or less',
    rarely: 'runs rarely or ad hoc',
  }
  const predLabel: Record<MaturityAssessmentInput['predictability'], string> = {
    always_same: 'steps are always identical',
    mostly_predictable: 'steps are mostly predictable',
    varies: 'steps vary based on context',
    highly_variable: 'steps are highly variable',
  }
  const humanLabel: Record<MaturityAssessmentInput['humanDecisions'], string> = {
    none_needed: 'requires no human decisions',
    minor: 'requires only minor decisions',
    significant: 'requires significant human judgment',
    complex_expertise: 'requires complex expert judgment',
  }

  const justification =
    `This task ${freqLabel[input.frequency]}, ${predLabel[input.predictability]}, and ${humanLabel[input.humanDecisions]} (score: ${total}/9). ` +
    STAGE_DESCRIPTIONS[stage]

  return { stage, name: STAGE_NAMES[stage], score: total, justification, isOverride: false }
}

/** Parse a 1-based numeric string choice into a typed option value. Defaults to first option if out of range. */
function parseWebBundleChoice<T extends string>(response: string, values: readonly T[]): T {
  const num = parseInt(response.trim(), 10)
  if (num >= 1 && num <= values.length) return values[num - 1]!
  return values[0]!
}

/**
 * Interactive automation maturity assessment.
 * Asks 3 questions (frequency, predictability, human decisions), scores the result,
 * displays the recommendation, and optionally lets the user override the stage.
 * Web Bundle mode: uses clack.text with numbered options embedded in messages.
 * Returns undefined if the user cancels at any point.
 */
export async function assessAutomationMaturity(
  i18n: I18nResolver,
  isWebBundle = false,
): Promise<MaturityAssessmentResult | undefined> {
  clack.log.info(i18n.t('cli.specify.maturity_intro'))

  const FREQUENCY_VALUES = ['multiple_daily', 'daily', 'weekly', 'rarely'] as const
  const PREDICTABILITY_VALUES = ['always_same', 'mostly_predictable', 'varies', 'highly_variable'] as const
  const HUMAN_DECISIONS_VALUES = ['none_needed', 'minor', 'significant', 'complex_expertise'] as const

  let frequency: MaturityAssessmentInput['frequency']
  let predictability: MaturityAssessmentInput['predictability']
  let humanDecisions: MaturityAssessmentInput['humanDecisions']

  if (isWebBundle) {
    const wbPlaceholder = i18n.t('cli.specify.squad_web_bundle_placeholder')

    const freqResp = await clack.text({
      message: `${i18n.t('cli.specify.maturity_frequency')}\n1. Multiple times per day\n2. Once per day\n3. Weekly or less frequently\n4. Rarely — ad hoc or one-off`,
      placeholder: wbPlaceholder,
    })
    if (clack.isCancel(freqResp) || !freqResp) return undefined
    frequency = parseWebBundleChoice(String(freqResp), FREQUENCY_VALUES)

    const predResp = await clack.text({
      message: `${i18n.t('cli.specify.maturity_predictability')}\n1. Always the same — identical steps every time\n2. Mostly predictable — minor variations\n3. Varies based on context or inputs\n4. Highly variable — different every time`,
      placeholder: wbPlaceholder,
    })
    if (clack.isCancel(predResp) || !predResp) return undefined
    predictability = parseWebBundleChoice(String(predResp), PREDICTABILITY_VALUES)

    const humanResp = await clack.text({
      message: `${i18n.t('cli.specify.maturity_human_decisions')}\n1. No decisions needed — purely mechanical\n2. Minor decisions — routine choices\n3. Significant judgment required\n4. Complex expertise — cannot be codified`,
      placeholder: wbPlaceholder,
    })
    if (clack.isCancel(humanResp) || !humanResp) return undefined
    humanDecisions = parseWebBundleChoice(String(humanResp), HUMAN_DECISIONS_VALUES)
  } else {
    const freqSel = await clack.select<MaturityAssessmentInput['frequency']>({
      message: i18n.t('cli.specify.maturity_frequency'),
      options: [
        { label: 'Multiple times per day', value: 'multiple_daily' },
        { label: 'Once per day', value: 'daily' },
        { label: 'Weekly or less frequently', value: 'weekly' },
        { label: 'Rarely — ad hoc or one-off', value: 'rarely' },
      ],
    })
    if (clack.isCancel(freqSel)) return undefined
    frequency = freqSel as MaturityAssessmentInput['frequency']

    const predSel = await clack.select<MaturityAssessmentInput['predictability']>({
      message: i18n.t('cli.specify.maturity_predictability'),
      options: [
        { label: 'Always the same — identical steps every time', value: 'always_same' },
        { label: 'Mostly predictable — minor variations', value: 'mostly_predictable' },
        { label: 'Varies based on context or inputs', value: 'varies' },
        { label: 'Highly variable — different every time', value: 'highly_variable' },
      ],
    })
    if (clack.isCancel(predSel)) return undefined
    predictability = predSel as MaturityAssessmentInput['predictability']

    const humanSel = await clack.select<MaturityAssessmentInput['humanDecisions']>({
      message: i18n.t('cli.specify.maturity_human_decisions'),
      options: [
        { label: 'No decisions needed — purely mechanical', value: 'none_needed' },
        { label: 'Minor decisions — routine choices', value: 'minor' },
        { label: 'Significant judgment required', value: 'significant' },
        { label: 'Complex expertise — cannot be codified', value: 'complex_expertise' },
      ],
    })
    if (clack.isCancel(humanSel)) return undefined
    humanDecisions = humanSel as MaturityAssessmentInput['humanDecisions']
  }

  const result = scoreMaturity({ frequency, predictability, humanDecisions })

  clack.log.success(
    i18n.t('cli.specify.maturity_recommendation', {
      stage: String(result.stage),
      name: result.name,
    }),
  )

  if (isWebBundle) {
    const wbPlaceholder = i18n.t('cli.specify.squad_web_bundle_placeholder')

    const overrideResp = await clack.text({
      message: `${i18n.t('cli.specify.maturity_override_prompt')}\n1. ${i18n.t('cli.specify.maturity_override_keep')}\n2. ${i18n.t('cli.specify.maturity_override_change')}`,
      placeholder: wbPlaceholder,
    })
    if (clack.isCancel(overrideResp) || !overrideResp) return undefined
    const overrideChoice = parseWebBundleChoice(String(overrideResp), ['keep', 'change'] as const)

    if (overrideChoice === 'change') {
      const stageResp = await clack.text({
        message: `${i18n.t('cli.specify.maturity_override_select')}\n1. ${i18n.t('cli.specify.maturity_stage_1')}\n2. ${i18n.t('cli.specify.maturity_stage_2')}\n3. ${i18n.t('cli.specify.maturity_stage_3')}\n4. ${i18n.t('cli.specify.maturity_stage_4')}\n5. ${i18n.t('cli.specify.maturity_stage_5')}`,
        placeholder: wbPlaceholder,
      })
      if (clack.isCancel(stageResp) || !stageResp) return undefined
      const stageNum = parseInt(String(stageResp).trim(), 10)
      const chosenStage = (stageNum >= 1 && stageNum <= 5 ? stageNum : result.stage) as MaturityStage
      return {
        ...result,
        stage: chosenStage,
        name: STAGE_NAMES[chosenStage],
        isOverride: true,
        originalStage: result.stage,
      }
    }

    return result
  }

  const override = await clack.select<string>({
    message: i18n.t('cli.specify.maturity_override_prompt'),
    options: [
      { label: i18n.t('cli.specify.maturity_override_keep'), value: 'keep' },
      { label: i18n.t('cli.specify.maturity_override_change'), value: 'change' },
    ],
  })
  if (clack.isCancel(override)) return undefined

  if (override === 'change') {
    const overrideStage = await clack.select<number>({
      message: i18n.t('cli.specify.maturity_override_select'),
      options: [
        { label: i18n.t('cli.specify.maturity_stage_1'), value: 1 },
        { label: i18n.t('cli.specify.maturity_stage_2'), value: 2 },
        { label: i18n.t('cli.specify.maturity_stage_3'), value: 3 },
        { label: i18n.t('cli.specify.maturity_stage_4'), value: 4 },
        { label: i18n.t('cli.specify.maturity_stage_5'), value: 5 },
      ],
    })
    if (clack.isCancel(overrideStage)) return undefined
    const chosenStage = (overrideStage as number) as MaturityStage
    return {
      ...result,
      stage: chosenStage,
      name: STAGE_NAMES[chosenStage],
      isOverride: true,
      originalStage: result.stage,
    }
  }

  return result
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
  squadConstraints?: {
    squadName: string
    domain: string
    answers: SquadConstraintAnswer[]
  }
  maturityAssessment?: MaturityAssessmentResult
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
  const { mode, wizardAnswers, rawDescription, constitutionPath, payload, generatedAt, clarifications, squadConstraints, maturityAssessment } = input

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

  // Squad domain constraints section (only present when an active Squad provided answers)
  if (squadConstraints && squadConstraints.answers.length > 0) {
    lines.push(
      '## Domain Constraints',
      '',
      `> Squad: **${squadConstraints.squadName}** (domain: ${squadConstraints.domain})`,
      '',
      '| Constraint | Question | Answer |',
      '|------------|----------|--------|',
    )
    for (const a of squadConstraints.answers) {
      lines.push(`| \`${a.key}\` | ${a.question} | ${a.answer} |`)
    }
    lines.push('')
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

  // Automation Maturity Assessment section (only present when assessment was run)
  if (maturityAssessment) {
    lines.push(
      '## Automation Maturity Assessment',
      '',
      `**Recommended Stage**: ${maturityAssessment.stage} — ${maturityAssessment.name}`,
      '',
      `**Justification**: ${maturityAssessment.justification}`,
      '',
    )
    if (maturityAssessment.isOverride && maturityAssessment.originalStage !== undefined) {
      lines.push(
        `> **Override applied**: original recommendation was Stage ${maturityAssessment.originalStage} — ${STAGE_NAMES[maturityAssessment.originalStage]}`,
        '',
      )
    }
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
    const isCi = isCiMode(args)

    const [experienceLevel, isWebBundle] = await Promise.all([
      readExperienceLevel(projectDir),
      readWebBundleMode(projectDir),
    ])
    // CI mode forces expert mode (skip beginner wizard)
    const isBeginnerMode = isCi ? false : experienceLevel === 'beginner'
    if (isCi && experienceLevel === 'beginner') {
      ciLog('auto-selected', 'expert mode')
    }

    // Accept description from CLI args
    const descriptionArg = args.filter((a) => !a.startsWith('--')).join(' ').trim()

    // CI mode requires --description
    if (isCi && !descriptionArg) {
      return err({
        code: ERROR_CODES.MISSING_ARG,
        i18nKey: 'cli.specify.no_description',
        params: {},
      })
    }

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
      let wizardClarifications: ClarificationAnswer[] | undefined
      if (isCi) {
        ciLog('auto-skipped', 'ambiguity clarification')
      } else {
        const allWizardText = Object.values(wizardAnswers).join(' ')
        const wizardAmbiguities = detectAmbiguities(allWizardText)
        if (wizardAmbiguities.length > 0) {
          clack.log.info(i18n.t('cli.specify.ambiguity_detected'))
          const answers = await runClarificationFlow(wizardAmbiguities, i18n, isWebBundle)
          if (answers === undefined) {
            clack.outro(i18n.t('cli.specify.cancelled'))
            return ok(undefined)
          }
          wizardClarifications = answers
        }
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
      let clarifications: ClarificationAnswer[] | undefined
      if (isCi) {
        ciLog('auto-skipped', 'ambiguity clarification')
      } else {
        const ambiguities = detectAmbiguities(description)
        if (ambiguities.length > 0) {
          clack.log.info(i18n.t('cli.specify.ambiguity_detected'))
          const answers = await runClarificationFlow(ambiguities, i18n, isWebBundle)
          if (answers === undefined) {
            clack.outro(i18n.t('cli.specify.cancelled'))
            return ok(undefined)
          }
          clarifications = answers
        }
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

    // Squad domain-aware question injection
    if (isCi) {
      ciLog('auto-skipped', 'squad questions')
    } else {
      const activeSquad = await readActiveSquad(projectDir)
      if (activeSquad) {
        const squadQuestions = getSquadQuestions(activeSquad.domain)
        if (squadQuestions.length > 0) {
          clack.log.info(i18n.t('cli.specify.squad_active', { name: activeSquad.name, domain: activeSquad.domain }))
          const squadAnswers = await runSquadFlow(squadQuestions, i18n, isWebBundle)
          if (squadAnswers === undefined) {
            clack.outro(i18n.t('cli.specify.cancelled'))
            return ok(undefined)
          }
          specInput = {
            ...specInput,
            squadConstraints: {
              squadName: activeSquad.name,
              domain: activeSquad.domain,
              answers: squadAnswers,
            },
          }
        }
      }
    }

    // Automation Maturity Assessment
    let maturityResult: MaturityAssessmentResult | undefined
    if (isCi) {
      ciLog('auto-skipped', 'maturity assessment, default Stage 3')
      maturityResult = scoreMaturity({ frequency: 'weekly', predictability: 'mostly_predictable', humanDecisions: 'minor' })
    } else {
      maturityResult = await assessAutomationMaturity(i18n, isWebBundle)
      if (maturityResult === undefined) {
        clack.outro(i18n.t('cli.specify.cancelled'))
        return ok(undefined)
      }
    }
    specInput = { ...specInput, maturityAssessment: maturityResult }

    // Build and write the spec
    const specContent = buildSpecContent(specInput)

    // Constitution enforcement — validate output before writing (FR-202)
    const guardResult = await guardConstitutionModification(specContent, projectDir, i18n)
    if (!guardResult.ok) return guardResult
    const enforcement = await enforceConstitutionOnOutput(specContent, projectDir, i18n)
    if (enforcement.ok && enforcement.value.hasViolations) {
      const { formatViolationWarning } = await import('../../foundation/constitution.js')
      const { readExperienceLevel } = await import('../../foundation/context.js')
      const beginnerMode = (await readExperienceLevel(projectDir)) === 'beginner'
      for (const v of enforcement.value.violations) {
        clack.log.warn(formatViolationWarning(v, beginnerMode, i18n))
      }
    }

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
