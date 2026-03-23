# Story 13.4: Streaming Progress Output

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer running live AI execution,
I want real-time progress feedback in my terminal during wave execution,
so that I can see which tasks are running, how long they take, and how much cost is accumulating.

## Acceptance Criteria

**AC-1: During wave execution, terminal shows real-time status for each dispatched task**

Given a wave is executing with N tasks dispatched to a live provider,
When execution is in progress,
Then the terminal displays a live-updating status section showing all tasks in the current wave,
And the display updates as tasks transition between states,
And completed waves show a summary line before the next wave begins.

**AC-2: Each task shows: name, status (pending/running/complete/failed), elapsed time**

Given a task is dispatched within a wave,
When the task status changes,
Then the terminal shows: task title, current status icon/label, and elapsed time since dispatch,
And status transitions are: `pending` (queued) -> `running` (dispatched) -> `complete`/`failed` (resolved),
And elapsed time updates at reasonable intervals (every 1-2 seconds while running).

**AC-3: Wave-level summary shows total cost accumulated and tasks complete/total**

Given a wave is executing,
When the wave progress is displayed,
Then a wave header shows: `Wave {N}/{total} — {completed}/{taskCount} tasks — ${cost} spent`,
And cost accumulates as each task completes (from `TaskExecutionResult.costUsd`),
And the summary updates after each task completion.

**AC-4: Progress output uses @clack/prompts patterns consistent with existing UX**

Given BuildPact uses `@clack/prompts` for all terminal interaction,
When progress is displayed during execution,
Then it uses `clack.spinner()` for running tasks and `clack.log.*` for completed task summaries,
And the visual style is consistent with existing `clack.log.info`, `clack.log.success`, `clack.log.error` usage,
And colors and formatting follow the existing CLI aesthetic.

**AC-5: Progress updates don't interfere with L1 autonomy confirmation prompts**

Given the execute handler may pause for L1 autonomy write confirmations between waves,
When a confirmation prompt appears,
Then all spinners are stopped before the prompt is displayed,
And progress output resumes cleanly after the user responds,
And there is no visual corruption from overlapping spinner and prompt output.

## Tasks / Subtasks

- [ ] Task 1: Create wave progress renderer (AC: 1, 2, 4)
  - [ ] 1.1: Create `src/engine/progress-renderer.ts` with a `WaveProgressRenderer` class that wraps `@clack/prompts` spinner and log calls
  - [ ] 1.2: Implement `startTask(taskId, title)` — logs task as pending, starts spinner with task title
  - [ ] 1.3: Implement `completeTask(taskId, result: TaskExecutionResult)` — stops spinner, logs success/failure with elapsed time and cost
  - [ ] 1.4: Implement `startWave(waveNumber, totalWaves, taskCount)` — logs wave header
  - [ ] 1.5: Implement `endWave(waveNumber, waveResult: WaveExecutionResult)` — logs wave summary with total cost and pass/fail count
  - [ ] 1.6: Write unit tests with mocked clack calls — verify correct methods called in correct order

- [ ] Task 2: Add elapsed time tracking per task (AC: 2)
  - [ ] 2.1: Track `startTime` per task in the renderer when `startTask()` is called
  - [ ] 2.2: Calculate elapsed time on `completeTask()` as `Date.now() - startTime`
  - [ ] 2.3: Format elapsed time as human-readable string (`1.2s`, `45.3s`, `2m 15s`)
  - [ ] 2.4: Include elapsed time in completion log message

- [ ] Task 3: Integrate progress renderer into execute handler wave loop (AC: 1, 3)
  - [ ] 3.1: Instantiate `WaveProgressRenderer` in the execute handler before the wave loop
  - [ ] 3.2: Call `renderer.startWave()` before each `executeWave()` call
  - [ ] 3.3: Modify `executeWave()` to accept an optional `onTaskStart` and `onTaskComplete` callback — invoke renderer methods from these callbacks
  - [ ] 3.4: Call `renderer.endWave()` after each wave completes with aggregated results
  - [ ] 3.5: Accumulate and display running total cost across waves in the wave header

- [ ] Task 4: Handle spinner/prompt interaction for L1 autonomy (AC: 5)
  - [ ] 4.1: Add `pauseAll()` method to renderer — stops any active spinners
  - [ ] 4.2: Add `resumeAll()` method to renderer — restarts spinners for any still-running tasks
  - [ ] 4.3: In execute handler, call `renderer.pauseAll()` before any `clack.confirm()` autonomy prompt
  - [ ] 4.4: Call `renderer.resumeAll()` after the prompt resolves
  - [ ] 4.5: Write test verifying no active spinners during confirmation prompt

- [ ] Task 5: Update dashboard state with progress data (AC: 3)
  - [ ] 5.1: Update `writeDashboardState()` calls in execute handler to reflect current wave progress (taskIndex, totalTasks, waveNumber)
  - [ ] 5.2: Update agent status in dashboard state as tasks start/complete
  - [ ] 5.3: Include budget spent in dashboard state updates

## Dev Notes

### Architecture Requirements

**Progress renderer must be optional** — `executeWave()` should work without a renderer (callbacks are optional). StubProvider execution and tests should not require progress rendering.

**Spinner lifecycle matters** — `@clack/prompts` spinners write to stderr and use ANSI escape codes. Only one spinner should be active at a time. For parallel tasks, use a single spinner that rotates through running task names, or use `clack.log.*` for status updates instead.

**Dashboard state is separate from terminal output** — `writeDashboardState()` writes JSON to `.buildpact/state.json` for external consumption. Terminal progress is for the human user. Both should be updated but they are independent systems.

### Existing Code to Reuse (DO NOT Reinvent)

| Component | Location | Reuse How |
|-----------|----------|-----------|
| `@clack/prompts` | Already imported in execute handler | spinner, log.info, log.success, log.error |
| `DashboardState` | `src/engine/dashboard-state.ts` | AgentState, PipelineState types |
| `writeDashboardState()` | `src/engine/dashboard-state.ts` | Write progress to state.json |
| `WaveExecutionResult` | `src/engine/wave-executor.ts` | Wave result aggregation |
| `TaskExecutionResult` | `src/engine/wave-executor.ts` | Per-task result with costUsd, tokensUsed |
| `formatCostSummary()` | `src/engine/budget-guard.ts` | Existing cost formatting |
| Execute handler wave loop | `src/commands/execute/handler.ts` | Integration point |

### Key Implementation Details

**Single-spinner approach for parallel tasks:**
Since `@clack/prompts` supports one spinner at a time, use this pattern:
1. Before wave: `clack.log.step('Wave 1/3 — 5 tasks')`
2. Start spinner: `spinner.start('Running: task-1, task-2, task-3...')`
3. On task complete: `spinner.message('Running: task-2, task-3... (1/5 done, $0.02)')` — update message
4. All done: `spinner.stop('Wave 1/3 complete — 5/5 tasks, $0.08, 23.4s')`
5. Failed tasks: `clack.log.error('Task "implement auth" failed: ...')`

**Callback signature for executeWave:**
```typescript
interface WaveCallbacks {
  onTaskStart?: (taskId: string, title: string) => void
  onTaskComplete?: (taskId: string, result: TaskExecutionResult) => void
}
```

**Elapsed time formatting:**
```typescript
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60000)
  const sec = Math.round((ms % 60000) / 1000)
  return `${min}m ${sec}s`
}
```

### Previous Story Learnings (from 13-1, 13-2)

- **Injectable I/O pattern** — renderer should accept injected clack-like interface for testability
- **exactOptionalPropertyTypes** — don't assign `undefined` to optional fields
- **i18n not required for progress** — progress messages are ephemeral terminal output, not user-facing error messages; however, wave summary labels could use i18n keys for consistency
- **ESM imports** — always `.js` extension

### Project Structure Notes

```
src/engine/progress-renderer.ts    (new) — WaveProgressRenderer class
src/engine/wave-executor.ts        (modify) — add optional WaveCallbacks parameter
src/commands/execute/handler.ts    (modify) — instantiate renderer, pass callbacks
src/engine/dashboard-state.ts      (existing) — update calls for live progress
test/unit/engine/progress-renderer.test.ts (new)
test/unit/engine/wave-executor.test.ts     (modify — verify callbacks)
```

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-701] — Wave Execution
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-105] — Real-Time Context and Cost Monitoring
- [Source: src/engine/dashboard-state.ts] — DashboardState types and writer
- [Source: src/engine/wave-executor.ts] — executeWave with async dispatch
- [Source: src/commands/execute/handler.ts] — Wave loop and autonomy prompts
- [Source: src/engine/budget-guard.ts] — formatCostSummary
- [Source: _bmad-output/implementation-artifacts/13-1-subagent-provider-abstraction.md] — Previous story: async wave execution
- [Source: ROADMAP.md#Epic13] — Live Subagent Dispatch epic definition

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

### File List
