# Story 6.2: Atomic Git Commits per Task

Status: done

## Story

As a developer reviewing execution history,
I want every completed task to produce exactly one Git commit with a standardized message,
so that my Git history is clean, traceable, and maps 1:1 to planned tasks.

## Acceptance Criteria

1. **One commit per completed task**
   - Given a subagent completes a task successfully
   - When the task result is finalized
   - Then exactly one Git commit is created for that task
   - And the commit message follows the standardized format: `type(phase-plan): description`
     (e.g., `feat(02-03): create login endpoint`)
   - And no task produces zero commits or multiple commits

2. **Commit count matches task count**
   - Given I review the Git log after a full execution
   - When I count the commits
   - Then the number of commits equals the number of tasks that were executed

## Tasks / Subtasks

- [x] Task 1: Add `## Atomic Commits` section to `templates/commands/execute.md` (AC: #1, #2)
  - [x] 1.1: Add `## Atomic Commits` section after `## Wave Execution` (added by Story 6.1 — see dependency note)
  - [x] 1.2: Document commit message format: `type(phaseSlug): taskTitle`
  - [x] 1.3: Document `inferCommitType()` keyword rules (fix/docs/test/refactor/chore/style → default feat)
  - [x] 1.4: Document `formatCommitMessage(taskTitle, phaseSlug)` and how `phaseSlug` maps to the plan dir name
  - [x] 1.5: Document `commitMessage` field on `TaskExecutionResult` (present only on success)
  - [x] 1.6: Document that `runAtomicCommit()` is the real git implementation; not called in Alpha stubs
  - [x] 1.7: Verify cumulative execute.md line count ≤300 after adding this section

- [x] Task 2: Verify `src/engine/atomic-commit.ts` meets AC #1 and #2 (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `inferCommitType(description: string): string` maps keywords to 7 types correctly
  - [x] 2.2: Confirm `formatCommitMessage(taskTitle: string, phaseSlug: string): string` returns `type(phaseSlug): taskTitle`
  - [x] 2.3: Confirm `runAtomicCommit(taskTitle, phaseSlug, projectDir): Result<string>` runs `git add -A` + `git commit -m` via `execSync`
  - [x] 2.4: Confirm the `commitMessage` field on `TaskExecutionResult` is set via `formatCommitMessage()` in `executeTaskStub()`

- [x] Task 3: Verify `test/unit/engine/atomic-commit.test.ts` covers AC (DO NOT recreate — read-only check)
  - [x] 3.1: `inferCommitType` — all 7 types covered (fix, docs, test, refactor, chore, style, feat default)
  - [x] 3.2: `inferCommitType` — case-insensitive matching verified
  - [x] 3.3: `formatCommitMessage` — format, type inference, empty phaseSlug, title preserved
  - [x] 3.4: Atomic guarantee — one message per task, all unique, all matching `type(scope): subject`
  - [x] 3.5: NOTE: `runAtomicCommit` is intentionally NOT unit-tested (requires real git); this is acceptable

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass (baseline: 1723 tests across 68 files)
  - [x] 4.2: Verify execute.md ≤300 lines

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/engine/atomic-commit.ts` | ✅ Complete | `inferCommitType`, `formatCommitMessage`, `runAtomicCommit` |
| `test/unit/engine/atomic-commit.test.ts` | ✅ Complete | 15+ test cases across 3 describe blocks |

**The PRIMARY task is Task 1: add `## Atomic Commits` section to `templates/commands/execute.md`.**

### ⚠️ DEPENDENCY ON STORY 6.1

Story 6.1 (`6-1-wave-parallel-execution-with-subagent-isolation.md`) must add the `## Wave Execution` section to `templates/commands/execute.md` BEFORE this story's `## Atomic Commits` section is appended.

**Current execute.md state (19 lines — stub):** Contains only header, intro list, and `## Implementation Notes`.

**Expected execute.md state when Story 6.2 starts dev:**
- Story 6.1 will have added `## Wave Execution` (~45 lines → ~63 total)
- Story 6.2 adds `## Atomic Commits` (~30 lines → ~93 total)

**If Story 6.1 has NOT yet been implemented:** Add both `## Wave Execution` and `## Atomic Commits` sections together. Refer to Story 6.1's dev notes for the Wave Execution template (lines 236–280 of `6-1-wave-parallel-execution-with-subagent-isolation.md`).

### Commit Message Format

```
type(phaseSlug): taskTitle
```

Examples from the PRD:
```
feat(02-03): create login endpoint
fix(auth-service): Fix login redirect bug
test(auth-v2): Write unit tests for auth
```

Type inference keyword rules (from `inferCommitType`):
- `fix` — fix, resolve, correct, repair, revert, bug, hotfix
- `docs` — doc, docs, document, readme
- `test` — test, spec, coverage
- `refactor` — refactor, rename, move, extract, clean
- `chore` — chore, bump, upgrade, update
- `style` — style, format, prettier
- `feat` — default (all others)

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```
`src/engine/atomic-commit.ts` imports from `src/contracts/` only.

**FR-702 maps to:** `src/engine/atomic-commit.ts` + `templates/commands/execute.md`

**Key exports in `src/engine/atomic-commit.ts`:**
```typescript
export function inferCommitType(description: string): string
export function formatCommitMessage(taskTitle: string, phaseSlug: string): string
export function runAtomicCommit(taskTitle: string, phaseSlug: string, projectDir: string): Result<string>
```

**Integration with wave-executor.ts:**
```typescript
// In wave-executor.ts:
import { formatCommitMessage } from './atomic-commit.js'

// In executeTaskStub():
commitMessage: formatCommitMessage(task.title, task.phaseSlug ?? 'execute')
```

**Integration with execute handler:**
```typescript
// In handler.ts, buildWaveTaskGroups() call:
const waveGroups = buildWaveTaskGroups(waveFiles, constitutionPath, planSlug)
// planSlug (e.g., "my-feature") becomes each task's phaseSlug
// → commit messages become: feat(my-feature): Task title
```

**Alpha stub behavior:** `runAtomicCommit()` is NOT called by `executeTaskStub()`. In Alpha, `TaskExecutionResult.commitMessage` contains the would-be commit message string, but no actual `git commit` is executed. Production task runners will call `runAtomicCommit()` directly.

**`TaskExecutionResult` type (from wave-executor.ts):**
```typescript
export interface TaskExecutionResult {
  taskId: string
  title: string
  waveNumber: number
  success: boolean
  artifacts: string[]
  error?: string
  commitMessage?: string  // present only on success — type(phaseSlug): title
}
```

### execute.md Atomic Commits Section Template

Add this section to `templates/commands/execute.md` after `## Wave Execution` (Story 6.1's section):

```markdown
## Atomic Commits

Each task that completes successfully produces exactly one Git commit (FR-702).
This ensures the Git history maps 1:1 to planned tasks — no multi-task blobs,
no empty commits.

### Commit Message Format

```
type(phaseSlug): taskTitle
```

- `phaseSlug` — the plan directory name (e.g., `auth-feature`), passed from `buildWaveTaskGroups()`
- `type` — inferred from task title keywords via `inferCommitType()` in `src/engine/atomic-commit.ts`
  - `fix` ← fix, resolve, correct, repair, revert, bug, hotfix
  - `docs` ← doc, docs, document, readme
  - `test` ← test, spec, coverage
  - `refactor` ← refactor, rename, move, extract, clean
  - `chore` ← chore, bump, upgrade, update
  - `style` ← style, format, prettier
  - `feat` ← default (all others)

### Implementation

- `formatCommitMessage(taskTitle, phaseSlug)` → `src/engine/atomic-commit.ts` (pure, no side effects)
- `runAtomicCommit(taskTitle, phaseSlug, projectDir)` → real git execution (`git add -A` + `git commit`)
- `TaskExecutionResult.commitMessage` — formatted commit string; set on success; `undefined` on failure

**Alpha stubs:** `runAtomicCommit()` is not called in stub mode. The `commitMessage` field is
populated in `TaskExecutionResult` for auditability but no actual Git commit is executed.
Production task runners invoke `runAtomicCommit()` after real subagent work completes.
```

### execute.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base | Header + intro + Impl Notes | ~18 | ~18 |
| 6.1 | Wave Execution | ~45 | ~63 |
| **6.2** | **Atomic Commits** | **~30** | **~93** |
| 6.3 | Crash Recovery | ~25 | ~118 |
| 6.4 | Wave Verification | ~35 | ~153 |
| 6.5 | Budget Guards | ~35 | ~188 |

Target: ≤300 lines with all 5 stories. Budget is ample (~112 lines remaining after all stories).

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `atomic-commit.ts` or its test file — they are pre-built and complete
- ❌ Do NOT call `runAtomicCommit()` from `executeTaskStub()` in Alpha — this is intentional
- ❌ Do NOT add duplicate `commitMessage` field logic — it already exists in `executeTaskStub()`
- ❌ Do NOT import from `src/commands/` in `src/engine/` — layer dependency violation
- ❌ Do NOT use `export default` — named exports only in `src/engine/`
- ❌ Do NOT add `result.tsv` or git ratchet logic here — that belongs to `src/optimize/ratchet.ts` (Epic 12)

### Previous Story Intelligence (Story 6.1)

- **Pre-built pattern:** Same as this story — implementation existed before story tracking; primary task is the execute.md documentation section
- **ESM imports:** `.js` extension MANDATORY: `import { formatCommitMessage } from './atomic-commit.js'`
- **Result<T> usage:** `runAtomicCommit` returns `Result<string, CliError>` — uses `ok(message)` or `err({...})`
- **Error code:** On git failure, uses `ERROR_CODES.FILE_WRITE_FAILED` with `params: { path: 'git', reason }`
- **Test count baseline at start of Epic 6 work:** 1723 tests across 68 files — verify no regression

### Coverage Expectations

- `src/engine/atomic-commit.ts` (pure functions): 85%+ line coverage on `inferCommitType` and `formatCommitMessage`
- `runAtomicCommit`: NOT unit-tested (requires real git repo) — excluded from coverage threshold
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Project Structure Notes

`atomic-commit.ts` is wired to the command system only via `wave-executor.ts` (which imports `formatCommitMessage`). Do NOT modify `src/cli/index.ts` or `src/commands/registry.ts`.

### References

- [Source: epics.md#Epic6-Story6.2] — User story, AC
- [Source: architecture.md#FR-702] — Atomic Commits: `src/engine/atomic-commit.ts`
- [Source: architecture.md#coverage-thresholds] — Global 70%, optimize/ratchet.ts 85%
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/`
- [Source: 6-1-wave-parallel-execution-with-subagent-isolation.md] — execute.md line budget, Wave Execution section template
- [Source: src/engine/atomic-commit.ts] — `inferCommitType`, `formatCommitMessage`, `runAtomicCommit`
- [Source: src/engine/wave-executor.ts] — `executeTaskStub()` uses `formatCommitMessage`, `TaskExecutionResult.commitMessage`
- [Source: src/commands/execute/handler.ts] — passes `planSlug` as `phaseSlug` via `buildWaveTaskGroups()`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — clean run, no issues encountered.

### Completion Notes List

- Task 1: Added `## Atomic Commits` section to `templates/commands/execute.md` after `## Wave Execution`. Section documents commit format `type(phaseSlug): taskTitle`, all 7 type-inference keyword rules, the three key functions, and Alpha stub behavior. Final line count: 96 (well under 300 limit).
- Task 2: Read-only verification of `src/engine/atomic-commit.ts` — all 3 pure/effectful functions confirmed correct: `inferCommitType` (7 types), `formatCommitMessage` (correct format), `runAtomicCommit` (git add -A + git commit via execSync). `commitMessage` field confirmed set in `executeTaskStub()` via `formatCommitMessage()`.
- Task 3: Read-only verification of `test/unit/engine/atomic-commit.test.ts` — all 7 types covered for `inferCommitType`, case-insensitivity confirmed, `formatCommitMessage` format/type/empty-slug/title-preservation confirmed, atomic guarantee (one unique commit per task, format regex) confirmed. `runAtomicCommit` intentionally not unit-tested (requires real git).
- Task 4: Full regression suite passed — 1723 tests across 68 files, zero failures.

### File List

templates/commands/execute.md

## Change Log

- 2026-03-19: Added `## Atomic Commits` section to `templates/commands/execute.md`; verified pre-built `src/engine/atomic-commit.ts` and `test/unit/engine/atomic-commit.test.ts`; all 1723 tests pass.
