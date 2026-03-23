/**
 * Parallel research orchestration for the plan pipeline.
 * Spawns 3 isolated research agents (tech stack, codebase, squad constraints)
 * before plan generation to ground the plan in real context.
 * @see FR-601 — Automated Parallel Research Before Planning
 * @see FR-604 — Subagent Isolation (each agent uses TaskDispatchPayload with clean context)
 */

import { buildTaskPayload } from '../../engine/subagent.js'
import type { ResearchResult, ResearchSummary } from './types.js'

// ---------------------------------------------------------------------------
// Isolated payload builders (one per research domain)
// ---------------------------------------------------------------------------

function buildTechStackPayload(spec: string): void {
  // Payload is prepared for Task() dispatch — in Alpha, research runs in-process
  buildTaskPayload({
    type: 'plan',
    content: [
      '# Research Task: tech-stack',
      '',
      'Analyse the spec below. Identify the technology stack, programming languages,',
      'frameworks, and infrastructure required. List your findings concisely.',
      '',
      '---',
      '',
      '## Spec',
      '',
      spec,
    ].join('\n'),
  })
}

function buildCodebasePayload(spec: string): void {
  buildTaskPayload({
    type: 'plan',
    content: [
      '# Research Task: codebase',
      '',
      'Analyse the spec below. Review the existing codebase structure, relevant modules,',
      'and integration points. Identify what files and patterns are relevant to implementing this spec.',
      '',
      '---',
      '',
      '## Spec',
      '',
      spec,
    ].join('\n'),
  })
}

function buildSquadConstraintsPayload(spec: string, squadContext: string): void {
  buildTaskPayload({
    type: 'plan',
    content: [
      '# Research Task: squad-constraints',
      '',
      'Analyse the spec and squad context below. Extract domain-specific constraints,',
      'compliance requirements, and domain rules that must be respected during planning.',
      '',
      '---',
      '',
      '## Spec',
      '',
      spec,
      '',
      '## Squad Context',
      '',
      squadContext,
    ].join('\n'),
    // Squad context is the only inter-agent data — it is scoped here, not shared globally
    ...(squadContext ? { context: squadContext } : {}),
  })
}

// ---------------------------------------------------------------------------
// Research agent stubs — production replacements dispatch via Task()
// ---------------------------------------------------------------------------

/**
 * Research the technology stack required for the spec.
 * Each call builds an isolated TaskDispatchPayload (AC #4 — clean context per agent).
 * In Alpha: returns structured stub findings derived from spec content.
 */
export async function researchTechStack(spec: string): Promise<ResearchResult> {
  buildTechStackPayload(spec)
  const firstLine = spec.split('\n').find(l => l.trim().length > 0) ?? 'Unknown feature'
  return {
    domain: 'tech-stack',
    findings: [
      `Stack inferred for: ${firstLine}`,
      'Language: TypeScript (project standard)',
      'Frameworks: Node.js / ESM modules',
      'Build: tsdown + Vitest',
      'Confirm deployment target before planning infrastructure tasks',
    ],
    relevantPatterns: ['TypeScript', 'Node.js', 'ESM', 'tsdown', 'Vitest'],
  }
}

/**
 * Research the existing codebase structure relevant to the spec.
 * Each call builds an isolated TaskDispatchPayload (AC #4).
 * In Alpha: returns structured stub findings.
 */
export async function researchCodebase(spec: string): Promise<ResearchResult> {
  buildCodebasePayload(spec)
  const firstLine = spec.split('\n').find(l => l.trim().length > 0) ?? 'Unknown feature'
  return {
    domain: 'codebase',
    findings: [
      `Codebase context for: ${firstLine}`,
      'Layer structure: contracts → foundation → engine → commands → cli',
      'Pattern: Result<T, CliError> for all fallible functions',
      'I18n: all user strings via I18nResolver.t()',
      'Audit: AuditLogger for write operations',
      'Tests: Vitest 4.x, factory function pattern',
    ],
    relevantPatterns: ['contracts', 'foundation', 'engine', 'commands', 'Result', 'I18nResolver', 'AuditLogger'],
  }
}

/**
 * Research squad domain constraints applicable to the spec.
 * Includes squad context in an isolated payload — no other agent shares this context.
 * In Alpha: returns structured stub findings.
 */
export async function researchSquadConstraints(
  spec: string,
  squadContext: string,
): Promise<ResearchResult> {
  buildSquadConstraintsPayload(spec, squadContext)
  const firstLine = spec.split('\n').find(l => l.trim().length > 0) ?? 'Unknown feature'
  return {
    domain: 'squad-constraints',
    findings: [
      `Domain constraints for: ${firstLine}`,
      squadContext
        ? `Squad context: ${squadContext.split('\n')[0] ?? 'Active squad configured'}`
        : 'No active squad configured — using default domain rules',
      'Enforce project Constitution if present',
      'Validate payloads ≤20KB before dispatch',
      'All artifacts saved to .buildpact/ hierarchy',
    ],
    relevantPatterns: ['Constitution', 'Squad', '.buildpact', 'payload'],
  }
}

// ---------------------------------------------------------------------------
// Consolidation
// ---------------------------------------------------------------------------

/**
 * Consolidate an array of ResearchResult into a unified ResearchSummary.
 * Expects results for all 3 domains — uses empty fallback if any domain is missing.
 * Pure function — no side effects.
 */
export function consolidateResearch(results: ResearchResult[], specSlug = ''): ResearchSummary {
  const techStack = results.find(r => r.domain === 'tech-stack') ?? {
    domain: 'tech-stack' as const,
    findings: [],
    relevantPatterns: [],
  }
  const codebase = results.find(r => r.domain === 'codebase') ?? {
    domain: 'codebase' as const,
    findings: [],
    relevantPatterns: [],
  }
  const squadConstraints = results.find(r => r.domain === 'squad-constraints') ?? {
    domain: 'squad-constraints' as const,
    findings: [],
    relevantPatterns: [],
  }

  return {
    specSlug,
    timestamp: new Date().toISOString(),
    techStack,
    codebase,
    squadConstraints,
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Spawn 3 parallel research agents to investigate tech stack, codebase, and squad constraints.
 * Each agent uses an isolated TaskDispatchPayload with clean, scoped context (AC #4).
 * Agents run concurrently via Promise.all — results are consolidated into a ResearchSummary.
 *
 * @param spec - Full spec content to research
 * @param squadContext - Active squad guidance content (empty string if no squad active)
 * @returns Consolidated research summary with findings from all 3 domains
 * @see FR-601 — Automated Parallel Research Before Planning
 */
export async function spawnResearchAgents(
  spec: string,
  squadContext: string,
  specSlug = '',
): Promise<ResearchSummary> {
  const [techStack, codebase, squadConstraints] = await Promise.all([
    researchTechStack(spec),
    researchCodebase(spec),
    researchSquadConstraints(spec, squadContext),
  ])

  return consolidateResearch([techStack, codebase, squadConstraints], specSlug)
}
