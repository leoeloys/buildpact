
# Story 4.2: Ambiguity Detection and Clarification Flow

Status: done

## Story

As a developer describing a requirement with inherent ambiguities,
I want the framework to detect unclear points and offer me structured choices to resolve them,
So that the final spec reflects my actual intent rather than the framework's best guess.

## Acceptance Criteria

1. **Ambiguity Detection**
   - Given `/bp:specify` receives a description containing known ambiguous phrases (e.g., "quickly", "fast", "secure", "easy", "scalable")
   - When the clarification flow is triggered
   - Then `detectAmbiguities()` returns matching patterns with ≥3 numbered options each

2. **Clarification Options — Minimum 3 + "Other"**
   - Given ambiguities are detected
   - When `runClarificationFlow()` presents options
   - Then the framework presents at least 3 numbered options per detected ambiguity
   - And an "Other (free text)" option is always the final choice (`cli.specify.clarification_other`)
   - And the user's selections are incorporated into the generated `spec.md` as `## Clarifications` table

3. **No Questions When Clear**
   - Given no ambiguities are detected in the description
   - When the spec is generated
   - Then `detectAmbiguities()` returns an empty array and the clarification flow is skipped entirely
   - And the generated spec has no `## Clarifications` section

4. **Clarification Section in spec.md**
   - Given ambiguities were resolved
   - When spec.md is written
   - Then it contains `## Clarifications` with a table: `| Ambiguity | Question | Answer |`
   - And each resolved ambiguity appears as a row with `phrase`, `question`, `answer`

5. **Ambiguity Section in specify.md Orchestrator**
   - Given Story 4.1 has established the base `templates/commands/specify.md` orchestrator
   - When Story 4.2 is implemented
   - Then the orchestrator includes an `## Ambiguity Detection` section that describes when to trigger the clarification flow and how to present numbered options in Prompt Mode

## Tasks / Subtasks

- [x] Task 1: Add `## Ambiguity Detection` section to `templates/commands/specify.md` (AC: #5)
  - [x] 1.1: After the NL input capture (beginner wizard or expert description), add ambiguity detection step
  - [x] 1.2: Document the 12 known patterns: quickly, fast, real-time, easy, simple, secure, scalable, some, several, appropriate, modern, large — each with ≥3 options
  - [x] 1.3: Add clarification prompt format: numbered list + "Other (free text)" as last option
  - [x] 1.4: Add rule: if no ambiguities → skip clarification section entirely; never add `## Clarifications` to spec
  - [x] 1.5: Add Web Bundle mode variant: embed numbered options in clack.text message (no clack.select in Web Bundle)
  - [x] 1.6: Verify specify.md total still ≤300 lines after addition — 221 lines total

- [x] Task 2: Verify `detectAmbiguities()` and `runClarificationFlow()` — no new implementation needed (AC: #1, #2, #3)
  - [x] 2.1: Run `npx vitest run test/unit/commands/specify.test.ts -t "detectAmbiguities"` — passed
  - [x] 2.2: Run `npx vitest run test/unit/commands/specify.test.ts -t "runClarificationFlow"` — passed
  - [x] 2.3: Run `npx vitest run test/unit/commands/specify.test.ts -t "ambiguity clarification integration"` — passed

- [x] Task 3: Add clarification snapshot schema to `test/snapshots/specify/` (AC: #4)
  - [x] 3.1: Created `test/snapshots/specify/with-clarifications.schema.ts` with `required_section: '## Clarifications'`, `required_table_headers: ['Ambiguity', 'Question', 'Answer']`
  - [x] 3.2: Test: `buildSpecContent({ clarifications: [...] })` → spec contains `## Clarifications` table — passes
  - [x] 3.3: Test: `buildSpecContent({ clarifications: [] })` → spec does NOT contain `## Clarifications` — passes

- [x] Task 4: Run full test suite (AC: all)
  - [x] 4.1: `npx vitest run` — 1639 tests pass, zero regressions
  - [x] 4.2: Verify `specify.md` line count ≤300 — 221 lines

## Dev Notes

### What Was Already Built (DO NOT REBUILD)

| Asset | Location | Notes |
|-------|----------|-------|
| `detectAmbiguities(input: string): Ambiguity[]` | `src/commands/specify/handler.ts` | Scans 12 patterns; dedupes; case-insensitive; pure function |
| `runClarificationFlow(ambiguities, i18n, isWebBundle)` | `src/commands/specify/handler.ts` | Full clack.select flow with "Other" free-text option |
| `AMBIGUITY_PATTERNS` | `handler.ts` | 12 patterns: quickly, fast, real-time, easy, simple, secure, scalable, some, several, appropriate, modern, large |
| `ClarificationAnswer` interface | `handler.ts` | `{ phrase, question, answer }` |
| `buildSpecContent()` — clarifications section | `handler.ts` | Renders `## Clarifications` table when `clarifications.length > 0` |
| Existing unit tests | `test/unit/commands/specify.test.ts` | detectAmbiguities, runClarificationFlow, buildSpecContent with clarifications, handler integration |

**Story 4.2 primary work:** Adding the `## Ambiguity Detection` section to `templates/commands/specify.md` only. All TypeScript is complete.

### Ambiguity Detection Algorithm (for Orchestrator Documentation)

The Markdown orchestrator must document the pattern approach so Prompt Mode hosts understand the rule:

1. Scan `{{description}}` (or combined wizard answers) for known phrases (case-insensitive)
2. For each matched phrase: display `{{phrase.question}}` with numbered options
3. "Other (free text)" is always option N+1
4. Collect answers as `phrase → answer` pairs
5. Skip entirely if no patterns matched
6. Include answers in spec as `## Clarifications` table

**Known patterns reference for orchestrator:**
- `quickly` → "How quickly should this happen?" (4 options: Under 1s / Under 5s / Under 30s / No limit)
- `fast` → "What does 'fast' mean in this context?" (4 options)
- `real-time` → latency requirement (4 options)
- `easy` / `simple` → usability definition (4 options each)
- `secure` → security level (4 options: HTTPS+auth / MFA / RBAC / compliance standard)
- `scalable` → scale target (4 options: 1K / 10K / auto-scale / 10× headroom)
- `some` / `several` / `large` / `appropriate` / `modern` → quantification (4 options each)

### Web Bundle Mode Difference

In Web Bundle mode (`mode: web-bundle` in config.yaml), clack.select is NOT available.
The orchestrator must use clack.text with the numbered options embedded in the message string:
```
message: `How quickly? \n1. Under 1 second\n2. Under 5 seconds\n3. Under 30 seconds\n4. No limit\n5. Other`
```
This distinction must be explicit in the specify.md Ambiguity section.

### 300-Line Budget (specify.md)

Story 4.1 established the base orchestrator at ~215 lines.
The `## Ambiguity Detection` section adds ~25 lines.
Running total after 4.2: ~240 lines (well within 300).

### NFR Compliance

| NFR | Compliance |
|-----|------------|
| NFR-02 | specify.md ≤300 lines after Story 4.2 additions |
| NFR-23 | Ambiguity detection + clarification answers included in audit log (`specify.create` action) |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic4-Story4.2] — User story and AC
- [Source: src/commands/specify/handler.ts#detectAmbiguities] — Detection algorithm (pure function)
- [Source: src/commands/specify/handler.ts#runClarificationFlow] — Interactive flow implementation
- [Source: src/commands/specify/handler.ts#buildSpecContent] — Clarifications section rendering
- [Source: templates/commands/specify.md] — Prerequisite: Story 4.1 must be complete
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR-02] — Orchestrator ≤300 line limit

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `## Ambiguity Detection` section to `templates/commands/specify.md` documenting all 12 patterns with options table, Web Bundle mode variant, and skip rule
- Created `test/snapshots/specify/with-clarifications.schema.ts` and `with-clarifications.test.ts` — 8 tests covering presence/absence of clarifications section and detectAmbiguities() behavior
- All tests pass (1639 total, zero regressions)

### File List

- templates/commands/specify.md (modified — added Ambiguity Detection section)
- test/snapshots/specify/with-clarifications.schema.ts (new)
- test/snapshots/specify/with-clarifications.test.ts (new)
