# Story 1.6: Project Decision Log (DECISIONS.md + STATUS.md)

Status: done

## Story

As a developer working across multiple AI-assisted sessions,
I want the project root to maintain a DECISIONS.md and STATUS.md that restore full context at the start of each new session,
so that no context or decision history is lost between sessions.

## Acceptance Criteria

**AC-1: Files Created on Project Initialization**

Given I initialize a new BuildPact project
When the setup completes
Then both `DECISIONS.md` (append-only log of significant decisions) and `STATUS.md` (living document of current project state) are created in the project root
And both files are included in the `installedResources` list

**AC-2: Append-Only Decision Entries**

Given `DECISIONS.md` exists in the project root
When I call `appendDecision()` with a `DecisionEntry`
Then the entry is appended to the end of DECISIONS.md
And it includes: date, decision made, rationale, and affected artifacts
And all previously written entries remain unchanged (no truncation, no overwrite)

**AC-3: AI Context Restoration**

Given a new AI-assisted session begins
When the agent references DECISIONS.md and STATUS.md
Then it can read all previous decisions and current project state from those files
(Structural guarantee: both files are created with consistent, parseable format)

**AC-4: Web Bundle inclusion of STATUS.md — DEFERRED to Epic 10**

## Tasks / Subtasks

- [x] Task 1: Create `templates/DECISIONS.md` (AC: #1, #3)
  - [x] 1.1 Create `templates/DECISIONS.md` with `{{project_name}}` and `{{created_at}}` placeholders
  - [x] 1.2 Include a bootstrap entry: "Project initialized with BuildPact on `{{created_at}}`"
  - [x] 1.3 Format: `## {{created_at}} — Entry Title` header, then `**Decision:**`, `**Rationale:**`, `**Affected:**`, then `---` separator

- [x] Task 2: Create `templates/STATUS.md` (AC: #1, #3)
  - [x] 2.1 Create `templates/STATUS.md` with `{{project_name}}` and `{{created_at}}` placeholders
  - [x] 2.2 Include sections: Current State, Active Work, Recent Decisions, Next Steps
  - [x] 2.3 "Next Steps" should guide user to run `/bp:specify` as first action

- [x] Task 3: Modify `src/foundation/installer.ts` (AC: #1)
  - [x] 3.1 Add step 7: read `templates/DECISIONS.md` via `readTemplate('DECISIONS.md', vars, templatesDir)`, write to `join(projectDir, 'DECISIONS.md')`, push `'DECISIONS.md'` to `installedResources`, log `install.decisions_log`
  - [x] 3.2 Add step 8: read `templates/STATUS.md` via `readTemplate('STATUS.md', vars, templatesDir)`, write to `join(projectDir, 'STATUS.md')`, push `'STATUS.md'` to `installedResources`, log `install.status`
  - [x] 3.3 Both writes use the existing `vars` record (`project_name`, `created_at`) — no new interpolation variables needed

- [x] Task 4: Create `src/foundation/decisions.ts` (AC: #2)
  - [x] 4.1 Export `DecisionEntry` interface: `{ date: string; decision: string; rationale: string; affected: string[] }`
  - [x] 4.2 Export `appendDecision(projectDir: string, entry: DecisionEntry): Promise<Result<void>>` — reads `DECISIONS.md` from `projectDir`, appends a new section, writes the updated content back
  - [x] 4.3 Format appended entry:
    ```
    \n## {entry.date} — {entry.decision}\n\n**Decision:** {entry.decision}\n**Rationale:** {entry.rationale}\n**Affected:** {entry.affected.join(', ')}\n\n---
    ```
  - [x] 4.4 Imports: `readFile`, `writeFile` from `node:fs/promises`; `join` from `node:path`; `ok`, `err`, `ERROR_CODES`, `type Result` from `../contracts/errors.js`
  - [x] 4.5 Error handling: return `err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.decisions.write_failed', cause })` on any I/O failure

- [x] Task 5: Update `src/foundation/index.ts` barrel (AC: #2)
  - [x] 5.1 Add: `export { appendDecision } from './decisions.js'`
  - [x] 5.2 Add: `export type { DecisionEntry } from './decisions.js'`

- [x] Task 6: Extend `test/unit/foundation/installer.test.ts` (AC: #1)
  - [x] 6.1 Add test: `creates DECISIONS.md in project root` — install, check `exists(join(projectDir, 'DECISIONS.md'))` is `true`
  - [x] 6.2 Add test: `creates STATUS.md in project root` — install, check `exists(join(projectDir, 'STATUS.md'))` is `true`
  - [x] 6.3 Add test: `DECISIONS.md contains project name` — install, readFile `DECISIONS.md`, check `content.toContain('my-project')`
  - [x] 6.4 Add test: `STATUS.md contains project name` — install, readFile `STATUS.md`, check `content.toContain('my-project')`
  - [x] 6.5 Add test: `installedResources includes DECISIONS.md and STATUS.md` — check `result.value.installedResources.includes('DECISIONS.md')` and `.includes('STATUS.md')`

- [x] Task 7: Create `test/unit/foundation/decisions.test.ts` (AC: #2)
  - [x] 7.1 Use `mkdtemp` + `afterEach(rm)` for I/O tests (same pattern as sharding.test.ts)
  - [x] 7.2 Test: `appendDecision appends entry to existing DECISIONS.md` — write initial content, call `appendDecision`, readFile, assert new entry present AND original content intact
  - [x] 7.3 Test: `appendDecision creates the file if it does not exist` — call on empty dir, assert file created with entry content
  - [x] 7.4 Test: `appended entry includes date` — call with known date, assert content contains that date string
  - [x] 7.5 Test: `appended entry includes decision text` — assert content contains decision string
  - [x] 7.6 Test: `appended entry includes rationale` — assert content contains rationale string
  - [x] 7.7 Test: `appended entry includes affected artifacts` — provide `affected: ['foo.ts', 'bar.ts']`, assert content contains `'foo.ts'` and `'bar.ts'`
  - [x] 7.8 Test: `calling appendDecision twice preserves first entry` — call twice, assert BOTH entries present
  - [x] 7.9 Test: `returns FILE_WRITE_FAILED when projectDir is unwritable` — pass a file as projectDir to cause ENOTDIR
  - [x] 7.10 Coverage ≥ 85% for `src/foundation/decisions.ts`

## Dev Notes

### Architecture Compliance MUST-FOLLOW

1. **Layer dependency (unidirectional — strict):**
   ```
   contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
   ```
   `src/foundation/decisions.ts` may import from `../contracts/errors.js` and Node.js built-ins (`node:fs/promises`, `node:path`) ONLY.

2. **Named exports only** — no `export default` anywhere.

3. **ESM `.js` extension mandatory:**
   ```typescript
   import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'
   import { readFile, writeFile } from 'node:fs/promises'
   import { join } from 'node:path'
   ```

4. **Use `ok()` helper, never raw object literal.** `return ok(undefined)` for void success path. `return err({ code: ERROR_CODES.FILE_WRITE_FAILED, ... })` for failure.

5. **File locations**: DECISIONS.md and STATUS.md are in the **project root** (`projectDir`), NOT in `.buildpact/`. This parallels how `CLAUDE.md` is written to `projectDir` in the installer.

6. **No new ERROR_CODES** — `FILE_WRITE_FAILED` covers all I/O failures. Do NOT add `DECISIONS_NOT_FOUND` or similar.

7. **No new npm dependencies** — Node.js builtins only.

### Implementation Reference — `installer.ts` Extension

The existing installer pattern (steps 2–4) to replicate exactly:

```typescript
// Step 7 (after squad install):
const decisions = await readTemplate('DECISIONS.md', vars, templatesDir)
const decisionsPath = join(projectDir, 'DECISIONS.md')
await writeFile(decisionsPath, decisions, 'utf-8')
installedResources.push('DECISIONS.md')
await logger.log({ action: 'install.decisions_log', agent: 'installer', files: ['DECISIONS.md'], outcome: 'success' })

// Step 8:
const status = await readTemplate('STATUS.md', vars, templatesDir)
const statusPath = join(projectDir, 'STATUS.md')
await writeFile(statusPath, status, 'utf-8')
installedResources.push('STATUS.md')
await logger.log({ action: 'install.status', agent: 'installer', files: ['STATUS.md'], outcome: 'success' })
```

Both go inside the existing `try` block, before `install.complete` log. No changes to the function signature, `InstallOptions`, or `InstallResult` interfaces.

### Implementation Reference — `decisions.ts`

Full module sketch:

```typescript
/**
 * @module foundation/decisions
 * @see NFR-26
 *
 * Append-only project decision log for BuildPact CLI.
 * Appends structured entries to DECISIONS.md at the project root.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'

/** A single decision log entry (NFR-26). */
export interface DecisionEntry {
  /** ISO date string, e.g. "2026-03-15" */
  date: string
  /** One-line summary of the decision made. */
  decision: string
  /** Rationale behind the decision. */
  rationale: string
  /** List of file paths or artifact names affected. */
  affected: string[]
}

/**
 * Appends a structured entry to DECISIONS.md at {projectDir}/DECISIONS.md.
 * Creates the file if it does not exist.
 * Never truncates or overwrites existing content (append semantics).
 *
 * Returns ok(undefined) on success, or FILE_WRITE_FAILED on I/O error.
 */
export async function appendDecision(
  projectDir: string,
  entry: DecisionEntry,
): Promise<Result<void>> {
  const decisionsPath = join(projectDir, 'DECISIONS.md')
  try {
    let existing = ''
    try {
      existing = await readFile(decisionsPath, 'utf-8')
    } catch {
      // File does not exist yet — start from empty
    }

    const newEntry = [
      '',
      `## ${entry.date} — ${entry.decision}`,
      '',
      `**Decision:** ${entry.decision}`,
      `**Rationale:** ${entry.rationale}`,
      `**Affected:** ${entry.affected.join(', ')}`,
      '',
      '---',
    ].join('\n')

    await writeFile(decisionsPath, existing + newEntry, 'utf-8')
    return ok(undefined)
  } catch (cause) {
    return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.decisions.write_failed', cause })
  }
}
```

### Template Content Guidance

**`templates/DECISIONS.md`** — uses `{{project_name}}` and `{{created_at}}`:
```markdown
# DECISIONS.md — {{project_name}}

Append-only log of significant decisions. Never overwrite or edit existing entries.
Format each entry: date | decision | rationale | affected artifacts.

---

## {{created_at}} — Project Initialized

**Decision:** Initialize {{project_name}} with BuildPact framework.
**Rationale:** First project setup — establishing baseline configuration.
**Affected:** .buildpact/, project root files.

---
```

**`templates/STATUS.md`** — uses `{{project_name}}` and `{{created_at}}`:
```markdown
# STATUS.md — {{project_name}}

Living document of current project state. Update this file to reflect reality at the start of each session.

---

## Current State

**Project:** {{project_name}}
**Initialized:** {{created_at}}
**Phase:** Setup — ready for first feature

## Active Work

_No active work yet._

## Recent Decisions

See DECISIONS.md for full decision history.

## Next Steps

1. Review `.buildpact/constitution.md` and customize project rules
2. Run `/bp:specify` to capture your first feature spec
3. Update this file as the project evolves
```

### Key Distinction: `appendDecision` Inner Try/Catch

The inner `try/catch` for `readFile` is intentional: if `DECISIONS.md` doesn't exist yet, `readFile` throws ENOENT which we treat as "start from empty string". The outer `try/catch` catches all other errors (permission denied, ENOTDIR, etc.) and maps them to `FILE_WRITE_FAILED`. This is a deliberate two-level error handling pattern — do not collapse them into one.

### Test Pattern for Append-Only Verification

```typescript
it('calling appendDecision twice preserves first entry', async () => {
  const entry1: DecisionEntry = { date: '2026-01-01', decision: 'First', rationale: 'R1', affected: ['a.ts'] }
  const entry2: DecisionEntry = { date: '2026-01-02', decision: 'Second', rationale: 'R2', affected: ['b.ts'] }

  const r1 = await appendDecision(tmpDir, entry1)
  const r2 = await appendDecision(tmpDir, entry2)
  expect(r1.ok).toBe(true)
  expect(r2.ok).toBe(true)

  const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
  expect(content).toContain('First')
  expect(content).toContain('Second')
})
```

### Test Pattern for FILE_WRITE_FAILED

```typescript
it('returns FILE_WRITE_FAILED when projectDir is not a directory', async () => {
  // Create a file at tmpDir/DECISIONS.md, then pass that file as projectDir
  const blockerFile = join(tmpDir, 'blocker')
  await writeFile(blockerFile, 'i am not a directory')

  const result = await appendDecision(blockerFile, {
    date: '2026-01-01', decision: 'X', rationale: 'Y', affected: [],
  })
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error.code).toBe('FILE_WRITE_FAILED')
  }
})
```

Note: passing a file path as `projectDir` causes `join(projectDir, 'DECISIONS.md')` to produce a path like `/tmp/blocker/DECISIONS.md`. The `writeFile` will fail with ENOTDIR, caught by the outer catch block, mapped to `FILE_WRITE_FAILED`.

### Previous Story Intelligence (Stories 1.4–1.5)

**Established patterns (reuse exactly):**
- `ok()` helper — never `{ ok: true, value: ... }` raw literal
- Merged import from same module: `import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'`
- Combined `it()` test block pattern: guard assertion (`expect(result.ok).toBe(false)`) MUST be in the same `it()` block as `.error.code` assertion
- Test imports from implementation file directly, NOT from barrel
- `mkdtemp` + `afterEach(rm(tmpDir, { recursive: true, force: true }))` for file I/O tests
- JSDoc `@module` + `@see FR-NNN` on every new module

**Import path rule confirmed across stories 1.3, 1.4, 1.5:** From `src/foundation/`, the contracts path is `../contracts/errors.js` (NOT `../../contracts/errors.js`).

**Tests that must continue passing (0 regressions):** 119 existing tests across 10 test files (80 original + 37 sharding + 2 new from sharding review = 39, total 119).

### Technical Stack

| Package / Feature | Version | Notes |
|---|---|---|
| Node.js minimum | **20.x** | `node:fs/promises`, `node:path` builtins |
| TypeScript | **5.x strict** | `NodeNext` moduleResolution; `exactOptionalPropertyTypes: true`; `noUncheckedIndexedAccess: true` |
| Vitest | **^4.1.0** | Unit testing |
| Coverage threshold | **≥ 85%** for `src/foundation/decisions.ts` | Both branches of inner try/catch must be exercised |

### File Structure Changes

```
templates/
├── DECISIONS.md          # NEW — append-only decision log template
└── STATUS.md             # NEW — living status document template

src/foundation/
├── decisions.ts          # NEW — appendDecision() (NFR-26)
└── index.ts              # MODIFY — add decisions exports

src/foundation/installer.ts  # MODIFY — steps 7+8 create DECISIONS.md + STATUS.md

test/unit/foundation/
├── installer.test.ts     # MODIFY — add 5 new assertions
└── decisions.test.ts     # NEW — ~10 tests for appendDecision
```

No other files need to be created or modified. Do NOT create `src/contracts/decisions.ts` — all types live in `decisions.ts` itself.

### References

- NFR-26 requirement: [Source: _bmad-output/planning-artifacts/epics.md line 214]
- Epic 1 FR coverage: [Source: _bmad-output/planning-artifacts/epics.md line 374]
- Story acceptance criteria: [Source: _bmad-output/planning-artifacts/epics.md lines 567–590]
- Architecture project tree: [Source: _bmad-output/planning-artifacts/architecture.md lines 897–1033]
- Layer dependency order: [Source: _bmad-output/planning-artifacts/architecture.md line 1039]
- File system access classification: [Source: _bmad-output/planning-artifacts/architecture.md lines 421–434]
- Error handling pattern: [Source: src/contracts/errors.ts]
- Installer I/O pattern: [Source: src/foundation/installer.ts lines 109–148]
- Installer test pattern: [Source: test/unit/foundation/installer.test.ts]
- Audit logger pattern: [Source: src/foundation/audit.ts]
- Previous story patterns: [Source: _bmad-output/implementation-artifacts/1-5-automatic-document-sharding.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- No issues. Import path `../contracts/errors.js` correct (same as all prior foundation modules).
- Inner try/catch in `appendDecision` for ENOENT (missing file) separated cleanly from outer try/catch for ENOTDIR/permissions — both branches exercised in tests.

### Completion Notes List

- Created `templates/DECISIONS.md` with `{{project_name}}` and `{{created_at}}` interpolation, bootstrap entry, correct section format.
- Created `templates/STATUS.md` with same interpolation vars, four sections (Current State, Active Work, Recent Decisions, Next Steps).
- Extended `installer.ts` with steps 7+8 inside existing try block — reads templates, writes to `projectDir/DECISIONS.md` and `projectDir/STATUS.md`, logs audit entries, pushes to `installedResources`. No signature changes.
- Created `src/foundation/decisions.ts` — exports `DecisionEntry` interface and `appendDecision()`. Two-level try/catch: inner for ENOENT (file doesn't exist → empty string), outer for all other I/O errors → `FILE_WRITE_FAILED`. True append semantics (readFile + concatenate + writeFile).
- Updated `src/foundation/index.ts` barrel with `appendDecision` and `DecisionEntry` exports.
- Added 5 assertions to `installer.test.ts` (DECISIONS.md exists, STATUS.md exists, both contain project name, both in installedResources).
- Created `test/unit/foundation/decisions.test.ts` with 9 tests covering all `appendDecision` behaviors.
- 133/133 tests pass. `decisions.ts`: 100% stmt/branch/func/lines coverage. 0 regressions.

### File List

- `templates/DECISIONS.md` (NEW)
- `templates/STATUS.md` (NEW)
- `src/foundation/decisions.ts` (NEW)
- `src/foundation/index.ts` (MODIFIED)
- `src/foundation/installer.ts` (MODIFIED)
- `test/unit/foundation/installer.test.ts` (MODIFIED)
- `test/unit/foundation/decisions.test.ts` (NEW)

## Change Log

- 2026-03-15: Story 1.6 created — ready for dev.
- 2026-03-15: Story 1.6 implemented — `templates/DECISIONS.md` and `templates/STATUS.md` created; `installer.ts` extended to create both at project root; `src/foundation/decisions.ts` created with `appendDecision()`; barrel updated. 14 new tests (9 decisions + 5 installer), 133/133 pass.
- 2026-03-15: Code review complete — 1 MEDIUM fix applied. Inner catch in `appendDecision` now re-throws non-ENOENT errors instead of silently swallowing them. Added EISDIR test. 134/134 pass.

## Senior Developer Review

### Reviewer Model: claude-opus-4-6 | Date: 2026-03-15

### Findings

| Severity | Location | Issue | Resolution |
|----------|----------|-------|------------|
| MEDIUM | `decisions.ts:49` | Inner catch swallowed ALL `readFile` errors (EACCES, EISDIR, disk), not just ENOENT. Non-ENOENT errors should propagate to outer catch → `FILE_WRITE_FAILED`. | Fixed: added `if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e` |
| LOW | `decisions.ts` | Non-atomic read+write has TOCTOU race for concurrent processes. Acceptable for single-process CLI; revisit when `file-lock.ts` is added. | Accepted — no fix needed |
| LOW | `installer.ts:184` | Pre-existing: catch block error code `IDE_CONFIG_FAILED` now also covers DECISIONS.md/STATUS.md writes. Naming debt, not introduced by this story. | Accepted — no fix needed |

### Tests Added (post-review)

- `appendDecision` returns `FILE_WRITE_FAILED` when `DECISIONS.md` exists as a directory (EISDIR, non-ENOENT error propagation)

### Final State

- 134 tests pass, 0 failures
- `decisions.ts`: 100% stmt / 100% branch / 100% func / 100% lines
- All ACs verified: AC-1 (init creates files), AC-2 (append-only semantics), AC-3 (parseable format), AC-4 (deferred)

### Verdict: APPROVED — Story 1.6 complete
