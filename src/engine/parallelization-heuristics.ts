/**
 * Parallelization Heuristics — detect whether tasks can safely run in parallel.
 * Checks for shared output files, dependency chains, and subsystem isolation.
 *
 * @module engine/parallelization-heuristics
 * @see Concept 3.5 (Parallelization heuristics for task execution)
 */

import type { ParallelizationAnalysis } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal task shape needed for parallelization analysis */
export interface ParallelizableTask {
  id: string
  outputFiles: string[]
  dependencies: string[]
  subsystem: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find output files that are written by more than one task.
 * Shared outputs make parallel execution unsafe.
 */
export function findSharedOutputFiles(tasks: ParallelizableTask[]): string[] {
  const fileCounts = new Map<string, number>()
  for (const task of tasks) {
    for (const file of task.outputFiles) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1)
    }
  }
  const shared: string[] = []
  for (const [file, count] of fileCounts) {
    if (count > 1) shared.push(file)
  }
  return shared
}

/**
 * Find task IDs that form sequential dependency chains.
 * A dependency is sequential if task B lists task A's ID in its dependencies.
 */
export function findSequentialDeps(tasks: ParallelizableTask[]): string[] {
  const taskIds = new Set(tasks.map(t => t.id))
  const sequential: string[] = []
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (taskIds.has(dep) && !sequential.includes(dep)) {
        sequential.push(dep)
      }
    }
  }
  return sequential
}

// ---------------------------------------------------------------------------
// Pairwise check
// ---------------------------------------------------------------------------

/**
 * Check whether two specific tasks can safely run in parallel.
 * They cannot if: one depends on the other, they share output files,
 * or they operate on the same subsystem.
 */
export function canRunInParallel(taskA: ParallelizableTask, taskB: ParallelizableTask): boolean {
  // Direct dependency
  if (taskA.dependencies.includes(taskB.id) || taskB.dependencies.includes(taskA.id)) {
    return false
  }

  // Shared output files
  const aFiles = new Set(taskA.outputFiles)
  for (const file of taskB.outputFiles) {
    if (aFiles.has(file)) return false
  }

  // Same subsystem
  if (taskA.subsystem === taskB.subsystem && taskA.subsystem !== '') {
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Full analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a set of tasks for parallelization safety.
 * Returns whether parallelization is possible and the reasons why or why not.
 */
export function analyzeParallelization(tasks: ParallelizableTask[]): ParallelizationAnalysis {
  if (tasks.length <= 1) {
    return {
      canParallelize: false,
      reasons: ['Single task or empty set — nothing to parallelize.'],
      sharedFiles: [],
      sequentialDeps: [],
    }
  }

  const sharedFiles = findSharedOutputFiles(tasks)
  const sequentialDeps = findSequentialDeps(tasks)
  const reasons: string[] = []

  if (sharedFiles.length > 0) {
    reasons.push(`Shared output files prevent parallelization: ${sharedFiles.join(', ')}`)
  }

  if (sequentialDeps.length > 0) {
    reasons.push(`Sequential dependencies exist: ${sequentialDeps.join(', ')}`)
  }

  // Check subsystem isolation
  const subsystems = tasks.map(t => t.subsystem).filter(s => s !== '')
  const uniqueSubsystems = new Set(subsystems)
  if (uniqueSubsystems.size < subsystems.length) {
    reasons.push('Multiple tasks target the same subsystem.')
  }

  const canParallelize = reasons.length === 0
  if (canParallelize) {
    reasons.push('All tasks have independent outputs, no shared dependencies, and isolated subsystems.')
  }

  return { canParallelize, reasons, sharedFiles, sequentialDeps }
}
