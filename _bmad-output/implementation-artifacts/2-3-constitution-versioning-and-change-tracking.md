# Story 2.3: Constitution Versioning & Change Tracking

Status: done

## Story

As a tech lead managing a team project,
I want every Constitution change to generate an update checklist,
So that I know exactly what changed, why, and which downstream artifacts need review.

## Acceptance Criteria

1. **Update Checklist Generation**
   - Given I modify the Constitution via `/bp:constitution`
   - When changes are saved
   - Then a `constitution_update_checklist.md` is generated (or overwritten) in `.buildpact/` tracking: what changed, the stated reason, and which downstream artifacts (specs, plans) may need review

2. **Downstream Artifact Listing**
   - Given the update checklist is generated
   - When I open it
   - Then it lists all previously generated specs and plans that reference the changed principles with a recommended review action for each

3. **Reason Capture**
   - Given I save a Constitution change
   - When asked for the reason
   - Then I can provide a free-text reason that is recorded in the checklist (or the checklist records "No reason provided" if I skip it)

4. **Principle Diff**
   - Given the old and new Constitution content
   - When a diff is computed
   - Then added, removed, and modified principles are all detected and rendered distinctly in the checklist (+ prefix for added, ~~strikethrough~~ for removed, both for modified)

## Tasks / Subtasks

- [x] Task 1: Implement `src/engine/constitution-versioner.ts` module (AC: #1, #2, #4)
  - [x] 1.1: Define `PrincipleChange`, `DownstreamArtifact`, `UpdateChecklist` interfaces
  - [x] 1.2: `diffConstitutionPrinciples(oldContent, newContent): PrincipleChange[]` — uses `extractPrincipleGroups` from `constitution-enforcer.ts` to parse both versions, compares rule sets for added/removed/modified
  - [x] 1.3: `scanDownstreamArtifacts(projectDir, changedPrincipleNames): Promise<DownstreamArtifact[]>` — scans `.buildpact/specs/` and `.buildpact/plans/` for markdown files referencing changed principle names (case-insensitive); skips missing directories silently
  - [x] 1.4: `buildChecklistContent(checklist: UpdateChecklist): string` — renders markdown checklist with What Changed, Reason, and Downstream Artifacts sections
  - [x] 1.5: `writeUpdateChecklist(projectDir, checklist): Promise<Result<string>>` — writes to `.buildpact/constitution_update_checklist.md`; overwrites on each update (not append)

- [x] Task 2: Integrate versioner into `src/commands/constitution/handler.ts` edit flow (AC: #1, #2, #3)
  - [x] 2.1: After user edits and before `clack.outro`, prompt for change reason via `clack.text` with `reason_prompt` and `reason_placeholder` i18n keys
  - [x] 2.2: Call `diffConstitutionPrinciples(oldContent, newContent)` after save
  - [x] 2.3: Call `scanDownstreamArtifacts(projectDir, changedNames)` with changed principle names
  - [x] 2.4: Call `writeUpdateChecklist(...)` and show `clack.log.success(i18n.t('cli.constitution.checklist_generated'))` if successful
  - [x] 2.5: Include `.buildpact/constitution_update_checklist.md` in audit log files array

- [x] Task 3: Add i18n keys (AC: #3)
  - [x] 3.1: Add `cli.constitution.reason_prompt` and `cli.constitution.reason_placeholder` to `locales/en.yaml` and `locales/pt-br.yaml`
  - [x] 3.2: Add `cli.constitution.checklist_generated` to both locale files

- [x] Task 4: Tests (all ACs)
  - [x] 4.1: Unit tests for all versioner functions in `test/unit/engine/constitution-versioner.test.ts` — diff (identical, modified, added, removed, multiple), scan (no files, matching spec, matching plan, multiple principles, non-md skipped, missing dirs, case-insensitive), buildChecklistContent (each section), writeUpdateChecklist (write + overwrite)
  - [x] 4.2: Integration test in `test/unit/commands/constitution.test.ts` — edit flow generates `constitution_update_checklist.md` with reason text

## Dev Notes

### Architecture Compliance

**Module location:** `src/engine/constitution-versioner.ts`
- Layer: `engine/` — imports from `contracts/` and re-exports from `engine/constitution-enforcer.ts`
- Called by: `src/commands/constitution/handler.ts`

**Layer dependency rules (MUST NOT VIOLATE):**
```
contracts/ ← foundation/ ← engine/ ← commands/ ← cli/
```

**File assignments:**

| Module | File |
|--------|------|
| Versioner types and functions | `src/engine/constitution-versioner.ts` |
| Principle group parser (reused) | `src/engine/constitution-enforcer.ts` → `extractPrincipleGroups` |
| Edit flow integration | `src/commands/constitution/handler.ts` |
| i18n keys | `locales/en.yaml`, `locales/pt-br.yaml` |

### What Was Already Built (DO NOT REBUILD)

| Asset | Location | Note |
|-------|----------|------|
| `extractPrincipleGroups(content)` | `src/engine/constitution-enforcer.ts` | Parses `### Section` headings into `{ name, rules }[]` — used by versioner |
| `loadConstitution(projectDir)` | `src/foundation/constitution.ts` | Used by handler to load old content before edit |
| `saveConstitution(projectDir, content)` | `src/foundation/constitution.ts` | Saves new content before checklist generation |
| `diffConstitutionPrinciples` etc. | `src/engine/constitution-versioner.ts` | Full implementation complete |

### Key Design Decisions

- **Overwrite, not append:** Each edit generates a fresh checklist. The old checklist is overwritten. Git history preserves previous versions if needed.
- **Downstream scan scope:** Only `.buildpact/specs/` and `.buildpact/plans/` are scanned. Missing directories are silently skipped (no error).
- **Reason prompt:** Comes after the save confirm but before `outro`. Empty or cancelled reason records `_No reason provided._` in the checklist.
- **`extractPrincipleGroups` dependency:** The versioner imports from `constitution-enforcer.ts` (engine layer). This is intentional: both live in `engine/` so no layer violation.

### NFR Compliance

| NFR | Compliance |
|-----|------------|
| NFR-23 | Audit trail: checklist path included in `constitution.update` audit log files array |
| NFR-25 | No automated constitution modification — checklist is generated only after user explicitly saves changes |

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-203] — Constitution Versioning, Priority: SHOULD
- [Source: _bmad-output/planning-artifacts/epics.md#Epic2] — Epic 2 story context
- [Source: _bmad-output/implementation-artifacts/2-2-automatic-constitution-enforcement.md] — `extractPrincipleGroups` built in Story 2.2; versioner updated its import accordingly

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Versioner module was bootstrapped during Story 2.2 development as a forward-looking scaffold.
- `extractPrincipleGroups` was moved/re-exported from `constitution-enforcer.ts` to maintain the single-source-of-truth for section parsing; versioner imports it from there.
- Story 2.2 code-review pass updated the versioner import to use the final export path.

### Completion Notes List

- `src/engine/constitution-versioner.ts` implemented: `PrincipleChange`, `DownstreamArtifact`, `UpdateChecklist` types; `diffConstitutionPrinciples`, `scanDownstreamArtifacts`, `buildChecklistContent`, `writeUpdateChecklist` functions
- Integrated into `src/commands/constitution/handler.ts` edit flow: reason prompt, diff, scan, write, audit log, success message
- i18n keys added: `cli.constitution.reason_prompt`, `cli.constitution.reason_placeholder`, `cli.constitution.checklist_generated` in both EN and PT-BR
- 17 unit tests in `test/unit/engine/constitution-versioner.test.ts` — all passing
- 1 integration test in `test/unit/commands/constitution.test.ts` — checklist file generated with correct reason text

### File List

| File | Action | Notes |
|------|--------|-------|
| `src/engine/constitution-versioner.ts` | Created | PrincipleChange, DownstreamArtifact, UpdateChecklist types; all 4 versioner functions |
| `src/commands/constitution/handler.ts` | Modified | Reason prompt, diff/scan/write calls, audit log update, checklist_generated message |
| `locales/en.yaml` | Modified | reason_prompt, reason_placeholder, checklist_generated keys |
| `locales/pt-br.yaml` | Modified | Same 3 keys in PT-BR |
| `test/unit/engine/constitution-versioner.test.ts` | Created | 17 unit tests covering all functions and edge cases |

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-15 | Story bootstrapped alongside Story 2.2: versioner module implemented, handler integration added, i18n keys added, tests written | claude-sonnet-4-6 |
| 2026-03-16 | Story file created to formally document completed implementation; status set to done | claude-sonnet-4-6 |
