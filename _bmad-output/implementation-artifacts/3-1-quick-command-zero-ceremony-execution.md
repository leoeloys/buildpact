# Story 3.1: Quick Command — Zero-Ceremony Execution

Status: done

## Story

As a developer with a small, well-defined task,
I want to run `/bp:quick <description>` and go directly from natural language to a committed change,
So that I can fix bugs and make small improvements in under 5 minutes without going through the full planning pipeline.

## Acceptance Criteria

1. **Zero-Ceremony Execution**
   - Given I run `/bp:quick "fix the null pointer in user login"`
   - When the command executes
   - Then the framework generates a minimal spec, executes the change, and produces exactly one atomic Git commit
   - And the entire flow completes in under 5 minutes

2. **Constitution Validation in Quick Mode**
   - Given the quick command executes
   - When Constitution validation runs
   - Then the Constitution is validated even in quick mode
   - And if a violation is detected, the user is warned with a confirm/abort prompt before execution proceeds

3. **Atomic Commit with Type Inference**
   - Given the quick command executes successfully
   - When I review the Git history
   - Then there is exactly one new commit with the format `type(quick): description`
   - And the type is inferred from description keywords: fix/feat/chore

4. **Missing Description Error**
   - Given I run `/bp:quick` with no description
   - When the command starts
   - Then it immediately exits with a clear error using key `cli.quick.no_description`

## Tasks / Subtasks

- [x] Task 1: Create `templates/commands/quick.md` orchestrator — base flow (AC: #1, #2, #3, #4)
  - [x] 1.1: Add orchestrator header `<!-- ORCHESTRATOR: quick | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->`
  - [x] 1.2: Add description parsing section: read `{{description}}` from args; if empty → emit `cli.quick.no_description` error and halt
  - [x] 1.3: Add minimal spec generation section: produce 3–5 bullet summary of the planned change inline (no subagent call; ~100 tokens max); format as `## Quick Spec\n- {{bullet}}\n...`
  - [x] 1.4: Add Constitution validation section: call `enforceConstitution(projectDir)` from `src/engine/constitution-enforcer.ts`; if violations detected → display warning via clack.log.warn + prompt `cli.quick.confirm_violation` with options [1] Continue [2] Abort; abort halts; continue proceeds
  - [x] 1.5: Add execution section: dispatch isolated subagent (FR-302 pattern from Story 1.3) with payload = minimal spec + `.buildpact/project-context.md`; subagent MUST have a clean context window with no accumulated orchestrator history
  - [x] 1.6: Add atomic commit section: infer commit type from description keywords (fix/feat/chore — see Dev Notes); create commit `{{type}}(quick): {{description}}`; log `cli.quick.commit_created`
  - [x] 1.7: Add `## Implementation Notes` section for TypeScript wrapper: list context variables (`{{description}}`, `{{mode}}`), audit log action `quick.execute`, output: one git commit

- [x] Task 2: Create `src/commands/quick/index.ts` TypeScript wrapper (AC: #1, #4)
  - [x] 2.1: `export function loadQuickTemplate(): string` — `readFileSync(new URL('../../../templates/commands/quick.md', import.meta.url), 'utf8')`
  - [x] 2.2: `export function parseQuickArgs(args: string[]): { description: string; mode: 'base' | 'discuss' | 'full' }` — strip `--discuss`/`--full` flags first, join remaining tokens as description; default mode is 'base'
  - [x] 2.3: `export async function runQuick(args: string[], projectDir: string): Promise<Result<void, CliError>>` — parse args; if no description → return `{ ok: false, error: { code: 'MISSING_ARG', i18nKey: 'cli.quick.no_description', phase: 'alpha' } }`; if mode is 'discuss' or 'full' → return NOT_IMPLEMENTED stub (Stories 3.2/3.3); otherwise execute base flow; append `quick.execute` audit entry
  - [x] 2.4: JSDoc: `/** Quick Flow command — zero-ceremony execution. @see FR-401 */`
  - [x] 2.5: Named exports only — no `export default`; add `.js` extension on all internal imports

- [x] Task 3: Verify command registry entry (AC: #1)
  - [x] 3.1: Read `src/commands/registry.ts`; if `'quick': () => import('./quick/index.js')` entry is missing → add it; if already present from Story 1.1 bootstrap → no change needed

- [x] Task 4: Add i18n keys (AC: #2, #3, #4)
  - [x] 4.1: Add to `locales/en.yaml`: `cli.quick.no_description`, `cli.quick.executing`, `cli.quick.constitution_warning`, `cli.quick.confirm_violation`, `cli.quick.complete`, `cli.quick.commit_created`, `cli.quick.not_implemented`
  - [x] 4.2: Add same 7 keys to `locales/pt-br.yaml` with PT-BR translations

- [x] Task 5: Tests (AC: #1, #2, #3, #4)
  - [x] 5.1: Unit tests `test/unit/commands/quick.test.ts`:
    - `parseQuickArgs([])` → `{ description: '', mode: 'base' }`
    - `parseQuickArgs(['--discuss', 'add rate limiting'])` → `{ description: 'add rate limiting', mode: 'discuss' }`
    - `parseQuickArgs(['--full', 'migrate', 'users', 'table'])` → `{ description: 'migrate users table', mode: 'full' }`
    - `parseQuickArgs(['fix', 'null', 'pointer'])` → `{ description: 'fix null pointer', mode: 'base' }`
    - `loadQuickTemplate()` → string containing `<!-- ORCHESTRATOR: quick`
    - `loadQuickTemplate().split('\n').length` → ≤ 300
    - `runQuick([], projectDir)` → `{ ok: false, error: { code: 'MISSING_ARG' } }`
    - `runQuick(['--discuss', 'task'], projectDir)` → `{ ok: false, error: { code: 'NOT_IMPLEMENTED' } }`
    - `runQuick(['--full', 'task'], projectDir)` → `{ ok: false, error: { code: 'NOT_IMPLEMENTED' } }`
  - [x] 5.2: Snapshot schema `test/snapshots/quick/base-flow.schema.ts`: `required_sections: ['Quick Spec', 'Constitution Validation', 'Execution', 'Commit', 'Implementation Notes']`, `required_header: 'ORCHESTRATOR: quick'`

## Dev Notes

### Architecture Compliance

**Module locations:**
- `templates/commands/quick.md` — Markdown orchestrator; primary artifact for Prompt Mode v1.0
- `src/commands/quick/index.ts` — TypeScript wrapper; thin executor for Agent Mode v2.0 (Alpha: mostly stubs)

**Prompt Mode execution flow (Alpha):**
```
User types: /bp:quick "fix null pointer"
→ Host model (Claude Code / Cursor) reads templates/commands/quick.md
→ Follows orchestrator sections top-to-bottom
→ TypeScript wrapper NOT invoked in Prompt Mode v1.0
```

**Layer dependency (MUST NOT VIOLATE):**
```
contracts/ ← foundation/ ← engine/ ← commands/ ← cli/
```

**Orchestrator hard constraint:** `templates/commands/quick.md` MUST NOT exceed 300 lines. CI enforces this with orchestrator header check in `test.yml`. Line count includes ALL sections added in Stories 3.2 and 3.3 — plan accordingly.

### What Was Already Built (DO NOT REBUILD)

| Asset | Location | Reuse |
|-------|----------|-------|
| `enforceConstitution(projectDir)` | `src/engine/constitution-enforcer.ts` | Call for Constitution validation (built in Story 2.2) |
| `loadConstitution(projectDir)` | `src/foundation/constitution.ts` | Called internally by constitution-enforcer |
| `I18nResolver.t(key, params)` | `src/foundation/i18n.ts` | All user-facing strings — never hardcode |
| Audit logger | `src/foundation/audit.ts` | Append `{ action: 'quick.execute', ... }` to session log |
| `Result<T, CliError>` type | `src/contracts/errors.js` | Return type for all fallible functions |
| Command Registry | `src/commands/registry.ts` | `'quick'` entry may already exist from Story 1.1 bootstrap |
| Subagent isolation pattern | `src/engine/subagent.ts` | FR-302: clean context dispatch for execution step |

### Commit Type Inference Rules (AC #3)

| Type | Trigger keywords in description |
|------|--------------------------------|
| `fix` | fix, bug, error, null, broken, crash, repair, revert, wrong |
| `feat` | add, create, implement, new, build, introduce, enable |
| `chore` | default — no fix/feat keywords matched |

### Constitution Validation Pattern (AC #2)

`enforceConstitution()` returns `ConstitutionResult { valid: boolean; violations: string[] }`.

In quick mode: violations are a **warning, not a hard block**. Show violations with `clack.log.warn()`, then prompt for confirm/abort. This preserves the "zero-ceremony" character while still honoring the Constitution contract.

### NOT_IMPLEMENTED Stubs for Stories 3.2/3.3

`runQuick` in this story returns `NOT_IMPLEMENTED` for `--discuss` and `--full` modes:
```typescript
return { ok: false, error: { code: 'NOT_IMPLEMENTED', i18nKey: 'cli.quick.not_implemented', phase: 'alpha' } }
```
`templates/commands/quick.md` has placeholder comments:
```
<!-- TODO: Story 3.2 — --discuss section goes here -->
<!-- TODO: Story 3.3 — --full section goes here -->
```
These are removed and replaced in Stories 3.2 and 3.3 respectively.

### Project Structure Notes

- `templates/commands/quick.md` ships in npm package (not compiled); path relative to package root
- `src/commands/quick/index.ts` → compiled to `dist/commands/quick/index.js`
- No new npm dependencies — reuses `@clack/prompts` (already installed in Story 1.1)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic3-Story3.1] — User story, AC, and business context
- [Source: _bmad-output/planning-artifacts/architecture.md#FR-400] — Quick Flow location `src/commands/quick/`
- [Source: _bmad-output/planning-artifacts/architecture.md#OrchestratorHeader] — Mandatory header comment format
- [Source: _bmad-output/planning-artifacts/architecture.md#10MandatoryRules] — Named exports, .js extensions, Result<T>, i18n
- [Source: _bmad-output/implementation-artifacts/1-3-subagent-isolation-architecture.md] — Clean context subagent dispatch pattern
- [Source: _bmad-output/implementation-artifacts/2-2-automatic-constitution-enforcement.md] — `enforceConstitution()` signature and ConstitutionResult type

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Rewrote `templates/commands/quick.md` from stub to full orchestrator with all 5 required sections (Quick Spec, Constitution Validation, Execution, Commit, Implementation Notes) — 111 lines, well within 300-line limit.
- Updated `src/commands/quick/index.ts` with `loadQuickTemplate`, `parseQuickArgs`, `runQuick` exports; kept `handler` re-export for registry compatibility.
- Task 3 (registry): `quick` entry already present from Story 1.1 bootstrap — no change needed.
- Added 7 i18n keys to both `locales/en.yaml` and `locales/pt-br.yaml`.
- Added 9 new unit tests for `parseQuickArgs`, `loadQuickTemplate`, and `runQuick` to existing test file.
- Created `test/snapshots/quick/base-flow.schema.ts` with structural schema constant.
- All 1593 tests pass (46 in quick test file, 1593 total). Zero regressions.

### File List

| File | Action | Notes |
|------|--------|-------|
| `templates/commands/quick.md` | Modified | Rewrote stub to full orchestrator with all required sections |
| `src/commands/quick/index.ts` | Modified | Added loadQuickTemplate, parseQuickArgs, runQuick; kept handler re-export |
| `src/commands/quick/handler.ts` | Modified | Core handler with inferCommitType, buildQuickSpec, handler.run(); also contains ahead-of-schedule discuss/full mode code (Stories 3.2/3.3) |
| `src/commands/registry.ts` | No change | 'quick' entry already present from Story 1.1 |
| `src/contracts/errors.ts` | Modified | Added GIT_COMMAND_FAILED error code |
| `locales/en.yaml` | Modified | 7 quick command i18n keys added |
| `locales/pt-br.yaml` | Modified | Same 7 keys in PT-BR added |
| `test/unit/commands/quick.test.ts` | Modified | Added parseQuickArgs, loadQuickTemplate, runQuick test suites; also includes ahead-of-schedule discuss/full mode tests |
| `test/snapshots/quick/base-flow.schema.ts` | Created | Structural schema for quick orchestrator |

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-16 | Story created | claude-sonnet-4-6 |
| 2026-03-16 | Story implemented — all tasks complete, 1593 tests passing | claude-sonnet-4-6 |
| 2026-03-16 | Code review: fixed inferCommitType AC#3 keyword divergence (H1), removed duplicate handler import in index.ts (M2), added GIT_COMMAND_FAILED error code (M3), updated File List to include handler.ts (M1/M4) | claude-opus-4-6 |
