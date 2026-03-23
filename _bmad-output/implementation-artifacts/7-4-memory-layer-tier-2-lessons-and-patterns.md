# Story 7.4: Memory Layer Tier 2 — Lessons & Patterns

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer who wants reusable patterns captured across sessions,
I want the framework to distill recurring successful approaches into lessons files,
so that proven patterns are systematically reused rather than rediscovered each session.

## Acceptance Criteria

**AC-1: Lessons Distilled from Recurring Feedback Patterns**

Given multiple feedback files exist with recurring failure patterns
When Memory Layer Tier 2 processing runs (auto-triggered when total sessions ≥ 5)
Then a lessons file is written to `.buildpact/memory/lessons/lessons.json`
And each lesson entry captures: acPattern, failCount, keyword-heuristic recommendation, and affectedSlugs
And an AC must have failed in ≥ 2 sessions (`LESSONS_MIN_FAIL_COUNT`) to qualify as a lesson

**AC-2: Distillation Threshold Enforced**

Given fewer than 5 total verification sessions exist across all feedback files
When `captureDistilledLessons()` is called
Then it returns `ok(undefined)` — no lessons file is written
And when `forceDistill = true`, distillation runs regardless of session count

**AC-3: User Notified When Lessons Are Written**

Given distillation runs and lessons are written
When the `/bp:verify` session completes
Then the user sees the `cli.verify.lessons_distilled` notification with the lesson count
And lessons are formatted as a `## Lessons & Patterns Memory (Tier 2)` block for context injection

**AC-4: Lessons Section Documented in verify.md**

Given the `## Lessons & Patterns — Memory Tier 2` section exists in `templates/commands/verify.md`
When I open the orchestrator template
Then it documents the distillation trigger, minimum pattern threshold, LessonEntry structure, output path, and context injection
And the cumulative verify.md line count remains ≤ 300

## Tasks / Subtasks

- [x] Task 1: Add `## Lessons & Patterns — Memory Tier 2` section to `templates/commands/verify.md` (AC: #1, #2, #3, #4)
  - [x] 1.1: Insert new section between `## Session Feedback — Memory Tier 1` and `## Implementation Notes`
  - [x] 1.2: Document auto-trigger condition: total sessions ≥ LESSONS_DISTILL_THRESHOLD (5)
  - [x] 1.3: Document minimum pattern threshold: AC fails in ≥ LESSONS_MIN_FAIL_COUNT (2) sessions
  - [x] 1.4: Document LessonEntry structure: acPattern, failCount, recommendation, affectedSlugs
  - [x] 1.5: Document output path: `.buildpact/memory/lessons/lessons.json`
  - [x] 1.6: Document context notification: `cli.verify.lessons_distilled` + `## Lessons & Patterns Memory (Tier 2)` block
  - [x] 1.7: Verify cumulative verify.md line count ≤ 300 (actual: 134 lines)

- [x] Task 2: Verify `src/engine/lessons-distiller.ts` (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `shouldDistill(totalSessions, threshold=5): boolean` — true when ≥ threshold
  - [x] 2.2: Confirm `slugifyAc(acText): string` — lowercase, hyphens, trim leading/trailing, collapse consecutive, truncate to 60
  - [x] 2.3: Confirm `buildRecommendation(acText, notes): string` — keyword heuristics (test/typecheck/lint/file/command/error/log/default), appends `Common notes: {n1}; {n2}` when notes provided
  - [x] 2.4: Confirm `analyzePatterns(feedbackFiles, minFailCount=2): PatternMatch[]` — iterates all entries/failedAcs, deduplicates slugs, collects unique notes, sorts by failCount descending
  - [x] 2.5: Confirm `buildLessonEntry(pattern): LessonEntry` — id=slugifyAc(acText), recommendation from buildRecommendation with commonNotes
  - [x] 2.6: Confirm `countTotalSessions(feedbackFiles): number` — sums all entry counts across files
  - [x] 2.7: Confirm `distillLessons(feedbackFiles): LessonsFile` — pure function, no I/O, sets totalSessionsAnalyzed and distilledAt
  - [x] 2.8: Confirm `captureDistilledLessons(projectDir, feedbackFiles, forceDistill=false): Promise<Result<LessonsFile|undefined>>` — returns ok(undefined) below threshold, ok(LessonsFile) when distilling
  - [x] 2.9: Confirm `formatLessonsForContext(file): string` — returns '' for empty lessons, Tier 2 header, lesson blocks with failCount/recommendation/affectedSlugs
  - [x] 2.10: Confirm constants: `LESSONS_DISTILL_THRESHOLD = 5`, `LESSONS_MIN_FAIL_COUNT = 2`
  - [x] 2.11: Confirm handler.ts calls `captureDistilledLessons(projectDir, recentFeedbacks)` and shows `cli.verify.lessons_distilled` when `lessonsResult.value !== undefined`

- [x] Task 3: Verify `test/unit/engine/lessons-distiller.test.ts` covers all functions (DO NOT recreate — read-only check)
  - [x] 3.1: `shouldDistill` — below threshold, at threshold, above threshold, custom threshold
  - [x] 3.2: `slugifyAc` — lowercase/hyphens, trim, collapse multiple non-alphanum, truncate to 60
  - [x] 3.3: `buildRecommendation` — test/typecheck/lint/file/generic branches, notes appended
  - [x] 3.4: `countTotalSessions` — empty→0, sums correctly across multiple files
  - [x] 3.5: `analyzePatterns` — no failures→[], below min→[], recurring pattern (2+ sessions)→PatternMatch, notes collected, unique slugs, sorted descending
  - [x] 3.6: `buildLessonEntry` — id, acPattern, failCount, affectedSlugs, learnedAt ISO, recommendation non-empty
  - [x] 3.7: `distillLessons` — empty→lessons=[], totalSessionsAnalyzed, lessons for recurring failures, distilledAt ISO
  - [x] 3.8: `formatLessonsForContext` — empty→'', Tier 2 header, lesson content with failCount/recommendation, affected slugs
  - [x] 3.9: I/O — `loadLessonsFile` (missing→empty LessonsFile, loads previously written), `writeLessonsFile` (ok+path, creates nested dir)
  - [x] 3.10: `captureDistilledLessons` — below threshold→ok(undefined), at threshold→ok(LessonsFile), writes to `.buildpact/memory/lessons/lessons.json`, forceDistill=true bypasses threshold

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — 1723 tests, 68 files, all pass
  - [x] 4.2: Verify cumulative verify.md ≤ 300 lines (actual: 134 lines)

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/engine/lessons-distiller.ts` | ✅ Complete | 308 LOC — 8 pure functions + 3 I/O functions + 2 constants |
| `test/unit/engine/lessons-distiller.test.ts` | ✅ Complete | 451 LOC — 10 describe blocks covering all exported functions |

**The PRIMARY task is Task 1: add `## Lessons & Patterns — Memory Tier 2` section to `templates/commands/verify.md`.**

Handler integration in `src/commands/verify/handler.ts` is already complete:
```typescript
// After captureSessionFeedback:
const feedbackDir = join(projectDir, '.buildpact', 'memory', 'feedback')
const recentFeedbacks = await loadRecentFeedbacks(feedbackDir, 50)
const lessonsResult = await captureDistilledLessons(projectDir, recentFeedbacks)
if (lessonsResult.ok && lessonsResult.value !== undefined) {
  clack.log.info(i18n.t('cli.verify.lessons_distilled', { count: String(lessonsResult.value.lessons.length) }))
}
```

Note: `loadRecentFeedbacks(feedbackDir, 50)` passes 50 files (not 5) to maximize pattern detection.

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

`lessons-distiller.ts` is in `src/engine/` and imports from `./session-feedback.js` — this is valid (same layer).
Do NOT add imports from `src/commands/` in `src/engine/` — layer violation.

**FR mapping:** `FR-805` (implied by FR-803 Tier 2) → Lessons & Patterns distillation

**Types exported from `src/engine/lessons-distiller.ts`:**
```typescript
export interface PatternMatch { acText; failCount; slugs; commonNotes }
export interface LessonEntry { id; acPattern; failCount; learnedAt; recommendation; affectedSlugs }
export interface LessonsFile { distilledAt; totalSessionsAnalyzed; lessons: LessonEntry[] }
```

**I/O paths:**
```
.buildpact/memory/lessons/lessons.json   ← single JSON file for all distilled lessons
```
- Written by `captureDistilledLessons(projectDir, feedbackFiles)`
- Loaded by `loadLessonsFile(lessonsDir)` — returns empty LessonsFile on any error

**Keyword heuristics taxonomy (same as `buildAcGuidance()` in verify handler):**
1. `test` or `spec` → "Ensure tests are written and passing before verification."
2. `typecheck` or `type check` → "Run typecheck (tsc --noEmit)..."
3. `lint` → "Run linter before verification..."
4. `file` or `creat` or `generat` → "Verify expected files are created..."
5. `command` or `cli` → "Run the CLI command manually..."
6. `error` or `fail` → "Review error handling paths..."
7. `log` or `audit` → "Confirm audit log entries..."
8. default → "Review this criterion carefully — it has failed repeatedly."

**`formatLessonsForContext()` output format:**
```markdown
## Lessons & Patterns Memory (Tier 2)

_Distilled from {N} sessions on {YYYY-MM-DD}._

### Lesson: {acPattern}
- **Failures**: {failCount} sessions
- **Recommendation**: {recommendation}
- **Seen in**: {slug1, slug2}
```

**`captureDistilledLessons()` threshold logic:**
```typescript
const totalSessions = countTotalSessions(feedbackFiles)
if (!forceDistill && !shouldDistill(totalSessions)) {
  return ok(undefined)  // skip silently
}
const lessonsFile = distillLessons(feedbackFiles)
const lessonsDir = join(projectDir, '.buildpact', 'memory', 'lessons')
// writes to lessons.json, returns ok(lessonsFile)
```

**i18n keys already registered (do NOT add new keys):**
```yaml
cli.verify.lessons_distilled    # "Lessons distilled: {count} pattern(s) saved to .buildpact/memory/lessons/lessons.json"
error.lessons.write_failed      # "Failed to write lessons file to .buildpact/memory/lessons/"
```

### verify.md Section Template

Insert this section **between** `## Session Feedback — Memory Tier 1` and `## Implementation Notes`:

```markdown
## Lessons & Patterns — Memory Tier 2

When total verification sessions ≥ `LESSONS_DISTILL_THRESHOLD` (5), recurring
failure patterns are automatically distilled to `.buildpact/memory/lessons/lessons.json`.

### Distillation Trigger

Auto-triggered at end of `/bp:verify`. An AC must fail in ≥ 2 sessions
(`LESSONS_MIN_FAIL_COUNT`) to become a lesson. Use `forceDistill=true` to bypass
the threshold during testing.

### Lesson Entry Structure

Each lesson captures: `acPattern`, `failCount`, keyword-heuristic `recommendation`
(same taxonomy as `buildAcGuidance()`), and `affectedSlugs`.

### Context Notification

User is notified via `cli.verify.lessons_distilled` when new lessons are written.
Lessons formatted as `## Lessons & Patterns Memory (Tier 2)` for context injection.

Implementation: `captureDistilledLessons()`, `distillLessons()`, `analyzePatterns()`
in `src/engine/lessons-distiller.ts`.
Types: `LessonEntry`, `LessonsFile`, `PatternMatch` (same file).
```

### verify.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base  | Header + Implementation Notes | ~7 | ~7 |
| 7.1   | Guided Acceptance Test | ~51 | ~58 |
| 7.2   | Fix Plan Generation | ~28 | ~86 |
| 7.3   | Session Feedback — Memory Tier 1 | ~23 | ~109 |
| **7.4** | **Lessons & Patterns — Memory Tier 2** | **~25** | **~134** |
| 7.5 | Decisions Log (next) | ~21 | ~155 |

Target: ≤ 300 lines. Budget: ~166 lines remaining after 7.4.

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `lessons-distiller.ts` — pre-built and complete
- ❌ Do NOT import from `src/commands/` inside `src/engine/` — layer violation
- ❌ Do NOT add new i18n keys — `cli.verify.lessons_distilled` is already registered
- ❌ Do NOT lower LESSONS_DISTILL_THRESHOLD — 5 sessions is the intentional minimum for meaningful pattern detection
- ❌ Do NOT make `distillLessons()` async — it is a pure synchronous function; I/O is handled by `captureDistilledLessons()`
- ❌ Do NOT change `analyzePatterns()` to modify the failMap in-place — it uses a Map internally but returns a new array
- ❌ Do NOT remove the `## Implementation Notes` block from verify.md — required by Markdown orchestrator standard

### Previous Story Intelligence (Stories 7.1, 7.2, 7.3)

- **Pre-built pattern is the same:** Implementation already exists; primary task is the Markdown orchestrator section
- **ESM imports:** `.js` extension MANDATORY on all internal imports (e.g., `from './session-feedback.js'`)
- **Result<T> pattern:** `ok(undefined)` when skipped, `ok(LessonsFile)` when distilled, `err(...)` on write failure
- **Separation of pure/I/O:** `distillLessons()` is pure — all I/O through `captureDistilledLessons()` wrapper
- **Session counting:** `countTotalSessions()` sums `file.entries.length` across all FeedbackFiles — each entry is one session

### Coverage Expectations

- `src/engine/lessons-distiller.ts` pure functions (`shouldDistill`, `slugifyAc`, `buildRecommendation`, `analyzePatterns`, `buildLessonEntry`, `countTotalSessions`, `distillLessons`, `formatLessonsForContext`): 85%+ coverage
- I/O functions (`loadLessonsFile`, `writeLessonsFile`, `captureDistilledLessons`): integration tested with real temp dirs
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | readFile, mkdir, writeFile for lessons I/O |
| `node:path` | built-in | join for path construction |
| `node:os` | built-in | mkdtemp for test temp dirs |

### Project Structure Notes

`lessons-distiller.ts` is in `src/engine/` and imports `FeedbackFile` type from `./session-feedback.js` — valid same-layer import. Lessons file is a single `lessons.json` (not per-slug like feedback) because lessons aggregate patterns across all specs. The `analyzePatterns()` function uses a `Map<string, {...}>` keyed on AC text for O(n) pattern detection. Pattern notes are deduplicated: `if (note && !existing.notes.includes(note))`.

### References

- [Source: epics.md#Epic7-Story7.4] — User story, AC
- [Source: architecture.md#FR-803] — Memory Layer Tier 2 (Lessons Files, Beta milestone)
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← commands/`
- [Source: architecture.md#cross-cutting-concerns #5] — State Persistence: file-as-DB pattern
- [Source: architecture.md#markdown-orchestrator-header] — Header comment + `## Implementation Notes` required
- [Source: src/engine/lessons-distiller.ts] — Full implementation: 8 pure + 3 I/O + 2 constants
- [Source: test/unit/engine/lessons-distiller.test.ts] — 10 describe blocks, 451 LOC
- [Source: src/commands/verify/handler.ts] — Integration: captureDistilledLessons call + lessons_distilled i18n
- [Source: locales/en.yaml#cli.verify.lessons_distilled] — i18n key (already registered)
- [Source: templates/commands/verify.md] — Current state after Story 7.3 (~109 lines)
- [Source: 7-3-memory-layer-tier-1-session-feedback.md] — Previous story context

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_None — pre-built pattern; no debugging required._

### Completion Notes List

- Task 1: Added `## Lessons & Patterns — Memory Tier 2` section to `templates/commands/verify.md` (lines 104–128). Section placed between `## Session Feedback — Memory Tier 1` and `## Implementation Notes` exactly as specified. Final line count: 134 (≤ 300 budget satisfied).
- Task 2: Read-only verification of `src/engine/lessons-distiller.ts` (308 LOC) — all 11 subtasks confirmed present and correct.
- Task 3: Read-only verification of `test/unit/engine/lessons-distiller.test.ts` (451 LOC, 10 describe blocks) — all 10 subtasks confirmed present and correct.
- Task 4: `npx vitest run` — 1723 tests, 68 files, 0 failures, 0 regressions.

### File List

- `templates/commands/verify.md` — added `## Lessons & Patterns — Memory Tier 2` section (lines 104–128)

## Change Log

- 2026-03-19: Added `## Lessons & Patterns — Memory Tier 2` section to `templates/commands/verify.md`. Verified pre-built `lessons-distiller.ts` and its tests. All 1723 tests pass.
