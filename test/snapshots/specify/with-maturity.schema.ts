/**
 * Structural schema for spec.md with Automation Maturity Assessment.
 * Validates that ## Automation Maturity Assessment section is present/absent correctly.
 *
 * @see Story 4.4 — Task 3
 */

export const maturitySchema = {
  maturity_section: '## Automation Maturity Assessment',
  required_content: ['Recommended Stage', 'Justification'],
  override_marker: '> **Override applied**',
} as const

export type MaturitySchema = typeof maturitySchema
