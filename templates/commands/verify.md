<!-- ORCHESTRATOR: verify | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 2.0.0 -->
<!-- STATE: {{spec_slug}}, {{spec_path}}, {{ac_verdicts}}, {{adversarial_minimum}} -->
# /bp:verify — Verification & Memory Layer

Follow each step below in exact order. Do not skip steps.

---

## STEP 1: Spec Resolution

When run without args, discovers the latest spec from `.buildpact/specs/` by
alphabetical order of slug directories. Pass an explicit spec path as the first
argument to target a specific spec:

```
/bp:verify .buildpact/specs/my-feature/spec.md
```

Store resolved path as `{{spec_path}}` and slug as `{{spec_slug}}`.

→ NEXT: STEP 2 (Guided Acceptance Test)

---

## STEP 2: Guided Acceptance Test

Loads the active `spec.md` and walks the developer through each acceptance
criterion one at a time with guidance on what to check (FR-801).

### Acceptance Criteria Extraction

Parses bullet lines (`-` or `*`) under the `## Acceptance Criteria` section.
Stops at the next `##` heading. Strips `[ ]`/`[x]` checkbox prefixes.
Strips MoSCoW tags (`[MUST]`, `[SHOULD]`, `[COULD]`) from display — show only criterion text.

### Interactive Walk-Through

For each criterion, the flow is:
1. Display criterion text and keyword-matched guidance
   (test/typecheck/lint/file/command/error/audit/default)
2. `clack.select`: PASS | FAIL | SKIP
3. On FAIL: optional free-text note describing what failed
4. Repeat until all criteria are evaluated

Store results as `{{ac_verdicts}}`: array of `{ criterion, status, note }`.

### Verification Report

Written to `.buildpact/specs/{{spec_slug}}/verification-report.md`:
- Markdown table: criterion | PASS ✅ / FAIL ❌ / SKIP ⏭️ | note
- Summary: pass%, fail count, skip count
- Overall: VERIFIED (failCount === 0 && passCount > 0) or NOT VERIFIED

### Spec Verified Marker

When finalization completes, appends to `spec.md`:
```
<!-- verified: {ISO timestamp} | pass:{n} fail:{n} skip:{n} -->
```

### Audit Logging

Logs to `.buildpact/audit/verify.log` (JSON Lines, append-only):
- `verify.start` — on flow begin, references spec path
- `verify.complete` — on report written, outcome: success or failure

→ NEXT: STEP 3 (Adversarial Review Mandate)

---

## STEP 3: Adversarial Review Mandate

After all AC verdicts collected, run mandatory adversarial audit regardless of
pass/fail results.

**Rule:** The reviewer MUST find issues. Zero issues = audit is considered incomplete.

Read `adversarial_minimum` from `.buildpact/constitution.md` key `adversarial_minimum`.
Default: 3 if key is absent.
Store as `{{adversarial_minimum}}`.

Adversarial checklist (run in full — not skippable):
1. **Edge cases not covered** — What inputs/states aren't addressed by any AC?
2. **Implicit assumptions violated** — What did we assume that could be wrong?
3. **Security considerations** — Is there any user input, auth, or data exposure risk?
4. **Error paths untested** — What happens when things fail?
5. **Race conditions / concurrency** — Any async or shared state risks?
6. **Spec completeness** — Are there functional gaps between spec intent and implementation?

Format findings:
```
## Adversarial Findings
- [EDGE] {finding}
- [ASSUMPTION] {finding}
- [SECURITY] {finding}
- [ERROR_PATH] {finding}
- [RACE] {finding}
- [SPEC_GAP] {finding}
```

If `findings.length < {{adversarial_minimum}}`:
→ emit: `"⚠️ Only {N} findings — minimum is {M}. Audit may be superficial. Review again with fresh eyes."`

If `findings.length >= {{adversarial_minimum}}`:
→ emit: `"✓ Adversarial audit complete: {N} findings"`

All findings appended to `verification-report.md` under `## Adversarial Findings` section.

→ NEXT: STEP 4 (Fix Plan Generation)

---

## STEP 4: Fix Plan Generation

When one or more acceptance criteria fail, a targeted fix plan is automatically
written to `.buildpact/specs/{{spec_slug}}/fix/plan-uat.md`.
No fix plan is created when all criteria pass.

### Fix Plan Structure

The generated file contains:
- Title: `# UAT Fix Plan — {{spec_slug}}`
- One `- [ ] [AGENT] Fix: {ac text}` task per failed criterion
- `(Note: {note})` appended when a fail note was provided
- `## Adversarial Action Items` — one `- [ ] [AGENT] Address: {finding}` per finding tagged
  `[SECURITY]` or `[SPEC_GAP]` (high-priority adversarial findings are always included)
- `## Key References` with slug, failed count, and ISO timestamp

### Re-Run Flow

After the fix plan is generated:
1. Run `/bp:execute .buildpact/specs/{{spec_slug}}/fix` to fix only the failed items
2. Run `/bp:verify` to confirm all criteria now pass

Audit log: `verify.fix_plan_written` to `.buildpact/audit/verify.log` after writing.

→ NEXT: STEP 5 (Session Feedback — Memory Tier 1)

---

## STEP 5: Session Feedback — Memory Tier 1

After each `/bp:verify` run, structured feedback is automatically captured to
`.buildpact/memory/feedback/{{spec_slug}}.json`. No configuration required.

Each entry records: `slug`, `outcome` (`passed`/`failed`/`partial`), `workedAcs`,
`failedAcs` (with per-AC fail notes), and a `capturedAt` ISO timestamp.

Entries capped at 30 per file (`FEEDBACK_FIFO_CAP`). Oldest entries evicted when cap is exceeded.

Implementation: `buildFeedbackEntry()`, `captureSessionFeedback()`, `loadRecentFeedbacks()`
in `src/engine/session-feedback.ts`.

→ NEXT: STEP 6 (Lessons & Patterns — Memory Tier 2)

---

## STEP 6: Lessons & Patterns — Memory Tier 2

When total verification sessions ≥ `LESSONS_DISTILL_THRESHOLD` (5), recurring
failure patterns are automatically distilled to `.buildpact/memory/lessons/lessons.json`.

An AC must fail in ≥ 2 sessions (`LESSONS_MIN_FAIL_COUNT`) to become a lesson.
Use `forceDistill=true` to bypass the threshold during testing.

Each lesson captures: `acPattern`, `failCount`, keyword-heuristic `recommendation`, and `affectedSlugs`.

User notified via `cli.verify.lessons_distilled` when new lessons are written.

Implementation: `captureDistilledLessons()`, `distillLessons()`, `analyzePatterns()`
in `src/engine/lessons-distiller.ts`.

→ NEXT: STEP 7 (Decisions Log — Memory Tier 3)

---

## STEP 7: Decisions Log — Memory Tier 3

Architectural and implementation decisions are persisted as individual JSON files
in `.buildpact/memory/decisions/` for permanent cross-session reference.

Each file captures: `id` (slug from title), `title`, `decision`, `rationale`,
`alternatives` (array), and `date` (YYYY-MM-DD). Filename: `{id}.json`.

`loadAllDecisions(decisionsDir)` returns all entries sorted by date ascending.
`formatDecisionsForContext()` produces a `## Decisions Log Memory (Tier 3)` block.

Call `captureDecision(projectDir, input)` from any pipeline phase to persist
an architectural decision for future agent reference.

Implementation: `buildDecisionEntry()`, `captureDecision()`, `loadAllDecisions()`
in `src/engine/decisions-log.ts`.

---

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/verify/index.ts`
- Output files written to: `.buildpact/memory/feedback/`
- Verification report: `.buildpact/specs/{{spec_slug}}/verification-report.md`
- Fix plan: `.buildpact/specs/{{spec_slug}}/fix/plan-uat.md`
- Adversarial minimum: read from `.buildpact/constitution.md` key `adversarial_minimum` (default: 3)
- Adversarial findings appended to verification-report.md under `## Adversarial Findings`
- High-priority adversarial findings (SECURITY, SPEC_GAP) always included in fix plan
- Constitution validation: applied to all accepted outputs
- Triggers: `on_verify_complete` hook if Squad active
