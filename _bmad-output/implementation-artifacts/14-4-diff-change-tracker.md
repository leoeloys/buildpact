# Story 14.4: Diff Change Tracker

Status: review

## Story

As a developer iterating on a BuildPact project,
I want to run `bp diff` to see what files changed since the last verification,
so that I can quickly identify unverified changes that need re-verification before continuing the pipeline.

## Acceptance Criteria

1. **Changes Since Last Verify**
   - Given the project has a recorded last-verify timestamp in `.buildpact/verify/`
   - When I run `bp diff`
   - Then it shows a list of files modified since that timestamp, grouped by status (added, modified, deleted)
   - And each file path is shown relative to the project root

2. **Unverified Change Highlighting**
   - Given there are files changed since the last verification
   - When the diff output renders
   - Then files in `src/` are highlighted in yellow as "unverified"
   - And files outside `src/` (docs, config) are shown in dim as "non-critical"

3. **Integration with Git Diff**
   - Given the project is a git repository
   - When I run `bp diff`
   - Then it uses `git diff --name-status` against the commit tagged by the last verify
   - And it falls back to filesystem timestamp comparison if git is unavailable

4. **Summary Statistics**
   - Given files have changed since last verify
   - When `bp diff` completes
   - Then it shows a summary line: "{n} files changed ({added} added, {modified} modified, {deleted} deleted)"
   - And it recommends `bp verify` if unverified source files exist

5. **Clean State**
   - Given no files have changed since the last verification
   - When I run `bp diff`
   - Then it shows a success message with i18n key `cli.diff.clean` indicating all changes are verified

## Tasks / Subtasks

- [x] Task 1: Create `src/commands/diff/handler.ts` — diff computation (AC: #1, #3)
  - [x] 1.1: Read last verify commit SHA from `.buildpact/verify/last-verify.json` (timestamp + commit hash)
  - [x] 1.2: Run `git diff --name-status <last-verify-sha>..HEAD` via `child_process.execSync`; parse output into `{status, path}[]`
  - [x] 1.3: Fallback path: if git unavailable or no verify SHA, use `fs.statSync` mtime comparison against verify timestamp
  - [x] 1.4: Return `DiffResult` object with `added`, `modified`, `deleted` arrays

- [x] Task 2: Implement diff rendering with highlighting (AC: #2, #4, #5)
  - [x] 2.1: Group files by change status; use `picocolors` green for added, yellow for modified, red for deleted
  - [x] 2.2: Apply secondary highlighting: files under `src/` get yellow "unverified" badge; others get dim "non-critical"
  - [x] 2.3: Render summary statistics line with total and per-status counts
  - [x] 2.4: If unverified source files exist, show `clack.log.warn` recommending `bp verify`
  - [x] 2.5: If no changes, render `cli.diff.clean` success message via `clack.log.success`

- [x] Task 3: Implement `.buildpact` state integration (AC: #1, #3)
  - [x] 3.1: Define `LastVerifyState` interface: `{ sha: string, timestamp: string, specSlug: string }`
  - [x] 3.2: Read from `.buildpact/verify/last-verify.json`; if file missing, warn that no verification has been recorded
  - [x] 3.3: Write utility `getLastVerifySha(projectDir): string | undefined` for reuse by other commands

- [x] Task 4: Wire command and add i18n (AC: all)
  - [x] 4.1: Create `src/commands/diff/index.ts` exporting `handler` as `CommandHandler`
  - [x] 4.2: Add `'diff'` to `CommandId` union in `src/commands/registry.ts`; add registry entry
  - [x] 4.3: Add i18n keys to `locales/en.yaml`: `cli.diff.clean`, `cli.diff.header`, `cli.diff.summary`, `cli.diff.recommend_verify`, `cli.diff.no_verify_baseline`
  - [x] 4.4: Add same keys to `locales/pt-br.yaml`
  - [x] 4.5: Add unit tests in `test/unit/commands/diff.test.ts`; mock `child_process.execSync` and filesystem

## Dev Notes

### Architecture Requirements
- Follow Result<T, CliError> pattern for all public functions
- Use `@clack/prompts` for TUI output; `picocolors` for ANSI colors
- Named exports only, `.js` extensions on all imports (ESM)
- Git operations via `child_process.execSync` wrapped in try/catch for graceful fallback
- This is a read-only command — no mutations to project state
- Audit log: append `diff.view` action

### Existing Code to Reuse
- `src/engine/atomic-commit.ts` — git operation utilities, `execGit()` helper
- `src/engine/dashboard-state.ts` — project state for last pipeline phase
- `src/contracts/errors.ts` — `err()`, `ok()`, `ERROR_CODES`
- `src/foundation/installer.ts` — `findProjectRoot()` for locating `.buildpact/`

### Project Structure Notes
- New command directory: `src/commands/diff/`
- Files: `index.ts` (CommandHandler), `handler.ts` (diff logic and rendering)
- Verify state file: `.buildpact/verify/last-verify.json`

### References
- Story 6.2 (Atomic Git Commits) — git operation patterns
- Story 7.1 (Guided Acceptance Test) — verification flow that writes the baseline state

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Implemented diff command using git diff --name-status against last verify SHA
- Reads LastVerifyState from .buildpact/verify/last-verify.json
- Groups changes by status (added/modified/deleted)
- Color-coded output: green for added, yellow for modified, red for deleted
- Unverified badge for src/ files, non-critical badge for others
- Summary statistics line with per-status counts
- Recommends bp verify when unverified source files exist
- Clean state message when no changes detected
- Falls back gracefully when no verify baseline exists

### Change Log
- 2026-03-22: Implemented all tasks and subtasks

### File List
- src/commands/diff/handler.ts (new)
- src/commands/diff/index.ts (new)
- src/commands/registry.ts (updated: added 'diff')
- locales/en.yaml (added cli.diff.* keys)
- locales/pt-br.yaml (added cli.diff.* keys)
- test/unit/commands/diff.test.ts (new)
