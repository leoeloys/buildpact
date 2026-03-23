/**
 * Auto-advance executor — walk-away wave execution with pause/resume.
 * @module engine/auto-advance
 * @see Epic 22.2 — Auto-Advance Walk-Away Execution
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import { executeWave, parseWaveTasksFromPlanFile } from './wave-executor.js'
import { readBudgetConfig, checkBudget, readDailySpend, STUB_COST_PER_TASK_USD } from './budget-guard.js'
import type { AgentPauseInfo } from './agent-supervisor.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a completed auto-advance execution */
export interface AutoAdvanceResult {
  wavesCompleted: number
  totalTasks: number
  paused: boolean
  pauseReason: string | undefined
}

/** Options for auto-advance execution */
export interface AutoAdvanceOptions {
  /** Max retry attempts per failed task before pausing */
  maxRetries?: number | undefined
  /** Optional constitution path */
  constitutionPath?: string | undefined
  /** Phase slug for commit messages */
  phaseSlug?: string | undefined
}

// ---------------------------------------------------------------------------
// AutoAdvanceExecutor
// ---------------------------------------------------------------------------

/**
 * Processes plan waves sequentially: execute -> validate -> advance -> repeat.
 * On task failure after retries: pauses and writes failure details.
 * Integrates with budget guard to pause if projected cost exceeds limit.
 */
export class AutoAdvanceExecutor {
  private readonly buildpactDir: string
  private readonly pausePath: string

  constructor(private readonly projectDir: string) {
    this.buildpactDir = join(projectDir, '.buildpact')
    this.pausePath = join(this.buildpactDir, 'agent-paused.json')
  }

  /**
   * Execute a plan file's waves sequentially with auto-advance.
   * Pauses on failure or budget exhaustion.
   */
  async execute(planPath: string, opts?: AutoAdvanceOptions): Promise<Result<AutoAdvanceResult>> {
    // Ensure .buildpact directory exists
    if (!existsSync(this.buildpactDir)) {
      mkdirSync(this.buildpactDir, { recursive: true })
    }

    // Read plan content
    let planContent: string
    try {
      planContent = readFileSync(planPath, 'utf-8')
    } catch {
      return err({
        code: ERROR_CODES.FILE_READ_FAILED,
        i18nKey: 'error.file.read_failed',
        params: { path: planPath },
      })
    }

    // Parse waves from plan
    const waveBlocks = this.parseWaveBlocks(planContent)
    if (waveBlocks.length === 0) {
      return ok({
        wavesCompleted: 0,
        totalTasks: 0,
        paused: false,
        pauseReason: undefined,
      })
    }

    const maxRetries = opts?.maxRetries ?? 1
    let wavesCompleted = 0
    let totalTasks = 0

    for (let i = 0; i < waveBlocks.length; i++) {
      const waveContent = waveBlocks[i]!
      const tasks = parseWaveTasksFromPlanFile(
        waveContent,
        i,
        opts?.constitutionPath,
        opts?.phaseSlug,
      )

      if (tasks.length === 0) {
        wavesCompleted++
        continue
      }

      // Budget check before each wave
      const budgetResult = await this.checkBudgetBeforeWave(tasks.length)
      if (!budgetResult.ok) {
        this.writePauseFile({
          pausedAt: new Date().toISOString(),
          waveNumber: i,
          reason: 'Budget limit reached',
          failedTaskId: undefined,
          failedTaskTitle: undefined,
        })
        return ok({
          wavesCompleted,
          totalTasks,
          paused: true,
          pauseReason: 'Budget limit reached',
        })
      }

      // Execute wave
      const waveResult = executeWave(tasks, { maxRetries })
      totalTasks += waveResult.tasks.length

      if (!waveResult.allSucceeded) {
        // Find first failed task
        const failedTask = waveResult.tasks.find(t => !t.success)
        this.writePauseFile({
          pausedAt: new Date().toISOString(),
          waveNumber: i,
          reason: failedTask?.error ?? 'Task execution failed',
          ...(failedTask?.taskId !== undefined && { failedTaskId: failedTask.taskId }),
          ...(failedTask?.title !== undefined && { failedTaskTitle: failedTask.title }),
        })

        return ok({
          wavesCompleted,
          totalTasks,
          paused: true,
          pauseReason: failedTask?.error ?? 'Task execution failed',
        })
      }

      wavesCompleted++
    }

    return ok({
      wavesCompleted,
      totalTasks,
      paused: false,
      pauseReason: undefined,
    })
  }

  /**
   * Resume execution from the paused wave.
   */
  async resume(planPath: string, opts?: AutoAdvanceOptions): Promise<Result<AutoAdvanceResult>> {
    const pauseInfo = this.readPauseFile()
    if (!pauseInfo) {
      return err({
        code: ERROR_CODES.AGENT_NOT_RUNNING,
        i18nKey: 'cli.agent.not_running',
      })
    }

    // Remove the pause file to allow execution
    this.removePauseFile()

    // Read plan content
    let planContent: string
    try {
      planContent = readFileSync(planPath, 'utf-8')
    } catch {
      return err({
        code: ERROR_CODES.FILE_READ_FAILED,
        i18nKey: 'error.file.read_failed',
        params: { path: planPath },
      })
    }

    // Parse waves and resume from the paused wave
    const waveBlocks = this.parseWaveBlocks(planContent)
    const startWave = pauseInfo.waveNumber
    const maxRetries = opts?.maxRetries ?? 1
    let wavesCompleted = startWave
    let totalTasks = 0

    for (let i = startWave; i < waveBlocks.length; i++) {
      const waveContent = waveBlocks[i]!
      const tasks = parseWaveTasksFromPlanFile(
        waveContent,
        i,
        opts?.constitutionPath,
        opts?.phaseSlug,
      )

      if (tasks.length === 0) {
        wavesCompleted++
        continue
      }

      // Budget check before each wave
      const budgetResult = await this.checkBudgetBeforeWave(tasks.length)
      if (!budgetResult.ok) {
        this.writePauseFile({
          pausedAt: new Date().toISOString(),
          waveNumber: i,
          reason: 'Budget limit reached',
          failedTaskId: undefined,
          failedTaskTitle: undefined,
        })
        return ok({
          wavesCompleted,
          totalTasks,
          paused: true,
          pauseReason: 'Budget limit reached',
        })
      }

      const waveResult = executeWave(tasks, { maxRetries })
      totalTasks += waveResult.tasks.length

      if (!waveResult.allSucceeded) {
        const failedTask = waveResult.tasks.find(t => !t.success)
        this.writePauseFile({
          pausedAt: new Date().toISOString(),
          waveNumber: i,
          reason: failedTask?.error ?? 'Task execution failed',
          ...(failedTask?.taskId !== undefined && { failedTaskId: failedTask.taskId }),
          ...(failedTask?.title !== undefined && { failedTaskTitle: failedTask.title }),
        })

        return ok({
          wavesCompleted,
          totalTasks,
          paused: true,
          pauseReason: failedTask?.error ?? 'Task execution failed',
        })
      }

      wavesCompleted++
    }

    return ok({
      wavesCompleted,
      totalTasks,
      paused: false,
      pauseReason: undefined,
    })
  }

  /**
   * Check if execution is currently paused.
   */
  isPaused(): boolean {
    return existsSync(this.pausePath)
  }

  /**
   * Read pause information if paused.
   */
  getPauseInfo(): AgentPauseInfo | undefined {
    return this.readPauseFile() ?? undefined
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Parse plan content into wave blocks.
   * Each wave is delimited by `## Wave N` headings.
   */
  private parseWaveBlocks(planContent: string): string[] {
    const lines = planContent.split('\n')
    const waveBlocks: string[] = []
    let currentBlock: string[] = []
    let inWave = false

    for (const line of lines) {
      if (/^##\s+Wave\s+\d+/i.test(line)) {
        if (inWave && currentBlock.length > 0) {
          waveBlocks.push(currentBlock.join('\n'))
        }
        currentBlock = [line]
        inWave = true
      } else if (inWave) {
        currentBlock.push(line)
      }
    }

    // Push last wave
    if (inWave && currentBlock.length > 0) {
      waveBlocks.push(currentBlock.join('\n'))
    }

    // If no wave headings found, treat the entire content as a single wave
    if (waveBlocks.length === 0 && planContent.trim().length > 0) {
      waveBlocks.push(planContent)
    }

    return waveBlocks
  }

  private async checkBudgetBeforeWave(taskCount: number): Promise<Result<void>> {
    try {
      const config = await readBudgetConfig(this.projectDir)
      const dailySpend = await readDailySpend(this.projectDir)
      const projectedCost = taskCount * STUB_COST_PER_TASK_USD

      const result = checkBudget({
        config,
        sessionSpendUsd: projectedCost,
        phaseSpendUsd: projectedCost,
        dailySpendUsd: dailySpend + projectedCost,
      })

      if (result.ok && !result.value.allowed) {
        return err({
          code: ERROR_CODES.BUDGET_EXCEEDED,
          i18nKey: 'cli.agent.budget_paused',
        })
      }

      return ok(undefined)
    } catch {
      // Budget check failure should not block execution
      return ok(undefined)
    }
  }

  private readPauseFile(): AgentPauseInfo | null {
    try {
      if (!existsSync(this.pausePath)) return null
      const content = readFileSync(this.pausePath, 'utf-8')
      return JSON.parse(content) as AgentPauseInfo
    } catch {
      return null
    }
  }

  private writePauseFile(info: AgentPauseInfo): void {
    try {
      if (!existsSync(this.buildpactDir)) {
        mkdirSync(this.buildpactDir, { recursive: true })
      }
      writeFileSync(this.pausePath, JSON.stringify(info, null, 2), 'utf-8')
    } catch {
      // Pause file write failure must not crash
    }
  }

  private removePauseFile(): void {
    try {
      if (existsSync(this.pausePath)) {
        unlinkSync(this.pausePath)
      }
    } catch {
      // Ignore
    }
  }
}
