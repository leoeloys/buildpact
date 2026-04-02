/**
 * Story Slicing — independent story decomposition with priority ordering.
 * P1 stories must be fully independent. Cyclic dependencies are illegal.
 * Parallel markers [P] in plan content indicate parallelizable work.
 *
 * @module engine/story-slicing
 * @see Concept 6.6-6.8 (Story slicing, independence, parallel markers)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A sliced story with priority, tasks, and dependency info */
export interface StorySlice {
  /** Unique story identifier */
  storyId: string
  /** Priority level (1 = highest) */
  priority: number
  /** Task IDs within this story */
  tasks: string[]
  /** Whether this story can be run independently */
  isIndependent: boolean
  /** Story IDs this story depends on */
  dependencies: string[]
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that P1 (priority=1) stories are fully independent.
 * P1 stories must have no dependencies on other stories.
 */
export function validateStoryIndependence(slices: StorySlice[]): Result<void> {
  const violations: string[] = []

  for (const slice of slices) {
    if (slice.priority === 1 && slice.dependencies.length > 0) {
      violations.push(
        `Story ${slice.storyId} is P1 but depends on: ${slice.dependencies.join(', ')}`,
      )
    }
    if (slice.priority === 1 && !slice.isIndependent) {
      violations.push(
        `Story ${slice.storyId} is P1 but marked as not independent.`,
      )
    }
  }

  if (violations.length > 0) {
    return err({
      code: ERROR_CODES.REASSESSMENT_PLAN_INVALIDATED,
      i18nKey: 'error.story.p1_not_independent',
      params: {
        count: String(violations.length),
        details: violations.join('; '),
      },
    })
  }

  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Parallel markers
// ---------------------------------------------------------------------------

/**
 * Detect [P] parallel markers in plan content.
 * Returns the text following each [P] marker.
 */
export function detectParallelMarkers(planContent: string): string[] {
  const markers: string[] = []
  const pattern = /\[P\]\s*(.+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(planContent)) !== null) {
    markers.push(match[1]!.trim())
  }

  return markers
}

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

/**
 * Detect cyclic dependencies among story slices using DFS.
 * Returns true if any cycle exists.
 */
export function hasCyclicDependencies(slices: StorySlice[]): boolean {
  const storyIds = new Set(slices.map(s => s.storyId))
  const adjacency = new Map<string, string[]>()
  for (const slice of slices) {
    adjacency.set(
      slice.storyId,
      slice.dependencies.filter(d => storyIds.has(d)),
    )
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(node: string): boolean {
    if (inStack.has(node)) return true
    if (visited.has(node)) return false

    visited.add(node)
    inStack.add(node)

    for (const dep of adjacency.get(node) ?? []) {
      if (dfs(dep)) return true
    }

    inStack.delete(node)
    return false
  }

  for (const id of storyIds) {
    if (dfs(id)) return true
  }

  return false
}
