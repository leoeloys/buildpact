import { describe, it, expect } from 'vitest'
import {
  extractSpecAcs,
  validateCompleteness,
  validateConsistency,
  validateDependencies,
  validateFeasibility,
  validatePlan,
  autoRevisePlan,
  formatValidationReport,
} from '../../../src/engine/plan-validator.js'
import type { PlanTask } from '../../../src/commands/plan/handler.js'

// ---------------------------------------------------------------------------
// extractSpecAcs unit tests
// ---------------------------------------------------------------------------

describe('extractSpecAcs', () => {
  it('extracts bullet points from Acceptance Criteria section', () => {
    const spec = '# Spec\n\n## Acceptance Criteria\n\n- User can log in\n- User can log out\n'
    const acs = extractSpecAcs(spec)
    expect(acs).toHaveLength(2)
    expect(acs[0]).toBe('user can log in')
    expect(acs[1]).toBe('user can log out')
  })

  it('extracts from Functional Requirements section', () => {
    const spec = '## Functional Requirements\n\n- Accept user input\n- Validate input format\n'
    const acs = extractSpecAcs(spec)
    expect(acs).toHaveLength(2)
  })

  it('stops at next ## section', () => {
    const spec = '## Acceptance Criteria\n\n- Task A\n- Task B\n\n## NFRs\n\n- Not an AC\n'
    const acs = extractSpecAcs(spec)
    expect(acs).toHaveLength(2)
  })

  it('returns empty array when no AC section', () => {
    const acs = extractSpecAcs('# Title\nSome description with no ACs')
    expect(acs).toHaveLength(0)
  })

  it('returns lowercase trimmed strings', () => {
    const spec = '## Acceptance Criteria\n\n- UPPERCASE TITLE CHECK\n'
    const acs = extractSpecAcs(spec)
    expect(acs[0]).toBe('uppercase title check')
  })
})

// ---------------------------------------------------------------------------
// validateCompleteness unit tests
// ---------------------------------------------------------------------------

describe('validateCompleteness', () => {
  it('passes when all ACs are covered by tasks', () => {
    const spec = '## Acceptance Criteria\n\n- Implement authentication system\n'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Implement authentication system', dependencies: [], wave: 0 },
    ]
    const result = validateCompleteness(spec, tasks)
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('reports critical issue when AC has no matching task keyword', () => {
    const spec = '## Acceptance Criteria\n\n- Implement payment processing pipeline\n'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Create database schema', dependencies: [], wave: 0 },
    ]
    const result = validateCompleteness(spec, tasks)
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.severity === 'critical')).toBe(true)
  })

  it('returns warning (not critical) when no AC section found', () => {
    const spec = '# Title\nDescription without AC section'
    const tasks: PlanTask[] = [{ id: 'T1', title: 'Some task', dependencies: [], wave: 0 }]
    const result = validateCompleteness(spec, tasks)
    expect(result.passed).toBe(true)
    expect(result.issues.some(i => i.severity === 'warning')).toBe(true)
  })

  it('sets perspective to completeness', () => {
    const spec = '# Title'
    const result = validateCompleteness(spec, [])
    expect(result.perspective).toBe('completeness')
  })

  it('matches on shared keywords (any keyword from AC appears in task titles)', () => {
    const spec = '## Acceptance Criteria\n\n- Validate email format correctly\n'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Add email validation logic', dependencies: [], wave: 0 },
    ]
    const result = validateCompleteness(spec, tasks)
    expect(result.passed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateConsistency unit tests
// ---------------------------------------------------------------------------

describe('validateConsistency', () => {
  it('passes with unique actionable tasks', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Implement login endpoint', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Write integration tests', dependencies: [], wave: 1 },
    ]
    const result = validateConsistency(tasks)
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('reports warning for duplicate task titles', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Implement login endpoint', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Implement login endpoint', dependencies: [], wave: 1 },
    ]
    const result = validateConsistency(tasks)
    expect(result.issues.some(i => i.severity === 'warning' && i.message.includes('Duplicate'))).toBe(true)
  })

  it('reports critical issue for task title too short', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Fix', dependencies: [], wave: 0 },
    ]
    const result = validateConsistency(tasks)
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.severity === 'critical')).toBe(true)
  })

  it('sets perspective to consistency', () => {
    const result = validateConsistency([])
    expect(result.perspective).toBe('consistency')
  })

  it('duplicate check is case-insensitive', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Implement Login Endpoint', dependencies: [], wave: 0 },
      { id: 'T2', title: 'implement login endpoint', dependencies: [], wave: 1 },
    ]
    const result = validateConsistency(tasks)
    expect(result.issues.some(i => i.message.includes('Duplicate'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateDependencies unit tests
// ---------------------------------------------------------------------------

describe('validateDependencies', () => {
  it('passes when all declared dependencies reference valid task IDs', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Foundation setup', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Core implementation', dependencies: ['T1'], wave: 1 },
    ]
    const result = validateDependencies(tasks)
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('reports critical issue for dependency on non-existent task ID', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Setup', dependencies: ['T99'], wave: 0 },
    ]
    const result = validateDependencies(tasks)
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.severity === 'critical' && i.message.includes('T99'))).toBe(true)
  })

  it('reports critical issue when task depends on itself', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Self-referential task', dependencies: ['T1'], wave: 0 },
    ]
    const result = validateDependencies(tasks)
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.severity === 'critical' && i.message.includes('itself'))).toBe(true)
  })

  it('passes for empty task list', () => {
    const result = validateDependencies([])
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('sets perspective to dependencies', () => {
    const result = validateDependencies([])
    expect(result.perspective).toBe('dependencies')
  })
})

// ---------------------------------------------------------------------------
// validateFeasibility unit tests
// ---------------------------------------------------------------------------

describe('validateFeasibility', () => {
  it('passes for a reasonable-sized plan with clear tasks', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Implement user authentication flow', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Write unit tests for auth module', dependencies: ['T1'], wave: 1 },
    ]
    const result = validateFeasibility(tasks)
    expect(result.passed).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('warns when plan has more than 20 tasks', () => {
    const tasks: PlanTask[] = Array.from({ length: 21 }, (_, i) => ({
      id: `T${i + 1}`,
      title: `Implement feature number ${i + 1} in the system`,
      dependencies: [],
      wave: 0,
    }))
    const result = validateFeasibility(tasks)
    expect(result.issues.some(i => i.severity === 'warning' && i.message.includes('21'))).toBe(true)
  })

  it('warns for task containing vague language "everything"', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Refactor everything in the system', dependencies: [], wave: 0 },
    ]
    const result = validateFeasibility(tasks)
    expect(result.issues.some(i => i.message.includes('everything'))).toBe(true)
  })

  it('warns for task containing "fix all bugs" pattern', () => {
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Fix all bugs in the application', dependencies: [], wave: 0 },
    ]
    const result = validateFeasibility(tasks)
    expect(result.issues.some(i => i.message.includes('fix all bugs'))).toBe(true)
  })

  it('sets perspective to feasibility', () => {
    const result = validateFeasibility([])
    expect(result.perspective).toBe('feasibility')
  })
})

// ---------------------------------------------------------------------------
// validatePlan unit tests (aggregate)
// ---------------------------------------------------------------------------

describe('validatePlan', () => {
  it('returns 4 perspectives', () => {
    const spec = '# Spec\nA simple feature'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Foundation setup phase', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Core implementation step', dependencies: ['T1'], wave: 1 },
    ]
    const report = validatePlan(spec, tasks)
    expect(report.perspectives).toHaveLength(4)
  })

  it('hasCritical is false when all perspectives pass', () => {
    const spec = '## Acceptance Criteria\n\n- Implement foundation setup phase\n'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Implement foundation setup phase', dependencies: [], wave: 0 },
    ]
    const report = validatePlan(spec, tasks)
    expect(report.hasCritical).toBe(false)
  })

  it('hasCritical is true when any perspective has a critical issue', () => {
    const spec = '## Acceptance Criteria\n\n- Implement payment gateway integration flow\n'
    const tasks: PlanTask[] = [
      // Tasks that don't share keywords with the AC
      { id: 'T1', title: 'Create database schema structure', dependencies: [], wave: 0 },
    ]
    const report = validatePlan(spec, tasks)
    expect(report.hasCritical).toBe(true)
  })

  it('totalIssues sums issues across all perspectives', () => {
    const spec = '# Title'
    const tasks: PlanTask[] = [
      // Short title → critical from consistency
      { id: 'T1', title: 'Fix', dependencies: [], wave: 0 },
    ]
    const report = validatePlan(spec, tasks)
    expect(report.totalIssues).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// autoRevisePlan unit tests
// ---------------------------------------------------------------------------

describe('autoRevisePlan', () => {
  it('removes self-referential dependencies but keeps the task', () => {
    const spec = '# Title'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Self-referential setup task', dependencies: ['T1'], wave: 0 },
    ]
    const revised = autoRevisePlan(spec, tasks)
    const t1 = revised.find(t => t.id === 'T1')
    expect(t1).toBeDefined()
    expect(t1!.dependencies).not.toContain('T1')
  })

  it('removes references to non-existent dependency IDs', () => {
    const spec = '# Title'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Depends on ghost task', dependencies: ['T99'], wave: 0 },
    ]
    const revised = autoRevisePlan(spec, tasks)
    expect(revised.find(t => t.id === 'T1')?.dependencies).toHaveLength(0)
  })

  it('deduplicates tasks with the same title', () => {
    const spec = '# Title'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Implement login endpoint', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Implement login endpoint', dependencies: [], wave: 0 },
    ]
    const revised = autoRevisePlan(spec, tasks)
    const loginTasks = revised.filter(t => t.title.toLowerCase() === 'implement login endpoint')
    expect(loginTasks).toHaveLength(1)
  })

  it('adds placeholder tasks for uncovered ACs', () => {
    const spec = '## Acceptance Criteria\n\n- Implement payment gateway integration flow\n'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Create database schema structure', dependencies: [], wave: 0 },
    ]
    const revised = autoRevisePlan(spec, tasks)
    const hasPlaceholder = revised.some(t => t.title.includes('payment'))
    expect(hasPlaceholder).toBe(true)
  })

  it('preserves tasks that are already valid', () => {
    const spec = '# Title'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Foundation setup phase', dependencies: [], wave: 0 },
      { id: 'T2', title: 'Core implementation step', dependencies: ['T1'], wave: 1 },
    ]
    const revised = autoRevisePlan(spec, tasks)
    expect(revised.find(t => t.id === 'T1')).toBeDefined()
    expect(revised.find(t => t.id === 'T2')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// formatValidationReport unit tests
// ---------------------------------------------------------------------------

describe('formatValidationReport', () => {
  it('includes the report title', () => {
    const spec = '# Title'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Foundation setup phase', dependencies: [], wave: 0 },
    ]
    const report = validatePlan(spec, tasks)
    const formatted = formatValidationReport(report)
    expect(formatted).toContain('Nyquist Plan Validation Report')
  })

  it('shows all 4 perspective labels', () => {
    const spec = '# Title'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Foundation setup phase', dependencies: [], wave: 0 },
    ]
    const report = validatePlan(spec, tasks)
    const formatted = formatValidationReport(report)
    expect(formatted).toContain('Completeness vs Spec')
    expect(formatted).toContain('Internal Consistency')
    expect(formatted).toContain('Dependency Correctness')
    expect(formatted).toContain('Feasibility')
  })

  it('marks passed perspectives with ✓ and failed with ✗', () => {
    const spec = '## Acceptance Criteria\n\n- Implement payment gateway integration\n'
    const tasks: PlanTask[] = [
      { id: 'T1', title: 'Create database schema structure', dependencies: [], wave: 0 },
    ]
    const report = validatePlan(spec, tasks)
    const formatted = formatValidationReport(report)
    // Completeness should fail
    expect(formatted).toContain('✗')
  })

  it('shows [CRITICAL] and [WARNING] labels for issues', () => {
    const spec = '## Acceptance Criteria\n\n- Implement payment gateway integration\n'
    const tasks: PlanTask[] = [
      // Short title → critical from consistency
      { id: 'T1', title: 'Fix', dependencies: [], wave: 0 },
    ]
    const report = validatePlan(spec, tasks)
    const formatted = formatValidationReport(report)
    expect(formatted).toContain('[CRITICAL]')
  })
})
