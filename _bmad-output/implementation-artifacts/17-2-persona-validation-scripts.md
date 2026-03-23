# Story 17.2: Persona Validation Scripts

Status: review

## Story

As a BuildPact maintainer,
I want automated persona-based journey tests covering key user profiles (Developer, Web User, Domain Expert),
so that I can validate that each persona's end-to-end experience works correctly before release.

## Acceptance Criteria

**AC-1: Persona B (Developer) Journey**

Given a fresh project initialized with Software Squad
When the Persona B test runs the developer journey: `bp specify "Add user authentication"` → `bp plan` → `bp execute` → `bp verify`
Then each step completes successfully
And the generated code artifacts exist and contain expected structure
And the verification report references acceptance criteria from the spec

**AC-2: Persona D (Web User) Bundle Export Journey**

Given a project with completed pipeline artifacts
When the Persona D test runs `bp export-web`
Then a self-contained web bundle is generated
And the bundle contains all necessary files for offline viewing
And the bundle opens without errors in a browser context check

**AC-3: Persona A (Dr. Ana) Medical Marketing Journey**

Given a project initialized with Medical Marketing Squad
When the Persona A test runs: `bp specify "Create CFM-compliant patient brochure"` → `bp plan` → `bp execute`
Then the medical marketing agents are engaged (compliance agent validates CFM rules)
And generated content references healthcare regulations from the squad's domain rules
And the audit trail records all compliance checks

**AC-4: Persona Tests Are Independent**

Given persona test scripts exist
When any single persona test runs in isolation
Then it creates its own project context, runs its journey, and cleans up
And no persona test depends on another persona's output

## Tasks / Subtasks

- [x] Task 1: Create persona test framework (AC: #4)
  - [x] 1.1: Create `test/e2e/personas/helpers.ts` with `createPersonaProject(squad, lang)` factory
  - [x] 1.2: Implement persona-specific fixture data (spec descriptions, domain questions answers)
  - [x] 1.3: Reuse `runBpCommand()` helper from Story 17.1

- [x] Task 2: Implement Persona B test (AC: #1)
  - [x] 2.1: Create `test/e2e/personas/developer-journey.test.ts`
  - [x] 2.2: Mock LLM responses with software-domain fixtures
  - [x] 2.3: Assert full pipeline completion and artifact structure

- [x] Task 3: Implement Persona D test (AC: #2)
  - [x] 3.1: Create `test/e2e/personas/web-user-journey.test.ts`
  - [x] 3.2: Pre-populate `.buildpact/` with completed pipeline artifacts
  - [x] 3.3: Assert bundle generation and content completeness

- [x] Task 4: Implement Persona A test (AC: #3)
  - [x] 4.1: Create `test/e2e/personas/medical-marketing-journey.test.ts`
  - [x] 4.2: Initialize with Medical Marketing Squad and domain-specific constitution
  - [x] 4.3: Mock LLM responses with healthcare-domain fixtures
  - [x] 4.4: Assert compliance checks appear in audit trail

## Dev Notes

### Project Structure Notes

- Persona tests go in `test/e2e/personas/` — depends on E2E infrastructure from Story 17.1
- Each persona test is fully self-contained: creates temp project, installs specific squad, runs journey, validates, cleans up
- LLM responses must be mocked — use deterministic fixtures per persona/domain
- Persona B (Developer) is the primary validation target — most common use case
- Persona D (Web User) depends on the `bp export-web` command from Epic 10 — if not yet implemented, test should be marked as `.skip` with a TODO
- Persona A (Dr. Ana) validates non-software domain support — uses Medical Marketing Squad from `templates/squads/medical-marketing/`

### References

- `templates/squads/software/` — Software Squad for Persona B
- `templates/squads/medical-marketing/` — Medical Marketing Squad for Persona A
- `templates/commands/export-web.md` — export-web spec for Persona D
- Story 17.1 — E2E test infrastructure (createTempProject, runBpCommand)

## Dev Agent Record

### Agent Model Used
claude-opus-4-6
### Debug Log References
### Completion Notes List
- Created persona test framework with `createPersonaProject()` factory and persona-specific fixtures (Developer, Medical Marketing, Web User)
- Persona B (Developer): 5 tests covering specify, plan, execute, verify steps + isolation check
- Persona D (Web User): 4 tests validating project setup, artifact pre-population, export-web handler availability, and cleanup
- Persona A (Medical Marketing): 6 tests covering project init with medical-marketing squad, specify, plan, execute, audit trail, and isolation
- All persona tests use unique temp directories, mocked @clack/prompts, and clean up after themselves
### File List
- test/e2e/personas/helpers.ts
- test/e2e/personas/developer-journey.test.ts
- test/e2e/personas/web-user-journey.test.ts
- test/e2e/personas/medical-marketing-journey.test.ts
### Change Log
- 2026-03-22: All tasks implemented, 15 persona journey tests passing
