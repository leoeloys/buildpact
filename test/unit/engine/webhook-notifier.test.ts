import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  readNotificationConfig,
  buildWebhookPayload,
  sendWithRetry,
  notifyStageCompletion,
} from '../../../src/engine/webhook-notifier.js'
import type { NotificationConfig, WebhookPayload } from '../../../src/engine/webhook-notifier.js'
import { AuditLogger } from '../../../src/foundation/audit.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAudit() {
  return { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogger
}

function configYaml(opts: { webhook?: string; events?: string[] } = {}): string {
  const lines = [
    'buildpact_schema: 1',
    'project_name: "test-project"',
  ]
  if (opts.webhook !== undefined) {
    lines.push('notifications:')
    lines.push(`  webhook: "${opts.webhook}"`)
    if (opts.events) {
      lines.push('  events:')
      for (const e of opts.events) lines.push(`    - ${e}`)
    }
  }
  return lines.join('\n')
}

function fakeReader(content: string) {
  return vi.fn().mockResolvedValue(content)
}

function fakeReaderNotFound() {
  return vi.fn().mockRejectedValue(new Error('ENOENT'))
}

// ---------------------------------------------------------------------------
// readNotificationConfig
// ---------------------------------------------------------------------------

describe('readNotificationConfig', () => {
  it('returns config when webhook is set', async () => {
    const reader = fakeReader(configYaml({ webhook: 'https://hooks.slack.com/T/B/x' }))
    const config = await readNotificationConfig('/proj', reader)
    expect(config).not.toBeNull()
    expect(config!.webhookUrl).toBe('https://hooks.slack.com/T/B/x')
    expect(config!.events).toEqual(['specify', 'plan', 'execute', 'verify'])
  })

  it('respects custom event filter', async () => {
    const reader = fakeReader(
      configYaml({ webhook: 'https://example.com/hook', events: ['execute', 'verify'] }),
    )
    const config = await readNotificationConfig('/proj', reader)
    expect(config!.events).toEqual(['execute', 'verify'])
  })

  it('returns null when no notifications section', async () => {
    const reader = fakeReader('buildpact_schema: 1\nproject_name: "test"\n')
    const config = await readNotificationConfig('/proj', reader)
    expect(config).toBeNull()
  })

  it('returns null when webhook is missing', async () => {
    const reader = fakeReader('notifications:\n  events:\n    - execute\n')
    const config = await readNotificationConfig('/proj', reader)
    expect(config).toBeNull()
  })

  it('returns null for invalid URL', async () => {
    const reader = fakeReader(configYaml({ webhook: 'not-a-url' }))
    const config = await readNotificationConfig('/proj', reader)
    expect(config).toBeNull()
  })

  it('returns null for ftp:// URL', async () => {
    const reader = fakeReader(configYaml({ webhook: 'ftp://example.com/hook' }))
    const config = await readNotificationConfig('/proj', reader)
    expect(config).toBeNull()
  })

  it('returns null when config file does not exist', async () => {
    const reader = fakeReaderNotFound()
    const config = await readNotificationConfig('/proj', reader)
    expect(config).toBeNull()
  })

  it('ignores invalid event names in filter', async () => {
    const reader = fakeReader(
      configYaml({ webhook: 'https://example.com/hook', events: ['execute', 'bogus'] }),
    )
    const config = await readNotificationConfig('/proj', reader)
    expect(config!.events).toEqual(['execute'])
  })

  it('defaults to all events when filter has only invalid names', async () => {
    const reader = fakeReader(
      configYaml({ webhook: 'https://example.com/hook', events: ['bogus', 'nope'] }),
    )
    const config = await readNotificationConfig('/proj', reader)
    expect(config!.events).toEqual(['specify', 'plan', 'execute', 'verify'])
  })
})

// ---------------------------------------------------------------------------
// buildWebhookPayload
// ---------------------------------------------------------------------------

describe('buildWebhookPayload', () => {
  it('builds payload with all fields', () => {
    const payload = buildWebhookPayload('execute', 'success', 'my-project', {
      taskCount: 5,
      costUsd: 0.42,
      durationMs: 45000,
    })
    expect(payload.event).toBe('execute')
    expect(payload.status).toBe('success')
    expect(payload.projectName).toBe('my-project')
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(payload.summary).toEqual({ taskCount: 5, costUsd: 0.42, durationMs: 45000 })
  })

  it('generates Slack-compatible text for success', () => {
    const payload = buildWebhookPayload('execute', 'success', 'proj', {
      taskCount: 5,
      costUsd: 0.42,
      durationMs: 45000,
    })
    expect(payload.text).toBe('[BuildPact] execute completed successfully -- 5 tasks, $0.42, 45s')
  })

  it('generates Slack-compatible text for failure', () => {
    const payload = buildWebhookPayload('verify', 'failure', 'proj', {
      taskCount: 3,
      costUsd: 0.08,
      durationMs: 22000,
    })
    expect(payload.text).toBe('[BuildPact] verify failed -- 3 tasks, $0.08, 22s')
  })

  it('handles zero/missing summary gracefully', () => {
    const payload = buildWebhookPayload('plan', 'success', 'proj')
    expect(payload.text).toBe('[BuildPact] plan completed successfully')
    expect(payload.summary).toEqual({ taskCount: 0, costUsd: 0, durationMs: 0 })
  })

  it('handles singular task count', () => {
    const payload = buildWebhookPayload('specify', 'success', 'proj', { taskCount: 1 })
    expect(payload.text).toContain('1 task')
  })

  it('formats durations in minutes', () => {
    const payload = buildWebhookPayload('execute', 'success', 'proj', { durationMs: 125000 })
    expect(payload.text).toContain('2m 5s')
  })
})

// ---------------------------------------------------------------------------
// sendWithRetry
// ---------------------------------------------------------------------------

describe('sendWithRetry', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const payload: WebhookPayload = {
    text: 'test',
    event: 'execute',
    status: 'success',
    timestamp: '2026-01-01T00:00:00Z',
    summary: { taskCount: 1, costUsd: 0.01, durationMs: 1000 },
    projectName: 'test-proj',
  }

  it('sends POST with JSON and logs success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const audit = mockAudit()

    await sendWithRetry('https://example.com/hook', payload, audit)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/hook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: expect.any(AbortSignal),
    })
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'webhook.send.success', outcome: 'success' }),
    )
  })

  it('retries once on network error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const audit = mockAudit()

    await sendWithRetry('https://example.com/hook', payload, audit)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'webhook.send.retry' }),
    )
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'webhook.send.success' }),
    )
  })

  it('retries once on non-2xx then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const audit = mockAudit()

    await sendWithRetry('https://example.com/hook', payload, audit)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'webhook.send.success' }),
    )
  })

  it('logs failure after retry exhaustion', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fail'))
    vi.stubGlobal('fetch', fetchMock)
    const audit = mockAudit()

    await sendWithRetry('https://example.com/hook', payload, audit)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'webhook.send.retry', outcome: 'failure' }),
    )
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'webhook.send.failed',
        outcome: 'failure',
        error: 'Webhook delivery failed after single retry',
      }),
    )
  })

  it('does not throw even when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('kaboom')))
    const audit = mockAudit()

    await expect(
      sendWithRetry('https://example.com/hook', payload, audit),
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// notifyStageCompletion (integration)
// ---------------------------------------------------------------------------

describe('notifyStageCompletion', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('sends webhook when configured and event matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const reader = fakeReader(configYaml({ webhook: 'https://example.com/hook' }))

    await notifyStageCompletion('/proj', 'execute', 'success', 'my-proj', {}, reader)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not send when event is not in filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const reader = fakeReader(
      configYaml({ webhook: 'https://example.com/hook', events: ['execute'] }),
    )

    await notifyStageCompletion('/proj', 'plan', 'success', 'my-proj', {}, reader)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send when no webhook configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const reader = fakeReader('buildpact_schema: 1\n')

    await notifyStageCompletion('/proj', 'execute', 'success', 'my-proj', {}, reader)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows all errors without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')))
    const reader = fakeReader(configYaml({ webhook: 'https://example.com/hook' }))

    await expect(
      notifyStageCompletion('/proj', 'execute', 'success', 'my-proj', {}, reader),
    ).resolves.toBeUndefined()
  })
})
