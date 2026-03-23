# Story 14.1: Memory CLI Command

Status: review

## Story

As a developer using BuildPact,
I want to access memory tiers (feedback, lessons, decisions) directly from the terminal via `bp memory`,
so that I can inspect what the framework has learned without manually browsing `.buildpact/memory/` files.

## Acceptance Criteria

1. **List Feedback Entries**
   - Given the project has `.buildpact/memory/feedback.json` with recorded entries
   - When I run `bp memory list`
   - Then it displays a table of feedback entries showing date, phase, and summary
   - And entries are sorted newest-first

2. **Search Lessons by Keyword**
   - Given the project has lesson files under `.buildpact/memory/lessons/`
   - When I run `bp memory search <query>`
   - Then it returns all lessons whose title or body contain the query (case-insensitive)
   - And each result shows the file name, title, and a snippet with the match highlighted

3. **Show Individual Entry by ID**
   - Given I have an entry ID from `memory list` or `memory search` output
   - When I run `bp memory show <id>`
   - Then it renders the full content of that entry (feedback, lesson, or decision) formatted with @clack/prompts log output

4. **Empty State Messaging**
   - Given the project has no memory entries yet
   - When I run any `memory` subcommand
   - Then it prints a friendly message using i18n key `cli.memory.empty` explaining how memory accumulates

5. **Missing Subcommand Error**
   - Given I run `bp memory` with no subcommand
   - When the command starts
   - Then it shows usage help listing `list`, `search`, `show` subcommands and exits with code 0

## Tasks / Subtasks

- [x] Task 1: Implement `src/commands/memory/handler.ts` — subcommand dispatcher (AC: #5)
  - [x] 1.1: Parse first positional arg as subcommand (`list` | `search` | `show`); if missing, display usage via `clack.log.info` and return `ok()`
  - [x] 1.2: Route to `listFeedback`, `searchLessons`, or `showEntry` based on subcommand
  - [x] 1.3: Validate that `.buildpact/memory/` directory exists; if not, return early with `cli.memory.empty` message

- [x] Task 2: Implement `listFeedback()` function (AC: #1, #4)
  - [x] 2.1: Read and parse `.buildpact/memory/feedback.json` using existing `SessionFeedback` types from `src/engine/session-feedback.ts`
  - [x] 2.2: Sort entries by timestamp descending; format as table with columns: ID (short hash), Date, Phase, Summary (truncated to 60 chars)
  - [x] 2.3: Render table using `clack.log.info` with monospace-aligned output

- [x] Task 3: Implement `searchLessons()` function (AC: #2, #4)
  - [x] 3.1: Read all `.md` files from `.buildpact/memory/lessons/` using `readdirSync` + `readFileSync`
  - [x] 3.2: Filter by case-insensitive substring match on title (first `# ` line) and body
  - [x] 3.3: Format results with filename, title, and context snippet (30 chars before/after match)
  - [x] 3.4: Also search `.buildpact/memory/decisions/` directory for decision entries matching the query

- [x] Task 4: Implement `showEntry()` function (AC: #3)
  - [x] 4.1: Accept `<id>` arg; resolve to feedback entry (by short hash prefix), lesson file, or decision file
  - [x] 4.2: Render full content using `clack.log.info`; for JSON entries, pretty-print with 2-space indent
  - [x] 4.3: If ID not found, return `err()` with code `NOT_FOUND` and i18n key `cli.memory.not_found`

- [x] Task 5: Update `src/commands/memory/index.ts` and add i18n keys (AC: all)
  - [x] 5.1: Replace NOT_IMPLEMENTED stub with import of handler; wire into `CommandHandler.run()`
  - [x] 5.2: Add i18n keys to `locales/en.yaml`: `cli.memory.empty`, `cli.memory.not_found`, `cli.memory.list_header`, `cli.memory.search_results`, `cli.memory.usage`
  - [x] 5.3: Add same keys to `locales/pt-br.yaml` with PT-BR translations
  - [x] 5.4: Add unit tests in `test/unit/commands/memory.test.ts` covering all 5 ACs

## Dev Notes

### Architecture Requirements
- Follow Result<T, CliError> pattern — all public functions return `Promise<Result<void>>`
- Use `@clack/prompts` for all TUI output (log.info, log.warn) — no raw `console.log`
- Named exports only, `.js` extensions on all internal imports (ESM)
- Audit log: append `memory.list`, `memory.search`, `memory.show` actions via `AuditLogger`

### Existing Code to Reuse
- `src/engine/session-feedback.ts` — `SessionFeedback` type, `loadFeedback()` function
- `src/engine/lessons-distiller.ts` — lesson file format, `LessonEntry` type
- `src/engine/decisions-log.ts` — decision entry format, `DecisionEntry` type
- `src/commands/memory/index.ts` — existing stub to replace
- `src/contracts/errors.ts` — `err()`, `ok()`, `ERROR_CODES`

### Project Structure Notes
- Handler goes in `src/commands/memory/handler.ts`
- Index re-exports handler as `CommandHandler` interface
- Memory data lives in `.buildpact/memory/` (feedback.json, lessons/*.md, decisions/*.md)

### References
- Story 7.3 (Session Feedback) — defines feedback.json schema
- Story 7.4 (Lessons Distiller) — defines lessons file format
- Story 7.5 (Decisions Log) — defines decisions file format

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Implemented memory command with list, search, show subcommands
- Replaced NOT_IMPLEMENTED stub with full handler
- list: loads feedback entries from .buildpact/memory/feedback/, sorted newest-first
- search: searches lessons and decisions by case-insensitive substring
- show: resolves entry by ID prefix (short hash for feedback, slug for lessons/decisions)
- Added i18n keys to both en.yaml and pt-br.yaml
- 5 unit tests covering all acceptance criteria

### Change Log
- 2026-03-22: Implemented all tasks and subtasks

### File List
- src/commands/memory/handler.ts (new)
- src/commands/memory/index.ts (updated from NOT_IMPLEMENTED stub)
- locales/en.yaml (added cli.memory.* keys)
- locales/pt-br.yaml (added cli.memory.* keys)
- test/unit/commands/memory.test.ts (new)
