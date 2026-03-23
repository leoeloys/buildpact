/**
 * Agent supervisor — persistent background process management.
 * @module engine/agent-supervisor
 * @see Epic 22.1 — Agent Mode TypeScript CLI
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status information returned by AgentSupervisor.status() */
export interface AgentStatus {
  running: boolean
  pid: number | undefined
  uptime: string | undefined
  activeAgents: number
  tasksProcessed: number
  memoryUsageMb: number
}

/** Contents of the agent-paused.json file */
export interface AgentPauseInfo {
  pausedAt: string
  waveNumber: number
  reason: string
  failedTaskId: string | undefined
  failedTaskTitle: string | undefined
}

// ---------------------------------------------------------------------------
// AgentSupervisor
// ---------------------------------------------------------------------------

/**
 * Manages a persistent background supervisor process.
 * Writes PID to `.buildpact/agent.pid`, logs to `.buildpact/agent.log`.
 */
export class AgentSupervisor {
  private readonly pidPath: string
  private readonly logPath: string
  private readonly buildpactDir: string
  private startTime: number | undefined
  private tasksProcessed = 0

  constructor(private readonly projectDir: string) {
    this.buildpactDir = join(projectDir, '.buildpact')
    this.pidPath = join(this.buildpactDir, 'agent.pid')
    this.logPath = join(this.buildpactDir, 'agent.log')
  }

  /**
   * Start the agent supervisor.
   * Detects stale PIDs and cleans up before starting.
   */
  start(): Result<{ pid: number; staleDetected: boolean }> {
    // Ensure .buildpact directory exists
    if (!existsSync(this.buildpactDir)) {
      mkdirSync(this.buildpactDir, { recursive: true })
    }

    // Check if already running
    const existingPid = this.readPid()
    if (existingPid !== undefined) {
      if (this.isProcessAlive(existingPid)) {
        return err({
          code: ERROR_CODES.AGENT_ALREADY_RUNNING,
          i18nKey: 'cli.agent.already_running',
          params: { pid: String(existingPid) },
        })
      }

      // Stale PID detected — clean up
      this.removePidFile()
      this.appendLog('Stale PID file cleaned up')

      const pid = process.pid
      this.writePid(pid)
      this.startTime = Date.now()
      this.appendLog(`Agent supervisor started (PID: ${pid}) — stale PID cleaned`)

      return ok({ pid, staleDetected: true })
    }

    const pid = process.pid
    this.writePid(pid)
    this.startTime = Date.now()
    this.appendLog(`Agent supervisor started (PID: ${pid})`)

    return ok({ pid, staleDetected: false })
  }

  /**
   * Stop the agent supervisor with graceful shutdown.
   * Removes the PID file after stopping.
   */
  stop(): Result<void> {
    const existingPid = this.readPid()
    if (existingPid === undefined) {
      return err({
        code: ERROR_CODES.AGENT_NOT_RUNNING,
        i18nKey: 'cli.agent.not_running',
      })
    }

    this.removePidFile()
    this.startTime = undefined
    this.tasksProcessed = 0
    this.appendLog('Agent supervisor stopped')

    return ok(undefined)
  }

  /**
   * Get current supervisor status.
   */
  status(): AgentStatus {
    const pid = this.readPid()
    const running = pid !== undefined && this.isProcessAlive(pid)

    if (!running) {
      return {
        running: false,
        pid: undefined,
        uptime: undefined,
        activeAgents: 0,
        tasksProcessed: 0,
        memoryUsageMb: 0,
      }
    }

    const uptimeMs = this.startTime !== undefined ? Date.now() - this.startTime : 0
    const uptime = this.formatUptime(uptimeMs)
    const memUsage = process.memoryUsage()
    const memoryUsageMb = Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100

    return {
      running: true,
      pid,
      uptime,
      activeAgents: 0,
      tasksProcessed: this.tasksProcessed,
      memoryUsageMb,
    }
  }

  /**
   * Increment the tasks processed counter.
   */
  incrementTasksProcessed(): void {
    this.tasksProcessed++
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private readPid(): number | undefined {
    try {
      if (!existsSync(this.pidPath)) return undefined
      const content = readFileSync(this.pidPath, 'utf-8').trim()
      const pid = parseInt(content, 10)
      return isNaN(pid) ? undefined : pid
    } catch {
      return undefined
    }
  }

  private writePid(pid: number): void {
    writeFileSync(this.pidPath, String(pid), 'utf-8')
  }

  private removePidFile(): void {
    try {
      if (existsSync(this.pidPath)) {
        unlinkSync(this.pidPath)
      }
    } catch {
      // Ignore — file may already be removed
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  private appendLog(message: string): void {
    try {
      const timestamp = new Date().toISOString()
      appendFileSync(this.logPath, `[${timestamp}] ${message}\n`, 'utf-8')
    } catch {
      // Logging failure must not block operations
    }
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }
}
