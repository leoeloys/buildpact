# Story 13.3: Live Wave Execution with Concurrency

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a framework developer enabling live AI execution,
I want wave execution to support configurable concurrency limits and per-task timeouts,
so that real API calls execute safely within resource constraints without overwhelming provider rate limits.

## Acceptance Criteria

**AC-1: Tasks within a wave execute truly in parallel via Promise.all with the resolved provider**

Given a wave contains N tasks and a live SubagentProvider is resolved,
When `executeWave()` dispatches the wave,
Then all N tasks are dispatched concurrently via `Promise.all()` through the provider,
And the wave completes only when all N tasks have resolved (success or failure),
And the execution uses the provider returned by `resolveProvider()`.

**AC-2: Waves execute sequentially — wave N+1 only starts after wave N completes**

Given a plan contains multiple waves (wave 0, wave 1, wave 2),
When the execute handler runs the wave loop,
Then wave 1 does not begin until wave 0 has fully completed (all tasks resolved),
And wave 2 does not begin until wave 1 has fully completed,
And this ordering is enforced even when tasks complete at different speeds.

**AC-3: Task results are collected and aggregated into WaveExecutionResult correctly**

Given a wave completes with a mix of successful and failed tasks,
When results are aggregated,
Then `WaveExecutionResult.results` contains one `TaskExecutionResult` per dispatched task,
And `WaveExecutionResult.allPassed` is `true` only when every task succeeded,
And each result preserves `tokensUsed`, `costUsd`, `commitMessage`, and `artifacts` from the provider response.

**AC-4: Wave failure halts pipeline execution when haltOnFailure is set**

Given `haltOnFailure` is enabled (default behavior),
When any task in a wave fails,
Then `WaveExecutionResult.allPassed` is `false`,
And the execute handler stops processing subsequent waves,
And the user sees a clear error indicating which task(s) failed and in which wave.

**AC-5: Concurrency limit is configurable (max parallel tasks per wave, default unlimited)**

Given the user configures `execution.max_parallel_tasks` in `.buildpact/config.yaml`,
When a wave with N tasks is dispatched and max_parallel_tasks is set to M (M < N),
Then at most M tasks execute concurrently at any given time,
And the remaining N-M tasks wait in a queue and execute as slots become available,
And when no limit is configured, all N tasks execute concurrently (current behavior).

**AC-6: Per-task timeout prevents indefinite hangs**

Given a task is dispatched to a live provider,
When the task exceeds the configured timeout (default 120 seconds),
Then the task is aborted and marked as failed with a timeout error,
And the timeout error is an actionable i18n message,
And remaining tasks in the wave continue executing.

## Tasks / Subtasks

- [ ] Task 1: Add concurrency limiter to executeWave (AC: 1, 5)
  - [ ] 1.1: Create `pLimit`-style concurrency limiter in `src/engine/concurrency.ts` — accepts `maxConcurrency: number` parameter, returns a `limit(fn)` wrapper that queues promises beyond the concurrency cap
  - [ ] 1.2: Add `maxParallelTasks?: number` parameter to `executeWave()` signature in `src/engine/wave-executor.ts`
  - [ ] 1.3: When `maxParallelTasks` is set, wrap each `provider.dispatch()` call in the concurrency limiter; when unset, use `Promise.all()` directly (current behavior)
  - [ ] 1.4: Write unit tests: verify concurrency limiting with 5 tasks and limit of 2 (use timing assertions or dispatch order tracking)

- [ ] Task 2: Add per-task timeout handling (AC: 6)
  - [ ] 2.1: Add `taskTimeoutMs?: number` parameter to `executeWave()` signature (default: 120000)
  - [ ] 2.2: Wrap each `provider.dispatch()` call in a `Promise.race([dispatch, timeout])` pattern — on timeout, return a failed `TaskResult` with timeout error
  - [ ] 2.3: Add `ERROR_CODES.TASK_TIMEOUT` to `src/contracts/errors.ts`
  - [ ] 2.4: Add i18n keys `error.execute.task_timeout` in both `locales/en.yaml` and `locales/pt-br.yaml`
  - [ ] 2.5: Write unit tests: verify timeout fires correctly, other tasks continue

- [ ] Task 3: Read concurrency and timeout config from config.yaml (AC: 5, 6)
  - [ ] 3.1: Add `readExecutionConfig(projectDir): Promise<ExecutionConfig>` to `src/engine/budget-guard.ts` or a new `src/engine/execution-config.ts` — reads `execution.max_parallel_tasks` and `execution.task_timeout_seconds` from `.buildpact/config.yaml`
  - [ ] 3.2: Update execute handler to read execution config and pass `maxParallelTasks` and `taskTimeoutMs` to `executeWave()`
  - [ ] 3.3: Update `templates/config.yaml` with commented-out `execution:` section showing defaults
  - [ ] 3.4: Write unit tests for config reading with and without execution section

- [ ] Task 4: Verify sequential wave ordering with async operations (AC: 2, 3, 4)
  - [ ] 4.1: Write integration-style test: 3 waves with varying task counts, verify wave ordering by tracking dispatch timestamps
  - [ ] 4.2: Write test: wave with mixed success/failure, verify `allPassed` is `false` and subsequent waves are skipped when `haltOnFailure` is true
  - [ ] 4.3: Write test: verify `WaveExecutionResult.results` preserves all fields (tokensUsed, costUsd, commitMessage, artifacts) from provider response
  - [ ] 4.4: Verify existing wave-executor tests still pass with new parameters (backward compatibility — new params are optional)

## Dev Notes

### Architecture Requirements

**Story 13-1 already implemented the core async dispatch** — `executeWave()` is async and uses `Promise.all()` with provider injection. This story layers on top: concurrency limiting, timeout handling, and config-driven execution parameters.

**Concurrency limiter should be lightweight** — avoid adding `p-limit` as a dependency. A simple queue-based limiter (~30 lines) is sufficient. The pattern: maintain a running count, queue excess promises, dequeue as slots free up.

**Timeout must not kill the process** — use `AbortController` or `Promise.race` with a timer. On timeout, the task result should be a clean failure (not an unhandled rejection).

### Existing Code to Reuse (DO NOT Reinvent)

| Component | Location | Reuse How |
|-----------|----------|-----------|
| `executeWave()` | `src/engine/wave-executor.ts` | Add optional params, wrap dispatch |
| `executeWaves()` | `src/engine/wave-executor.ts` | Already handles sequential wave ordering |
| `SubagentProvider.dispatch()` | `src/contracts/provider.ts` | Wrap with concurrency + timeout |
| `resolveProvider()` | `src/engine/providers/index.ts` | Already called in execute handler |
| `readBudgetConfig()` | `src/engine/budget-guard.ts` | Pattern for reading config.yaml sections |
| `WaveExecutionResult` | `src/engine/wave-executor.ts` | Aggregation type — already correct |
| `ERROR_CODES` | `src/contracts/errors.ts` | Add TASK_TIMEOUT |
| `Result<T, CliError>` | `src/contracts/errors.ts` | Return type for config reading |

### Key Implementation Details

**Concurrency limiter pattern:**
```typescript
function createLimiter(max: number) {
  let running = 0
  const queue: (() => void)[] = []
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const run = () => {
        running++
        fn().then(resolve, reject).finally(() => {
          running--
          if (queue.length > 0) queue.shift()!()
        })
      }
      running < max ? run() : queue.push(run)
    })
}
```

**Timeout wrapper pattern:**
```typescript
function withTimeout<T>(promise: Promise<T>, ms: number, taskTitle: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Task "${taskTitle}" timed out after ${ms}ms`)), ms)
    ),
  ])
}
```

**Config.yaml execution section:**
```yaml
execution:
  max_parallel_tasks: 5   # 0 or omit for unlimited
  task_timeout_seconds: 120
```

### Previous Story Learnings (from 13-1)

- **exactOptionalPropertyTypes** — don't assign `undefined` to optional fields; use conditional inclusion
- **Injectable I/O pattern** — new config reader should accept injected file reader for testability
- **ESM imports** — always `.js` extension
- **Factory + opts() helpers** in tests for DRY fixtures
- **Backward compatibility** — new parameters must be optional so existing tests pass unchanged

### Project Structure Notes

```
src/engine/concurrency.ts          (new) — createLimiter, withTimeout utilities
src/engine/execution-config.ts     (new) — readExecutionConfig
src/engine/wave-executor.ts        (modify) — add concurrency + timeout params
src/commands/execute/handler.ts    (modify) — read config, pass to executeWave
src/contracts/errors.ts            (modify) — add TASK_TIMEOUT error code
locales/en.yaml                    (modify) — add error.execute.task_timeout
locales/pt-br.yaml                 (modify) — add error.execute.task_timeout
templates/config.yaml              (modify) — add execution section
test/unit/engine/concurrency.test.ts       (new)
test/unit/engine/wave-executor.test.ts     (modify)
```

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-701] — Wave Execution
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-302] — Subagent Isolation
- [Source: docs/prd/buildpact-prd-v2.3.0.md#NFR-12] — Agent-Agnostic Design
- [Source: src/engine/wave-executor.ts] — Current async executeWave with Promise.all
- [Source: src/commands/execute/handler.ts] — Wave execution loop
- [Source: src/engine/budget-guard.ts] — Config reading pattern (readBudgetConfig)
- [Source: _bmad-output/implementation-artifacts/13-1-subagent-provider-abstraction.md] — Previous story: async wave execution
- [Source: ROADMAP.md#Epic13] — Live Subagent Dispatch epic definition

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

### File List
