import { describe, it, expect } from 'vitest'
import {
  generateMinimalPlan,
  validatePlanCompleteness,
  validatePlanDependencies,
  generateFixPlan,
} from '../../../src/commands/quick/plan-verifier.js'
import type { PlanStep } from '../../../src/commands/quick/plan-verifier.js'

// ---------------------------------------------------------------------------
// generateMinimalPlan
// ---------------------------------------------------------------------------

describe('generateMinimalPlan', () => {
  it('returns 2–3 steps for a simple spec (≤3 bullets)', () => {
    const plan = generateMinimalPlan('add soft delete', '- add column\n- update queries')
    expect(plan.length).toBeGreaterThanOrEqual(2)
    expect(plan.length).toBeLessThanOrEqual(3)
  })

  it('returns 4–5 steps for a complex spec (4+ bullets)', () => {
    const plan = generateMinimalPlan('complex task', '- a\n- b\n- c\n- d\n- e')
    expect(plan.length).toBeGreaterThanOrEqual(4)
    expect(plan.length).toBeLessThanOrEqual(5)
  })

  it('every element has index (number) and description (string)', () => {
    const plan = generateMinimalPlan('add feature', '- implement\n- test')
    for (const step of plan) {
      expect(typeof step.index).toBe('number')
      expect(typeof step.description).toBe('string')
      expect(step.description.length).toBeGreaterThan(0)
    }
  })

  it('steps are sequentially indexed starting from 1', () => {
    const plan = generateMinimalPlan('update api', '- endpoint\n- handler\n- tests\n- docs')
    for (let i = 0; i < plan.length; i++) {
      expect(plan[i].index).toBe(i + 1)
    }
  })
})

// ---------------------------------------------------------------------------
// validatePlanCompleteness
// ---------------------------------------------------------------------------

describe('validatePlanCompleteness', () => {
  it('returns isValid:true when all key terms are covered', () => {
    const plan: PlanStep[] = [
      { index: 1, description: 'Identify affected files for users table migration' },
      { index: 2, description: 'Migrate the users table with new columns' },
      { index: 3, description: 'Verify migration is complete' },
    ]
    const result = validatePlanCompleteness('migrate users table', plan)
    expect(result.isValid).toBe(true)
    expect(result.risks).toHaveLength(0)
    expect(result.perspective).toBe('completeness')
  })

  it('returns isValid:false with risks when key terms are missing', () => {
    const incompletePlan: PlanStep[] = [
      { index: 1, description: 'Add soft delete column to users' },
    ]
    const result = validatePlanCompleteness(
      'add soft delete to users and update all foreign keys',
      incompletePlan,
    )
    expect(result.isValid).toBe(false)
    expect(result.risks).toEqual(
      expect.arrayContaining([expect.stringContaining('foreign')]),
    )
  })
})

// ---------------------------------------------------------------------------
// validatePlanDependencies
// ---------------------------------------------------------------------------

describe('validatePlanDependencies', () => {
  it('returns isValid:true for a sequential plan with no forward refs', () => {
    const sequentialPlan: PlanStep[] = [
      { index: 1, description: 'Identify files to change' },
      { index: 2, description: 'Implement the change from step 1' },
      { index: 3, description: 'Run tests to verify step 2' },
    ]
    const result = validatePlanDependencies(sequentialPlan)
    expect(result.isValid).toBe(true)
    expect(result.risks).toHaveLength(0)
    expect(result.perspective).toBe('dependency')
  })

  it('returns isValid:false when a step references a later step', () => {
    const forwardRefPlan: PlanStep[] = [
      { index: 1, description: 'Use the output from step 3 to configure' },
      { index: 2, description: 'Run tests' },
      { index: 3, description: 'Generate configuration' },
    ]
    const result = validatePlanDependencies(forwardRefPlan)
    expect(result.isValid).toBe(false)
    expect(result.risks).toEqual(expect.arrayContaining([expect.any(String)]))
  })

  it('flags single-step plans as a risk', () => {
    const singleStep: PlanStep[] = [
      { index: 1, description: 'Do everything' },
    ]
    const result = validatePlanDependencies(singleStep)
    expect(result.isValid).toBe(false)
    expect(result.risks.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// generateFixPlan
// ---------------------------------------------------------------------------

describe('generateFixPlan', () => {
  it('returns 1–3 steps for a verification failure', () => {
    const fixSteps = generateFixPlan('task', 'foreign key updates not covered')
    expect(fixSteps.length).toBeGreaterThanOrEqual(1)
    expect(fixSteps.length).toBeLessThanOrEqual(3)
  })

  it('every element has index and description', () => {
    const fixSteps = generateFixPlan('update schema', 'missing column constraint')
    for (const step of fixSteps) {
      expect(typeof step.index).toBe('number')
      expect(typeof step.description).toBe('string')
      expect(step.description.length).toBeGreaterThan(0)
    }
  })

  it('fix plan references the verification failure', () => {
    const fixSteps = generateFixPlan('migrate db', 'rollback script not created')
    const allText = fixSteps.map((s) => s.description).join(' ')
    expect(allText).toContain('rollback script not created')
  })
})
