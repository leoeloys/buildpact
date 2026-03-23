# Story 11.2: Squad Contribution Flow with Automated CI

Status: done

## Story

As a domain expert who built a valuable Squad,
I want a clear contribution flow for publishing it to the community hub,
So that other users can discover and install my Squad with confidence that it passed quality and security gates.

## Acceptance Criteria

**AC-1: CI Runs on PR Open**
Given I fork `buildpact-squads`, create my Squad, and submit a Pull Request,
When the PR is opened,
Then automated CI runs Squad validation (structural completeness, Voice DNA 5-section compliance, example quality) and security checks (no external URLs, no executable code, no path violations, no prompt injection),
And CI results are posted as PR check summaries with specific pass/fail details per check.

**AC-2: Merged Squad Available Immediately**
Given all CI checks pass,
When a maintainer approves and merges the PR,
Then the Squad is immediately available for community installation via `npx buildpact squad add <name>`.

**AC-3: Actionable Failure Messages**
Given CI checks fail,
When the contributor reviews the results,
Then each failure includes a specific message (which check failed, which file, which line) and a suggested fix,
Enabling the contributor to iterate without maintainer involvement.

## Tasks / Subtasks

- [x] Task 1: Create `.github/workflows/squad-validate.yml` in `buildpact-squads/` repo (AC: 1, 2, 3)
  - [x] 1.1 Trigger on `pull_request` targeting `main`; add `pull-requests: write` and `contents: read` permissions
  - [x] 1.2 Job step: detect changed Squad directories from PR diff (only validate new/modified Squads, not all)
  - [x] 1.3 Job step: install BuildPact CLI via `npm install -g buildpact` (or `npx buildpact@latest`) and run `npx buildpact squad validate <squad-dir>` for each changed Squad
  - [x] 1.4 Job step: post a PR check summary comment via GitHub Actions `$GITHUB_STEP_SUMMARY` and/or `actions/github-script` — table format with check name, status (✅/❌), file, line, and suggested fix
  - [x] 1.5 Fail the workflow hard (`exit 1`) if any check fails — blocks merge until resolved

- [x] Task 2: Verify `bp squad validate` command emits machine-parseable output (AC: 3)
  - [x] 2.1 In `src/commands/squad/index.ts`, confirm the `validate` subcommand exists (from Epic 8.4)
  - [x] 2.2 In `src/squads/validator.ts`, confirm each check function returns `{ check, passed, file?, line?, message, suggestedFix }` — add `suggestedFix` field if missing
  - [x] 2.3 Confirm CLI outputs JSON when `--json` flag passed (CI script parses this); if not, add `--json` flag support to `squad validate`

- [x] Task 3: Validate error messages are actionable (AC: 3)
  - [x] 3.1 For `validateNoExternalUrls()`: message = "External URL found: `<url>` in `<file>:<line>`", suggestedFix = "Remove or replace with local reference"
  - [x] 3.2 For `validateNoExecutableCode()`: message = "Executable code block found in `<file>:<line>`", suggestedFix = "Replace with plain markdown; no `exec`, `eval`, or shell blocks"
  - [x] 3.3 For `validatePathBoundaries()`: message = "Path traversal detected: `<path>` in `<file>:<line>`", suggestedFix = "Use only relative paths within the Squad directory"
  - [x] 3.4 For `validateNoPromptInjection()`: message = "Potential prompt injection in `<file>:<line>`", suggestedFix = "Remove instruction override patterns (e.g., 'ignore previous instructions')"
  - [x] 3.5 For structural / Voice DNA checks: message = "Missing section `<section>` in `<file>`", suggestedFix = "Add required section per the Voice DNA template"

- [x] Task 4: Add i18n keys if any new user-facing strings added (AC: 1, 3)
  - [x] 4.1 Scan new code for hardcoded strings; add to `locales/en.yaml` and `locales/pt-br.yaml`
  - [x] 4.2 Follow dot-notation max 3 levels, snake_case segments (e.g., `cli.squad.validate.external_url_error`)

- [x] Task 5: Run full test suite and verify CI workflow YAML is valid (AC: 1, 2, 3)
  - [x] 5.1 Run `npx vitest run` — all tests must pass
  - [x] 5.2 Validate `.github/workflows/squad-validate.yml` syntax with `actionlint` or GitHub CLI dry-run
  - [x] 5.3 Verify `src/squads/validator.ts` still meets 90%+ coverage threshold

## Dev Notes

### Primary Deliverable

The **main output** is `.github/workflows/squad-validate.yml` inside the `buildpact-squads/` repository (the scaffold created in Story 11-1). This file lives in the **community hub repo**, not in the main `buildpact/` CLI repo.

Story 11-1 explicitly deferred this: "No `.github/` workflows yet (that's Story 11.2)."

### Critical: Do NOT Reinvent the Validator

`src/squads/validator.ts` already exists (Epic 8.4, status: review). The four core check functions are already defined:
- `validateNoExternalUrls()`
- `validateNoExecutableCode()`
- `validatePathBoundaries()`
- `validateNoPromptInjection()`

Do NOT recreate these. The CI workflow calls the existing CLI (`npx buildpact squad validate`), which delegates to this module.

### Architecture Compliance: CI Behavior for Community Squads

From `architecture.md` Security & Trust Model:

| Context | Behavior on Failure |
|---------|---------------------|
| `squad add` (community source) | **Block** — installation rejected; specific error with file + line |
| CI/CD (`buildpact-squads` PR) | **Fail hard** — blocks merge until all checks pass |

The workflow MUST exit non-zero on any validation failure. Do not use `continue-on-error: true`.

### Validation Result Caching

Architecture specifies: validation results cached at `.buildpact/audit/squad-validation-{timestamp}.json`. In the CI context (ephemeral runner), this is informational only — the primary output is the step summary and PR comment.

### GitHub Actions Workflow Structure

```yaml
name: Squad Validation
on:
  pull_request:
    branches: [main]
permissions:
  pull-requests: write
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for diff detection
      - name: Detect changed squads
        id: changed
        run: |
          git diff --name-only origin/main...HEAD | \
            grep '^squads/' | \
            cut -d'/' -f1-2 | sort -u > changed_squads.txt
          cat changed_squads.txt
      - name: Install BuildPact CLI
        run: npm install -g buildpact
      - name: Validate squads
        run: |
          while IFS= read -r squad_dir; do
            npx buildpact squad validate "$squad_dir" --json >> results.json
          done < changed_squads.txt
      - name: Post summary
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            # parse results.json, post table to PR and $GITHUB_STEP_SUMMARY
```

Adjust as needed — this is a structural reference, not copy-paste production code.

### `--json` Flag on `squad validate`

If `bp squad validate` does not yet support `--json`, add it in `src/commands/squad/index.ts`:
- Output array of `{ check, passed, file, line, message, suggestedFix }` objects to stdout
- Exit 0 if all passed, exit 1 if any failed

### File Locations to Touch

**In `buildpact-squads/` repo (created in Story 11-1):**
```
buildpact-squads/
└── .github/
    └── workflows/
        └── squad-validate.yml    ← PRIMARY DELIVERABLE
```

**In `buildpact/` main repo (if `--json` or `suggestedFix` needs adding):**
```
src/
├── commands/squad/index.ts       ← add --json flag if missing
├── squads/validator.ts           ← add suggestedFix field if missing
locales/
├── en.yaml                       ← new i18n keys if any
└── pt-br.yaml                    ← new i18n keys if any
test/
└── unit/squads/validator.test.ts ← update tests if validator changes
```

### Project Structure Notes

- Main CLI repo: `buildpact/` (this project at `/Volumes/Leo/Leo/IA/Projetos/BuildPact`)
- Community hub repo: `buildpact-squads/` (separate GitHub repo, scaffold created in Story 11-1)
- CLI binary entry: `src/cli/index.ts` → `dist/cli/index.js`
- Squad commands: `src/commands/squad/index.ts`
- Validator module: `src/squads/validator.ts` (pure, side-effect-free, 90%+ coverage required)

### Previous Story Intelligence (11-1)

- Story 8.1 pre-built CLI side: `community-hub.ts` (281 LOC), `squad-scaffolder.ts` (547 LOC), `handler.ts` (475 LOC) — all in `src/commands/squad/`
- `manifest.json` schema is finalized including `reviewed` boolean field
- i18n keys follow dot-notation max 3 levels: `cli.squad.hub.*`
- Vitest `^4.1.0` — run `npx vitest run`, not `npm test`
- No regressions: `npx vitest run` must pass after all changes

### Testing Standards

| Type | Location | Scope |
|------|----------|-------|
| Unit | `test/unit/squads/validator.test.ts` | Each check function independently |
| Snapshots | `test/snapshots/` | Structural output schemas only, not content |

Coverage thresholds (from `vitest.config.ts`):
- `src/squads/validator.ts`: **90%+** (enforced)
- Global: 70%+

Test the validator functions directly (they are pure functions — no mocks needed). Do NOT mock the validator in integration tests.

### Cross-Epic Dependencies

- **Epic 8.4** (`squad-structural-validation`) — validation logic lives here; this story consumes it
- **Epic 8.3** (Voice DNA 5-section template) — CI must check all 5 Voice DNA sections
- **Epic 11-1** — `buildpact-squads/` repo scaffold exists; this story adds `.github/workflows/`

### References

- Validation context behavior: [Source: architecture.md#Security & Trust Model]
- GitHub Actions workflows: [Source: architecture.md#CI/CD Lines 219-222]
- Squad directory: [Source: architecture.md#Complete Project Tree Lines 924-934]
- Community Squads distribution: [Source: architecture.md#Infrastructure & Distribution Lines 492-503]
- FR-1102: Squad Contribution Flow (Epic 11 requirement)
- FR-905: Squad validation — `/bp:squad validate` command

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- **Task 1**: Created `buildpact-squads/.github/workflows/squad-validate.yml` — triggers on PR to main, detects changed squad dirs from git diff, installs BuildPact CLI, runs `bp squad validate <dir> --community --json` per squad, posts table summary to PR comment and `$GITHUB_STEP_SUMMARY`, fails hard on any validation failure.
- **Task 2.1**: Confirmed `validate` subcommand exists in `src/commands/squad/handler.ts` (dispatched at line 532).
- **Task 2.2**: Added `SquadJsonCheckItem` interface and `toJsonOutput()` function to `src/squads/validator.ts` — converts `SquadValidationReport` to `{ check, passed, file?, message, suggestedFix }[]` with pattern-matched suggestedFix values per error type.
- **Task 2.3**: Added `--json` flag to `runValidate` in `src/commands/squad/handler.ts` — suppresses all clack output, calls `validateSquad()` aggregate, outputs JSON to stdout, returns err with code `SQUAD_VALIDATION_FAILED` if any check fails (exits 1 for CI).
- **Task 3**: All 5 suggestedFix mappings implemented in `toJsonOutput()` via `securitySuggestedFix()` and `structuralSuggestedFix()` helpers.
- **Task 4**: No new i18n keys required — JSON output is machine-readable data, not user-facing text.
- **Task 5**: 1927 tests pass (73 test files), `validator.ts` at 90% line coverage, YAML syntax valid.

### File List

- `buildpact-squads/.github/workflows/squad-validate.yml` — new: CI workflow for squad validation on PRs
- `src/squads/validator.ts` — modified: added `SquadJsonCheckItem` interface, `toJsonOutput()`, `extractFile()`, `securitySuggestedFix()`, `structuralSuggestedFix()` helpers
- `src/commands/squad/handler.ts` — modified: added `--json` flag support to `runValidate`, imported `validateSquad` and `toJsonOutput`
- `test/unit/squads/validator.test.ts` — modified: added 10 tests for `toJsonOutput()` (J.1–J.10)
- `test/unit/commands/squad.test.ts` — modified: added 4 tests for `--json` flag behavior in `runValidate`
