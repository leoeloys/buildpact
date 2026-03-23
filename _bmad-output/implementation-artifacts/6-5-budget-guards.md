# Story 6.5: Budget Guards

Status: done

## Story

As a developer or tech lead managing AI spend,
I want to configure hard spending limits at session, phase, and day levels,
so that runaway executions are automatically paused before exceeding my budget — never silently.

## Acceptance Criteria

**AC-1: Three-Level Budget Configuration and Enforcement**

Given I configure budget limits in `.buildpact/config.yaml` (`per_session_usd`, `per_phase_usd`, `per_day_usd`)
When any pipeline execution reaches a configured limit
Then the framework pauses execution immediately and notifies the user with a clear cost summary: spend to date, limit hit, and remaining budget at other levels
And phase limit is checked before session, and session before daily (most specific first)
And a limit of 0 means unlimited for that dimension

**AC-2: User Options on Budget Pause**

Given execution is paused due to a budget limit
When I review my options
Then the framework offers: (1) increase the limit and resume, (2) continue with a cheaper model profile, (3) stop and preserve all results to date
And no further AI calls are made until I make a choice

**AC-3: Budget Guards Section in execute.md Orchestrator**

Given the execute.md stub from Stories 6.1/6.2/6.3/6.4
When Story 6.5 adds the Budget Guards section
Then `templates/commands/execute.md` includes `## Budget Guards` section documenting: 3-level config format, enforcement order, cost summary display, user options on pause, and daily spend persistence
And execute.md total remains ≤300 lines

## Tasks / Subtasks

- [x] Task 1: Add `## Budget Guards` section to `templates/commands/execute.md` (AC: #1, #2, #3)
  - [x] 1.1: Add `## Budget Guards` section after `## Wave Verification` (added by Story 6.4)
  - [x] 1.2: Document 3-level config format: `budget:` block in `.buildpact/config.yaml` with `per_session_usd`, `per_phase_usd`, `per_day_usd`, `warning_threshold`
  - [x] 1.3: Document enforcement order: phase → session → daily (most specific first); 0 = unlimited
  - [x] 1.4: Document cost summary display via `formatCostSummary()`: shows spend vs. limit for all 3 dimensions; ∞ when unlimited
  - [x] 1.5: Document user options on pause: (1) `writeBudgetLimit()` to increase limit, (2) switch model profile, (3) stop and preserve
  - [x] 1.6: Document daily spend persistence: `updateDailySpend()` writes to `.buildpact/budget-usage.json`; resets each calendar day
  - [x] 1.7: Document Alpha stub: `STUB_COST_PER_TASK_USD = 0.001` — tasks accrue $0.001 each in Alpha (no real token counting)
  - [x] 1.8: Verify cumulative execute.md line count ≤300 after adding this section

- [x] Task 2: Verify `src/engine/budget-guard.ts` meets AC #1 and #2 (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `checkBudget(input: BudgetCheckInput): Result<BudgetGuardResult>` — phase checked first, then session, then daily; limit 0 = unlimited; returns `ok({ allowed: false, limitType, ... })` when blocked
  - [x] 2.2: Confirm `readBudgetConfig(projectDir): Promise<BudgetConfig>` — reads `budget:` block from `.buildpact/config.yaml`; returns defaults (all 0) if absent or malformed
  - [x] 2.3: Confirm `writeBudgetLimit(projectDir, limitType, newLimitUsd): Promise<void>` — updates `per_session_usd` / `per_phase_usd` / `per_day_usd` in-place without corrupting rest of config
  - [x] 2.4: Confirm `readDailySpend(projectDir): Promise<number>` — reads `budget-usage.json`; returns 0 if file absent or date is not today
  - [x] 2.5: Confirm `updateDailySpend(projectDir, additionalSpendUsd): Promise<void>` — accumulates on top of existing today value; creates `.buildpact/` dir if needed; silently ignores write errors
  - [x] 2.6: Confirm `formatCostSummary(input): string` — 3-line output: Session / Phase / Daily with spend/limit; uses ∞ for 0-limit dimensions
  - [x] 2.7: Confirm `STUB_COST_PER_TASK_USD = 0.001` — positive number, used as Alpha task cost
  - [x] 2.8: Confirm `today(): string` — returns ISO date `YYYY-MM-DD`; used for daily spend date matching
  - [x] 2.9: Confirm `BudgetGuardResult.allowed === true` when all limits are 0 (unlimited config)
  - [x] 2.10: Confirm phase limit takes precedence over session when both exceeded

- [x] Task 3: Verify `src/contracts/budget.ts` meets AC (DO NOT recreate — read-only check)
  - [x] 3.1: Confirm `BudgetConfig`: `sessionLimitUsd`, `phaseLimitUsd`, `dailyLimitUsd`, `warningThreshold` (all numbers)
  - [x] 3.2: Confirm `BudgetCheckInput`: `config: BudgetConfig`, `sessionSpendUsd`, `phaseSpendUsd`, `dailySpendUsd`
  - [x] 3.3: Confirm `BudgetGuardResult`: `allowed: boolean`, `currentSpendUsd`, `limitUsd`, `limitType?: 'session' | 'phase' | 'daily'`, `message?: string`

- [x] Task 4: Verify `test/unit/engine/budget-guard.test.ts` covers AC (DO NOT recreate — read-only check)
  - [x] 4.1: `STUB_COST_PER_TASK_USD` — positive number
  - [x] 4.2: `today()` — returns ISO date string
  - [x] 4.3: `checkBudget` — all unlimited, below limits, phase blocked, phase exceeds, session blocked (phase unlimited), daily blocked (both unlimited), phase precedence over session, message when blocked, limitUsd=0 when unlimited
  - [x] 4.4: `formatCostSummary` — all 3 dimensions present, ∞ for unlimited, formatted limit values
  - [x] 4.5: `readBudgetConfig` — defaults when missing, parses budget block, defaults when no budget section, warning_threshold parsed
  - [x] 4.6: `readDailySpend` — 0 when missing, 0 for different day, returns spend for today
  - [x] 4.7: `updateDailySpend` — creates file, accumulates successive calls
  - [x] 4.8: `writeBudgetLimit` — no-op when config missing, updates session/phase/daily in-place without corrupting other keys

- [x] Task 5: Run full test suite and verify no regressions (AC: all)
  - [x] 5.1: `npx vitest run` — all tests pass
  - [x] 5.2: Verify execute.md ≤300 lines

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/engine/budget-guard.ts` | ✅ Complete | 217 LOC — 6 functions + 1 exported constant + async I/O |
| `src/contracts/budget.ts` | ✅ Complete | 38 LOC — 3 interfaces: BudgetConfig, BudgetCheckInput, BudgetGuardResult |
| `test/unit/engine/budget-guard.test.ts` | ✅ Complete | 343 LOC — comprehensive coverage across 8 describe blocks |
| `src/engine/index.ts` | ✅ Exported | All 6 functions + constant (lines 29–37) |

**The PRIMARY task is Task 1: add `## Budget Guards` section to `templates/commands/execute.md`.**

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```
`src/engine/budget-guard.ts` imports from `src/contracts/budget.js`, `src/contracts/errors.js`, `node:fs/promises`, and `node:path` only.

**FR-705 maps to:** `src/engine/budget-guard.ts` + `src/contracts/budget.ts` + `templates/commands/execute.md`

**Key exports in `src/engine/budget-guard.ts`:**
```typescript
export const STUB_COST_PER_TASK_USD = 0.001   // Alpha: per-task cost stub

export const today = (): string               // Returns YYYY-MM-DD (daily spend key)

// Config reader/writer
export async function readBudgetConfig(projectDir: string): Promise<BudgetConfig>
export async function writeBudgetLimit(projectDir: string, limitType: 'session' | 'phase' | 'daily', newLimitUsd: number): Promise<void>

// Daily spend persistence
export async function readDailySpend(projectDir: string): Promise<number>
export async function updateDailySpend(projectDir: string, additionalSpendUsd: number): Promise<void>

// Pure check function
export function checkBudget(input: BudgetCheckInput): Result<BudgetGuardResult>

// Cost summary formatter
export function formatCostSummary(input: BudgetCheckInput): string
```

**Budget Config Format (`.buildpact/config.yaml`):**
```yaml
budget:
  per_session_usd: 2.00     # 0 = unlimited
  per_phase_usd: 0.50       # 0 = unlimited
  per_day_usd: 10.00        # 0 = unlimited
  warning_threshold: 0.80   # warn at 80% of limit (optional, default 0.8)
```

**Budget Enforcement Order (most specific first):**
```
1. Phase limit  (most granular — single pipeline phase)
2. Session limit (current process invocation)
3. Daily limit  (rolling calendar day via budget-usage.json)
```

**Daily Spend Persistence:**
```json
// .buildpact/budget-usage.json
{ "date": "2026-03-19", "spendUsd": 1.234 }
```
- `readDailySpend()` returns 0 if file absent or date ≠ today (automatic daily reset)
- `updateDailySpend()` accumulates additively; silently ignores write errors (budget tracking MUST NOT block execution)
- `.buildpact/` directory is created recursively if it doesn't exist

**Alpha Stub Behavior:**
- Real token counting is NOT implemented in Alpha
- Each dispatched task accrues `STUB_COST_PER_TASK_USD = $0.001`
- Budget checks use this stub cost for phase/session spend tracking
- `writeBudgetLimit()` allows increasing limits without manual file editing (for the "increase and resume" user option)

**`checkBudget()` Return Values:**
```typescript
// Allowed
ok({ allowed: true, currentSpendUsd: 0.1, limitUsd: 2.0 })

// Blocked by phase limit
ok({ allowed: false, currentSpendUsd: 0.5, limitUsd: 0.5, limitType: 'phase',
     message: 'Phase budget of $0.50 reached (spent: $0.5000)' })

// Unlimited (all limits = 0)
ok({ allowed: true, currentSpendUsd: 0.1, limitUsd: 0 })
```

**Integration with Wave Executor (NOT wired in Alpha):**
Current state: `checkBudget()` is not called by `executeWaves()` in Alpha. Budget enforcement is documented in `execute.md` for Prompt Mode. Wiring into the TypeScript executor is out of scope for Story 6.5.

### execute.md Budget Guards Section Template

Add this section to `templates/commands/execute.md` after `## Wave Verification` (Story 6.4's section):

```markdown
## Budget Guards

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

Limits are checked most-specific-first before each task dispatch:

1. **Phase** — spend in current pipeline phase
2. **Session** — spend since process start
3. **Daily** — cumulative today spend (persisted to `.buildpact/budget-usage.json`)

A limit of 0 means unlimited for that dimension.

### Cost Summary

When a limit is hit, execution pauses and shows:

```
Session: $0.4923 / $2.00
Phase:   $0.5000 / $0.50    ← LIMIT REACHED
Daily:   $1.2340 / $10.00
```

### User Options on Pause

1. Increase the limit and resume — `writeBudgetLimit()` updates config in-place
2. Continue with a cheaper model profile — switch profile in config and resume
3. Stop and preserve — all successful results to date are retained in Git

### Alpha Stub

In Alpha, each task accrues $0.001 (STUB_COST_PER_TASK_USD) — no real token
counting. Budget guards enforce the configured limits against this stub spend.

Implementation: `checkBudget()`, `readBudgetConfig()`, `formatCostSummary()`,
`writeBudgetLimit()`, `updateDailySpend()` in `src/engine/budget-guard.ts`.
Types: `BudgetConfig`, `BudgetCheckInput`, `BudgetGuardResult` in `src/contracts/budget.ts`.
```

### execute.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base | Header + intro + Impl Notes | ~18 | ~18 |
| 6.1 | Wave Execution | ~45 | ~63 |
| 6.2 | Atomic Commits | ~30 | ~93 |
| 6.3 | Crash Recovery | ~25 | ~118 |
| 6.4 | Wave Verification | ~35 | ~153 |
| **6.5** | **Budget Guards** | **~45** | **~198** |

Target: ≤300 lines with all 5 stories. Budget ample (~102 lines remaining).

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `budget-guard.ts`, `budget.ts`, or their test files — they are pre-built and complete
- ❌ Do NOT add a `BUDGET_EXCEEDED` error code — budget blocking is signaled by `BudgetGuardResult.allowed === false`, not by error codes
- ❌ Do NOT wire budget checks into `wave-executor.ts` or `handler.ts` — that's production integration, out of scope for Alpha
- ❌ Do NOT import from `src/commands/` in `src/engine/` — layer dependency violation
- ❌ Do NOT use `export default` — named exports only in `src/engine/`
- ❌ Do NOT throw on budget tracking write errors — `updateDailySpend()` silently ignores them; budget failure MUST NOT block execution
- ❌ Do NOT parse config.yaml with a YAML library — the current implementation uses line-by-line parsing; do NOT change it

### Previous Story Intelligence (Story 6.4)

- **Pre-built pattern:** Same as this story — implementation existed before story tracking; primary task is the execute.md documentation section
- **ESM imports:** `.js` extension MANDATORY: `import { checkBudget } from './budget-guard.js'`
- **Result<T> pattern:** `checkBudget()` returns `Result<BudgetGuardResult>` using `ok(value)` — NOT `err()` for budget exceeded (budget exceeded is a normal flow, not an error)
- **Pure vs async separation:** `checkBudget()` and `formatCostSummary()` are pure sync; all file I/O (`readBudgetConfig`, `readDailySpend`, `updateDailySpend`, `writeBudgetLimit`) is async
- **Layer confirmed:** `budget-guard.ts` imports from `contracts/` only (plus Node.js built-ins) — never from `foundation/`, `commands/`, or `cli/`

### Coverage Expectations

- `src/engine/budget-guard.ts` (pure functions: `checkBudget`, `formatCostSummary`, `today`): 85%+ line coverage
- Async I/O functions (`readBudgetConfig`, `readDailySpend`, `updateDailySpend`, `writeBudgetLimit`): tested with real temp directories (no mocking)
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit testing |
| `node:fs/promises` | built-in | `readFile`, `writeFile`, `mkdir` for budget persistence |
| `node:path` | built-in | `join` for path construction |
| `node:os` / `node:fs/promises` | built-in | `mkdtemp`, `rm` for temp dirs in tests |

### Project Structure Notes

`budget-guard.ts` is in `src/engine/` per architecture spec. It imports from `src/contracts/budget.js` and `src/contracts/errors.js` only (plus Node.js built-ins). Already registered in `src/engine/index.ts` barrel (lines 29–37). Do NOT modify `src/cli/index.ts`, `src/commands/registry.ts`, or the contracts layer.

Daily spend state persisted at `.buildpact/budget-usage.json` (project-level, gitignored by convention). Config limits stored in `.buildpact/config.yaml` (user-managed, project-level).

### References

- [Source: epics.md#Epic6-Story6.5] — User story, AC
- [Source: architecture.md#FR-705] — Budget Guards: `src/engine/budget-guard.ts`
- [Source: architecture.md#coverage-thresholds] — Global 70%, engine module thresholds
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/`
- [Source: architecture.md#cross-cutting-concerns] — Budget Guards: all execution phases + AutoResearch
- [Source: src/engine/budget-guard.ts] — Full implementation: 6 functions + 1 constant
- [Source: src/contracts/budget.ts] — BudgetConfig, BudgetCheckInput, BudgetGuardResult
- [Source: test/unit/engine/budget-guard.test.ts] — 8 describe blocks, comprehensive coverage
- [Source: src/engine/index.ts:29-37] — Budget guard barrel exports
- [Source: templates/commands/execute.md] — Current state (target for Wave Verification section addition)
- [Source: 6-4-goal-backward-wave-verification.md] — execute.md line budget, Wave Verification section (predecessor)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Added `## Budget Guards` section to `templates/commands/execute.md` after `## Wave Verification`. Section documents: 3-level config format (per_session_usd, per_phase_usd, per_day_usd, warning_threshold), enforcement order (phase → session → daily, most specific first), cost summary display with ∞ for unlimited dims, user options on pause (increase limit, switch profile, stop+preserve), daily spend persistence via budget-usage.json, and Alpha stub ($0.001/task). File: 215 lines (≤300 budget).
- Task 2: Read-only verification of `src/engine/budget-guard.ts` (217 LOC) — all 6 functions + STUB_COST_PER_TASK_USD confirmed correct. Phase-first enforcement order verified. `ok({ allowed: false })` for budget exceeded confirmed (not error codes). updateDailySpend silently ignores write errors confirmed.
- Task 3: Read-only verification of `src/contracts/budget.ts` (38 LOC) — BudgetConfig, BudgetCheckInput, BudgetGuardResult shapes all confirmed with correct field types.
- Task 4: Read-only verification of `test/unit/engine/budget-guard.test.ts` (343 LOC, 8 describe blocks) — all 8 subtask coverage areas confirmed, including real temp directory I/O tests (no mocking).
- Task 5: `npx vitest run` — 1723 tests passed, 68 files, zero regressions. execute.md = 215 lines ≤ 300.

### File List

templates/commands/execute.md

## Change Log

- 2026-03-19: Added `## Budget Guards` section to `templates/commands/execute.md` documenting budget enforcement (FR-705). Verified pre-built `src/engine/budget-guard.ts`, `src/contracts/budget.ts`, and `test/unit/engine/budget-guard.test.ts`. All 1723 tests pass. Story → review.
