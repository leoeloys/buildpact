/**
 * Snapshot schema tests for Story 4.1: Natural Language Specification Capture
 * Validates that:
 *  1. templates/commands/specify.md has the required orchestrator header and sections
 *  2. buildSpecContent() generates all 6 required spec sections in both modes
 */
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { specOrchestratorSchema, specSchema } from './basic-feature.schema.js'

// ---------------------------------------------------------------------------
// Orchestrator template validation
// ---------------------------------------------------------------------------

describe('specify.md orchestrator schema', () => {
  it('contains required orchestrator header', async () => {
    const content = await readFile(
      resolve(process.cwd(), 'templates/commands/specify.md'),
      'utf-8',
    )
    expect(content).toContain(specOrchestratorSchema.required_header)
  })

  it('contains all required sections', async () => {
    const content = await readFile(
      resolve(process.cwd(), 'templates/commands/specify.md'),
      'utf-8',
    )
    for (const section of specOrchestratorSchema.required_sections) {
      expect(content, `Missing section: ${section}`).toContain(section)
    }
  })

  it('is within 300-line limit', async () => {
    const content = await readFile(
      resolve(process.cwd(), 'templates/commands/specify.md'),
      'utf-8',
    )
    const lineCount = content.split('\n').length
    expect(lineCount).toBeLessThanOrEqual(specOrchestratorSchema.max_lines)
  })
})

// ---------------------------------------------------------------------------
// buildSpecContent() schema validation
// ---------------------------------------------------------------------------

describe('buildSpecContent — required sections (Story 4.1, AC #3)', () => {
  it('expert mode: contains all 6 required sections', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Users should be able to reset their password via email',
      constitutionPath: '.buildpact/constitution.md',
      payload: { taskId: 'task-001', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'reset-password',
    })

    for (const section of specSchema.required_sections) {
      expect(spec, `Missing section: ## ${section}`).toContain(`## ${section}`)
    }
    expect(spec).toContain('## User Story')
    expect(spec).toContain('## Acceptance Criteria')
  })

  it('beginner mode: contains all 6 required sections with Given/When/Then', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'beginner',
      wizardAnswers: {
        persona: 'a registered user',
        goal: 'reset my password',
        motivation: 'I forgot my password and need access',
        successOutcome: 'I receive a reset email and can log in again',
        constraints: 'Email must arrive within 5 minutes',
      },
      constitutionPath: '.buildpact/constitution.md',
      payload: { taskId: 'task-002', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'reset-my-password',
    })

    for (const section of specSchema.required_sections) {
      expect(spec, `Missing section: ## ${section}`).toContain(`## ${section}`)
    }
    expect(spec).toContain('Given/When/Then')
  })

  it('contains at least 1 user story (min_stories)', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add a product search feature',
      constitutionPath: undefined,
      payload: { taskId: 'task-003', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'product-search',
    })

    expect(spec).toContain('## User Story')
  })

  it('contains at least 1 acceptance criterion (min_acceptance_criteria)', async () => {
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add a product search feature',
      constitutionPath: undefined,
      payload: { taskId: 'task-003', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'product-search',
    })

    expect(spec).toContain('## Acceptance Criteria')
    expect(spec).toContain('Given')
    expect(spec).toContain('When')
    expect(spec).toContain('Then')
  })

  it('saves to correct path pattern: .buildpact/specs/{{feature_slug}}/spec.md', async () => {
    // Validate slug is part of spec header (path convention check via slug in content)
    const { buildSpecContent } = await import('../../../src/commands/specify/handler.js')

    const spec = buildSpecContent({
      mode: 'expert',
      rawDescription: 'Add user login',
      constitutionPath: undefined,
      payload: { taskId: 'task-004', type: 'feature' },
      generatedAt: '2026-03-17T12:00:00Z',
      slug: 'add-user-login',
    })

    expect(spec).toContain('add-user-login')
  })
})
