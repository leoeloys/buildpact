/**
 * Wave progress renderer — real-time terminal feedback during wave execution.
 * Uses @clack/prompts patterns for consistent UX.
 * @module engine/progress-renderer
 * @see FR-701 — Wave Execution (Epic 13)
 */

import type { TaskExecutionResult, WaveExecutionResult } from './wave-executor.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Injectable TUI interface for testability — mirrors @clack/prompts surface */
export interface TuiAdapter {
  spinner: () => { start: (msg: string) => void; stop: (msg: string) => void; message: (msg: string) => void }
  log: {
    step: (msg: string) => void
    info: (msg: string) => void
    success: (msg: string) => void
    error: (msg: string) => void
    warn: (msg: string) => void
  }
}

interface TaskTracker {
  title: string
  startTime: number
}

// ---------------------------------------------------------------------------
// Elapsed time formatting
// ---------------------------------------------------------------------------

/** Format milliseconds as human-readable elapsed time */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60000)
  const sec = Math.round((ms % 60000) / 1000)
  return `${min}m ${sec}s`
}

// ---------------------------------------------------------------------------
// WaveProgressRenderer
// ---------------------------------------------------------------------------

/**
 * Renders real-time wave execution progress in the terminal.
 * Tracks running tasks, elapsed time, and accumulated cost.
 * Uses a single spinner (clack limitation) that updates its message
 * as tasks start and complete.
 */
export class WaveProgressRenderer {
  private tui: TuiAdapter
  private activeSpinner: ReturnType<TuiAdapter['spinner']> | null = null
  private runningTasks = new Map<string, TaskTracker>()
  private completedCount = 0
  private totalTasksInWave = 0
  private waveCostUsd = 0
  private totalCostUsd = 0
  private spinnerActive = false

  constructor(tui: TuiAdapter) {
    this.tui = tui
  }

  /** Start a new wave — display wave header */
  startWave(waveNumber: number, totalWaves: number, taskCount: number): void {
    this.runningTasks.clear()
    this.completedCount = 0
    this.totalTasksInWave = taskCount
    this.waveCostUsd = 0

    this.tui.log.step(
      `Wave ${waveNumber + 1}/${totalWaves} — ${taskCount} task(s)`,
    )

    this.activeSpinner = this.tui.spinner()
    this.activeSpinner.start(`Running: 0/${taskCount} tasks dispatched...`)
    this.spinnerActive = true
  }

  /** Mark a task as started — update spinner message */
  startTask(taskId: string, title: string): void {
    this.runningTasks.set(taskId, { title, startTime: Date.now() })
    this.updateSpinnerMessage()
  }

  /** Mark a task as complete — log result and update spinner */
  completeTask(taskId: string, result: TaskExecutionResult): void {
    const tracker = this.runningTasks.get(taskId)
    const elapsed = tracker ? formatElapsed(Date.now() - tracker.startTime) : '?'

    this.runningTasks.delete(taskId)
    this.completedCount++

    if (result.costUsd) {
      this.waveCostUsd += result.costUsd
    }

    if (!result.success) {
      // Log failure immediately — errors are important
      if (this.spinnerActive && this.activeSpinner) {
        this.activeSpinner.stop(`${this.completedCount}/${this.totalTasksInWave} tasks complete`)
        this.spinnerActive = false
      }
      this.tui.log.error(`Task "${result.title}" failed (${elapsed}): ${result.error ?? 'unknown error'}`)
      // Restart spinner if there are still running tasks
      if (this.runningTasks.size > 0 && this.activeSpinner) {
        this.activeSpinner.start(this.buildSpinnerMessage())
        this.spinnerActive = true
      }
    } else {
      this.updateSpinnerMessage()
    }
  }

  /** End a wave — show wave summary */
  endWave(waveNumber: number, waveResult: WaveExecutionResult): void {
    this.totalCostUsd += this.waveCostUsd

    const passed = waveResult.tasks.filter(t => t.success).length
    const failed = waveResult.tasks.filter(t => !t.success).length
    const costStr = this.waveCostUsd > 0 ? `, $${this.waveCostUsd.toFixed(4)}` : ''

    if (this.spinnerActive && this.activeSpinner) {
      this.activeSpinner.stop(
        `Wave ${waveNumber + 1} complete — ${passed}/${waveResult.tasks.length} tasks passed${costStr}`,
      )
      this.spinnerActive = false
    }

    if (failed > 0) {
      this.tui.log.warn(`${failed} task(s) failed in wave ${waveNumber + 1}`)
    }
  }

  /** Pause all spinners — call before confirmation prompts */
  pauseAll(): void {
    if (this.spinnerActive && this.activeSpinner) {
      this.activeSpinner.stop('Paused — waiting for confirmation...')
      this.spinnerActive = false
    }
  }

  /** Resume spinners after confirmation prompt */
  resumeAll(): void {
    if (!this.spinnerActive && this.activeSpinner && this.runningTasks.size > 0) {
      this.activeSpinner.start(this.buildSpinnerMessage())
      this.spinnerActive = true
    }
  }

  /** Get the total accumulated cost across all waves */
  getTotalCostUsd(): number {
    return this.totalCostUsd
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private buildSpinnerMessage(): string {
    const runningNames = Array.from(this.runningTasks.values())
      .map(t => t.title)
      .slice(0, 3) // Show at most 3 task names

    const suffix = this.runningTasks.size > 3
      ? `, +${this.runningTasks.size - 3} more`
      : ''

    const costStr = this.waveCostUsd > 0 ? ` — $${this.waveCostUsd.toFixed(4)}` : ''

    return `Running: ${runningNames.join(', ')}${suffix} (${this.completedCount}/${this.totalTasksInWave} done${costStr})`
  }

  private updateSpinnerMessage(): void {
    if (this.spinnerActive && this.activeSpinner) {
      this.activeSpinner.message(this.buildSpinnerMessage())
    }
  }
}
