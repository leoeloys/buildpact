# Story 1.2: Diagnostic Health Check

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer troubleshooting or verifying a BuildPact installation,
I want to run `buildpact doctor` to check the health of my entire setup,
So that I can quickly identify and fix configuration issues without trial and error.

## Acceptance Criteria

**AC-1: Five-Point Health Check**

Given I have an initialized BuildPact project
When I run `buildpact doctor`
Then it checks:
  - Node.js version (≥20.x)
  - Git availability
  - IDE configuration file validity (for IDEs configured in `.buildpact/config.yaml`)
  - Squad structural integrity (squad.yaml required fields)
  - `.buildpact/` file consistency (constitution.md, config.yaml, project-context.md, audit/)
And outputs results in my configured language (PT-BR or EN)
And marks each check as PASS, WARN, or FAIL with a specific message

**AC-2: Actionable Remediation**

Given `buildpact doctor` detects a misconfigured or missing component
When the diagnosis completes
Then the output includes an actionable remediation step explaining exactly what to fix

**AC-3: Exit Code Semantics**

Given `buildpact doctor` runs all checks
When at least one check is FAIL → exit code 1
When all checks are PASS or WARN → exit code 0

## Tasks / Subtasks

- [x] Task 1: Register `doctor` command in the registry (AC: #1)
  - [x] 1.1 Add `'doctor'` to `CommandId` type union in `src/commands/registry.ts`
  - [x] 1.2 Add registry entry: `doctor: () => import('./doctor/index.js').then(m => m.handler)`
  - [x] 1.3 Update `Available commands` error message in `src/cli/index.ts` to include `doctor`

- [x] Task 2: Create `src/commands/doctor/index.ts` command handler (AC: #1, #2, #3)
  - [x] 2.1 Export `handler: CommandHandler` with `run(args): Promise<Result<void>>`
  - [x] 2.2 Load `.buildpact/config.yaml` to determine language, then create `I18nResolver` via `createI18n(lang)`
  - [x] 2.3 Initialize `AuditLogger` at `.buildpact/audit/cli.jsonl`
  - [x] 2.4 Log `doctor.start` audit entry before any checks
  - [x] 2.5 Run all 5 health checks sequentially using `@clack/prompts` `log` methods for output
  - [x] 2.6 Use `clack.intro()` / `clack.outro()` to frame the diagnostic output
  - [x] 2.7 Log `doctor.complete` audit entry with overall result
  - [x] 2.8 Return `ok(undefined)` if no FAIL results; return `err(...)` if any FAIL found (drives exit code)

- [x] Task 3: Implement individual health check functions (AC: #1, #2)
  - [x] 3.1 Create `src/commands/doctor/checks.ts` with pure check functions, each returning `CheckResult`
  - [x] 3.2 `checkNodeVersion()` — parse `process.version`, verify major ≥ 20; WARN if 20.x (recommend 22.x); PASS if ≥22
  - [x] 3.3 `checkGitAvailable()` — use `execFileSync('git', ['--version'])` from `node:child_process`; FAIL if throws; PASS with git version string
  - [x] 3.4 `checkBuildpactDir(projectDir)` — verify `.buildpact/` contains: `constitution.md`, `config.yaml`, `project-context.md`, `audit/` directory
  - [x] 3.5 `checkIdeConfigs(projectDir, configuredIdes)` — for each IDE in config, verify expected directories/files exist; WARN for missing IDE configs (not FAIL — user may not have all IDEs)
  - [x] 3.6 `checkSquadIntegrity(projectDir)` — scan `.buildpact/squads/*/squad.yaml`, validate required fields: `name`, `version`, `domain`, `description`, `initial_level`; verify `initial_level` is valid `AutomationLevel`; verify referenced agent files exist

- [x] Task 4: Create `CheckResult` type and report utilities (AC: #1, #2)
  - [x] 4.1 Create `src/commands/doctor/types.ts` with `CheckResult` interface: `{ status: 'pass' | 'warn' | 'fail'; message: string; remediation?: string }`
  - [x] 4.2 Create `src/commands/doctor/reporter.ts` with `reportCheck(i18n, result)` that outputs via `clack.log.success/warn/error` based on status
  - [x] 4.3 Include remediation message on WARN/FAIL using `clack.log.info` indented under the check

- [x] Task 5: Add i18n strings for doctor command (AC: #1, #2)
  - [x] 5.1 Add `cli.doctor.*` keys to `locales/en.yaml`:
    - `cli.doctor.title`: "BuildPact Doctor — Health Check"
    - `cli.doctor.node_pass`: "Node.js {version} (meets minimum ≥20.x)"
    - `cli.doctor.node_warn`: "Node.js {version} — upgrade to 22.x LTS recommended"
    - `cli.doctor.node_fail`: "Node.js {version} is below minimum 20.x"
    - `cli.doctor.node_fix`: "Install Node.js 20+ from https://nodejs.org"
    - `cli.doctor.git_pass`: "Git available ({version})"
    - `cli.doctor.git_fail`: "Git not found"
    - `cli.doctor.git_fix`: "Install Git from https://git-scm.com"
    - `cli.doctor.dir_pass`: "Project structure complete"
    - `cli.doctor.dir_fail`: "Missing: {files}"
    - `cli.doctor.dir_fix`: "Run 'buildpact init' to regenerate project structure"
    - `cli.doctor.ide_pass`: "IDE configs valid for: {ides}"
    - `cli.doctor.ide_warn`: "Missing IDE configs: {ides}"
    - `cli.doctor.ide_fix`: "Run 'buildpact init' to regenerate IDE configurations"
    - `cli.doctor.squad_pass`: "Squad valid: {name} v{version}"
    - `cli.doctor.squad_warn`: "No squads installed"
    - `cli.doctor.squad_fail`: "Squad validation failed: {errors}"
    - `cli.doctor.squad_fix`: "Check squad.yaml structure — required fields: name, version, domain, description, initial_level"
    - `cli.doctor.summary_healthy`: "All checks passed — project is healthy"
    - `cli.doctor.summary_issues`: "{fail_count} issue(s) found — see above for remediation"
  - [x] 5.2 Add equivalent PT-BR translations to `locales/pt-br.yaml`

- [x] Task 6: Write unit tests (AC: #1, #2, #3)
  - [x] 6.1 Create `test/unit/commands/doctor.test.ts`
  - [x] 6.2 Test `checkNodeVersion()`: mock `process.version` — test PASS (v22.x), WARN (v20.x), FAIL (v18.x)
  - [x] 6.3 Test `checkGitAvailable()`: test PASS (returns version); verify fail i18n keys resolve correctly
  - [x] 6.4 Test `checkBuildpactDir()`: create temp dir with/without required files — test PASS/FAIL
  - [x] 6.5 Test `checkIdeConfigs()`: create temp dir with/without IDE dirs — test PASS/WARN
  - [x] 6.6 Test `checkSquadIntegrity()`: create temp squad dir with valid/invalid squad.yaml — test PASS/FAIL
  - [x] 6.7 Note: Full handler.run() test deferred — ESM module mocking limitations prevent mocking execFileSync. Check functions tested individually instead.

- [x] Task 7: Write integration test (AC: #1, #2, #3)
  - [x] 7.1 Create `test/integration/pipeline/doctor-flow.test.ts`
  - [x] 7.2 Test healthy project: create full `.buildpact/` structure in temp dir → all checks PASS → exit code 0
  - [x] 7.3 Test unhealthy project: missing files → FAIL checks → exit code 1 → remediation messages present
  - [x] 7.4 Test bilingual output: verify all 20 i18n keys resolve in both EN and PT-BR

## Dev Notes

### Architecture Compliance MUST-FOLLOW

1. **Entry point purity** — `src/cli/index.ts` remains the ONLY file that instantiates `@clack/prompts` interactive prompts. The doctor command uses `@clack/prompts` `log.*` and `intro`/`outro` for display output only (not interactive prompts), which is acceptable in `src/commands/doctor/`.

2. **Layer dependency order** (unidirectional):
   ```
   contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
   ```
   The doctor command (`src/commands/doctor/`) may import from `foundation/` and `contracts/` only. Never from `cli/`.

3. **All fallible business functions return `Result<T, CliError>`** — never `throw`. Individual check functions in `checks.ts` should return `CheckResult` (a simple data struct, not Result — they don't fail, they report). The top-level `handler.run()` returns `Result<void>`.

4. **ESM imports require `.js` extension** — mandatory, no exceptions:
   ```typescript
   import { createI18n } from '../../foundation/i18n.js'  // ✅
   ```

5. **Every module exposes a single `index.ts`** with named exports only — the doctor command is `src/commands/doctor/index.ts`.

6. **Audit logger runs FIRST** — log `doctor.start` before any check runs.

7. **@clack/prompts components to use for display:**
   - `log.success(msg)` — for PASS checks (green checkmark)
   - `log.warn(msg)` — for WARN checks (yellow warning)
   - `log.error(msg)` — for FAIL checks (red X)
   - `log.info(msg)` — for remediation steps (indented info)
   - `intro(title)` / `outro(summary)` — frame the output
   - Do NOT use `spinner` or `tasks` — checks are synchronous/fast and don't need spinners

### Technical Stack (verified March 2026)

| Package | Version | Notes |
|---------|---------|-------|
| Node.js (minimum) | **20.x** | 18 reached EOL April 2025 |
| Node.js (recommended) | **22.x** | Current LTS |
| TypeScript | 5.x strict | NodeNext moduleResolution |
| @clack/prompts | ^1.1.0 | `log.*` methods for diagnostic output |
| vitest | ^4.1.0 | `vi.mock`, `vi.fn`, temp dirs for fs tests |

### Node.js Version Check Implementation

Use `process.version` (synchronous, no import needed):
```typescript
const major = parseInt(process.version.slice(1).split('.')[0]!, 10)
// major >= 22 → PASS
// major >= 20 → WARN (recommend upgrade)
// major < 20  → FAIL
```
Do NOT use `child_process` for Node.js version — the process is already running in Node.

### Git Check Implementation

Use `execFileSync` from `node:child_process` (not `execSync` — avoids shell injection):
```typescript
import { execFileSync } from 'node:child_process'
try {
  const output = execFileSync('git', ['--version'], { encoding: 'utf-8' })
  // Parse version: "git version 2.43.0" → "2.43.0"
  return { status: 'pass', message: i18n.t('cli.doctor.git_pass', { version }) }
} catch {
  return { status: 'fail', message: i18n.t('cli.doctor.git_fail'), remediation: i18n.t('cli.doctor.git_fix') }
}
```

### Config Reading for Language Detection

The doctor command needs to read `.buildpact/config.yaml` to determine the user's language. Reuse the hand-rolled YAML parser from `src/foundation/i18n.ts`. If the config file is missing or unreadable, fall back to `'en'`.

The YAML parser (in `i18n.ts`) parses flat key-value YAML. For `config.yaml`:
```yaml
language: en
experience_level: intermediate
active_squad: software
```
Parse it, extract `language` field → pass to `createI18n()`.

### Squad Validation — Report-Only Mode

The doctor command runs Squad validation in **report-only mode**:
- Does NOT block or install anything
- Reports findings but lets the user decide remediation
- Validates: required fields in `squad.yaml`, referenced agent files exist, `initial_level` is valid `AutomationLevel`

**Note:** A full `src/squads/validator.ts` module is specified in the architecture but NOT yet implemented (Story 8.4). For Story 1.2, implement a **minimal inline validation** in `checks.ts` that validates the basics. Do NOT create `src/squads/validator.ts` — that belongs to Epic 8. Just validate:
1. `squad.yaml` exists and is parseable
2. Required fields: `name`, `version`, `domain`, `description`, `initial_level`
3. `initial_level` is one of: `L1`, `L2`, `L3`, `L4`
4. Agent file references exist on disk

### IDE Config Validation Logic

Read configured IDEs from `.buildpact/config.yaml` (field not yet stored — see note below). For each IDE, check expected dirs:

| IDE | Expected Path(s) |
|-----|------------------|
| claude-code | `.claude/commands/`, `CLAUDE.md` |
| cursor | `.cursor/rules/`, `.cursorrules` |
| gemini | `.gemini/` |
| codex | `.codex/` |

**Important:** Story 1.1's `config.yaml` template does NOT store which IDEs were selected. The doctor should scan for the presence of ANY known IDE dirs and report on what it finds. WARN if none found; PASS for each found and valid.

### Testing Standards

| Module | Coverage Threshold |
|--------|-------------------|
| `src/commands/doctor/**` | 85% (commands threshold) |
| global | 70% |

**Testing patterns from Story 1.1 to reuse:**
- `mkdtemp(join(tmpdir(), 'buildpact-'))` for temp dirs
- `rm(tempDir, { recursive: true })` in `afterEach`
- Factory pattern: `const opts = () => ({ ...baseDefaults })` (avoids hoisting issues with `beforeEach`)
- Real fs operations over mocks for directory structure tests
- `vi.mock('node:child_process')` for git detection tests
- For `process.version` mocking: `Object.defineProperty(process, 'version', { value: 'v18.0.0', writable: true, configurable: true })` — restore in `afterEach`

### File Structure to Create

```
src/commands/doctor/
├── index.ts           # CommandHandler entry point
├── checks.ts          # Pure check functions (5 checks)
├── types.ts           # CheckResult, CheckStatus types
└── reporter.ts        # @clack/prompts display formatting

test/unit/commands/
└── doctor.test.ts     # Unit tests for all check functions

test/integration/pipeline/
└── doctor-flow.test.ts  # End-to-end doctor flow
```

### Key Naming Conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| i18n keys | dot-notation, max 3 levels | `cli.doctor.node_pass` |
| Error codes | SCREAMING_SNAKE_CASE | `DOCTOR_CHECK_FAILED` |
| Check functions | camelCase | `checkNodeVersion()`, `checkGitAvailable()` |
| Types | PascalCase | `CheckResult`, `CheckStatus` |

### Previous Story Intelligence (1.1)

**Debug issues to avoid:**
- Vitest `baseOptions` hoisting: Use factory function `opts()` instead of sharing mutable state
- `@clack/prompts` `spinner.stop()` accepts only 1 argument (message string) — no exit code param
- Hand-rolled YAML parser only supports flat key-value and 3-level nesting — sufficient for config.yaml

**Code review fixes applied to 1.1:**
- Missing audit logging in cli/index.ts → now logs every step. Doctor must also log.
- Missing contracts/index.ts barrel → now exists. Use it for imports.
- Missing squad template placeholders → now exist.

**Patterns established:**
- `Result<T, CliError>` for all fallible operations
- `AuditLogger` instantiated with path, `await audit.log({...})` per operation
- `createI18n(lang)` returns `I18nResolver` with `.t(key, params)` method
- Command handlers export `handler: CommandHandler` with `run(args): Promise<Result<void>>`

### Project Structure Notes

- Doctor files go in `src/commands/doctor/` (same pattern as all other commands)
- Tests mirror source: `test/unit/commands/doctor.test.ts`
- Locales update: add keys to existing `locales/en.yaml` and `locales/pt-br.yaml`
- No new dependencies needed — use `node:child_process` for git, `node:fs/promises` for fs, `@clack/prompts` for display
- Doctor does NOT create a Markdown orchestrator in `templates/commands/doctor.md` — it's a pure TypeScript command (the orchestrator pattern is for pipeline commands like specify/plan/execute)

### References

- Story requirements: [Source: epics.md#Epic-1-Story-1.2]
- CLI command architecture: [Source: architecture.md#CLI-Command-Architecture]
- Squad validation modes: [Source: architecture.md#Security-Validation — "Report only (buildpact doctor)"]
- FR-103 diagnostic tool: [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-103]
- Package versions: [Source: architecture.md#Resolved-Package-Versions]
- Error handling: [Source: architecture.md#Contracts-Layer]
- Testing standards: [Source: architecture.md#Test-organization]
- Previous story: [Source: _bmad-output/implementation-artifacts/1-1-project-initialization-via-cli.md]
- Project overview: [Source: docs/project-context.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- ESM module mocking limitation: `vi.spyOn` cannot mock `execFileSync` on ESM namespace objects (frozen exports). Workaround: test git check directly (git is available in test env) and separately verify i18n fail/fix key resolution.
- Return type issue in `doctor/index.ts`: `Promise<ReturnType<CommandHandler['run']>>` created double-wrapped Promise. Fixed by removing explicit return type annotation — TypeScript infers correctly.

### Completion Notes List

- ✅ AC-1: Five-point health check implemented — Node.js version, Git availability, .buildpact/ structure, IDE configs, Squad integrity. All checks output via `@clack/prompts` `log.*` methods with PASS/WARN/FAIL semantics.
- ✅ AC-2: Every WARN and FAIL check includes actionable `remediation` string displayed via `clack.log.info`. Messages suggest specific commands or URLs to fix the issue.
- ✅ AC-3: Handler returns `ok(undefined)` when no FAILs (exit 0 via CLI) and `err(DOCTOR_CHECK_FAILED)` when FAILs exist (exit 1 via CLI).
- ✅ Doctor registered in command registry as lazy-loaded command. Available commands list updated in CLI.
- ✅ Config.yaml language detection with fallback to 'en' if unreadable.
- ✅ Audit logging: `doctor.start` and `doctor.complete` entries logged to `.buildpact/audit/cli.jsonl`.
- ✅ Bilingual support: 20 i18n keys added to both `en.yaml` and `pt-br.yaml`. Integration test verifies all keys resolve in both languages.
- ✅ Squad validation: minimal inline validator checks required fields, automation level validity, and agent file existence. Does NOT create `src/squads/validator.ts` (belongs to Epic 8).
- 52 tests passing (22 new + 30 existing), 0 failures, 0 regressions.
- TypeScript strict mode: zero compilation errors.

### Code Review Fixes Applied (claude-opus-4-6)

- **M-1 FIXED:** Removed redundant/dead code branch in `checkIdeConfigs()` — collapsed two identical return statements into one.
- **M-2 FIXED:** Replaced hardcoded available commands string in `src/cli/index.ts` with dynamic `listCommands().join(', ')` call from registry, eliminating maintenance drift risk.
- Post-fix verification: TypeScript compiles with zero errors, all 52 tests passing.

### File List

**Created:**
- `src/commands/doctor/index.ts`
- `src/commands/doctor/checks.ts`
- `src/commands/doctor/types.ts`
- `src/commands/doctor/reporter.ts`
- `test/unit/commands/doctor.test.ts`
- `test/integration/pipeline/doctor-flow.test.ts`

**Modified:**
- `src/commands/registry.ts` — added `doctor` to CommandId union and REGISTRY
- `src/cli/index.ts` — added `doctor` to available commands error message
- `locales/en.yaml` — added 20 `cli.doctor.*` i18n keys
- `locales/pt-br.yaml` — added 20 `cli.doctor.*` PT-BR translations
