/**
 * Execution configuration — reads concurrency and timeout settings from config.yaml.
 * @module engine/execution-config
 * @see FR-701 — Wave Execution (Epic 13)
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Execution settings read from .buildpact/config.yaml */
export interface ExecutionConfig {
  /** Maximum parallel tasks per wave (0 = unlimited) */
  maxParallelTasks: number
  /** Per-task timeout in milliseconds */
  taskTimeoutMs: number
}

/** Default timeout: 120 seconds */
const DEFAULT_TASK_TIMEOUT_MS = 120_000

// ---------------------------------------------------------------------------
// Config reader
// ---------------------------------------------------------------------------

/**
 * Read execution configuration from .buildpact/config.yaml.
 * Looks for an `execution:` section with `max_parallel_tasks` and `task_timeout_seconds`.
 * Returns defaults for any missing values.
 *
 * @param projectDir — project root directory
 * @param readFileFn — injectable file reader for testability (defaults to fs.readFile)
 */
export async function readExecutionConfig(
  projectDir: string,
  readFileFn: (path: string, encoding: BufferEncoding) => Promise<string> = (p, e) => readFile(p, e),
): Promise<ExecutionConfig> {
  const defaults: ExecutionConfig = {
    maxParallelTasks: 0,
    taskTimeoutMs: DEFAULT_TASK_TIMEOUT_MS,
  }

  try {
    const content = await readFileFn(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    let inExecution = false

    for (const line of content.split('\n')) {
      const trimmed = line.trim()

      if (trimmed === 'execution:') {
        inExecution = true
        continue
      }

      if (!inExecution) continue

      // Detect end of execution block (non-indented non-comment line)
      if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.length > 0 && !trimmed.startsWith('#')) {
        inExecution = false
        continue
      }

      if (trimmed.startsWith('max_parallel_tasks:')) {
        defaults.maxParallelTasks = parseInt(trimmed.slice('max_parallel_tasks:'.length).trim(), 10) || 0
      } else if (trimmed.startsWith('task_timeout_seconds:')) {
        const seconds = parseInt(trimmed.slice('task_timeout_seconds:'.length).trim(), 10)
        if (seconds > 0) {
          defaults.taskTimeoutMs = seconds * 1000
        }
      }
    }
  } catch {
    // Return defaults if config not found
  }

  return defaults
}
