# Story 6.3: Crash Recovery with Automatic Retry

Status: done

## Story

As a developer whose execution session fails mid-way,
I want the framework to automatically attempt up to 3 different recovery strategies before escalating to me,
so that transient failures don't require me to manually restart from scratch.

## Acceptance Criteria

**AC-1: Three-Strategy Automatic Recovery**

Given a task fails during execution
When the failure is detected
Then the framework tracks the failure and attempts up to 3 different recovery approaches automatically (retry → simplify → skip)
And if a stuck loop is detected (same error repeating), the loop is broken and a different strategy is tried
And if all 3 approaches fail, the framework rolls back to the last known good state and escalates to the user with a clear failure summary

**AC-2: Clean Rollback to Last Good State**

Given the framework rolls back to the last good state
When I review the project
Then no partial or broken changes exist in the codebase
And the Git history reflects only successful commits up to the point of failure

**AC-3: Crash Recovery Section in execute.md Orchestrator**

Given the execute.md stub from Stories 6.1/6.2
When Story 6.3 adds the Crash Recovery section
Then `templates/commands/execute.md` includes `## Crash Recovery` section documenting: 3-strategy progression, stuck loop detection, rollback protocol, and user escalation format
And execute.md total remains ≤300 lines

## Tasks / Subtasks

- [x] Task 1: Add `## Crash Recovery` section to `templates/commands/execute.md` (AC: #1, #2, #3)
  - [x] 1.1: Add `## Crash Recovery` section after `## Atomic Commits` (added by Story 6.2 — see dependency note)
  - [x] 1.2: Document 3-strategy progression: retry → simplify → skip → escalate
  - [x] 1.3: Document stuck loop detection (same error repeating across consecutive attempts)
  - [x] 1.4: Document rollback protocol (`git reset --hard` to last good commit ref)
  - [x] 1.5: Document user escalation format (failure summary with task errors, strategies tried, next steps)
  - [x] 1.6: Document `RecoverySession` lifecycle: create at execution start → accumulate failures → rollback on exhaustion
  - [x] 1.7: Verify cumulative execute.md line count ≤300 after adding this section

- [x] Task 2: Verify `src/engine/recovery.ts` meets AC #1 and #2 (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `selectNextStrategy(attemptNumber: number): RecoveryStrategy | undefined` returns retry/simplify/skip/undefined for attempts 0/1/2/3+
  - [x] 2.2: Confirm `isStuckLoop(failures, taskId): boolean` detects identical error messages in last 2 consecutive failures for same task
  - [x] 2.3: Confirm `buildFailureSummary(failures): string` generates markdown with task title, attempt number, strategy, error — grouped by taskId
  - [x] 2.4: Confirm `handleTaskFailure(session, taskId, taskTitle, error)` returns updated session + RecoveryResult (recovered=true with nextStrategy OR recovered=false with failureSummary+rolledBack)
  - [x] 2.5: Confirm `createRecoverySession(projectDir): Result<RecoverySession>` captures HEAD ref via `git rev-parse HEAD`
  - [x] 2.6: Confirm `executeRollback(projectDir, commitRef): Result<string>` executes `git reset --hard {commitRef}`
  - [x] 2.7: Confirm 3-attempt exhaustion triggers `recovered: false, rolledBack: true` with failure summary
  - [x] 2.8: Confirm stuck loop advances strategy past the repeating one

- [x] Task 3: Verify `test/unit/engine/recovery.test.ts` covers AC (DO NOT recreate — read-only check)
  - [x] 3.1: `selectNextStrategy` — attempts 0→retry, 1→simplify, 2→skip, 3+→undefined
  - [x] 3.2: `isStuckLoop` — <2 failures, identical errors, different errors, cross-task filtering, empty
  - [x] 3.3: `buildFailureSummary` — empty, failure count, task titles, error messages, strategies, grouping
  - [x] 3.4: `handleTaskFailure` — record+return, strategy progression, 3-failure escalation, stuck-loop escalation, cross-task isolation, immutability
  - [x] 3.5: `createRecoverySession` — HEAD capture, whitespace trim, git error handling
  - [x] 3.6: `executeRollback` — success, git failure handling, command construction
  - [x] 3.7: NOTE: git operations are mocked via `execSync` — no real git repos in unit tests

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass (1723 tests across 68 files ✓)
  - [x] 4.2: Verify execute.md ≤300 lines (125 lines ✓)

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/engine/recovery.ts` | ✅ Complete | 242 LOC — 4 pure functions + 2 git operations |
| `test/unit/engine/recovery.test.ts` | ✅ Complete | 338 LOC — 26+ test cases across 6 describe blocks |
| `src/engine/index.ts` | ✅ Exported | All 6 functions in barrel (lines 21–28) |

**The PRIMARY task is Task 1: add `## Crash Recovery` section to `templates/commands/execute.md`.**

### ⚠️ DEPENDENCY ON STORIES 6.1 AND 6.2

Story 6.1 adds `## Wave Execution` and Story 6.2 adds `## Atomic Commits` to `templates/commands/execute.md` BEFORE this story's `## Crash Recovery` section is appended.

**Current execute.md state (65 lines):** Contains header, Wave Execution section (Story 6.1), and Implementation Notes.

**Expected execute.md state when Story 6.3 starts dev:**
- Story 6.1 added `## Wave Execution` (~45 lines → 65 total)
- Story 6.2 will add `## Atomic Commits` (~30 lines → ~93 total)
- Story 6.3 adds `## Crash Recovery` (~25 lines → ~118 total)

**If Story 6.2 has NOT yet been implemented:** Add both `## Atomic Commits` and `## Crash Recovery` sections. Refer to Story 6.2's dev notes for the Atomic Commits template.

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```
`src/engine/recovery.ts` imports from `src/contracts/errors.js` and `node:child_process` only.

**FR-703 maps to:** `src/engine/recovery.ts` + `templates/commands/execute.md`

**Key exports in `src/engine/recovery.ts`:**
```typescript
export type RecoveryStrategy = 'retry' | 'simplify' | 'skip'

export interface TaskFailure {
  taskId: string; taskTitle: string; strategy: RecoveryStrategy
  attemptNumber: number; error: string
}

export interface RecoverySession {
  lastGoodCommitRef: string; failures: TaskFailure[]
}

export interface RecoveryResult {
  recovered: boolean; nextStrategy?: RecoveryStrategy
  failureSummary?: string; rolledBack?: boolean
}

// Pure functions (testable, no side effects)
export function selectNextStrategy(attemptNumber: number): RecoveryStrategy | undefined
export function isStuckLoop(failures: TaskFailure[], taskId: string): boolean
export function buildFailureSummary(failures: TaskFailure[]): string
export function handleTaskFailure(session, taskId, taskTitle, error): { session: RecoverySession; recovery: RecoveryResult }

// Side-effect functions (git operations — mocked in tests)
export function createRecoverySession(projectDir: string): Result<RecoverySession>
export function executeRollback(projectDir: string, commitRef: string): Result<string>
```

**Recovery Strategy Progression:**
```
Attempt 0 → 'retry'     (same task, same approach)
Attempt 1 → 'simplify'  (reduce complexity)
Attempt 2 → 'skip'      (skip task, continue)
Attempt 3+ → undefined   (exhausted → escalate + rollback)
```

**Stuck Loop Detection:** If last 2 failures for same task have identical `error` strings, advance past the current strategy to the next one. If no strategies remain after advancement, escalate immediately.

**Escalation Output:** `buildFailureSummary()` produces a markdown document with:
```markdown
## Recovery Exhausted — Failure Summary

All N recovery attempt(s) failed. Manual intervention required.

### Failed Tasks

**Task:** Task Title (taskId)
  - Attempt 1 [retry]: Error message
  - Attempt 2 [simplify]: Error message
  - Attempt 3 [skip]: Error message

### Next Steps

1. Review error messages above
2. Fix the underlying issue manually
3. Re-run the execution after the fix
```

**Rollback Mechanism:** `executeRollback()` runs `git reset --hard {commitRef}` where `commitRef` is the SHA captured by `createRecoverySession()` before task execution began. This ensures no partial changes remain.

### Integration with Wave Executor (NOT wired in Alpha)

**Current state:** `executeWaves()` in `wave-executor.ts` returns an error on wave failure. Recovery is NOT yet wired as the caller. In Alpha, the wave executor stub simply halts.

**Future integration point (production):**
```typescript
// Pseudo-flow in handler.ts (future):
const session = createRecoverySession(projectDir)
for (const wave of waves) {
  const result = executeWave(wave.tasks)
  if (!result.allSucceeded) {
    for (const failed of result.tasks.filter(t => !t.success)) {
      const { session: updated, recovery } = handleTaskFailure(session, failed.taskId, failed.title, failed.error!)
      session = updated
      if (!recovery.recovered) {
        executeRollback(projectDir, session.lastGoodCommitRef)
        // show recovery.failureSummary to user
        return
      }
      // retry with recovery.nextStrategy
    }
  }
}
```

This wiring is OUT OF SCOPE for Story 6.3. The story validates that the recovery module satisfies FR-703 contracts and documents it in the orchestrator.

### Error Codes Used by Recovery

| Error Code | Where Used | Meaning |
|------------|-----------|---------|
| `ERROR_CODES.FILE_READ_FAILED` | `createRecoverySession()` | `git rev-parse HEAD` failed |
| `ERROR_CODES.FILE_WRITE_FAILED` | `executeRollback()` | `git reset --hard` failed |

Note: Recovery reuses existing error codes — no dedicated `RECOVERY_EXHAUSTED` code. The escalation signal is the `RecoveryResult.recovered === false` + `rolledBack === true` combination, not an error code.

### Audit Trail Integration (NOT wired in Alpha)

`src/foundation/audit.ts` already supports `AuditOutcome = 'success' | 'failure' | 'rollback'`. Recovery events should log with `outcome: 'rollback'` when wired in production. This is out of scope for Story 6.3.

### execute.md Crash Recovery Section Template

Add this section to `templates/commands/execute.md` after `## Atomic Commits` (Story 6.2's section):

```markdown
## Crash Recovery

If a task fails during execution, the recovery system (FR-703) applies up to 3
automatic strategies before escalating to the user.

### Strategy Progression

1. **Retry** — Re-run the same task with the same approach
2. **Simplify** — Re-run with reduced complexity or scope
3. **Skip** — Skip the failing task and continue with the next

If all 3 strategies fail, the system rolls back to the last known good state and
presents a failure summary to the user.

### Stuck Loop Detection

If the same error repeats across consecutive attempts for the same task, the
system advances past the repeating strategy to try a different approach. If no
strategies remain, it escalates immediately.

### Rollback Protocol

Before execution begins, the current Git HEAD is captured as the last known
good commit. On recovery exhaustion, `git reset --hard` restores the working
directory to this commit — no partial or broken changes remain.

Implementation: `createRecoverySession()`, `handleTaskFailure()`, `executeRollback()`
in `src/engine/recovery.ts`. Types: `RecoverySession`, `RecoveryResult`, `TaskFailure`.
```

### execute.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base | Header + intro + Impl Notes | ~18 | ~18 |
| 6.1 | Wave Execution | ~45 | ~63 |
| 6.2 | Atomic Commits | ~30 | ~93 |
| **6.3** | **Crash Recovery** | **~25** | **~118** |
| 6.4 | Wave Verification | ~35 | ~153 |
| 6.5 | Budget Guards | ~35 | ~188 |

Target: ≤300 lines with all 5 stories. Budget is ample (~112 lines remaining after all stories).

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `recovery.ts` or its test file — they are pre-built and complete
- ❌ Do NOT add new error codes like `RECOVERY_EXHAUSTED` — escalation is signaled by `RecoveryResult.recovered === false`, not by error code
- ❌ Do NOT wire recovery into `wave-executor.ts` or `handler.ts` — that's a future production integration, not Alpha scope
- ❌ Do NOT import from `src/commands/` in `src/engine/` — layer dependency violation
- ❌ Do NOT use `export default` — named exports only in `src/engine/`
- ❌ Do NOT add AuditLogger calls to `recovery.ts` — audit integration is out of scope for this story
- ❌ Do NOT mock `node:child_process` differently than the existing tests — follow the same `vi.mock('node:child_process')` pattern

### Previous Story Intelligence (Story 6.2)

- **Pre-built pattern:** Same as this story — implementation existed before story tracking; primary task is the execute.md documentation section
- **ESM imports:** `.js` extension MANDATORY: `import { handleTaskFailure } from './recovery.js'`
- **Result<T> usage:** `createRecoverySession` and `executeRollback` return `Result<T, CliError>` — uses `ok(value)` or `err({...})`
- **Error code pattern:** Recovery reuses `FILE_READ_FAILED` and `FILE_WRITE_FAILED` from `ERROR_CODES` — NEVER use inline string literals
- **Test count baseline at start of Epic 6 work:** 1723 tests across 68 files — verify no regression
- **Functional immutability pattern:** `handleTaskFailure()` returns a NEW session object — never mutates the input session

### Coverage Expectations

- `src/engine/recovery.ts` (pure functions): 85%+ line coverage on `selectNextStrategy`, `isStuckLoop`, `buildFailureSummary`, `handleTaskFailure`
- `createRecoverySession` and `executeRollback`: tested with mocked `execSync` — included in coverage
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit testing |
| `node:child_process` | built-in | `execSync` for `git rev-parse HEAD` and `git reset --hard` |

### Project Structure Notes

`recovery.ts` is in `src/engine/` per the architecture spec. It imports from `src/contracts/errors.js` and `node:child_process` only — no foundation or commands imports. Already registered in `src/engine/index.ts` barrel (lines 21–28). Do NOT modify `src/cli/index.ts` or `src/commands/registry.ts`.

### References

- [Source: epics.md#Epic6-Story6.3] — User story, AC
- [Source: architecture.md#FR-703] — Recovery System: `src/engine/recovery.ts`
- [Source: architecture.md#coverage-thresholds] — Global 70%, engine module thresholds
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/`
- [Source: architecture.md#NFR-07] — Recovery Resilience: 4 failure modes
- [Source: 6-1-wave-parallel-execution-with-subagent-isolation.md] — execute.md line budget, Wave Execution section
- [Source: 6-2-atomic-git-commits-per-task.md] — execute.md Atomic Commits section, dependency on 6.1
- [Source: src/engine/recovery.ts] — Full implementation: 6 exported functions, 4 types
- [Source: test/unit/engine/recovery.test.ts] — 26+ test cases, mocked execSync
- [Source: src/engine/index.ts:21-28] — Recovery barrel exports
- [Source: src/foundation/audit.ts] — AuditOutcome includes 'rollback' (future integration)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- ✅ Added `## Crash Recovery` section to `templates/commands/execute.md` after `## Atomic Commits` (Task 1)
- ✅ execute.md is 125 lines — well within the ≤300 line budget (Task 1.7)
- ✅ Verified `src/engine/recovery.ts` — all 6 functions correct, types match spec (Task 2)
- ✅ Verified `test/unit/engine/recovery.test.ts` — all 6 describe blocks confirmed (Task 3)
- ✅ Full test suite: 1723 tests / 68 files — zero regressions (Task 4)
- ✅ All 3 ACs satisfied: Crash Recovery section documents strategy progression, stuck loop detection, and rollback protocol

### File List

- templates/commands/execute.md (modified — added `## Crash Recovery` section, lines 89–116)
