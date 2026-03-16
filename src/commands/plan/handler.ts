/**
 * Plan command handler.
 * Spawns parallel research agents (tech stack, codebase, squad domain) in isolated subagent contexts,
 * consolidates findings, and generates a wave-based plan.md referencing specific research results.
 * @see FR-501 — Automated Parallel Research Before Planning
 * @see FR-502 — Wave-Based Plan Generation
 * @see FR-504 — Nyquist Multi-Perspective Plan Validation
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
import {
  validatePlan,
  formatValidationReport,
  autoRevisePlan,
} from '../../engine/plan-validator.js'

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
// Wave planning types
// ---------------------------------------------------------------------------

/** A single executable task extracted from the spec */
export interface PlanTask {
  id: string
  title: string
  dependencies: string[]
  wave: number
}

/** A group of tasks that can run in parallel (same wave) */
export interface WaveGroup {
  waveNumber: number
  tasks: PlanTask[]
}

/** Specification for a single plan file (a wave or part of a wave) */
export interface PlanFileSpec {
  filename: string
  waveNumber: number
  /** '' for the first part, 'b', 'c', ... for split parts */
  partSuffix: string
  tasks: PlanTask[]
}

// ---------------------------------------------------------------------------
// Wave planning pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Extract tasks from the spec's Acceptance Criteria (or Functional Requirements) section.
 * Each bullet point becomes a PlanTask. Falls back to 3 generic tasks when no AC section found.
 * Pure function — no side effects.
 */
export function extractTasksFromSpec(specContent: string): PlanTask[] {
  const lines = specContent.split('\n')
  const tasks: PlanTask[] = []
  let inSection = false
  let taskIdx = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+(Acceptance Criteria|Functional Requirements|FRs?)\b/i.test(trimmed)) {
      inSection = true
      continue
    }
    if (inSection && /^##\s/.test(trimmed)) {
      inSection = false
      continue
    }
    if (inSection && /^[-*]\s/.test(trimmed)) {
      const title = trimmed.slice(2).replace(/^\[[ xX]\]\s*/, '').trim()
      if (title.length > 3) {
        taskIdx++
        tasks.push({ id: `T${taskIdx}`, title, dependencies: [], wave: 0 })
      }
    }
  }

  if (tasks.length === 0) {
    const firstLine =
      specContent
        .split('\n')
        .find(l => l.trim().length > 0)
        ?.trim() ?? 'Implement feature'
    return [
      { id: 'T1', title: 'Foundation setup', dependencies: [], wave: 0 },
      {
        id: 'T2',
        title: `Core implementation: ${firstLine.slice(0, 60)}`,
        dependencies: ['T1'],
        wave: 0,
      },
      { id: 'T3', title: 'Verification and tests', dependencies: ['T2'], wave: 0 },
    ]
  }

  return tasks
}

/**
 * Infer task dependencies from title keywords ("after T1", "requires T2", etc.).
 * Searches for dependency keyword phrases followed by task ID references.
 * Pure function — no side effects.
 */
export function inferDependencies(tasks: PlanTask[]): PlanTask[] {
  const AFTER_KEYWORDS = ['after ', 'following ', 'once ', 'requires ', 'depends on ']
  return tasks.map(task => {
    const lowerTitle = task.title.toLowerCase()
    const deps: string[] = []

    for (const kw of AFTER_KEYWORDS) {
      if (!lowerTitle.includes(kw)) continue
      for (const other of tasks) {
        if (other.id !== task.id && lowerTitle.includes(other.id.toLowerCase())) {
          if (!deps.includes(other.id)) deps.push(other.id)
        }
      }
    }

    return deps.length > 0 ? { ...task, dependencies: deps } : task
  })
}

/**
 * Assign wave numbers to tasks using topological sort.
 * Tasks with no dependencies → wave 0.
 * Tasks with dependencies → wave = max(dependency waves) + 1.
 * Circular dependencies are handled gracefully (cycle guard → wave 0).
 * Pure function — no side effects.
 */
export function assignWaves(tasks: PlanTask[]): PlanTask[] {
  const waveOf = new Map<string, number>()

  function computeWave(id: string, visiting = new Set<string>()): number {
    if (waveOf.has(id)) return waveOf.get(id)!
    if (visiting.has(id)) {
      waveOf.set(id, 0)
      return 0
    }
    visiting.add(id)
    const task = tasks.find(t => t.id === id)
    if (!task || task.dependencies.length === 0) {
      waveOf.set(id, 0)
      return 0
    }
    const w = Math.max(...task.dependencies.map(d => computeWave(d, new Set(visiting)))) + 1
    waveOf.set(id, w)
    return w
  }

  for (const t of tasks) computeWave(t.id)
  return tasks.map(t => ({ ...t, wave: waveOf.get(t.id) ?? 0 }))
}

/**
 * Group assigned tasks into WaveGroups sorted by wave number.
 * Independent tasks (same wave number) are grouped together for parallel execution.
 * Vertical slices are preserved: tasks are not re-sorted by technical layer.
 * Pure function — no side effects.
 */
export function groupIntoWaves(tasks: PlanTask[]): WaveGroup[] {
  const map = new Map<number, PlanTask[]>()
  for (const t of tasks) {
    const existing = map.get(t.wave) ?? []
    map.set(t.wave, [...existing, t])
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([waveNumber, waveTasks]) => ({ waveNumber, tasks: waveTasks }))
}

/** Maximum tasks per plan file before auto-split */
export const MAX_TASKS_PER_PLAN_FILE = 2

const PART_SUFFIXES = ['', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

/**
 * Split wave groups that exceed maxTasksPerFile into multiple PlanFileSpecs.
 * Wave 1 with 5 tasks and maxTasksPerFile=2 → plan-wave-1.md (T1,T2), plan-wave-1b.md (T3,T4), plan-wave-1c.md (T5).
 * Pure function — no side effects.
 */
export function splitWavesIfNeeded(
  waves: WaveGroup[],
  maxTasksPerFile = MAX_TASKS_PER_PLAN_FILE,
): PlanFileSpec[] {
  const files: PlanFileSpec[] = []

  for (const wave of waves) {
    if (wave.tasks.length <= maxTasksPerFile) {
      files.push({
        filename: `plan-wave-${wave.waveNumber + 1}.md`,
        waveNumber: wave.waveNumber,
        partSuffix: '',
        tasks: wave.tasks,
      })
    } else {
      let partIdx = 0
      for (let i = 0; i < wave.tasks.length; i += maxTasksPerFile) {
        const chunk = wave.tasks.slice(i, i + maxTasksPerFile)
        const suffix = PART_SUFFIXES[partIdx] ?? String(partIdx + 1)
        files.push({
          filename: `plan-wave-${wave.waveNumber + 1}${suffix}.md`,
          waveNumber: wave.waveNumber,
          partSuffix: suffix,
          tasks: chunk,
        })
        partIdx++
      }
    }
  }

  return files
}

/**
 * Build the markdown content for a single wave plan file.
 * Pure function — no side effects.
 */
export function buildWaveFileContent(
  fileSpec: PlanFileSpec,
  research: ResearchSummary,
  slug: string,
  generatedAt: string,
): string {
  const waveNum = fileSpec.waveNumber + 1
  const waveLabel = fileSpec.partSuffix
    ? `Wave ${waveNum}${fileSpec.partSuffix.toUpperCase()}`
    : `Wave ${waveNum}`

  const taskLines = fileSpec.tasks
    .map(t => {
      const depNote =
        t.dependencies.length > 0 ? ` _(after: ${t.dependencies.join(', ')})_` : ''
      return `- [ ] [AGENT] ${t.title}${depNote}`
    })
    .join('\n')

  const allKeywords = [
    ...research.techStack.keywords,
    ...research.codebase.keywords,
    ...research.squadDomain.keywords,
  ]

  return [
    `# Plan — ${slug} — ${waveLabel}`,
    '',
    `> Generated: ${generatedAt}`,
    `> Wave: ${waveLabel} (${fileSpec.tasks.length} task${fileSpec.tasks.length !== 1 ? 's' : ''})`,
    '',
    '## Tasks',
    '',
    taskLines,
    '',
    '## Key References',
    '',
    allKeywords.map(kw => `- \`${kw}\``).join('\n'),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Research pure functions — exported for unit testing
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
 * Build the main plan.md overview document from the spec content and consolidated research summary.
 * The Wave Plan section uses actual tasks extracted and wave-grouped from the spec.
 * Pure function — no side effects.
 */
export function buildPlanContent(
  specContent: string,
  research: ResearchSummary,
  slug: string,
  generatedAt: string,
): string {
  // Extract tasks and assign waves from spec
  const rawTasks = extractTasksFromSpec(specContent)
  const withDeps = inferDependencies(rawTasks)
  const withWaves = assignWaves(withDeps)
  const waves = groupIntoWaves(withWaves)

  const allKeywords = [
    ...research.techStack.keywords,
    ...research.codebase.keywords,
    ...research.squadDomain.keywords,
  ]

  // Build wave plan sections
  const waveSections: string[] = ['## Wave Plan', '']
  for (const wave of waves) {
    waveSections.push(`### Wave ${wave.waveNumber + 1}`)
    waveSections.push('')
    for (const task of wave.tasks) {
      const depNote =
        task.dependencies.length > 0 ? ` _(after: ${task.dependencies.join(', ')})_` : ''
      waveSections.push(`- [ ] [AGENT] ${task.title}${depNote}`)
    }
    waveSections.push('')
  }

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
    specContent.split('\n').slice(0, 20).join('\n'),
    '',
    '---',
    '',
    ...waveSections,
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

    // Generate main plan.md (overview with all waves)
    const generatedAt = new Date().toISOString()

    // Compute tasks for validation + wave planning
    const rawTasks = extractTasksFromSpec(specContent)
    const withDeps = inferDependencies(rawTasks)
    const withWaves = assignWaves(withDeps)

    // --- Nyquist Multi-Perspective Validation ---
    const validationSpinner = clack.spinner()
    validationSpinner.start(i18n.t('cli.plan.validation_start'))
    const validationReport = validatePlan(specContent, withWaves)
    validationSpinner.stop(i18n.t('cli.plan.validation_done'))

    if (validationReport.totalIssues > 0) {
      clack.log.warn(
        i18n.t('cli.plan.validation_issues', {
          total: String(validationReport.totalIssues),
          critical: String(
            validationReport.perspectives
              .flatMap(p => p.issues)
              .filter(i => i.severity === 'critical').length,
          ),
        }),
      )

      // Show issues per perspective
      for (const perspective of validationReport.perspectives) {
        if (perspective.issues.length > 0) {
          for (const issue of perspective.issues) {
            if (issue.severity === 'critical') {
              clack.log.error(`[${perspective.label}] ${issue.message}`)
            } else {
              clack.log.warn(`[${perspective.label}] ${issue.message}`)
            }
          }
        }
      }
    } else {
      clack.log.success(i18n.t('cli.plan.validation_passed'))
    }

    // If there are critical issues, ask user whether to revise or override
    let finalTasks = withWaves
    if (validationReport.hasCritical) {
      const choice = await clack.select({
        message: i18n.t('cli.plan.validation_block'),
        options: [
          { value: 'revise', label: i18n.t('cli.plan.validation_revise') },
          { value: 'override', label: i18n.t('cli.plan.validation_override') },
          { value: 'cancel', label: i18n.t('cli.plan.validation_cancel') },
        ],
      })

      if (clack.isCancel(choice) || choice === 'cancel') {
        clack.outro(i18n.t('cli.plan.validation_cancelled'))
        return ok(undefined)
      }

      if (choice === 'revise') {
        finalTasks = assignWaves(inferDependencies(autoRevisePlan(specContent, withWaves)))
        clack.log.success(i18n.t('cli.plan.validation_revised'))
      }
      // 'override' → proceed with original tasks, just log it
      if (choice === 'override') {
        clack.log.warn(i18n.t('cli.plan.validation_overridden'))
      }
    }

    const planContent = buildPlanContent(specContent, research, specSlug, generatedAt)

    const waves = groupIntoWaves(finalTasks)
    const planFiles = splitWavesIfNeeded(waves)

    // Write plan directory
    const planDir = join(projectDir, '.buildpact', 'plans', specSlug)
    await mkdir(planDir, { recursive: true })

    // Write main plan.md
    const planPath = join(planDir, 'plan.md')
    await writeFile(planPath, planContent, 'utf-8')

    // Write validation report
    const validationReportPath = join(planDir, 'validation-report.md')
    await writeFile(validationReportPath, formatValidationReport(validationReport), 'utf-8')

    // Write per-wave files when multiple files are needed
    const writtenFiles: string[] = [planPath, validationReportPath]
    if (planFiles.length > 1) {
      clack.log.info(
        i18n.t('cli.plan.wave_split', {
          count: String(planFiles.length),
          max: String(MAX_TASKS_PER_PLAN_FILE),
        }),
      )
      for (const fileSpec of planFiles) {
        const waveContent = buildWaveFileContent(fileSpec, research, specSlug, generatedAt)
        const wavePath = join(planDir, fileSpec.filename)
        await writeFile(wavePath, waveContent, 'utf-8')
        writtenFiles.push(wavePath)
      }
    }

    // Audit
    await audit.log({
      action: 'plan.generate',
      agent: 'plan',
      files: writtenFiles,
      outcome: 'success',
    })

    clack.outro(i18n.t('cli.plan.done', { path: planPath }))
    return ok(undefined)
  },
}
