# Story 7.3: Memory Layer Tier 1 — Session Feedback

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer completing a pipeline session,
I want the framework to automatically capture what worked and what didn't as structured feedback files,
so that future sessions load this feedback and avoid repeating the same mistakes.

## Acceptance Criteria

**AC-1: Feedback Automatically Captured After Verification**

Given a verification session completes via `/bp:verify`
When the final report is written
Then a structured feedback entry is automatically persisted to `.buildpact/memory/feedback/{slug}.json`
And the entry records: slug, outcome (`passed`/`failed`/`partial`), workedAcs, failedAcs with fail notes, and capturedAt ISO timestamp
And the FIFO cap of 30 entries per file is enforced — oldest entries evicted when cap is reached

**AC-2: Recent Feedback Loaded into Subagent Context**

Given feedback files exist from previous sessions
When a new verification session begins and lessons distillation runs
Then the most recent feedback files (by modification time) are loaded via `loadRecentFeedbacks()`
And the formatted `## Session Feedback Memory (Tier 1)` block is available for context injection

**AC-3: Memory Layer Is Free and Open Source**

Given I check Memory Layer availability
When I review the framework features
Then Tier 1 (Session Feedback) is fully included in the open-source core at no cost
And is NOT gated behind a paid tier (FR-804)

**AC-4: Session Feedback Section Documented in verify.md**

Given the `## Session Feedback — Memory Tier 1` section exists in `templates/commands/verify.md`
When I open the orchestrator template
Then it documents the automatic trigger, output path, FIFO cap, FeedbackEntry structure, and context injection
And the cumulative verify.md line count remains ≤ 300

## Tasks / Subtasks

- [x] Task 1: Add `## Session Feedback — Memory Tier 1` section to `templates/commands/verify.md` (AC: #1, #2, #4)
  - [x] 1.1: Insert new section between `## Fix Plan Generation` and `## Implementation Notes`
  - [x] 1.2: Document automatic trigger: end of every `/bp:verify` run — no configuration required
  - [x] 1.3: Document output path: `.buildpact/memory/feedback/{slug}.json`
  - [x] 1.4: Document FeedbackEntry structure: slug, outcome, workedAcs, failedAcs+notes, capturedAt
  - [x] 1.5: Document FIFO cap: FEEDBACK_FIFO_CAP=30, oldest evicted, `loadRecentFeedbacks()` sorted by mtime
  - [x] 1.6: Document context injection: `## Session Feedback Memory (Tier 1)` markdown block
  - [x] 1.7: Verify cumulative verify.md line count ≤ 300

- [x] Task 2: Verify `src/engine/session-feedback.ts` (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `deriveOutcome(passCount, failCount): SessionOutcome` — 'passed' (fail=0 && pass>0), 'failed' (pass=0), 'partial' (both)
  - [x] 2.2: Confirm `buildFeedbackEntry(input: FeedbackBuildInput): FeedbackEntry` — sets slug, workedAcs, failedAcs, notes, capturedAt ISO, derives outcome via deriveOutcome
  - [x] 2.3: Confirm `appendWithFifoCap(entries, newEntry, cap=30): FeedbackEntry[]` — immutable (new array), evicts oldest via slice when over cap
  - [x] 2.4: Confirm `formatFeedbackForContext(files): string` — returns '' for empty, `## Session Feedback Memory (Tier 1)` header, per-slug sections with outcome/workedAcs/failedAcs+notes
  - [x] 2.5: Confirm `captureSessionFeedback(projectDir, entry): Promise<Result<string>>` — loads existing file, appends with FIFO cap, writes to `.buildpact/memory/feedback/{slug}.json`
  - [x] 2.6: Confirm `loadRecentFeedbacks(feedbackDir, limit): Promise<FeedbackFile[]>` — reads dir, filters `.json`, sorts by mtime ascending, slices last N, returns empty array on any error
  - [x] 2.7: Confirm constants exported: `FEEDBACK_FIFO_CAP = 30`, `FEEDBACK_RECENT_LIMIT = 5`
  - [x] 2.8: Confirm handler.ts calls `captureSessionFeedback(projectDir, feedbackEntry)` then `loadRecentFeedbacks(feedbackDir, 50)` after verification completes (50 not 5 — feeds full history to lessons distiller)

- [x] Task 3: Verify `test/unit/engine/session-feedback.test.ts` covers all functions (DO NOT recreate — read-only check)
  - [x] 3.1: `deriveOutcome` — passed/failed/partial branches + edge case (0,0)→failed
  - [x] 3.2: `buildFeedbackEntry` — slug, workedAcs/failedAcs, outcome derivation (passed/failed/partial), notes, capturedAt is valid ISO
  - [x] 3.3: `appendWithFifoCap` — appends, immutable (original unchanged), FIFO eviction at cap (oldest dropped), no truncation under cap, FEEDBACK_FIFO_CAP constant = 30
  - [x] 3.4: `formatFeedbackForContext` — empty→'', Tier 1 header, spec slug, outcome, failedAcs with notes, multiple files rendered
  - [x] 3.5: I/O — `loadFeedbackFile` (missing→empty/valid JSON/invalid JSON), `writeFeedbackFile` (writes+ok+path, creates nested dir), `loadRecentFeedbacks` (missing dir→[]/no JSON→[]/loads files/respects limit), `captureSessionFeedback` (creates file with correct path, accumulates entries across calls)

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass
  - [x] 4.2: Verify cumulative verify.md ≤ 300 lines

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/engine/session-feedback.ts` | ✅ Complete | 239 LOC — 4 pure functions + 4 I/O functions + 2 constants |
| `test/unit/engine/session-feedback.test.ts` | ✅ Complete | 363 LOC — 8 describe blocks covering all exported functions |

**The PRIMARY task is Task 1: add `## Session Feedback — Memory Tier 1` section to `templates/commands/verify.md`.**

Handler integration in `src/commands/verify/handler.ts` is already complete:
```typescript
// After acResults loop, before fix plan:
const workedAcs = acResults.filter(r => r.status === 'pass').map(r => r.ac)
const failedAcs = acResults.filter(r => r.status === 'fail').map(r => r.ac)
const feedbackNotes: Record<string, string> = {}
for (const entry of acResults) {
  if (entry.status === 'fail' && entry.note) {
    feedbackNotes[entry.ac] = entry.note
  }
}
const feedbackEntry = buildFeedbackEntry({ slug, workedAcs, failedAcs, allPassed, notes: feedbackNotes })
await captureSessionFeedback(projectDir, feedbackEntry)
// Then loads 50 recent for lessons distillation:
const feedbackDir = join(projectDir, '.buildpact', 'memory', 'feedback')
const recentFeedbacks = await loadRecentFeedbacks(feedbackDir, 50)
```

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

`session-feedback.ts` is in `src/engine/` — called FROM `handler.ts` in `src/commands/`.
Do NOT add imports from `src/commands/` in `src/engine/` — layer violation.

**FR mapping:** `FR-803` → Session Feedback, `FR-804` → Memory Layer free in OSS core

**Types exported from `src/engine/session-feedback.ts`:**
```typescript
export type SessionOutcome = 'passed' | 'failed' | 'partial'
export interface FeedbackEntry { capturedAt; slug; workedAcs; failedAcs; outcome; notes }
export interface FeedbackFile { slug; entries: FeedbackEntry[] }
export interface FeedbackBuildInput { slug; workedAcs; failedAcs; allPassed; notes }
```

**I/O paths:**
```
.buildpact/memory/feedback/{slug}.json   ← one JSON file per spec slug
```
- Created by `captureSessionFeedback(projectDir, entry)`
- Loaded by `loadFeedbackFile(feedbackPath, slug)` — returns `{ slug, entries: [] }` on any error
- Recent files loaded by `loadRecentFeedbacks(feedbackDir, limit)` sorted by mtime

**FIFO eviction detail:**
```typescript
export function appendWithFifoCap(entries, newEntry, cap = FEEDBACK_FIFO_CAP): FeedbackEntry[] {
  const updated = [...entries, newEntry]
  if (updated.length > cap) {
    return updated.slice(updated.length - cap)  // keeps newest
  }
  return updated
}
```

**`formatFeedbackForContext()` output format:**
```markdown
## Session Feedback Memory (Tier 1)

_Auto-loaded from .buildpact/memory/feedback/ — most recent sessions._

### Spec: {slug}
- **Last verified**: {capturedAt}
- **Outcome**: {outcome}
- **Worked**: {workedAcs joined}
- **Failed**: {failedAcs joined}
  - _{ac}_: {note}
```

**i18n keys already registered (do NOT add new keys):**
```yaml
cli.verify.feedback_saved    # "Session feedback captured to .buildpact/memory/feedback/{slug}.json"
cli.verify.lessons_distilled # "{count} pattern(s) saved to .buildpact/memory/lessons/lessons.json"
```

### verify.md Section Template

Insert this section **between** `## Fix Plan Generation` and `## Implementation Notes`:

```markdown
## Session Feedback — Memory Tier 1

After each `/bp:verify` run, structured feedback is automatically captured to
`.buildpact/memory/feedback/{slug}.json`. No configuration required.

### Feedback Entry Structure

Each entry records: `slug`, `outcome` (`passed`/`failed`/`partial`), `workedAcs`,
`failedAcs` (with per-AC fail notes), and a `capturedAt` ISO timestamp.

### FIFO Cap

Entries capped at 30 per file (`FEEDBACK_FIFO_CAP`). Oldest entries evicted when
cap is exceeded. `loadRecentFeedbacks()` returns files sorted by mtime (newest last).

### Context Injection

Recent feedback is formatted as a `## Session Feedback Memory (Tier 1)` markdown
block and loaded into subagent planning context automatically.

Implementation: `buildFeedbackEntry()`, `captureSessionFeedback()`, `loadRecentFeedbacks()`
in `src/engine/session-feedback.ts`.
Types: `FeedbackEntry`, `FeedbackFile`, `SessionOutcome` (same file).
```

### verify.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base  | Header + Implementation Notes | ~7 | ~7 |
| 7.1   | Guided Acceptance Test | ~51 | ~58 |
| 7.2   | Fix Plan Generation | ~28 | ~86 (actual) |
| **7.3** | **Session Feedback — Memory Tier 1** | **~23** | **~109** |
| 7.4 | Lessons & Patterns (next) | ~25 | ~134 |
| 7.5 | Decisions Log (next) | ~21 | ~155 |

Target: ≤ 300 lines. Budget: ~145 lines remaining after 7.3.

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `session-feedback.ts` — pre-built and complete
- ❌ Do NOT import from `src/commands/` inside `src/engine/` — layer violation
- ❌ Do NOT add new i18n keys — `cli.verify.feedback_saved` is already registered
- ❌ Do NOT change the limit from 50 to 5 in `loadRecentFeedbacks(feedbackDir, 50)` in handler.ts — this passes full history to lessons distiller (Tier 2), not just 5
- ❌ Do NOT use mutable patterns in `appendWithFifoCap` — must return new array
- ❌ Do NOT remove the `## Implementation Notes` block from verify.md — required by Markdown orchestrator standard

### Previous Story Intelligence (Stories 7.1 and 7.2)

- **Pre-built pattern is the same:** Implementation already exists; primary task is the Markdown orchestrator section
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Result<T> pattern:** `ok(undefined)` on success, `err({ code: ... })` on failure — never `throw`
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` pattern used in all I/O tests — do NOT change test patterns
- **Lesson from 7.2:** The section content must match the actual implementation exactly — read source before writing verify.md section

### Coverage Expectations

- `src/engine/session-feedback.ts` pure functions (`deriveOutcome`, `buildFeedbackEntry`, `appendWithFifoCap`, `formatFeedbackForContext`): high coverage via unit tests
- I/O functions (`loadFeedbackFile`, `writeFeedbackFile`, `loadRecentFeedbacks`, `captureSessionFeedback`): integration tested with real temp dirs
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | readFile, mkdir, writeFile, readdir, stat for feedback I/O |
| `node:path` | built-in | join for path construction |
| `node:os` | built-in | mkdtemp for test temp dirs |

### Project Structure Notes

`session-feedback.ts` is in `src/engine/` per architecture layer rules — it is a domain function called by commands layer, not the other way around. Feedback files use per-slug naming: `{slug}.json`. The `loadRecentFeedbacks()` function sorts by `stat().mtimeMs` (not filename) to correctly handle any slug naming. The handler passes `50` as the limit to `loadRecentFeedbacks()` for lessons distillation — this is intentional to maximize pattern detection across sessions.

### References

- [Source: epics.md#Epic7-Story7.3] — User story, AC
- [Source: architecture.md#FR-803] — Memory Layer Tier 1 (Feedback Files)
- [Source: architecture.md#FR-804] — Memory Layer free in open-source core
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← commands/`
- [Source: architecture.md#cross-cutting-concerns #5] — State Persistence: File-as-DB, FIFO eviction max 30
- [Source: architecture.md#markdown-orchestrator-header] — Header comment + `## Implementation Notes` required
- [Source: src/engine/session-feedback.ts] — Full implementation: 4 pure + 4 I/O + 2 constants
- [Source: test/unit/engine/session-feedback.test.ts] — 8 describe blocks, 363 LOC
- [Source: src/commands/verify/handler.ts] — Integration: captureSessionFeedback + loadRecentFeedbacks calls
- [Source: locales/en.yaml#cli.verify.feedback_saved] — i18n key (already registered)
- [Source: templates/commands/verify.md] — Current state after Story 7.2 (86 lines)
- [Source: 7-2-automatic-fix-plan-generation.md] — Pre-built pattern: same approach

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `## Session Feedback — Memory Tier 1` section to `templates/commands/verify.md` (inserted between `## Fix Plan Generation` and `## Implementation Notes`)
- Verified `src/engine/session-feedback.ts` (239 LOC): 4 pure functions + 4 I/O functions + 2 constants — all confirmed complete and matching spec
- Verified `test/unit/engine/session-feedback.test.ts` (363 LOC): 8 describe blocks covering all exported functions — all confirmed present
- Confirmed handler.ts integration: `captureSessionFeedback` + `loadRecentFeedbacks(feedbackDir, 50)` in place
- All 1723 tests pass (68 test files), zero regressions
- verify.md: 109 lines (≤ 300 budget satisfied)

### File List

- `templates/commands/verify.md` — Added `## Session Feedback — Memory Tier 1` section (23 lines)

## Change Log

- 2026-03-19: Story implemented — added `## Session Feedback — Memory Tier 1` section to `templates/commands/verify.md`; verified pre-built `session-feedback.ts` and test coverage; all 1723 tests pass. Status → review.
