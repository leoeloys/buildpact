# Story 16.2: Squad Smoke Test Runner

Status: ready-for-dev

## Story

As a squad creator or maintainer,
I want to run `bp squad test <squad-name>` to execute a validation suite against a squad,
so that I can verify agent loading, voice DNA parsing, autonomy checks, and domain question flows before publishing or deploying the squad.

## Acceptance Criteria

**AC-1: Agent Loading Validation**

Given a squad is installed at `.buildpact/squads/<squad-name>/`
When I run `bp squad test <squad-name>`
Then each agent file listed in `squad.yaml` is loaded and parsed
And missing agent files are reported as failures

**AC-2: Structural Validation**

Given a squad with agent files
When the test runner validates structure
Then each agent is checked for: 6-layer anatomy completeness, Voice DNA 5-section template, minimum anti-pattern pairs (>=5), minimum heuristics (>=3 with at least one VETO), minimum examples (>=3), at least one handoff entry
And results are displayed per agent with pass/fail counts

**AC-3: Domain Question Flow Validation**

Given a squad has `domain_questions` defined in `squad.yaml`
When the test runner validates domain questions
Then each question is checked for: non-empty text, valid field type, correct section reference
And questions with missing or invalid fields are reported

**AC-4: Test Summary Report**

Given all validation checks complete
When results are displayed
Then a summary shows: total checks, passed, failed, warnings
And exit code is 0 for all-pass, 1 for any failure
And results are also written to `.buildpact/reports/squad-test-{squad-name}.md`

## Tasks / Subtasks

- [ ] Task 1: Implement test runner framework (AC: #1, #4)
  - [ ] 1.1: Create `src/commands/squad/test-runner.ts` with `runSquadTests(squadDir)` returning `Result<SquadTestReport>`
  - [ ] 1.2: Define `SquadTestResult` type: `{ check: string, agent?: string, passed: boolean, message: string }`
  - [ ] 1.3: Implement test summary formatter with pass/fail counts and colored output

- [ ] Task 2: Implement validation checks (AC: #1, #2, #3)
  - [ ] 2.1: Reuse `validateSquadStructure()` from `src/engine/squad-scaffolder.ts` for structural validation
  - [ ] 2.2: Reuse `validateHandoffGraph()` for handoff consistency checks
  - [ ] 2.3: Implement domain question validation (non-empty text, valid field types)
  - [ ] 2.4: Implement agent loading check (all files in squad.yaml exist and parse)

- [ ] Task 3: Wire CLI subcommand (AC: #4)
  - [ ] 3.1: Add `test` subcommand to `bp squad` in `src/commands/squad/handler.ts`
  - [ ] 3.2: Write report to `.buildpact/reports/squad-test-{squad-name}.md`
  - [ ] 3.3: Set process exit code based on test results

- [ ] Task 4: i18n and tests (AC: all)
  - [ ] 4.1: Add EN/PT-BR strings for test runner output
  - [ ] 4.2: Unit tests using the bundled Software Squad as a known-good fixture
  - [ ] 4.3: Unit tests with deliberately broken squad fixtures (missing agents, invalid structure)

## Dev Notes

### Project Structure Notes

- Reuse existing validation from `src/engine/squad-scaffolder.ts` — `validateSquadStructure()` and `validateHandoffGraph()` already do most of the heavy lifting
- The `bp squad` command exists — add `test` as a new subcommand alongside existing `add`/`list`/`remove`
- Existing test `test/unit/engine/software-squad.test.ts` validates the Software Squad — use similar checks but wrap in a CLI-invocable runner
- Exit code behavior: use `process.exitCode = 1` for failures (don't `process.exit()` to allow cleanup)
- Report format: markdown with pass/fail checkmarks per check per agent

### References

- `src/engine/squad-scaffolder.ts` — validateSquadStructure(), validateHandoffGraph()
- `src/commands/squad/handler.ts` — existing squad command handler
- `test/unit/engine/software-squad.test.ts` — reference for validation check patterns
- `templates/squads/software/` — known-good squad for smoke test validation

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
### File List
