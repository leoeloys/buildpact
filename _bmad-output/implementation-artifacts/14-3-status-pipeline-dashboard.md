# Story 14.3: Status Pipeline Dashboard

Status: review

## Story

As a developer working on a BuildPact project,
I want to run `bp status` to see a color-coded overview of my pipeline state,
so that I can quickly understand where I am in the specify-plan-execute-verify cycle without checking files manually.

## Acceptance Criteria

1. **Pipeline Phase Summary**
   - Given I run `bp status` in a project with `.buildpact/` initialized
   - When the dashboard renders
   - Then it shows each pipeline phase (specify, plan, execute, verify) with a status indicator: green checkmark for done, yellow spinner for in-progress, dim dash for not-started
   - And the current active phase is highlighted

2. **Artifact Counts**
   - Given the project has specs, plans, and execution results
   - When the dashboard renders
   - Then it shows counts: specs created, plans generated, tasks completed/total, verification pass/fail, memory entries
   - And zero counts display as dimmed "0" rather than being hidden

3. **Execution Progress Detail**
   - Given an execution is in progress or completed
   - When `bp status` runs
   - Then it shows wave progress (e.g., "Wave 2/4") and task progress within the current wave
   - And elapsed time since execution started is shown

4. **No Project Fallback**
   - Given I run `bp status` outside a BuildPact project (no `.buildpact/` directory)
   - When the command starts
   - Then it returns an error with i18n key `cli.status.no_project` suggesting `bp doctor` to initialize

5. **Memory Tier Summary**
   - Given the project has memory entries across tiers
   - When `bp status` runs
   - Then it shows a compact summary: feedback count, lessons count, decisions count

## Tasks / Subtasks

- [x] Task 1: Create `src/commands/status/handler.ts` — dashboard renderer (AC: #1, #4)
  - [x] 1.1: Check for `.buildpact/` directory; if missing, return `err()` with `cli.status.no_project`
  - [x] 1.2: Load `DashboardState` from `src/engine/dashboard-state.ts` using `loadDashboardState(projectDir)`
  - [x] 1.3: Render pipeline phase row for each phase using `clack.log.info` with ANSI color codes via `picocolors`
  - [x] 1.4: Determine active phase from `PipelineState.phase` field in state.json

- [x] Task 2: Implement artifact counting (AC: #2)
  - [x] 2.1: Count spec files in `.buildpact/specs/` directory
  - [x] 2.2: Count plan files in `.buildpact/plans/` directory
  - [x] 2.3: Parse execution state from `.buildpact/state.json` for task completion counts
  - [x] 2.4: Count verification results from `.buildpact/verify/` directory

- [x] Task 3: Implement execution progress and memory summary (AC: #3, #5)
  - [x] 3.1: Read wave/task progress from `PipelineState` (waveNumber, totalWaves, taskIndex, totalTasks)
  - [x] 3.2: Calculate elapsed time from `PipelineState.startedAt` to now; format as `Xm Ys`
  - [x] 3.3: Count memory entries: parse `feedback.json` length, count files in `lessons/` and `decisions/`
  - [x] 3.4: Render memory summary row: "Memory: {n} feedback | {n} lessons | {n} decisions"

- [x] Task 4: Wire command and add i18n (AC: all)
  - [x] 4.1: Create `src/commands/status/index.ts` exporting `handler` as `CommandHandler`
  - [x] 4.2: Add `'status'` to `CommandId` union in `src/commands/registry.ts`; add registry entry
  - [x] 4.3: Add i18n keys to `locales/en.yaml`: `cli.status.no_project`, `cli.status.header`, `cli.status.phase_done`, `cli.status.phase_active`, `cli.status.phase_pending`, `cli.status.memory_summary`
  - [x] 4.4: Add same keys to `locales/pt-br.yaml`
  - [x] 4.5: Add unit tests in `test/unit/commands/status.test.ts`

## Dev Notes

### Architecture Requirements
- Follow Result<T, CliError> pattern for all public functions
- Use `@clack/prompts` for structured TUI output; use `picocolors` for ANSI color (green/yellow/dim)
- Named exports only, `.js` extensions on all imports (ESM)
- This is a read-only command — no mutations to state files
- Audit log: append `status.view` action

### Existing Code to Reuse
- `src/engine/dashboard-state.ts` — `DashboardState`, `PipelineState`, `AgentState` types, `loadDashboardState()`, `PipelinePhase` type
- `src/engine/session-feedback.ts` — for counting feedback entries
- `src/contracts/errors.ts` — `err()`, `ok()`, `ERROR_CODES`
- `src/foundation/installer.ts` — `findProjectRoot()` for locating `.buildpact/`

### Project Structure Notes
- New command directory: `src/commands/status/`
- Files: `index.ts` (CommandHandler), `handler.ts` (rendering logic)
- No template needed — this is a pure TypeScript rendering command

### References
- Story 1.4 (Real-Time Context and Cost Monitoring) — original dashboard state design
- `src/engine/dashboard-state.ts` — state.json schema and read/write utilities

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Created status command from scratch with inline state reading (dashboard-state.ts not yet available in worktree)
- Pipeline phases rendered with ANSI color: green checkmark (done), yellow dot (active), dim dash (pending)
- Artifact counts: specs, plans, tasks, verifications
- Execution progress: wave/totalWaves, elapsed time
- Memory summary: feedback/lessons/decisions counts
- Returns error with cli.status.no_project when .buildpact/ missing
- Added 'status' to CommandId union and registry

### Change Log
- 2026-03-22: Implemented all tasks and subtasks

### File List
- src/commands/status/handler.ts (new)
- src/commands/status/index.ts (new)
- src/commands/registry.ts (updated: added 'status')
- locales/en.yaml (added cli.status.* keys)
- locales/pt-br.yaml (added cli.status.* keys)
- test/unit/commands/status.test.ts (new)
