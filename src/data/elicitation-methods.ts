/**
 * Elicitation Methods — catalog of requirement-gathering techniques.
 * Used by the clarify/specify phase to recommend methods based on project type and complexity.
 * @module data/elicitation-methods
 * @see BuildPact concept 10.5
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A requirement elicitation technique */
export interface ElicitationMethod {
  id: string
  name: string
  description: string
  bestFor: string
}

// ---------------------------------------------------------------------------
// Method catalog — 15 industry-standard techniques
// ---------------------------------------------------------------------------

export const ELICITATION_METHODS: readonly ElicitationMethod[] = [
  { id: 'interview', name: 'Stakeholder Interview', description: 'One-on-one structured conversations with key stakeholders to elicit requirements, constraints, and priorities.', bestFor: 'complex,enterprise,greenfield' },
  { id: 'survey', name: 'Survey / Questionnaire', description: 'Standardized questions distributed to a broad audience for quantitative requirement validation.', bestFor: 'saas,consumer,validation' },
  { id: 'workshop', name: 'Requirements Workshop', description: 'Facilitated group sessions where stakeholders collaboratively define and prioritize requirements.', bestFor: 'complex,enterprise,cross-team' },
  { id: 'prototyping', name: 'Prototyping', description: 'Build quick throwaway or evolutionary prototypes to validate assumptions and discover hidden requirements.', bestFor: 'consumer,startup,ui-heavy' },
  { id: 'persona', name: 'Persona Development', description: 'Create fictional user archetypes representing key user segments to guide requirement decisions.', bestFor: 'consumer,saas,ux-focused' },
  { id: 'journey-map', name: 'User Journey Mapping', description: 'Map end-to-end user workflows to identify touchpoints, pain points, and requirement gaps.', bestFor: 'consumer,saas,ux-focused' },
  { id: 'card-sort', name: 'Card Sorting', description: 'Users organize topics into categories to inform information architecture and navigation.', bestFor: 'consumer,content-heavy,ux-focused' },
  { id: 'contextual-inquiry', name: 'Contextual Inquiry', description: 'Observe users in their actual work environment to understand real workflows and implicit requirements.', bestFor: 'enterprise,complex,domain-specific' },
  { id: 'competitive-analysis', name: 'Competitive Analysis', description: 'Analyze competing products to identify baseline features, differentiators, and market expectations.', bestFor: 'startup,saas,greenfield' },
  { id: 'domain-analysis', name: 'Domain Analysis', description: 'Study the problem domain, standards, regulations, and existing processes to extract requirements.', bestFor: 'enterprise,complex,regulated' },
  { id: 'storyboard', name: 'Storyboarding', description: 'Visual narratives showing how users interact with the system in context to validate flow requirements.', bestFor: 'consumer,ui-heavy,startup' },
  { id: 'scenario', name: 'Scenario Analysis', description: 'Detailed step-by-step narratives of how users accomplish goals, including exception paths.', bestFor: 'complex,enterprise,api' },
  { id: 'use-case', name: 'Use Case Modeling', description: 'Formal actor-system interaction descriptions with preconditions, postconditions, and alternative flows.', bestFor: 'enterprise,complex,api' },
  { id: 'focus-group', name: 'Focus Group', description: 'Moderated group discussions to gather diverse perspectives and surface conflicting requirements.', bestFor: 'consumer,validation,saas' },
  { id: 'heuristic-evaluation', name: 'Heuristic Evaluation', description: 'Expert evaluation of existing systems against established usability heuristics to find improvement areas.', bestFor: 'consumer,ux-focused,validation' },
] as const

// ---------------------------------------------------------------------------
// Selection logic
// ---------------------------------------------------------------------------

/** Project type tags for matching */
const PROJECT_TYPE_TAGS: Record<string, string[]> = {
  saas: ['saas', 'consumer', 'ux-focused'],
  enterprise: ['enterprise', 'complex', 'cross-team'],
  api: ['api', 'complex', 'enterprise'],
  consumer: ['consumer', 'ux-focused', 'ui-heavy'],
  startup: ['startup', 'greenfield', 'saas'],
  internal: ['enterprise', 'domain-specific', 'cross-team'],
}

/** Complexity boosts certain methods */
const COMPLEXITY_BOOSTS: Record<string, string[]> = {
  low: ['survey', 'competitive-analysis', 'prototyping'],
  medium: ['interview', 'scenario', 'journey-map', 'persona'],
  high: ['workshop', 'contextual-inquiry', 'domain-analysis', 'use-case', 'focus-group'],
}

/**
 * Select top 5 elicitation methods based on project type and complexity.
 * Scores each method by tag overlap with project context.
 */
export function selectMethods(projectType: string, complexity: string): ElicitationMethod[] {
  const tags = PROJECT_TYPE_TAGS[projectType] ?? ['complex']
  const boosts = COMPLEXITY_BOOSTS[complexity] ?? []

  const scored = ELICITATION_METHODS.map(method => {
    const bestForTags = method.bestFor.split(',')
    let score = 0

    // Score by tag overlap
    for (const tag of tags) {
      if (bestForTags.includes(tag)) score += 2
    }

    // Boost for complexity match
    if (boosts.includes(method.id)) score += 3

    return { method, score }
  })

  // Sort descending by score, take top 5
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 5).map(s => ({ ...s.method }))
}
