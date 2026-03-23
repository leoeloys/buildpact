<!-- ORCHESTRATOR: execute | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 2.0.0 -->
<!-- STATE: {{spec_slug}}, {{process_id}}, {{timestamp}}, {{current_wave}}, {{git_head}} -->
# /bp:execute — Execution Pipeline

This orchestrator guides the user through the execution pipeline:
1. Execution Lock — prevent concurrent sessions on the same plan
2. Context Pre-Injection — build and validate subagent payload per task
3. Wave-parallel execution with subagent isolation (FR-701)
4. Atomic git commits per completed task (FR-702)
5. Crash recovery with automatic retry (FR-703)
6. Goal-backward wave verification (FR-704)
7. Budget guards during execution (FR-705)

Follow each step below in exact order. Do not skip steps.

---

## STEP 0: Execution Lock

Before dispatching any task, acquire execution lock:
1. Check for `.buildpact/plans/{{spec_slug}}/.execution-lock` file
2. If lock exists and age < 30min → halt with:
   `"Another session is executing this plan. Remove .execution-lock to force."`
3. If lock exists and age >= 30min → assume stale, remove and continue
4. Write lock file:
   `{ pid: {{process_id}}, started: {{timestamp}}, spec: {{spec_slug}} }`
5. Capture current `git HEAD` as `{{git_head}}` (last known good commit for rollback)
6. Release lock after final wave completes or on any exit path (success, failure, or cancel)

→ NEXT: STEP 1 (Context Pre-Injection)

---

## STEP 1: Context Pre-Injection

Before dispatching each subagent, build the injection package:

```
INJECTION PACKAGE for task {{task_id}}:
---
## Project Constitution
{{constitution_content}}
---
## Project Context
{{project_context_content}}
---
## Research Summary
{{research_summary_content}}
---
## Task Plan
{{task_plan_content}}
---
## ADRs Relevant to This Task
{{relevant_adrs}}
---
```

Validate total size ≤ 20KB before dispatch.
If > 20KB: truncate in this order — `research_summary` first, then `project_context`.
Never truncate `task_plan` or `constitution`.

Load sources from:
- Constitution: `.buildpact/constitution.md`
- Project context: `.buildpact/project-context.md`
- Research summary: `.buildpact/snapshots/{{spec_slug}}/research-summary.md`
- Task plan: `.buildpact/plans/{{spec_slug}}/plan-wave-{N}.md`
- Relevant ADRs: `.buildpact/plans/{{spec_slug}}/adrs/` — include only ADRs whose title
  keywords overlap with the current task title

→ NEXT: STEP 2 (Wave Execution)

---

## STEP 2: Wave Execution

The execution pipeline runs plan tasks in wave-parallel fashion — tasks within
the same wave are dispatched simultaneously to isolated subagents (FR-701).

### Subagent Isolation Protocol

Each task is dispatched to a **clean subagent** that receives the injection package
assembled in STEP 1. Subagents **do NOT** inherit orchestrator context, prior wave
results, or state from sibling tasks.

Context assembled by `buildSubagentContext()` in `src/engine/wave-executor.ts`.
Payload validated ≤20KB before dispatch.

### Parallel Dispatch Protocol

All tasks in a wave are dispatched simultaneously; the wave completes only
when all its tasks finish (pass or fail):
- Alpha: `executeTaskStub()` simulates concurrent Task() calls synchronously
- Production: each call replaced by a real `Task()` dispatch
- Payload oversizing (>20KB) causes immediate task failure without dispatch

### Sequential Wave Ordering

Waves execute one at a time — next wave begins only after current wave succeeds:
- `executeWaves(waves, haltOnFailure=true)` loops over wave groups in order
- On any wave failure (any task `success=false`), execution halts before next wave

### Plan File Format

Wave plan files read from: `.buildpact/plans/{{spec_slug}}/plan-wave-{N}.md`
Tasks parsed from lines matching: `- [ ] [AGENT] Title` or `- [ ] [HUMAN] Title`
Dependency annotations `_(after: T2)_` stripped from titles automatically.

→ NEXT: STEP 3 (Atomic Commits)

---

## STEP 3: Atomic Commits

Each task that completes successfully produces exactly one Git commit (FR-702).

### Commit Message Format

```
type(phaseSlug): taskTitle
```

Commit type inferred from task title keywords via `inferCommitType()`:
- `fix` ← fix, resolve, correct, repair, revert, bug, hotfix
- `docs` ← doc, docs, document, readme
- `test` ← test, spec, coverage
- `refactor` ← refactor, rename, move, extract, clean
- `chore` ← chore, bump, upgrade, update
- `style` ← style, format, prettier
- `feat` ← default (all others)

`runAtomicCommit(taskTitle, phaseSlug, projectDir)` → `src/engine/atomic-commit.ts`
**Alpha stubs:** `commitMessage` field populated for auditability; no real git commit executed.

→ NEXT: STEP 4 (Crash Recovery)

---

## STEP 4: Crash Recovery

If a task fails during execution, the recovery system (FR-703) applies up to 3
automatic strategies before escalating to the user.

### Strategy Progression

1. **Retry** — Re-run the same task with the same approach
2. **Simplify** — Re-run with reduced complexity or scope
3. **Skip** — Skip the failing task and continue with the next

If the same error repeats across consecutive attempts (stuck loop), advance to next strategy.
If all 3 strategies fail: rollback to `{{git_head}}` via `git reset --hard`.

Implementation: `createRecoverySession()`, `handleTaskFailure()`, `executeRollback()`
in `src/engine/recovery.ts`.

→ NEXT: STEP 5 (Wave Verification)

---

## STEP 5: Wave Verification

After each wave completes, goal-backward verification (FR-704) checks wave output
against relevant spec acceptance criteria before the next wave begins.

### AC-to-Wave Mapping

Acceptance criteria mapped to a wave by keyword overlap: an AC is relevant to
a wave if any of its significant words (>4 chars) appear in any task title.

Implementation: `mapAcsToWave(specContent, taskTitles)` in `src/engine/wave-verifier.ts`

### Pass/Fail Gating

A 100% pass rate is required before the next wave begins:
- An AC **passes** if at least one task covering it succeeded
- An AC **fails** if all tasks covering it failed
- ACs with no matching tasks are excluded from the gate
- If `allPassed === false`, execution blocks and a fix plan is generated

### Fix Plan Generation

When ACs fail, a targeted fix plan is generated:
- Fix tasks format: `- [ ] [AGENT] Fix: {ac text (truncated to 80 chars)}`
- Fix plan written to: `.buildpact/plans/{{spec_slug}}/fix/plan-wave-1.md`
- Fix plan is executable via `/bp:execute` without re-running the full pipeline

Verification reports written to: `.buildpact/plans/{{spec_slug}}/verification-wave-{N}.md`

→ NEXT: STEP 6 (Budget Guards)

---

## STEP 6: Budget Guards

Budget guards (FR-705) enforce 3-level spending limits — session, phase, and day —
pausing execution before any limit is exceeded.

### Configuration

Add a `budget:` block to `.buildpact/config.yaml`:

```yaml
budget:
  per_session_usd: 2.00    # 0 = unlimited
  per_phase_usd: 0.50      # 0 = unlimited
  per_day_usd: 10.00       # 0 = unlimited
  warning_threshold: 0.80  # warn at 80% of limit (optional)
```

### Enforcement Order

Limits checked most-specific-first before each task dispatch:
1. **Phase** — spend in current pipeline phase
2. **Session** — spend since process start
3. **Daily** — cumulative today spend (persisted to `.buildpact/budget-usage.json`)

### User Options on Pause

1. Increase the limit and resume — `writeBudgetLimit()` updates config in-place
2. Continue with a cheaper model profile — switch profile in config and resume
3. Stop and preserve — all successful results to date are retained in Git

**Alpha stub:** each task accrues $0.001 (STUB_COST_PER_TASK_USD).

Implementation: `checkBudget()`, `readBudgetConfig()`, `formatCostSummary()`,
`writeBudgetLimit()`, `updateDailySpend()` in `src/engine/budget-guard.ts`.

---

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Entry point: `src/commands/execute/handler.ts` (orchestrates plan discovery → wave dispatch)
- Plan input: `.buildpact/plans/{{spec_slug}}/plan-wave-{N}.md`
- Execution lock: `.buildpact/plans/{{spec_slug}}/.execution-lock`
- Verification reports: `.buildpact/plans/{{spec_slug}}/verification-wave-{N}.md`
- Fix plans: `.buildpact/plans/{{spec_slug}}/fix/plan-wave-1.md`
- ADR injection: `.buildpact/plans/{{spec_slug}}/adrs/` — keyword-matched per task
- Constitution validation: enforced per wave output before continuing
- Triggers: `on_execute_start`, `on_execute_complete` hooks if Squad active
