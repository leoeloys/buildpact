/**
 * Task tagger — domain-aware [HUMAN]/[AGENT] classification.
 * For software domains, all tasks are AGENT. For non-software, keyword heuristics apply.
 * @see FR-505 — Non-Software Domain Planning
 */

import type { PlanTask } from './handler.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Execution type for a task — human (manual) or agent (automated) */
export type ExecutionType = 'HUMAN' | 'AGENT'

/** A PlanTask with executor classification and optional human checklist */
export interface TaggedTask extends PlanTask {
  executor: ExecutionType
  checklistItems?: string[]
}

// ---------------------------------------------------------------------------
// Human keyword detection
// ---------------------------------------------------------------------------

const HUMAN_KEYWORDS = [
  'review',
  'approve',
  'sign off',
  'sign-off',
  'manually',
  'manual ',
  'call ',
  'meeting',
  'interview',
  'contact ',
  'visit ',
  'present',
  'negotiate',
  'decide',
  'authorize',
  'inspect',
  'survey',
  'hand off',
  'hand-off',
  'coordinate',
  'train ',
  'onboard',
  'audit ',
  'confirm with',
  'notify ',
] as const

/**
 * Classify a single task as HUMAN or AGENT by keyword heuristics.
 * Pure function — no side effects.
 */
export function classifyTask(title: string): ExecutionType {
  const lower = title.toLowerCase()
  for (const kw of HUMAN_KEYWORDS) {
    if (lower.includes(kw)) return 'HUMAN'
  }
  return 'AGENT'
}

// ---------------------------------------------------------------------------
// Domain-aware tagging
// ---------------------------------------------------------------------------

/**
 * Tag all tasks with executor type based on domain.
 * - software domain: all tasks are AGENT (no human steps)
 * - non-software domain: use classifyTask heuristics; HUMAN tasks get checklists
 * Pure function — no side effects.
 */
export function tagTasks(tasks: PlanTask[], domainType: string): TaggedTask[] {
  if (domainType === 'software') {
    return tasks.map(t => ({ ...t, executor: 'AGENT' as const }))
  }

  return tasks.map(t => {
    const executor = classifyTask(t.title)
    const tagged: TaggedTask = { ...t, executor }
    if (executor === 'HUMAN') {
      tagged.checklistItems = buildHumanChecklist(t)
    }
    return tagged
  })
}

/**
 * Generate 3-4 generic checklist items for a human task.
 * Items are actionable sub-steps the user should complete manually.
 * Pure function — no side effects.
 */
export function buildHumanChecklist(task: PlanTask): string[] {
  const items = [
    `Review and verify: ${task.title}`,
    'Confirm accuracy and completeness',
    'Note any corrections or feedback needed',
    'Sign off in audit log when satisfied',
  ]
  return items
}
