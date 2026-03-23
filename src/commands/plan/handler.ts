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
import { enforceConstitutionOnOutput } from '../../engine/orchestrator.js'
import { guardConstitutionModification } from '../registry.js'
import {
  validatePlan,
  formatValidationReport,
  autoRevisePlan,
  type PlanValidationReport,
} from '../../engine/plan-validator.js'
import { analyzeWaves, splitIntoPlanFiles } from '../../engine/wave-executor.js'
import type { TaskNode } from '../../engine/types.js'
import { spawnResearchAgents } from './researcher.js'
import { loadProfile, resolveModelForOperation } from '../../foundation/profile.js'
import { tagTasks } from './tagger.js'
import { runReadinessGate } from '../../engine/readiness-gate.js'
import { isCiMode, ciLog } from '../../foundation/ci.js'

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
export interface PlanResearchResult {
  topic: ResearchTopic
  findings: string
  /** Keys extracted from findings for plan cross-referencing */
  keywords: string[]
}

/** Consolidated summary from all research agents */
export interface PlanResearchSummary {
  techStack: PlanResearchResult
  codebase: PlanResearchResult
  squadDomain: PlanResearchResult
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

// ---------------------------------------------------------------------------
// Human / Agent classification types
// ---------------------------------------------------------------------------

// Re-export from tagger and progress for backward compatibility
export { classifyTask, type ExecutionType, type TaggedTask } from './tagger.js'
export { loadProgress, saveProgress, isHumanStepPending, type TaskProgressEntry, type PlanProgress } from './progress.js'
import { classifyTask } from './tagger.js'
import type { ExecutionType } from './tagger.js'
import { loadProgress } from './progress.js'
import type { PlanProgress, TaskProgressEntry } from './progress.js'

// PlanProgress and TaskProgressEntry moved to progress.ts — imported above

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

// ---------------------------------------------------------------------------
// Human / Agent classification — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Keywords in task titles that indicate a human manual action is required.
 * Case-insensitive substring match — order matters (more specific first).
 */
// classifyTask and HUMAN_KEYWORDS moved to tagger.ts — imported above

/**
 * Build the initial progress state for a plan (all tasks incomplete).
 * Pure function — no side effects.
 */
export function buildProgressContent(
  slug: string,
  tasks: PlanTask[],
  generatedAt: string,
): PlanProgress {
  return {
    slug,
    generatedAt,
    tasks: tasks.map(t => ({
      taskId: t.id,
      title: t.title,
      executionType: classifyTask(t.title),
      completed: false,
    })),
  }
}

/**
 * Build the markdown content for a single wave plan file.
 * Pure function — no side effects.
 */
export function buildWaveFileContent(
  fileSpec: PlanFileSpec,
  research: PlanResearchSummary,
  slug: string,
  generatedAt: string,
  domainType: string = 'software',
): string {
  const waveNum = fileSpec.waveNumber + 1
  const waveLabel = fileSpec.partSuffix
    ? `Wave ${waveNum}${fileSpec.partSuffix.toUpperCase()}`
    : `Wave ${waveNum}`

  const taggedTasks = tagTasks(fileSpec.tasks, domainType)
  const taskLines = taggedTasks
    .map(t => {
      const depNote =
        t.dependencies.length > 0 ? ` _(after: ${t.dependencies.join(', ')})_` : ''
      if (t.executor === 'HUMAN') {
        const checklistItems = t.checklistItems ?? ['Confirm step completed manually']
        const checklist = checklistItems.map(item => `  - [ ] ${item}`).join('\n')
        return `- [ ] [HUMAN] ${t.title}${depNote}\n${checklist}`
      }
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
  squadContext?: string,
): ResearchAgentPayload {
  const prompts: Record<ResearchTopic, string> = {
    tech_stack:
      'Analyse the spec below. Identify the technology stack, programming languages, frameworks, and infrastructure required. List your findings concisely.',
    codebase:
      'Analyse the spec below. Review the existing codebase structure, relevant modules, and integration points. Identify what files and patterns are relevant to implementing this spec.',
    squad_domain:
      'Analyse the spec below. Extract domain-specific constraints, compliance requirements, and domain rules that must be respected during planning.',
  }

  let content = `# Research Task: ${topic}\n\n${prompts[topic]}\n\n---\n\n## Spec\n\n${specContent}`
  if (topic === 'squad_domain' && squadContext) {
    content += `\n\n## Active Squad Guidance\n\n${squadContext}`
  }

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
export function buildStubFindings(topic: ResearchTopic, specSnippet: string, squadContext?: string): PlanResearchResult {
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
      findings: squadContext
        ? `Domain Constraints Research for: ${firstLine}\n\nActive Squad Guidance (excerpt):\n${squadContext.split('\n').slice(0, 10).join('\n')}\n\n- Enforce project Constitution if present\n- Validate payloads ≤20KB before dispatch\n- All artifacts saved to .buildpact/ hierarchy`
        : `Domain Constraints Research for: ${firstLine}\n\n- Domain rules: enforce project Constitution if present\n- Compliance: no external URLs in squad files; validate payloads ≤20KB\n- Domain questions: use Squad question templates when active Squad detected\n- Output: all artifacts saved to .buildpact/ hierarchy`,
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
  techStack: PlanResearchResult,
  codebase: PlanResearchResult,
  squadDomain: PlanResearchResult,
): PlanResearchSummary {
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
  research: PlanResearchSummary,
  slug: string,
  generatedAt: string,
  domainType: string = 'software',
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
    const taggedWaveTasks = tagTasks(wave.tasks, domainType)
    for (const task of taggedWaveTasks) {
      const depNote =
        task.dependencies.length > 0 ? ` _(after: ${task.dependencies.join(', ')})_` : ''
      if (task.executor === 'HUMAN') {
        waveSections.push(`- [ ] [HUMAN] ${task.title}${depNote}`)
        const checklistItems = task.checklistItems ?? ['Confirm step completed manually']
        for (const item of checklistItems) {
          waveSections.push(`  - [ ] ${item}`)
        }
      } else {
        waveSections.push(`- [ ] [AGENT] ${task.title}${depNote}`)
      }
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

/** Read active_squad from .buildpact/config.yaml, fallback to '' */
async function readActiveSquad(projectDir: string): Promise<string> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('active_squad:')) {
        return trimmed.slice('active_squad:'.length).trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // ignore
  }
  return ''
}

/**
 * Load all markdown files from the active squad directory as a single string.
 * Returns empty string if no squad is configured or directory not found.
 */
async function loadSquadContext(projectDir: string, activeSquad: string): Promise<string> {
  if (!activeSquad) return ''
  try {
    const squadDir = join(projectDir, '.buildpact', 'squads', activeSquad)
    const entries = await readdir(squadDir)
    const mdFiles = entries.filter(f => f.endsWith('.md')).sort()
    const contents = await Promise.all(
      mdFiles.map(f => readFile(join(squadDir, f), 'utf-8').catch(() => '')),
    )
    return contents.filter(Boolean).join('\n\n')
  } catch {
    return ''
  }
}

/** Read domain_type from the active squad's squad.yaml, fallback to 'software' */
async function readSquadDomainType(projectDir: string, activeSquad: string): Promise<string> {
  if (!activeSquad) return 'software'
  try {
    const squadYaml = await readFile(
      join(projectDir, '.buildpact', 'squads', activeSquad, 'squad.yaml'),
      'utf-8',
    )
    for (const line of squadYaml.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('domain_type:')) {
        return trimmed.slice('domain_type:'.length).trim().replace(/^["']|["']$/g, '') || 'software'
      }
    }
  } catch {
    // Squad YAML not found or unreadable — default to software
  }
  return 'software'
}

/** Read active_model_profile from .buildpact/config.yaml, fallback to 'default' */
async function readModelProfileName(projectDir: string): Promise<string> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('active_model_profile:')) {
        return trimmed.slice('active_model_profile:'.length).trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // ignore
  }
  return 'default'
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
    const isCi = isCiMode(args)

    clack.intro(i18n.t('cli.plan.welcome'))

    // Load model profile (FR-603)
    const profileName = await readModelProfileName(projectDir)
    const profileResult = await loadProfile(profileName, projectDir)
    const activeProfile = profileResult.ok ? profileResult.value : undefined
    const researchModel = activeProfile
      ? resolveModelForOperation(activeProfile, 'plan', 'research')
      : 'claude-sonnet-4-6'
    const planWritingModel = activeProfile
      ? resolveModelForOperation(activeProfile, 'plan', 'plan-writing')
      : 'claude-sonnet-4-6'

    await audit.log({
      action: 'plan.profile.loaded',
      agent: 'plan',
      files: [],
      outcome: profileResult.ok ? 'success' : 'failure',
      ...(profileResult.ok
        ? {}
        : { error: `Profile '${profileName}' not found — using defaults` }),
    })

    // Suppress unused-variable warnings in Alpha (models used by Task() dispatch in production)
    void researchModel
    void planWritingModel

    // Resolve spec — from arg (path to spec.md) or latest in .buildpact/specs/
    const positionalArgs = args.filter(a => !a.startsWith('--'))
    let specContent: string
    let specSlug: string

    if (positionalArgs[0]) {
      try {
        specContent = await readFile(positionalArgs[0], 'utf-8')
        specSlug = positionalArgs[0].split('/').at(-2) ?? 'unknown'
      } catch {
        clack.log.error(i18n.t('cli.plan.spec_not_found', { path: positionalArgs[0] }))
        return err({
          code: ERROR_CODES.FILE_READ_FAILED,
          i18nKey: 'cli.plan.spec_not_found',
          params: { path: positionalArgs[0] },
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

    // Load active squad context for domain constraints research (AC #3)
    const activeSquad = await readActiveSquad(projectDir)
    const squadContext = await loadSquadContext(projectDir, activeSquad)

    // Detect non-software domain for human/agent tagging (FR-505)
    const domainType = await readSquadDomainType(projectDir, activeSquad)
    if (domainType !== 'software' && activeSquad) {
      clack.log.info(i18n.t('cli.plan.non_software_detected', { domain_type: domainType }))
    }

    // Check for existing progress — offer resume (AC #5)
    const resumePlanDir = join(projectDir, '.buildpact', 'plans', specSlug || 'default')
    const existingProgress = await loadProgress(resumePlanDir)
    let resumeFromProgress = false
    if (existingProgress) {
      const completedCount = existingProgress.tasks.filter(t => t.completed).length
      if (completedCount > 0 && completedCount < existingProgress.tasks.length) {
        if (isCi) {
          ciLog('auto-skipped', 'resume prompt')
          // CI always generates fresh plan
        } else {
          const resumeChoice = await clack.select({
            message: i18n.t('cli.plan.resume_prompt', {
              completed: String(completedCount),
              total: String(existingProgress.tasks.length),
            }),
            options: [
              { value: 'yes', label: i18n.t('cli.plan.resume_yes') },
              { value: 'no', label: i18n.t('cli.plan.resume_no') },
            ],
          })
          if (!clack.isCancel(resumeChoice) && resumeChoice === 'yes') {
            resumeFromProgress = true
          }
        }
      }
    }

    // Spawn parallel research agents
    const spinner = clack.spinner()
    spinner.start(i18n.t('cli.plan.research_start'))

    const topics: ResearchTopic[] = ['tech_stack', 'codebase', 'squad_domain']
    const payloads = topics.map(topic =>
      buildResearchPayload(topic, specContent, constitutionPath, topic === 'squad_domain' ? squadContext : undefined),
    )

    // In Alpha: produce stub findings. In production, Task() dispatch replaces this.
    const results = payloads.map(p =>
      buildStubFindings(p.topic, specContent, p.topic === 'squad_domain' ? squadContext : undefined),
    )

    const [techStack, codebase, squadDomain] = results as [PlanResearchResult, PlanResearchResult, PlanResearchResult]
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
    let validationReport = validatePlan(specContent, withWaves)
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
            const msg = i18n.t(
              issue.severity === 'critical'
                ? 'cli.plan.validation_issue_critical'
                : 'cli.plan.validation_issue_warning',
              { perspective: perspective.label, message: issue.message },
            )
            if (issue.severity === 'critical') {
              clack.log.error(msg)
            } else {
              clack.log.warn(msg)
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
      if (isCi) {
        // CI mode: auto-revise; fail if still critical after max attempts
        ciLog('auto-action', 'nyquist auto-revision')
        const MAX_REVISION_ATTEMPTS = 3
        let revisionAttempts = 0
        let revised = withWaves
        let revalidated = validationReport

        while (revalidated.hasCritical && revisionAttempts < MAX_REVISION_ATTEMPTS) {
          revised = assignWaves(inferDependencies(autoRevisePlan(specContent, revised)))
          revalidated = validatePlan(specContent, revised)
          revisionAttempts++
        }

        finalTasks = revised
        validationReport = revalidated

        if (revalidated.hasCritical) {
          ciLog('auto-action', 'nyquist revision failed after ' + MAX_REVISION_ATTEMPTS + ' attempts')
          return err({
            code: ERROR_CODES.NOT_IMPLEMENTED,
            i18nKey: 'cli.plan.validation_cancelled',
            params: {},
          })
        }
        clack.log.success(i18n.t('cli.plan.validation_revised'))
      } else {
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
          const MAX_REVISION_ATTEMPTS = 3
          let revisionAttempts = 0
          let revised = withWaves
          let revalidated = validationReport

          while (revalidated.hasCritical && revisionAttempts < MAX_REVISION_ATTEMPTS) {
            revised = assignWaves(inferDependencies(autoRevisePlan(specContent, revised)))
            revalidated = validatePlan(specContent, revised)
            revisionAttempts++
          }

          finalTasks = revised
          validationReport = revalidated

          if (revalidated.hasCritical) {
            clack.log.warn(i18n.t('cli.plan.validation_issues', {
              total: String(revalidated.totalIssues),
              critical: String(revalidated.perspectives.flatMap(p => p.issues).filter(i => i.severity === 'critical').length),
            }))
          } else {
            clack.log.success(i18n.t('cli.plan.validation_revised'))
          }
        }
        // 'override' → proceed with original tasks, just log it
        if (choice === 'override') {
          clack.log.warn(i18n.t('cli.plan.validation_overridden'))
        }
      }
    }

    const planContent = buildPlanContent(specContent, research, specSlug, generatedAt, domainType)

    // Constitution enforcement — validate plan output before writing (FR-202)
    const guardResult = await guardConstitutionModification(planContent, projectDir, i18n)
    if (!guardResult.ok) return guardResult
    const enforcement = await enforceConstitutionOnOutput(planContent, projectDir, i18n)
    if (enforcement.ok && enforcement.value.hasViolations) {
      const { formatViolationWarning } = await import('../../foundation/constitution.js')
      const { readExperienceLevel } = await import('../../foundation/context.js')
      const beginnerMode = (await readExperienceLevel(projectDir)) === 'beginner'
      for (const v of enforcement.value.violations) {
        clack.log.warn(formatViolationWarning(v, beginnerMode, i18n))
      }
    }

    const waves = groupIntoWaves(finalTasks)
    const planFiles = splitWavesIfNeeded(waves)

    // Write research summary to snapshots directory (FR-601)
    const snapshotDir = join(projectDir, '.buildpact', 'snapshots', specSlug)
    await mkdir(snapshotDir, { recursive: true })
    const researchSummaryPath = join(snapshotDir, 'research-summary.md')
    const researchSummaryContent = [
      `# Research Summary — ${specSlug}`,
      '',
      `> Consolidated: ${research.consolidatedAt}`,
      '',
      '## Tech Stack',
      '',
      research.techStack.findings,
      '',
      '### Keywords',
      '',
      research.techStack.keywords.map(k => `- \`${k}\``).join('\n'),
      '',
      '## Codebase',
      '',
      research.codebase.findings,
      '',
      '### Keywords',
      '',
      research.codebase.keywords.map(k => `- \`${k}\``).join('\n'),
      '',
      '## Squad Domain',
      '',
      research.squadDomain.findings,
      '',
      '### Keywords',
      '',
      research.squadDomain.keywords.map(k => `- \`${k}\``).join('\n'),
    ].join('\n')
    await writeFile(researchSummaryPath, researchSummaryContent, 'utf-8')

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
    const writtenFiles: string[] = [researchSummaryPath, planPath, validationReportPath]
    if (planFiles.length > 1) {
      clack.log.info(
        i18n.t('cli.plan.wave_split', {
          count: String(planFiles.length),
          max: String(MAX_TASKS_PER_PLAN_FILE),
        }),
      )
      for (const fileSpec of planFiles) {
        const waveContent = buildWaveFileContent(fileSpec, research, specSlug, generatedAt, domainType)
        const wavePath = join(planDir, fileSpec.filename)
        await writeFile(wavePath, waveContent, 'utf-8')
        writtenFiles.push(wavePath)
      }
    }

    // --- Human step acknowledgement ---
    // Walk through HUMAN tasks in wave order and pause for user confirmation.
    const humanTasks = tagTasks(finalTasks, domainType).filter(t => t.executor === 'HUMAN')
    const progress = buildProgressContent(specSlug, finalTasks, generatedAt)

    for (const task of humanTasks) {
      // Skip completed tasks when resuming from previous session
      if (resumeFromProgress && existingProgress) {
        const prevEntry = existingProgress.tasks.find(e => e.taskId === task.id)
        if (prevEntry?.completed) continue
      }

      if (isCi) {
        // CI mode: auto-skip human steps, mark as pending
        ciLog('auto-skipped', 'human step acknowledgement for ' + task.title)
        continue
      }

      clack.log.warn(i18n.t('cli.plan.human_pause', { title: task.title }))
      const choice = await clack.select({
        message: i18n.t('cli.plan.human_confirm'),
        options: [
          { value: 'done', label: i18n.t('cli.plan.human_done') },
          { value: 'save_and_exit', label: i18n.t('cli.plan.human_save_exit') },
        ],
      })

      if (clack.isCancel(choice) || choice === 'save_and_exit') {
        // Save progress and exit — session can be resumed later
        const progressPath = join(planDir, 'progress.json')
        await writeFile(progressPath, JSON.stringify(progress, null, 2), 'utf-8')
        clack.log.info(i18n.t('cli.plan.progress_saved', { path: progressPath }))
        clack.outro(i18n.t('cli.plan.human_skipped', { title: task.title }))
        return ok(undefined)
      }

      if (choice === 'done') {
        const entry = progress.tasks.find(e => e.taskId === task.id)
        if (entry) {
          entry.completed = true
          entry.completedAt = new Date().toISOString()
        }
      }
    }

    // Persist progress for session resume
    const progressPath = join(planDir, 'progress.json')
    await writeFile(progressPath, JSON.stringify(progress, null, 2), 'utf-8')
    writtenFiles.push(progressPath)
    clack.log.info(i18n.t('cli.plan.progress_saved', { path: progressPath }))

    // -----------------------------------------------------------------------
    // Readiness Gate — PASS / CONCERNS / FAIL
    // -----------------------------------------------------------------------
    const gateResult = runReadinessGate(projectDir, specSlug)

    if (gateResult.decision === 'FAIL') {
      clack.log.error(i18n.t('cli.plan.readiness_fail'))
      clack.log.info(gateResult.report)
      clack.outro(i18n.t('cli.plan.readiness_fix_required'))
      return ok(undefined)
    }

    if (gateResult.decision === 'CONCERNS') {
      if (isCi) {
        ciLog('readiness-gate', 'CONCERNS -> auto-fail')
        return err({
          code: ERROR_CODES.NOT_IMPLEMENTED,
          i18nKey: 'cli.plan.readiness_fix_required',
          params: {},
        })
      }
      clack.log.warn(i18n.t('cli.plan.readiness_concerns'))
      clack.log.info(gateResult.report)
      const override = await clack.confirm({
        message: i18n.t('cli.plan.readiness_override'),
      })
      if (clack.isCancel(override) || override === false) {
        clack.outro(i18n.t('cli.plan.readiness_fix_required'))
        return ok(undefined)
      }
    }

    if (gateResult.decision === 'PASS') {
      clack.log.success(i18n.t('cli.plan.readiness_pass'))
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

/** Alias for handler — public API name used by index.ts (FR-601) */
export const planCommand = handler

// ---------------------------------------------------------------------------
// Programmatic API — planCommand(specSlug) (FR-602, Story 5.2)
// ---------------------------------------------------------------------------

/** Output produced by the programmatic planCommand API */
export interface PlanOutput {
  specSlug: string
  /** Wave plan files written to .buildpact/snapshots/specSlug/plans/ */
  planFiles: string[]
  /** Research summary path */
  researchSummaryPath: string
  /** Number of waves produced */
  waveCount: number
  /** Whether the plan passed Nyquist validation (no critical issues) */
  validationPassed: boolean
  /** Path to the Nyquist validation report file */
  validationReportPath?: string
}

/**
 * Parse spec.md content into TaskNode[] for dependency analysis.
 * Reads a `## Tasks` section with format:
 *   `- task-id: description (deps: dep-id, dep-id)`
 * Falls back to extracting from `## Acceptance Criteria` when no Tasks section found.
 * Pure function — no side effects.
 */
export function parseSpecTasks(specContent: string): TaskNode[] {
  const lines = specContent.split('\n')
  const tasks: TaskNode[] = []
  let inTasksSection = false
  let taskIdx = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+Tasks\b/i.test(trimmed)) {
      inTasksSection = true
      continue
    }
    if (inTasksSection && /^##\s/.test(trimmed)) {
      inTasksSection = false
      continue
    }
    if (inTasksSection && /^[-*]\s/.test(trimmed)) {
      // Format: `- task-id: description (deps: dep1, dep2)` or `- task-id: description (deps: none)`
      const match = /^[-*]\s+([\w-]+):\s+(.+?)(?:\s+\(deps:\s*(.+?)\))?\s*$/.exec(trimmed)
      if (match) {
        const [, id, description, rawDeps] = match
        if (!id || !description) continue
        const dependencies =
          rawDeps && rawDeps.trim() !== 'none'
            ? rawDeps.split(',').map(d => d.trim()).filter(Boolean)
            : []
        tasks.push({ id, description, dependencies })
        continue
      }
      // Fallback: plain bullet as task
      const plainTitle = trimmed.slice(2).trim()
      if (plainTitle.length > 2) {
        taskIdx++
        tasks.push({ id: `task-${taskIdx}`, description: plainTitle, dependencies: [] })
      }
    }
  }

  if (tasks.length > 0) return tasks

  // Fallback — extract from Acceptance Criteria section
  let inAcSection = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+(Acceptance Criteria|Functional Requirements|FRs?)\b/i.test(trimmed)) {
      inAcSection = true
      continue
    }
    if (inAcSection && /^##\s/.test(trimmed)) {
      inAcSection = false
      continue
    }
    if (inAcSection && /^[-*]\s/.test(trimmed)) {
      const description = trimmed.slice(2).replace(/^\[[ xX]\]\s*/, '').trim()
      if (description.length > 3) {
        taskIdx++
        tasks.push({ id: `task-${taskIdx}`, description, dependencies: [] })
      }
    }
  }

  return tasks
}

/**
 * Build the markdown content for a wave plan file.
 * Pure function — no side effects.
 */
function buildPlanFileContent(
  waveNumber: number,
  planNumber: number,
  tasks: TaskNode[],
): string {
  const waveLabel = `Wave ${waveNumber + 1} — Plan ${planNumber}`
  const taskLines = tasks
    .map(t => {
      const depsNote =
        t.dependencies.length > 0 ? `\n**Dependencies:** ${t.dependencies.join(', ')}` : '\n**Dependencies:** none'
      return `### Task: ${t.id}\n**Description:** ${t.description}${depsNote}\n**Wave:** ${waveNumber + 1} (${tasks.every(u => u.dependencies.length === 0) ? 'parallel' : 'sequential'})`
    })
    .join('\n\n')

  return [`# ${waveLabel}`, '', '## Tasks', '', taskLines, ''].join('\n')
}

/**
 * Programmatic plan command: orchestrates research → wave analysis → plan file writing.
 * Uses analyzeWaves() and splitIntoPlanFiles() from the engine layer.
 * Writes plan files to `.buildpact/snapshots/{{specSlug}}/plans/`.
 * @see FR-602 — Wave-Based Plan Generation
 * @see Story 5.2 — Task 3
 */
export async function runPlanCommand(
  specSlug: string,
  projectDir = process.cwd(),
): Promise<Result<PlanOutput, import('../../contracts/errors.js').CliError>> {
  // Step 1 — read spec.md
  const specPath = join(projectDir, '.buildpact', 'specs', specSlug, 'spec.md')
  let specContent: string
  try {
    specContent = await readFile(specPath, 'utf-8')
  } catch {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'cli.plan.spec_not_found',
      params: { path: specPath },
    })
  }

  // Step 2 — spawn research agents (FR-601)
  const research = await spawnResearchAgents(specContent, '', specSlug)

  // Write research summary
  const snapshotsDir = join(projectDir, '.buildpact', 'snapshots', specSlug)
  await mkdir(snapshotsDir, { recursive: true })
  const researchSummaryPath = join(snapshotsDir, 'research-summary.md')
  const researchSummaryContent = [
    `# Research Summary — ${specSlug}`,
    '',
    `> Consolidated: ${research.timestamp}`,
    '',
    '## Tech Stack',
    '',
    research.techStack.findings.join('\n'),
    '',
    '## Codebase',
    '',
    research.codebase.findings.join('\n'),
    '',
    '## Squad Constraints',
    '',
    research.squadConstraints.findings.join('\n'),
  ].join('\n')
  await writeFile(researchSummaryPath, researchSummaryContent, 'utf-8')

  // Step 3 — parse spec tasks → TaskNode[]
  const tasks = parseSpecTasks(specContent)

  // Step 4 — wave analysis
  const waves = analyzeWaves(tasks)

  // Step 4b — Nyquist multi-perspective validation (FR-504)
  const planTasks: PlanTask[] = tasks.map((t, idx) => ({
    id: t.id,
    title: t.description,
    dependencies: t.dependencies,
    wave: waves.findIndex(w => w.tasks.some(wt => wt.id === t.id)),
  }))

  const MAX_REVISION_ATTEMPTS = 3
  let validatedTasks = planTasks
  let validationReport: PlanValidationReport = validatePlan(specContent, validatedTasks)
  let attempts = 0

  while (validationReport.hasCritical && attempts < MAX_REVISION_ATTEMPTS) {
    validatedTasks = autoRevisePlan(specContent, validatedTasks)
    validationReport = validatePlan(specContent, validatedTasks)
    attempts++
  }

  // Write validation report to snapshots
  const validationReportPath = join(snapshotsDir, 'nyquist-report.md')
  await writeFile(validationReportPath, formatValidationReport(validationReport), 'utf-8')

  // Re-analyze waves if auto-revision changed the tasks
  const finalWaves = attempts > 0 ? analyzeWaves(validatedTasks.map(t => ({
    id: t.id,
    description: t.title,
    dependencies: t.dependencies,
  }))) : waves

  // Step 5 — split into plan files and write
  const plansDir = join(snapshotsDir, 'plans')
  await mkdir(plansDir, { recursive: true })

  const writtenFiles: string[] = []
  for (const wave of finalWaves) {
    const planFiles = splitIntoPlanFiles(wave)
    for (const planFile of planFiles) {
      const content = buildPlanFileContent(planFile.waveNumber, planFile.planNumber, planFile.tasks)
      const filePath = join(plansDir, planFile.filename)
      await writeFile(filePath, content, 'utf-8')
      writtenFiles.push(filePath)
    }
  }

  return ok({
    specSlug,
    planFiles: writtenFiles,
    researchSummaryPath,
    waveCount: finalWaves.length,
    validationPassed: !validationReport.hasCritical,
    validationReportPath,
  })
}
