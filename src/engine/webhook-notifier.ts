/**
 * Webhook notifier -- fire-and-forget notifications for pipeline stage completion.
 * @module engine/webhook-notifier
 * @see FR-1507 -- Webhook Notifications
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AuditLogger } from '../foundation/audit.js'

// ---------------------------------------------------------------------------
// Types (local to this module -- not exported to contracts/)
// ---------------------------------------------------------------------------

/** Pipeline stage events that can trigger a webhook notification */
export type WebhookEvent = 'specify' | 'plan' | 'execute' | 'verify'

/** Status of a pipeline stage completion */
export type WebhookStatus = 'success' | 'failure'

/** JSON payload sent to the webhook endpoint (Slack-compatible) */
export interface WebhookPayload {
  /** Slack-compatible text field -- human-readable summary */
  text: string
  /** Machine-readable event name */
  event: WebhookEvent
  /** Outcome of the pipeline stage */
  status: WebhookStatus
  /** ISO 8601 timestamp */
  timestamp: string
  /** Aggregated metrics for the stage */
  summary: {
    taskCount: number
    costUsd: number
    durationMs: number
  }
  /** Project name from config.yaml */
  projectName: string
}

/** Notification configuration read from .buildpact/config.yaml */
export interface NotificationConfig {
  webhookUrl: string
  events: WebhookEvent[]
}

/** All valid pipeline stage names */
const ALL_EVENTS: readonly WebhookEvent[] = ['specify', 'plan', 'execute', 'verify']

// ---------------------------------------------------------------------------
// Config reader (mirrors readBudgetConfig pattern in budget-guard.ts)
// ---------------------------------------------------------------------------

/**
 * Read notification config from .buildpact/config.yaml.
 * Returns null when notifications are not configured or the URL is invalid.
 *
 * @param projectDir - Project root directory
 * @param fileReader - Injectable file reader for testability
 */
export async function readNotificationConfig(
  projectDir: string,
  fileReader: (path: string, encoding: BufferEncoding) => Promise<string> = (p, e) => readFile(p, e),
): Promise<NotificationConfig | null> {
  try {
    const content = await fileReader(
      join(projectDir, '.buildpact', 'config.yaml'),
      'utf-8',
    )
    let inNotifications = false
    let webhook: string | undefined
    const events: string[] = []
    let inEvents = false

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === 'notifications:') {
        inNotifications = true
        continue
      }
      if (!inNotifications) continue
      // End of block: non-indented, non-empty, non-comment line
      if (
        !line.startsWith(' ') &&
        !line.startsWith('\t') &&
        trimmed.length > 0 &&
        !trimmed.startsWith('#')
      ) {
        break
      }
      if (trimmed.startsWith('webhook:')) {
        webhook = trimmed.slice('webhook:'.length).trim().replace(/^["']|["']$/g, '')
      }
      if (trimmed === 'events:') {
        inEvents = true
        continue
      }
      if (inEvents && trimmed.startsWith('- ')) {
        events.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''))
      } else if (inEvents && !trimmed.startsWith('#') && trimmed.length > 0) {
        inEvents = false
      }
    }

    if (!webhook) return null

    // Validate URL
    try {
      new URL(webhook)
    } catch {
      return null
    }
    if (!webhook.startsWith('http://') && !webhook.startsWith('https://')) return null

    // Filter to valid event names
    const validEvents = events.filter((e): e is WebhookEvent =>
      (ALL_EVENTS as readonly string[]).includes(e),
    )

    return {
      webhookUrl: webhook,
      events: validEvents.length > 0 ? validEvents : [...ALL_EVENTS],
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

/** Format duration in milliseconds to a human-readable string */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

/**
 * Build a Slack-compatible webhook payload.
 */
export function buildWebhookPayload(
  event: WebhookEvent,
  status: WebhookStatus,
  projectName: string,
  summary: { taskCount?: number; costUsd?: number; durationMs?: number } = {},
): WebhookPayload {
  const taskCount = summary.taskCount ?? 0
  const costUsd = summary.costUsd ?? 0
  const durationMs = summary.durationMs ?? 0

  const statusText = status === 'success' ? 'completed successfully' : 'failed'
  const parts: string[] = []
  if (taskCount > 0) parts.push(`${taskCount} task${taskCount === 1 ? '' : 's'}`)
  if (costUsd > 0) parts.push(`$${costUsd.toFixed(2)}`)
  if (durationMs > 0) parts.push(formatDuration(durationMs))
  const detail = parts.length > 0 ? ` -- ${parts.join(', ')}` : ''

  return {
    text: `[BuildPact] ${event} ${statusText}${detail}`,
    event,
    status,
    timestamp: new Date().toISOString(),
    summary: { taskCount, costUsd, durationMs },
    projectName,
  }
}

// ---------------------------------------------------------------------------
// Fire-and-forget sender with single retry
// ---------------------------------------------------------------------------

/**
 * Send a webhook payload with a single retry on failure.
 * Logs outcomes to the audit trail. Never throws.
 */
export async function sendWithRetry(
  url: string,
  payload: WebhookPayload,
  audit: AuditLogger,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      })
      if (response.ok) {
        await audit.log({
          action: 'webhook.send.success',
          agent: 'notifier',
          files: [],
          outcome: 'success',
        })
        return
      }
      // Non-2xx -- treat as failure, fall through to retry
    } catch {
      // Network error -- fall through to retry
    }
    if (attempt === 0) {
      await audit.log({
        action: 'webhook.send.retry',
        agent: 'notifier',
        files: [],
        outcome: 'failure',
      })
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  await audit.log({
    action: 'webhook.send.failed',
    agent: 'notifier',
    files: [],
    outcome: 'failure',
    error: 'Webhook delivery failed after single retry',
  })
}

// ---------------------------------------------------------------------------
// Orchestrator integration point
// ---------------------------------------------------------------------------

/**
 * Notify a pipeline stage completion via webhook.
 * Fire-and-forget: this function catches all errors internally.
 * Call without `await` or use `void notifyStageCompletion(...)`.
 *
 * @param projectDir - Project root directory
 * @param event - Pipeline stage that completed
 * @param status - Whether the stage succeeded or failed
 * @param projectName - Project name for the payload
 * @param summary - Optional execution metrics
 * @param fileReader - Injectable file reader for testability
 */
export async function notifyStageCompletion(
  projectDir: string,
  event: WebhookEvent,
  status: WebhookStatus,
  projectName: string,
  summary: { taskCount?: number; costUsd?: number; durationMs?: number } = {},
  fileReader?: (path: string, encoding: BufferEncoding) => Promise<string>,
): Promise<void> {
  try {
    const config = await readNotificationConfig(projectDir, fileReader)
    if (!config) return

    // Check event filter
    if (!config.events.includes(event)) return

    const payload = buildWebhookPayload(event, status, projectName, summary)
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'webhook.jsonl'))
    await sendWithRetry(config.webhookUrl, payload, audit)
  } catch {
    // Swallow all errors -- webhook must never block the pipeline
  }
}
