/**
 * Snapshot schema tests for Story 4.4: Automation Maturity Assessment
 * Validates that:
 *  1. ## Automation Maturity Assessment is present when maturityAssessment provided
 *  2. Override note appears only when isOverride === true
 *  3. ## Automation Maturity Assessment is absent when maturityAssessment not provided
 *  4. scoreMaturity() edge cases: score=0→Stage1, score=9→Stage5
 */
import { describe, it, expect } from 'vitest'
import { maturitySchema } from './with-maturity.schema.js'

describe('buildSpecContent — Automation Maturity Assessment section (Story 4.4, AC #2, #3)', () => {
  it('contains ## Automation Maturity Assessment with stage and justification', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Automate daily database backup',
      constitutionPath: undefined,
      payload: { taskId: 'task-030', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'automate-daily-backup',
      maturityAssessment: {
        stage: 3,
        name: 'Alias',
        score: 5,
        justification: 'This task runs weekly or less, steps are always identical, and requires only minor decisions (score: 5/9). Create a named script or alias — suitable for repetitive terminal workflows.',
        isOverride: false,
      },
    })

    expect(spec).toContain(maturitySchema.maturity_section)
    for (const content of maturitySchema.required_content) {
      expect(spec, `Missing: ${content}`).toContain(content)
    }
    expect(spec).toContain('Alias')
    expect(spec).toContain('score: 5/9')
  })

  it('contains override note when isOverride is true (AC #3)', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Run weekly report generation',
      constitutionPath: undefined,
      payload: { taskId: 'task-031', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'weekly-report',
      maturityAssessment: {
        stage: 5,
        name: 'Full Automation',
        score: 9,
        justification: 'This task runs multiple times daily, steps are always identical, and requires no human decisions (score: 9/9). Fully automate with CI/CD or scheduled job.',
        isOverride: true,
        originalStage: 2,
      },
    })

    expect(spec).toContain(maturitySchema.maturity_section)
    expect(spec).toContain(maturitySchema.override_marker)
    expect(spec).toContain('Stage 2')
  })

  it('does NOT contain override note when isOverride is false', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Run weekly report generation',
      constitutionPath: undefined,
      payload: { taskId: 'task-032', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'weekly-report',
      maturityAssessment: {
        stage: 3,
        name: 'Alias',
        score: 5,
        justification: '...',
        isOverride: false,
      },
    })

    expect(spec).toContain(maturitySchema.maturity_section)
    expect(spec).not.toContain(maturitySchema.override_marker)
  })

  it('does NOT contain ## Automation Maturity Assessment when field is omitted', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add a search feature',
      constitutionPath: undefined,
      payload: { taskId: 'task-033', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'search-feature',
    })

    expect(spec).not.toContain(maturitySchema.maturity_section)
  })
})

describe('scoreMaturity — edge cases (Story 4.4, AC #4, #5)', () => {
  it('score=0 → Stage 1 (Manual) — no over-engineering for ad hoc tasks', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    const result = scoreMaturity({
      frequency: 'rarely',
      predictability: 'highly_variable',
      humanDecisions: 'complex_expertise',
    })
    expect(result.stage).toBe(1)
    expect(result.name).toBe('Manual')
    expect(result.score).toBe(0)
  })

  it('score=9 → Stage 5 (Full Automation) — routine tasks deserve automation', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    const result = scoreMaturity({
      frequency: 'multiple_daily',
      predictability: 'always_same',
      humanDecisions: 'none_needed',
    })
    expect(result.stage).toBe(5)
    expect(result.name).toBe('Full Automation')
    expect(result.score).toBe(9)
  })

  it('score=4 → Stage 3 (Alias) — boundary check', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    // frequency=daily(2) + predictability=varies(1) + humanDecisions=minor(2) = 5 → Stage 3
    const result = scoreMaturity({
      frequency: 'daily',
      predictability: 'varies',
      humanDecisions: 'minor',
    })
    expect(result.stage).toBe(3)
    expect(result.score).toBe(5)
  })

  it('score=1 → Stage 1 boundary', async () => {
    const { scoreMaturity } = await import('../../../src/commands/specify/handler.js')
    // rarely(0) + mostly_predictable(2) + complex_expertise(0) = 2 → Stage 2, not 1
    // Use: rarely(0) + highly_variable(0) + minor(2) = 2 → Stage 2
    // For score=1: rarely(0) + highly_variable(0) + significant(1) = 1 → Stage 1
    const result = scoreMaturity({
      frequency: 'rarely',
      predictability: 'highly_variable',
      humanDecisions: 'significant',
    })
    expect(result.stage).toBe(1)
    expect(result.score).toBe(1)
  })
})
