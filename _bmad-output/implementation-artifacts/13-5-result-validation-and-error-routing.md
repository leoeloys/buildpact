# Story 13.5: Result Validation and Error Routing

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a framework developer integrating live AI execution with crash recovery,
I want subagent outputs validated and failures routed to the recovery system,
so that bad results are caught early and the framework recovers automatically without user intervention.

## Acceptance Criteria

**AC-1: After each task completes, validate the TaskResult against task requirements**

Given a task has been dispatched and a `TaskResult` is returned by the provider,
When the result is received,
Then it is validated for: non-empty response content, `success` flag is true, and `artifacts` array is present,
And a result with empty response content or missing required fields is marked as a validation failure,
And the validation produces a clear reason string describing what was invalid.

**AC-2: Failed tasks are routed to the recovery system (retry/simplify/skip per FR-703)**

Given a task fails (provider error, validation failure, or timeout),
When the failure is detected in the wave execution loop,
Then `handleTaskFailure()` from `src/engine/recovery.ts` is called with the task ID, title, and error message,
And the recovery system selects the next strategy via `selectNextStrategy()` (retry -> simplify -> skip),
And the strategy is applied: retry re-dispatches the same payload, simplify re-dispatches with a simplified prompt, skip marks the task as skipped and continues.

**AC-3: Recovery attempts use the provider for retry dispatch (not stub)**

Given a failed task is being retried by the recovery system,
When the retry dispatch occurs,
Then it uses the same `SubagentProvider` that was used for the original dispatch,
And retry dispatch goes through the same concurrency and timeout controls as the original,
And retry results are subject to the same validation as original results.

**AC-4: Stuck loop detection prevents infinite retries**

Given a task has failed multiple times with the same error message,
When `isStuckLoop()` returns `true` for that task,
Then the recovery system advances to the next strategy instead of retrying with the same approach,
And if all 3 strategies are exhausted (retry, simplify, skip), the task is marked as unrecoverable,
And `buildFailureSummary()` produces a user-facing report of all failed recovery attempts.

**AC-5: All errors are mapped to actionable i18n messages for the user**

Given a task fails at any stage (dispatch error, validation failure, timeout, recovery exhausted),
When the error is presented to the user,
Then it uses an i18n key from `locales/en.yaml` and `locales/pt-br.yaml`,
And the message includes actionable context (task name, error reason, recovery strategy tried),
And the message suggests next steps (e.g., "check API key", "simplify the task", "review manually").

## Tasks / Subtasks

- [ ] Task 1: Create result validator (AC: 1)
  - [ ] 1.1: Create `validateTaskResult(result: TaskResult, taskTitle: string): Result<TaskResult, CliError>` in `src/engine/result-validator.ts`
  - [ ] 1.2: Validation checks: `result.success === true`, `result.response` is non-empty string (not just whitespace), `result.artifacts` is defined (may be empty array)
  - [ ] 1.3: On validation failure, return `err()` with `ERROR_CODES.TASK_RESULT_INVALID` and a descriptive reason
  - [ ] 1.4: Add `ERROR_CODES.TASK_RESULT_INVALID` to `src/contracts/errors.ts`
  - [ ] 1.5: Write unit tests: valid result passes, empty response fails, missing success flag fails

- [ ] Task 2: Integrate result validation into wave execution (AC: 1, 2)
  - [ ] 2.1: In `executeWave()`, after each `provider.dispatch()` resolves, run `validateTaskResult()` on the result
  - [ ] 2.2: If validation fails, convert the result to a failed `TaskExecutionResult` with the validation error as the error message
  - [ ] 2.3: Track validated vs raw failures separately in `WaveExecutionResult` (add `validationFailures: number` field)
  - [ ] 2.4: Write unit tests: dispatch succeeds but validation fails -> task marked as failed

- [ ] Task 3: Wire recovery system into execute handler for failed tasks (AC: 2, 3)
  - [ ] 3.1: In the execute handler wave loop, after a wave completes with failures, iterate over failed tasks
  - [ ] 3.2: For each failed task, call `handleTaskFailure()` with the task's error and the current `RecoverySession`
  - [ ] 3.3: Based on the `RecoveryResult.nextStrategy`: if `retry`, re-dispatch the same payload via the provider; if `simplify`, modify the payload with a simplification prefix and re-dispatch; if `skip`, log the skip and continue
  - [ ] 3.4: After recovery dispatch, validate the retry result with `validateTaskResult()` — apply same checks
  - [ ] 3.5: Update `WaveExecutionResult` with recovery outcomes (replace failed result with recovered result if successful)
  - [ ] 3.6: Write unit tests with mocked provider: verify retry dispatches, simplify modifies payload, skip logs and continues

- [ ] Task 4: Integrate stuck loop detection and recovery exhaustion (AC: 4)
  - [ ] 4.1: Before each recovery dispatch, check `isStuckLoop()` — if stuck, advance strategy automatically
  - [ ] 4.2: When all strategies exhausted (`selectNextStrategy()` returns `undefined`), mark task as unrecoverable
  - [ ] 4.3: Call `buildFailureSummary()` for unrecoverable tasks and display via `clack.log.error()`
  - [ ] 4.4: Unrecoverable tasks count toward wave failure — wave `allPassed` is `false`
  - [ ] 4.5: Write unit tests: stuck loop detected -> strategy advances; all strategies exhausted -> failure summary generated

- [ ] Task 5: Add i18n error messages for all failure paths (AC: 5)
  - [ ] 5.1: Add i18n keys to `locales/en.yaml`: `error.execute.task_result_invalid`, `error.execute.recovery_retry`, `error.execute.recovery_simplify`, `error.execute.recovery_skip`, `error.execute.recovery_exhausted`
  - [ ] 5.2: Add matching i18n keys to `locales/pt-br.yaml`
  - [ ] 5.3: Use i18n resolver in execute handler for all user-facing error messages during recovery
  - [ ] 5.4: Include task name and error reason as interpolation variables in i18n messages

## Dev Notes

### Architecture Requirements

**FR-703 defines the recovery strategy chain:** retry (same payload) -> simplify (reduced context) -> skip (mark and continue). The existing `recovery.ts` implements the strategy selection and session tracking. This story wires it into the live execution loop.

**Result validation is a new layer** between provider dispatch and result aggregation. It catches cases where the API returns 200 OK but the content is garbage (empty response, model refusal, etc.).

**Simplify strategy** means re-dispatching with a modified payload. The simplification should: (1) remove optional context (codebaseContext), (2) add a prefix instructing the model to produce a minimal implementation, (3) keep core task description intact.

### Existing Code to Reuse (DO NOT Reinvent)

| Component | Location | Reuse How |
|-----------|----------|-----------|
| `selectNextStrategy()` | `src/engine/recovery.ts:55-58` | Strategy selection by attempt number |
| `isStuckLoop()` | `src/engine/recovery.ts:65-71` | Detect repeated identical errors |
| `handleTaskFailure()` | `src/engine/recovery.ts` | Full recovery handler with session tracking |
| `createRecoverySession()` | `src/engine/recovery.ts` | Initialize session with git HEAD ref |
| `buildFailureSummary()` | `src/engine/recovery.ts:78-114` | User-facing failure report |
| `RecoverySession` | `src/engine/recovery.ts:28-33` | Session state type |
| `TaskFailure` | `src/engine/recovery.ts:19-25` | Failure record type |
| `SubagentProvider.dispatch()` | `src/contracts/provider.ts` | Re-dispatch for retry |
| `buildSubagentContext()` | `src/engine/wave-executor.ts` | Rebuild payload for simplify |
| `ERROR_CODES` | `src/contracts/errors.ts` | Add TASK_RESULT_INVALID |
| `Result<T, CliError>` | `src/contracts/errors.ts` | Return type for validator |

### Key Implementation Details

**Result validation function:**
```typescript
function validateTaskResult(result: TaskResult, taskTitle: string): Result<TaskResult, CliError> {
  if (!result.success) return err({ code: ERROR_CODES.TASK_RESULT_INVALID, message: `Task "${taskTitle}" returned failure` })
  if (!result.response || result.response.trim().length === 0) return err({ code: ERROR_CODES.TASK_RESULT_INVALID, message: `Task "${taskTitle}" returned empty response` })
  return ok(result)
}
```

**Simplify payload modification:**
```typescript
function simplifyPayload(payload: TaskDispatchPayload): TaskDispatchPayload {
  return {
    ...payload,
    codebaseContext: undefined,  // Remove optional context to reduce complexity
    content: `SIMPLIFICATION MODE: Produce a minimal, working implementation. Focus on core functionality only.\n\n${payload.content}`,
  }
}
```

**Recovery loop in execute handler (pseudocode):**
```typescript
for (const failedResult of waveResult.results.filter(r => !r.success)) {
  const recovery = handleTaskFailure(session, failedResult.taskId, failedResult.title, failedResult.error!)
  if (!recovery.recovered) { /* log exhaustion */ continue }
  if (recovery.nextStrategy === 'skip') { /* log skip */ continue }
  const payload = recovery.nextStrategy === 'simplify' ? simplifyPayload(originalPayload) : originalPayload
  const retryResult = await provider.dispatch(payload)
  // validate and update waveResult...
}
```

### Previous Story Learnings (from 13-1, 13-2)

- **Result type universal** — validator returns `Result<TaskResult, CliError>`, not thrown exceptions
- **Injectable I/O pattern** — recovery file I/O (git commands) are already in recovery.ts
- **exactOptionalPropertyTypes** — use conditional spread for optional fields in simplified payloads
- **ESM imports** — always `.js` extension
- **i18n required** — all user-facing error messages need EN + PT-BR keys

### Project Structure Notes

```
src/engine/result-validator.ts          (new) — validateTaskResult, simplifyPayload
src/engine/wave-executor.ts             (modify) — call validator after dispatch
src/engine/recovery.ts                  (existing) — already has all recovery logic
src/commands/execute/handler.ts         (modify) — recovery loop for failed tasks
src/contracts/errors.ts                 (modify) — add TASK_RESULT_INVALID
locales/en.yaml                         (modify) — add error.execute.recovery_* keys
locales/pt-br.yaml                      (modify) — add error.execute.recovery_* keys
test/unit/engine/result-validator.test.ts     (new)
test/unit/engine/wave-executor.test.ts        (modify)
test/unit/commands/execute-recovery.test.ts   (new)
```

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-703] — Crash Recovery with Automatic Retry
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-701] — Wave Execution
- [Source: src/engine/recovery.ts] — selectNextStrategy, isStuckLoop, handleTaskFailure, buildFailureSummary
- [Source: src/engine/wave-executor.ts] — executeWave, TaskExecutionResult, WaveExecutionResult
- [Source: src/commands/execute/handler.ts] — Wave execution loop
- [Source: src/contracts/errors.ts] — ERROR_CODES, Result type
- [Source: _bmad-output/implementation-artifacts/13-1-subagent-provider-abstraction.md] — Provider dispatch integration
- [Source: _bmad-output/implementation-artifacts/13-3-live-wave-execution-with-concurrency.md] — Concurrency and timeout (dependency)
- [Source: ROADMAP.md#Epic13] — Live Subagent Dispatch epic definition

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

### File List
