# Story 5.2: Wave-Based Plan Generation

Status: done

## Story

As a developer planning a multi-task feature,
I want `/bp:plan` to analyze task dependencies and group them into sequential execution waves with parallel tasks within each wave,
So that independent work runs in parallel and dependent work waits for its prerequisites — maximizing speed without race conditions.

## Acceptance Criteria

1. **Wave Grouping by Dependency**
   - Given a spec with multiple tasks of varying dependencies
   - When the planner analyzes the dependency graph
   - Then it groups independent tasks into the same wave and places dependent tasks in subsequent waves
   - And vertical slices (full feature slices) are preferred over horizontal layers

2. **Max 2–3 Tasks per Plan File**
   - Given the wave structure is generated
   - When individual plan files are created
   - Then each plan file contains a maximum of 2–3 tasks
   - And any plan exceeding this limit is automatically split into additional plan files

3. **Wave Section in plan.md Orchestrator**
   - Given Story 5.1 established plan.md with the research section
   - When Story 5.2 adds the wave generation section
   - Then `templates/commands/plan.md` includes `## Wave Generation` section documenting dependency analysis, wave grouping algorithm, and plan file creation rules
   - And plan.md total remains ≤300 lines

4. **Plan Files Written to Snapshots**
   - Given wave generation completes
   - When plan files are written
   - Then they are saved as `.buildpact/snapshots/{{spec_slug}}/plans/wave-{N}-plan-{M}.md`
   - And each file includes: wave number, tasks (max 3), task descriptions, and dependency list

5. **Vertical Slice Preference**
   - Given tasks that span multiple layers (e.g., backend + frontend of same feature)
   - When wave grouping runs
   - Then the planner groups them into the same wave as a vertical slice rather than separating by layer

## Tasks / Subtasks

- [x] Task 1: Extend `templates/commands/plan.md` with `## Wave Generation` section (AC: #3)
  - [x] 1.1: Add `## Wave Generation` section after Research Phase section (Story 5.1 must be done)
  - [x] 1.2: Document dependency analysis step: parse spec tasks → build dependency graph
  - [x] 1.3: Document wave grouping algorithm: topological sort → group independent tasks in same wave
  - [x] 1.4: Document vertical slice preference rule: co-located feature tasks → same wave
  - [x] 1.5: Document plan file creation rule: max 2–3 tasks per file; auto-split if exceeded
  - [x] 1.6: Document plan file naming: `wave-{N}-plan-{M}.md` in `.buildpact/snapshots/{{spec_slug}}/plans/`
  - [x] 1.7: Verify plan.md total ≤300 lines after adding this section

- [x] Task 2: Extend `src/engine/wave-executor.ts` with plan generation logic (AC: #1, #2, #5)
  - [x] 2.1: Export `analyzeWaves(tasks: TaskNode[]): WaveGroup[]` — topological sort + grouping
  - [x] 2.2: `WaveGroup` contains: `waveNumber: number`, `tasks: TaskNode[]`, `isParallel: boolean`
  - [x] 2.3: Implement vertical-slice preference: tasks with same `featureTag` grouped in same wave
  - [x] 2.4: Export `splitIntoPlanFiles(wave: WaveGroup, maxTasksPerFile: number): PlanFile[]` — splits waves with >3 tasks
  - [x] 2.5: `maxTasksPerFile` defaults to 3; configurable for tests
  - [x] 2.6: Add types to `src/engine/types.ts`: `TaskNode`, `WaveGroup`, `PlanFile`

- [x] Task 3: Create `src/commands/plan/handler.ts` — plan generation orchestrator (AC: #1, #2, #4)
  - [x] 3.1: Export `planCommand(specSlug: string): Promise<Result<PlanOutput, CliError>>`
  - [x] 3.2: Step 1 — call `spawnResearchAgents()` from `researcher.ts` (Story 5.1)
  - [x] 3.3: Step 2 — parse spec.md tasks → build `TaskNode[]` dependency list
  - [x] 3.4: Step 3 — call `analyzeWaves(tasks)` → produce `WaveGroup[]`
  - [x] 3.5: Step 4 — call `splitIntoPlanFiles(wave)` for each wave → produce `PlanFile[]`
  - [x] 3.6: Step 5 — write each plan file to `.buildpact/snapshots/{{spec_slug}}/plans/`
  - [x] 3.7: `Result<T,E>` from `src/contracts/errors.ts` — all errors wrapped, no throws

- [x] Task 4: Write unit tests for wave-executor.ts (AC: #1, #2, #5)
  - [x] 4.1: Create `test/unit/engine/wave-executor.test.ts`
  - [x] 4.2: Test: 3 independent tasks → single wave with 3 tasks (parallel)
  - [x] 4.3: Test: task C depends on B, B depends on A → 3 sequential waves (A, B, C)
  - [x] 4.4: Test: wave with 5 tasks → split into 2 plan files (3 + 2)
  - [x] 4.5: Test: tasks with same `featureTag` → grouped in same wave (vertical slice)
  - [x] 4.6: Test: empty task list → `[]` result (edge case)

- [x] Task 5: Write integration test for plan generation end-to-end (AC: #1, #2, #4)
  - [x] 5.1: Create `test/integration/pipeline/plan-generation.test.ts`
  - [x] 5.2: Test: given spec.md with 5 tasks (mixed dependencies) → plan files written to correct paths
  - [x] 5.3: Test: each plan file has ≤3 tasks
  - [x] 5.4: Test: wave-1 tasks are all independent (no deps in plan file)
  - [x] 5.5: Mock: `spawnResearchAgents()` returns stub `ResearchSummary`; real file writes in tmp dir

- [x] Task 6: Run full test suite and verify no regressions (AC: all)
  - [x] 6.1: `npx vitest run` — all existing tests pass, no regressions
  - [x] 6.2: New `wave-executor.test.ts` + `plan-generation.test.ts` pass
  - [x] 6.3: Verify plan.md ≤300 lines

## Dev Notes

### Architecture Context

**wave-executor.ts location:** `src/engine/wave-executor.ts` — already exists as a stub (FR-602, FR-701). Extend it, do NOT recreate.
[Source: architecture.md#Complete-Project-Tree]

**Plan command:** `src/commands/plan/` + `templates/commands/plan.md`
This story adds `handler.ts` to the plan command module created in Story 5.1.

**plan.md 300-line budget tracking:**

| Story | Section | Lines Added | Cumulative |
|-------|---------|------------|-----------|
| 5.1 | Research Phase | ~40 | ~40 |
| 5.2 | Wave Generation | ~45 | ~85 |
| 5.3 | Model Profile | ~30 | ~115 |
| 5.4 | Nyquist Validation | ~35 | ~150 |
| 5.5 | Non-Software Tagging | ~30 | ~180 |
| Base | Header + intro | ~20 | ~200 |

Target: ≤300 lines with all 5 stories. Budget is ample.

**TaskNode type:**
```typescript
// src/engine/types.ts
export interface TaskNode {
  id: string           // e.g., "task-1"
  description: string
  dependencies: string[] // IDs of tasks this depends on
  featureTag?: string   // for vertical slice grouping
}

export interface WaveGroup {
  waveNumber: number
  tasks: TaskNode[]
  isParallel: boolean  // true if all tasks in wave are independent
}

export interface PlanFile {
  filename: string     // e.g., "wave-1-plan-1.md"
  waveNumber: number
  planNumber: number
  tasks: TaskNode[]
}
```

**Wave Analysis Algorithm:**
```typescript
// Topological sort → grouping
function analyzeWaves(tasks: TaskNode[]): WaveGroup[] {
  // 1. Build adjacency map
  // 2. Compute in-degree for each task
  // 3. Start with tasks of in-degree 0 → Wave 1
  // 4. After removing Wave 1 tasks, recompute in-degrees → Wave 2
  // 5. Repeat until all tasks assigned
  // 6. Vertical slice: if tasks[i].featureTag === tasks[j].featureTag and same wave → keep together
}
```

**Plan file path format:** `.buildpact/snapshots/{{spec_slug}}/plans/wave-{N}-plan-{M}.md`
Example: `.buildpact/snapshots/users-reset-password/plans/wave-1-plan-1.md`

**Plan file content format:**
```markdown
# Wave 1 — Plan 1

## Tasks

### Task: create-db-schema
**Description:** Create the users table migration
**Dependencies:** none
**Wave:** 1 (parallel)

### Task: create-types
**Description:** Define User TypeScript interfaces
**Dependencies:** none
**Wave:** 1 (parallel)
```

**Result<T,E> usage (MANDATORY):**
```typescript
import type { Result, CliError } from '../../contracts/errors.js'

async function planCommand(specSlug: string): Promise<Result<PlanOutput, CliError>> {
  try {
    // ...
    return { ok: true, value: planOutput }
  } catch (err) {
    return { ok: false, error: new CliError('plan.generation.failed', err) }
  }
}
```
[Source: architecture.md#Format-Patterns]

**ESM imports (.js extension mandatory):**
```typescript
import { analyzeWaves } from '../../engine/wave-executor.js'  // ✅
import { spawnResearchAgents } from './researcher.js'          // ✅
```

**Module export pattern:**
```typescript
// src/engine/index.ts — add named export
export { analyzeWaves, splitIntoPlanFiles } from './wave-executor.js'
export type { TaskNode, WaveGroup, PlanFile } from './types.js'
```

### Spec Parsing for Task Extraction

The plan handler reads `spec.md` from `.buildpact/specs/{{spec_slug}}/spec.md` and extracts tasks. The task section format comes from `specify.md` (Story 4.1):
```markdown
## Tasks
- task-1: Create database schema (deps: none)
- task-2: Create API endpoint (deps: task-1)
```
Parse this into `TaskNode[]` objects.

### Anti-Patterns to Avoid

- ❌ Do NOT implement execution logic (that's Epic 6 / `wave-executor.ts` execution path)
- ❌ Do NOT create separate files for each wave type — single `wave-executor.ts`
- ❌ Do NOT add more than 2-3 tasks per plan file — hard split if exceeded
- ❌ Do NOT share state between research agents (Story 5.1 pattern)

### Testing Pattern (from Epic 4)

```typescript
// Integration test pattern from 4-4 story
vi.mock('@clack/prompts', () => ({ ... }))
vi.mock('../../../src/foundation/audit.js', () => ({ AuditLogger: class { log = vi.fn() } }))
vi.mock('../../../src/commands/plan/researcher.js', () => ({
  spawnResearchAgents: vi.fn().mockResolvedValue(stubResearchSummary)
}))
```

### Coverage Expectations

- `src/engine/wave-executor.ts` (new exports): 85%+ line coverage
- `src/commands/plan/handler.ts`: 80%+ line coverage
[Source: architecture.md#coverage-thresholds]

### References

- [Source: epics.md#Epic5-Story5.2] — User story, AC
- [Source: architecture.md#Complete-Project-Tree] — wave-executor.ts location (FR-602, FR-701)
- [Source: architecture.md#FR-600] — Plan command directory
- [Source: architecture.md#Format-Patterns] — Result<T,E> usage
- [Source: 5-1-automated-parallel-research-before-planning.md] — researcher.ts (spawnResearchAgents)
- [Source: 4-4-automation-maturity-assessment.md#Dev-Notes] — Integration test pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- `src/engine/types.ts` — Created with `TaskNode`, `WaveGroup`, `PlanFile` interfaces (AC #1, #2, #5)
- `src/engine/wave-executor.ts` — Added `analyzeWaves()` (topological sort + vertical-slice featureTag grouping) and `splitIntoPlanFiles()` (max-N chunks with wave-{N}-plan-{M}.md naming) (AC #1, #2, #5)
- `src/engine/index.ts` — Exported new engine functions and types
- `templates/commands/plan.md` — Renamed `## Wave-Based Planning` → `## Wave Generation`; added full algorithm docs (dependency analysis, topological sort, vertical slice preference, plan file naming) — 128 lines total, ≤300 (AC #3)
- `src/commands/plan/handler.ts` — Added `PlanOutput` type, `parseSpecTasks()` helper (parses `## Tasks` section with dep notation, falls back to `## Acceptance Criteria`), and `runPlanCommand(specSlug)` orchestrator that calls `spawnResearchAgents()` → `analyzeWaves()` → `splitIntoPlanFiles()` → writes to `.buildpact/snapshots/{{spec_slug}}/plans/` (AC #1, #2, #4)
- `src/commands/plan/index.ts` — Exported `runPlanCommand`, `parseSpecTasks`, `PlanOutput`
- `test/unit/engine/wave-executor.test.ts` — Added 12 new unit tests covering all story test cases (4.2–4.6 and splitIntoPlanFiles variants)
- `test/integration/pipeline/plan-generation.test.ts` — Created with 6 integration tests covering AC #1, #2, #4 with mocked `spawnResearchAgents()` and real file writes in tmp dir
- All 62 test files, 1672 tests pass — 18 new tests, zero regressions

**Architecture note:** The existing `handler.run()` CLI path (used by the command registry) was preserved unchanged. `runPlanCommand(specSlug)` is the new programmatic API that follows the story's exact architecture: research → wave analysis → plan file writing to snapshots. Plan files use `wave-{N}-plan-{M}.md` naming in `.buildpact/snapshots/{{spec_slug}}/plans/`.

### File List

- `src/engine/types.ts` (created)
- `src/engine/wave-executor.ts` (modified — added analyzeWaves, splitIntoPlanFiles + types import)
- `src/engine/index.ts` (modified — added new exports)
- `templates/commands/plan.md` (modified — Wave Generation section)
- `src/commands/plan/handler.ts` (modified — PlanOutput, parseSpecTasks, runPlanCommand)
- `src/commands/plan/index.ts` (modified — new exports)
- `test/unit/engine/wave-executor.test.ts` (modified — added analyzeWaves/splitIntoPlanFiles tests)
- `test/integration/pipeline/plan-generation.test.ts` (created)

## Change Log

- 2026-03-18: Story implemented — wave-based plan generation engine (analyzeWaves, splitIntoPlanFiles), types, plan.md Wave Generation section, runPlanCommand orchestrator, 18 new tests (62 files, 1672 tests — zero regressions)
