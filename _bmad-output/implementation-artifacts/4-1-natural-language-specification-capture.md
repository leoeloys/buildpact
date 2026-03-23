
# Story 4.1: Natural Language Specification Capture

Status: done

## Story

As a developer or domain expert,
I want to run `/bp:specify` and describe what I need in plain natural language,
So that the framework produces a structured `spec.md` with user stories and acceptance criteria without me having to know any technical implementation details.

## Acceptance Criteria

1. **NL Input — Expert Mode**
   - Given I run `/bp:specify "add user authentication with email and Google OAuth"`
   - When the specify flow begins
   - Then the framework accepts plain natural language input and explicitly warns (not blocks) when the input contains implementation detail keywords (e.g., `function `, `class `, `api endpoint`)
   - And the warning uses i18n key `cli.specify.impl_detail_warn`

2. **Beginner Mode — Guided Wizard**
   - Given `experience: beginner` is set in `.buildpact/config.yaml`
   - When I run `/bp:specify` without arguments
   - Then 5 sequential questions are presented: persona, goal, motivation, successOutcome, constraints (Ctrl+C to skip constraints)
   - And the wizard uses `runBeginnerWizard()` from `src/commands/specify/handler.ts`

3. **spec.md Generation — Required Sections**
   - Given the specification flow completes (either mode)
   - When `spec.md` is generated
   - Then it contains: `## User Story`, `## Acceptance Criteria` (Given/When/Then), `## Functional Requirements`, `## Non-Functional Requirements`, `## Assumptions`, `## Constitution Self-Assessment`
   - And is saved to `.buildpact/specs/{{feature_slug}}/spec.md`

4. **Orchestrator Markdown File**
   - Given `templates/commands/specify.md` is executed as a slash command
   - When a user runs `/bp:specify` in Claude Code or Cursor
   - Then the Markdown orchestrator guides the model through the exact same flow as `handler.ts`
   - And the file is ≤300 lines with the standard orchestrator header comment

5. **Snapshot Schema**
   - Given a spec is generated
   - When `test/snapshots/specify/basic-feature.schema.ts` runs
   - Then it validates: required sections present, frontmatter fields, minimum 1 user story, minimum 1 AC

## Tasks / Subtasks

- [x] Task 1: Implement `templates/commands/specify.md` — core specify orchestrator (AC: #4)
  - [x] 1.1: Add standard orchestrator header: `<!-- ORCHESTRATOR: specify | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->`
  - [x] 1.2: Add `## Description Parsing` section — read `{{description}}` from args; detect `experience_level` from `.buildpact/config.yaml`; branch to beginner or expert mode
  - [x] 1.3: Add `## Beginner Mode` section — 5 sequential questions (persona/goal/motivation/success/constraints); implementation detail detection warning; slug generation; proceed to Constitution Validation
  - [x] 1.4: Add `## Expert Mode` section — use `{{description}}` arg if provided; prompt for NL description if empty; implementation detail detection warning; proceed to Constitution Validation
  - [x] 1.5: Add `## Spec Generation` section — build spec.md with all 6 required sections; include Metadata block (task ID, type, constitution path, generated timestamp); explain Given/When/Then AC format for beginner mode
  - [x] 1.6: Add `## Constitution Validation` section — call `enforceConstitutionOnOutput()` from `src/engine/orchestrator.ts`; violations are non-blocking (log + annotate spec)
  - [x] 1.7: Add `## File Output` section — `mkdir -p .buildpact/specs/{{feature_slug}}/`; write spec.md; audit log with `specify.create` action
  - [x] 1.8: Add `## Implementation Notes` section (for Agent Mode wrapper reference)
  - [x] 1.9: Verify total line count ≤300 lines (hard CI constraint — same as quick.md) — 221 lines

- [x] Task 2: Create `test/snapshots/specify/basic-feature.schema.ts` (AC: #5)
  - [x] 2.1: Export `specSchema` constant with `required_sections: ['User Story', 'Acceptance Criteria', 'Functional Requirements', 'Non-Functional Requirements', 'Assumptions', 'Constitution Self-Assessment']`
  - [x] 2.2: Export `specFrontmatterFields: ['feature', 'created_at', 'squad', 'status']` (matches architecture snapshot strategy)
  - [x] 2.3: Export `minStories: 1`, `minAcceptanceCriteria: 1`
  - [x] 2.4: Add schema validation test in `test/snapshots/specify/basic-feature.test.ts` — generate a spec via `buildSpecContent()` and verify it satisfies `specSchema`

- [x] Task 3: Verify all unit tests pass (AC: #1, #2, #3)
  - [x] 3.1: Run `npx vitest run test/unit/commands/specify.test.ts` — all existing tests must pass (71 passed)
  - [x] 3.2: Run `npx vitest run test/snapshots/specify/` — new snapshot schema test must pass (30 passed)
  - [x] 3.3: Run full test suite to verify zero regressions (1639 tests, 60 files — all pass)

## Dev Notes

### What Was Already Built (DO NOT REBUILD)

| Asset | Location | Notes |
|-------|----------|-------|
| `src/commands/specify/handler.ts` | Epic 4 pre-implementation | COMPLETE — 51.4KB, all logic implemented. Do NOT recreate. |
| `runBeginnerWizard()` | `handler.ts` | 5-question wizard, all i18n wired |
| `buildSpecContent()` | `handler.ts` | Generates all 6 required spec sections |
| `detectImplementationDetails()` | `handler.ts` | Keyword-based detection, returns matched keyword |
| `handler.run()` | `handler.ts` | Full orchestration — mode detection, wizard, expert, Squad, maturity, write |
| `test/unit/commands/specify.test.ts` | 61.6KB test file | Comprehensive unit + integration tests already written |
| EN + PT-BR i18n keys | `locales/en.yaml`, `locales/pt-br.yaml` | All `cli.specify.*` keys defined |

**Critical:** The handler.ts pre-implementation already covers all AC points 1–3. The primary remaining work for Story 4.1 is:
1. Implementing `templates/commands/specify.md` as the Markdown orchestrator (Prompt Mode slash command)
2. Creating the snapshot schema tests

### Specify.md Orchestrator Design

The specify.md Markdown orchestrator follows the same pattern as `templates/commands/quick.md` (reference: 195 lines, complete implementation). Key differences for specify:

- More complex mode branching (beginner vs expert vs web-bundle)
- Multiple output sections vs a single Git commit
- Constitution validation is a **non-blocking annotation** (unlike quick's warning-then-abort)
- Squad injection and maturity assessment are covered in Stories 4.3 and 4.4 — spec.md stubs for those sections in Story 4.1

**Orchestrator section budget (≤300 lines total):**
- Header + description: ~5 lines
- Description Parsing + mode branch: ~20 lines
- Beginner Mode: ~40 lines
- Expert Mode: ~25 lines
- Spec Generation (base sections only): ~60 lines
- Constitution Validation: ~20 lines
- File Output + audit: ~20 lines
- Squad stub (placeholder for 4.3): ~5 lines
- Maturity stub (placeholder for 4.4): ~5 lines
- Implementation Notes: ~15 lines
- Total: ~215 lines (well within 300)

### Snapshot Strategy (Architecture Rule)

AI-generated content is non-deterministic. Snapshots test **structure**, not content:
```typescript
// test/snapshots/specify/basic-feature.schema.ts
export const specSchema = {
  required_sections: ['User Story', 'Acceptance Criteria', ...],
  frontmatter_fields: ['feature', 'created_at', 'squad', 'status'],
  min_stories: 1,
  min_acceptance_criteria: 1,
}
```
Never exact-match on generated prose. [Source: architecture.md#Snapshot-strategy]

### Architecture Compliance

| Constraint | Applies To |
|-----------|------------|
| Orchestrator header comment (`<!-- ORCHESTRATOR: specify ... -->`) | `specify.md` line 1 |
| ≤300 lines hard limit | `specify.md` (CI-enforced) |
| `{{snake_case}}` variable references | All Markdown orchestrators |
| Context variables: `{{description}}`, `{{experience_level}}`, `{{feature_slug}}` | specify.md parsing |
| Output: `.buildpact/specs/{{feature_slug}}/spec.md` | spec write section |
| Audit log action: `specify.create` | File Output section |

### Project Structure Notes

- `templates/commands/specify.md` → shipped with npm package (no compilation)
- `test/snapshots/specify/` → new directory, mirrors `test/snapshots/quick/` pattern
- No new npm dependencies required

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic4-Story4.1] — User story and AC
- [Source: _bmad-output/planning-artifacts/architecture.md#CLI-Command-Architecture] — Dual-layer orchestrator pattern, ≤300 line limit
- [Source: _bmad-output/planning-artifacts/architecture.md#Snapshot-strategy] — Schema-only snapshot test approach
- [Source: templates/commands/quick.md] — Reference implementation for Markdown orchestrator format
- [Source: src/commands/specify/handler.ts] — TypeScript executor (DO NOT duplicate logic)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `templates/commands/specify.md` — full orchestrator (221 lines, well within 300-line limit)
- Created `test/snapshots/specify/basic-feature.schema.ts` with `specOrchestratorSchema` and `specSchema`
- Created `test/snapshots/specify/basic-feature.test.ts` — 11 tests covering orchestrator header, sections, spec content, both beginner and expert modes
- All 71 pre-existing unit tests pass; 30 new snapshot tests pass; 1639 total tests pass (zero regressions)

### File List

- templates/commands/specify.md (new — replaced stub)
- test/snapshots/specify/basic-feature.schema.ts (new)
- test/snapshots/specify/basic-feature.test.ts (new)
