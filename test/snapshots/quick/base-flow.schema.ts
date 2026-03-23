/**
 * Structural schema for the quick orchestrator template.
 * Validates that templates/commands/quick.md contains all required sections
 * and the mandatory orchestrator header.
 *
 * @see Story 3.1 — Task 5.2
 */

export const BASE_FLOW_SCHEMA = {
  required_header: 'ORCHESTRATOR: quick',
  required_sections: [
    'Quick Spec',
    'Constitution Validation',
    'Execution',
    'Commit',
    'Implementation Notes',
  ],
  max_lines: 300,
} as const

export type BaseFlowSchema = typeof BASE_FLOW_SCHEMA
