# Story 1.3: Subagent Isolation Architecture

Status: done

## Story

As a developer running BuildPact pipeline commands,
I want all heavy computation delegated to isolated subagents with clean context windows,
So that each agent operates with focused context only and I never experience quality degradation from context contamination.

## Acceptance Criteria

**AC-1: Isolated Task Dispatch**

Given a pipeline operation requires heavy computation (planning, research, execution)
When the framework dispatches it
Then it is delegated to a subagent via Task() dispatch receiving only the specific task payload
And the subagent does NOT inherit accumulated orchestrator context
And every orchestrator command file is ≤300 lines and consumes ≤15% of the model's context window

**AC-2: Minimal Task Payload**

Given any subagent session begins
When the task payload is assembled
Then it contains only: the relevant plan or spec file, task-specific context, and necessary codebase context — nothing more
And the assembled payload is validated to be ≤ 20KB text

**AC-3: Orchestrator Compliance**

Given a Markdown orchestrator file exists in `templates/commands/`
When the CI orchestrator compliance check runs
Then every file has a header comment with `ORCHESTRATOR`, `MAX_LINES`, `CONTEXT_BUDGET`, and `VERSION` fields
And every file has a `## Implementation Notes` block
And every file is ≤ 300 lines
And the CI check exits non-zero if any file violates these constraints

## Tasks / Subtasks

- [x] Task 1: Create `src/engine/subagent.ts` — payload builder + size validation (AC: #1, #2)
  - [x] 1.1 Export `buildTaskPayload(params: BuildPayloadParams): TaskDispatchPayload` — assembles minimal payload from only: task type, content string, optional context string, optional outputPath, optional budgetUsd
  - [x] 1.2 Export `validatePayloadSize(payload: TaskDispatchPayload): Result<void>` — serialize payload to JSON text, check byte length ≤ 20,480 (20KB), return `err` with `PAYLOAD_TOO_LARGE` code if exceeded
  - [x] 1.3 Export `serializePayload(payload: TaskDispatchPayload): string` — converts payload to the canonical JSON string that would be passed to Task()
  - [x] 1.4 Add `BuildPayloadParams` interface (local, not in contracts — it is an input convenience type only)
  - [x] 1.5 JSDoc with `@module engine/subagent` and `@see FR-302`

- [x] Task 2: Create `src/engine/orchestrator.ts` — template loader + line count validator (AC: #1, #3)
  - [x] 2.1 Export `loadOrchestratorTemplate(commandName: string, templatesDir: string): Result<string>` — reads `{templatesDir}/commands/{commandName}.md`, returns file content or `err(FILE_READ_FAILED)`
  - [x] 2.2 Export `validateOrchestratorFile(content: string, filePath: string): Result<void>` — checks: line count ≤ 300 (ORCHESTRATOR_TOO_LONG), presence of header comment with ORCHESTRATOR field (MISSING_ORCHESTRATOR_HEADER), presence of `## Implementation Notes` block (MISSING_IMPLEMENTATION_NOTES)
  - [x] 2.3 Add error codes to `src/contracts/errors.ts`: `ORCHESTRATOR_TOO_LONG`, `MISSING_ORCHESTRATOR_HEADER`, `MISSING_IMPLEMENTATION_NOTES`, `PAYLOAD_TOO_LARGE`
  - [x] 2.4 JSDoc with `@module engine/orchestrator` and `@see FR-301`

- [x] Task 3: Create stub engine modules (AC: #1)
  - [x] 3.1 Create `src/engine/wave-executor.ts` — export `executeWave` returning `Result<void>` with `NOT_IMPLEMENTED` (FR-701 — deferred to Epic 6)
  - [x] 3.2 Create `src/engine/recovery.ts` — export `recoverSession` returning `Result<void>` with `NOT_IMPLEMENTED` (FR-703 — deferred to v1.0)
  - [x] 3.3 Create `src/engine/budget-guard.ts` — export `checkBudget` returning `Result<BudgetGuardResult>` with `NOT_IMPLEMENTED` (FR-705 — deferred to Beta)

- [x] Task 4: Create `src/engine/index.ts` — module public API (AC: #1)
  - [x] 4.1 Re-export public surface: `buildTaskPayload`, `validatePayloadSize`, `serializePayload` from `./subagent.js`; `loadOrchestratorTemplate`, `validateOrchestratorFile` from `./orchestrator.js`; `executeWave` from `./wave-executor.js`; `recoverSession` from `./recovery.js`; `checkBudget` from `./budget-guard.js`
  - [x] 4.2 JSDoc module comment with `@module engine` and `@see FR-301`, `@see FR-302`

- [x] Task 5: Complete and fix Markdown orchestrator templates (AC: #3)
  - [x] 5.1 Update `templates/commands/specify.md` — add missing `CONTEXT_BUDGET: 15%`, `VERSION: 1.0.0` to the header comment; add `## Implementation Notes` block at end
  - [x] 5.2 Create `templates/commands/plan.md` — stub with compliant header + `## Implementation Notes`
  - [x] 5.3 Create `templates/commands/execute.md` — stub with compliant header + `## Implementation Notes`
  - [x] 5.4 Create `templates/commands/verify.md` — stub with compliant header + `## Implementation Notes`
  - [x] 5.5 Create `templates/commands/quick.md` — stub with compliant header + `## Implementation Notes`
  - [x] 5.6 Create `templates/commands/constitution.md` — stub with compliant header + `## Implementation Notes`
  - [x] 5.7 Create `templates/commands/squad.md` — stub with compliant header + `## Implementation Notes`
  - [x] 5.8 Create `templates/commands/memory.md` — stub with compliant header + `## Implementation Notes`
  - [x] 5.9 Create `templates/commands/optimize.md` — stub with compliant header + `## Implementation Notes`

- [x] Task 6: Add orchestrator compliance CI check (AC: #3)
  - [x] 6.1 Update `.github/workflows/test.yml` — add `Orchestrator Compliance Check` step with `shell: bash` that loops over all `templates/commands/*.md`, verifies ORCHESTRATOR header present, line count ≤ 300, exits 1 on any failure
  - [x] 6.2 CI script uses `tr -d ' '` on `wc -l` output for portability across macOS/Linux

- [x] Task 7: Write tests (AC: #1, #2, #3)
  - [x] 7.1 Create `test/unit/engine/subagent.test.ts`: 10 tests — buildTaskPayload shape, optional fields, unique taskId, all types, serializePayload JSON correctness, omit-undefined-fields, validatePayloadSize ok/boundary/err/multibyte
  - [x] 7.2 Create `test/unit/engine/orchestrator.test.ts`: 9 tests — loadOrchestratorTemplate ok/missing/no-dir, validateOrchestratorFile ok/too-long/exactly-300/no-header/no-notes/order
  - [x] 7.3 `src/engine/orchestrator.ts` coverage 100%, `src/engine/subagent.ts` coverage 100% (both exceed 85% threshold)

## Dev Notes

### Architecture Compliance MUST-FOLLOW

1. **Layer dependency order (unidirectional):**
   ```
   contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
   ```
   `src/engine/` may import from `src/contracts/` and `src/foundation/`. Never from `src/commands/`, `src/squads/`, or `src/cli/`.

2. **All fallible business functions return `Result<T, CliError>`** — never `throw`. All 6 validation/load functions in orchestrator.ts and subagent.ts follow this rule.

3. **ESM imports require `.js` extension** — mandatory:
   ```typescript
   import type { TaskDispatchPayload } from '../../contracts/task.js'
   import { err, ok, ERROR_CODES } from '../../contracts/errors.js'
   ```

4. **Named exports only** — no `export default` anywhere in `src/engine/`.

5. **Every module exposes a single `index.ts`** — external consumers import from `../engine/index.js` only, never from `../engine/subagent.js` directly.

6. **Stub pattern for deferred features** — EXACTLY as defined in the architecture:
   ```typescript
   export function executeWave(_tasks: TaskDispatchPayload[]): Result<void> {
     // TODO: implement in Epic 6 — FR-701 wave-parallel execution
     return { ok: false, error: { code: 'NOT_IMPLEMENTED', i18nKey: 'error.stub.not_implemented', phase: 'Epic 6' } }
   }
   ```

7. **Do NOT create `src/utils/` directory** — file-lock utility belongs in `src/foundation/file-lock.ts` (architecture spec). Engine does not need it for this story.

8. **Payload size check uses text encoding** — use `Buffer.byteLength(json, 'utf-8')` or `new TextEncoder().encode(json).byteLength`, NOT `json.length` (length is in chars, not bytes):
   ```typescript
   const bytes = Buffer.byteLength(json, 'utf-8')
   const MAX_BYTES = 20 * 1024 // 20KB = 20,480 bytes
   ```

### Error Codes to Add to `src/contracts/errors.ts`

Add to the `ERROR_CODES` const object:
```typescript
ORCHESTRATOR_TOO_LONG: 'ORCHESTRATOR_TOO_LONG',
MISSING_ORCHESTRATOR_HEADER: 'MISSING_ORCHESTRATOR_HEADER',
MISSING_IMPLEMENTATION_NOTES: 'MISSING_IMPLEMENTATION_NOTES',
PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
```

### Markdown Orchestrator Header Pattern

Every `templates/commands/*.md` file MUST start with this exact comment format:
```markdown
<!-- ORCHESTRATOR: {command} | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:{command} — {Title}
```

The `validateOrchestratorFile()` function checks for:
1. A line matching `<!-- ORCHESTRATOR:` (presence only — not parsing all fields)
2. A line matching `## Implementation Notes`
3. Total line count ≤ 300

### Orchestrator Header Fix for `specify.md`

Current header (incomplete):
```
<!-- ORCHESTRATOR: specify | MAX_LINES: 300 | PIPELINE: specify -->
```

Replace with the compliant version:
```
<!-- ORCHESTRATOR: specify | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
```

And add at the end of the file:
```markdown
## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/specify/index.ts`
- Output files written to: `.buildpact/specs/{{feature_slug}}/`
- Constitution validation: called after spec generation, before user review
- Triggers: `on_specify_complete` hook if Squad active
```

### Stub Orchestrator Template Structure (for plan.md, execute.md, etc.)

```markdown
<!-- ORCHESTRATOR: plan | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:plan — Planning Pipeline

> Stub: Full implementation in Alpha phase.

This orchestrator guides the user through the planning pipeline:
1. Automated parallel research before planning (FR-501)
2. Wave-based plan generation (FR-502)
3. Model profile configuration (FR-503)
4. Nyquist multi-perspective plan validation (FR-504)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/plan/index.ts`
- Output files written to: `.buildpact/specs/{{feature_slug}}/plan.md`
- Constitution validation: called after plan generation, before user review
- Triggers: `on_plan_complete` hook if Squad active
```

Use equivalent descriptions for execute, verify, quick, constitution, squad, memory, optimize matching their Epic descriptions from the PRD.

### CI Compliance Check — Exact Pattern from Architecture

```yaml
# .github/workflows/test.yml — add as a job step under "test" job
- name: Orchestrator Compliance Check
  run: |
    for f in templates/commands/*.md; do
      grep -q "ORCHESTRATOR:" "$f" || { echo "FAIL: $f missing orchestrator header"; exit 1; }
      lines=$(wc -l < "$f")
      [ "$lines" -gt 300 ] && { echo "FAIL: $f has $lines lines (max 300)"; exit 1; }
    done
    echo "All orchestrator files compliant"
```

Note: Check if `.github/workflows/test.yml` exists — if it does, add the step there. If it doesn't exist yet, create it with the Vitest run + this orchestrator check.

### `TaskDispatchPayload` — Already Exists in `src/contracts/task.ts`

Do NOT redefine or modify the shape of `TaskDispatchPayload`. It was created in Story 1.1:
```typescript
export interface TaskDispatchPayload {
  taskId: string
  type: 'specify' | 'plan' | 'execute' | 'verify' | 'quick' | 'optimize'
  content: string
  context?: string
  outputPath?: string
  budgetUsd?: number
}
```

`buildTaskPayload()` receives a `BuildPayloadParams` and produces a `TaskDispatchPayload`. The `taskId` should be generated via `crypto.randomUUID()` (Node built-in, no import needed beyond `node:crypto`).

### Payload Builder Interface

```typescript
interface BuildPayloadParams {
  type: TaskDispatchPayload['type']
  content: string
  context?: string
  outputPath?: string
  budgetUsd?: number
}
```

`taskId` is generated internally — callers don't supply it.

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| `crypto.randomUUID()` | Node built-in | No npm package needed |
| `Buffer.byteLength()` | Node built-in | For payload size check |
| `node:fs/promises` | Node built-in | For `loadOrchestratorTemplate()` |
| Vitest | **^4.1.0** | Unit testing |

### Testing Patterns from Previous Stories

- `mkdtemp(join(tmpdir(), 'buildpact-'))` for temp dirs in orchestrator tests
- `rm(tempDir, { recursive: true })` in `afterEach`
- Write a real `.md` file to temp dir for `loadOrchestratorTemplate()` tests — use real fs, not mocks
- For `validateOrchestratorFile()` — generate strings programmatically (no file needed)
- Factory pattern `const params = () => ({ ...baseDefaults })` to avoid hoisting issues
- 85% coverage threshold applies to `src/engine/**`

### Previous Story Intelligence (1.1 + 1.2)

**Patterns established (must reuse, not reinvent):**
- `Result<T, CliError>` for all fallible operations — `ok(value)` / `err(error)` constructors from `contracts/errors.js`
- `AuditLogger` pattern — engine module does NOT need to instantiate it for this story (that's the command layer's responsibility)
- Named exports via single `index.ts` — every module
- `.js` extension on every ESM import — absolutely mandatory, TypeScript won't catch missing extensions at build time in NodeNext mode

**Fixes from Story 1.2 code review (apply from day 1):**
- `listCommands()` pattern in registry — engine does not touch registry, irrelevant
- Dynamic imports must use `.js` extensions in the import path string even for `.ts` source files

**What Story 1.1 created that engine MUST use:**
- `src/contracts/task.ts` — `TaskDispatchPayload`, `TaskResult` (use as-is)
- `src/contracts/errors.ts` — `CliError`, `Result<T>`, `ok()`, `err()`, `ERROR_CODES` (extend, don't duplicate)
- `src/contracts/index.ts` — barrel re-exporting all contracts (verify engine uses the barrel or individual files consistently)

**What does NOT exist yet (don't import it):**
- `src/foundation/config.ts` — config reader (not yet built; this story doesn't need it)
- `src/squads/` — entire squads module (not yet built)
- `src/engine/` — the whole directory (THIS story creates it)

### File Structure to Create

```
src/engine/
├── index.ts          # Public API barrel — JSDoc @module engine @see FR-301 FR-302
├── orchestrator.ts   # loadOrchestratorTemplate(), validateOrchestratorFile()
├── subagent.ts       # buildTaskPayload(), validatePayloadSize(), serializePayload()
├── wave-executor.ts  # executeWave() — NOT_IMPLEMENTED stub (FR-701, Epic 6)
├── recovery.ts       # recoverSession() — NOT_IMPLEMENTED stub (FR-703, v1.0)
└── budget-guard.ts   # checkBudget() — NOT_IMPLEMENTED stub (FR-705, Beta)

templates/commands/
├── specify.md        # UPDATE — fix header, add Implementation Notes
├── plan.md           # CREATE — stub with compliant header
├── execute.md        # CREATE — stub with compliant header
├── verify.md         # CREATE — stub with compliant header
├── quick.md          # CREATE — stub with compliant header
├── constitution.md   # CREATE — stub with compliant header
├── squad.md          # CREATE — stub with compliant header
├── memory.md         # CREATE — stub with compliant header
└── optimize.md       # CREATE — stub with compliant header

test/unit/engine/
├── subagent.test.ts     # buildTaskPayload, validatePayloadSize, serializePayload
└── orchestrator.test.ts # loadOrchestratorTemplate, validateOrchestratorFile

src/contracts/errors.ts   # MODIFY — add 4 new error codes
.github/workflows/test.yml # CREATE or MODIFY — add orchestrator compliance check step
```

### Project Structure Notes

- Engine files go in `src/engine/` (matching architecture exactly)
- Tests in `test/unit/engine/` (mirrors `src/engine/` per test organization pattern)
- No i18n strings needed for this story — engine layer is infrastructure, not user-facing
- No new npm dependencies needed — all Node.js built-ins (`node:fs/promises`, `node:crypto`)
- Do NOT create `src/engine/types.ts` — all types come from `src/contracts/`

### References

- Story requirements: [Source: epics.md#Story-1.3]
- FR-301: Orchestrator size limits: [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-301]
- FR-302: Subagent isolation with mandatory session reset: [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-302]
- NFR-02: Agent payloads ≤ 20KB: [Source: architecture.md#Technical-Constraints]
- TaskDispatchPayload contract: [Source: src/contracts/task.ts]
- Engine module structure: [Source: architecture.md#Project-Structure (lines 949–955)]
- Orchestrator header format: [Source: architecture.md#Implementation-Patterns (lines 792–818)]
- Anti-pattern reference: [Source: architecture.md#Anti-Pattern-Reference-Table]
- Layer dependency order: [Source: architecture.md#Implementation-Order]
- Error codes: [Source: src/contracts/errors.ts]
- Previous story patterns: [Source: _bmad-output/implementation-artifacts/1-2-diagnostic-health-check.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- No debug issues. All 71 tests passed on first run. TypeScript compiled with zero errors.

### Completion Notes List

- ✅ AC-1: `src/engine/subagent.ts` — `buildTaskPayload()` assembles minimal `TaskDispatchPayload` with auto-generated `taskId` via `crypto.randomUUID()`. `validatePayloadSize()` uses `Buffer.byteLength(json, 'utf-8')` for byte-accurate 20KB enforcement (not char length).
- ✅ AC-2: Payload builder only includes optional fields (`context`, `outputPath`, `budgetUsd`) when non-undefined — serialization omits them, keeping payloads lean. `serializePayload()` produces canonical JSON for Task() dispatch.
- ✅ AC-3: `src/engine/orchestrator.ts` — `validateOrchestratorFile()` enforces ≤300 lines, `<!-- ORCHESTRATOR:` header, and `## Implementation Notes` block in that order. `loadOrchestratorTemplate()` reads from `{templatesDir}/commands/{cmd}.md`.
- ✅ 4 new error codes added to `src/contracts/errors.ts`: `ORCHESTRATOR_TOO_LONG`, `MISSING_ORCHESTRATOR_HEADER`, `MISSING_IMPLEMENTATION_NOTES`, `PAYLOAD_TOO_LARGE`.
- ✅ Stub modules created: `wave-executor.ts` (Epic 6), `recovery.ts` (v1.0), `budget-guard.ts` (Beta) — all return `NOT_IMPLEMENTED` per architecture pattern.
- ✅ `src/engine/index.ts` barrel re-exports all 7 public functions with JSDoc `@see FR-301` and `@see FR-302`.
- ✅ All 9 Markdown orchestrator templates created/updated in `templates/commands/` — every file has `<!-- ORCHESTRATOR: ... | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->` header and `## Implementation Notes` block.
- ✅ CI step added to `.github/workflows/test.yml` — `Orchestrator Compliance Check` with `shell: bash` and portable `tr -d ' '` for `wc -l` output.
- ✅ 19 new tests: 10 in `subagent.test.ts` (including multibyte UTF-8 edge case), 9 in `orchestrator.test.ts` (including boundary at exactly 300 lines and check-order verification).
- ✅ 71 tests total, 0 regressions. `orchestrator.ts` and `subagent.ts` both at 100% coverage.

### Code Review Fixes Applied (claude-opus-4-6)

- **M-1 FIXED:** Replaced all string-literal error codes with `ERROR_CODES.*` constant references across 6 files: `subagent.ts`, `orchestrator.ts`, `wave-executor.ts`, `recovery.ts`, `budget-guard.ts`. Eliminates typo drift risk between error producers and consumers.
- **M-2 FIXED:** Added `src/engine/index.ts` to vitest coverage exclusion list in `vitest.config.ts`, consistent with the existing `src/foundation/index.ts` barrel exclusion pattern.
- Post-fix verification: TypeScript compiles with zero errors, all 71 tests passing, all coverage thresholds met.

### File List

**Created:**
- `src/engine/index.ts`
- `src/engine/subagent.ts`
- `src/engine/orchestrator.ts`
- `src/engine/wave-executor.ts`
- `src/engine/recovery.ts`
- `src/engine/budget-guard.ts`
- `templates/commands/plan.md`
- `templates/commands/execute.md`
- `templates/commands/verify.md`
- `templates/commands/quick.md`
- `templates/commands/constitution.md`
- `templates/commands/squad.md`
- `templates/commands/memory.md`
- `templates/commands/optimize.md`
- `test/unit/engine/subagent.test.ts`
- `test/unit/engine/orchestrator.test.ts`

**Modified:**
- `src/contracts/errors.ts` — added 4 error codes: `ORCHESTRATOR_TOO_LONG`, `MISSING_ORCHESTRATOR_HEADER`, `MISSING_IMPLEMENTATION_NOTES`, `PAYLOAD_TOO_LARGE`
- `src/engine/subagent.ts` — [review fix] string-literal error codes → `ERROR_CODES.*` constants
- `src/engine/orchestrator.ts` — [review fix] string-literal error codes → `ERROR_CODES.*` constants
- `src/engine/wave-executor.ts` — [review fix] string-literal error codes → `ERROR_CODES.*` constants
- `src/engine/recovery.ts` — [review fix] string-literal error codes → `ERROR_CODES.*` constants
- `src/engine/budget-guard.ts` — [review fix] string-literal error codes → `ERROR_CODES.*` constants
- `templates/commands/specify.md` — updated header to full spec (`CONTEXT_BUDGET: 15%`, `VERSION: 1.0.0`), added `## Implementation Notes` block
- `.github/workflows/test.yml` — added `Orchestrator Compliance Check` CI step
- `vitest.config.ts` — [review fix] added `src/engine/index.ts` to barrel exclusion list
