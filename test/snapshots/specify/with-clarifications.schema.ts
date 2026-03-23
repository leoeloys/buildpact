/**
 * Structural schema for spec.md with ambiguity clarifications.
 * Validates that ## Clarifications section is present only when clarifications exist.
 *
 * @see Story 4.2 — Task 3
 */

export const clarificationsSchema = {
  required_section: '## Clarifications',
  required_table_headers: ['Ambiguity', 'Question', 'Answer'],
} as const

export type ClarificationsSchema = typeof clarificationsSchema
