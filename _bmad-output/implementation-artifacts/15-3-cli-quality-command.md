# Story 15.3: CLI Quality Command (Crivo)

Status: review

## Story

As a project lead running BuildPact from the CLI,
I want a `bp quality` command that generates an ISO 9001-inspired quality report,
so that I can assess pipeline compliance, traceability, and quality metrics without relying on IDE slash commands.

## Acceptance Criteria

**AC-1: Artifact Inventory Scan**

Given a project with `.buildpact/` containing specs, plans, and execution artifacts
When I run `bp quality`
Then the system scans `.buildpact/` and displays an inventory count of specs, plans, executions, and verifications
And flags incomplete pipeline chains (e.g., spec without plan, plan without execution)

**AC-2: Process Compliance Check**

Given completed pipeline runs with audit log entries
When the quality report runs
Then it checks each run for: constitution consulted, readiness gate passed, budget limits respected, adversarial review performed
And displays compliance percentage per gate

**AC-3: Quality Metrics Table**

Given pipeline history data exists
When the quality report is generated
Then it displays a metrics table with: first-pass yield (% ACs passed first time), traceability coverage, process compliance, adversarial density
And each metric shows current value vs target threshold

**AC-4: Non-Conformance Report**

Given quality issues are detected
When the report completes
Then issues are listed by severity (CRITICAL, MAJOR, MINOR) with root cause and corrective/preventive action
And the full report is saved to `.buildpact/reports/quality-report.md`

**AC-5: Audit Log Entry**

Given the quality command completes
When the report is generated
Then an audit log entry with action `quality.report` is recorded

## Tasks / Subtasks

- [x] Task 1: Implement quality scan engine (AC: #1, #2)
  - [x] 1.1: Create `src/commands/quality/scanner.ts` with `scanArtifactInventory(projectDir)` — walks `.buildpact/` tree
  - [x] 1.2: Implement pipeline chain completeness check (spec → plan → execution → verification)
  - [x] 1.3: Implement process compliance checker reading audit logs for constitution/readiness/budget/adversarial events

- [x] Task 2: Implement metrics and reporting (AC: #3, #4)
  - [x] 2.1: Created quality metric calculators in `src/commands/quality/scanner.ts` (combined with scanner)
  - [x] 2.2: Implement non-conformance classifier (CRITICAL/MAJOR/MINOR severity)
  - [x] 2.3: Implement report writer to `.buildpact/reports/quality-report.md`

- [x] Task 3: Wire CLI handler (AC: #1-#5)
  - [x] 3.1: Replace guidance-only handler in `src/commands/quality/index.ts` with full implementation
  - [x] 3.2: Format output using @clack/prompts (tables, sections, colored severity)
  - [x] 3.3: Add audit log entry via AuditLogger

- [x] Task 4: i18n and tests (AC: all)
  - [x] 4.1: EN/PT-BR strings already present from Alpha for quality report output
  - [x] 4.2: Unit tests for scanner, metrics calculator, and non-conformance classifier
  - [x] 4.3: Integration test with fixture `.buildpact/` directory

## Dev Notes

### Project Structure Notes

- The quality command already exists as IDE-only slash command — spec is in `templates/commands/quality.md`
- CLI handler stub exists at `src/commands/quality/handler.ts` — currently just shows guidance; replace with full implementation
- Follow the 5-step flow defined in `templates/commands/quality.md`: Inventory → Compliance → Metrics → Non-Conformance → Recommendations
- Output report to `.buildpact/reports/quality-report.md` (create reports dir if needed)
- No subagent dispatch — pure filesystem scan + metric calculation
- Use `Result<QualityReport, CliError>` return type

### References

- `templates/commands/quality.md` — full specification (ISO 9001-inspired 5-step flow)
- `src/commands/quality/` — existing stub handler
- `src/foundation/audit.ts` — AuditLogger for recording quality.report action
- `.buildpact/audit/` — audit logs to check for compliance events

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Replaced guidance-only stub with full 5-step quality flow
- scanArtifactInventory walks .buildpact/ for specs, plans, executions, verifications
- buildPipelineChains checks spec->plan->execution->verification completeness
- checkProcessCompliance reads audit logs for constitution/readiness/budget/adversarial gates
- calculateMetrics computes first-pass yield, traceability, compliance, adversarial density
- detectNonConformances classifies issues as CRITICAL/MAJOR/MINOR
- Report written to .buildpact/reports/quality-report.md
- Reuses audit handler's readAuditEntries for log reading
- 18 unit tests all passing

### File List
- src/commands/quality/scanner.ts (new)
- src/commands/quality/index.ts (modified — full implementation replacing stub)
- test/unit/commands/quality-scanner.test.ts (new — 18 tests)

### Change Log
- 2026-03-22: All tasks completed, all tests passing
