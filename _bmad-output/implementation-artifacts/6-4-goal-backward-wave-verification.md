# Story 6.4: Goal-Backward Wave Verification

Status: done

## Story

As a developer who wants quality gates between waves,
I want the framework to verify each wave's output against the relevant spec acceptance criteria before proceeding to the next wave,
so that errors are caught early rather than compounding across multiple waves.

## Acceptance Criteria

**AC-1: Pass/Fail Report per Wave**

Given a wave completes execution
When goal-backward verification runs
Then a pass/fail report is generated for each spec acceptance criterion whose keywords overlap with the completed wave's task titles — relevance is determined by keyword matching via `mapAcsToWave()`
And a 100% pass rate (all relevant ACs pass) is required before the next wave begins

**AC-2: Failure Blocks Progression and Generates Fix Plan**

Given one or more acceptance criteria fail wave verification
When the failure is reported
Then progression to the next wave is blocked
And a targeted fix plan is automatically generated for the failed criteria via `buildWaveFixPlan()`
And the fix plan can be executed via `/bp:execute` without re-running the full pipeline

**AC-3: Wave Verification Section in execute.md Orchestrator**

Given the execute.md stub from Stories 6.1/6.2/6.3
When Story 6.4 adds the Wave Verification section
Then `templates/commands/execute.md` includes `## Wave Verification` section documenting: AC-to-wave mapping algorithm, pass/fail gating protocol, fix plan generation, and report file locations
And execute.md total remains ≤300 lines

## Tasks / Subtasks

- [x] Task 1: Add `## Wave Verification` section to `templates/commands/execute.md` (AC: #1, #2, #3)
  - [x] 1.1: Add `## Wave Verification` section after `## Crash Recovery` (added by Story 6.3)
  - [x] 1.2: Document AC-to-wave mapping: keyword overlap between AC text and task titles via `mapAcsToWave()`
  - [x] 1.3: Document pass/fail gating: 100% pass rate required before next wave; `allPassed` field in `WaveVerificationReport`
  - [x] 1.4: Document fix plan generation: `buildWaveFixPlan()` outputs a wave plan file at `.buildpact/plans/{{spec_slug}}/fix/plan-wave-1.md`
  - [x] 1.5: Document report output path: `.buildpact/plans/{{spec_slug}}/verification-wave-{N}.md` (already referenced in Implementation Notes)
  - [x] 1.6: Document `verifyWaveAcs()` and `formatWaveVerificationReport()` as the two-step verification flow
  - [x] 1.7: Verify cumulative execute.md line count ≤300 after adding this section

- [x] Task 2: Verify `src/engine/wave-verifier.ts` meets AC #1 and #2 (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `mapAcsToWave(specContent, taskTitles): string[]` — extracts ACs from spec's `## Acceptance Criteria` section, filters by keyword overlap (keywords >4 chars) with task titles
  - [x] 2.2: Confirm `verifyWaveAcs(specContent, waveResult): WaveVerificationReport` — maps ACs to wave, marks AC passed if ≥1 covering task succeeded
  - [x] 2.3: Confirm `formatWaveVerificationReport(report): string` — produces markdown with heading `## Wave N Goal-Backward Verification`, pass/fail counts, ✓/✗ per AC, failed task names
  - [x] 2.4: Confirm `buildWaveFixPlan(failedAcs, waveNumber, phaseSlug): string` — produces wave plan file with `[AGENT] Fix: {ac}` tasks (truncated to 80 chars) and Key References section
  - [x] 2.5: Confirm `WaveVerificationReport` shape: `{ waveNumber, acResults, allPassed, passCount, failCount }`
  - [x] 2.6: Confirm `AcVerificationResult` shape: `{ ac, passed, coveringTasks }`
  - [x] 2.7: Confirm no ACs mapped → `allPassed: true` (empty wave = no gates to fail)
  - [x] 2.8: Confirm AC passes if ≥1 covering task succeeded even if sibling tasks covering same AC failed

- [x] Task 3: Verify `test/unit/engine/wave-verifier.test.ts` covers AC (DO NOT recreate — read-only check)
  - [x] 3.1: `mapAcsToWave` — keyword overlap found, no overlap, no AC section, empty titles, multiple ACs mapped
  - [x] 3.2: `verifyWaveAcs` — all pass, AC fails, no ACs mapped → allPassed, wave number preserved, partial coverage (≥1 success), covering tasks tracked
  - [x] 3.3: `formatWaveVerificationReport` — wave number in heading, pass/fail counts, ✓/✗ icons, "No acceptance criteria" message
  - [x] 3.4: `buildWaveFixPlan` — AGENT tasks per failed AC, phase slug + wave number in heading, 80-char truncation, Key References section, valid header

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass
  - [x] 4.2: Verify execute.md ≤300 lines

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/engine/wave-verifier.ts` | ✅ Complete | 158 LOC — 4 pure functions + 2 type definitions |
| `test/unit/engine/wave-verifier.test.ts` | ✅ Complete | 233 LOC — 19+ test cases across 4 describe blocks |
| `src/engine/index.ts` | ✅ Exported | `mapAcsToWave`, `verifyWaveAcs`, `formatWaveVerificationReport`, `buildWaveFixPlan` (lines 16–20) |

**The PRIMARY task is Task 1: add `## Wave Verification` section to `templates/commands/execute.md`.**

### ⚠️ DEPENDENCY ON STORIES 6.1, 6.2, AND 6.3

Story 6.1 adds `## Wave Execution`, Story 6.2 adds `## Atomic Commits`, and Story 6.3 adds `## Crash Recovery` to `templates/commands/execute.md` BEFORE this story's `## Wave Verification` section is appended.

**Expected execute.md state when Story 6.4 starts dev:**
- Story 6.1 added `## Wave Execution` (~45 lines → ~65 total)
- Story 6.2 added `## Atomic Commits` (~30 lines → ~95 total)
- Story 6.3 added `## Crash Recovery` (~25 lines → ~120 total)
- Story 6.4 adds `## Wave Verification` (~35 lines → ~155 total)

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```
`src/engine/wave-verifier.ts` imports from `src/engine/plan-validator.js` (for `extractSpecAcs`) and `src/engine/wave-executor.js` (for `WaveExecutionResult` type) only.

**FR-704 maps to:** `src/engine/wave-verifier.ts` + `templates/commands/execute.md`

**Key exports in `src/engine/wave-verifier.ts`:**
```typescript
export interface AcVerificationResult {
  ac: string           // AC text (lowercased)
  passed: boolean
  coveringTasks: string[]  // task titles that share keywords with this AC
}

export interface WaveVerificationReport {
  waveNumber: number
  acResults: AcVerificationResult[]
  allPassed: boolean
  passCount: number
  failCount: number
}

// Pure functions (all testable, no side effects)
export function mapAcsToWave(specContent: string, taskTitles: string[]): string[]
export function verifyWaveAcs(specContent: string, waveResult: WaveExecutionResult): WaveVerificationReport
export function formatWaveVerificationReport(report: WaveVerificationReport): string
export function buildWaveFixPlan(failedAcs: string[], waveNumber: number, phaseSlug: string): string
```

**AC-to-Wave Mapping Algorithm:**
```
1. extractSpecAcs(specContent) → pulls bullet items under "## Acceptance Criteria"
2. For each AC: extract keywords (words >4 chars, lowercased)
3. Build union of all task title keywords
4. AC is relevant if any of its keywords appears in the task keyword union
5. relevantAcs = filtered ACs passed to verifyWaveAcs()
```

**Verification Flow:**
```
After wave N completes:
  report = verifyWaveAcs(specContent, waveResult)
  if (!report.allPassed):
    failedAcs = report.acResults.filter(r => !r.passed).map(r => r.ac)
    fixPlan = buildWaveFixPlan(failedAcs, waveResult.waveNumber, phaseSlug)
    write fixPlan to: .buildpact/plans/{specSlug}/fix/plan-wave-1.md
    BLOCK next wave
  else:
    write formatWaveVerificationReport(report) to: .buildpact/plans/{specSlug}/verification-wave-{N}.md
    PROCEED to next wave
```

**Integration with Wave Executor (NOT wired in Alpha):**
Current state: `executeWaves()` in `wave-executor.ts` returns errors on failure but does NOT call `verifyWaveAcs()`. Verification is documented in `execute.md` for Prompt Mode. Wiring into the TypeScript executor is out of scope for Story 6.4.

### execute.md Wave Verification Section Template

Add this section to `templates/commands/execute.md` after `## Crash Recovery` (Story 6.3's section):

```markdown
## Wave Verification

After each wave completes, goal-backward verification (FR-704) checks wave output
against relevant spec acceptance criteria before the next wave begins.

### AC-to-Wave Mapping

Acceptance criteria are mapped to a wave by keyword overlap: an AC is relevant to
a wave if any of its significant words (>4 chars) appear in any task title in that wave.

Implementation: `mapAcsToWave(specContent, taskTitles)` in `src/engine/wave-verifier.ts`

### Pass/Fail Gating

A 100% pass rate is required before the next wave begins:

- An AC **passes** if at least one task covering it succeeded
- An AC **fails** if all tasks covering it failed
- ACs with no matching tasks are excluded from the gate
- If `allPassed === false`, execution blocks and a fix plan is generated

Implementation: `verifyWaveAcs(specContent, waveResult)` → `WaveVerificationReport`

### Fix Plan Generation

When ACs fail, a targeted fix plan is generated for the failed criteria only:

- Fix tasks follow format: `- [ ] [AGENT] Fix: {ac text (truncated to 80 chars)}`
- Fix plan written to: `.buildpact/plans/{{spec_slug}}/fix/plan-wave-1.md`
- Fix plan is executable via `/bp:execute` without re-running the full pipeline

Implementation: `buildWaveFixPlan(failedAcs, waveNumber, phaseSlug)` → markdown string

### Report Output

Verification reports written to: `.buildpact/plans/{{spec_slug}}/verification-wave-{N}.md`
Format: `formatWaveVerificationReport(report)` — ✓/✗ per AC, pass/fail counts
```

### execute.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base | Header + intro + Impl Notes | ~18 | ~18 |
| 6.1 | Wave Execution | ~45 | ~63 |
| 6.2 | Atomic Commits | ~30 | ~93 |
| 6.3 | Crash Recovery | ~25 | ~118 |
| **6.4** | **Wave Verification** | **~35** | **~153** |
| 6.5 | Budget Guards | ~35 | ~188 |

Target: ≤300 lines with all 5 stories. Budget ample (~147 lines remaining after all stories).

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `wave-verifier.ts` or its test file — they are pre-built and complete
- ❌ Do NOT wire `verifyWaveAcs()` into `wave-executor.ts` — Prompt Mode documents the flow; TypeScript wiring is out of scope for Alpha
- ❌ Do NOT import from `src/commands/` in `src/engine/` — layer dependency violation
- ❌ Do NOT use `export default` — named exports only in `src/engine/`
- ❌ Do NOT add new dependencies — `wave-verifier.ts` only imports from `plan-validator.js` and `wave-executor.js` within the engine layer
- ❌ Do NOT change the keyword threshold (>4 chars) — this is a deliberate design decision tested by the test suite

### Previous Story Intelligence (Story 6.3)

- **Pre-built pattern:** Same as this story — implementation existed before story tracking; primary task is the execute.md documentation section
- **ESM imports:** `.js` extension MANDATORY in all imports
- **Anti-pattern confirmed:** Do NOT add `WAVE_VERIFICATION_FAILED` error code — verification gating is signaled by `WaveVerificationReport.allPassed === false`, not by error codes
- **Layer check:** `wave-verifier.ts` imports from within `engine/` only — never from `commands/` or `cli/`
- **Test isolation:** All 4 functions in `wave-verifier.ts` are pure (no side effects) — no mocking needed in tests

### Coverage Expectations

- `src/engine/wave-verifier.ts` (all pure functions): 85%+ line coverage across all 4 functions
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit testing |
| `extractSpecAcs` | internal | From `src/engine/plan-validator.ts` — extracts bullet items under `## Acceptance Criteria` |

### Project Structure Notes

`wave-verifier.ts` is in `src/engine/` per architecture spec. It imports from `src/engine/plan-validator.js` (`extractSpecAcs`) and `src/engine/wave-executor.js` (`WaveExecutionResult` type) only. Already registered in `src/engine/index.ts` barrel (lines 16–20). Do NOT modify `src/cli/index.ts` or `src/commands/registry.ts`.

Verification report files are written to `.buildpact/plans/{specSlug}/verification-wave-{N}.md` (path already declared in `execute.md` Implementation Notes — Story 6.4 does not need to add it there again).

### References

- [Source: epics.md#Epic6-Story6.4] — User story, AC
- [Source: architecture.md#FR-704] — Goal-Backward Wave Verification: `src/engine/wave-verifier.ts`
- [Source: architecture.md#coverage-thresholds] — Global 70%, engine module thresholds
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/`
- [Source: src/engine/wave-verifier.ts] — Full implementation: 4 exported functions, 2 types
- [Source: test/unit/engine/wave-verifier.test.ts] — 19+ test cases, 4 describe blocks
- [Source: src/engine/index.ts:16-20] — Wave verifier barrel exports
- [Source: src/engine/plan-validator.ts] — `extractSpecAcs()` used by `mapAcsToWave()`
- [Source: src/engine/wave-executor.ts] — `WaveExecutionResult` type
- [Source: templates/commands/execute.md] — Current state (Impl Notes already references verification-wave-{N}.md paths)
- [Source: 6-3-crash-recovery-with-automatic-retry.md] — execute.md line budget, Crash Recovery section (predecessor)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Added `## Wave Verification` section to `templates/commands/execute.md` after `## Crash Recovery`. Section documents: AC-to-wave mapping algorithm (`mapAcsToWave`), pass/fail gating protocol (`verifyWaveAcs` → `WaveVerificationReport`), fix plan generation (`buildWaveFixPlan`), and report output paths. File remains at 163 lines (≤300 budget).
- Task 2: Read-only verification of `src/engine/wave-verifier.ts` — all 4 pure functions confirmed correct: `mapAcsToWave`, `verifyWaveAcs`, `formatWaveVerificationReport`, `buildWaveFixPlan`. Both type definitions (`AcVerificationResult`, `WaveVerificationReport`) confirmed. Edge cases (no ACs mapped → allPassed, ≥1 covering task succeeds → AC passes) confirmed in implementation.
- Task 3: Read-only verification of `test/unit/engine/wave-verifier.test.ts` — 19 test cases across 4 describe blocks covering all AC scenarios including keyword overlap, edge cases, formatting, and fix plan generation.
- Task 4: `npx vitest run` — 1723 tests passed, 68 files, zero regressions.

### File List

templates/commands/execute.md

## Change Log

- 2026-03-19: Added `## Wave Verification` section to `templates/commands/execute.md` documenting goal-backward AC verification (FR-704). Verified pre-built `src/engine/wave-verifier.ts` and `test/unit/engine/wave-verifier.test.ts`. All 1723 tests pass. Story → review.
