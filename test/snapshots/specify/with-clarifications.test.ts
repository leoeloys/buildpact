/**
 * Snapshot schema tests for Story 4.2: Ambiguity Detection and Clarification Flow
 * Validates that:
 *  1. ## Clarifications section is present when clarifications exist
 *  2. ## Clarifications section is absent when no clarifications
 *  3. Clarifications table has correct headers
 */
import { describe, it, expect } from 'vitest'
import { clarificationsSchema } from './with-clarifications.schema.js'

describe('buildSpecContent — clarifications section (Story 4.2, AC #4)', () => {
  it('contains ## Clarifications table when clarifications are provided', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Load the dashboard quickly',
      constitutionPath: undefined,
      payload: { taskId: 'task-010', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'load-dashboard',
      clarifications: [
        {
          phrase: 'quickly',
          question: 'How quickly should this happen?',
          answer: 'Under 1 second',
        },
      ],
    })

    expect(spec).toContain(clarificationsSchema.required_section)
    for (const header of clarificationsSchema.required_table_headers) {
      expect(spec, `Missing table header: ${header}`).toContain(header)
    }
    expect(spec).toContain('quickly')
    expect(spec).toContain('Under 1 second')
  })

  it('contains multiple clarification rows when multiple ambiguities resolved', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Build a fast and secure login',
      constitutionPath: undefined,
      payload: { taskId: 'task-011', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'fast-secure-login',
      clarifications: [
        { phrase: 'fast', question: 'What does "fast" mean here?', answer: 'Under 1 second' },
        { phrase: 'secure', question: 'What security level?', answer: 'MFA required' },
      ],
    })

    expect(spec).toContain(clarificationsSchema.required_section)
    expect(spec).toContain('fast')
    expect(spec).toContain('secure')
    expect(spec).toContain('MFA required')
  })

  it('does NOT contain ## Clarifications when clarifications is empty array (AC #3)', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add email password reset',
      constitutionPath: undefined,
      payload: { taskId: 'task-012', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'email-password-reset',
      clarifications: [],
    })

    expect(spec).not.toContain(clarificationsSchema.required_section)
  })

  it('does NOT contain ## Clarifications when clarifications field is omitted', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add email password reset',
      constitutionPath: undefined,
      payload: { taskId: 'task-013', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'email-password-reset',
    })

    expect(spec).not.toContain(clarificationsSchema.required_section)
  })
})

describe('detectAmbiguities — AC #1 and AC #3', () => {
  it('returns matching patterns with ≥3 options each for known ambiguous phrases', async () => {
    const { detectAmbiguities } = await import('../../../src/commands/specify/handler.js')

    const result = detectAmbiguities('Load the page quickly and make it secure')
    expect(result.length).toBeGreaterThanOrEqual(2)

    for (const ambiguity of result) {
      expect(ambiguity.options.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('returns empty array when no ambiguous phrases found (AC #3)', async () => {
    const { detectAmbiguities } = await import('../../../src/commands/specify/handler.js')

    const result = detectAmbiguities('Users can reset their password via email within 5 minutes')
    expect(result).toEqual([])
  })
})
