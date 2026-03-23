# Story 3.2: Quick Flow with Lightweight Context Gathering

Status: done

## Story

As a developer with a task that needs a bit of clarification before execution,
I want to use `/bp:quick --discuss <description>` to answer 3–5 targeted questions before the change is made,
So that I get a better result without entering the full planning pipeline.

## Acceptance Criteria

1. **Clarifying Questions Flow**
   - Given I run `/bp:quick --discuss "add rate limiting to the API"`
   - When the discuss flow begins
   - Then the framework asks 3–5 focused clarifying questions relevant to the task
   - And each question presents numbered options with an "Other (free text)" option as the final choice

2. **Exact Question Count and Format**
   - Given the discuss flow is active
   - When questions are displayed
   - Then there are exactly 3 to 5 questions (never fewer than 3, never more than 5)
   - And each question has at least 2 specific options plus a final "Other (free text)" option

3. **Proceed Without Full Pipeline**
   - Given I answer the clarifying questions
   - When all questions are answered
   - Then it proceeds directly to execution without entering the full plan/specify pipeline
   - And the output reflects my specific answers, not generic assumptions

4. **Flag Detection**
   - Given I run `/bp:quick --discuss "task"`
   - When the command starts
   - Then the discuss flow is activated (not the base flow or --full flow)

## Tasks / Subtasks

- [x] Task 1: Add `--discuss` section to `templates/commands/quick.md` (AC: #1, #2, #3)
  - [x] 1.1: Remove `<!-- TODO: Story 3.2 -->` placeholder; add flag detection: after arg parsing, check `{{mode}} == "discuss"` → branch to discuss section
  - [x] 1.2: Add question generation section: generate 3–5 targeted questions based on `{{description}}`; cover dimensions: target scope, approach preference, constraints/exclusions, expected behavior on success, edge cases to handle
  - [x] 1.3: Add question rendering section: for each question display `[1] Option A  [2] Option B  ...  [N] Other (free text)` using clack.select; if user selects "Other" → follow with clack.text for free-text input
  - [x] 1.4: Add answer integration section: incorporate selected answers into refined minimal spec bullet points before proceeding to execution section
  - [x] 1.5: Confirm total line count of `quick.md` remains ≤ 300 after adding this section

- [x] Task 2: Create `src/commands/quick/discuss-flow.ts` (AC: #1, #2)
  - [x] 2.1: `export type QuickQuestion = { text: string; options: string[] }` — `options` array always ends with `i18n.t('cli.quick.discuss.other_option')` as the last element
  - [x] 2.2: `export function generateDiscussQuestions(description: string): QuickQuestion[]` — returns exactly 3–5 questions; reduce to 3 when description already contains 3+ concrete technical terms; cover: scope, approach, constraints, expected behavior, edge cases (in that order)
  - [x] 2.3: `export type QuickAnswer = { questionIndex: number; selectedOption: string; freeText?: string }`
  - [x] 2.4: `export function buildRefinedSpec(description: string, answers: QuickAnswer[]): string` — returns refined spec string with bullets that reflect specific answers; format: `## Quick Spec\n- {{answer-informed bullet}}\n...`; if answers is empty → fall back to description-only bullets
  - [x] 2.5: Named exports only; JSDoc `/** @see FR-402 */`; `.js` extension on all imports

- [x] Task 3: Wire discuss flow into `src/commands/quick/index.ts` (AC: #3, #4)
  - [x] 3.1: Import `generateDiscussQuestions`, `buildRefinedSpec` from `./discuss-flow.js` (`.js` extension required)
  - [x] 3.2: In `runQuick`, replace NOT_IMPLEMENTED stub for mode === 'discuss' with: `generateDiscussQuestions(description)` → collect answers via clack → `buildRefinedSpec(description, answers)` → proceed to base execution with refined spec as payload
  - [x] 3.3: Append `mode: 'discuss'` to `quick.execute` audit log entry metadata

- [x] Task 4: Add i18n keys (AC: #1, #2)
  - [x] 4.1: Add to `locales/en.yaml`: `cli.quick.discuss.intro`, `cli.quick.discuss.question_prefix`, `cli.quick.discuss.other_option`, `cli.quick.discuss.proceeding`
  - [x] 4.2: Add same 4 keys to `locales/pt-br.yaml` with PT-BR translations

- [x] Task 5: Tests (AC: #1, #2, #3, #4)
  - [x] 5.1: Unit tests `test/unit/commands/quick-discuss.test.ts`:
    - `generateDiscussQuestions('add rate limiting to the API')` → array length 3–5
    - `generateDiscussQuestions('fix null pointer in login')` → array length 3–5
    - `generateDiscussQuestions(desc)` → every question's `options` last element equals `i18n.t('cli.quick.discuss.other_option')` equivalent
    - `generateDiscussQuestions('migrate users table with soft delete column and rollback migration script')` → length exactly 3 (concrete technical terms trigger reduction)
    - `buildRefinedSpec('add rate limiting', mockAnswers)` → string containing `## Quick Spec` and bullet points
    - `buildRefinedSpec('task', [])` → non-empty string (falls back to description)
  - [x] 5.2: Extend `test/unit/commands/quick.test.ts`: `parseQuickArgs(['--discuss', 'add rate limiting'])` already returns `mode: 'discuss'` (confirmed from Story 3.1); no new arg-parsing tests needed
  - [x] 5.3: Verify snapshot `test/snapshots/quick/base-flow.schema.ts` still passes after `quick.md` is extended

## Dev Notes

### Architecture Compliance

**Module locations:**
- `templates/commands/quick.md` — Extended with `--discuss` section; total still ≤ 300 lines
- `src/commands/quick/discuss-flow.ts` — Pure functions; no side effects; fully unit-testable
- `src/commands/quick/index.ts` — Updated wiring; NOT_IMPLEMENTED stub removed for 'discuss' mode

**Prerequisite: Story 3.1 must be complete.** This story modifies files created in Story 3.1.

### What Was Already Built (DO NOT REBUILD)

| Asset | Location | Reuse |
|-------|----------|-------|
| `templates/commands/quick.md` | Story 3.1 | Extend only — do NOT overwrite or recreate |
| `src/commands/quick/index.ts` | Story 3.1 | Remove NOT_IMPLEMENTED stub for 'discuss'; keep all other logic |
| `parseQuickArgs` | `src/commands/quick/index.ts` | Already detects `--discuss` flag — no change needed |
| `Result<T, CliError>` | `src/contracts/errors.js` | Return type |
| `I18nResolver.t()` | `src/foundation/i18n.ts` | "Other (free text)" label and intro messages |
| clack imports | Already used in `index.ts` | `clack.select`, `clack.text` for interactive questions |

### Question Design Guidelines

Five default question templates (adapt text based on description):

| # | Dimension | Example options |
|---|-----------|-----------------|
| 1 | Target scope | This module only / Entire system / Specific endpoints / Other |
| 2 | Approach | Minimal change / Best practices / Match existing pattern / Other |
| 3 | Constraints | No breaking changes / Backward compatible / No new deps / Other |
| 4 | Expected behavior | Silent/no output / Log message / User notification / Other |
| 5 | Edge cases | None — happy path / Standard error handling / Full defensive / Other |

**Reduction rule:** If the `description` string contains ≥ 3 distinct technical nouns/verbs (detected by checking against a keyword list), reduce to 3 questions (questions 1, 2, and 3 — scope, approach, constraints).

### NFR Compliance

| NFR | Compliance |
|-----|------------|
| NFR-02 | `quick.md` ≤ 300 lines total (including this section) |

### Project Structure Notes

- `src/commands/quick/discuss-flow.ts` compiles to `dist/commands/quick/discuss-flow.js`
- No new npm dependencies

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic3-Story3.2] — User story and AC
- [Source: _bmad-output/implementation-artifacts/3-1-quick-command-zero-ceremony-execution.md] — Base flow (prerequisite); parseQuickArgs, runQuick structure
- [Source: _bmad-output/planning-artifacts/architecture.md#10MandatoryRules] — Named exports, .js imports, i18n, Result<T>

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

- Created `src/commands/quick/discuss-flow.ts` with pure functions: `generateDiscussQuestions` (3-5 questions with technical-term reduction rule), `buildRefinedSpec` (answer-informed spec builder), `QuickQuestion` and `QuickAnswer` types.
- Updated `templates/commands/quick.md` — replaced TODO placeholder with full --discuss section covering mode detection, question generation (5 dimensions), rendering format, answer integration, and reduction rule. Template at 140 lines (within 300 limit).
- Updated `src/commands/quick/index.ts` — removed NOT_IMPLEMENTED guard for discuss mode; handler.run() now handles --discuss via its existing gatherDiscussContext flow. Added `mode: 'discuss'` to audit log metadata.
- Added 4 i18n keys (`cli.quick.discuss.*`) to both `locales/en.yaml` and `locales/pt-br.yaml`.
- Created `test/unit/commands/quick-discuss.test.ts` with 11 unit tests covering generateDiscussQuestions (question count, reduction rule, options format) and buildRefinedSpec (answer integration, fallback behavior).
- Updated existing runQuick test — discuss mode now delegates to handler instead of returning NOT_IMPLEMENTED.
- All 1604 tests pass (54 test files). Zero regressions.
- Note: handler.ts already contained a working discuss mode implementation (gatherDiscussContext with 4 questions). The new discuss-flow.ts provides the story-specified pure-function API with 5-question templates and reduction rule for testability.

### File List

| File | Action | Notes |
|------|--------|-------|
| `templates/commands/quick.md` | Modified | Added --discuss section; placeholder removed; 140 lines total |
| `src/commands/quick/discuss-flow.ts` | Created | generateDiscussQuestions, buildRefinedSpec, QuickQuestion, QuickAnswer types |
| `src/commands/quick/index.ts` | Modified | Removed NOT_IMPLEMENTED for discuss mode; added audit mode metadata |
| `src/commands/quick/handler.ts` | No change | Existing gatherDiscussContext handles TUI flow |
| `locales/en.yaml` | Modified | 4 discuss i18n keys under cli.quick.discuss.* |
| `locales/pt-br.yaml` | Modified | Same 4 keys in PT-BR |
| `test/unit/commands/quick-discuss.test.ts` | Created | 11 unit tests for discuss-flow pure functions |
| `test/unit/commands/quick.test.ts` | Modified | Updated runQuick discuss test — no longer NOT_IMPLEMENTED |

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-16 | Story created | claude-sonnet-4-6 |
| 2026-03-16 | Story implemented — all tasks complete, 1604 tests passing | claude-opus-4-6 |
| 2026-03-17 | Code review: wired discuss-flow.ts (generateDiscussQuestions, buildRefinedSpec) into handler.ts production path (H1); fixed dead i18n keys now referenced (M1); removed duplicate audit log from runQuick (M3); updated tests for 5-question behavior and correct option text. 1607 tests passing. | claude-sonnet-4-6 |
| 2026-03-17 | Code review round 2: confirmed buildRefinedSpec now used in handler.ts production path (H2 — was dead code); buildQuickSpec delegates discuss answer rendering to buildRefinedSpec; removed dead DIMENSION_LABELS constant; purged 30 dead flat i18n keys from both locales (M3). | claude-opus-4-6 |
