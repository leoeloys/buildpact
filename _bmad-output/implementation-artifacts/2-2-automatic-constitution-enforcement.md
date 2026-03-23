# Story 2.2: Automatic Constitution Enforcement

Status: done

## Story

As a developer running pipeline commands,
I want every specify, plan, and execute action to automatically validate against the Constitution,
So that no AI-generated output can violate my project's established rules without my knowledge.

## Acceptance Criteria

1. **Pipeline Constitution Injection**
   - Given a Constitution exists in `.buildpact/constitution.md`
   - When I run `/bp:specify`, `/bp:plan`, or `/bp:execute`
   - Then the Constitution is injected into the subagent context automatically
   - And the output is validated against Constitution rules before being accepted

2. **Violation Warning**
   - Given an AI-generated output violates a Constitution principle
   - When the violation is detected
   - Then a warning is generated referencing the specific violated principle by name
   - And the user is informed of the violation with a clear explanation before the output is finalized

3. **Constitution Modification Protection**
   - Given a pipeline action would modify the Constitution itself
   - When the action is attempted at any autonomy level (L1–L4)
   - Then explicit user consent is required — this action is never automated

4. **Beginner-Friendly Violations (`experience_level = beginner`)**
   - Given I am in Beginner experience level and an AI-generated output violates a Constitution principle
   - When the violation is detected
   - Then the warning uses plain language with no technical jargon
   - And the message explains what the issue is and what the user should do next

## Tasks / Subtasks

- [x] Task 1: Add enforcement types to `src/contracts/` (AC: #2, #3)
  - [x] 1.1: Add `ConstitutionPrinciple` interface to `src/contracts/task.ts` — `{ name: string; section: string; content: string }`
  - [x] 1.2: Add `ConstitutionViolation` interface to `src/contracts/task.ts` — `{ principle: ConstitutionPrinciple; explanation: string; severity: 'warn' | 'block' }`
  - [x] 1.3: Add `EnforcementResult` type to `src/contracts/task.ts` — `{ violations: ConstitutionViolation[]; hasViolations: boolean }`
  - [x] 1.4: Add `CONSTITUTION_MODIFICATION_BLOCKED` error code to `src/contracts/errors.ts`

- [x] Task 2: Extend `src/foundation/constitution.ts` with enforcement functions (AC: #1, #2, #3)
  - [x] 2.1: `parseConstitutionPrinciples(content: string): ConstitutionPrinciple[]` — parses `### Section` headings and their `- rule` bullets into named principles (see parsing logic in Dev Notes)
  - [x] 2.2: `checkModificationAttempt(output: string): boolean` — returns `true` if output contains write/modify patterns targeting `constitution.md` (see pattern list in Dev Notes)
  - [x] 2.3: `enforceConstitution(output: string, constitutionContent: string): EnforcementResult` — calls `parseConstitutionPrinciples`, runs structural checks, returns `EnforcementResult` (Alpha scope: structural only; see Dev Notes for Beta TODO)
  - [x] 2.4: Export all new functions via `src/foundation/index.ts` barrel (named exports only)

- [x] Task 3: Add enforcement hook to `src/engine/orchestrator.ts` (AC: #1, #2)
  - [x] 3.1: Add `enforceConstitutionOnOutput(output: string, projectDir: string): Promise<Result<EnforcementResult>>` — loads constitution via `loadConstitution()`, calls `enforceConstitution()`, returns result; if no constitution exists, return `ok({ violations: [], hasViolations: false })`
  - [x] 3.2: Call `enforceConstitutionOnOutput()` after spec/plan/execute subagent output is produced, before presenting to user
  - [x] 3.3: If `hasViolations === true`, display each violation via `log.warn()` with principle name and explanation before output is shown
  - [x] 3.4: Audit log enforcement outcome — `constitution.enforce.pass` or `constitution.enforce.warn` (with violation count)

- [x] Task 4: Constitution modification guard in `src/commands/registry.ts` (AC: #3)
  - [x] 4.1: Add pre-flight middleware that calls `checkModificationAttempt()` on task payload before any pipeline write
  - [x] 4.2: If modification attempt detected, prompt user with `confirm()` regardless of autonomy level (L1–L4 — this overrides autonomy)
  - [x] 4.3: If user denies or cancels (`isCancel()`), return `err({ code: ERROR_CODES.CONSTITUTION_MODIFICATION_BLOCKED, i18nKey: 'cli.constitution.violation.modification_blocked' })`
  - [x] 4.4: Audit log the consent decision (`constitution.modify.approved` or `constitution.modify.blocked`)

- [x] Task 5: Beginner-friendly i18n for violations (AC: #4)
  - [x] 5.1: Add keys to `locales/en.yaml` under `cli.constitution.violation.*` (see full key list in Dev Notes)
  - [x] 5.2: Mirror all keys in `locales/pt-br.yaml` under same namespace
  - [x] 5.3: In enforcement warning display (Task 3.3), read `experience_level` via `src/foundation/context.ts` and route to `title_beginner`/`title_expert` keys accordingly

- [x] Task 6: Tests (AC: #1, #2, #3, #4)
  - [x] 6.1: Unit tests for enforcement functions (parseConstitutionPrinciples, checkModificationAttempt, enforceConstitution, formatViolationWarning) in `test/unit/engine/constitution-enforcer.test.ts`
  - [x] 6.2: Unit tests for `enforceConstitutionOnOutput` in `test/unit/engine/orchestrator-enforcement.test.ts` — includes audit log `pass` and `warn` assertions
  - [x] 6.3: Unit tests for `guardConstitutionModification` in `test/unit/commands/registry.test.ts` — includes audit log assertions and i18n test
  - [x] 6.4: Extended `test/integration/pipeline/constitution-flow.test.ts` — 13 new tests:
    - E2E: constitution present → enforcement called → violation returned with section reference
    - E2E: compliant output → clean result
    - E2E: log.warn called for violations
    - Multiple violations detected in single output
    - Beginner mode: plain language, no jargon, mentions "review"
    - Expert mode: technical format with principle name
    - Beginner/expert with i18n resolver (EN + PT-BR)
    - All 7 enforcement i18n keys resolve in EN and PT-BR
  - [x] 6.5: Coverage verified — `foundation/constitution.ts`: 97% stmts / 98.92% lines (target 75%); `engine/orchestrator.ts`: 100% all metrics (target 70%)

## Dev Notes

### Architecture Compliance

**File assignments (do not deviate):**

| Module | File | Architecture Source |
|--------|------|---------------------|
| Enforcement functions | `src/foundation/constitution.ts` (extend existing) | FR-201–202 assigned to this file |
| Enforcement types | `src/contracts/task.ts` (add to existing) | All contract types here |
| New error code | `src/contracts/errors.ts` (add to existing) | All error codes here |
| Pipeline hook | `src/engine/orchestrator.ts` (extend existing) | Pipeline coordinator |
| Modification guard | `src/commands/registry.ts` (extend existing) | Command dispatcher |
| Experience level reader | `src/foundation/context.ts` (use existing) | project-context.md read/write |

**Layer dependency rules (MUST NOT VIOLATE):**
```
contracts/ ← foundation/ ← engine/ ← commands/ ← cli/
```
- `foundation/constitution.ts` imports from `contracts/` ONLY
- `engine/orchestrator.ts` imports from `foundation/` and `contracts/`
- `commands/registry.ts` imports from `engine/` and `foundation/`

### Critical Patterns from Story 2.1 (MUST FOLLOW)

1. **ESM `.js` extension** on ALL imports — `import { parseConstitutionPrinciples } from './constitution.js'`
2. **`Result<T, CliError>`** for all fallible functions — NEVER `throw`
3. **`ok()` / `err()` helpers** — NEVER `{ ok: true, value }` raw objects
4. **Named exports only** — NO `export default`
5. **Audit log BEFORE action, NEVER with false 'success' outcome** (M1 fix from Story 2.1 review)
6. **All user strings via `I18nResolver.t()`** — no hardcoded text
7. **Factory function pattern** for test setup: `const opts = () => ({...})`
8. **Test files import from implementation files** — NOT from barrel `index.ts`
9. **`@clack/prompts` API:** `log.warn()` for warnings, `confirm()` for consent, `isCancel()` after every `confirm()`; `spinner.stop()` takes 1 arg only
10. **ESM mocking:** `vi.spyOn` can't mock frozen ESM exports; test functions individually; AuditLogger mock needs class syntax (NOT `vi.fn().mockImplementation`)
11. **`loadConstitution` error path:** use `FILE_READ_FAILED` (NOT `FILE_WRITE_FAILED`) — M2 fix from Story 2.1 review
12. **Async only:** use `readFile` (async), NEVER `readFileSync` — M3 fix from Story 2.1 review

### What Story 2.1 Already Built (DO NOT REBUILD)

| Asset | Location | Note |
|-------|----------|------|
| `loadConstitution(projectDir)` | `src/foundation/constitution.ts` | Returns `Result<string>` |
| `constitutionExists(projectDir)` | `src/foundation/constitution.ts` | Returns `Promise<boolean>` |
| `saveConstitution(projectDir, content)` | `src/foundation/constitution.ts` | Returns `Result<void>` |
| `constitutionPath` in `TaskDispatchPayload` | `src/contracts/task.ts` | Already wired |
| `buildTaskPayload()` includes `constitutionPath` | `src/engine/subagent.ts` | Already wired |
| `CONSTITUTION_NOT_FOUND`, `CONSTITUTION_EMPTY` | `src/contracts/errors.ts` | Add to, don't replace |
| `cli.constitution.*` i18n keys | `locales/en.yaml`, `locales/pt-br.yaml` | Add to, don't replace |
| 157 tests (all passing) | `test/` | ALL must continue to pass |

### Constitution Parsing Logic

Standard template structure (from `templates/constitution.md` built in Story 2.1):

```
## Immutable Principles
### Coding Standards
- rule 1
### Compliance Requirements
- rule 1
### Architectural Constraints
- rule 1
### Quality Gates
- rule 1
## Domain-Specific Rules
- rule 1
```

Use this simple line-by-line parser — no regex-heavy parsing:

```typescript
export function parseConstitutionPrinciples(content: string): ConstitutionPrinciple[] {
  const principles: ConstitutionPrinciple[] = []
  let currentSection = ''
  for (const line of content.split('\n')) {
    if (line.startsWith('### ')) {
      currentSection = line.slice(4).trim()
    } else if (line.startsWith('- ') && currentSection) {
      const name = line.slice(2).trim()
      principles.push({ name, section: currentSection, content: name })
    }
  }
  return principles
}
```

### Violation Detection — Alpha Scope Boundary

**What `enforceConstitution()` MUST detect in v1.0 (structural):**
1. Output contains write/modify patterns targeting `constitution.md`:
   - Keywords: `writeFile`, `appendFile`, `overwrite`, `replace`, `update` + `constitution` in same sentence
   - Path references: `.buildpact/constitution.md` in a mutating context
2. Output contains explicit override language for a known principle:
   - Keywords: `override`, `ignore`, `bypass`, `disable`, `skip` immediately followed by a principle keyword

**What `enforceConstitution()` DEFERS to Beta (semantic LLM-based):**
- Content that _implicitly_ violates a rule without explicit override language

Add this TODO in the function body:

```typescript
// TODO(Beta): Replace structural check with LLM subagent semantic validation.
// Subagent call: validate `output` against each principle in `principles` semantically.
// For now, structural pattern matching only.
```

### Error Handling

New error code (add to `src/contracts/errors.ts` — same file, same pattern):

```typescript
CONSTITUTION_MODIFICATION_BLOCKED: 'CONSTITUTION_MODIFICATION_BLOCKED'
```

Usage (follow exact same pattern as Story 2.1):

```typescript
return err({
  code: ERROR_CODES.CONSTITUTION_MODIFICATION_BLOCKED,
  i18nKey: 'cli.constitution.violation.modification_blocked'
})
```

### Consent Interaction Pattern (Task 4.2)

```typescript
import { confirm, isCancel, log } from '@clack/prompts'

const consent = await confirm({
  message: i18n.t('cli.constitution.violation.modification_blocked')
})
// CRITICAL: always check isCancel — Ctrl+C returns a Symbol, not false
if (isCancel(consent) || !consent) {
  return err({ code: ERROR_CODES.CONSTITUTION_MODIFICATION_BLOCKED, i18nKey: 'cli.constitution.violation.modification_blocked' })
}
```

### i18n Keys to Add (Task 5.1 / 5.2)

Add under `cli.constitution.violation.*` in both `locales/en.yaml` and `locales/pt-br.yaml`:

```yaml
cli:
  constitution:
    violation:
      title_expert: "Constitution violation detected: {{principle}}"
      title_beginner: "Your project rules say this isn't allowed"
      explanation_expert: "Output conflicts with principle '{{principle}}' in section '{{section}}'"
      explanation_beginner: "The AI created something that goes against a rule you set for this project. It conflicts with your rule about '{{principle_simple}}'. Review the output and decide if you want to keep it."
      action_expert: "Review output and update Constitution if your intent has changed"
      action_beginner: "Look at what was created and decide if it looks right to you"
      modification_blocked: "This action would change your project rules. You must approve it manually."
```

### Experience Level Detection (Task 5.3)

Use existing `src/foundation/context.ts` to read `experience_level` from `.buildpact/project-context.md` frontmatter. The field is `experience_level: "beginner" | "intermediate" | "expert"`. Route beginner messaging for `"beginner"` only — intermediate and expert use the expert keys.

### NFR Compliance

| NFR | Compliance |
|-----|------------|
| NFR-02 | Constitution injection via `constitutionPath` already in payload (Story 2.1) — no payload size increase |
| NFR-15 | Enforcement warnings displayed after output generation (dynamic content last) |
| NFR-23 | Audit: `constitution.enforce.pass`, `constitution.enforce.warn`, `constitution.modify.approved`, `constitution.modify.blocked` |
| NFR-25 | Constitution modification ALWAYS requires explicit user consent — enforcement guard overrides all autonomy levels (L1–L4) |

### Project Structure Notes

- All target files exist — this story extends, never creates new modules
- No new directories needed
- `test/unit/engine/` directory may need to be created if `orchestrator.test.ts` is the first file there — check before writing

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-202] — Constitution Enforcement, classified MUST
- [Source: docs/prd/buildpact-prd-v2.3.0.md#NFR-25] — Consent model, constitution modification always requires user action
- [Source: _bmad-output/planning-artifacts/architecture.md#ImplementationPattern7] — "Constitution is injected into every subagent context. Violations generate structured warnings with principle references."
- [Source: _bmad-output/planning-artifacts/architecture.md#Foundation] — `src/foundation/constitution.ts` owns FR-201 and FR-202
- [Source: _bmad-output/planning-artifacts/epics.md#Epic2] — Story 2.2 BDD criteria and cross-story context
- [Source: _bmad-output/implementation-artifacts/2-1-create-and-edit-project-constitution.md#DevNotes] — Patterns, pitfalls, file list from Story 2.1

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context) — code review fix pass

### Debug Log References

- Initial implementation placed enforcement logic in wrong layer (`engine/constitution-enforcer.ts` instead of `foundation/constitution.ts`). Corrected during code review.
- Types were missing from `contracts/task.ts`. Added during code review.
- i18n keys were at wrong namespace depth. Restructured to `cli.constitution.violation.*` during code review.

### Completion Notes List

- Types `ConstitutionPrinciple`, `ConstitutionViolation`, `EnforcementResult` added to `contracts/task.ts`
- Enforcement functions (`parseConstitutionPrinciples`, `checkModificationAttempt`, `enforceConstitution`, `formatViolationWarning`, `resolveConstitutionPath`) implemented in `foundation/constitution.ts`
- `engine/constitution-enforcer.ts` converted to thin re-export layer for backwards compatibility
- `engine/orchestrator.ts` updated: imports from foundation, `enforceConstitutionOnOutput` uses `enforceConstitution` + i18n
- `commands/registry.ts` updated: imports from foundation, `guardConstitutionModification` supports optional i18n
- Pipeline wiring: `enforceConstitutionOnOutput` and `guardConstitutionModification` called in specify, plan, execute handlers
- i18n: 7 keys under `cli.constitution.violation.*` in both `en.yaml` and `pt-br.yaml`
- `foundation/context.ts`: `readExperienceLevel` for beginner/expert routing
- Beta TODO comment added to `enforceConstitution`
- Override language detection added (bypass, ignore, skip, etc. near principle keywords)
- All 1571 tests pass (7 new tests added)
- Remaining: integration tests (Task 6.4) and coverage verification (Task 6.5)

### File List

| File | Action | Notes |
|------|--------|-------|
| `src/contracts/task.ts` | Modified | Added ConstitutionPrinciple, ConstitutionViolation, EnforcementResult |
| `src/contracts/errors.ts` | Modified | Added CONSTITUTION_VIOLATION, CONSTITUTION_MODIFICATION_BLOCKED |
| `src/foundation/constitution.ts` | Modified | Added parseConstitutionPrinciples, checkModificationAttempt, enforceConstitution, formatViolationWarning, resolveConstitutionPath |
| `src/foundation/context.ts` | Created | readExperienceLevel from project-context.md |
| `src/foundation/index.ts` | Modified | Barrel exports for all new functions |
| `src/engine/constitution-enforcer.ts` | Modified | Converted to re-exports from foundation + extractPrincipleGroups for versioner |
| `src/engine/orchestrator.ts` | Modified | enforceConstitutionOnOutput uses enforceConstitution, optional i18n |
| `src/engine/constitution-versioner.ts` | Modified | Updated import to extractPrincipleGroups |
| `src/commands/registry.ts` | Modified | guardConstitutionModification with optional i18n, imports from foundation |
| `src/commands/specify/handler.ts` | Modified | Added enforcement + guard calls before write |
| `src/commands/plan/handler.ts` | Modified | Added enforcement + guard calls before write |
| `src/commands/execute/handler.ts` | Modified | Added enforcement call after wave execution |
| `locales/en.yaml` | Modified | 7 keys under cli.constitution.violation.* |
| `locales/pt-br.yaml` | Modified | 7 keys under cli.constitution.violation.* |
| `test/unit/engine/constitution-enforcer.test.ts` | Modified | Tests for parseConstitutionPrinciples, enforceConstitution, formatViolationWarning, checkModificationAttempt, resolveConstitutionPath |
| `test/unit/engine/orchestrator-enforcement.test.ts` | Created | Tests for enforceConstitutionOnOutput with audit log assertions |
| `test/unit/commands/registry.test.ts` | Created | Tests for guardConstitutionModification with audit log + i18n assertions |
