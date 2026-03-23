# Story 8.4: Squad Structural Validation

Status: done

## Story

As a Squad creator preparing to deploy a Squad,
I want `/bp:squad validate` to run a comprehensive structural and security check,
So that I can catch all issues before my Squad is used in production sessions.

## Acceptance Criteria

**AC-1: `/bp:squad validate` Runs Comprehensive Structural Checks with PASS/FAIL Report**

Given I run `/bp:squad validate <squad-name>`
When validation executes
Then it checks: structural completeness (all 6 layers for all agents), Voice DNA 5-section compliance, heuristic coverage (≥3 IF/THEN + VETO), example quality (minimum 3 per agent), and handoff graph validity
And a detailed report is generated listing all PASS/FAIL checks with specific references (agent filename + missing element)

**AC-2: Community Squads Are Security-Checked and Blocked on Failure**

Given the Squad is from the community hub (untrusted source)
When validation runs
Then security checks are also enforced: no external URLs, no executable code in YAML/Markdown, no filesystem paths outside `.buildpact/`, no prompt injection patterns
And the Squad is blocked from activation until all security checks pass

## Tasks / Subtasks

- [x] Task 1: Create `src/squads/validator.ts` — pure aggregate validation module (AC: #1, #2)
  - [x] 1.1: Define exported types: `SquadCheckResult`, `SquadValidationReport`, `ValidateSquadOptions`
  - [x] 1.2: Implement `validateSquad(squadDir, opts?)` composing structural + handoff + security checks
  - [x] 1.3: Create `src/squads/index.ts` with JSDoc `@module squads`, `@see FR-905`, named exports only

- [x] Task 2: Add `## Squad Validation` section to `templates/commands/squad.md` (AC: #1, #2)
  - [x] 2.1: Insert after `## Voice DNA Creation` and before `## Implementation Notes`
  - [x] 2.2: Include 6-check validation table + `--community` flag explanation + implementation reference
  - [x] 2.3: Verify squad.md line count ≤ 300

- [x] Task 3: Verify `src/commands/squad/handler.ts` — read-only check (AC: #1, #2)
  - [x] 3.1: Confirm `runValidate()` runs structural, handoff graph, and security (community) checks
  - [x] 3.2: Confirm `--community` flag triggers security check and blocks Squad on failure
  - [x] 3.3: Update handler to import from `src/squads/validator.ts` if it reduces duplication without breaking tests

- [x] Task 4: Create `test/unit/squads/validator.test.ts` — unit tests for `validateSquad()` (AC: #1, #2)
  - [x] 4.1: `validateSquad()` returns `passed: true` and no errors for a valid squad
  - [x] 4.2: `validateSquad()` returns structured errors with agent filename for structural failures
  - [x] 4.3: `community: true` — security check included in report (`security` field is not null)
  - [x] 4.4: `community: false` (default) — `security` field is null
  - [x] 4.5: `passed` is `false` and `totalErrors > 0` when any check has errors
  - [x] 4.6: `validateSquad()` is pure — no filesystem side effects (no files written outside squad)

- [x] Task 5: Run full test suite and verify no regressions (AC: all)
  - [x] 5.1: `npx vitest run` — all tests pass, 0 failures
  - [x] 5.2: Verify squad.md line count ≤ 300

## Dev Notes

### ⚠️ PRE-BUILT FOUNDATION — VERIFY BEFORE WRITING

`src/commands/squad/handler.ts` (`runValidate()`, 140 LOC) was completed before formal story tracking as part of stories 8.1/8.2. **The primary deliverables for story 8.4 are `src/squads/validator.ts` and the `## Squad Validation` section in squad.md.**

**Current known state (as of story 8.3 completion, 2026-03-19):**

| File | Expected Status | Notes |
|------|----------------|-------|
| `src/commands/squad/handler.ts` | ✅ Complete | `runValidate()` fully implemented — AC-1 and AC-2 already satisfied |
| `src/squads/validator.ts` | ❌ Does NOT exist | Must be created — `src/squads/` directory does not exist yet |
| `src/squads/index.ts` | ❌ Does NOT exist | Must be created alongside validator.ts |
| `templates/commands/squad.md` | ⚠️ Needs update | Add `## Squad Validation` section (currently 109 lines) |
| `test/unit/commands/squad.test.ts` | ✅ Complete | `runValidate` describe block exists (5 tests) |
| `test/unit/squads/validator.test.ts` | ❌ Does NOT exist | Must be created for `src/squads/validator.ts` |

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```
`squads/validator.ts` lives in `src/squads/` — it CAN import from `src/engine/` and `src/contracts/`. Do NOT import from `src/commands/` inside `src/squads/`.

**FR mapping:**
- `FR-905` → Squad validation — structural and security compliance
- `FR-1103` → Squad trust model — security checks before activation
- `FR-902` → 6-layer agent anatomy (all layers must pass)

**Coverage threshold (MUST maintain):**
| Module | Threshold |
|--------|-----------|
| `src/squads/validator.ts` | **90%** (architecture explicit requirement) |
| `src/contracts/**` | 100% |
| global | 70% |

### `src/squads/validator.ts` — Complete Design Specification

This is a **pure, side-effect-free** module. No clack prompts, no audit logging, no file writes. Input: squad directory path. Output: typed `Result<SquadValidationReport>`.

**Types to define:**
```typescript
export interface SquadCheckResult {
  name: string        // 'structural' | 'handoffs' | 'security'
  passed: boolean
  errors: string[]    // same format as engine functions (e.g., "agents/x.md: ...")
}

export interface SquadValidationReport {
  squadDir: string
  structural: SquadCheckResult
  handoffs: SquadCheckResult
  security: SquadCheckResult | null  // null when community = false
  totalErrors: number
  passed: boolean
}

export interface ValidateSquadOptions {
  community?: boolean  // enforce security checks — default: false
}
```

**`validateSquad()` implementation pattern:**
```typescript
export async function validateSquad(
  squadDir: string,
  opts: ValidateSquadOptions = {}
): Promise<Result<SquadValidationReport>> {
  const { community = false } = opts

  const structResult = await validateSquadStructure(squadDir)
  if (!structResult.ok) return structResult  // propagate fs errors

  const handoffResult = await validateHandoffGraph(squadDir)
  if (!handoffResult.ok) return handoffResult

  let security: SquadCheckResult | null = null
  if (community) {
    const secResult = await validateSquadSecurity(squadDir)
    if (!secResult.ok) return secResult
    security = { name: 'security', passed: secResult.value.errors.length === 0, errors: secResult.value.errors }
  }

  const structural = { name: 'structural', passed: structResult.value.errors.length === 0, errors: structResult.value.errors }
  const handoffs = { name: 'handoffs', passed: handoffResult.value.errors.length === 0, errors: handoffResult.value.errors }
  const totalErrors = structural.errors.length + handoffs.errors.length + (security?.errors.length ?? 0)

  return ok({ squadDir, structural, handoffs, security, totalErrors, passed: totalErrors === 0 })
}
```

**Imports for `validator.ts`:**
```typescript
import { validateSquadStructure, validateSquadSecurity, validateHandoffGraph } from '../engine/squad-scaffolder.js'
import { ok } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
```

### `src/squads/index.ts` — JSDoc Standard

Must follow the JSDoc minimum standard from architecture:
```typescript
/**
 * Squads — Squad loading, validation, routing, and plugin hooks.
 * @module squads
 * @see FR-905 Squad validation — structural and security compliance
 * @see FR-901 Squad routing by domain
 */
export { validateSquad } from './validator.js'
export type { SquadCheckResult, SquadValidationReport, ValidateSquadOptions } from './validator.js'
```

### squad.md Section to Add

Insert between `## Voice DNA Creation` (ends at line 102) and `## Implementation Notes` (line 104):

```markdown
## Squad Validation

Run `npx buildpact squad validate <path> [--community]` to check a Squad before deploying.

### Checks Performed

| Check | What it validates |
|-------|------------------|
| Structural | squad.yaml required fields + all 6 layers for every agent |
| Voice DNA | 5 subsections present; Anti-Patterns ≥ 5 ✘/✔ pairs |
| Heuristics | ≥ 3 IF/THEN rules + at least one `VETO:` condition per agent |
| Examples | ≥ 3 concrete input/output pairs per agent |
| Handoffs | At least one `- ←` or `- →` entry per agent |
| Security¹ | No external URLs, no executable code, no `../` paths, no prompt injection |

¹ Security runs automatically on `squad add` (community source). Use `--community` flag to enforce it manually.

Output: detailed PASS/FAIL report per check with agent filename and specific violation.
Implementation: `validateSquad()` in `src/squads/validator.ts` (FR-905, FR-1103).
```

### squad.md Line Budget

| Story | Section Added | Lines | Cumulative |
|-------|---------------|-------|-----------|
| Base  | Header + Implementation Notes | ~6 | ~6 |
| 8.1   | Squad Create + Squad Installation | ~60 | ~66 |
| 8.2   | 6-Layer Agent Definition | ~23 | ~89 |
| 8.3   | Voice DNA Creation | ~20 | ~109 |
| **8.4** | **Squad Validation** | **~22** | **~131** |
| 8.5   | Agent Autonomy Leveling | ~20 | ~151 |

Target: ≤ 300 lines total. Budget: ~149 remaining after 8.4.

### Anti-Patterns to Avoid

- ❌ Do NOT add audit logging inside `src/squads/validator.ts` — pure module, no side effects
- ❌ Do NOT import from `src/commands/` inside `src/squads/` — layer violation
- ❌ Do NOT use `export default` anywhere in `src/` — named exports only
- ❌ Do NOT add `.js` extension omission on ESM imports — always required
- ❌ Do NOT modify `src/commands/squad/handler.ts` unless Task 3.3 confirms a clean refactor path
- ❌ Do NOT create `src/squads/router.ts`, `loader.ts`, or `hook-runner.ts` — those are Story 8.5/8.6 territory
- ❌ Do NOT add new i18n keys — all squad validation keys already registered in `locales/en.yaml` (lines 262–311)

### Previous Story Intelligence (Story 8.3)

- **Pre-built pattern:** handler.ts was pre-built before formal story tracking. Primary deliverable is always the new module (`squads/validator.ts`) + orchestrator section in squad.md.
- **1725 tests passing** at end of story 8.3 across 68 files — all must remain green
- **ESM imports:** `.js` extension MANDATORY on all internal imports (e.g., `import { foo } from './bar.js'`)
- **Result<T> pattern:** `ok(...)` on success, `err({ code, i18nKey, params })` on failure — never `throw` in business logic
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching the filesystem
- **Vitest mocking for @clack/prompts and AuditLogger** is already set up in `test/unit/commands/squad.test.ts` — the new `test/unit/squads/validator.test.ts` does NOT need these mocks (validator is pure, no clack/audit)
- **squad.md was at 109 lines** after story 8.3 (target ≤ 300)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | readFile, readdir for validation |
| `node:path` | built-in | join, basename for agent filename in errors |
| `@clack/prompts` | latest | Only in handler.ts — never in squads/ or engine/ |

### Validation Error Format (Existing — Do NOT Change)

Already implemented and tested in stories 8.1/8.2. Error format is locked:
```
agents/specialist.md: missing layer "Handoffs"
agents/chief.md: Voice DNA missing section "Opinion Stance"
agents/agent.md: Anti-Patterns requires minimum 5 prohibited/required pairs (found 3)
agents/reviewer.md: Handoffs section has no valid entries — add at least one "- ←" or "- →" entry
```

### Project Structure Context

- `src/squads/` directory does NOT exist — this story creates it
- `src/squads/validator.ts` is the primary pure validation module
- `src/squads/index.ts` is the barrel export (JSDoc required)
- `test/unit/squads/` directory must also be created (mirrors `src/squads/`)
- The validation engine functions (`validateSquadStructure`, `validateSquadSecurity`, `validateHandoffGraph`) already live in `src/engine/squad-scaffolder.ts` — `squads/validator.ts` composes them, does NOT duplicate them

### Handler Already Satisfies ACs — Verification Guide

In `src/commands/squad/handler.ts`, `runValidate()` (line 306):
- Runs `validateSquadStructure()` → PASS/FAIL structural check with per-error output (lines 340–356)
- Runs `validateHandoffGraph()` → PASS/FAIL handoff check with per-error warnings (lines 358–376)
- Runs `validateSquadSecurity()` only when `--community` flag passed (lines 378–397)
- Blocks community Squad with `SQUAD_VALIDATION_FAILED` if security errors exist (lines 413–428)
- Reports total error count and exits with error code on any failure (lines 430–442)

### References

- [Source: epics.md#Epic8-Story8.4] — User story, ACs
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-905] — Squad validation structural and security compliance
- [Source: architecture.md#FR-1103] — Squad trust model
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← squads/ ← commands/`
- [Source: architecture.md#src-squads] — `squads/validator.ts — Pure validation — 90%+ coverage (FR-905, FR-1103)`
- [Source: src/engine/squad-scaffolder.ts] — validateSquadStructure, validateSquadSecurity, validateHandoffGraph
- [Source: src/commands/squad/handler.ts#runValidate] — complete AC implementation (lines 306–443)
- [Source: test/unit/commands/squad.test.ts#runValidate] — existing handler tests (5 tests)
- [Source: locales/en.yaml#cli.squad] — squad i18n keys (lines 262–311) — no new keys needed
- [Source: story 8-3-voice-dna-creation-with-5-section-template.md] — squad.md budget tracking, 1725 passing tests baseline

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/squads/validator.ts` — pure `validateSquad()` composing structural/handoff/security engine checks. No side effects, no clack, no audit logging.
- Created `src/squads/index.ts` — barrel export with JSDoc @module squads, @see FR-905.
- Added `## Squad Validation` section to `templates/commands/squad.md` (129 lines total, ≤ 300 budget).
- Verified `src/commands/squad/handler.ts` `runValidate()` (lines 306–443) fully satisfies AC-1 and AC-2 — no changes needed.
- Created `test/unit/squads/validator.test.ts` — 6 unit tests covering all 4.1–4.6 scenarios.
- Full test suite: 1731 tests, 0 failures (baseline was 1725, +6 new tests).

### File List

- src/squads/validator.ts (created)
- src/squads/index.ts (created)
- templates/commands/squad.md (modified — added ## Squad Validation section)
- test/unit/squads/validator.test.ts (created)
