/**
 * Snapshot schema tests for Story 4.3: Domain-Aware Specification with Squad Integration
 * Validates that:
 *  1. ## Domain Constraints section is present with Squad metadata and table when Squad active
 *  2. ## Domain Constraints section is absent when no active Squad
 *  3. getSquadQuestions() returns ≥3 questions for each of the 4 supported domains
 */
import { describe, it, expect } from 'vitest'
import { squadConstraintsSchema } from './with-squad-constraints.schema.js'

describe('buildSpecContent — Domain Constraints section (Story 4.3, AC #1, #4)', () => {
  it('contains ## Domain Constraints with Squad metadata when Squad active', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add user authentication',
      constitutionPath: undefined,
      payload: { taskId: 'task-020', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'user-authentication',
      squadConstraints: {
        squadName: 'Software Squad',
        domain: 'software',
        answers: [
          { key: 'tech_stack', question: 'What is the primary technology stack?', answer: 'Full-stack (Next.js / Nuxt)' },
          { key: 'quality_standards', question: 'What quality standards apply?', answer: 'Unit tests required (≥80% coverage)' },
          { key: 'deployment_target', question: 'What is the deployment target?', answer: 'Cloud (AWS / GCP / Azure)' },
        ],
      },
    })

    expect(spec).toContain(squadConstraintsSchema.squad_section)
    for (const header of squadConstraintsSchema.required_table_headers) {
      expect(spec, `Missing table header: ${header}`).toContain(header)
    }
    for (const meta of squadConstraintsSchema.squad_metadata) {
      expect(spec, `Missing Squad metadata: ${meta}`).toContain(meta)
    }
    expect(spec).toContain('Software Squad')
    expect(spec).toContain('software')
  })

  it('does NOT contain ## Domain Constraints when squadConstraints is undefined (AC #4)', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add user authentication',
      constitutionPath: undefined,
      payload: { taskId: 'task-021', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'user-authentication',
    })

    expect(spec).not.toContain(squadConstraintsSchema.squad_section)
  })

  it('does NOT contain ## Domain Constraints when squadConstraints has empty answers', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add user authentication',
      constitutionPath: undefined,
      payload: { taskId: 'task-022', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'user-authentication',
      squadConstraints: {
        squadName: 'Software Squad',
        domain: 'software',
        answers: [],
      },
    })

    expect(spec).not.toContain(squadConstraintsSchema.squad_section)
  })
})

describe('getSquadQuestions — 4 domain coverage (Story 4.3, AC #2)', () => {
  it('returns ≥3 questions for software domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('software')
    expect(questions.length).toBeGreaterThanOrEqual(3)
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('returns ≥3 questions for marketing domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('marketing')
    expect(questions.length).toBeGreaterThanOrEqual(3)
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('returns ≥3 questions for health domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('health')
    expect(questions.length).toBeGreaterThanOrEqual(3)
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('returns ≥3 questions for research domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('research')
    expect(questions.length).toBeGreaterThanOrEqual(3)
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('returns empty array for unknown domain', async () => {
    const { getSquadQuestions } = await import('../../../src/commands/specify/handler.js')
    const questions = getSquadQuestions('UNKNOWN_DOMAIN')
    expect(questions).toEqual([])
  })
})
