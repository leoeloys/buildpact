# Story 7.2: Automatic Fix Plan Generation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer with failed verification items,
I want the framework to automatically generate a targeted fix plan for each failed criterion,
so that I can go directly from "what broke" to "how to fix it" without re-running the entire pipeline.

## Acceptance Criteria

**AC-1: Fix Plan Auto-Generated for Failed Criteria**

Given one or more acceptance criteria fail during `/bp:verify`
When the verification report is complete
Then a fix plan is automatically generated targeting only the failed criteria
And the fix plan is written to `.buildpact/specs/{slug}/fix/plan-uat.md`
And the fix plan does not re-plan the entire feature — only the failed items appear as tasks

**AC-2: Fix Plan Structure is Correct**

Given a fix plan is generated
When I open `.buildpact/specs/{slug}/fix/plan-uat.md`
Then it contains a title `# UAT Fix Plan — {slug}`
And a `## Tasks` section with one `- [ ] [AGENT] Fix: {ac text}` item per failed criterion
And fail notes (if provided) appended as `(Note: {note})` on the same task line
And a `## Key References` section with slug, failed count, and ISO timestamp

**AC-3: Fix Plan NOT Generated When All Pass**

Given all acceptance criteria pass during `/bp:verify`
When the verification report is complete
Then no fix plan file is written to `.buildpact/specs/{slug}/fix/`
And the `verify.fix_plan_written` audit event is NOT logged

**AC-4: Fix Plan Audit Event Logged**

Given a fix plan is generated
When it is written to disk
Then a `verify.fix_plan_written` event is appended to `.buildpact/audit/verify.log`
And the event references the fix plan file path

## Tasks / Subtasks

- [x] Task 1: Add `## Fix Plan Generation` section to `templates/commands/verify.md` (AC: #1, #2, #3, #4)
  - [x] 1.1: Insert new section between `## Guided Acceptance Test` and `## Implementation Notes`
  - [x] 1.2: Document trigger condition: only when `failCount > 0` — no fix plan on all-pass
  - [x] 1.3: Document fix plan structure: title, `[AGENT]` task lines, `(Note: ...)` suffix, Key References
  - [x] 1.4: Document output path: `.buildpact/specs/{slug}/fix/plan-uat.md`
  - [x] 1.5: Document re-run flow: `/bp:execute .buildpact/specs/{slug}/fix` → `/bp:verify`
  - [x] 1.6: Document audit logging: `verify.fix_plan_written` event
  - [x] 1.7: Verify cumulative verify.md line count ≤300

- [x] Task 2: Verify `src/commands/verify/handler.ts` fix plan logic (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `buildVerifyFixPlan(failedEntries: AcVerificationEntry[], slug: string): string` — correct title, `[AGENT]` tasks, Note suffix, Key References section
  - [x] 2.2: Confirm handler only calls `buildVerifyFixPlan` when `failCount > 0`
  - [x] 2.3: Confirm fix plan written to `join(reportDir, 'fix', 'plan-uat.md')` via `mkdir({ recursive: true })` + `writeFile`
  - [x] 2.4: Confirm `verify.fix_plan_written` audit event logged after writing fix plan
  - [x] 2.5: Confirm `buildVerifyFixPlan` is exported from `handler.ts` (named export, not in `index.ts` — internal to verify command)
  - [x] 2.6: Confirm `fixPlanPath` shown to user via `i18n.t('cli.verify.fix_plan_written', { path: fixPlanPath })` only when `fixPlanPath` is defined

- [x] Task 3: Verify `test/unit/commands/verify.test.ts` covers fix plan (DO NOT recreate — read-only check)
  - [x] 3.1: `buildVerifyFixPlan` describe block — slug in title, one `[AGENT]` task per failed AC, note appended, `/bp:execute` instruction, failed count in Key References, empty tasks section when no failures
  - [x] 3.2: Handler integration — writes `fix/plan-uat.md` when ACs fail with correct content
  - [x] 3.3: Handler integration — does NOT write `fix/plan-uat.md` when all ACs pass

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass
  - [x] 4.2: Verify cumulative verify.md ≤300 lines

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | Notes |
|------|--------|-------|
| `src/commands/verify/handler.ts` | ✅ Complete | 409 LOC — `buildVerifyFixPlan` already implemented |
| `src/commands/verify/index.ts` | ✅ Complete | 8 LOC — barrel export (`buildVerifyFixPlan` NOT re-exported — internal detail) |
| `test/unit/commands/verify.test.ts` | ✅ Complete | 444 LOC — `buildVerifyFixPlan` describe block (lines 242-290) + handler integration tests |

**The PRIMARY task is Task 1: add `## Fix Plan Generation` section to `templates/commands/verify.md`.**

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

Do NOT add imports from `src/commands/` in `src/engine/` — layer violation.

**FR mapping:** `FR-802` → fix plan generation within `src/commands/verify/handler.ts`

**Key function in `src/commands/verify/handler.ts`:**
```typescript
export function buildVerifyFixPlan(failedEntries: AcVerificationEntry[], slug: string): string
```

Generated fix plan output structure (verbatim from implementation):
```markdown
# UAT Fix Plan — {slug}

> Auto-generated from failed acceptance criteria.
> Run: /bp:execute .buildpact/specs/{slug}/fix

## Tasks

- [ ] [AGENT] Fix: {ac text} (Note: {note — only if note provided})

## Key References

- Spec slug: {slug}
- Failed criteria: {n}
- Generated: {ISO timestamp}
```

**Fix plan output path:**
```
.buildpact/specs/{slug}/fix/plan-uat.md
```
Created with `mkdir(fixDir, { recursive: true })` before `writeFile`.

**Handler flow for fix plan (in `handler.run()`):**
```typescript
if (failCount > 0) {
  const failedEntries = acResults.filter(r => r.status === 'fail')
  const fixPlanContent = buildVerifyFixPlan(failedEntries, slug)
  const fixDir = join(reportDir, 'fix')
  await mkdir(fixDir, { recursive: true })
  fixPlanPath = join(fixDir, 'plan-uat.md')
  await writeFile(fixPlanPath, fixPlanContent, 'utf-8')
  await audit.log({ action: 'verify.fix_plan_written', ... })
}
```

**Audit event format:**
```jsonl
{"ts":"...","action":"verify.fix_plan_written","agent":"verify-handler","files":["path/to/fix/plan-uat.md"],"outcome":"success"}
```

**i18n key (already registered in locales/en.yaml and pt-br.yaml — do NOT add new keys):**
```yaml
cli.verify.fix_plan_written    # {path} — shown to user after fix plan is written
```

### verify.md Section Template

Insert this section **between** `## Guided Acceptance Test` and `## Implementation Notes`:

```markdown
## Fix Plan Generation

When one or more acceptance criteria fail, a targeted fix plan is automatically
written to `.buildpact/specs/{slug}/fix/plan-uat.md`. No fix plan is created
when all criteria pass.

### Fix Plan Structure

The generated file contains:
- Title: `# UAT Fix Plan — {slug}`
- One `- [ ] [AGENT] Fix: {ac text}` task per failed criterion
- `(Note: {note})` appended when a fail note was provided
- `## Key References` with slug, failed count, and ISO timestamp

### Re-Run Flow

After the fix plan is generated:
1. Run `/bp:execute .buildpact/specs/{slug}/fix` to fix only the failed items
2. Run `/bp:verify` to confirm all criteria now pass

### Audit Logging

Logs `verify.fix_plan_written` to `.buildpact/audit/verify.log` after writing.

Implementation: `buildVerifyFixPlan()` in `src/commands/verify/handler.ts`.
Types: `AcVerificationEntry` (same file).
```

### verify.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base  | Header + Implementation Notes | ~19 | ~19 |
| 7.1   | Guided Acceptance Test | ~39 | ~58 (actual) |
| **7.2** | **Fix Plan Generation** | **~30** | **~88** |
| 7.3 | Session Feedback / Memory Tier 1 (future) | ~35 | ~123 |

Target: ≤300 lines with all stories. Budget ample (~177 lines remaining after 7.2).

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `buildVerifyFixPlan` or any part of `handler.ts` — pre-built
- ❌ Do NOT add `export default` — named exports only everywhere in `src/`
- ❌ Do NOT add new i18n keys — `cli.verify.fix_plan_written` is already registered
- ❌ Do NOT make the fix plan conditional on anything other than `failCount > 0`
- ❌ Do NOT remove the `## Implementation Notes` block from verify.md — required by Markdown orchestrator standard
- ❌ Do NOT re-export `buildVerifyFixPlan` from `index.ts` — it is intentionally internal to the verify command
- ❌ Do NOT modify test files — 7 tests covering buildVerifyFixPlan already pass
- ❌ Do NOT change audit log path — verify uses `.buildpact/audit/verify.log` (fixed file, not session-{timestamp}.log)

### Previous Story Intelligence (Story 7.1 — Guided Acceptance Test)

Same pre-built pattern applies:
- **Primary task is documentation, not implementation** — the TypeScript is already complete
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Result<T> pattern:** `ok(undefined)` on success, `err({ code: ... })` on failure — never `throw`
- **clack.isCancel():** Always check after interactive prompts — cancellation is not an error
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** Integration tests use `process.cwd = () => tmpDir` + `vi.mock('@clack/prompts')` — do NOT change test patterns
- **Lesson from 7.1:** The section content should match the actual implementation exactly — read `buildVerifyFixPlan` in handler.ts to confirm the fix plan format before writing the verify.md section

### Coverage Expectations

- `buildVerifyFixPlan` (pure function): 7 unit tests covering: slug in title, one [AGENT] per failed AC, note appended, /bp:execute instruction, failed count, empty tasks section when no failures, key references
- Handler integration: writes fix plan on failures, does NOT write on all-pass
- Global project threshold: 70% (architecture.md#coverage-thresholds)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | mkdir (recursive), writeFile for fix plan output |
| `node:path` | built-in | join for path construction |
| `node:os` | built-in | mkdtemp for test temp dirs |

### Project Structure Notes

Fix plan output is under `.buildpact/specs/{slug}/fix/plan-uat.md` — the `fix/` subdirectory is created on demand with `mkdir({ recursive: true })`. The `reportDir` is `join(projectDir, '.buildpact', 'specs', slug)` (established in Story 7.1 for the verification-report.md). The fix plan path is `join(reportDir, 'fix', 'plan-uat.md')`.

`buildVerifyFixPlan` is exported from `handler.ts` as a named export for unit testing. It is NOT re-exported from `index.ts` because it is an internal implementation detail of the verify command, not part of the public command API.

### References

- [Source: epics.md#Epic7-Story7.2] — User story, AC
- [Source: architecture.md#FR-802] — Automatic Fix Plan Generation
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← commands/`
- [Source: architecture.md#cross-cutting-concerns #3] — Audit Logging: mandatory, JSON Lines
- [Source: architecture.md#markdown-orchestrator-header] — Header comment + `## Implementation Notes` required
- [Source: architecture.md#communication-patterns] — ESM `.js` extensions mandatory
- [Source: src/commands/verify/handler.ts] — `buildVerifyFixPlan` implementation + handler fix plan flow
- [Source: src/commands/verify/index.ts] — Barrel export (buildVerifyFixPlan NOT re-exported)
- [Source: test/unit/commands/verify.test.ts#buildVerifyFixPlan] — 7 unit tests (lines 242-290)
- [Source: test/unit/commands/verify.test.ts#handler-integration] — writes/skips fix plan (lines 398-443)
- [Source: locales/en.yaml#cli.verify.fix_plan_written] — i18n key (already registered)
- [Source: templates/commands/verify.md] — Current state after Story 7.1 (58 lines)
- [Source: 7-1-guided-acceptance-test.md] — Pre-built pattern: same approach (doc section + read-only verification)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues encountered. Pre-built implementation verified as complete; primary work was documentation.

### Completion Notes List

- Added `## Fix Plan Generation` section to `templates/commands/verify.md` (lines 53-78) between `## Guided Acceptance Test` and `## Implementation Notes`. Final file: 86 lines (≤300 budget satisfied).
- Verified `buildVerifyFixPlan` in `handler.ts` (line 164): correct title, `[AGENT]` task lines, `(Note: ...)` suffix, `## Key References` section. Handler calls it only when `failCount > 0`. Fix plan written to `join(reportDir, 'fix', 'plan-uat.md')` with `mkdir({ recursive: true })`. `verify.fix_plan_written` audit event logged. Named export, not re-exported from `index.ts`. `fixPlanPath` shown to user via i18n only when defined.
- Verified `test/unit/commands/verify.test.ts`: 7-test `buildVerifyFixPlan` describe block (lines 242-290) + 2 handler integration tests (lines 398-443) covering write-on-fail and no-write-on-all-pass.
- Full test suite: 1723 tests passed, 68 files, zero regressions.

### File List

- `templates/commands/verify.md` — modified (added `## Fix Plan Generation` section)

## Change Log

- 2026-03-19: Added `## Fix Plan Generation` section to `templates/commands/verify.md`. All pre-built TypeScript implementation verified complete. Full test suite: 1723 tests passing, zero regressions.
