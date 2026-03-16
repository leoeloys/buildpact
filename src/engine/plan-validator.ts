/**
 * Nyquist Multi-Perspective Plan Validator.
 * Evaluates a generated plan from 4 independent perspectives before execution.
 * @see FR-504 — Nyquist Multi-Perspective Plan Validation
 */

import type { PlanTask } from '../commands/plan/handler.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PerspectiveId = 'completeness' | 'consistency' | 'dependencies' | 'feasibility'

export type IssueSeverity = 'critical' | 'warning'

export interface ValidationIssue {
  perspective: PerspectiveId
  severity: IssueSeverity
  message: string
  taskId?: string
}

export interface PerspectiveResult {
  perspective: PerspectiveId
  label: string
  issues: ValidationIssue[]
  passed: boolean
}

export interface PlanValidationReport {
  perspectives: PerspectiveResult[]
  hasCritical: boolean
  totalIssues: number
}

// ---------------------------------------------------------------------------
// Perspective 1 — Completeness vs spec
// ---------------------------------------------------------------------------

/**
 * Extract acceptance criteria bullet texts from spec content.
 * Returns lowercase trimmed text of each bullet.
 */
export function extractSpecAcs(specContent: string): string[] {
  const lines = specContent.split('\n')
  const acs: string[] = []
  let inSection = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+(Acceptance Criteria|Functional Requirements|FRs?)\b/i.test(trimmed)) {
      inSection = true
      continue
    }
    if (inSection && /^##\s/.test(trimmed)) {
      inSection = false
      continue
    }
    if (inSection && /^[-*]\s/.test(trimmed)) {
      const text = trimmed.slice(2).replace(/^\[[ xX]\]\s*/, '').trim()
      if (text.length > 3) acs.push(text.toLowerCase())
    }
  }

  return acs
}

/**
 * Extract significant keywords (>4 chars) from a string.
 */
function keywordsFrom(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 4)
}

/**
 * Perspective 1: Completeness — every AC bullet must have at least one task that
 * shares a keyword with it.
 */
export function validateCompleteness(
  specContent: string,
  tasks: PlanTask[],
): PerspectiveResult {
  const acs = extractSpecAcs(specContent)
  const issues: ValidationIssue[] = []

  if (acs.length === 0) {
    // No ACs in spec → non-critical warning
    issues.push({
      perspective: 'completeness',
      severity: 'warning',
      message: 'No Acceptance Criteria section found in spec — completeness cannot be verified',
    })
    return { perspective: 'completeness', label: 'Completeness vs Spec', issues, passed: true }
  }

  const taskKeywords = tasks.flatMap(t => keywordsFrom(t.title))

  for (const ac of acs) {
    const acKeywords = keywordsFrom(ac)
    const covered = acKeywords.some(kw => taskKeywords.includes(kw))
    if (!covered) {
      issues.push({
        perspective: 'completeness',
        severity: 'critical',
        message: `AC not covered by any task: "${ac.slice(0, 80)}"`,
      })
    }
  }

  return {
    perspective: 'completeness',
    label: 'Completeness vs Spec',
    issues,
    passed: issues.every(i => i.severity !== 'critical'),
  }
}

// ---------------------------------------------------------------------------
// Perspective 2 — Internal consistency
// ---------------------------------------------------------------------------

/**
 * Perspective 2: Consistency — detect duplicate task titles and tasks with
 * extremely short (uninformative) titles.
 */
export function validateConsistency(tasks: PlanTask[]): PerspectiveResult {
  const issues: ValidationIssue[] = []

  // Duplicate titles
  const seen = new Set<string>()
  for (const task of tasks) {
    const key = task.title.toLowerCase().trim()
    if (seen.has(key)) {
      issues.push({
        perspective: 'consistency',
        severity: 'warning',
        message: `Duplicate task title: "${task.title}"`,
        taskId: task.id,
      })
    }
    seen.add(key)
  }

  // Uninformative tasks (title too short or all lowercase single word)
  for (const task of tasks) {
    if (task.title.trim().length < 5) {
      issues.push({
        perspective: 'consistency',
        severity: 'critical',
        message: `Task title too short to be actionable: "${task.title}"`,
        taskId: task.id,
      })
    }
  }

  return {
    perspective: 'consistency',
    label: 'Internal Consistency',
    issues,
    passed: issues.every(i => i.severity !== 'critical'),
  }
}

// ---------------------------------------------------------------------------
// Perspective 3 — Dependency correctness
// ---------------------------------------------------------------------------

/**
 * Perspective 3: Dependencies — check that all declared dependency IDs reference
 * real task IDs, and that no task depends on itself.
 */
export function validateDependencies(tasks: PlanTask[]): PerspectiveResult {
  const issues: ValidationIssue[] = []
  const ids = new Set(tasks.map(t => t.id))

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (dep === task.id) {
        issues.push({
          perspective: 'dependencies',
          severity: 'critical',
          message: `Task ${task.id} declares itself as a dependency`,
          taskId: task.id,
        })
      } else if (!ids.has(dep)) {
        issues.push({
          perspective: 'dependencies',
          severity: 'critical',
          message: `Task ${task.id} references non-existent dependency: ${dep}`,
          taskId: task.id,
        })
      }
    }
  }

  return {
    perspective: 'dependencies',
    label: 'Dependency Correctness',
    issues,
    passed: issues.every(i => i.severity !== 'critical'),
  }
}

// ---------------------------------------------------------------------------
// Perspective 4 — Feasibility
// ---------------------------------------------------------------------------

/** Vague or overly broad phrases that indicate infeasible task descriptions */
const INFEASIBILITY_PATTERNS = [
  'everything',
  'all the things',
  'refactor everything',
  'rewrite everything',
  'fix all bugs',
  'handle all cases',
  'implement the entire',
  'build the whole',
]

/**
 * Perspective 4: Feasibility — flag tasks with vague/unscoped language and
 * warn when there are too many tasks (>20) to realistically execute in a single plan.
 */
export function validateFeasibility(tasks: PlanTask[]): PerspectiveResult {
  const issues: ValidationIssue[] = []

  // Excessive task count
  if (tasks.length > 20) {
    issues.push({
      perspective: 'feasibility',
      severity: 'warning',
      message: `Plan contains ${tasks.length} tasks — consider splitting into smaller phases`,
    })
  }

  // Vague language patterns
  for (const task of tasks) {
    const lower = task.title.toLowerCase()
    for (const pattern of INFEASIBILITY_PATTERNS) {
      if (lower.includes(pattern)) {
        issues.push({
          perspective: 'feasibility',
          severity: 'warning',
          message: `Task has vague/unscoped language ("${pattern}"): "${task.title}"`,
          taskId: task.id,
        })
        break
      }
    }
  }

  return {
    perspective: 'feasibility',
    label: 'Feasibility',
    issues,
    passed: issues.every(i => i.severity !== 'critical'),
  }
}

// ---------------------------------------------------------------------------
// Aggregate validator
// ---------------------------------------------------------------------------

/**
 * Run all 4 perspectives against the plan and return a consolidated report.
 * Pure function — no side effects.
 */
export function validatePlan(
  specContent: string,
  tasks: PlanTask[],
): PlanValidationReport {
  const perspectives = [
    validateCompleteness(specContent, tasks),
    validateConsistency(tasks),
    validateDependencies(tasks),
    validateFeasibility(tasks),
  ]

  const allIssues = perspectives.flatMap(p => p.issues)
  const hasCritical = allIssues.some(i => i.severity === 'critical')

  return {
    perspectives,
    hasCritical,
    totalIssues: allIssues.length,
  }
}

// ---------------------------------------------------------------------------
// Revision helpers
// ---------------------------------------------------------------------------

/**
 * Produce a revised list of tasks by removing tasks flagged as critical in the
 * dependency and consistency perspectives, and inserting bridge tasks for
 * uncovered ACs.
 *
 * This is a heuristic auto-revision — it resolves mechanical issues (unknown deps,
 * duplicate titles) and adds placeholder tasks for uncovered ACs.
 * Pure function — no side effects.
 */
export function autoRevisePlan(
  specContent: string,
  tasks: PlanTask[],
): PlanTask[] {
  // Step 1: Remove self-referential and non-existent dependency IDs from all tasks
  const ids = new Set(tasks.map(t => t.id))
  let revised = tasks.map(task => ({
    ...task,
    dependencies: task.dependencies.filter(dep => dep !== task.id && ids.has(dep)),
  }))

  // Step 3: Deduplicate tasks with the same title
  const seenTitles = new Set<string>()
  revised = revised.filter(task => {
    const key = task.title.toLowerCase().trim()
    if (seenTitles.has(key)) return false
    seenTitles.add(key)
    return true
  })

  // Step 4: Add placeholder tasks for uncovered ACs
  const acs = extractSpecAcs(specContent)
  const revisedKeywords = revised.flatMap(t => keywordsFrom(t.title))

  const placeholders: PlanTask[] = []
  let nextIdx = revised.length + 1

  for (const ac of acs) {
    const acKeywords = keywordsFrom(ac)
    const covered = acKeywords.some(kw => revisedKeywords.includes(kw))
    if (!covered) {
      placeholders.push({
        id: `T${nextIdx}`,
        title: `Implement: ${ac.slice(0, 60)}`,
        dependencies: [],
        wave: 0,
      })
      nextIdx++
    }
  }

  return [...revised, ...placeholders]
}

// ---------------------------------------------------------------------------
// Report formatter
// ---------------------------------------------------------------------------

/**
 * Format a validation report as a human-readable markdown string.
 * Pure function — no side effects.
 */
export function formatValidationReport(report: PlanValidationReport): string {
  const lines: string[] = [
    '## Nyquist Plan Validation Report',
    '',
    `Total issues: ${report.totalIssues} | Critical: ${report.perspectives.flatMap(p => p.issues).filter(i => i.severity === 'critical').length} | Warnings: ${report.perspectives.flatMap(p => p.issues).filter(i => i.severity === 'warning').length}`,
    '',
  ]

  for (const perspective of report.perspectives) {
    const status = perspective.passed ? '✓' : '✗'
    lines.push(`### ${status} Perspective: ${perspective.label}`)
    lines.push('')
    if (perspective.issues.length === 0) {
      lines.push('No issues found.')
    } else {
      for (const issue of perspective.issues) {
        const prefix = issue.severity === 'critical' ? '[CRITICAL]' : '[WARNING]'
        const taskNote = issue.taskId ? ` (${issue.taskId})` : ''
        lines.push(`- ${prefix}${taskNote} ${issue.message}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}
