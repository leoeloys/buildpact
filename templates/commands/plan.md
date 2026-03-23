<!-- ORCHESTRATOR: plan | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 2.0.0 | FR: 601, 602, 603, 604, 605, 606 -->
<!-- STATE: {{feature_slug}}, {{spec_slug}}, {{model_profile}}, {{domain_type}}, {{active_squad}} -->
# /bp:plan — Planning Pipeline

Follow each step below in exact order. Do not skip steps.

---

## STEP 1: Research Phase

The planning pipeline begins with automated parallel research across 3 domains
before any plan content is generated.

**Research Domains:**

1. **Tech Stack** — Identifies programming languages, frameworks, libraries, and
   infrastructure required by the spec
2. **Codebase** — Maps existing modules, integration points, and relevant patterns
   in the current project
3. **Squad Constraints** — Extracts domain-specific rules, compliance requirements,
   and constraints from the active Squad's guidance files

**Parallel Dispatch Protocol:**

Each domain is investigated by an isolated research subagent dispatched with a
scoped `TaskDispatchPayload`:
- Each subagent receives a clean context window (no accumulated orchestrator state)
- Payloads are built via `buildTaskPayload()` from `src/engine/subagent.ts`
- All 3 agents run concurrently: `Promise.all([techStack, codebase, squadConstraints])`
- No agent inherits state from the orchestrator or from other agents (FR-604)

**Consolidation Step:**

Results merged by `consolidateResearch()` into a `ResearchSummary` and persisted to:
```
.buildpact/snapshots/{{feature_slug}}/research-summary.md
```

→ NEXT: STEP 2 (Wave Generation)

---

## STEP 2: Wave Generation

After research completes, tasks extracted from the spec are grouped into parallel
execution waves (FR-602).

### Dependency Analysis

1. Each spec task becomes a `TaskNode` with `id`, `description`, `dependencies[]`,
   and optional `featureTag`
2. An adjacency map is built: each task lists which tasks it must wait for
3. In-degree (number of unsatisfied prerequisites) is computed for every node

### Wave Grouping Algorithm

A topological sort assigns each task to the earliest possible wave:
1. Tasks with in-degree 0 (no dependencies) → **Wave 1** — run in parallel
2. After Wave 1 completes, remaining tasks have in-degrees decremented
3. Tasks reaching in-degree 0 → **Wave 2** — run in parallel
4. Repeats until all tasks are assigned; circular dependency cycles broken to Wave 1

### Vertical Slice Preference

Tasks sharing the same `featureTag` (e.g., backend + frontend of the same feature)
are grouped into the same wave rather than separated by technical layer.

### Plan File Creation Rule

Each wave's tasks are split into plan files of at most **2–3 tasks** each:
- A wave with ≤3 tasks → 1 plan file
- A wave with 4–6 tasks → 2 plan files (3+1 or 3+3)
- A wave with 7+ tasks → additional files as needed (always ≤3 tasks per file)

Plan files written to: `.buildpact/snapshots/{{spec_slug}}/plans/wave-{N}-plan-{M}.md`

Implementation: `analyzeWaves()`, `splitIntoPlanFiles()` in `src/engine/wave-executor.ts`

### Model Profile

Respects `model_profile` from `config.yaml` (FR-603):
- `quality` — full research + Nyquist validation + wave split
- `balanced` — standard research + validation
- `budget` — streamlined research, validation skipped unless critical

→ NEXT: STEP 3 (Architecture Decision Records)

---

## STEP 3: Architecture Decision Records

For each significant architectural choice in the plan, generate an ADR entry:

```yaml
adr:
  id: ADR-{N}
  title: "{Decision title}"
  context: "{Why this decision needs to be made}"
  options:
    - "{Option A} — {pros} / {cons}"
    - "{Option B} — {pros} / {cons}"
  decision: "{Chosen option}"
  rationale: "{Why this was chosen}"
  trade_offs: "{What we accept as a consequence}"
  high_stakes: true/false  # true = triggers Conclave review
```

Triggers for ADR creation:
- Database schema changes
- New external service integrations
- API contract changes
- Authentication/authorization patterns
- Data storage format choices

Write ADRs to: `.buildpact/plans/{{feature_slug}}/adrs/ADR-{N}.md`

If no architectural decisions detected: skip ADR creation (do not create empty files).

→ NEXT: STEP 4 (Nyquist Validation)

---

## STEP 4: Nyquist Validation

After wave generation, the plan passes through a multi-perspective quality check (FR-504).

### 4 Validation Perspectives

| Perspective | What It Checks | Critical Condition |
|-------------|---------------|-------------------|
| **Completeness** | Every spec AC maps to ≥1 plan task | Missing AC coverage |
| **Consistency** | No duplicate titles; tasks are actionable (≥5 chars) | Duplicate or vague tasks |
| **Dependencies** | All declared deps reference real task IDs; no self-deps | Invalid or circular deps |
| **Feasibility** | No vague placeholder language; warn if >20 tasks | Placeholder or oversized plan |

### Blocking Behavior

- **Critical issues** → execution blocked; user chooses: auto-revise / override / cancel
- **Warnings** → shown but do not block; plan proceeds
- **Pass** → plan is ready for execution

### Auto-Revision Loop

When the user selects auto-revise:
1. `autoRevisePlan()` fixes issues (removes bad deps, deduplicates, adds placeholders)
2. `validatePlan()` re-runs on revised tasks
3. Loop repeats up to 3 times if critical issues persist
4. After 3 failed attempts, remaining issues are shown to user

Validation report written to `.buildpact/plans/{{feature_slug}}/validation-report.md`.

→ NEXT: STEP 5 (Non-Software Domain Planning)

---

## STEP 5: Non-Software Domain Planning

When the active Squad has `domain_type` set to a non-software value (medical,
research, management, custom), the planner enables human/agent task tagging.

Read `domain_type` from `.buildpact/squads/{{active_squad}}/squad.yaml`.
If absent or `software`, all tasks are tagged `[AGENT]`.

- **[AGENT]** — tasks the AI can execute automatically (generate, analyze, format)
- **[HUMAN]** — tasks requiring manual action (review, approve, sign off, coordinate)

Human tasks include a markdown checklist with 3–4 actionable sub-items:
```
- [ ] [HUMAN] Review patient brochure draft
  - [ ] Read through for accuracy
  - [ ] Verify compliance statements
  - [ ] Sign off in audit log
```

When execution reaches a `[HUMAN]` step, the system pauses and offers:
1. **Done** — mark complete and continue to next task
2. **Save and exit** — persist progress to `progress.json` and exit

Session state saved to `.buildpact/plans/{{feature_slug}}/progress.json`.

→ NEXT: STEP 6 (Readiness Gate)

---

## STEP 6: Readiness Gate

Before confirming the plan, verify all gate conditions:

| Check | Status |
|-------|--------|
| All spec AC have ≥1 plan task | ✓/✗ |
| All `[NEEDS_CLARIFICATION]` markers resolved | ✓/✗ |
| All tasks have clear completion criteria | ✓/✗ |
| Research summary available | ✓/✗ |
| Constitution path confirmed | ✓/✗ |
| ADRs written for architectural choices | ✓/✗ |

Decision:
- **All ✓ → PASS** — display `✓ Readiness Gate: PASS` and proceed to save
- **1–2 ✗ → CONCERNS** — display warnings, prompt `[1] Fix now  [2] Override and continue`
- **3+ ✗ → FAIL** — block execution, require manual fixes before proceeding

Plan is saved only after PASS or user Override.

Plan written to: `.buildpact/plans/{{feature_slug}}/plan.md`
Trigger `on_plan_complete` hook if Squad active.

---

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Entry point: `src/commands/plan/handler.ts`
- Research coordinator: `src/commands/plan/researcher.ts`
- Public types: `src/commands/plan/types.ts`
- Output: `.buildpact/plans/{{feature_slug}}/plan.md`
- Research snapshot: `.buildpact/snapshots/{{feature_slug}}/research-summary.md`
- Validation report: `.buildpact/plans/{{feature_slug}}/validation-report.md`
- ADR output: `.buildpact/plans/{{feature_slug}}/adrs/ADR-{N}.md`
- Constitution validation: called after plan generation, before user review
- Triggers: `on_plan_complete` hook if Squad active
- Readiness Gate: blocks save until PASS or explicit Override
