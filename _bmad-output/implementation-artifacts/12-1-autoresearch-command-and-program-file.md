# Story 12.1: AutoResearch Command & Program File

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an expert developer wanting to optimize a target file autonomously,
I want to run `/bp:optimize <target>` with a `program.md` that defines my optimization goal and constraints,
so that the framework runs experiments automatically within my defined boundaries without me having to supervise each iteration.

## Acceptance Criteria

1. **Given** I run `/bp:optimize src/commands/specify.md` as an expert user, **When** the command executes, **Then** a `program.md` is created at `.buildpact/optimize/<slug>/program.md` containing: optimization goal, constraints, suggested experiment directions, and acceptance criteria — and the command is only available at Expert experience level.

2. **Given** the target file exceeds 600 lines, **When** `/bp:optimize` is invoked, **Then** execution is blocked with a `TARGET_TOO_LARGE` error instructing the user to shard the file first.

3. **Given** I run `/bp:optimize <target> --loop`, **When** the loop executes, **Then** the fixed-budget experiment loop starts, respecting session and experiment time budgets, and integrates with the Budget Guard cost limit.

## Tasks / Subtasks

> **⚠️ CRITICAL CONTEXT — READ BEFORE STARTING:** Story 12.1 was implemented by the Ralph autonomous system as commit `72cf35c` (`feat: [US-052] - Epic 12.1: AutoResearch Command & Program File`). All implementation files already exist. The tasks below are **verification tasks**, not fresh implementation.

- [x] Task 1: Verify AC #1 — optimize command writes program.md with correct content (AC: #1)
  - [x] 1.1 Confirm `src/commands/optimize/handler.ts` exists and exports `handler`, `buildProgramMd`, `readExperienceLevel`, `countFileLines`
  - [x] 1.2 Confirm `buildProgramMd(target, generatedAt)` produces content with: `## Optimization Goal`, `## Constraints`, `## Experiment Directions` (directions 1–3: Readability, Performance, Robustness), `## Acceptance Criteria`, and `## Experiment Log`
  - [x] 1.3 Confirm the handler writes program.md to `.buildpact/optimize/<slug>/program.md` where `<slug>` is derived from `slugify(target)` via `src/foundation/sharding.js`
  - [x] 1.4 Confirm `src/commands/optimize/index.ts` re-exports `handler` and `src/commands/registry.ts` maps `'optimize': () => import('./optimize/index.js')`
  - [x] 1.5 Confirm `templates/commands/optimize.md` exists with ORCHESTRATOR header (`<!-- ORCHESTRATOR: optimize | MAX_LINES: 300 | ... -->`)
  - [x] 1.6 Confirm the expert-only guard returns `EXPERT_ONLY` error when `experience_level` is not `expert`

- [x] Task 2: Verify AC #2 — 600-line shard-first guard (AC: #2)
  - [x] 2.1 Confirm `countFileLines(filePath)` returns the correct line count and returns 0 for missing files
  - [x] 2.2 Confirm `MAX_TARGET_LINES = 600` is the threshold (files with exactly 600 lines are allowed; 601 lines triggers the guard)
  - [x] 2.3 Confirm the handler returns `TARGET_TOO_LARGE` error with `target`, `lines`, and `max` params when the file exceeds limit

- [x] Task 3: Verify AC #3 — --loop flag activates Budget Guard-integrated experiment loop (AC: #3)
  - [x] 3.1 Confirm `--loop` flag in args activates the experiment loop path
  - [x] 3.2 Confirm `parseBudgetFromArgs(args)` and `readBudgetConfig(projectDir)` are called to configure time and cost budgets
  - [x] 3.3 Confirm `isSessionBudgetExhausted` and `isCostLimitReached` are checked each iteration before starting a new experiment
  - [x] 3.4 Confirm the loop uses `startNextExperiment`, `completeExperiment`, `stopSession` from `src/optimize/experiment-loop.ts` — no local reimplementation
  - [x] 3.5 Confirm the Alpha stub stops after one iteration (prevents infinite loop in test/Alpha contexts)

- [x] Task 4: Verify tests pass (AC: #1, #2, #3)
  - [x] 4.1 Run `npx vitest run test/unit/commands/optimize.test.ts` and confirm all tests pass
  - [x] 4.2 Confirm tests cover: `buildProgramMd` content shape, `countFileLines` (found/missing), `readExperienceLevel` (expert/fallback/intermediate), handler EXPERT_ONLY, FILE_READ_FAILED, TARGET_TOO_LARGE, success (program.md written), boundary (exactly 600 lines allowed)

## Dev Notes

### Critical Context — Implementation Already Exists

**All deliverables for this story are already committed.** Commit `72cf35c` (US-052, 2026-03-16) implements the full `/bp:optimize` command including the expert guard, program.md generation, and `--loop` experiment loop.

**Files to verify (all exist):**

| File | Description |
|------|-------------|
| `src/commands/optimize/handler.ts` | Main handler: `readExperienceLevel`, `countFileLines`, `buildProgramMd`, `handler.run` |
| `src/commands/optimize/index.ts` | Re-exports `handler` |
| `templates/commands/optimize.md` | ORCHESTRATOR header + stub content |
| `test/unit/commands/optimize.test.ts` | 9 unit/integration tests |

### Architecture Compliance Checklist

- **Expert-only gate:** `experience_level !== 'expert'` → `EXPERT_ONLY` error. Reads from `.buildpact/config.yaml`. Fallback: `'beginner'` (safe default, blocks access).
- **600-line guard:** `countFileLines(targetPath) > MAX_TARGET_LINES (600)` → `TARGET_TOO_LARGE`. Files at exactly 600 lines are allowed (strictly greater than, not ≥).
- **program.md path:** `.buildpact/optimize/<slug>/program.md` — `slug = slugify(target)` from `src/foundation/sharding.js`. E.g., `src/small.ts` → `src-small-ts`.
- **Result pattern:** All fallible paths return `Result<T, CliError>` (`ok(undefined)` on success, `err(CliError)` on failure) — never throw.
- **Error codes:** `ERROR_CODES.EXPERT_ONLY`, `ERROR_CODES.FILE_READ_FAILED`, `ERROR_CODES.FILE_WRITE_FAILED`, `ERROR_CODES.TARGET_TOO_LARGE` from `src/contracts/errors.ts`.
- **Audit log:** Written via `AuditLogger` (from `src/foundation/audit.ts`) after program.md write and after loop completes. Action keys: `'optimize.program'` and `'optimize.loop'`.
- **Budget Guard integration:** `readBudgetConfig(projectDir)` from `src/engine/budget-guard.ts` — provides `sessionLimitUsd` for cost limit check.
- **Experiment loop modules:** Imported from `src/optimize/experiment-loop.ts` — no logic duplicated in handler.
- **`--loop` flag:** Triggers experiment loop. Without flag: writes program.md and exits with `ok(undefined)`.

### Alpha Stub Behavior

The experiment loop in Alpha is a stub. Each iteration:
1. Records a `no_change` outcome immediately (no real subagent dispatched)
2. Adds `$0.001` stub spend
3. Stops after one iteration via `stopSession(session, 'session_time_exhausted')`

Real implementation (v1.0) will dispatch subagents to run actual experiments.

### Key Technical Patterns

```typescript
// Expert guard pattern
const experienceLevel = await readExperienceLevel(projectDir)
if (experienceLevel !== 'expert') {
  return err({ code: ERROR_CODES.EXPERT_ONLY, i18nKey: 'cli.optimize.expert_only' })
}

// 600-line guard pattern
const lineCount = await countFileLines(targetPath)
if (lineCount > MAX_TARGET_LINES) {
  return err({ code: ERROR_CODES.TARGET_TOO_LARGE, i18nKey: 'cli.optimize.shard_first', params: { target, lines: String(lineCount), max: String(MAX_TARGET_LINES) } })
}

// program.md path
const slug = slugify(target)
const optimizeDir = join(projectDir, '.buildpact', 'optimize', slug)
const programPath = join(optimizeDir, 'program.md')
```

### i18n Keys Used

From `locales/en.yaml`:
- `cli.optimize.welcome` — intro message
- `cli.optimize.expert_only` — expert guard error
- `cli.optimize.expert_only_outro` — outro after expert error
- `cli.optimize.missing_target` — no target error
- `cli.optimize.shard_first` — 600-line guard error (params: `target`, `lines`, `max`)
- `cli.optimize.program_written` — success after program.md written (params: `path`)
- `cli.optimize.loop_no_flag` — hint when `--loop` not provided
- `cli.optimize.loop_start` — loop starting info (params: `exp`, `session`)
- `cli.optimize.loop_session_exhausted` — loop stopped (params: `budget`, `count`)
- `cli.optimize.loop_cost_limit` — cost limit reached (params: `cost`)
- `cli.optimize.loop_stopped` — outro after loop (params: `count`)

### Testing Patterns

The test file mocks `@clack/prompts` and `AuditLogger`:

```typescript
vi.mock('@clack/prompts', () => ({ intro: vi.fn(), outro: vi.fn(), log: { success: vi.fn(), ... } }))
vi.mock('../../../src/foundation/audit.js', () => ({ AuditLogger: class { log = vi.fn() } }))
```

Handler tests `process.chdir(tmpDir)` to simulate project root. The `.buildpact/audit/` directory must exist before running handler tests (created in `beforeEach`).

### Project Structure Notes

- All TypeScript files: kebab-case naming (`handler.ts`, `index.ts`)
- No default exports — named exports only (e.g., `export { handler }` in `index.ts`)
- Imports use `.js` extension for ESM compatibility (e.g., `'../../contracts/errors.js'`)
- `src/commands/optimize/` is a private module — external code imports only from `optimize/index.js`

### Cross-Story Dependencies

| Story | What this story depends on |
|-------|---------------------------|
| 12.0 | ADR-001 accepted (isolation strategy, branch naming, results.tsv policy) |
| 12.2 | `src/optimize/experiment-loop.ts` — `parseBudgetFromArgs`, `createExperimentSession`, `startNextExperiment`, `completeExperiment`, `stopSession`, `addSessionSpend`, `isCostLimitReached`, `formatLoopStatus`, `buildLoopSummary` |
| 12.3 | `src/optimize/ratchet.ts` — NOT directly imported by handler (used by loop in production, bypassed in Alpha stub) |

### References

- Epic 12, Story 12.1: `_bmad-output/planning-artifacts/epics.md` § "Story 12.1: AutoResearch Command & Program File"
- Implementation commit: `72cf35c` (US-052)
- Command registry: `src/commands/registry.ts` — `'optimize': () => import('./optimize/index.js')`
- Architecture — AutoResearch module tree: `architecture.md` lines 969–972
- Architecture — Expert-only pattern: `architecture.md` (experience_level gate)
- Architecture — FR-1201 (AutoResearch command), FR-1202 (program.md), FR-1205 (≤600 line target)
- Architecture — ORCHESTRATOR header requirement: `architecture.md` lines 792–818
- Budget Guard: `src/engine/budget-guard.ts::readBudgetConfig`
- Experiment loop: `src/optimize/experiment-loop.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Story 12.1 was implemented by Ralph autonomous system (commit 72cf35c, 2026-03-16) prior to BMAD sprint tracking
- Dev agent treated this as a verification story, not fresh implementation
- **AC #1 verified:** `handler.ts` exports `handler`, `buildProgramMd`, `readExperienceLevel`, `countFileLines`. `buildProgramMd` produces all required sections. Program.md written to `.buildpact/optimize/<slug>/program.md` via `slugify()`. Registry maps `'optimize'`. ORCHESTRATOR header present in `templates/commands/optimize.md`. Expert-only guard returns `EXPERT_ONLY`.
- **AC #2 verified:** `MAX_TARGET_LINES = 600`. Guard uses strict `>` (600 exactly allowed, 601 blocked). Returns `TARGET_TOO_LARGE` with `target`, `lines`, `max` params. `countFileLines` returns 0 for missing files.
- **AC #3 verified:** `--loop` flag check at line 235. `parseBudgetFromArgs` + `readBudgetConfig` both called. Session exhausted check + cost limit check each iteration. All loop state functions imported from `experiment-loop.ts`. Alpha stub stops after one iteration.
- **Tests:** 15/15 pass in `test/unit/commands/optimize.test.ts` covering all scenarios.

### File List

- `src/commands/optimize/handler.ts` (existing — verify meets all ACs)
- `src/commands/optimize/index.ts` (existing — re-exports handler)
- `templates/commands/optimize.md` (existing — ORCHESTRATOR header verify)
- `test/unit/commands/optimize.test.ts` (existing — 9 tests verify)
