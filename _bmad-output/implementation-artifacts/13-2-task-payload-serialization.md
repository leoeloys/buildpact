# Story 13.2: Task Payload Serialization

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a framework developer building live subagent dispatch,
I want task payloads to include structured context (constitution rules, project context, squad agent definitions, budget constraints, and model profile),
so that subagents receive everything needed for informed execution without accessing orchestrator state.

## Acceptance Criteria

**AC-1: TaskDispatchPayload includes structured context fields per FR-302 schema**

Given the PRD defines a structured Task Dispatch Payload schema (FR-302),
When a task payload is built for dispatch,
Then `TaskDispatchPayload` includes: `description` (human-readable task summary), `projectContextPath` (path to project-context.md if exists), `squadAgentPath` (path to active squad agent definition if squad active), `modelProfile` (active profile tier: quality/balanced/budget), `budgetRemainingUsd` (remaining budget across the session), and `commitFormat` (atomic commit message template).

**AC-2: Task ID follows deterministic format**

Given the PRD specifies task IDs as `task-{phase}-{planIndex}-{taskSequence}`,
When `buildSubagentContext()` creates a payload,
Then the `taskId` follows this pattern (e.g., `task-execute-02-03`),
And the format is deterministic for the same wave/plan/task combination,
And existing `randomUUID()` task IDs are preserved for WaveTask (internal) while dispatch payloads get deterministic IDs.

**AC-3: buildSubagentContext loads and serializes available context**

Given the execute handler has access to project context, squad name, and budget state,
When a WaveTask is built for dispatch,
Then `buildSubagentContext()` accepts enhanced parameters (projectContextPath, squadAgentPath, modelProfile, budgetRemainingUsd, commitFormat),
And these are serialized into the `TaskDispatchPayload`,
And the serialized payload remains ≤ 20KB (NFR-02).

**AC-4: Execute handler passes all available context to wave tasks**

Given the execute handler loads spec, constitution, budget config, and squad name,
When wave tasks are constructed,
Then `projectContextPath` is resolved from `.buildpact/project-context.md` (if exists),
And `squadAgentPath` is resolved from the active squad's agent definition (if squad active),
And `budgetRemainingUsd` is computed from budget config minus accumulated spend,
And `modelProfile` is read from active profile tier,
And `commitFormat` includes the plan slug for atomic commit messages.

**AC-5: Payload remains within 20KB limit with all new fields (NFR-02)**

Given the payload now includes additional context fields,
When the payload is serialized,
Then `validatePayloadSize()` continues to enforce the 20KB limit,
And tests verify realistic payloads with all fields populated stay within limits.

## Tasks / Subtasks

- [x] Task 1: Expand TaskDispatchPayload interface (AC: 1)
  - [x]1.1: Add `description: string` field to `TaskDispatchPayload` in `src/contracts/task.ts`
  - [x]1.2: Add `projectContextPath?: string` field
  - [x]1.3: Add `squadAgentPath?: string` field
  - [x]1.4: Add `modelProfile?: string` field (profile tier name)
  - [x]1.5: Add `budgetRemainingUsd?: number` field (session remaining budget)
  - [x]1.6: Add `commitFormat?: string` field (atomic commit message template)
  - [x]1.7: Update `BuildPayloadParams` in `src/engine/subagent.ts` to accept new fields
  - [x]1.8: Update `buildTaskPayload()` to serialize new fields into payload
  - [x]1.9: Write unit tests verifying new fields in payload construction and serialization

- [x] Task 2: Implement deterministic task ID format (AC: 2)
  - [x]2.1: Create `formatTaskId(phase: string, planIndex: number, taskSequence: number): string` function in `src/engine/subagent.ts` — returns `task-{phase}-{planIndex}-{taskSequence}` with zero-padded numbers
  - [x]2.2: Add `planIndex` and `taskSequence` fields to `WaveTask` interface in `src/engine/wave-executor.ts`
  - [x]2.3: Update `parseWaveTasksFromPlanFile()` to assign sequential `taskSequence` within each plan file
  - [x]2.4: Update `buildSubagentContext()` to use `formatTaskId()` for the dispatch payload's `taskId` (WaveTask keeps its UUID for internal tracking)
  - [x]2.5: Write unit tests for `formatTaskId()` and verify dispatch payloads have deterministic IDs

- [x] Task 3: Enhance buildSubagentContext with structured context (AC: 3)
  - [x]3.1: Expand `buildSubagentContext()` signature to accept optional context: `{ projectContextPath?, squadAgentPath?, modelProfile?, budgetRemainingUsd?, commitFormat? }`
  - [x]3.2: Pass `description` (task title) through to payload
  - [x]3.3: Pass all structured context fields through to `buildTaskPayload()`
  - [x]3.4: Verify payload size remains within 20KB after adding all fields (add size assertion in test)
  - [x]3.5: Write unit tests verifying all context fields appear in serialized payload

- [x] Task 4: Update execute handler to supply full context (AC: 4)
  - [x]4.1: Resolve `projectContextPath` — check if `.buildpact/project-context.md` exists, pass path if found
  - [x]4.2: Resolve `squadAgentPath` — from `activeSquadName`, construct path to active agent definition file
  - [x]4.3: Compute `budgetRemainingUsd` — subtract accumulated `sessionSpendUsd` from `budgetConfig.sessionLimitUsd` (0 if unlimited)
  - [x]4.4: Read `modelProfile` from `readActiveProfileTier()` (already imported in handler context)
  - [x]4.5: Set `commitFormat` from `planSlug` (e.g., `type(planSlug): description`)
  - [x]4.6: Pass all context to `WaveTask` construction and through to `buildSubagentContext()`
  - [x]4.7: Write test verifying execute handler populates WaveTasks with all available context

- [x] Task 5: Validate payload size with expanded fields (AC: 5)
  - [x]5.1: Write test with a realistic payload (all fields populated, typical plan content ~5KB) — verify ≤ 20KB
  - [x]5.2: Write test with a near-limit payload (all fields + large plan content ~18KB) — verify validation behavior
  - [x]5.3: Ensure existing `validatePayloadSize()` works unchanged with expanded payload

## Dev Notes

### Architecture Requirements

**FR-302 Task Dispatch Payload Schema** defines the canonical structure. This story partially implements it — structured context fields are added but large-content fields (constitution content, squad agent content) remain as paths, not inline content. This respects the 20KB payload limit (NFR-02).

**Deterministic task IDs** improve auditability and debugging. The PRD format `task-{phase}-{planIndex}-{taskSequence}` replaces random UUIDs for dispatch payloads while WaveTask retains UUIDs for internal tracking.

### Existing Code to Reuse (DO NOT Reinvent)

| Component | Location | Reuse How |
|-----------|----------|-----------|
| `TaskDispatchPayload` | `src/contracts/task.ts` | Expand with new fields |
| `BuildPayloadParams` | `src/engine/subagent.ts:17-29` | Expand to accept new context fields |
| `buildTaskPayload()` | `src/engine/subagent.ts:36-57` | Update to serialize new fields |
| `validatePayloadSize()` | `src/engine/subagent.ts:71-84` | Unchanged — works on any TaskDispatchPayload |
| `buildSubagentContext()` | `src/engine/wave-executor.ts:78-94` | Expand signature with context params |
| `readActiveProfileTier()` | `src/engine/model-profile-manager.ts` | Already used in execute handler |
| `WaveTask` interface | `src/engine/wave-executor.ts:21-37` | Add planIndex, taskSequence fields |
| `parseWaveTasksFromPlanFile()` | `src/engine/wave-executor.ts:188-217` | Add taskSequence assignment |
| `resolveConstitutionPath()` | `src/engine/constitution-enforcer.ts` | Already used in execute handler |

### Key Implementation Details

**WaveTask expansion:**
```typescript
interface WaveTask {
  // existing fields...
  planIndex?: number       // Index of this plan file within the wave
  taskSequence?: number    // 0-based sequence within the plan file
  projectContextPath?: string
  squadAgentPath?: string
  modelProfile?: string
  budgetRemainingUsd?: number
  commitFormat?: string
}
```

**formatTaskId() function:**
```typescript
function formatTaskId(phase: string, planIndex: number, taskSequence: number): string {
  const pi = String(planIndex).padStart(2, '0')
  const ts = String(taskSequence).padStart(2, '0')
  return `task-${phase}-${pi}-${ts}`
}
```

**Execute handler context resolution:**
- `projectContextPath`: `join(projectDir, '.buildpact', 'project-context.md')` — check existence with `access()`
- `squadAgentPath`: Requires reading `.buildpact/squads/{activeSquadName}/agents/developer.md` or similar — may need to check what agent files exist
- `budgetRemainingUsd`: `budgetConfig.sessionLimitUsd > 0 ? budgetConfig.sessionLimitUsd - sessionSpendUsd : undefined`

### Previous Story Learnings (from 13-1)

- **Injectable I/O pattern** — all external dependencies injected for testability
- **Result type universal** — all fallible operations return `Result<T, CliError>`
- **exactOptionalPropertyTypes** — don't assign `undefined` to optional fields; use conditional inclusion
- **i18n required** — any user-facing strings need EN + PT-BR keys
- **ESM imports** — always `.js` extension
- **Factory + opts() helpers** in tests for DRY test fixtures

### Project Structure Notes

No new files needed — this story expands existing interfaces and functions:
```
src/contracts/task.ts           (modify — add fields to TaskDispatchPayload)
src/engine/subagent.ts          (modify — expand BuildPayloadParams, add formatTaskId)
src/engine/wave-executor.ts     (modify — expand WaveTask, buildSubagentContext, parseWaveTasksFromPlanFile)
src/commands/execute/handler.ts (modify — resolve and pass context to wave tasks)
test/unit/engine/wave-executor.test.ts (modify — tests for new fields)
test/unit/engine/subagent.test.ts      (modify — tests for formatTaskId and expanded payload)
```

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-302] — Task Dispatch Payload Schema
- [Source: docs/prd/buildpact-prd-v2.3.0.md#NFR-02] — 20KB payload size limit
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-702] — Atomic commit format
- [Source: src/contracts/task.ts] — Current TaskDispatchPayload interface
- [Source: src/engine/subagent.ts] — buildTaskPayload, validatePayloadSize
- [Source: src/engine/wave-executor.ts] — buildSubagentContext, WaveTask, parseWaveTasksFromPlanFile
- [Source: src/commands/execute/handler.ts] — Execute command context loading
- [Source: _bmad-output/implementation-artifacts/13-1-subagent-provider-abstraction.md] — Previous story learnings

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

- Expanded `TaskDispatchPayload` with 6 new fields: description, projectContextPath, squadAgentPath, modelProfile, budgetRemainingUsd, commitFormat
- Expanded `BuildPayloadParams` with matching fields plus optional `taskId` override
- Created `formatTaskId()` for deterministic task IDs: `task-{phase}-{planIndex}-{taskSequence}`
- Expanded `WaveTask` interface with planIndex, taskSequence, and all context fields
- Updated `buildSubagentContext()` to pass all structured context + deterministic IDs to dispatch payload
- Updated `parseWaveTasksFromPlanFile()` to assign sequential `taskSequence` and accept `planIndex`
- Updated `buildWaveTaskGroups()` in execute handler to track and pass `planIndex`
- Added `resolveProjectContextPath()` helper in execute handler
- Execute handler now resolves and enriches wave tasks with: projectContextPath, modelProfile, commitFormat, budgetRemainingUsd
- 25 new tests added, all 2088 tests pass — zero regressions

### Change Log

- 2026-03-22: Story 13.2 implemented — structured context in task payloads, deterministic task IDs, execute handler context resolution

### File List

- src/contracts/task.ts (modified) — 6 new fields on TaskDispatchPayload
- src/engine/subagent.ts (modified) — Expanded BuildPayloadParams, updated buildTaskPayload, added formatTaskId()
- src/engine/wave-executor.ts (modified) — Expanded WaveTask, enhanced buildSubagentContext with structured context + deterministic IDs, parseWaveTasksFromPlanFile with taskSequence/planIndex
- src/engine/index.ts (modified) — Export formatTaskId
- src/commands/execute/handler.ts (modified) — resolveProjectContextPath, context enrichment, budgetRemainingUsd per wave, planIndex tracking
- test/unit/engine/subagent.test.ts (modified) — 14 new tests for expanded payload + formatTaskId
- test/unit/engine/wave-executor.test.ts (modified) — 11 new tests for deterministic IDs, context fields, taskSequence
