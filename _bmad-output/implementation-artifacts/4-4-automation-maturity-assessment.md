
# Story 4.4: Automation Maturity Assessment

Status: done

## Story

As a developer deciding how to implement a task,
I want `/bp:specify` to evaluate my task against a 5-stage automation maturity model and recommend the right level,
So that I don't over-engineer manual tasks or under-engineer tasks that deserve full automation.

## Acceptance Criteria

1. **5-Stage Model Evaluation**
   - Given I complete the specification for a task
   - When the Automation Maturity Advisor runs via `assessAutomationMaturity()`
   - Then it asks 3 questions: task frequency, predictability, human decision requirements
   - And `scoreMaturity()` evaluates the answers (score 0–9) to recommend one of: Manual (1), Documented Skill (2), Alias (3), Heartbeat Check (4), Full Automation (5)

2. **Recommendation in spec.md**
   - Given the assessment completes
   - When `buildSpecContent()` generates the spec
   - Then it includes `## Automation Maturity Assessment` section with: recommended stage name, score, justification text
   - And the justification follows the format: "This task {frequency_label}, {predictability_label}, and {human_decision_label} (score: N/9). {stage_description}"

3. **User Override**
   - Given the advisor recommends a stage
   - When I select "Override — choose a different stage"
   - Then a stage selector (1–5) is presented
   - And the spec notes `> Override applied: original recommendation was Stage N — {Name}`
   - And `MaturityAssessmentResult.isOverride === true` and `originalStage` is set

4. **No Over-Engineering for Manual Tasks**
   - Given frequency=rarely AND predictability=highly_variable AND humanDecisions=complex_expertise
   - When `scoreMaturity()` is called
   - Then it returns `{ stage: 1, name: 'Manual', score: 0 }` (score ≤1 → Stage 1)

5. **Full Automation for Routine Tasks**
   - Given frequency=multiple_daily AND predictability=always_same AND humanDecisions=none_needed
   - When `scoreMaturity()` is called
   - Then it returns `{ stage: 5, name: 'Full Automation', score: 9 }` (score 8–9 → Stage 5)

6. **Maturity Section in specify.md Orchestrator**
   - Given Stories 4.1–4.3 established the orchestrator
   - When Story 4.4 adds the maturity section
   - Then `templates/commands/specify.md` includes `## Automation Maturity Assessment` documenting the 3-question flow, scoring heuristic, and override mechanism
   - And specify.md total remains ≤300 lines

## Tasks / Subtasks

- [x] Task 1: Add `## Automation Maturity Assessment` section to `templates/commands/specify.md` (AC: #6)
  - [x] 1.1: After Squad questions section, add maturity assessment step
  - [x] 1.2: Document 3 questions: frequency (4 options), predictability (4 options), human decisions (4 options)
  - [x] 1.3: Document scoring heuristic: frequency(0–3) + predictability(0–3) + humanDecisions(0–3) = 0–9 total; thresholds: ≤1→Stage1, ≤3→Stage2, ≤5→Stage3, ≤7→Stage4, ≥8→Stage5
  - [x] 1.4: Document stage names: 1=Manual, 2=Documented Skill, 3=Alias, 4=Heartbeat Check, 5=Full Automation
  - [x] 1.5: Document override flow: display recommendation → prompt keep/change → if change: stage selector 1–5 → annotate spec with override note
  - [x] 1.6: Add Web Bundle mode variant: clack.text with embedded numbered options for all 3 questions + override prompt
  - [x] 1.7: Final step in specify.md: write spec.md, trigger `on_specify_complete` hook, audit log
  - [x] 1.8: Verify specify.md total ≤300 lines (hard limit) — 221 lines

- [x] Task 2: Add integration test for full specify pipeline (AC: #1, #2, #3)
  - [x] 2.1: Created `test/integration/pipeline/specify-flow.test.ts`
  - [x] 2.2: Test: full expert mode flow → `handler.run(['users', 'reset', 'their', 'password'])` with mocked maturity selects → spec.md contains `## Automation Maturity Assessment` — passes
  - [x] 2.3: Test: override flow → mock maturity selects + override change → `Override applied` appears in spec — passes
  - [x] 2.4: Uses tmp directory, real file writes, mocks only @clack/prompts and AuditLogger

- [x] Task 3: Add maturity snapshot schema (AC: #2, #3)
  - [x] 3.1: Created `test/snapshots/specify/with-maturity.schema.ts` with all required fields
  - [x] 3.2: Test: `buildSpecContent({ maturityAssessment: { stage: 3, ... } })` → contains `## Automation Maturity Assessment` — passes
  - [x] 3.3: Test: `buildSpecContent({ maturityAssessment: { ..., isOverride: true, originalStage: 2 } })` → contains `> Override applied` — passes
  - [x] 3.4: Test: `buildSpecContent({})` → does NOT contain `## Automation Maturity Assessment` — passes

- [x] Task 4: Verify `scoreMaturity()` edge cases (AC: #4, #5)
  - [x] 4.1: Run `npx vitest run test/unit/commands/specify.test.ts -t "scoreMaturity"` — passed
  - [x] 4.2: Edge cases covered in with-maturity.test.ts: score=0→Stage1, score=9→Stage5, score=5→Stage3 boundary, score=1→Stage1 boundary

- [x] Task 5: Run full test suite (AC: all)
  - [x] 5.1: `npx vitest run` — 1639 tests, 60 files, all pass, zero regressions
  - [x] 5.2: Verify `specify.md` line count ≤300 — 221 lines (final count after all 4 stories)
  - [x] 5.3: Run `npx vitest run test/integration/pipeline/specify-flow.test.ts` — 2 tests pass

## Dev Notes

### What Was Already Built (DO NOT REBUILD)

| Asset | Location | Notes |
|-------|----------|-------|
| `scoreMaturity(input: MaturityAssessmentInput): MaturityAssessmentResult` | `handler.ts` | Pure function, full scoring logic |
| `assessAutomationMaturity(i18n, isWebBundle)` | `handler.ts` | Interactive 3-question flow; CLI + Web Bundle mode |
| `MaturityStage` type (1–5) | `handler.ts` | `type MaturityStage = 1 \| 2 \| 3 \| 4 \| 5` |
| `MaturityAssessmentInput` | `handler.ts` | `{ frequency, predictability, humanDecisions }` |
| `MaturityAssessmentResult` | `handler.ts` | `{ stage, name, score, justification, isOverride, originalStage? }` |
| `STAGE_NAMES`, `STAGE_DESCRIPTIONS` | `handler.ts` | All 5 stage names and descriptions |
| `buildSpecContent()` — Maturity section | `handler.ts` | Renders section conditionally; includes override note when `isOverride === true` |
| EN + PT-BR i18n keys | `locales/` | All `cli.specify.maturity_*` keys defined (stage names, override prompts, etc.) |

### Scoring Algorithm (for Orchestrator Documentation)

```
frequency:        multiple_daily=3, daily=2, weekly=1, rarely=0
predictability:   always_same=3, mostly_predictable=2, varies=1, highly_variable=0
humanDecisions:   none_needed=3, minor=2, significant=1, complex_expertise=0

total = sum of all three scores (0–9)
stage: total ≤1 → 1 (Manual), ≤3 → 2 (Documented Skill), ≤5 → 3 (Alias), ≤7 → 4 (Heartbeat Check), ≥8 → 5 (Full Automation)
```

### Justification Format (for Spec Content Reference)

The justification string follows:
`"This task {freq_label}, {pred_label}, and {human_label} (score: N/9). {stage_description}"`

Example: "This task runs rarely or ad hoc, steps are always identical, and requires only minor decisions (score: 3/9). Document as a runbook or step-by-step guide — suitable for reproducible but human-executed processes."

### 300-Line Budget — Final Count (specify.md)

| Story | Section | Lines Added | Cumulative |
|-------|---------|------------|-----------|
| 4.1 | Base orchestrator | ~215 | ~215 |
| 4.2 | Ambiguity Detection | ~25 | ~240 |
| 4.3 | Squad Domain Questions | ~30 | ~270 |
| 4.4 | Automation Maturity Assessment + final steps | ~25 | ~295 |

Target: ≤300 lines. After 4.4, the orchestrator should be at ~295 lines. If over 300, trim Implementation Notes or merge concise sections.

### Integration Test Pattern

The integration test follows the same pattern as `test/unit/commands/specify.test.ts` integration section:
```typescript
// test/integration/pipeline/specify-flow.test.ts
vi.mock('@clack/prompts', () => ({ ... }))
vi.mock('../../../src/foundation/audit.js', () => ({ AuditLogger: class { log = vi.fn() } }))

it('full pipeline: expert mode with maturity assessment writes spec.md', async () => {
  tmpDir = await mkdtemp(...)
  // mock clack.select for 4 maturity calls + keep
  vi.mocked(clack.select).mockResolvedValueOnce('daily').mockResolvedValueOnce('always_same')
    .mockResolvedValueOnce('minor').mockResolvedValueOnce('keep')
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  const { handler } = await import('../../../src/commands/specify/handler.js')
  const result = await handler.run(['users', 'reset', 'their', 'password'])
  expect(result.ok).toBe(true)
  const spec = await readFile(join(tmpDir, '.buildpact', 'specs', 'users-reset-their-password', 'spec.md'), 'utf-8')
  expect(spec).toContain('## Automation Maturity Assessment')
  expect(spec).toContain('Documented Skill')
})
```

### NFR Compliance

| NFR | Compliance |
|-----|------------|
| NFR-02 | specify.md ≤300 lines — final line count check in Task 5.2 |
| NFR-23 | Maturity stage + score + isOverride included in audit log (via `handler.run()` existing audit.log call) |

### Epic 4 Completion Note

Story 4.4 is the final story in Epic 4. After completion:
- `templates/commands/specify.md` is fully implemented (≤300 lines)
- All 4 specify pipeline concerns are covered: NL capture, ambiguity, Squad, maturity
- Both Prompt Mode (specify.md) and CLI Mode (handler.ts) are complete
- Full test coverage: unit tests (specify.test.ts) + snapshot schemas + integration test
- Update sprint-status.yaml: epic-4 status → in-progress (automatically via story creation); update to done when all stories are done

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic4-Story4.4] — User story and AC
- [Source: src/commands/specify/handler.ts#scoreMaturity] — Scoring algorithm (pure function)
- [Source: src/commands/specify/handler.ts#assessAutomationMaturity] — Interactive assessment flow
- [Source: src/commands/specify/handler.ts#buildSpecContent] — Maturity section rendering + override note
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR-02] — Orchestrator ≤300 line hard limit
- [Source: templates/commands/specify.md] — Prerequisite: Stories 4.1, 4.2, 4.3 must be complete

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `## Automation Maturity Assessment` section to `templates/commands/specify.md` with 3-question flow, scoring heuristic table, stage names, override mechanism, and Web Bundle mode variant
- Created integration test `test/integration/pipeline/specify-flow.test.ts` — 2 tests: full expert mode pipeline and override flow
- Created `test/snapshots/specify/with-maturity.schema.ts` and `with-maturity.test.ts` — 7 tests covering presence/absence, override note, and scoreMaturity() edge cases
- specify.md final line count: 221 lines (well within 300-line limit)
- All 1639 tests pass across 60 test files (zero regressions)
- Epic 4 complete: templates/commands/specify.md fully implemented covering all 4 stories

### File List

- templates/commands/specify.md (modified — added Automation Maturity Assessment section + File Output final steps)
- test/integration/pipeline/specify-flow.test.ts (new)
- test/snapshots/specify/with-maturity.schema.ts (new)
- test/snapshots/specify/with-maturity.test.ts (new)
