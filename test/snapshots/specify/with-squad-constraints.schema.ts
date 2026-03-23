/**
 * Structural schema for spec.md with Squad domain constraints.
 * Validates that ## Domain Constraints section is present only when a Squad is active.
 *
 * @see Story 4.3 — Task 3
 */

export const squadConstraintsSchema = {
  squad_section: '## Domain Constraints',
  required_table_headers: ['Constraint', 'Question', 'Answer'],
  squad_metadata: ['Squad:', '(domain:'],
} as const

export type SquadConstraintsSchema = typeof squadConstraintsSchema
