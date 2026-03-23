# Story 7.5: Memory Layer Tier 3 — Decisions Log

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tech lead who needs architectural decisions captured permanently,
I want the framework to save key architectural and implementation decisions to a decisions log,
so that any future agent session can understand WHY the system was built a certain way.

## Acceptance Criteria

**AC-1: Decision Entries Persisted to Decisions Directory**

Given I call `captureDecision(projectDir, input)` with a decision title, decision text, rationale, and alternatives
When the function executes
Then a JSON file is written to `.buildpact/memory/decisions/{id}.json`
And the `id` is derived by slugifying the title (lowercase, hyphens, trimmed, max 60 chars)
And the entry captures: id, title, decision, rationale, alternatives (array), and date (YYYY-MM-DD)

**AC-2: All Decisions Loadable Sorted by Date**

Given one or more decision files exist in `.buildpact/memory/decisions/`
When `loadAllDecisions(decisionsDir)` is called
Then it returns all valid DecisionEntry objects sorted by date ascending (oldest first)
And any files with invalid JSON are silently skipped
And an empty array is returned if the directory does not exist

**AC-3: Decisions Formatted for Context Injection**

Given decision entries exist
When `formatDecisionsForContext(entries)` is called
Then it returns a `## Decisions Log Memory (Tier 3)` markdown block
And each entry shows title, date, decision, rationale, and alternatives (when present)
And it returns an empty string for an empty entries array

**AC-4: Decisions Log Section Documented in verify.md**

Given the `## Decisions Log — Memory Tier 3` section exists in `templates/commands/verify.md`
When I open the orchestrator template
Then it documents the purpose, DecisionEntry structure, output path, loading API, and usage
And the cumulative verify.md line count remains ≤ 300

## Tasks / Subtasks

- [x] Task 1: Add `## Decisions Log — Memory Tier 3` section to `templates/commands/verify.md` (AC: #1, #2, #3, #4)
  - [x] 1.1: Insert new section between `## Lessons & Patterns — Memory Tier 2` and `## Implementation Notes`
  - [x] 1.2: Document purpose: permanent storage of architectural decisions for future agent reference
  - [x] 1.3: Document DecisionEntry structure: id (slugified title), title, decision, rationale, alternatives, date (YYYY-MM-DD)
  - [x] 1.4: Document output: `.buildpact/memory/decisions/{id}.json` (one file per decision)
  - [x] 1.5: Document `loadAllDecisions()`: returns entries sorted by date ascending
  - [x] 1.6: Document `captureDecision()`: call from any pipeline phase to persist an architectural decision
  - [x] 1.7: Verify cumulative verify.md line count ≤ 300 (actual: 158 lines)

- [x] Task 2: Verify `src/engine/decisions-log.ts` (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `slugifyTitle(title): string` — lowercase, replace non-alphanum with hyphens, trim leading/trailing hyphens, truncate to 60, handles empty string
  - [x] 2.2: Confirm `buildDecisionEntry(input: DecisionInput): DecisionEntry` — id=slugifyTitle(title), date=new Date().toISOString().slice(0,10), all fields from input
  - [x] 2.3: Confirm `formatDecisionsForContext(entries: DecisionEntry[]): string` — returns '' for empty, `## Decisions Log Memory (Tier 3)` header, per-entry sections with title/date/decision/rationale/alternatives (omit alternatives line when empty)
  - [x] 2.4: Confirm `writeDecisionFile(decisionsDir, entry): Promise<Result<string>>` — `mkdir({ recursive: true })`, writes `{entry.id}.json` with `{ slug: entry.id, entry }` structure
  - [x] 2.5: Confirm `loadAllDecisions(decisionsDir): Promise<DecisionEntry[]>` — reads all `.json` files, parses as `DecisionFile` (`{ slug, entry }`), extracts `.entry`, skips nulls, sorts by date ascending
  - [x] 2.6: Confirm `captureDecision(projectDir, input): Promise<Result<string>>` — builds entry, writes to `join(projectDir, '.buildpact', 'memory', 'decisions')`
  - [x] 2.7: Confirm error handling: `writeDecisionFile` returns `err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.decisions.write_failed', params: { id: entry.id } })` on failure

- [x] Task 3: Verify `test/unit/engine/decisions-log.test.ts` covers all functions (DO NOT recreate — read-only check)
  - [x] 3.1: `slugifyTitle` — lowercase/hyphens, trim leading/trailing, collapse consecutive non-alphanum, truncate to 60, empty string → ''
  - [x] 3.2: `buildDecisionEntry` — all fields set, date is YYYY-MM-DD, id=slugifyTitle(title), handles empty alternatives
  - [x] 3.3: `formatDecisionsForContext` — empty→'', Tier 3 header, decision/rationale/date included, alternatives shown when present/omitted when empty, multiple decisions rendered
  - [x] 3.4: `writeDecisionFile` — returns ok(path) containing `{id}.json`, creates missing directories
  - [x] 3.5: `loadAllDecisions` — missing dir→[], empty dir→[], loads written decisions, multiple sorted by date asc
  - [x] 3.6: `captureDecision` — persists to `.buildpact/memory/decisions/`, loadable back via `loadAllDecisions()`

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — 1723 tests, 68 files, all pass
  - [x] 4.2: Verify cumulative verify.md ≤ 300 lines (actual: 158 lines)

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/engine/decisions-log.ts` | ✅ Complete | 183 LOC — 3 pure functions + 3 I/O functions, no constants |
| `test/unit/engine/decisions-log.test.ts` | ✅ Complete | 248 LOC — 6 describe blocks covering all exported functions |

**The PRIMARY task is Task 1: add `## Decisions Log — Memory Tier 3` section to `templates/commands/verify.md`.**

**Important difference from Tiers 1 & 2:** `decisions-log.ts` is NOT auto-called by `verify/handler.ts`. It is a standalone engine module. The Decisions Log is intended to be called programmatically from any pipeline phase (or future commands). The verify.md section documents the API for agent use.

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

`decisions-log.ts` is in `src/engine/` — importable from any commands layer or future CLI command.
Do NOT add imports from `src/commands/` inside `src/engine/` — layer violation.

**FR mapping:** `FR-806` (implied by FR-803 Tier 3) → Decisions Log permanent storage

**Types exported from `src/engine/decisions-log.ts`:**
```typescript
export interface DecisionEntry { id; title; decision; rationale; alternatives; date }
export interface DecisionFile { slug; entry: DecisionEntry }
export interface DecisionInput { title; decision; rationale; alternatives }
```

**I/O paths:**
```
.buildpact/memory/decisions/{id}.json   ← one JSON file per decision (id = slugified title)
```
- Written by `captureDecision(projectDir, input)` or `writeDecisionFile(decisionsDir, entry)`
- Loaded by `loadAllDecisions(decisionsDir)` — skips invalid files silently, sorts by date ascending
- Each file structure: `{ "slug": "{id}", "entry": { ...DecisionEntry } }`

**Key implementation details:**
```typescript
// buildDecisionEntry — date format:
date: new Date().toISOString().slice(0, 10)  // "2026-03-19" — not full ISO timestamp

// loadAllDecisions — skips invalid JSON silently:
const parsed = JSON.parse(raw) as DecisionFile
return parsed.entry  // returns null on parse failure, filtered out
```

**`formatDecisionsForContext()` output format:**
```markdown
## Decisions Log Memory (Tier 3)

_Key architectural decisions — loaded from .buildpact/memory/decisions/_

### Decision: {title}
- **Date**: {date}
- **Decision**: {decision}
- **Rationale**: {rationale}
- **Alternatives considered**: {alt1}; {alt2}
```
Note: `**Alternatives considered**:` line is omitted when `alternatives.length === 0`.

**`captureDecision()` flow:**
```typescript
export async function captureDecision(projectDir: string, input: DecisionInput): Promise<Result<string>> {
  const entry = buildDecisionEntry(input)  // pure
  const decisionsDir = join(projectDir, '.buildpact', 'memory', 'decisions')
  return writeDecisionFile(decisionsDir, entry)  // mkdir + writeFile
}
```

**i18n key already registered (do NOT add new keys):**
```yaml
error.decisions.write_failed    # "Failed to write decision '{id}' to .buildpact/memory/decisions/"
```

### verify.md Section Template

Insert this section **between** `## Lessons & Patterns — Memory Tier 2` and `## Implementation Notes`:

```markdown
## Decisions Log — Memory Tier 3

Architectural and implementation decisions are persisted as individual JSON files
in `.buildpact/memory/decisions/` for permanent cross-session reference.

### Decision Entry Structure

Each file captures: `id` (slug from title), `title`, `decision`, `rationale`,
`alternatives` (array), and `date` (YYYY-MM-DD). Filename: `{id}.json`.

### Loading Decisions

`loadAllDecisions(decisionsDir)` returns all entries sorted by date ascending.
`formatDecisionsForContext()` produces a `## Decisions Log Memory (Tier 3)` block.

### Usage

Call `captureDecision(projectDir, input)` from any pipeline phase to persist
an architectural decision for future agent reference.

Implementation: `buildDecisionEntry()`, `captureDecision()`, `loadAllDecisions()`
in `src/engine/decisions-log.ts`.
Types: `DecisionEntry`, `DecisionFile`, `DecisionInput` (same file).
```

### verify.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base  | Header + Implementation Notes | ~7 | ~7 |
| 7.1   | Guided Acceptance Test | ~51 | ~58 |
| 7.2   | Fix Plan Generation | ~28 | ~86 |
| 7.3   | Session Feedback — Memory Tier 1 | ~23 | ~109 |
| 7.4   | Lessons & Patterns — Memory Tier 2 | ~25 | ~134 |
| **7.5** | **Decisions Log — Memory Tier 3** | **~21** | **~155** |

Target: ≤ 300 lines. Budget: ~145 lines remaining after 7.5. All Epic 7 stories fit comfortably.

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `decisions-log.ts` — pre-built and complete
- ❌ Do NOT import from `src/commands/` inside `src/engine/` — layer violation
- ❌ Do NOT add a new i18n key for decisions success message — none is needed (only error key registered)
- ❌ Do NOT use full ISO timestamp for `date` — it must be `YYYY-MM-DD` format (`.slice(0, 10)`)
- ❌ Do NOT merge all decisions into one file — each decision is stored as `{id}.json` separately (unlike lessons)
- ❌ Do NOT auto-call `captureDecision()` from the verify handler — this is intentionally manual/programmatic
- ❌ Do NOT re-export `DecisionFile` from `index.ts` unless needed externally — it is an internal persistence format
- ❌ Do NOT remove the `## Implementation Notes` block from verify.md — required by Markdown orchestrator standard

### Previous Story Intelligence (Stories 7.1–7.4)

- **Pre-built pattern is the same:** Implementation already exists; primary task is the Markdown orchestrator section
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Result<T> pattern:** `ok(filePath)` on success, `err({ code: ERROR_CODES.FILE_WRITE_FAILED, ... })` on I/O failure
- **Named exports only:** No `export default` anywhere in `src/`
- **Key difference from Tiers 1 & 2:** Decisions are NOT auto-triggered by verify — they require explicit `captureDecision()` calls from pipeline code or future commands
- **Slugify is shared:** Both `decisions-log.ts` (`slugifyTitle`) and `lessons-distiller.ts` (`slugifyAc`) use the same algorithm — lowercase, non-alphanum→hyphens, trim, max 60 chars

### Coverage Expectations

- `src/engine/decisions-log.ts` pure functions (`slugifyTitle`, `buildDecisionEntry`, `formatDecisionsForContext`): high coverage via unit tests
- I/O functions (`writeDecisionFile`, `loadAllDecisions`, `captureDecision`): integration tested with real temp dirs
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | readFile, readdir, mkdir, writeFile for decisions I/O |
| `node:path` | built-in | join for path construction |
| `node:os` | built-in | mkdtemp for test temp dirs |

### Project Structure Notes

`decisions-log.ts` is in `src/engine/` — same layer as `session-feedback.ts` and `lessons-distiller.ts`. Unlike feedback (per-slug) and lessons (single aggregated file), decisions use individual files per decision slug, making it easy to add/remove individual decisions without rewriting the entire collection. `loadAllDecisions()` reads all `.json` files via `readdir()` and sorts by date string comparison (lexicographic, works for YYYY-MM-DD format). Silent error handling: both `loadAllDecisions()` and `loadFeedbackFile()` return empty structures rather than propagating errors — this is intentional to make context loading fault-tolerant.

### References

- [Source: epics.md#Epic7-Story7.5] — User story, AC
- [Source: architecture.md#FR-803] — Memory Layer Tier 3 (Decisions Files, v1.0 milestone)
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← commands/`
- [Source: architecture.md#cross-cutting-concerns #5] — State Persistence: file-as-DB, no external services
- [Source: architecture.md#markdown-orchestrator-header] — Header comment + `## Implementation Notes` required
- [Source: src/engine/decisions-log.ts] — Full implementation: 3 pure + 3 I/O functions
- [Source: test/unit/engine/decisions-log.test.ts] — 6 describe blocks, 248 LOC
- [Source: locales/en.yaml#error.decisions.write_failed] — i18n error key (already registered)
- [Source: templates/commands/verify.md] — Current state after Story 7.4 (~134 lines)
- [Source: 7-4-memory-layer-tier-2-lessons-and-patterns.md] — Previous story context

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_None — pre-built pattern; no debugging required._

### Completion Notes List

- Task 1: Added `## Decisions Log — Memory Tier 3` section to `templates/commands/verify.md` (lines 129–151). Section placed between `## Lessons & Patterns — Memory Tier 2` and `## Implementation Notes`. Final line count: 158 (≤ 300 budget satisfied).
- Task 2: Read-only verification of `src/engine/decisions-log.ts` (183 LOC) — all 7 subtasks confirmed present and correct.
- Task 3: Read-only verification of `test/unit/engine/decisions-log.test.ts` (248 LOC, 6 describe blocks) — all 6 subtasks confirmed present and correct.
- Task 4: `npx vitest run` — 1723 tests, 68 files, 0 failures, 0 regressions.

### File List

- `templates/commands/verify.md` — added `## Decisions Log — Memory Tier 3` section (lines 129–151)

## Change Log

- 2026-03-19: Added `## Decisions Log — Memory Tier 3` section to `templates/commands/verify.md`. Verified pre-built `decisions-log.ts` and its tests. All 1723 tests pass.
