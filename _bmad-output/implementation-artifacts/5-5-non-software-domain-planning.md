# Story 5.5: Non-Software Domain Planning

Status: done

## Story

As a domain expert using BuildPact for non-software work,
I want `/bp:plan` to distinguish between tasks I must do manually and tasks the AI agent can execute automatically,
So that my plan is actionable across both human and AI steps without confusion about who does what.

## Acceptance Criteria

1. **Task Tagging by Executor**
   - Given the active Squad is a non-software domain Squad (e.g., Medical Marketing, Scientific Research)
   - When `/bp:plan` generates a plan
   - Then each task is clearly tagged as either `[HUMAN]` (requires manual action) or `[AGENT]` (automatically executable)
   - And human steps include a checklist format for manual completion tracking
   - And agent steps include the standard automated execution format

2. **Pause on Human Steps**
   - Given a plan with mixed human and agent steps is executed
   - When an agent step completes and the next step is human
   - Then the system pauses and prompts the user to complete the human step before proceeding
   - And progress is persisted so the session can resume if interrupted

3. **Non-Software Domain Detection**
   - Given the active Squad is loaded from `.buildpact/squads/{{active_squad}}/squad.yaml`
   - When `/bp:plan` starts
   - Then it reads the `domain_type` field from `squad.yaml`
   - And if `domain_type !== 'software'`, human/agent tagging is enabled automatically

4. **Human Step Checklist Format**
   - Given a task is tagged `[HUMAN]`
   - When the plan file is written
   - Then the task includes a markdown checklist block with 3–4 actionable sub-items

5. **Progress Persistence**
   - Given a session with mixed human/agent steps is interrupted
   - When the user restarts and runs `/bp:plan` or `/bp:execute`
   - Then the framework reads `.buildpact/plans/{{spec_slug}}/progress.json`
   - And resumes from the last completed step rather than restarting

6. **Non-Software Section in plan.md**
   - Given Stories 5.1–5.4 established plan.md sections
   - When Story 5.5 adds the non-software section
   - Then `templates/commands/plan.md` includes `## Non-Software Domain Planning` section
   - And plan.md total remains ≤300 lines

## Tasks / Subtasks

- [x] Task 1: Add `domain_type` to SquadManifest contract (AC: #3)
  - [x] 1.1: In `src/contracts/squad.ts`, add `export type DomainType = 'software' | 'medical' | 'research' | 'management' | 'custom'`
  - [x] 1.2: Add `domain_type?: DomainType` to `SquadManifest` interface (optional — backward compat)
  - [x] 1.3: Add `domain_type: software` to `templates/squads/software/squad.yaml`
  - [x] 1.4: Add appropriate `domain_type` to other squad templates (medical-marketing, scientific-research, clinic-management, agent-builder)

- [x] Task 2: Add domain_type validation to `src/squads/validator.ts` (AC: #3)
  - [x] 2.1: Add `VALID_DOMAIN_TYPES` constant with allowed values
  - [x] 2.2: Add validation check: if `domain_type` is present but not in allowed list → `ValidationIssue`
  - [x] 2.3: Verify existing validator tests still pass

- [x] Task 3: Create `src/commands/plan/tagger.ts` — extract + extend tagging logic (AC: #1, #4)
  - [x] 3.1: Move `HUMAN_KEYWORDS` array and `classifyTask()` from `handler.ts` to `tagger.ts`; re-export from handler for backward compat
  - [x] 3.2: Export `tagTasks(tasks: PlanTask[], domainType: string): TaggedTask[]` — if `domainType === 'software'` → all tasks tagged AGENT; otherwise use `classifyTask()` per task
  - [x] 3.3: Export `buildHumanChecklist(task: PlanTask): string[]` — generate 3–4 actionable checklist items from task title (generic templates: verify/review/confirm/sign off)
  - [x] 3.4: Export `TaggedTask` interface extending `PlanTask` with `executor: ExecutionType` and `checklistItems?: string[]`

- [x] Task 4: Create `src/commands/plan/progress.ts` — extract + extend progress logic (AC: #2, #5)
  - [x] 4.1: Move `PlanProgress`, `TaskProgressEntry` types from `handler.ts` to `progress.ts`; re-export from handler
  - [x] 4.2: Export `loadProgress(planDir: string): Promise<PlanProgress | null>` — reads `progress.json` from plan dir; returns null if not found (not an error)
  - [x] 4.3: Export `saveProgress(planDir: string, progress: PlanProgress): Promise<void>` — writes `progress.json`
  - [x] 4.4: Export `isHumanStepPending(progress: PlanProgress, taskId: string): boolean` — true if task not in completedSteps

- [x] Task 5: Add domain detection + resume to `handler.run()` (AC: #3, #5)
  - [x] 5.1: After config loading, read active squad's `domain_type` via `readActiveSquad()` → load `squad.yaml` → read `domain_type` field (default to `'software'` if absent)
  - [x] 5.2: If `domain_type !== 'software'`, log `cli.plan.non_software.domain_detected` message
  - [x] 5.3: At plan start, call `loadProgress(planDir)` — if progress exists and user confirms resume, skip completed steps in human pause loop
  - [x] 5.4: Update human pause flow to use `clack.select` with `done`/`save_and_exit` options instead of `clack.confirm`
  - [x] 5.5: If user selects `save_and_exit`, save progress and return `ok(undefined)` — session can be resumed later
  - [x] 5.6: Audit log: `plan.human_step.required` and `plan.human_step.completed` events

- [x] Task 6: Add i18n keys (AC: #2, #3)
  - [x] 6.1: Add to `locales/en.yaml`: `cli.plan.human_step.done`, `cli.plan.human_step.save_and_exit`, `cli.plan.non_software.domain_detected`, `cli.plan.resume_prompt`, `cli.plan.resume_yes`, `cli.plan.resume_no`
  - [x] 6.2: Add same keys to `locales/pt-br.yaml`

- [x] Task 7: Add `## Non-Software Domain Planning` section to plan.md (AC: #6)
  - [x] 7.1: Add section after Nyquist Validation documenting: domain detection via `squad.yaml`, `[HUMAN]`/`[AGENT]` tagging, human step checklist format, pause behavior, progress persistence, resume flow
  - [x] 7.2: Verify plan.md total ≤300 lines (currently 129 — budget of ~170 lines)

- [x] Task 8: Write unit tests (AC: #1, #3, #4, #5)
  - [x] 8.1: Create `test/unit/commands/plan-tagger.test.ts` — `tagTasks` with medical domain → HUMAN keywords tagged; software domain → all AGENT; `buildHumanChecklist` returns 3–4 items
  - [x] 8.2: Create `test/unit/commands/plan-progress.test.ts` — `saveProgress` → `loadProgress` roundtrip; `loadProgress` on missing file → null; `isHumanStepPending` checks
  - [x] 8.3: Update existing `plan.test.ts` — verify `classifyTask` still works via re-export from tagger.ts

- [x] Task 9: Write integration test (AC: #1, #2, #3, #5)
  - [x] 9.1: Create `test/integration/pipeline/plan-non-software.test.ts`
  - [x] 9.2: Test: medical domain → `buildPlanContent(..., 'medical')` contains `[HUMAN]` and `[AGENT]` prefixes
  - [x] 9.3: Test: software domain → `buildPlanContent(..., 'software')` contains no `[HUMAN]` tags
  - [x] 9.4: Test: `saveProgress` → `loadProgress` → `isHumanStepPending` correctly tracks completion

- [x] Task 10: Run full test suite (AC: all)
  - [x] 10.1: `npx vitest run` — all existing 1692 tests pass (no regressions from squad.yaml schema change)
  - [x] 10.2: New tests pass
  - [x] 10.3: Verify plan.md ≤300 lines

## Dev Notes

### What ALREADY EXISTS (DO NOT REBUILD)

| Asset | Location | Status |
|-------|----------|--------|
| `classifyTask(title): ExecutionType` | `handler.ts:329` | ✅ Complete — 23 HUMAN_KEYWORDS |
| `ExecutionType = 'HUMAN' \| 'AGENT'` | `handler.ts:80` | ✅ Complete |
| `TaskProgressEntry` interface | `handler.ts:85` | ✅ Complete — `{ taskId, title, executionType, completed, completedAt? }` |
| `PlanProgress` interface | `handler.ts:96` | ✅ Complete — `{ slug, generatedAt, tasks }` |
| `buildProgressContent(slug, tasks, generatedAt)` | `handler.ts:341` | ✅ Complete — builds PlanProgress with classifyTask per task |
| `[HUMAN]/[AGENT]` tags in plan output | `handler.ts:362,496` | ✅ Complete — both overview and per-wave files |
| Human pause loop with clack.confirm | `handler.ts:909-929` | ✅ Complete — iterates humanTasks, updates progress |
| progress.json write | `handler.ts:932-934` | ✅ Complete — `.buildpact/plans/{{slug}}/progress.json` |
| `readActiveSquad()` | `handler.ts:591` | ✅ Complete — reads active_squad from config.yaml |
| `parseWaveTasksFromPlanFile()` regex handles [HUMAN] | `wave-executor.ts:194` | ✅ Complete |
| i18n: `cli.plan.human_pause`, `human_confirm`, `human_skipped`, `progress_saved` | `locales/en.yaml + pt-br.yaml` | ✅ Complete |
| Unit tests for classifyTask (6), buildProgressContent (3), human flow (4) | `plan.test.ts` | ✅ Complete |

### What DOES NOT EXIST (must implement)

| Gap | Required by |
|-----|-------------|
| `domain_type` on `SquadManifest` | AC #3 — no way to detect non-software domains |
| `domain_type` in squad YAML templates | AC #3 — templates missing the field |
| `src/squads/validator.ts` domain_type validation | AC #3 — invalid values not caught |
| `src/commands/plan/tagger.ts` as extracted module | AC #1 — `tagTasks()` with domain-aware logic not yet separated |
| `src/commands/plan/progress.ts` as extracted module | AC #5 — `loadProgress()` and resume flow not yet separated |
| Domain detection in handler.run() | AC #3 — handler doesn't load squad manifest to check domain_type |
| Resume flow (loadProgress → skip completed) | AC #5 — handler writes progress but doesn't load/resume |
| Richer pause options (done vs save_and_exit) | AC #2 — currently uses `clack.confirm`, not `clack.select` with options |
| `## Non-Software Domain Planning` in plan.md | AC #6 — template section missing |
| i18n: `human_step.done`, `human_step.save_and_exit`, `non_software.domain_detected`, `resume_*` | AC #2, #3, #5 |
| Dedicated tagger + progress test files | Coverage gap |

### Critical Patterns from Previous Stories (MUST FOLLOW)

1. **ESM `.js` extension** on ALL imports
2. **`Result<T, CliError>`** for all fallible functions — NEVER `throw`
3. **Named exports only** — NO `export default`
4. **All user strings via `I18nResolver.t()`** — no hardcoded text
5. **`@clack/prompts` in commands layer ONLY** — engine returns data
6. **Optional fields for backward compat** — `domain_type?` must not break existing squads
7. **`isCancel()` after every `clack.select`/`clack.confirm`** — handle Ctrl+C

### Extraction Strategy

The key implementation challenge is **extracting** existing inline logic from `handler.ts` into separate modules without breaking the 13 existing tests that cover classifyTask, buildProgressContent, and the human step flow.

**Approach: re-export pattern**
```typescript
// src/commands/plan/tagger.ts — new module with the logic
export function classifyTask(title: string): ExecutionType { ... }
export function tagTasks(tasks: PlanTask[], domainType: string): TaggedTask[] { ... }

// src/commands/plan/handler.ts — keep re-export for backward compat
export { classifyTask } from './tagger.js'
```

This preserves all existing imports and test expectations.

### Progress Path

Current code writes to `.buildpact/plans/{{slug}}/progress.json` (handler.ts:932). The original story spec said `.buildpact/snapshots/{{specSlug}}/progress.json`. **Keep the current path** — plans/ is the correct location since progress tracks plan execution state, not generated snapshots.

### NFR Compliance

| NFR | Compliance |
|-----|------------|
| NFR-02 | plan.md ≤300 lines after addition (~159 lines estimated) |
| NFR-08 | progress.json stored as JSON in file system |
| NFR-23 | Audit: `plan.human_step.required`, `plan.human_step.completed`, `plan.resume` events |

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-505] — Non-Software Domain Planning
- [Source: _bmad-output/planning-artifacts/epics.md#Epic5-Story5.5] — User story, AC
- [Source: _bmad-output/planning-artifacts/architecture.md#Squad-Architecture] — SquadManifest, domain detection
- [Source: _bmad-output/planning-artifacts/architecture.md#File-System-State-Architecture] — snapshots/, plans/ read-write
- [Source: src/commands/plan/handler.ts:329-341,909-934] — Existing classifyTask, progress, human pause
- [Source: src/contracts/squad.ts] — SquadManifest interface (needs domain_type)
- [Source: src/engine/wave-executor.ts:194] — [HUMAN] tag parsing regex
- [Source: _bmad-output/implementation-artifacts/5-4-nyquist-multi-perspective-plan-validation.md] — Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- `PlanProgress` and `TaskProgressEntry` extraction from handler.ts caused duplicate interface error — resolved by removing inline definitions and importing from progress.ts with re-exports for backward compat.
- Existing tests used `clack.confirm` for human step flow but implementation changed to `clack.select` with done/save_and_exit options — updated test mocks accordingly.
- Task 2 (squad validator) skipped: `src/squads/validator.ts` does not exist yet (Epic 8). Domain_type validation deferred.
- Task 2 resumed (2026-03-19): `src/squads/validator.ts` now exists (implemented in Epic 8). Added `VALID_DOMAIN_TYPES` export and domain_type validation. 4 new tests added; all 1764 tests pass.

### Completion Notes List

- Added `DomainType` union type and optional `domain_type` field to `SquadManifest` in `src/contracts/squad.ts` (backward-compatible)
- Added `domain_type` to all 5 squad YAML templates (software, medical-marketing, scientific-research, clinic-management, agent-builder)
- Created `src/commands/plan/tagger.ts` — extracted `classifyTask()` + `HUMAN_KEYWORDS` from handler.ts; added `tagTasks(tasks, domainType)` with software-domain bypass and `buildHumanChecklist(task)`
- Created `src/commands/plan/progress.ts` — extracted `PlanProgress`, `TaskProgressEntry` types; added `loadProgress()`, `saveProgress()`, `isHumanStepPending()` for session resume
- Added domain detection to `handler.run()`: reads `domain_type` from `squad.yaml`, logs non-software detection
- Added resume flow: `loadProgress()` on plan start, offers resume (via `clack.select`), skips completed human steps
- Upgraded human pause from `clack.confirm` to `clack.select` with done/save_and_exit options (AC #2)
- Upgraded resume prompt from `clack.confirm` to `clack.select` with resume_yes/resume_no i18n keys (code-review fix)
- Fixed `buildPlanContent()` and `buildWaveFileContent()` to use `tagTasks(domainType)` instead of `classifyTask()` directly — software domain now always produces [AGENT] tags (code-review fix for AC #3)
- Fixed `humanTasks` filter in `handler.run()` to use `tagTasks(domainType)` so software domain never pauses for human steps
- Added `## Non-Software Domain Planning` section to `templates/commands/plan.md` (188 lines total, within 300 limit)
- Added 6 i18n keys to both locales: human_done, human_save_exit, non_software_detected, resume_prompt, resume_yes, resume_no
- Created 15 unit tests in plan-tagger.test.ts and 7 unit tests in plan-progress.test.ts
- Updated 2 existing human step tests in plan.test.ts (confirm → select)
- Created integration test plan-non-software.test.ts (5 tests: domain tagging, software bypass, checklist, progress roundtrip, pending check)
- NOTE: Task 2 (squad validator domain_type validation) deferred — `src/squads/validator.ts` does not exist yet (Epic 8 scope). Task unchecked.
- All existing tests pass (no regressions from domain-type + tagger integration)

### File List

| File | Action | Notes |
|------|--------|-------|
| `src/contracts/squad.ts` | Modified | Added DomainType union + domain_type? field to SquadManifest |
| `src/contracts/index.ts` | Modified | Added DomainType to barrel exports |
| `src/commands/plan/tagger.ts` | Created | classifyTask, tagTasks, buildHumanChecklist, TaggedTask |
| `src/commands/plan/progress.ts` | Created | loadProgress, saveProgress, isHumanStepPending, PlanProgress, TaskProgressEntry |
| `src/commands/plan/handler.ts` | Modified | Extracted types to tagger/progress; domain-aware buildPlanContent/buildWaveFileContent; select-based resume; domain-filtered humanTasks |
| `templates/squads/software/squad.yaml` | Modified | Added domain_type: software |
| `templates/squads/medical-marketing/squad.yaml` | Modified | Added domain_type: medical |
| `templates/squads/scientific-research/squad.yaml` | Modified | Added domain_type: research |
| `templates/squads/clinic-management/squad.yaml` | Modified | Added domain_type: management |
| `templates/squads/agent-builder/squad.yaml` | Modified | Added domain_type: software |
| `templates/commands/plan.md` | Modified | Added Non-Software Domain Planning section (188 lines) |
| `locales/en.yaml` | Modified | 5 new keys: human_done, human_save_exit, non_software_detected, resume_prompt |
| `locales/pt-br.yaml` | Modified | Same 5 keys in PT-BR |
| `test/unit/commands/plan-tagger.test.ts` | Created | 15 unit tests for tagger |
| `test/unit/commands/plan-progress.test.ts` | Created | 7 unit tests for progress |
| `test/unit/commands/plan.test.ts` | Modified | Updated 2 human step tests (confirm → select) |
| `test/integration/pipeline/plan-non-software.test.ts` | Created | 5 integration tests: domain tagging, software bypass, checklist, progress roundtrip, pending check |
| `src/squads/validator.ts` | Modified | Added VALID_DOMAIN_TYPES constant and domain_type validation in validateSquad() |
| `test/unit/squads/validator.test.ts` | Modified | Added 4 tests (2.1–2.4) covering VALID_DOMAIN_TYPES export, invalid/valid/absent domain_type |

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Story 5.5 implemented — DomainType contract, tagger/progress modules, domain detection, resume flow, select-based human pause, plan.md section, 20 new tests. 1717 tests passing. | claude-opus-4-6 |
| 2026-03-18 | Code review fixes — buildPlanContent/buildWaveFileContent now use tagTasks(domainType) (AC #3 fix); resume confirm upgraded to clack.select with resume_yes/resume_no i18n keys; integration test plan-non-software.test.ts created (5 tests); Task 2 unchecked (validator.ts not yet in scope). 1723 tests passing. | claude-sonnet-4-6 |
| 2026-03-19 | Task 2 complete — added VALID_DOMAIN_TYPES export and domain_type validation to validator.ts; 4 new tests (2.1–2.4). 1764 tests passing. | claude-sonnet-4-6 |
