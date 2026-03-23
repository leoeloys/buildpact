# Story 6.1: Wave-Parallel Execution with Subagent Isolation

Status: done

## Story

As a developer executing a multi-wave plan,
I want `/bp:execute` to run each wave's tasks in parallel using isolated subagents,
So that independent tasks complete faster without sharing context that could cause drift or hallucination.

## Acceptance Criteria

1. **Wave Dispatch to Isolated Subagents**
   - Given I run `/bp:execute` with a plan containing multiple waves
   - When execution begins
   - Then tasks within the same wave are dispatched to independent subagents simultaneously
   - And each subagent receives a clean context window containing only: the relevant plan file, task-specific context, and necessary codebase context
   - And subagents do NOT share state or inherit accumulated orchestrator context

2. **Sequential Wave Ordering**
   - Given execution begins
   - When wave N completes
   - Then wave N+1 begins only after all tasks in wave N complete successfully
   - And if any task in wave N fails, execution halts before wave N+1 begins

3. **Wave Execution Section in execute.md Orchestrator**
   - Given the execute.md stub from Story 1.3
   - When Story 6.1 adds the Wave Execution section
   - Then `templates/commands/execute.md` includes `## Wave Execution` section documenting: clean context payload structure, parallel dispatch protocol, sequential wave ordering, and key types
   - And execute.md total remains ≤300 lines

4. **Plan File Discovery**
   - Given a plan directory at `.buildpact/plans/{{spec_slug}}/`
   - When `/bp:execute` runs
   - Then it discovers wave plan files named `plan-wave-{N}.md` and `plan-wave-{N}b.md` (split waves)
   - And loads them sorted by filename to ensure correct wave ordering

5. **Task Extraction from Plan Files**
   - Given wave plan files with tasks formatted as `- [ ] [AGENT] Title` or `- [ ] [HUMAN] Title`
   - When the executor loads the wave files
   - Then all [AGENT] and [HUMAN] tasks are extracted with correct wave numbers
   - And dependency annotations like `_(after: T2)_` are stripped from task titles

## Tasks / Subtasks

- [x] Task 1: Add `## Wave Execution` section to `templates/commands/execute.md` (AC: #3)
  - [x] 1.1: Add `## Wave Execution` section after the intro (replace stub body)
  - [x] 1.2: Document the subagent isolation protocol (clean context payload structure)
  - [x] 1.3: Document parallel dispatch within a wave (`executeWave()`)
  - [x] 1.4: Document sequential wave ordering (`executeWaves()` with `haltOnFailure`)
  - [x] 1.5: Document plan file naming and discovery (`plan-wave-{N}.md`, `.buildpact/plans/`)
  - [x] 1.6: Update `## Implementation Notes` to reference correct entry point and output paths
  - [x] 1.7: Verify execute.md total ≤300 lines after update (65 lines)

- [x] Task 2: Verify `src/engine/wave-executor.ts` execution exports meet AC #1, #2, #5
  - [x] 2.1: Confirm `buildSubagentContext(task: WaveTask): TaskDispatchPayload` builds clean isolated payload
  - [x] 2.2: Confirm `executeTaskStub(task: WaveTask): TaskExecutionResult` validates payload size ≤20KB
  - [x] 2.3: Confirm `executeWave(tasks: WaveTask[]): WaveExecutionResult` dispatches all tasks in parallel
  - [x] 2.4: Confirm `executeWaves(waves, haltOnFailure?): Result<WaveExecutionResult[]>` halts on first failed wave
  - [x] 2.5: Confirm `parseWaveTasksFromPlanFile()` extracts [AGENT]/[HUMAN] tasks and strips `_(after:)_`

- [x] Task 3: Verify `src/commands/execute/handler.ts` meets AC #1, #2, #4, #5
  - [x] 3.1: Confirm `findLatestPlan()` discovers latest plan dir by last-alphabetical slug
  - [x] 3.2: Confirm `loadWaveFiles()` loads `plan-wave-{N}.md` + `plan-wave-{N}b.md` sorted by filename
  - [x] 3.3: Confirm `buildWaveTaskGroups()` groups by wave number and merges split wave files
  - [x] 3.4: Confirm `handler.run()` orchestrates: discover plan → load waves → build task groups → execute waves sequentially

- [x] Task 4: Verify tests in `test/unit/engine/wave-executor.test.ts` cover AC #1, #2, #5
  - [x] 4.1: `buildSubagentContext` — payload type, content includes title/plan, codebase context, constitutionPath, budgetUsd, unique taskIds
  - [x] 4.2: `executeTaskStub` — success result, commitMessage format, oversized payload → failure
  - [x] 4.3: `executeWave` — empty result, all tasks executed, allSucceeded=false on failure
  - [x] 4.4: `executeWaves` — sequential order, halts on failure by default, continues when haltOnFailure=false
  - [x] 4.5: `parseWaveTasksFromPlanFile` — AGENT+HUMAN extracted, strips `_(after:)_`, unique taskIds, empty → []

- [x] Task 5: Verify tests in `test/unit/commands/execute.test.ts` cover AC #1, #4, #5
  - [x] 5.1: `findLatestPlan` — dir not exist, empty dir, returns last alphabetical slug
  - [x] 5.2: `loadWaveFiles` — empty dir, sorted by name, split wave files, ignores non-wave files
  - [x] 5.3: `buildWaveTaskGroups` — two waves, merges split wave files, constitutionPath, phaseSlug, no-match → empty
  - [x] 5.4: `formatExecutionSummary` — success, failure with error, multiple waves
  - [x] 5.5: `handler.run()` integration — full success, verification report written, no spec → ok

- [x] Task 6: Run full test suite and verify no regressions (AC: all)
  - [x] 6.1: `npx vitest run` — 1723 tests pass (68 files), no regressions
  - [x] 6.2: Execute command and wave-executor tests pass
  - [x] 6.3: Verify execute.md ≤300 lines (65 lines confirmed)

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

Most of this story was pre-implemented before formal story tracking. **Do NOT recreate or overwrite these files:**

| File | Status | Notes |
|------|--------|-------|
| `src/engine/wave-executor.ts` | ✅ Exists | Has all execution functions — extends Story 5.2's plan functions |
| `src/commands/execute/handler.ts` | ✅ Exists | Full command orchestrator |
| `src/commands/execute/index.ts` | ✅ Exists | Barrel export: `handler` |
| `test/unit/engine/wave-executor.test.ts` | ✅ Exists | 40+ tests for execution functions |
| `test/unit/commands/execute.test.ts` | ✅ Exists | 20+ tests for handler functions |
| `locales/en.yaml` | ✅ Exists | `cli.execute.*` keys fully populated |
| `locales/pt-br.yaml` | ✅ Exists | `cli.execute.*` keys fully populated (PT-BR) |

**The PRIMARY remaining task is Task 1: add `## Wave Execution` section to `templates/commands/execute.md`.**

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```
`src/engine/wave-executor.ts` imports from `src/contracts/` and other engine modules only.

**FR-700 maps to:** `src/engine/` + `templates/commands/execute.md`
[Source: architecture.md#FR-700]

**Key types in `src/engine/wave-executor.ts`:**
```typescript
export interface WaveTask {
  taskId: string
  title: string
  waveNumber: number         // 0-indexed
  planContent: string        // ONLY this plan file — no orchestrator state
  codebaseContext?: string
  budgetUsd?: number
  constitutionPath?: string
  phaseSlug?: string         // for atomic commit message (FR-702)
}

export interface TaskExecutionResult {
  taskId: string
  title: string
  waveNumber: number
  success: boolean
  artifacts: string[]
  error?: string
  commitMessage?: string     // present only on success — type(phaseSlug): title
}

export interface WaveExecutionResult {
  waveNumber: number
  tasks: TaskExecutionResult[]
  allSucceeded: boolean
}
```

**Key imports in `src/engine/wave-executor.ts`:**
```typescript
import { buildTaskPayload, validatePayloadSize } from './subagent.js'
import { formatCommitMessage } from './atomic-commit.js'
import type { TaskDispatchPayload, TaskResult } from '../contracts/task.js'
import type { Result } from '../contracts/errors.js'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { TaskNode, WaveGroup as PlanWaveGroup, PlanFile } from './types.js'
```

**Isolation guarantee:** `buildSubagentContext()` builds content as:
```
# Task: {title}

## Plan Context
{planContent}

## Codebase Context  (only if codebaseContext provided)
{codebaseContext}
```
No orchestrator state, no prior wave results, no sibling task outputs.

**Payload size enforcement:** `validatePayloadSize()` enforces ≤20KB (20,480 bytes).
Tasks exceeding this produce `TaskExecutionResult.success = false` with `PAYLOAD_TOO_LARGE` error.
[Source: architecture.md#NFR-02, 1-3-subagent-isolation-architecture.md]

### Plan File Discovery

**Where plans live:**
```
.buildpact/plans/{{spec_slug}}/
├── plan-wave-1.md      # Wave 1 tasks (0-indexed: waveNumber=0)
├── plan-wave-1b.md     # Wave 1 overflow (split waves — same waveNumber)
├── plan-wave-2.md      # Wave 2 tasks (waveNumber=1)
└── plan-wave-2b.md     # Wave 2 overflow (if needed)
```

Note: **different convention from planning output** (snapshots use `wave-{N}-plan-{M}.md`).
Execute reads `plan-wave-{N}.md` from `.buildpact/plans/` — this is the execute pipeline's input format.

**Discovery order:** `findLatestPlan()` returns the last alphabetical entry from `.buildpact/plans/`.
For a specific plan, pass the plan directory path as `handler.run([planDir])`.

### Task Format in Plan Files

Wave plan files use this exact task line format (from the planning pipeline):
```markdown
- [ ] [AGENT] Implement authentication module
- [ ] [HUMAN] Review with team
- [ ] [AGENT] Deploy to staging _(after: T2)_
```

`parseWaveTasksFromPlanFile()` regex: `/^-\s+\[\s*\]\s+\[(AGENT|HUMAN)\]\s+(.+)$/`
Strips `_(after: ...)_` suffix from titles.

### execute.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base | Header + intro + Impl Notes | ~18 | ~18 |
| **6.1** | **Wave Execution** | **~45** | **~63** |
| 6.2 | Atomic Commits | ~30 | ~93 |
| 6.3 | Crash Recovery | ~25 | ~118 |
| 6.4 | Wave Verification | ~35 | ~153 |
| 6.5 | Budget Guards | ~35 | ~188 |

Target: ≤300 lines with all 5 stories. Budget is ample (~112 lines remaining).

### Anti-Patterns to Avoid

- ❌ Do NOT recreate files listed in the "PRE-BUILT CODE" table above
- ❌ Do NOT add `export default` — named exports only in `src/engine/`
- ❌ Do NOT share state between `WaveTask` objects — each task's `planContent` is its full isolated context
- ❌ Do NOT import from `src/commands/` in `src/engine/` — layer dependency violation
- ❌ Do NOT add `TaskDispatchPayload.constitutionPath` again — it already exists in `src/contracts/task.ts`
- ❌ Do NOT create `src/engine/types.ts` again — it already exists with `TaskNode`, `WaveGroup`, `PlanFile`

### Previous Story Intelligence (Story 5.2)

- **Files created in 5.2:** `src/engine/types.ts`, extended `wave-executor.ts` (`analyzeWaves`, `splitIntoPlanFiles`)
- **Testing pattern:** no mocks for pure engine functions — call directly with test data
- **Integration test pattern:** `mkdtemp(join(tmpdir(), 'buildpact-'))` for temp dirs, `rm(dir, { recursive: true })` in `afterEach`
- **ESM imports:** `.js` extension MANDATORY: `import { executeWave } from './wave-executor.js'`
- **Result<T> usage:** all fallible functions return `Result<T, CliError>` — no throws
- **Test count at story 5.2 completion:** 62 files, 1672 tests — verify count doesn't regress

### execute.md Wave Execution Section Template

The section to add to `templates/commands/execute.md` between the intro and `## Implementation Notes`:

```markdown
## Wave Execution

The execution pipeline runs plan tasks in wave-parallel fashion — tasks within
the same wave are dispatched simultaneously to isolated subagents (FR-701).

### Subagent Isolation Protocol

Each task is dispatched to a **clean subagent** that receives exactly:

1. **Plan content** — the relevant `plan-wave-{N}.md` file text
2. **Task-specific context** — task title and optional codebase snippets
3. **Constitution path** — path to `.buildpact/constitution.md` (if it exists)

Subagents **do NOT** inherit orchestrator context, prior wave results, or
state from sibling tasks. Context is assembled by `buildSubagentContext()`
in `src/engine/wave-executor.ts`. Payload validated ≤20KB before dispatch.

### Parallel Dispatch Protocol

All tasks in a wave are dispatched simultaneously; the wave completes only
when all its tasks finish (pass or fail):

- Alpha: `executeTaskStub()` simulates concurrent Task() calls synchronously
- Production: each `executeTaskStub()` call is replaced by a real `Task()` dispatch
- Payload oversizing (>20KB) causes immediate task failure without dispatch

Implementation: `executeWave(tasks: WaveTask[]): WaveExecutionResult`
Types: `WaveTask`, `TaskExecutionResult`, `WaveExecutionResult` in `src/engine/wave-executor.ts`

### Sequential Wave Ordering

Waves execute one at a time — next wave begins only after current wave succeeds:

- `executeWaves(waves, haltOnFailure=true)` loops over wave groups in order
- On any wave failure (any task `success=false`), execution halts before next wave
- Each task in the current wave must complete before any task in the next wave starts

### Plan File Format

Wave plan files are read from: `.buildpact/plans/{{spec_slug}}/plan-wave-{N}.md`

Tasks are parsed from lines matching: `- [ ] [AGENT] Title` or `- [ ] [HUMAN] Title`
Dependency annotations `_(after: T2)_` are stripped from titles automatically.
```

### Coverage Expectations

- `src/engine/wave-executor.ts` (execution exports): 85%+ line coverage
- `src/commands/execute/handler.ts` (pure functions): 80%+ line coverage
[Source: architecture.md#coverage-thresholds]

### Project Structure Notes

Execute pipeline is wired to the command registry. Do NOT modify `src/cli/index.ts`
or `src/commands/registry.ts` — execute is already registered and routable.

### References

- [Source: epics.md#Epic6-Story6.1] — User story, AC
- [Source: architecture.md#FR-700] — Execute: `src/engine/` + `templates/commands/execute.md`
- [Source: architecture.md#Complete-Project-Tree] — engine/ directory (lines 949–955)
- [Source: architecture.md#NFR-02] — Payload ≤20KB constraint
- [Source: 1-3-subagent-isolation-architecture.md] — subagent.ts payload builder, isolation guarantee
- [Source: 5-2-wave-based-plan-generation.md] — wave-executor.ts plan functions (analyzeWaves, splitIntoPlanFiles)
- [Source: src/engine/wave-executor.ts] — WaveTask, executeWave, executeWaves, buildSubagentContext

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_No debug issues encountered._

### Completion Notes List

- Task 1: Added `## Wave Execution` section to `templates/commands/execute.md` with 4 subsections (Subagent Isolation Protocol, Parallel Dispatch Protocol, Sequential Wave Ordering, Plan File Format). Updated `## Implementation Notes` to reference correct entry point (`src/commands/execute/handler.ts`) and output paths (`.buildpact/plans/`). Total: 65 lines ≤300 budget.
- Tasks 2–5: Verified all pre-built execution exports and test coverage in `wave-executor.ts`, `handler.ts`, and their test files — all ACs confirmed satisfied.
- Task 6: `npx vitest run` — 1723 tests, 68 files, all pass, no regressions.

### File List

- `templates/commands/execute.md` (modified)

## Change Log

- 2026-03-18: Added `## Wave Execution` section to `templates/commands/execute.md` — documents subagent isolation protocol, parallel dispatch, sequential wave ordering, and plan file format. Updated Implementation Notes with correct entry point and output paths. All pre-built execution code verified. 1723 tests pass, no regressions.
