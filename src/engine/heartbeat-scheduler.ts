/**
 * Heartbeat Scheduler — cron-like scheduling and run lifecycle for agents.
 * Pure state machines: create config, queue runs, transition through statuses.
 * @module engine/heartbeat-scheduler
 * @see BuildPact concept 14.4
 */

import type { HeartbeatConfig, HeartbeatRun } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateRunId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `HBR-${ts}-${rand}`
}

// ---------------------------------------------------------------------------
// Config creation
// ---------------------------------------------------------------------------

/**
 * Create a heartbeat configuration for an agent.
 */
export function createHeartbeatConfig(
  agentId: string,
  schedule: string,
  maxConcurrent?: number,
): HeartbeatConfig {
  return {
    agentId,
    schedule,
    maxConcurrentRuns: maxConcurrent ?? 1,
    enabled: true,
  }
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a new heartbeat run in 'queued' status.
 */
export function createHeartbeatRun(
  agentId: string,
  trigger: HeartbeatRun['trigger'],
): HeartbeatRun {
  return {
    id: generateRunId(),
    agentId,
    trigger,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'queued',
    summary: null,
  }
}

/**
 * Transition a run to 'running' status.
 */
export function startRun(run: HeartbeatRun): HeartbeatRun {
  return {
    ...run,
    status: 'running',
    startedAt: new Date().toISOString(),
  }
}

/**
 * Transition a run to 'completed' status with a summary.
 */
export function completeRun(run: HeartbeatRun, summary: string): HeartbeatRun {
  return {
    ...run,
    status: 'completed',
    finishedAt: new Date().toISOString(),
    summary,
  }
}

/**
 * Transition a run to 'failed' status with an error description.
 */
export function failRun(run: HeartbeatRun, error: string): HeartbeatRun {
  return {
    ...run,
    status: 'failed',
    finishedAt: new Date().toISOString(),
    summary: error,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Check if any run in the list is currently running.
 */
export function isRunning(runs: readonly HeartbeatRun[]): boolean {
  return runs.some(r => r.status === 'running')
}
