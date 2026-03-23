# Story 12.4: Domain-Specific Metrics

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an expert user optimizing different types of content,
I want built-in metric functions for code, marketing copy, and agent behavior — plus the ability to define custom metrics,
so that the AutoResearch loop can objectively measure improvement regardless of my domain.

## Acceptance Criteria

1. **Given** I am optimizing a Software Squad target, **When** I configure the metric, **Then** built-in metrics include: test pass rate, bundle size, Lighthouse score, build time, code coverage, and type-check pass/fail.

2. **Given** I am optimizing a Marketing Squad target, **When** I configure the metric, **Then** built-in metrics include: readability score, compliance check pass rate, keyword density, and CTA clarity score **And** the evaluator model differs from the generator model to mitigate auto-evaluation circularity.

3. **Given** I want a domain-specific metric not covered by built-ins, **When** I provide a custom metric script (any executable returning a numeric score to stdout), **Then** the AutoResearch loop uses it as the optimization target without any framework modifications.

## Tasks / Subtasks

> **⚠️ CRITICAL CONTEXT — READ BEFORE STARTING:** Story 12.4 was implemented by the Ralph autonomous system as commit `a43c8fe` (`feat: [US-055] - Epic 12.4: Domain-Specific Metrics`). All implementation files already exist. The tasks below are **verification tasks**, not fresh implementation.

- [x] Task 1: Verify AC #1 — Software metrics catalog (AC: #1)
  - [x] 1.1 Confirm `SOFTWARE_METRICS` is exported as a `readonly` array of `MetricDefinition` with exactly these IDs: `test_pass_rate`, `bundle_size`, `lighthouse_score`, `build_time`, `coverage`, `type_check`
  - [x] 1.2 Confirm polarity assignments: `test_pass_rate`, `lighthouse_score`, `coverage` → `higher_is_better`; `bundle_size`, `build_time`, `type_check` → `lower_is_better`
  - [x] 1.3 Confirm `collectSoftwareMetricStub(metricId, _projectDir, nowMs)` returns a `MetricSample` with `source: 'stub'` and hardcoded baseline values (test_pass_rate=95, bundle_size=250000, lighthouse=85, build_time=3500, coverage=78.5, type_check=0)
  - [x] 1.4 Confirm `getMetricsForDomain('software')` returns `SOFTWARE_METRICS`, `getMetricsForDomain('custom')` returns `[]`
  - [x] 1.5 Confirm `findMetricById(id)` searches both `SOFTWARE_METRICS` and `MARKETING_METRICS`, returns `undefined` for unknown IDs

- [x] Task 2: Verify AC #2 — Marketing metrics and evaluator model selection (AC: #2)
  - [x] 2.1 Confirm `MARKETING_METRICS` contains exactly: `readability_score`, `compliance_pass_rate`, `keyword_density`, `cta_clarity` — all `higher_is_better`
  - [x] 2.2 Confirm `collectMarketingMetricStub(metricId, _content, nowMs)` returns `MetricSample` with `source: 'stub'` and baseline values (readability=72, compliance=88, keyword_density=2.5, cta_clarity=65)
  - [x] 2.3 Confirm `selectEvaluatorModel(generatorModel)` returns a model DIFFERENT from `generatorModel` from `['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']`
  - [x] 2.4 Confirm `selectEvaluatorModel` falls back to `KNOWN_MODELS[1]` (`'claude-sonnet-4-6'`) when all known models match (edge case)

- [x] Task 3: Verify AC #3 — Custom metric via executable script (AC: #3)
  - [x] 3.1 Confirm `collectCustomMetric(config, nowMs, execFn)` calls `execFn(config.scriptPath)`, parses stdout as float via `parseFloat`, returns `ok(MetricSample)` with `source: 'executable'`
  - [x] 3.2 Confirm it returns `err(FILE_READ_FAILED)` when `execFn` throws
  - [x] 3.3 Confirm it returns `err(CONFIG_INVALID)` when stdout is non-numeric (e.g., empty string, "N/A")

- [x] Task 4: Verify metric comparison utilities (AC: #1, #2, #3)
  - [x] 4.1 Confirm `computeMetricDelta(before, after)` returns `after.value - before.value`
  - [x] 4.2 Confirm `classifyMetricDirection(delta, polarity)`: `delta=0` → `'unchanged'`; `higher_is_better`: positive → `'improved'`, negative → `'regressed'`; `lower_is_better`: negative → `'improved'`, positive → `'regressed'`
  - [x] 4.3 Confirm `compareMetricSamples(definition, before, after)` returns full `MetricComparison` with correct `delta` and `direction`
  - [x] 4.4 Confirm `formatMetricChange(comparison)` format: `"MetricName: X.XXunit → Y.YYunit (+Z.ZZ) [direction]"`
  - [x] 4.5 Confirm `formatMetricReport(comparisons)` returns `'_(no metrics collected)_'` for empty array, or markdown table with header

- [x] Task 5: Verify tests pass (AC: #1, #2, #3)
  - [x] 5.1 Run `npx vitest run test/unit/optimize/domain-metrics.test.ts` and confirm all tests pass
  - [x] 5.2 Confirm tests cover software/marketing catalogs, selectEvaluatorModel, collectCustomMetric (success/exec-fail/non-numeric), delta/direction/comparison/formatting functions

## Dev Notes

### Critical Context — Implementation Already Exists

**All deliverables committed in `a43c8fe` (US-055, 2026-03-16).** `src/optimize/domain-metrics.ts` is ~394 lines.

**Files to verify:**

| File | Description |
|------|-------------|
| `src/optimize/domain-metrics.ts` | Metric catalogs, collection stubs, custom metric, comparison utilities |
| `test/unit/optimize/domain-metrics.test.ts` | Test suite (19+ tests seen in earlier run) |

### Architecture Compliance

- **Alpha stubs:** `collectSoftwareMetricStub` and `collectMarketingMetricStub` return hardcoded values with `source: 'stub'`. In v1.0, each metric ID maps to a real command-line measurement tool.
- **`MetricDomain` type:** `'software' | 'marketing' | 'custom'`
- **`MetricPolarity` type:** `'higher_is_better' | 'lower_is_better'`
- **`MetricDirection` type:** `'improved' | 'regressed' | 'unchanged'`
- **`MetricSample`:** `{ metricId, value: number, collectedAtMs: number, source: 'stub' | 'executable' }`
- **`MetricComparison`:** `{ definition, before, after, delta, direction }`
- **Custom metric `ExecFn`:** `(command: string) => string` — injectable for testing.
- **`collectCustomMetric` parses with `parseFloat`:** Returns error for `NaN` or non-finite output.
- **Anti-bias design:** `selectEvaluatorModel` ensures marketing CTA clarity is evaluated by a different model than the one that generated the copy.
- **Known models constant:** `['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']` — hardcoded in module.

### Key Types

```typescript
interface MetricDefinition { id: string; name: string; domain: MetricDomain; unit: string; polarity: MetricPolarity }
interface CustomMetricConfig { scriptPath: string; name: string; polarity: MetricPolarity }
interface MetricSample { metricId: string; value: number; collectedAtMs: number; source: 'stub' | 'executable' }
interface MetricComparison { definition: MetricDefinition; before: MetricSample; after: MetricSample; delta: number; direction: MetricDirection }
```

### Previous Story Learnings (12.3)

- I/O functions use injectable functions (same pattern as `ratchet.ts` `execFn`)
- Custom metric `execFn` type: `(command: string) => string` — synchronous, returns stdout string

### References

- Epic 12, Story 12.4: `_bmad-output/planning-artifacts/epics.md` § "Story 12.4"
- Implementation commit: `a43c8fe` (US-055)
- Architecture — FR-1205 (domain metrics), FR-1206 (custom metrics)
- Anti-bias evaluator: `selectEvaluatorModel` — different model from generator

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented by Ralph autonomous system (commit a43c8fe, 2026-03-16) prior to BMAD sprint tracking
- Verification story — all deliverables pre-exist
- **AC #1 verified:** `SOFTWARE_METRICS` has 6 correct IDs with correct polarity. `collectSoftwareMetricStub` returns hardcoded baselines with `source: 'stub'`. `getMetricsForDomain`/`findMetricById` work correctly.
- **AC #2 verified:** `MARKETING_METRICS` has 4 correct IDs all `higher_is_better`. `collectMarketingMetricStub` correct baselines. `selectEvaluatorModel` returns different model, fallback to index 1.
- **AC #3 verified:** `collectCustomMetric` calls execFn, parses float, returns ok/err correctly. Non-numeric and exec-fail error paths confirmed.
- **Utilities verified:** `computeMetricDelta`, `classifyMetricDirection` (all polarity/direction combos), `compareMetricSamples`, `formatMetricChange`, `formatMetricReport` (empty/table).
- **Tests:** 52/52 pass in `test/unit/optimize/domain-metrics.test.ts`.

### File List

- `src/optimize/domain-metrics.ts` (existing — verify meets all ACs)
- `test/unit/optimize/domain-metrics.test.ts` (existing — verify passes)
