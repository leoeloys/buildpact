/**
 * Core types for wave-based plan analysis.
 * Used by analyzeWaves() and splitIntoPlanFiles() in wave-executor.ts.
 * @module engine/types
 * @see FR-602 — Wave-Based Plan Generation
 */

/** A single task node in the dependency graph */
export interface TaskNode {
  /** Unique task identifier, e.g. "task-1" */
  id: string
  /** Human-readable task description */
  description: string
  /** IDs of tasks this task depends on */
  dependencies: string[]
  /** Optional feature tag for vertical-slice grouping (AC #5) */
  featureTag?: string
}

/** A group of tasks assigned to the same execution wave */
export interface WaveGroup {
  /** 0-indexed wave number */
  waveNumber: number
  /** Tasks assigned to this wave */
  tasks: TaskNode[]
  /** True when all tasks in this wave have no dependencies on each other */
  isParallel: boolean
}

/** A single plan file specification produced by splitIntoPlanFiles() */
export interface PlanFile {
  /** Filename, e.g. "wave-1-plan-1.md" */
  filename: string
  /** 0-indexed wave number */
  waveNumber: number
  /** 1-indexed plan file number within the wave */
  planNumber: number
  /** Tasks included in this plan file (max maxTasksPerFile) */
  tasks: TaskNode[]
}
