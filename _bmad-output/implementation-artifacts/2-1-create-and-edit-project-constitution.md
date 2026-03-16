# Story 2.1: Create and Edit Project Constitution

Status: done

## Story

As a tech lead or developer,
I want to run `/bp:constitution` to create or update my project's immutable rules,
So that all AI pipeline actions automatically respect my coding standards, compliance requirements, and architectural constraints.

## Acceptance Criteria

1. **Initial Constitution Creation**
   - Given I run `/bp:constitution` in an initialized project
   - When the command executes
   - Then a guided flow helps me define: coding standards, compliance requirements (CFM, ANVISA, LGPD, HIPAA as applicable), architectural constraints, quality gates, and domain-specific rules
   - And the result is saved to `.buildpact/constitution.md`

2. **Existing Constitution Update**
   - Given a Constitution already exists
   - When I run `/bp:constitution` again
   - Then I can view the current Constitution and make targeted edits without rewriting from scratch
   - And all changes are persisted to `.buildpact/constitution.md`

3. **Automatic Loading in Subsequent Commands**
   - Given the Constitution is saved
   - When any subsequent pipeline command runs
   - Then the Constitution is automatically loaded and injected into every subagent context

## Tasks / Subtasks

- [x] Task 1: Implement `src/foundation/constitution.ts` module (AC: #1, #2, #3)
  - [x] 1.1: `loadConstitution(projectDir): Promise<Result<string>>` — reads `.buildpact/constitution.md`, returns content or `CONSTITUTION_NOT_FOUND`
  - [x] 1.2: `saveConstitution(projectDir, content): Promise<Result<void>>` — writes constitution, validates non-empty, returns `FILE_WRITE_FAILED` on error
  - [x] 1.3: `constitutionExists(projectDir): Promise<boolean>` — check if file exists (used by command to branch create vs edit flow)
  - [x] 1.4: Export via `src/foundation/index.ts` barrel (named exports only)

- [x] Task 2: Implement `src/commands/constitution/handler.ts` (AC: #1, #2)
  - [x] 2.1: Create mode — guided TUI flow using `@clack/prompts` to collect: coding standards, compliance requirements, architectural constraints, quality gates, domain-specific rules
  - [x] 2.2: Edit mode — load existing constitution, display current content, allow targeted section edits via `@clack/prompts` select + text prompts
  - [x] 2.3: Mode detection — call `constitutionExists()` to auto-select create vs edit
  - [x] 2.4: Bilingual support — all prompts via `I18nResolver.t()`, both PT-BR and EN
  - [x] 2.5: Audit logging — log `constitution.create` or `constitution.update` action before write

- [x] Task 3: Update `templates/constitution.md` scaffold (AC: #1)
  - [x] 3.1: Ensure template has all 5 sections from FR-201: Coding Standards, Compliance Requirements, Architectural Constraints, Quality Gates, Domain-Specific Rules
  - [x] 3.2: Include `## Version History` table at bottom
  - [x] 3.3: Template uses `{{project_name}}` placeholder (consistent with Story 1.1 pattern)

- [x] Task 4: Wire constitution loading into Task Dispatch Payload (AC: #3)
  - [x] 4.1: Update `src/engine/subagent.ts` `buildTaskPayload()` to always include `context.constitution` path
  - [x] 4.2: If constitution doesn't exist, omit from payload (no error — constitution is optional until created)

- [x] Task 5: Add i18n keys for constitution command (AC: #1, #2)
  - [x] 5.1: Add keys to `locales/en.yaml` and `locales/pt-br.yaml` under `cli.constitution.*` namespace
  - [x] 5.2: Keys needed: `welcome`, `section_coding`, `section_compliance`, `section_architecture`, `section_quality`, `section_domain`, `edit_prompt`, `saved`, `no_changes`

- [x] Task 6: Tests (all ACs)
  - [x] 6.1: Unit tests in `test/unit/foundation/constitution.test.ts` — load, save, exists, error paths
  - [x] 6.2: Unit tests in `test/unit/commands/constitution.test.ts` — create flow, edit flow, mode detection
  - [x] 6.3: Integration test in `test/integration/pipeline/constitution-flow.test.ts` — end-to-end create + edit + verify payload injection
  - [x] 6.4: Verify bilingual output (both EN and PT-BR keys resolve)

- [x] Task 7: Update command registry (AC: #1)
  - [x] 7.1: Replace constitution stub in `src/commands/registry.ts` with lazy-loaded handler
  - [x] 7.2: Verify `buildpact constitution` CLI invocation works

## Dev Notes

### Architecture Compliance

**Module location:** `src/foundation/constitution.ts`
- Pure, side-effect-free module (reads/writes files, no business logic beyond validation)
- Layer: `foundation/` — importable by `engine/`, `commands/`, `cli/`
- Layer dependency: `contracts/ ← foundation/` (import errors from `../contracts/errors.js`)

**Command location:** `src/commands/constitution/handler.ts`
- Follows doctor command pattern from Story 1.2
- Exports `handler: CommandHandler` with `run()` method returning `Result<void>`

**File being managed:** `.buildpact/constitution.md`
- Markdown format, human-readable, Git-diffable
- Immutable at runtime (only this command modifies it)
- Must be concise: fits within 15% context window budget (NFR-02), <20KB in task payload

### Critical Patterns to Follow

1. **ESM `.js` extension** on ALL imports — `import { ok, err } from '../contracts/errors.js'`
2. **`Result<T, CliError>`** for all fallible functions — never `throw`
3. **`ERROR_CODES.*` constants** — add `CONSTITUTION_NOT_FOUND`, `CONSTITUTION_EMPTY` to `src/contracts/errors.ts`
4. **`ok()` / `err()` helpers** — never raw `{ ok: true, value }` objects
5. **Named exports only** — no `export default`
6. **Audit logging FIRST** — log intent before writing constitution file
7. **All user strings via `I18nResolver.t()`** — never hardcoded text
8. **Factory function pattern** for test setup — `const opts = () => ({...})`
9. **Test imports from implementation files** — not from barrel `index.ts`

### Implementation Reference Files

| What | File | Why |
|------|------|-----|
| I/O pattern (read/write) | `src/foundation/decisions.ts` | Same read-modify-write pattern for `.buildpact/` files |
| Command handler pattern | `src/commands/doctor/index.ts` | TUI output + Result return + audit logging |
| Error code constants | `src/contracts/errors.ts` | Add new codes here, never inline strings |
| i18n key pattern | `locales/en.yaml` | Dot-notation, max 3 levels: `cli.constitution.welcome` |
| Template placeholder pattern | `templates/DECISIONS.md` | Uses `{{project_name}}`, `{{created_at}}` |
| Task payload builder | `src/engine/subagent.ts` | `buildTaskPayload()` — add constitution path here |
| Installer template copy | `src/foundation/installer.ts` | How `templates/constitution.md` gets copied to `.buildpact/` |
| Test setup pattern | `test/unit/foundation/decisions.test.ts` | Factory function + mkdtemp + afterEach cleanup |

### Error Handling

Add these error codes to `src/contracts/errors.ts`:

```typescript
CONSTITUTION_NOT_FOUND: 'CONSTITUTION_NOT_FOUND'   // .buildpact/constitution.md doesn't exist
CONSTITUTION_EMPTY: 'CONSTITUTION_EMPTY'             // User submitted empty constitution
FILE_WRITE_FAILED: 'FILE_WRITE_FAILED'               // Already exists — reuse for write errors
```

I/O error pattern (from Story 1.6):
```typescript
try {
  const content = await readFile(path, 'utf-8')
  return ok(content)
} catch (cause) {
  if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
    return err({ code: ERROR_CODES.CONSTITUTION_NOT_FOUND, i18nKey: 'error.constitution.not_found' })
  }
  return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.file.write_failed', cause })
}
```

### Constitution File Format

```markdown
# Project Constitution — {{project_name}}

## Immutable Principles

### Coding Standards
- [User-defined rules]

### Compliance Requirements
- [CFM, ANVISA, LGPD, HIPAA as applicable]

### Architectural Constraints
- [User-defined constraints]

### Quality Gates
- [User-defined gates]

## Domain-Specific Rules
- [Rules that apply when specific Squads are active]

## Version History
| Date | Change | Reason |
|------|--------|--------|
| {{created_at}} | Initial creation | Project setup |
```

### NFR Compliance

| NFR | How This Story Complies |
|-----|------------------------|
| NFR-02 | Constitution must be concise (<20KB); warn user if exceeding size |
| NFR-15 | Static content (headings, structure) at top; dynamic content (rules) below — maximizes cache hits |
| NFR-22 | Constitution stays in `.buildpact/` — no external file access |
| NFR-23 | Audit trail: log `constitution.create` / `constitution.update` with outcome |
| NFR-25 | Constitution modification always requires explicit user consent (guided TUI = explicit) |

### Consent & Security

- Constitution modification ALWAYS requires explicit user consent per NFR-25 — even at L4 (Trusted) autonomy
- The guided TUI flow inherently provides consent (user actively inputs content)
- No automated/silent constitution modifications allowed
- Audit every create/update action

### Testing Standards

- Coverage target: 75% for `src/foundation/constitution.ts`, 85% for `src/commands/constitution/`
- Test both success and error paths (ENOENT, EACCES, empty content)
- Test bilingual output (EN + PT-BR i18n keys)
- Use `mkdtemp` for temp directories, `afterEach` cleanup
- Barrel files excluded from coverage (`vitest.config.ts`)

### Known Pitfalls from Epic 1

- **Import paths:** From `src/foundation/` to contracts is `../contracts/errors.js` (ONE level up, not two)
- **`@clack/prompts` API:** `spinner.stop()` takes 1 argument only; use `log.success()` / `log.warn()` for display
- **ESM mocking:** `vi.spyOn` can't mock frozen ESM exports; test functions individually
- **Threshold semantics:** If checking constitution size, be explicit about `>` vs `>=`
- **`ok()` helper:** Always use `ok(value)`, never `{ ok: true, value }`

### What NOT to Build (Scope Boundaries)

- **DO NOT** implement violation detection/enforcement — that's Story 2.2
- **DO NOT** implement change tracking/checklist generation — that's Story 2.3
- **DO NOT** add constitution validation rules (e.g., "must have at least 3 standards") — keep it flexible
- **DO** ensure the file is loadable by `buildTaskPayload()` (Story 2.2 will use this)

### Project Structure Notes

- Alignment: `.buildpact/constitution.md` is already defined in project structure (architecture doc)
- Template already exists at `templates/constitution.md` (created in Story 1.1 scaffold)
- Command stub already exists at `src/commands/constitution/` (created in Story 1.1, returns NOT_IMPLEMENTED)
- No conflicts detected with existing structure

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-201] — Constitution Creation requirement
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-202] — Constitution Enforcement (context for AC #3)
- [Source: docs/prd/buildpact-prd-v2.3.0.md#NFR-25] — Consent model (always requires consent)
- [Source: _bmad-output/planning-artifacts/architecture.md#Foundation] — Module location, file format
- [Source: _bmad-output/planning-artifacts/architecture.md#Contracts] — task.ts includes constitution path
- [Source: _bmad-output/planning-artifacts/epics.md#Epic2] — Epic context and cross-story dependencies

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blocking issues. AuditLogger mock needed class syntax (not `vi.fn().mockImplementation`) for ESM module compatibility — resolved in test setup.

### Completion Notes List

- Implemented `src/foundation/constitution.ts` with `loadConstitution`, `saveConstitution`, `constitutionExists` — all returning `Result<T>`, no throws
- Added `CONSTITUTION_NOT_FOUND` and `CONSTITUTION_EMPTY` error codes to `src/contracts/errors.ts`
- Implemented `src/commands/constitution/handler.ts` with create mode (guided TUI via `@clack/prompts group`) and edit mode (select + text loop), bilingual via `I18nResolver.t()`
- Updated `src/commands/constitution/index.ts` to re-export from handler (replacing stub)
- Updated `templates/constitution.md` with all 5 FR-201 sections and `## Version History` table
- Added `constitutionPath?: string` to `TaskDispatchPayload` interface and `BuildPayloadParams` in `buildTaskPayload()`
- Added 9 i18n keys under `cli.constitution.*` to both `locales/en.yaml` and `locales/pt-br.yaml`
- 10 unit tests for foundation module, 5 unit tests for command handler, 8 integration tests
- Full test suite: 157 tests, all passing, no regressions
- TypeScript compiles with zero errors

### File List

- `src/foundation/constitution.ts` (new)
- `src/foundation/index.ts` (modified — added exports)
- `src/commands/constitution/handler.ts` (new)
- `src/commands/constitution/index.ts` (modified — replaced stub)
- `src/contracts/errors.ts` (modified — added CONSTITUTION_NOT_FOUND, CONSTITUTION_EMPTY)
- `src/contracts/task.ts` (modified — added constitutionPath to TaskDispatchPayload)
- `src/engine/subagent.ts` (modified — added constitutionPath to BuildPayloadParams and buildTaskPayload)
- `templates/constitution.md` (modified — full 5-section FR-201 structure)
- `locales/en.yaml` (modified — added cli.constitution.* keys)
- `locales/pt-br.yaml` (modified — added cli.constitution.* keys)
- `test/unit/foundation/constitution.test.ts` (new)
- `test/unit/commands/constitution.test.ts` (new)
- `test/integration/pipeline/constitution-flow.test.ts` (new)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-15 | Implemented all 7 tasks — constitution module, command handler, template update, payload wiring, i18n, tests, registry | claude-sonnet-4-6 |
| 2026-03-15 | Code review: fixed 3 MEDIUM issues — (M1) removed premature audit logs with false 'success' outcome, (M2) corrected FILE_WRITE_FAILED → FILE_READ_FAILED in loadConstitution error path, (M3) converted readFileSync to async readFile in handler. Updated corresponding test assertion. 157/157 tests pass, 0 TS errors. | claude-opus-4-6 |
