/**
 * Unit tests for plan task tagger (Story 5.5)
 * @see AC #1 — Task Tagging by Executor
 * @see AC #3 — Non-Software Domain Detection
 * @see AC #4 — Human Step Checklist Format
 */

import { describe, it, expect } from 'vitest'
import { classifyTask, tagTasks, buildHumanChecklist } from '../../../src/commands/plan/tagger.js'
import type { PlanTask } from '../../../src/commands/plan/handler.js'

const task = (id: string, title: string): PlanTask => ({
  id,
  title,
  dependencies: [],
  wave: 0,
})

describe('classifyTask', () => {
  it('returns HUMAN for tasks with review keyword', () => {
    expect(classifyTask('Review the patient brochure')).toBe('HUMAN')
  })

  it('returns HUMAN for tasks with approve keyword', () => {
    expect(classifyTask('Approve the final draft')).toBe('HUMAN')
  })

  it('returns HUMAN for tasks with coordinate keyword', () => {
    expect(classifyTask('Coordinate with legal team')).toBe('HUMAN')
  })

  it('returns HUMAN case-insensitively', () => {
    expect(classifyTask('REVIEW the document')).toBe('HUMAN')
  })

  it('returns AGENT for implementation tasks', () => {
    expect(classifyTask('Implement authentication module')).toBe('AGENT')
  })

  it('returns AGENT for tasks with no human keywords', () => {
    expect(classifyTask('Run automated tests')).toBe('AGENT')
  })
})

describe('tagTasks', () => {
  const tasks = [
    task('t1', 'Generate brochure draft'),
    task('t2', 'Review brochure for accuracy'),
    task('t3', 'Deploy to staging'),
  ]

  it('tags all tasks as AGENT for software domain', () => {
    const tagged = tagTasks(tasks, 'software')
    expect(tagged.every(t => t.executor === 'AGENT')).toBe(true)
    expect(tagged.some(t => t.checklistItems !== undefined)).toBe(false)
  })

  it('applies keyword heuristics for medical domain', () => {
    const tagged = tagTasks(tasks, 'medical')
    expect(tagged[0].executor).toBe('AGENT') // Generate
    expect(tagged[1].executor).toBe('HUMAN') // Review
    expect(tagged[2].executor).toBe('AGENT') // Deploy
  })

  it('adds checklistItems to HUMAN tasks in non-software domain', () => {
    const tagged = tagTasks(tasks, 'medical')
    const humanTask = tagged.find(t => t.executor === 'HUMAN')
    expect(humanTask?.checklistItems).toBeDefined()
    expect(humanTask!.checklistItems!.length).toBeGreaterThanOrEqual(3)
  })

  it('does not add checklistItems to AGENT tasks', () => {
    const tagged = tagTasks(tasks, 'research')
    const agentTasks = tagged.filter(t => t.executor === 'AGENT')
    for (const t of agentTasks) {
      expect(t.checklistItems).toBeUndefined()
    }
  })

  it('treats custom domain as non-software', () => {
    const tagged = tagTasks([task('t1', 'Review document')], 'custom')
    expect(tagged[0].executor).toBe('HUMAN')
  })
})

describe('buildHumanChecklist', () => {
  it('returns 3-4 checklist items', () => {
    const items = buildHumanChecklist(task('t1', 'Review and approve brochure'))
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.length).toBeLessThanOrEqual(4)
  })

  it('includes task title in first item', () => {
    const items = buildHumanChecklist(task('t1', 'Verify compliance'))
    expect(items[0]).toContain('Verify compliance')
  })

  it('includes sign-off item', () => {
    const items = buildHumanChecklist(task('t1', 'Any task'))
    expect(items.some(i => i.toLowerCase().includes('sign off'))).toBe(true)
  })
})
