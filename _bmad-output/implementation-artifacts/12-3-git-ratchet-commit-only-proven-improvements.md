# Story 12.3: Git Ratchet — Commit Only Proven Improvements

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an expert user running automated experiments,
I want the framework to automatically commit changes only when the metric improves and revert everything else,
so that my codebase only ever moves forward — every experiment either improves the score or leaves no trace.

## Acceptance Criteria

1. **Given** an experiment completes, **When** the metric function compares the result to the current best, **Then** if improved: the change is committed with the standardized message `optimize(N): description | metric: X.XX → Y.YY` **And** if equal or worse: the change is git-reverted to the last successful state automatically.

2. **Given** the Git Ratchet module runs, **When** inspected as a developer, **Then** it exists as an independent TypeScript module (`src/optimize/ratchet.ts`) with ≥80% Vitest test coverage **And** all AutoResearch operations run on an isolated branch `optimize/{target-type}/{session-name}/{timestamp}` **And** human review is required before merge — no auto-merge to main is permitted.

## Tasks / Subtasks

> **⚠️ CRITICAL CONTEXT — READ BEFORE STARTING:** Story 12.3 was implemented by the Ralph autonomous system as commit `18a3a3b` (`feat: [US-054] - Epic 12.3: Git Ratchet — Commit Only Proven Improvements`). All implementation files already exist. The tasks below are **verification tasks**, not fresh implementation.

- [x] Task 1: Verify AC #1 — commit/revert decision logic (AC: #1)
  - [x] 1.1 Confirm `shouldCommit(before, after)` returns `true` only when `after > before` (strictly greater)
  - [x] 1.2 Confirm `decideRatchet(before, after, experimentNumber, description, metricName)` returns `{ decision: 'revert' }` when metric equal or worse, and `{ decision: 'commit', commitMessage: '...' }` when improved
  - [x] 1.3 Confirm `formatRatchetCommitMessage(n, description, metric)` produces `"optimize(N): description | metricName: X.XX → Y.YY"` (2 decimal places)
  - [x] 1.4 Confirm `runRatchetCommit(message, projectDir, execFn)` runs `git add -A` then `git commit -m <message>` then returns new HEAD ref via `git rev-parse HEAD`
  - [x] 1.5 Confirm `runRatchetRevert(commitRef, projectDir, execFn)` runs `git reset --hard <commitRef>` and returns the ref on success

- [x] Task 2: Verify AC #2 — isolated branch convention and human review gate (AC: #2)
  - [x] 2.1 Confirm `buildIsolatedBranchName(targetType, sessionName, timestamp)` returns `optimize/<safe(targetType)>/<safe(sessionName)>/<safe(timestamp)>` where `safe()` lowercases, replaces non-alphanumeric with hyphens, collapses consecutive hyphens, strips leading/trailing hyphens
  - [x] 2.2 Confirm `createIsolatedBranch(branchName, projectDir, execFn)` runs `git checkout -b <branchName>` (quoted) and returns `ok(branchName)` or `err(RATCHET_BRANCH_FAILED)`
  - [x] 2.3 Confirm `buildReviewInstructions(branchName, mainBranch)` explicitly states: "Auto-merge is intentionally disabled. Human review is required before merging." and includes the 4-step merge review process
  - [x] 2.4 Confirm `getRatchetCommitRef(projectDir, execFn)` runs `git rev-parse HEAD` and returns `ok(trimmedRef)` or `err(RATCHET_COMMIT_FAILED)`

- [x] Task 3: Verify error handling follows Result pattern (AC: #2)
  - [x] 3.1 Confirm all I/O functions (`createIsolatedBranch`, `getRatchetCommitRef`, `runRatchetCommit`, `runRatchetRevert`) return `Result<string>` — never throw
  - [x] 3.2 Confirm error codes used: `ERROR_CODES.RATCHET_BRANCH_FAILED`, `ERROR_CODES.RATCHET_COMMIT_FAILED`, `ERROR_CODES.RATCHET_REVERT_FAILED`
  - [x] 3.3 Confirm all git commands use `JSON.stringify(value)` for shell argument quoting (prevents injection)
  - [x] 3.4 Confirm all git commands set `stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8'` — never inherit stdio

- [x] Task 4: Verify tests pass with ≥80% coverage (AC: #2)
  - [x] 4.1 Run `npx vitest run test/unit/optimize/ratchet.test.ts` and confirm all tests pass
  - [x] 4.2 Confirm test file covers: `buildIsolatedBranchName` (format/sanitise/lowercase/special-chars), `formatRatchetCommitMessage` (format/decimal), `shouldCommit` (equal/worse/better), `decideRatchet` (revert/commit), `buildReviewInstructions`, and I/O functions via mocked `execFn`

## Dev Notes

### Critical Context — Implementation Already Exists

**All deliverables committed in `18a3a3b` (US-054, 2026-03-16).** `src/optimize/ratchet.ts` is 264 lines. Architecture mandates ≥80% Vitest coverage (target: 85%).

**Files to verify:**

| File | Description |
|------|-------------|
| `src/optimize/ratchet.ts` | All ratchet logic — pure helpers + git I/O with injectable execFn |
| `test/unit/optimize/ratchet.test.ts` | Tests covering all exported functions |

### Architecture Compliance

- **Independent module:** `ratchet.ts` is a standalone, independently testable module. It does NOT import from `experiment-loop.ts`.
- **Injectable `execFn`:** All git I/O functions accept `execFn: typeof execSync = execSync` — default is real `execSync`, tests inject a mock.
- **Shell injection prevention:** Git arguments wrapped with `JSON.stringify()` — e.g., `git checkout -b ${JSON.stringify(branchName)}`. Never raw string interpolation.
- **`RatchetSession` interface:** `{ targetType, sessionName, branchName, lastGoodCommitRef: string | null }` — `lastGoodCommitRef` is null before first commit.
- **`RatchetDecision`:** `'commit' | 'revert'`
- **`RatchetResult`:** `{ decision: RatchetDecision, commitMessage?: string }` — `commitMessage` only present when `decision === 'commit'`
- **Reuse of `executeRollback` pattern:** `runRatchetRevert` uses `git reset --hard` — same pattern as `src/engine/recovery.ts::executeRollback`, but independent implementation.

### Key Functions Summary

```typescript
// Pure decision logic
buildIsolatedBranchName(targetType, sessionName, timestamp): string  // optimize/type/name/ts
formatRatchetCommitMessage(n, description, metric): string           // optimize(N): desc | name: X.XX → Y.YY
shouldCommit(before, after): boolean                                 // after > before
decideRatchet(...): RatchetResult                                    // commit or revert
buildReviewInstructions(branchName, mainBranch?): string            // human-readable merge guide

// Git I/O (injectable execFn)
createIsolatedBranch(branchName, projectDir, execFn?): Result<string>   // git checkout -b
getRatchetCommitRef(projectDir, execFn?): Result<string>                 // git rev-parse HEAD
runRatchetCommit(message, projectDir, execFn?): Result<string>           // git add -A && git commit
runRatchetRevert(commitRef, projectDir, execFn?): Result<string>         // git reset --hard
```

### Error Codes

From `src/contracts/errors.ts`:
- `ERROR_CODES.RATCHET_BRANCH_FAILED` — `createIsolatedBranch` failure
- `ERROR_CODES.RATCHET_COMMIT_FAILED` — `runRatchetCommit` or `getRatchetCommitRef` failure
- `ERROR_CODES.RATCHET_REVERT_FAILED` — `runRatchetRevert` failure

### Testing Pattern

I/O functions are tested by injecting a mock `execFn`:
```typescript
const execFn = vi.fn().mockReturnValue('abc123\n')
const result = createIsolatedBranch('optimize/code/sess/ts', '/tmp/project', execFn)
```
Failure cases: `execFn` throws an `Error` → function returns `err(...)`.

### Project Structure Notes

- `ratchet.ts` imports only from `'../contracts/errors.js'` and `'node:child_process'`
- No imports from `experiment-loop.ts` — independent module
- Architecture coverage target: 85%+ (Vitest threshold: 80%)

### References

- Epic 12, Story 12.3: `_bmad-output/planning-artifacts/epics.md` § "Story 12.3"
- ADR-001: `docs/decisions/ADR-001-autoResearch-isolation.md` — isolation strategy this module implements
- Implementation commit: `18a3a3b` (US-054)
- Architecture — FR-1204 (Git Ratchet), coverage target 85%+
- Architecture — AutoResearch Isolation: branch naming, no auto-merge

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented by Ralph autonomous system (commit 18a3a3b, 2026-03-16) prior to BMAD sprint tracking
- Verification story — all deliverables pre-exist
- **AC #1 verified:** `shouldCommit` strict `>`. `decideRatchet` returns correct decision object. `formatRatchetCommitMessage` formats X.XX→Y.YY with 2 decimals. `runRatchetCommit` chains add/commit/rev-parse. `runRatchetRevert` uses `reset --hard`.
- **AC #2 verified:** `buildIsolatedBranchName` full sanitisation pipeline confirmed. `createIsolatedBranch` uses `JSON.stringify` quoting. `buildReviewInstructions` contains explicit no-auto-merge statement + 4-step guide. All I/O returns `Result<string>`.
- **Error codes verified:** RATCHET_BRANCH_FAILED, RATCHET_COMMIT_FAILED, RATCHET_REVERT_FAILED. All git commands use `stdio: pipe, encoding: utf-8`.
- **Tests:** 43/43 pass in `test/unit/optimize/ratchet.test.ts`.

### File List

- `src/optimize/ratchet.ts` (existing — verify meets all ACs)
- `test/unit/optimize/ratchet.test.ts` (existing — verify passes)
