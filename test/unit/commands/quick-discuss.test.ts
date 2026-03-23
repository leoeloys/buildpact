import { describe, it, expect } from 'vitest'
import { generateDiscussQuestions, buildRefinedSpec } from '../../../src/commands/quick/discuss-flow.js'
import type { QuickAnswer } from '../../../src/commands/quick/discuss-flow.js'

// ---------------------------------------------------------------------------
// generateDiscussQuestions
// ---------------------------------------------------------------------------

describe('generateDiscussQuestions', () => {
  it('returns 3–5 questions for a general description', () => {
    const questions = generateDiscussQuestions('add rate limiting to the API')
    expect(questions.length).toBeGreaterThanOrEqual(3)
    expect(questions.length).toBeLessThanOrEqual(5)
  })

  it('returns 3–5 questions for a fix description', () => {
    const questions = generateDiscussQuestions('fix null pointer in login')
    expect(questions.length).toBeGreaterThanOrEqual(3)
    expect(questions.length).toBeLessThanOrEqual(5)
  })

  it('every question has "Other (free text)" as the last option', () => {
    const questions = generateDiscussQuestions('add rate limiting to the API')
    for (const q of questions) {
      expect(q.options.at(-1)).toBe('Other (free text)')
    }
  })

  it('reduces to exactly 3 questions when description has ≥3 technical terms', () => {
    const questions = generateDiscussQuestions(
      'migrate users table with soft delete column and rollback migration script',
    )
    expect(questions).toHaveLength(3)
  })

  it('returns 5 questions when description has fewer than 3 technical terms', () => {
    const questions = generateDiscussQuestions('make the page look nicer')
    expect(questions).toHaveLength(5)
  })

  it('each question has at least 2 specific options plus Other', () => {
    const questions = generateDiscussQuestions('update the dashboard')
    for (const q of questions) {
      // At least 2 specific options + "Other (free text)"
      expect(q.options.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('questions cover scope, approach, constraints dimensions', () => {
    const questions = generateDiscussQuestions('add search feature')
    expect(questions[0].text).toContain('scope')
    expect(questions[1].text).toContain('approach')
    expect(questions[2].text).toContain('constraints')
  })
})

// ---------------------------------------------------------------------------
// buildRefinedSpec
// ---------------------------------------------------------------------------

describe('buildRefinedSpec', () => {
  it('returns string containing "## Quick Spec" and bullet points', () => {
    const answers: QuickAnswer[] = [
      { questionIndex: 0, selectedOption: 'This module only' },
      { questionIndex: 1, selectedOption: 'Minimal change' },
      { questionIndex: 2, selectedOption: 'No breaking changes' },
    ]
    const spec = buildRefinedSpec('add rate limiting', answers)
    expect(spec).toContain('## Quick Spec')
    expect(spec).toContain('add rate limiting')
    expect(spec).toContain('This module only')
    expect(spec).toContain('Minimal change')
    expect(spec).toContain('No breaking changes')
  })

  it('returns non-empty string that falls back to description when answers is empty', () => {
    const spec = buildRefinedSpec('task', [])
    expect(spec).toBeTruthy()
    expect(spec.length).toBeGreaterThan(0)
    expect(spec).toContain('## Quick Spec')
    expect(spec).toContain('task')
  })

  it('uses freeText when provided in answer', () => {
    const answers: QuickAnswer[] = [
      { questionIndex: 0, selectedOption: 'Other (free text)', freeText: 'Shared utility library' },
    ]
    const spec = buildRefinedSpec('update utils', answers)
    expect(spec).toContain('Shared utility library')
  })

  it('includes goal description in the spec', () => {
    const answers: QuickAnswer[] = [
      { questionIndex: 0, selectedOption: 'Entire system' },
    ]
    const spec = buildRefinedSpec('refactor auth module', answers)
    expect(spec).toContain('refactor auth module')
  })
})
