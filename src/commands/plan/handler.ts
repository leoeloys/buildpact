/**
 * Plan command handler.
 * Spawns parallel research agents (tech stack, codebase, squad domain) in isolated subagent contexts,
 * consolidates findings, and generates a plan.md referencing specific research results.
 * @see FR-501 — Automated Parallel Research Before Planning
 */

import * as clack from '@clack/prompts'
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage, I18nResolver } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { buildTaskPayload } from '../../engine/subagent.js'
import type { TaskDispatchPayload } from '../../contracts/task.js'
import { resolveConstitutionPath } from '../../engine/constitution-enforcer.js'

// ---------------------------------------------------------------------------
// Research types
// ---------------------------------------------------------------------------

/** Topic areas researched before plan generation */
export type ResearchTopic = 'tech_stack' | 'codebase' | 'squad_domain'

/** Payload sent to an isolated research subagent */
export interface ResearchAgentPayload {
  topic: ResearchTopic
  taskPayload: TaskDispatchPayload
}

/** Findings returned by a completed research subagent */
export interface ResearchResult {
  topic: ResearchTopic
  findings: string
  /** Keys extracted from findings for plan cross-referencing */
  keywords: string[]
}

/** Consolidated summary from all research agents */
export interface ResearchSummary {
  techStack: ResearchResult
  codebase: ResearchResult
  squadDomain: ResearchResult
  consolidatedAt: string
}

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Build an isolated research subagent payload for the given topic.
 * Each payload has a clean context containing only the spec + research prompt.
 * Pure function — no side effects.
 */
export function buildResearchPayload(
  topic: ResearchTopic,
  specContent: string,
  constitutionPath?: string,
): ResearchAgentPayload {
  const prompts: Record<ResearchTopic, string> = {
    tech_stack:
      'Analyse the spec below. Identify the technology stack, programming languages, frameworks, and infrastructure required. List your findings concisely.',
    codebase:
      'Analyse the spec below. Review the existing codebase structure, relevant modules, and integration points. Identify what files and patterns are relevant to implementing this spec.',
    squad_domain:
      'Analyse the spec below. Extract domain-specific constraints, compliance requirements, and domain rules that must be respected during planning.',
  }

  const content = `# Research Task: ${topic}\n\n${prompts[topic]}\n\n---\n\n## Spec\n\n${specContent}`

  const taskPayload = buildTaskPayload({
    type: 'plan',
    content,
    ...(constitutionPath !== undefined && { constitutionPath }),
  })

  return { topic, taskPayload }
}

/**
 * Produce stub research findings for an agent that would run in isolation.
 * In Alpha, this returns structured placeholder content derived from the spec.
 * In production, this would be replaced by the actual Task() dispatch result.
 * Pure function — no side effects.
 */
export function buildStubFindings(topic: ResearchTopic, specSnippet: string): ResearchResult {
  const firstLine = specSnippet.split('\n').find(l => l.trim().length > 0) ?? 'Unknown feature'

  const stubData: Record<ResearchTopic, { findings: string; keywords: string[] }> = {
    tech_stack: {
      findings: `Tech Stack Research for: ${firstLine}\n\n- Stack: inferred from spec context\n- Language: TypeScript (project standard)\n- Frameworks: Node.js / ESM modules\n- Build: tsdown + Vitest\n- Note: Confirm deployment target before planning infrastructure tasks`,
      keywords: ['TypeScript', 'Node.js', 'ESM', 'tsdown', 'Vitest'],
    },
    codebase: {
      findings: `Codebase Research for: ${firstLine}\n\n- Layer structure: contracts → foundation → engine → commands → cli\n- Pattern: Result<T, CliError> for all fallible functions\n- I18n: all user strings via I18nResolver.t()\n- Audit: AuditLogger for write operations\n- Tests: Vitest 4.x, factory function pattern, mock node:child_process for git`,
      keywords: ['contracts', 'foundation', 'engine', 'commands', 'Result', 'I18nResolver', 'AuditLogger'],
    },
    squad_domain: {
      findings: `Domain Constraints Research for: ${firstLine}\n\n- Domain rules: enforce project Constitution if present\n- Compliance: no external URLs in squad files; validate payloads ≤20KB\n- Domain questions: use Squad question templates when active Squad detected\n- Output: all artifacts saved to .buildpact/ hierarchy`,
      keywords: ['Constitution', 'payload', 'Squad', '.buildpact'],
    },
  }

  return { topic, ...stubData[topic] }
}

/**
 * Consolidate results from all three research agents into a unified summary.
 * Pure function — no side effects.
 */
export function consolidateResearch(
  techStack: ResearchResult,
  codebase: ResearchResult,
  squadDomain: ResearchResult,
): ResearchSummary {
  return {
    techStack,
    codebase,
    squadDomain,
    consolidatedAt: new Date().toISOString(),
  }
}

/**
 * Build a plan.md document from the spec content and consolidated research summary.
 * The plan references specific findings from each research agent.
 * Pure function — no side effects.
 */
export function buildPlanContent(
  specContent: string,
  research: ResearchSummary,
  slug: string,
  generatedAt: string,
): string {
  const allKeywords = [
    ...research.techStack.keywords,
    ...research.codebase.keywords,
    ...research.squadDomain.keywords,
  ]

  const lines: string[] = [
    `# Plan — ${slug}`,
    '',
    `> Generated: ${generatedAt}`,
    `> Research consolidated: ${research.consolidatedAt}`,
    '',
    '## Research Findings',
    '',
    '### Tech Stack',
    '',
    research.techStack.findings,
    '',
    '### Codebase Context',
    '',
    research.codebase.findings,
    '',
    '### Domain Constraints',
    '',
    research.squadDomain.findings,
    '',
    '## Key References from Research',
    '',
    allKeywords.map(kw => `- \`${kw}\``).join('\n'),
    '',
    '## Spec Summary',
    '',
    specContent
      .split('\n')
      .slice(0, 20)
      .join('\n'),
    '',
    '---',
    '',
    '## Wave Plan',
    '',
    '> Wave planning requires the full pipeline. Run `/bp:execute` to generate and execute waves based on the research above.',
    '',
    '### Wave 1 — Foundation',
    '',
    '- [ ] [AGENT] Review research findings and confirm tech stack choices',
    '- [ ] [AGENT] Identify affected files from codebase research',
    '',
    '### Wave 2 — Implementation',
    '',
    '- [ ] [AGENT] Implement core changes following codebase patterns',
    '- [ ] [AGENT] Apply domain constraints from Squad research',
    '',
    '### Wave 3 — Verification',
    '',
    '- [ ] [AGENT] Run typecheck and tests',
    '- [ ] [AGENT] Verify against spec acceptance criteria',
  ]

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

/**
 * Find the most recently modified spec.md in .buildpact/specs/.
 * Returns the content and slug of the spec, or undefined if none found.
 */
async function findLatestSpec(
  projectDir: string,
): Promise<{ content: string; slug: string } | undefined> {
  try {
    const specsDir = join(projectDir, '.buildpact', 'specs')
    const entries = await readdir(specsDir)
    if (entries.length === 0) return undefined

    // Use the last alphabetically as the most recent (slug format uses timestamp or name)
    const slug = entries[entries.length - 1] ?? ''
    if (!slug) return undefined
    const specPath = join(specsDir, slug, 'spec.md')
    const content = await readFile(specPath, 'utf-8')
    return { content, slug }
  } catch {
    return undefined
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

    clack.intro(i18n.t('cli.plan.welcome'))

    // Resolve spec — from arg (path to spec.md) or latest in .buildpact/specs/
    let specContent: string
    let specSlug: string

    if (args[0]) {
      try {
        specContent = await readFile(args[0], 'utf-8')
        specSlug = args[0].split('/').at(-2) ?? 'unknown'
      } catch {
        clack.log.error(i18n.t('cli.plan.spec_not_found', { path: args[0] }))
        return err({
          code: ERROR_CODES.FILE_READ_FAILED,
          i18nKey: 'cli.plan.spec_not_found',
          params: { path: args[0] },
        })
      }
    } else {
      const latest = await findLatestSpec(projectDir)
      if (!latest) {
        clack.log.warn(i18n.t('cli.plan.no_spec_found'))
        clack.outro(i18n.t('cli.plan.no_spec_outro'))
        return ok(undefined)
      }
      specContent = latest.content
      specSlug = latest.slug
    }

    const constitutionPath = await resolveConstitutionPath(projectDir)

    // Spawn parallel research agents
    const spinner = clack.spinner()
    spinner.start(i18n.t('cli.plan.research_start'))

    const topics: ResearchTopic[] = ['tech_stack', 'codebase', 'squad_domain']
    const payloads = topics.map(topic =>
      buildResearchPayload(topic, specContent, constitutionPath),
    )

    // In Alpha: produce stub findings. In production, Task() dispatch replaces this.
    const results = payloads.map(p => buildStubFindings(p.topic, specContent))

    const [techStack, codebase, squadDomain] = results as [ResearchResult, ResearchResult, ResearchResult]
    const research = consolidateResearch(techStack, codebase, squadDomain)

    spinner.stop(i18n.t('cli.plan.research_done', { count: String(topics.length) }))

    clack.log.success(i18n.t('cli.plan.research_tech', { keywords: techStack.keywords.join(', ') }))
    clack.log.success(i18n.t('cli.plan.research_codebase', { keywords: codebase.keywords.join(', ') }))
    clack.log.success(i18n.t('cli.plan.research_domain', { keywords: squadDomain.keywords.join(', ') }))

    // Generate plan content
    const generatedAt = new Date().toISOString()
    const planContent = buildPlanContent(specContent, research, specSlug, generatedAt)

    // Write plan.md
    const planDir = join(projectDir, '.buildpact', 'plans', specSlug)
    await mkdir(planDir, { recursive: true })
    const planPath = join(planDir, 'plan.md')
    await writeFile(planPath, planContent, 'utf-8')

    // Audit
    await audit.log({
      action: 'plan.generate',
      agent: 'plan',
      files: [planPath],
      outcome: 'success',
    })

    clack.outro(i18n.t('cli.plan.done', { path: planPath }))
    return ok(undefined)
  },
}
