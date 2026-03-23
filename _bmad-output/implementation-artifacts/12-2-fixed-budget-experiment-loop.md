# Story 12.2: Fixed-Budget Experiment Loop

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an expert user running an overnight optimization session,
I want each experiment to have a fixed time budget and the total session to have a configurable budget,
so that I can run long optimization sessions without runaway costs or infinite loops.

## Acceptance Criteria

1. **Given** I run `/bp:optimize` with default settings, **When** the loop executes, **Then** each individual experiment runs within a 5-minute time budget (configurable) **And** the total session respects a 30-minute overall budget (configurable up to 24 hours) **And** when either budget is exhausted, the loop stops cleanly and preserves all results to date.

2. **Given** the session's AI cost reaches the Budget Guard limit, **When** the limit is hit during the loop, **Then** the loop pauses immediately, preserves all results, and notifies the user with options to continue or stop.

## Tasks / Subtasks

> **⚠️ CRITICAL CONTEXT — READ BEFORE STARTING:** Story 12.2 was implemented by the Ralph autonomous system as commit `60f4a70` (`feat: [US-053] - Epic 12.2: Fixed-Budget Experiment Loop`). All implementation files already exist. The tasks below are **verification tasks**, not fresh implementation.

- [x] Task 1: Verify AC #1 — time budget constants and session creation (AC: #1)
  - [x] 1.1 Confirm `DEFAULT_EXPERIMENT_MS = 5 * 60 * 1000` (5 minutes), `DEFAULT_SESSION_MS = 30 * 60 * 1000` (30 minutes), `MAX_SESSION_MS = 24 * 60 * 60 * 1000` (24 hours) are exported from `src/optimize/experiment-loop.ts`
  - [x] 1.2 Confirm `createExperimentSession(budget, nowMs)` clamps `sessionMs` to `MAX_SESSION_MS` and initializes state: `currentExperimentNumber=0`, `currentExperimentStartMs=null`, `completedExperiments=[]`, `stopped=false`, `stopReason=null`
  - [x] 1.3 Confirm `isExperimentBudgetExhausted(session, nowMs)` returns `false` when no experiment running (null start), and `true` when `nowMs - currentExperimentStartMs >= experimentMs`
  - [x] 1.4 Confirm `isSessionBudgetExhausted(session, nowMs)` returns `true` when `nowMs - sessionStartMs >= sessionMs`
  - [x] 1.5 Confirm `startNextExperiment(session, nowMs)` increments `currentExperimentNumber` and sets `currentExperimentStartMs`
  - [x] 1.6 Confirm `completeExperiment(session, result)` appends to `completedExperiments` (immutably) and clears `currentExperimentStartMs`
  - [x] 1.7 Confirm `stopSession(session, reason)` sets `stopped=true`, `stopReason=reason`, clears `currentExperimentStartMs`
  - [x] 1.8 Confirm `parseBudgetFromArgs(args)` parses `--experiment-budget=N` and `--session-budget=N` (minutes), with defaults 5/30, session capped at 1440 (24h)

- [x] Task 2: Verify AC #2 — cost limit check and spend tracking (AC: #2)
  - [x] 2.1 Confirm `addSessionSpend(session, spendUsd)` returns updated session with `sessionSpendUsd += spendUsd` (immutable update)
  - [x] 2.2 Confirm `isCostLimitReached(sessionSpendUsd, limitUsd)` returns `false` when `limitUsd <= 0` (unlimited), and `true` when `sessionSpendUsd >= limitUsd`
  - [x] 2.3 Confirm `handler.ts` calls `isCostLimitReached(session.sessionSpendUsd, budgetConfig.sessionLimitUsd)` each iteration and offers user a `clack.select` with continue/switch/stop options

- [x] Task 3: Verify formatting helpers (AC: #1, #2)
  - [x] 3.1 Confirm `formatDurationMs(ms)` returns `"Xs"` for sub-minute durations and `"Xm Ys"` for minute+ durations
  - [x] 3.2 Confirm `formatLoopStatus(session, nowMs)` outputs lines for: experiments run/improved, elapsed/total time, remaining time, spend
  - [x] 3.3 Confirm `buildLoopSummary(session, nowMs)` produces a human-readable stop reason string using all four `LoopStopReason` values

- [x] Task 4: Verify tests pass (AC: #1, #2)
  - [x] 4.1 Run `npx vitest run test/unit/optimize/experiment-loop.test.ts` and confirm all tests pass
  - [x] 4.2 Confirm test file covers: constants, createExperimentSession (budget/clamp/initial state), isExperimentBudgetExhausted (no experiment/within/exhausted), isSessionBudgetExhausted, startNextExperiment, completeExperiment, stopSession, addSessionSpend, isCostLimitReached (zero limit/below/at limit), formatDurationMs, parseBudgetFromArgs

## Dev Notes

### Critical Context — Implementation Already Exists

**All deliverables committed in `60f4a70` (US-053, 2026-03-16).** Commit added 274 lines to `src/optimize/experiment-loop.ts` and 342-line test file.

**Files to verify:**

| File | Description |
|------|-------------|
| `src/optimize/experiment-loop.ts` | All loop state management — pure functions, no I/O |
| `test/unit/optimize/experiment-loop.test.ts` | ~342-line test suite, fixed epoch `NOW = 1_700_000_000_000` |

### Architecture Compliance

- **Immutable state pattern:** All session mutation functions (`startNextExperiment`, `completeExperiment`, `stopSession`, `addSessionSpend`) return NEW session objects — spread operator pattern `{ ...session, field: newValue }`. No mutation.
- **Pure functions only:** All functions in `experiment-loop.ts` are pure — injectable `nowMs` timestamp instead of `Date.now()` calls. This enables deterministic testing.
- **`ExperimentBudget` interface:** `{ experimentMs: number, sessionMs: number }` — both in milliseconds.
- **`ExperimentSession` interface:** All fields `readonly` — enforces immutability at type level.
- **`LoopStopReason` type:** `'experiment_time_exhausted' | 'session_time_exhausted' | 'cost_limit_reached' | 'user_stopped'`
- **`ExperimentOutcome` type:** `'improved' | 'no_change' | 'worse' | 'error' | 'timeout'`
- **Cost limit of 0:** `isCostLimitReached(spend, 0)` always returns `false` — 0 means unlimited.
- **`parseBudgetFromArgs` cap:** `--session-budget=N` is capped at 1440 minutes (24h). Values ≤ 0 are ignored (default used).

### Key Interfaces

```typescript
interface ExperimentBudget { experimentMs: number; sessionMs: number }
interface ExperimentSession {
  readonly budget: ExperimentBudget
  readonly sessionStartMs: number
  readonly currentExperimentNumber: number
  readonly currentExperimentStartMs: number | null
  readonly completedExperiments: readonly ExperimentResult[]
  readonly stopped: boolean
  readonly stopReason: LoopStopReason | null
  readonly sessionSpendUsd: number
}
interface ExperimentResult {
  experimentNumber: number; startedAtMs: number; completedAtMs: number
  outcome: ExperimentOutcome; description: string
}
```

### Testing Pattern

Test file uses fixed `NOW = 1_700_000_000_000` epoch for all time-based assertions. Time arithmetic: `NOW + N * 60_000` for N minutes elapsed.

### Project Structure Notes

- `src/optimize/experiment-loop.ts` is private to the `optimize` module
- Handler imports from `'../../optimize/experiment-loop.js'` (`.js` ESM extension)
- No default exports — all named exports

### References

- Epic 12, Story 12.2: `_bmad-output/planning-artifacts/epics.md` § "Story 12.2"
- Implementation commit: `60f4a70` (US-053)
- Architecture — FR-1202 (fixed-budget loop), FR-1203 (configurable budgets)
- Budget Guard integration: `src/engine/budget-guard.ts::readBudgetConfig` — `sessionLimitUsd` field

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented by Ralph autonomous system (commit 60f4a70, 2026-03-16) prior to BMAD sprint tracking
- Verification story — all deliverables pre-exist
- **AC #1 verified:** All constants correct (5min/30min/24h). `createExperimentSession` clamps and initializes correctly. All immutable state functions (`startNextExperiment`, `completeExperiment`, `stopSession`, `addSessionSpend`) use spread pattern. `parseBudgetFromArgs` parses minutes, caps at 1440, ignores ≤0.
- **AC #2 verified:** `isCostLimitReached` handles unlimited (0) case. `handler.ts` checks cost limit each iteration with `clack.select` offering 3 options. `addSessionSpend` immutable.
- **Formatting verified:** `formatDurationMs` handles sub-minute and minute+. `formatLoopStatus` and `buildLoopSummary` cover all 4 stop reasons.
- **Tests:** 39/39 pass in `test/unit/optimize/experiment-loop.test.ts`.

### File List

- `src/optimize/experiment-loop.ts` (existing — verify meets all ACs)
- `test/unit/optimize/experiment-loop.test.ts` (existing — verify passes)
