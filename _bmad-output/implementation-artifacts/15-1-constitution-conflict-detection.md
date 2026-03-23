# Story 15.1: Constitution Conflict Detection

Status: review

## Story

As a project lead maintaining a BuildPact constitution,
I want the system to detect contradictory rules in my constitution.md,
so that I can resolve ambiguities before they cause enforcement failures or confusing agent behavior.

## Acceptance Criteria

**AC-1: Contradiction Detection Between Prohibition and Permission Rules**

Given a constitution.md contains both "Never use inline styles" and "Use inline styles for email templates"
When I run `bp doctor --check-constitution` or the conflict detector is invoked
Then the system reports a conflict with both rule texts, their line numbers, and the section they belong to

**AC-2: Duplicate Rule Detection**

Given a constitution.md contains two rules with semantically identical content (e.g., same words in different sections)
When the conflict detector runs
Then duplicates are reported with line references and a suggestion to consolidate

**AC-3: Conflict Report Output**

Given the conflict detector finds N conflicts
When the analysis completes
Then a structured report is displayed via @clack/prompts with severity (error/warning), conflicting rule pairs, line numbers, and suggested resolution actions
And the report is also written to `.buildpact/reports/constitution-conflicts.md`

**AC-4: Clean Constitution Passes Without Warnings**

Given a constitution.md with no contradictory or duplicate rules
When the conflict detector runs
Then the system reports "No conflicts detected" and exits cleanly

## Tasks / Subtasks

- [x] Task 1: Implement conflict detection engine (AC: #1, #2)
  - [x] 1.1: Create `src/engine/constitution-conflict-detector.ts` with `detectConflicts(content: string): ConstitutionConflict[]`
  - [x] 1.2: Extend `parseConstitutionPrinciples()` output to include line numbers (add `line` field to `ConstitutionPrinciple`)
  - [x] 1.3: Implement prohibition-vs-permission contradiction detection using PROHIBITION_KEYWORDS from `src/foundation/constitution.ts`
  - [x] 1.4: Implement duplicate/near-duplicate detection using normalized string comparison

- [x] Task 2: Integrate with CLI output (AC: #3, #4)
  - [x] 2.1: Add `--check-constitution` flag to `bp doctor` command in `src/commands/doctor/checks.ts`
  - [x] 2.2: Format conflict report using @clack/prompts (note/warn/error boxes)
  - [x] 2.3: Write report to `.buildpact/reports/constitution-conflicts.md`

- [x] Task 3: Add i18n strings (AC: #3)
  - [x] 3.1: Add EN strings to `locales/en.yaml` for conflict report messages
  - [x] 3.2: Add PT-BR strings to `locales/pt-br.yaml`

- [x] Task 4: Write tests (AC: all)
  - [x] 4.1: Unit tests in `test/unit/engine/constitution-conflict-detector.test.ts` covering contradiction pairs, duplicates, and clean constitution
  - [x] 4.2: Integration test with a multi-section constitution fixture

## Dev Notes

### Project Structure Notes

- Core logic: pure function in `src/engine/constitution-conflict-detector.ts` — no side effects, returns `Result<ConstitutionConflict[]>`
- Reuse `parseConstitutionPrinciples()` from `src/foundation/constitution.ts` — extend the `ConstitutionPrinciple` interface in `src/contracts/task.ts` to include optional `line: number`
- Reuse `PROHIBITION_KEYWORDS` array from `src/foundation/constitution.ts` (currently not exported — export it)
- Contradiction detection: for each prohibition rule, check if any other rule permits the same term
- Report format follows the same pattern as quality reports: severity + explanation + suggested action

### References

- `src/foundation/constitution.ts` — parsing logic, PROHIBITION_KEYWORDS, extractProhibitedTerm()
- `src/engine/constitution-enforcer.ts` — re-exports, GroupedPrinciple
- `src/engine/constitution-versioner.ts` — diffing logic (reference for section-aware analysis)
- `src/contracts/task.ts` — ConstitutionPrinciple, ConstitutionViolation types

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Created `detectConflicts()` pure function returning `Result<ConstitutionConflict[]>`
- Added `parseConstitutionWithLineNumbers()` extending base parser with line tracking
- Exported `PROHIBITION_KEYWORDS` and `extractProhibitedTerm` from constitution.ts
- Word-overlap algorithm for detecting contradictions between prohibition and permission rules
- Normalized string comparison for duplicate detection
- `--check-constitution` flag added to `bp doctor` command
- Conflict report written to `.buildpact/reports/constitution-conflicts.md`
- 20 unit tests + 4 integration tests all passing

### File List
- src/engine/constitution-conflict-detector.ts (new)
- src/foundation/constitution.ts (modified — exported PROHIBITION_KEYWORDS, extractProhibitedTerm)
- src/foundation/index.ts (modified — new exports)
- src/engine/index.ts (modified — new exports)
- src/commands/doctor/checks.ts (modified — added checkConstitutionConflicts)
- src/commands/doctor/index.ts (modified — --check-constitution flag)
- locales/en.yaml (modified — doctor.constitution_* keys)
- locales/pt-br.yaml (modified — doctor.constitution_* keys)
- test/unit/engine/constitution-conflict-detector.test.ts (new — 20 tests)
- test/integration/pipeline/constitution-conflict.test.ts (new — 4 tests)

### Change Log
- 2026-03-22: All tasks completed, all tests passing
