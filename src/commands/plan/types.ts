/**
 * Public types for the plan command's research phase.
 * These types are part of the canonical public API for the plan module.
 * @see FR-601 — Automated Parallel Research Before Planning
 */

/** Domain investigated by a research agent */
export type ResearchDomain = 'tech-stack' | 'codebase' | 'squad-constraints'

/** Findings returned by a completed research agent */
export interface ResearchResult {
  /** The research domain this result covers */
  domain: ResearchDomain
  /** Key findings from the research investigation */
  findings: string[]
  /** Relevant patterns, libraries, or conventions discovered */
  relevantPatterns: string[]
}

/** Consolidated summary from all parallel research agents */
export interface ResearchSummary {
  /** Slug of the spec that was researched */
  specSlug: string
  /** ISO 8601 timestamp when the summary was consolidated */
  timestamp: string
  /** Technology stack research findings */
  techStack: ResearchResult
  /** Existing codebase research findings */
  codebase: ResearchResult
  /** Squad domain constraints research findings */
  squadConstraints: ResearchResult
}
