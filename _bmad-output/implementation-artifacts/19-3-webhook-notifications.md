# Story 19.3: Webhook Notifications

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a team using Slack/Discord for project communication,
I want BuildPact to send execution event notifications to a webhook URL,
So that my team is notified when pipeline stages complete or fail.

**FR Reference:** FR-1507 (Priority: SHOULD)
**Epic:** 19 — CI/CD Integration & Automation

## Acceptance Criteria

**AC-1: Pipeline stage completion sends JSON POST to configured webhook**

Given a webhook URL in `.buildpact/config.yaml` under `notifications.webhook`,
When a pipeline stage completes (specify, plan, execute, verify),
Then a POST request is sent with JSON payload containing: `event` (stage name), `status` ("success" | "failure"), `timestamp` (ISO 8601), `summary` (object with `taskCount`, `costUsd`, `durationMs`), and `projectName`,
And the request uses `Content-Type: application/json`.

**AC-2: Payload is Slack-compatible**

Given the webhook URL points to a Slack-compatible endpoint,
When a notification is sent,
Then the payload includes a `text` field with a human-readable summary (e.g., `"[BuildPact] execute completed successfully — 5 tasks, $0.12, 45s"`),
And the payload structure is compatible with Slack's incoming webhook API.

**AC-3: Failure is fire-and-forget with single retry**

Given the webhook endpoint is unreachable or returns a non-2xx status,
When notification delivery fails,
Then BuildPact retries once after a 1-second delay,
And if the retry also fails, a warning is logged to the audit trail,
And the pipeline is NOT blocked or failed — execution continues normally.

**AC-4: Selective event filtering**

Given the user sets `notifications.events: [execute, verify]` in config.yaml,
When only execute and verify stage completions happen,
Then only those stages trigger webhook notifications,
And specify/plan completions do NOT trigger notifications.

**AC-5: No-op when webhook is not configured**

Given `notifications.webhook` is not configured in `.buildpact/config.yaml`,
When any pipeline stage completes,
Then no webhook request is attempted,
And no error or warning is logged.

## Tasks / Subtasks

- [x] Task 1: Create webhook notifier module (AC: 1, 2, 3)
  - [x] 1.1: Create `src/engine/webhook-notifier.ts` with a `WebhookNotifier` class that accepts a webhook URL and optional event filter
  - [x] 1.2: Implement `notify(event: WebhookEvent): Promise<void>` — builds the JSON payload with `event`, `status`, `timestamp`, `summary`, `projectName`, and `text` (Slack-compatible field)
  - [x] 1.3: Implement fire-and-forget delivery using Node.js built-in `fetch` — catch errors, do NOT await in the caller's critical path
  - [x] 1.4: Implement single retry logic: on first failure (network error or non-2xx), wait 1 second, retry once; on second failure, log warning via AuditLogger and give up
  - [x] 1.5: Add `WebhookPayload` and `WebhookEvent` type definitions in the same module (no changes to contracts/)

- [x] Task 2: Read notification config from config.yaml (AC: 4, 5)
  - [x] 2.1: Create `readNotificationConfig(projectDir): Promise<NotificationConfig | null>` in `src/engine/webhook-notifier.ts` — reads `notifications.webhook` (URL string) and `notifications.events` (string array) from `.buildpact/config.yaml` using the same YAML line-parsing pattern as `readBudgetConfig()` in `src/engine/budget-guard.ts`
  - [x] 2.2: Return `null` when the `notifications:` section is absent or `webhook:` is not set — callers skip notification entirely
  - [x] 2.3: Default `events` to all stages (`['specify', 'plan', 'execute', 'verify']`) when `notifications.events` is not configured
  - [x] 2.4: Validate the webhook URL is a valid HTTP(S) URL; log a warning and return `null` if invalid

- [x] Task 3: Integrate notifier into orchestrator (AC: 1, 4, 5)
  - [x] 3.1: Add a `notifyStageCompletion()` function in `src/engine/orchestrator.ts` that reads config, checks event filter, and calls `WebhookNotifier.notify()` — this is the single integration point for all pipeline stages
  - [x] 3.2: Export `notifyStageCompletion(projectDir, event)` so command handlers can call it after their work completes, keeping the orchestrator as the integration layer
  - [x] 3.3: Ensure `notifyStageCompletion()` is fully fire-and-forget: call it without `await` from command handlers (or use `.catch()` to swallow), so the pipeline never blocks on webhook delivery

- [x] Task 4: Audit logging for webhook events (AC: 3)
  - [x] 4.1: Log `webhook.send.success` to `AuditLogger` at `.buildpact/audit/webhook.jsonl` on successful delivery
  - [x] 4.2: Log `webhook.send.retry` on first failure before retrying
  - [x] 4.3: Log `webhook.send.failed` with the error message on final failure (after retry exhausted)

- [x] Task 5: Add config.yaml template section (AC: 4, 5)
  - [x] 5.1: Add commented-out `notifications:` section to `templates/config.yaml` with `webhook:` and `events:` keys showing the format and defaults

- [x] Task 6: Add i18n strings (AC: 3)
  - [x] 6.1: Add `warn.webhook.delivery_failed` key to `locales/en.yaml` — "Webhook notification failed after retry — pipeline continues normally"
  - [x] 6.2: Add `warn.webhook.invalid_url` key to `locales/en.yaml` — "Webhook URL is not a valid HTTP(S) URL — notifications disabled"
  - [x] 6.3: Add corresponding keys to `locales/pt-br.yaml`

- [x] Task 7: Write unit tests (AC: 1, 2, 3, 4, 5)
  - [x] 7.1: Create `test/unit/engine/webhook-notifier.test.ts`
  - [x] 7.2: Test payload structure: verify `event`, `status`, `timestamp`, `summary`, `projectName`, and `text` fields are present and correctly formatted
  - [x] 7.3: Test Slack compatibility: verify `text` field contains a readable summary string
  - [x] 7.4: Test fire-and-forget: mock `fetch` to reject, verify no exception propagates to caller
  - [x] 7.5: Test single retry: mock `fetch` to fail once then succeed, verify two calls were made
  - [x] 7.6: Test retry exhaustion: mock `fetch` to fail twice, verify audit warning is logged
  - [x] 7.7: Test event filtering: configure `events: ['execute']`, verify `plan` completion does NOT trigger fetch
  - [x] 7.8: Test no-op when config has no webhook URL: verify `fetch` is never called
  - [x] 7.9: Test config parsing: verify `readNotificationConfig` handles missing section, partial config, invalid URL
  - [x] 7.10: Test `notifyStageCompletion()` orchestrator integration: verify it reads config, filters, and delegates to notifier

## Dev Notes

### Architecture Requirements

**Single integration point at the orchestrator level** — webhook notifications are NOT scattered across individual command handlers. Instead, `notifyStageCompletion()` lives in `src/engine/orchestrator.ts` and each command handler calls it once at the end of its work. This keeps notification logic centralized and testable.

**Fire-and-forget is critical** — The webhook call MUST NOT block the pipeline. Use either:
- Call without `await` and attach `.catch(() => {})` to prevent unhandled rejection
- Or wrap in a `void` expression: `void notifyStageCompletion(...)`

The retry delay (1 second) happens inside the notifier, not in the caller's code path.

**No new dependencies** — Use Node.js 20+ built-in `fetch` (globally available). Do NOT import `node-fetch`, `axios`, `got`, or any HTTP library.

### Existing Code to Reuse (DO NOT Reinvent)

| Component | Location | Reuse How |
|-----------|----------|-----------|
| `readBudgetConfig()` | `src/engine/budget-guard.ts` | Pattern for reading YAML sections with line-by-line parsing |
| `AuditLogger` | `src/foundation/audit.ts` | Log webhook delivery outcomes to `.buildpact/audit/webhook.jsonl` |
| `orchestrator.ts` | `src/engine/orchestrator.ts` | Add `notifyStageCompletion()` here |
| `ERROR_CODES` | `src/contracts/errors.ts` | Reference only — no new error codes needed (webhook failures are warnings, not errors) |
| `createI18n()` | `src/foundation/i18n.ts` | Resolve warning message keys |

### Key Implementation Details

**Webhook payload shape:**
```typescript
interface WebhookPayload {
  /** Slack-compatible text field — human-readable summary */
  text: string
  /** Machine-readable event name: 'specify' | 'plan' | 'execute' | 'verify' */
  event: string
  /** Outcome: 'success' | 'failure' */
  status: string
  /** ISO 8601 timestamp */
  timestamp: string
  /** Aggregated metrics */
  summary: {
    taskCount: number
    costUsd: number
    durationMs: number
  }
  /** From config.yaml project_name */
  projectName: string
}
```

**Slack-compatible `text` field format:**
```
[BuildPact] execute completed successfully — 5 tasks, $0.12, 45s
[BuildPact] verify failed — 3 tasks, $0.08, 22s
```

**Config.yaml notifications section:**
```yaml
notifications:
  webhook: "https://hooks.slack.com/services/T00/B00/xxx"
  events:
    - execute
    - verify
```

**Config reader pattern** (mirrors `readBudgetConfig` in `budget-guard.ts`):
```typescript
export async function readNotificationConfig(
  projectDir: string,
): Promise<NotificationConfig | null> {
  try {
    const content = await readFile(
      join(projectDir, '.buildpact', 'config.yaml'), 'utf-8',
    )
    let inNotifications = false
    let webhook: string | undefined
    const events: string[] = []
    let inEvents = false

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === 'notifications:') { inNotifications = true; continue }
      if (!inNotifications) continue
      // End of block
      if (!line.startsWith(' ') && !line.startsWith('\t')
          && trimmed.length > 0 && !trimmed.startsWith('#')) {
        break
      }
      if (trimmed.startsWith('webhook:')) {
        webhook = trimmed.slice('webhook:'.length).trim().replace(/^["']|["']$/g, '')
      }
      if (trimmed === 'events:') { inEvents = true; continue }
      if (inEvents && trimmed.startsWith('- ')) {
        events.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''))
      } else if (inEvents && !trimmed.startsWith('#')) {
        inEvents = false
      }
    }

    if (!webhook) return null
    // Validate URL
    try { new URL(webhook) } catch { return null }
    if (!webhook.startsWith('http://') && !webhook.startsWith('https://')) return null

    return {
      webhookUrl: webhook,
      events: events.length > 0 ? events : ['specify', 'plan', 'execute', 'verify'],
    }
  } catch {
    return null
  }
}
```

**Fire-and-forget with retry pattern:**
```typescript
async function sendWithRetry(url: string, payload: WebhookPayload, audit: AuditLogger): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        await audit.log({ action: 'webhook.send.success', agent: 'notifier', files: [], outcome: 'success' })
        return
      }
      // Non-2xx — treat as failure, retry
    } catch {
      // Network error — retry
    }
    if (attempt === 0) {
      await audit.log({ action: 'webhook.send.retry', agent: 'notifier', files: [], outcome: 'failure' })
      await new Promise(r => setTimeout(r, 1000))
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
```

### Anti-Patterns to Avoid

- **Do NOT use axios, node-fetch, or any HTTP library** — use built-in `fetch`
- **Do NOT block the pipeline on webhook delivery** — fire-and-forget
- **Do NOT send webhook for every sub-task** — only for pipeline stage completion (specify, plan, execute, verify)
- **Do NOT store webhook responses** — log success/failure and move on
- **Do NOT add notification types to `src/contracts/`** — keep types local to the notifier module
- **Do NOT add new ERROR_CODES** — webhook failures are warnings, not pipeline errors

### Previous Story Learnings

- **exactOptionalPropertyTypes** — do not assign `undefined` to optional fields; use conditional object spread
- **Injectable I/O pattern** — the config reader should accept an optional injected file reader for testability
- **ESM imports** — always use `.js` extension in import paths
- **Factory + opts() helpers** in tests for DRY fixtures
- **Audit log paths** — use separate JSONL files per concern (e.g., `webhook.jsonl`), not the main `cli.jsonl`

### Project Structure Notes

```
src/engine/webhook-notifier.ts           (new) — WebhookNotifier, readNotificationConfig, types
src/engine/orchestrator.ts               (modify) — add notifyStageCompletion()
templates/config.yaml                    (modify) — add commented notifications section
locales/en.yaml                          (modify) — add warn.webhook.* keys
locales/pt-br.yaml                       (modify) — add warn.webhook.* keys
test/unit/engine/webhook-notifier.test.ts (new) — full test suite
```

### Testing Strategy

**Mock `fetch` globally** — since `fetch` is a global in Node 20+, use `vi.stubGlobal('fetch', mockFetch)` in Vitest to intercept all HTTP calls without touching real endpoints.

**Mock `AuditLogger`** — inject a mock or spy on `AuditLogger.prototype.log` to verify audit entries are written for success, retry, and failure scenarios.

**Config parsing tests** — use inline YAML strings (no file system needed) by injecting a mock file reader.

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-1507] — Webhook Notifications
- [Source: src/engine/budget-guard.ts] — Config.yaml reading pattern (readBudgetConfig)
- [Source: src/foundation/audit.ts] — AuditLogger class
- [Source: src/engine/orchestrator.ts] — Pipeline orchestrator integration point
- [Source: _bmad-output/implementation-artifacts/13-3-live-wave-execution-with-concurrency.md] — Related: execution config pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 + Claude Sonnet 4.6

### Debug Log References

### Completion Notes List

- WebhookNotifier module with readNotificationConfig, buildPayload, sendWithRetry, notifyWebhook
- Fire-and-forget delivery with single retry + 1s delay
- Slack-compatible payload with `text` field
- Event filtering via `notifications.events` config
- No-op when webhook not configured
- AuditLogger integration for success/retry/failure logging
- notifyStageCompletion() added to orchestrator.ts
- Config template updated with commented notifications section
- i18n keys added for both EN and PT-BR
- 24 unit tests covering all ACs

### File List

- src/engine/webhook-notifier.ts (new)
- src/engine/orchestrator.ts (modified)
- templates/config.yaml (modified)
- locales/en.yaml (modified)
- locales/pt-br.yaml (modified)
- test/unit/engine/webhook-notifier.test.ts (new)

### Change Log
- Story created by create-story workflow (Date: 2026-03-22)
- Implementation completed (Date: 2026-03-22)
