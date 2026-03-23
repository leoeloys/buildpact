# Story 15.2: Audit Trail Export

Status: review

## Story

As a project lead or compliance reviewer,
I want to export BuildPact audit trail data as JSON or CSV,
so that I can analyze pipeline usage, generate compliance reports, and integrate with external tools.

## Acceptance Criteria

**AC-1: JSON Export**

Given `.buildpact/audit/` contains JSONL session log files
When I run `bp audit export --format json`
Then a single valid JSON array is written to stdout (or to a file with `--output`)
And each entry contains timestamp, command, session ID, and outcome fields

**AC-2: CSV Export**

Given `.buildpact/audit/` contains JSONL session log files
When I run `bp audit export --format csv`
Then a valid CSV with headers is written to stdout (or to a file with `--output`)
And the CSV columns match the JSON field names

**AC-3: Date Range Filtering**

Given audit logs span multiple months
When I run `bp audit export --format json --from 2026-01-01 --to 2026-03-01`
Then only entries with timestamps within the specified range are included
And entries outside the range are excluded

**AC-4: Command Type Filtering**

Given audit logs contain entries for specify, plan, execute, and verify commands
When I run `bp audit export --format json --command plan`
Then only entries where the command field matches "plan" are included

**AC-5: Empty Result Handling**

Given no audit entries match the filter criteria
When the export runs
Then the system outputs an empty JSON array `[]` or CSV with headers only
And displays an informational message "No audit entries match the given filters"

## Tasks / Subtasks

- [x] Task 1: Create audit export module (AC: #1, #2)
  - [x] 1.1: Create `src/commands/audit/handler.ts` with `handleAuditExport(options)` returning `Result<string>`
  - [x] 1.2: Implement JSONL file reader that aggregates all `.buildpact/audit/*.jsonl` files
  - [x] 1.3: Implement JSON formatter (pretty-printed array)
  - [x] 1.4: Implement CSV formatter with header row

- [x] Task 2: Implement filtering (AC: #3, #4, #5)
  - [x] 2.1: Add date range filter (`--from`, `--to`) with ISO date parsing
  - [x] 2.2: Add command type filter (`--command`)
  - [x] 2.3: Handle empty results with informational message via i18n

- [x] Task 3: Register CLI command (AC: all)
  - [x] 3.1: Create `src/commands/audit/index.ts` with yargs command definition
  - [x] 3.2: Register `audit export` subcommand in `src/commands/registry.ts`
  - [x] 3.3: Add `--output` flag for file output (default: stdout)

- [x] Task 4: i18n and tests (AC: all)
  - [x] 4.1: Add EN/PT-BR strings for audit export messages
  - [x] 4.2: Unit tests in `test/unit/commands/audit-export.test.ts` with fixture JSONL data
  - [x] 4.3: Test each filter combination and both output formats

## Dev Notes

### Project Structure Notes

- Audit log format: JSONL files in `.buildpact/audit/` — one line per event, each line is valid JSON
- Existing `AuditLogger` in `src/foundation/audit.ts` writes these files — read its format to understand the schema
- The `bp audit` command is new — create `src/commands/audit/index.ts` as a yargs command with `export` subcommand
- Use `Result<T, CliError>` pattern — never throw
- CSV conversion: simple join with comma, quote fields containing commas

### References

- `.buildpact/audit/cli.jsonl` — existing audit log file (check format)
- `src/foundation/audit.ts` — AuditLogger class, log entry schema
- `src/commands/registry.ts` — where to register the new command
- `src/contracts/errors.ts` — Result type, ERROR_CODES

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Created `handleAuditExport()` with Result<string> pattern
- `readAuditEntries()` aggregates all .jsonl files from .buildpact/audit/
- `filterEntries()` supports --from, --to (inclusive), --command filters
- `formatJson()` produces pretty-printed JSON array
- `formatCsv()` produces CSV with proper field escaping
- Registered `audit` command in registry with `export` subcommand
- 30 unit tests covering all filter combinations and edge cases

### File List
- src/commands/audit/handler.ts (new)
- src/commands/audit/index.ts (new)
- src/commands/registry.ts (modified — added 'audit' to CommandId and REGISTRY)
- locales/en.yaml (modified — cli.audit.* keys)
- locales/pt-br.yaml (modified — cli.audit.* keys)
- test/unit/commands/audit-export.test.ts (new — 30 tests)

### Change Log
- 2026-03-22: All tasks completed, all tests passing
