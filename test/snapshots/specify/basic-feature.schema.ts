/**
 * Structural schema for the specify orchestrator template and generated spec.md.
 * Validates that templates/commands/specify.md contains all required sections
 * and the mandatory orchestrator header.
 * Also validates that buildSpecContent() produces all required spec sections.
 *
 * @see Story 4.1 — Task 2
 */

export const specOrchestratorSchema = {
  required_header: 'ORCHESTRATOR: specify',
  required_sections: [
    'Description Parsing',
    'Beginner Mode',
    'Expert Mode',
    'Ambiguity Detection',
    'Squad Domain Questions',
    'Automation Maturity Assessment',
    'Spec Generation',
    'Constitution Validation',
    'File Output',
    'Implementation Notes',
  ],
  max_lines: 300,
} as const

export const specSchema = {
  required_sections: [
    'User Story',
    'Acceptance Criteria',
    'Functional Requirements',
    'Non-Functional Requirements',
    'Assumptions',
    'Constitution Self-Assessment',
  ],
  frontmatter_fields: ['feature', 'created_at', 'squad', 'status'],
  min_stories: 1,
  min_acceptance_criteria: 1,
} as const

export type SpecOrchestratorSchema = typeof specOrchestratorSchema
export type SpecSchema = typeof specSchema
