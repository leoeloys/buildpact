# Story 12.5: Optimization Report

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an expert user reviewing the results of an optimization session,
I want an automatically generated report summarizing every experiment and improvement found,
so that I can make an informed decision about which optimizations to merge into main.

## Acceptance Criteria

1. **Given** an AutoResearch session completes, **When** the report is generated, **Then** `optimization-report.md` is created containing: total experiments run, improvements found, specific changes made, before/after metric comparison, and a diff of all kept modifications.

2. **Given** I review the report and decide to merge improvements, **When** I proceed with the merge, **Then** the report clearly indicates which branch to merge and the expected metric impact **And** the `results.tsv` append-only log contains the full experiment history for audit purposes.

## Tasks / Subtasks

> **⚠️ CRITICAL CONTEXT — READ BEFORE STARTING:** Story 12.5 was implemented by the Ralph autonomous system as commit `c8c5634` (`feat: [US-056] - Epic 12.5: Optimization Report`). All implementation files already exist. The tasks below are **verification tasks**, not fresh implementation.

- [x] Task 1: Verify AC #1 — optimization-report.md content (AC: #1)
  - [x] 1.1 Confirm `buildOptimizationReport(input)` produces markdown with all required sections: `# Optimization Report` header (session/target/branch/generated), `## Summary` table (experiments run, improvements kept, metrics improved/regressed), `## Experiments Run` table (per-experiment row), `## Improvements Kept` (per improvement: description + diff + metrics), `## Before/After Metrics` table, `## Branch to Merge` with expected impact
  - [x] 1.2 Confirm the Summary section uses a markdown table with columns `Metric | Value`
  - [x] 1.3 Confirm the Experiments Run table includes columns `# | Description | Outcome | Committed` with ✅/❌ committed status
  - [x] 1.4 Confirm `## Branch to Merge` includes `optimize/…` branch name in backticks and "Expected Impact" sub-section with improvement/regression lists
  - [x] 1.5 Confirm `writeOptimizationReport(reportPath, content, writeFn)` calls `writeFn(reportPath, content)` and returns `ok(undefined)` on success, `err(FILE_WRITE_FAILED)` on exception

- [x] Task 2: Verify AC #2 — results.tsv append-only log (AC: #2)
  - [x] 2.1 Confirm `RESULTS_TSV_HEADER` = `'timestamp\tbranch\texperiment_number\toutcome\tdescription\tcommitted\tmetric_summary'`
  - [x] 2.2 Confirm `formatResultsTsvRow(row)` tab-joins all 7 fields in header order, sanitizing internal tabs/newlines to spaces
  - [x] 2.3 Confirm `buildResultsTsvRow(experiment, branchName, keptNums, metricSummary)` maps `experimentNumber`, ISO timestamp from `completedAtMs`, `'Y'/'N'` for `committed` based on `keptNums.has(experimentNumber)`
  - [x] 2.4 Confirm `appendResultsTsv(tsvPath, rows, existsFn, appendFn)` prepends `RESULTS_TSV_HEADER` when `existsFn(tsvPath)` returns `false` (new file), then appends all formatted rows via `appendFn`
  - [x] 2.5 Confirm `appendResultsTsv` uses injectable `existsFn` and `appendFn` — never directly reads/writes files (enables testing without FS)
  - [x] 2.6 Confirm `appendResultsTsv` returns `err(FILE_WRITE_FAILED)` when `appendFn` throws

- [x] Task 3: Verify empty-state handling (AC: #1)
  - [x] 3.1 Confirm `buildOptimizationReport` with empty `keptImprovements` renders `_(no improvements were committed)_` in Improvements Kept section
  - [x] 3.2 Confirm `buildOptimizationReport` with empty `aggregateMetrics` renders `_(no metrics collected)_` in Before/After Metrics section
  - [x] 3.3 Confirm `buildOptimizationReport` with `improvementsFound=0` renders "no improvements found" in Branch to Merge (discard branch message instead of merge instructions)
  - [x] 3.4 Confirm `appendResultsTsv` with empty `rows` array does NOT call `appendFn` (no-op)

- [x] Task 4: Verify tests pass (AC: #1, #2)
  - [x] 4.1 Run `npx vitest run test/unit/optimize/optimization-report.test.ts` and confirm all tests pass
  - [x] 4.2 Confirm tests cover: `formatResultsTsvRow` (sanitize tabs), `buildResultsTsvRow` (committed Y/N), `buildOptimizationReport` (full report / empty states), `writeOptimizationReport` (success/failure), `appendResultsTsv` (new file with header / existing file / empty rows / write failure)

## Dev Notes

### Critical Context — Implementation Already Exists

**All deliverables committed in `c8c5634` (US-056, 2026-03-16).** `src/optimize/optimization-report.ts` is ~330 lines.

**Files to verify:**

| File | Description |
|------|-------------|
| `src/optimize/optimization-report.ts` | Report builder + TSV helpers — pure functions + injectable I/O |
| `test/unit/optimize/optimization-report.test.ts` | Test suite with fixtures for all interfaces |

### Architecture Compliance

- **Append-only pattern:** `appendResultsTsv` uses `appendFn` (not `writeFn`) — never truncates/overwrites. This matches the architecture's `optimize/*/results.tsv: append-only + lock` classification. Note: `.lock` sentinel file is NOT implemented in this module (it was part of an earlier design note but not included in the ADR text — no deviation).
- **Injectable I/O types:** `WriteFileFn = (path: string, content: string) => void` and `AppendFileFn = (path: string, content: string) => void` — synchronous, injectable for testing.
- **`OptimizationReportInput` interface:** Aggregates `RatchetSession`, `ExperimentResult[]`, `KeptImprovement[]`, `MetricComparison[]`, `generatedAt: string`
- **`KeptImprovement`:** `{ experimentNumber, description, diffContent, metrics: MetricComparison[] }`
- **`ResultsTsvRow`:** 7 fields matching TSV header columns exactly
- **Cross-module dependencies:** Imports types from `experiment-loop.ts` (`ExperimentResult`), `ratchet.ts` (`RatchetSession`), `domain-metrics.ts` (`MetricComparison`, `MetricDefinition`, `MetricSample`)
- **Metric emojis:** `'improved'` → ✅, `'regressed'` → ❌, `'unchanged'` → ➖

### Test Fixture Pattern

Test file uses factory functions at the top:
```typescript
const makeSession = (overrides?) => ({ targetType: 'code', sessionName: 'session-1', branchName: 'optimize/code/session-1/2026', lastGoodCommitRef: 'abc123', ...overrides })
const makeExperiment = (n, outcome = 'improved') => ({ experimentNumber: n, startedAtMs: NOW, completedAtMs: NOW + 60_000, outcome, description: `Experiment ${n}` })
const makeInput = (overrides?) => ({ session: makeSession(), experiments: [...], keptImprovements: [...], aggregateMetrics: [...], generatedAt: '2026-03-16T00:00:00.000Z', ...overrides })
```
`NOW = 1_700_000_000_000` fixed epoch.

### Key Constants and Types

```typescript
export const RESULTS_TSV_HEADER = 'timestamp\tbranch\texperiment_number\toutcome\tdescription\tcommitted\tmetric_summary'

export type WriteFileFn = (path: string, content: string) => void
export type AppendFileFn = (path: string, content: string) => void
```

### Previous Story Learnings (12.3, 12.4)

- Injectable I/O pattern: all write/append operations use injected functions — tests provide vi.fn() mocks
- Error pattern: catch-all try/catch → `err({ code: ERROR_CODES.FILE_WRITE_FAILED, ... })`
- All cross-module imports use `.js` ESM extension

### References

- Epic 12, Story 12.5: `_bmad-output/planning-artifacts/epics.md` § "Story 12.5"
- Implementation commit: `c8c5634` (US-056)
- Architecture — FR-1206 (optimization report), `results.tsv` append-only classification
- ADR-001: `docs/decisions/ADR-001-autoResearch-isolation.md` — results.tsv append-only policy

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented by Ralph autonomous system (commit c8c5634, 2026-03-16) prior to BMAD sprint tracking
- Verification story — all deliverables pre-exist
- **AC #1 verified:** `buildOptimizationReport` produces 6-section markdown: header (session/target/branch/generated), Summary table (`Metric | Value`), Experiments Run table (`# | Description | Outcome | Committed` with ✅/❌), Improvements Kept (description + diff + metrics per improvement), Before/After Metrics table, Branch to Merge with `optimize/…` in backticks + Expected Impact sub-section.
- **AC #2 verified:** `RESULTS_TSV_HEADER` = 7 tab-separated columns in correct order. `formatResultsTsvRow` tab-joins all fields, sanitizing internal tabs/newlines to spaces. `buildResultsTsvRow` uses ISO timestamp from `completedAtMs`, `'Y'/'N'` for `committed`. `appendResultsTsv` prepends header on new file (existsFn=false), appends all rows, uses injectable `existsFn`/`appendFn` — never direct FS access.
- **Empty-state verified:** No improvements → `_(no improvements were committed)_`; empty metrics → `_(no metrics collected)_`; improvementsFound=0 → no-merge/discard-branch message; empty rows → no appendFn call.
- **Tests:** 31/31 pass in `test/unit/optimize/optimization-report.test.ts`.

### File List

- `src/optimize/optimization-report.ts` (existing — verify meets all ACs)
- `test/unit/optimize/optimization-report.test.ts` (existing — verify passes)
