# Story 7.1: Guided Acceptance Test (UAT)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer who just completed an execution phase,
I want `/bp:verify` to walk me through each acceptance criterion from the spec with a structured pass/fail test,
so that I have documented proof of what works and what doesn't — not just a gut feeling.

## Acceptance Criteria

**AC-1: Spec Loaded and ACs Presented One at a Time**

Given I run `/bp:verify` after execution completes
When the verification flow begins
Then the framework loads the active `spec.md` from `.buildpact/specs/{slug}/spec.md` (or from an explicit path if provided as arg)
And for each acceptance criterion it presents: the criterion text, guidance on what to check and the expected outcome, and prompts me to mark it PASS, FAIL, or SKIP (one at a time)

**AC-2: Structured Verification Report Generated**

Given I complete the per-criterion walk-through
When the verification report is finalized
Then a structured verification report is written to `.buildpact/specs/{slug}/verification-report.md`
And the report lists all criteria with their PASS/FAIL/SKIP status, any fail notes, and summary counts (pass%, fail count, skip count)

**AC-3: Verified Spec Marked and Session Logged to Audit**

Given all acceptance criteria pass
When the verification report is finalized
Then the spec.md is marked as verified by appending a `<!-- verified: {timestamp} | pass:{n} fail:{n} skip:{n} -->` comment
And the session is logged to `.buildpact/audit/verify.log` with actions `verify.start` and `verify.complete`

## Tasks / Subtasks

- [x] Task 1: Add `## Guided Acceptance Test` section to `templates/commands/verify.md` (AC: #1, #2, #3)
  - [x] 1.1: Replace the stub content; preserve header comment and `## Implementation Notes` block
  - [x] 1.2: Document spec resolution: CLI arg path OR `findLatestSpecSlug()` scanning `.buildpact/specs/`; error if none found
  - [x] 1.3: Document AC extraction: `extractAcsFromSpec()` parses bullets (`-` or `*`) under `## Acceptance Criteria` header; stops at next `##`; strips `[ ]`/`[x]` prefixes
  - [x] 1.4: Document per-AC interactive flow: `buildAcGuidance()` keyword heuristics (test/typecheck/lint/file/command/error/audit/default), clack.select PASS/FAIL/SKIP, optional fail-note prompt on FAIL
  - [x] 1.5: Document report generation: `formatUatReport()` → markdown table at `.buildpact/specs/{slug}/verification-report.md`
  - [x] 1.6: Document spec verified marker: appends `<!-- verified: ... -->` comment to spec.md when finalized
  - [x] 1.7: Document audit logging: `verify.start` and `verify.complete` events to `.buildpact/audit/verify.log` (JSON Lines via AuditLogger)
  - [x] 1.8: Verify cumulative verify.md line count ≤300

- [x] Task 2: Verify `src/commands/verify/handler.ts` meets AC #1, #2, #3 (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `extractAcsFromSpec(specContent: string): string[]` — parses bullets under `## Acceptance Criteria`, stops at next `##`, strips `[x]`/`[ ]` prefixes
  - [x] 2.2: Confirm `buildAcGuidance(ac: string): string` — keyword heuristics return appropriate guidance; fallback is 'Manually verify...'
  - [x] 2.3: Confirm `formatUatReport(report: UatReport): string` — markdown table with `✅ PASS`, `❌ FAIL`, `⏭️ SKIP`, summary counts, `VERIFIED` vs `NOT VERIFIED` based on `allPassed`
  - [x] 2.4: Confirm `findLatestSpecSlug(projectDir: string): Promise<string | undefined>` — reads `.buildpact/specs/`, returns last alphabetical entry (newest), undefined if empty/missing
  - [x] 2.5: Confirm `handler.run()` flow: reads config for language → reads spec via arg or `findLatestSpecSlug()` → `extractAcsFromSpec()` → interactive loop with clack.select → builds `UatReport` → `formatUatReport()` → writes to `verification-report.md` → appends verified marker to spec.md → logs `verify.complete`
  - [x] 2.6: Confirm audit log path: `join(projectDir, '.buildpact', 'audit', 'verify.log')` — uses `AuditLogger` from `src/foundation/audit.ts`
  - [x] 2.7: Confirm `AcStatus`, `AcVerificationEntry`, `UatReport` types are exported from `handler.ts` and re-exported from `index.ts`
  - [x] 2.8: Confirm `handler.run()` returns `ok(undefined)` on success, `err({ code: ERROR_CODES.SPEC_NOT_FOUND })` when spec or ACs missing

- [x] Task 3: Verify `test/unit/commands/verify.test.ts` covers AC (DO NOT recreate — read-only check)
  - [x] 3.1: `extractAcsFromSpec` — empty spec, bullet extraction, stops at next `##`, strips checkbox syntax
  - [x] 3.2: `buildAcGuidance` — test/typecheck/lint/file/command/error/default branches
  - [x] 3.3: `formatUatReport` — PASS/FAIL/SKIP icons, VERIFIED/NOT VERIFIED, fail notes, summary counts
  - [x] 3.4: `findLatestSpecSlug` — missing dir, empty dir, returns last alphabetical slug
  - [x] 3.5: `buildVerifyFixPlan` — slug in title, AGENT task per failed AC, note appended, /bp:execute instruction (Story 7.2 coverage already present)
  - [x] 3.6: `verify handler` integration — writes `verification-report.md`, marks spec verified, records fail note, returns NOT_FOUND on missing spec/ACs

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass
  - [x] 4.2: Verify verify.md ≤300 lines

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/commands/verify/handler.ts` | ✅ Complete | 409 LOC — 5 pure functions + 1 async + handler |
| `src/commands/verify/index.ts` | ✅ Complete | 8 LOC — barrel export |
| `test/unit/commands/verify.test.ts` | ✅ Complete | 444 LOC — 6 describe blocks |
| `src/engine/session-feedback.ts` | ✅ Complete | 238 LOC — Memory Tier 1 (covered in Story 7.3) |
| `src/engine/lessons-distiller.ts` | ✅ Complete | 307 LOC — Memory Tier 2 (covered in Story 7.4) |

**The PRIMARY task is Task 1: add `## Guided Acceptance Test` section to `templates/commands/verify.md`.**

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

`src/commands/verify/handler.ts` imports from:
- `@clack/prompts` — TUI interaction
- `node:fs/promises` — file I/O (readFile, mkdir, writeFile, readdir)
- `node:path` — path construction
- `src/contracts/errors.js` — Result<T>, ERROR_CODES
- `src/contracts/i18n.js` — SupportedLanguage, I18nResolver
- `src/foundation/i18n.js` — createI18n
- `src/foundation/audit.js` — AuditLogger
- `src/engine/session-feedback.js` — buildFeedbackEntry, captureSessionFeedback, loadRecentFeedbacks
- `src/engine/lessons-distiller.js` — captureDistilledLessons

Do NOT add imports from `src/commands/` in `src/engine/` — layer violation.

**FR mapping:** `FR-800` → `src/commands/verify/` + `templates/commands/verify.md`

**Key functions in `src/commands/verify/handler.ts`:**
```typescript
// Exported pure functions (unit-testable):
export function extractAcsFromSpec(specContent: string): string[]
export function formatUatReport(report: UatReport): string
export function buildAcGuidance(ac: string): string
export function buildVerifyFixPlan(failedEntries: AcVerificationEntry[], slug: string): string
export async function findLatestSpecSlug(projectDir: string): Promise<string | undefined>

// Exported types:
export type AcStatus = 'pass' | 'fail' | 'skip'
export interface AcVerificationEntry { index: number; ac: string; status: AcStatus; note?: string }
export interface UatReport { slug; specPath; verifiedAt; acResults; passCount; failCount; skipCount; allPassed }

// Command handler:
export const handler: CommandHandler = { async run(args: string[]) { ... } }
```

**Spec and output paths:**
```
.buildpact/specs/{slug}/spec.md            ← input (read)
.buildpact/specs/{slug}/verification-report.md  ← output (written)
.buildpact/specs/{slug}/fix/plan-uat.md    ← fix plan (Story 7.2 scope)
.buildpact/audit/verify.log                ← audit log (JSON Lines)
```

**Spec verified marker format (appended to spec.md):**
```
<!-- verified: 2026-03-19T10:00:00.000Z | pass:3 fail:0 skip:0 -->
```

**Audit log format (JSON Lines, append-only via AuditLogger):**
```jsonl
{"ts":"...","action":"verify.start","agent":"verify-handler","files":["path/to/spec.md"],"outcome":"success"}
{"ts":"...","action":"verify.complete","agent":"verify-handler","files":["spec.md","verification-report.md"],"outcome":"success"}
```

**AC extraction rules:**
- Parses lines starting with `-` or `*` ONLY under the `## Acceptance Criteria` section
- Stops at next `##` heading
- Strips `[ ]` and `[x]` checkbox prefixes
- Skips blank lines and headings inside AC section
- The epic uses Given/When/Then prose style, but extraction looks for bullets — spec.md should use bullet format for ACs

**`buildAcGuidance()` keyword heuristics (in order checked):**
1. `test` or `spec` → "Run the relevant tests and confirm they all pass."
2. `typecheck` or `type check` → "Run `npm run typecheck`..."
3. `lint` → "Run `npm run lint`..."
4. `file` or `creat` or `generat` → "Verify the expected file(s) exist..."
5. `command` or `cli` → "Run the command and verify..."
6. `error` or `fail` → "Trigger the error scenario..."
7. `log` or `audit` → "Check the audit log file..."
8. default → "Manually verify that the stated outcome is achieved as described."

**i18n keys for verify command (en.yaml + pt-br.yaml already implemented):**
```yaml
cli.verify.welcome      # "BuildPact Verify — Guided Acceptance Test (UAT)"
cli.verify.no_spec_found
cli.verify.spec_not_found      # {path}
cli.verify.no_acs_found
cli.verify.ac_count            # {count}, {slug}
cli.verify.ac_header           # {index}, {total}
cli.verify.ac_criterion        # {ac}
cli.verify.ac_guidance         # {guidance}
cli.verify.ac_prompt
cli.verify.verdict_pass / verdict_fail / verdict_skip
cli.verify.fail_note_prompt / fail_note_placeholder
cli.verify.cancelled
cli.verify.all_passed          # {count}
cli.verify.has_failures        # {fail}, {pass}
cli.verify.fix_plan_written    # {path}
cli.verify.report_saved        # {path}
cli.verify.feedback_saved      # {slug}
cli.verify.lessons_distilled   # {count}
```
All i18n keys are already registered in `locales/en.yaml` and `locales/pt-br.yaml`. Do NOT add new keys.

### verify.md Section Template

Add this section to `templates/commands/verify.md`, replacing the stub body (keep header comment and Implementation Notes block):

```markdown
## Guided Acceptance Test

The verify command (FR-801) loads the active spec.md and walks the developer
through each acceptance criterion one at a time with guidance on what to check.

### Spec Resolution

When run without args, discovers the latest spec from `.buildpact/specs/` by
alphabetical order of slug directories. Pass an explicit spec path as the first
argument to target a specific spec:

  /bp:verify .buildpact/specs/my-feature/spec.md

### Acceptance Criteria Extraction

Parses bullet lines (`-` or `*`) under the `## Acceptance Criteria` section.
Stops at the next `##` heading. Strips `[ ]`/`[x]` checkbox prefixes.

### Interactive Walk-Through

For each criterion, the flow is:
1. Display criterion text and keyword-matched guidance (test/typecheck/lint/file/command/error/audit/default)
2. clack.select: PASS | FAIL | SKIP
3. On FAIL: optional free-text note describing what failed
4. Repeat until all criteria are evaluated

### Verification Report

Written to `.buildpact/specs/{slug}/verification-report.md`:
- Markdown table: criterion | PASS ✅ / FAIL ❌ / SKIP ⏭️ | note
- Summary: pass%, fail count, skip count
- Overall: VERIFIED (failCount === 0 && passCount > 0) or NOT VERIFIED

### Spec Verified Marker

When finalization completes, appends to spec.md:

  <!-- verified: {ISO timestamp} | pass:{n} fail:{n} skip:{n} -->

### Audit Logging

Logs to `.buildpact/audit/verify.log` (JSON Lines, append-only):
- `verify.start` — on flow begin, references spec path
- `verify.complete` — on report written, outcome: success (all pass) or failure (any fail)

Implementation: `extractAcsFromSpec()`, `buildAcGuidance()`, `formatUatReport()`,
`findLatestSpecSlug()` in `src/commands/verify/handler.ts`.
Types: `AcStatus`, `AcVerificationEntry`, `UatReport` (same file).
```

### verify.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base  | Header + Implementation Notes | ~19 | ~19 |
| **7.1** | **Guided Acceptance Test** | **~55** | **~74** |
| 7.2 | Fix Plan Generation (next) | ~30 | ~104 |
| 7.3 | Session Feedback / Memory Tier 1 (future) | ~35 | ~139 |

Target: ≤300 lines with all stories. Budget ample (~161 lines remaining).

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `handler.ts`, `session-feedback.ts`, or `lessons-distiller.ts` — all pre-built
- ❌ Do NOT add `export default` — named exports only everywhere in `src/`
- ❌ Do NOT import from `src/commands/` inside `src/engine/` — layer dependency violation
- ❌ Do NOT use a YAML library to load locales — i18n layer uses its own loader (`createI18n`)
- ❌ Do NOT hardcode user-facing strings — all go through `i18n.t()` using the keys above
- ❌ Do NOT add new i18n keys — all verify keys are already in `locales/en.yaml` and `locales/pt-br.yaml`
- ❌ Do NOT make `AuditLogger` optional — audit logging is cross-cutting and mandatory (NFR-23)
- ❌ Do NOT remove the `## Implementation Notes` block from verify.md — required by Markdown orchestrator standard
- ❌ Do NOT use `export default` in handler.ts — `handler` is already a named export

### Previous Story Intelligence (Story 6.5 — Budget Guards)

- **Pre-built pattern is the same:** Implementation already exists; primary task is adding the Markdown orchestrator section to `templates/commands/verify.md`
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Result<T> pattern:** `ok(undefined)` on success, `err({ code: ... })` on failure — never `throw`
- **clack.isCancel():** Always check after `clack.select()` and `clack.text()` — cancellation returns `ok(undefined)`, not an error
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** Integration tests use `process.cwd = () => tmpDir` pattern and `vi.mock('@clack/prompts')` — do NOT change test patterns

### Coverage Expectations

- `src/commands/verify/handler.ts` (pure functions: `extractAcsFromSpec`, `formatUatReport`, `buildAcGuidance`, `findLatestSpecSlug`, `buildVerifyFixPlan`): 85%+ line coverage
- Integration tests (`verify handler` describe block): full flow exercised with real temp dirs
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| @clack/prompts | **^1.1.0** | TUI interaction — clack.select, clack.text, clack.intro/outro |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | readFile, mkdir, writeFile, readdir for spec/report I/O |
| `node:path` | built-in | join for path construction |
| `node:os` | built-in | mkdtemp for test temp dirs |

### Project Structure Notes

`handler.ts` is in `src/commands/verify/` per architecture spec (FR-800). `index.ts` barrel re-exports all pure functions, types, and handler. Audit log goes to `.buildpact/audit/verify.log` (not `session-{timestamp}.log` per architecture standard — verify uses a fixed log file). Spec/report paths are under `.buildpact/specs/{slug}/`.

`session-feedback.ts` and `lessons-distiller.ts` are in `src/engine/` — they are called FROM `handler.ts` but their verification is out of scope for Story 7.1. See Stories 7.3 and 7.4.

### References

- [Source: epics.md#Epic7-Story7.1] — User story, AC
- [Source: architecture.md#FR-800] — Verify+Learn: `src/commands/verify/`, `src/memory/`
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← commands/`
- [Source: architecture.md#cross-cutting-concerns #3] — Audit Logging: mandatory, JSON Lines, per-session
- [Source: architecture.md#markdown-orchestrator-header] — Header comment + `## Implementation Notes` required
- [Source: architecture.md#communication-patterns] — ESM `.js` extensions mandatory
- [Source: src/commands/verify/handler.ts] — Full implementation: 5 pure functions + handler
- [Source: src/commands/verify/index.ts] — Barrel export
- [Source: test/unit/commands/verify.test.ts] — 6 describe blocks, 444 LOC
- [Source: locales/en.yaml#cli.verify] — All i18n keys (already registered)
- [Source: templates/commands/verify.md] — Current stub (target for Guided Acceptance Test section)
- [Source: 6-5-budget-guards.md] — Pre-built pattern: same approach (doc section + read-only verification)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `## Guided Acceptance Test` section to `templates/commands/verify.md` (58 lines, well within ≤300 budget). Replaced stub body while preserving header comment and `## Implementation Notes` block.
- Read-only verified `src/commands/verify/handler.ts` (409 LOC): all 5 pure functions + handler confirmed to match AC requirements exactly.
- Read-only verified `test/unit/commands/verify.test.ts` (444 LOC): 6 describe blocks cover all pure functions and handler integration.
- Full test suite: 1723 tests across 68 files — all pass, zero regressions.

### File List

- `templates/commands/verify.md` (modified)
