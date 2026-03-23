# Story 9.5: Agent Builder Squad — Meta Squad Creation Tool (Public)

Status: done

## Story

As a domain expert wanting to create a new custom Squad,
I want an Agent Builder Squad that guides me through the Squad creation process,
So that I can build a production-quality Squad without having to understand all structural requirements from scratch.

## Acceptance Criteria

**AC-1: Agent Builder Squad Activates with All 3 Agents**

Given the Agent Builder Squad is installed
When I activate it
Then the Agent Designer, Workflow Architect, and Squad Tester agents are available
And they guide me through: defining agent roles, building Voice DNA, writing heuristics, creating examples, and mapping handoffs

**AC-2: Squad Tester Validates Against 6-Layer Anatomy and Voice DNA Requirements**

Given I run a workflow with the Agent Builder Squad
When the Squad Tester agent reviews an agent file
Then it validates all agents against the BuildPact 6-layer anatomy and Voice DNA 5-section requirements
And the completed Squad is ready for `/bp:squad validate` upon finishing the guided flow

## Tasks / Subtasks

- [x] Task 1: Verify all 3 agent files pass structural validation (AC: #1)
  - [x] 1.1: Read `templates/squads/agent-builder/agents/agent-designer.md` — confirm 6 layers (Identity, Persona, Voice DNA, Heuristics, Examples, Handoffs); Voice DNA 5 sections; ≥5 ✘ in Anti-Patterns; ≥3 IF/THEN heuristics (`When`/`If`); ≥1 VETO; ≥3 examples; ≥1 handoff entry; Voice DNA + Identity + Persona references; 6-layer anatomy reference (`6-layer|six.layer|anatomy`); VETO: present; handoff to squad-tester (`Squad Tester|squad-tester`)
  - [x] 1.2: Read `templates/squads/agent-builder/agents/workflow-architect.md` — same structural checks + verify: Heuristics + IF/THEN or conditional reference (`IF.THEN|if.then|When.*condition`), handoff + directed graph reference (`directed graph|graph`), VETO: present, Examples reference
  - [x] 1.3: Read `templates/squads/agent-builder/agents/squad-tester.md` — same structural checks + verify: 6-layer anatomy + Identity + Persona + Voice DNA + Heuristics + Examples + Handoffs all present; Voice DNA + Anti-Patterns + `≥5|minimum 5` reference; `VETO:` + block/stop/fail; `handoff graph|validateHandoffGraph`; `orphan|zero handoff`; `pass|fail` + `partial pass|partial` references
  - [x] 1.4: Read `templates/squads/agent-builder/squad.yaml` — confirm: 3 agents listed (agent-designer, workflow-architect, squad-tester); 5-phase block (specify→agent-designer, plan→workflow-architect, execute→workflow-architect, verify→squad-tester, document→agent-designer); `domain_questions` block contains squad_purpose, target_domain, agent_roles, workflow_handoffs; `bundle_disclaimers` present; NO `compliance:` block (this squad has no regulatory gate)

- [x] Task 2: Verify built-in Squad design template (AC: #1)
  - [x] 2.1: Read `templates/squads/agent-builder/templates/squad-design-worksheet.md` — confirm: `Squad Design Worksheet` title; sections `Squad Purpose`, `Agent Roster`, `Voice DNA`, `Workflow Map`, `VETO`; `Validation Checklist` section; `6-layer|6 layer` reference; `VETO` reference; `handoff` reference; ≥10 checklist items (`- [ ]` format)

- [x] Task 3: Run full test suite and verify no regressions (AC: all)
  - [x] 3.1: `npx vitest run` — baseline is 1760 tests (US-042 already included from pre-built assets); all must remain green
  - [x] 3.2: Confirm `test/unit/engine/agent-builder-squad.test.ts` (US-042) passes all groups: squad.yaml (4 checks), agent files (3 agents × 7 structural checks + 1 count check = 22 checks), Agent Designer quality gates (4 checks), Workflow Architect workflow design (4 checks), Squad Tester validation criteria (5 checks), built-in templates (4 checks), validateSquadStructure (zero errors), validateHandoffGraph (zero errors) — total 45 tests

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The Agent Builder Squad agent files, squad.yaml, templates, README, and tests were pre-built before formal story tracking. **Read-only verification is the primary task.** No source code changes are required.

| File | Status | Notes |
|------|--------|-------|
| `templates/squads/agent-builder/squad.yaml` | Pre-built | 3 agents, 5 phases (with document), no compliance block, domain_questions — verify |
| `templates/squads/agent-builder/agents/agent-designer.md` | Pre-built | Verify structural + quality gate checks (Task 1.1) |
| `templates/squads/agent-builder/agents/workflow-architect.md` | Pre-built | Verify structural + graph + handoff checks (Task 1.2) |
| `templates/squads/agent-builder/agents/squad-tester.md` | Pre-built | Verify structural + 6-layer ref + validation criteria (Task 1.3) |
| `templates/squads/agent-builder/templates/squad-design-worksheet.md` | Pre-built | Verify 5 sections, Validation Checklist, ≥10 items (Task 2.1) |
| `templates/squads/agent-builder/README.md` | Pre-built | Documentation — no structural validation needed |
| `test/unit/engine/agent-builder-squad.test.ts` | ✅ Pre-built | US-042 — already included in the 1760-test baseline |

### squad.yaml — Current Complete State

```yaml
name: agent-builder
version: "0.1.0"
domain: software
domain_type: software
description: "Agent Builder Squad — Agent Designer, Workflow Architect, Squad Tester"
initial_level: L2

bundle_disclaimers:
  pt-br: "Este Squad gerado por IA deve ser revisado por um especialista de domínio antes de uso em produção."
  en: "This AI-generated Squad must be reviewed by a domain expert before production use."

agents:
  agent-designer:
    file: agents/agent-designer.md
  workflow-architect:
    file: agents/workflow-architect.md
  squad-tester:
    file: agents/squad-tester.md

phases:
  specify: agent-designer
  plan: workflow-architect
  execute: workflow-architect
  verify: squad-tester
  document: agent-designer

domain_questions:
  - id: squad_purpose
  - id: target_domain
  - id: agent_roles
  - id: workflow_handoffs
```

**Key differences from Clinic Management Squad (9.4):**
- **5 phases** (adds `document: agent-designer`) vs 4 in clinic-management — this is the only squad with a document phase besides scientific-research
- **NO `compliance:` block** — agent-builder is a software/tool domain, no regulatory gate
- **3 agents** (not 4)
- **Public** (not private Beta) — released in open-source npm distribution per FR-1005 + NFR-13

**Key differences from Scientific Research Squad (9.3):**
- 3 agents (not 4) — no data-analyst equivalent
- `domain: software` / `domain_type: software` (not `research`)
- No domain-specific regulatory checks — no compliance gate

**Key differences from Software Squad (9.1):**
- No `src/squads/` source code changes — agent-builder is NOT bundled in npm (unlike software squad)
- Installed via `npx buildpact squad add agent-builder` (Beta, not always-bundled)

### 6-Layer Anatomy — Mandatory for Each Agent

Every agent MUST have all 6 layers:

| Layer | Required Content |
|-------|-----------------|
| `## Identity` | One sentence describing who the agent is and role |
| `## Persona` | Behavioral style and working approach |
| `## Voice DNA` | Exactly 5 subsections (see below) |
| `## Heuristics` | ≥3 numbered When/If rules; ≥1 VETO condition (`VETO:` keyword) |
| `## Examples` | ≥3 labeled input/output pairs (`1. **Label:**` format) |
| `## Handoffs` | ≥1 entry using `- →` or `- ←` format |

### Voice DNA 5 Sections — Mandatory

| Subsection | Requirement |
|-----------|-------------|
| `### Personality Anchors` | 3–5 core behavioral traits as actionable statements |
| `### Opinion Stance` | Explicit declaration the agent has preferences and can disagree |
| `### Anti-Patterns` | ≥5 ✘/✔ pairs — what the agent NEVER does vs. ALWAYS does |
| `### Never-Do Rules` | Explicit prohibitions with no ambiguity |
| `### Inspirational Anchors` | Reference personas/archetypes that calibrate tone |

### Agent Builder Squad — Domain-Specific Quality Gate Checks

Beyond structural validation, US-042 tests domain-specific quality gates per agent:

**Agent Designer (agent-designer.md):**
- Contains `Voice DNA`, `Identity`, `Persona` references — guides through Voice DNA design
- Contains `6-layer` or `six.layer` or `anatomy` — references 6-layer anatomy checklist
- Contains `VETO:` condition — blocks role overlap
- Contains `Squad Tester` or `squad-tester` — hands off to squad-tester for validation

**Workflow Architect (workflow-architect.md):**
- Contains `Heuristics` AND IF/THEN or conditional reference (`IF.THEN|if.then|When.*condition`)
- Contains `handoff` or `Handoff` AND `directed graph` or `graph` — guides through handoff graph design
- Contains `VETO:` condition — for handoff validation
- Contains `Examples` — guides through examples design

**Squad Tester (squad-tester.md):**
- Contains `6-layer` or `six.layer`, plus `Identity`, `Persona`, `Voice DNA`, `Heuristics`, `Examples`, `Handoffs` — validates 6-layer anatomy
- Contains `Voice DNA`, `Anti-Patterns`, `≥5` or `minimum 5` — validates Voice DNA requirements
- Contains `VETO:` AND `block` or `stop` or `fail` — enforces VETO block on single violation
- Contains `handoff graph` or `validateHandoffGraph` AND `orphan` or `zero handoff` — validates handoff graph completeness
- Contains `pass` or `fail` AND `partial pass` or `partial` — issues pass/fail verdict (not partial)

### Phase Routing

```yaml
phases:
  specify: agent-designer      # /bp:specify → agent-designer defines Squad purpose + agent roles
  plan: workflow-architect      # /bp:plan → workflow-architect designs heuristics + handoff graph
  execute: workflow-architect   # /bp:execute → workflow-architect implements workflow
  verify: squad-tester          # /bp:verify → squad-tester validates structural compliance
  document: agent-designer      # /bp:document → agent-designer produces final agent files
```

**NOTE:** Agent Builder Squad has a `document:` phase — same as scientific-research squad, unlike clinic-management which has only 4 phases.

### Test Coverage Reference (US-042)

`test/unit/engine/agent-builder-squad.test.ts` covers:

```
Agent Builder Squad — squad.yaml (4 tests)
  ✓ has all required YAML fields
  ✓ has phases mapping for pipeline phases
  ✓ lists all 3 agents in agents block
  ✓ has domain_questions addressing the 4 required Squad design topics

Agent Builder Squad — agent files (22 tests)
  ✓ has exactly 3 agent files
  agents/agent-designer.md (×7 structural checks)
  agents/workflow-architect.md (×7 structural checks)
  agents/squad-tester.md (×7 structural checks)

Agent Builder Squad — Agent Designer quality gates (4 tests)
  ✓ agent-designer guides through Voice DNA design
  ✓ agent-designer references 6-layer anatomy checklist
  ✓ agent-designer has VETO condition blocking role overlap
  ✓ agent-designer hands off to squad-tester for validation

Agent Builder Squad — Workflow Architect workflow design (4 tests)
  ✓ workflow-architect guides through heuristics design
  ✓ workflow-architect guides through handoff graph design
  ✓ workflow-architect has VETO condition for handoff validation
  ✓ workflow-architect references examples design

Agent Builder Squad — Squad Tester validation criteria (5 tests)
  ✓ squad-tester validates against 6-layer anatomy
  ✓ squad-tester validates Voice DNA requirements
  ✓ squad-tester enforces VETO: blocks on single violation
  ✓ squad-tester validates handoff graph completeness
  ✓ squad-tester issues pass/fail verdict (not partial pass)

Agent Builder Squad — built-in templates (4 tests)
  ✓ has squad-design-worksheet template
  ✓ squad-design-worksheet covers all 5 design sections
  ✓ squad-design-worksheet has validation checklist with VETO and handoff checks
  ✓ squad-design-worksheet has at least 10 checklist items

Agent Builder Squad — validateSquadStructure (1 test)
  ✓ passes structural validation with zero errors

Agent Builder Squad — validateHandoffGraph (1 test)
  ✓ passes handoff graph validation with zero errors
```

**Total: 45 tests in US-042, already in the 1760-test baseline.**

### Architecture Context

**FR mapping:**
- `FR-902` — 6-layer agent anatomy (all 3 agents must comply)
- `FR-903` — Voice DNA 5-section template (all 3 agents must comply)
- `FR-1005` — Agent Builder Squad (Public, Beta) — Agent Designer, Workflow Architect, Tester; enables meta-creation of new Squads; SHOULD be included in open-source distribution
- `NFR-13` — MIT License: Agent Builder Squad is part of the open-source distribution

**Layer dependency (no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

**File system classification:**
- `templates/squads/agent-builder/` — source in npm package (for squad validation)
- `.buildpact/squads/agent-builder/` — installed copy in user's project (read-only at runtime)
- **Public Squad** — included in open-source distribution; installable via `npx buildpact squad add agent-builder`

### Anti-Patterns to Avoid

- ❌ Do NOT add a `compliance:` block to agent-builder's squad.yaml — this squad has no regulatory compliance gate
- ❌ Do NOT change the phase count from 5 — agent-builder has `document:` phase, unlike clinic-management (4 phases)
- ❌ Do NOT add the agent-builder squad as bundled in npm source tree — it's installed on-demand, not auto-bundled like software squad
- ❌ Do NOT modify `validateSquadStructure` or `validateHandoffGraph` — pure, tested at 90%+ coverage
- ❌ Do NOT add a YAML library — squad.yaml parsing still uses regex (established in story 8.6)
- ❌ Do NOT create new TypeScript source files for this story — read-only verification only
- ❌ Do NOT add `export default` — named exports only throughout `src/`

### Previous Story Intelligence (Story 9.4 — Clinic Management Squad)

- **1760 tests passing** at end of story 9.4 — US-042 (agent-builder-squad.test.ts) was pre-built and already in that count
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching filesystem
- **Read-only verification pattern:** Stories 9.1, 9.2, 9.3, and 9.4 made no source code changes — same pattern applies here
- **Structural checks per agent are 7:** US-042 tests 7 structural properties per agent (6 layers, 5 Voice DNA, ≥5 ✘, ≥3 heuristics, VETO, ≥3 examples, ≥1 handoff)
- **`src/squads/index.ts` after 9.4:** exports `validateSquad`, leveling functions, AND loader functions (`readSquadManifest`, `buildAgentIndex`, `loadAgentDefinition`)
- **Clinic management had compliance block** — agent-builder does NOT; story is simpler as a result

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `@clack/prompts` | ^1.1.0 | ONLY in CLI handler — never in templates |
| yaml library | **NONE** | No yaml dep; squad.yaml read via regex |

### Key Files to Read During Verification

- `templates/squads/agent-builder/agents/agent-designer.md` — structural + quality gate checks (Task 1.1)
- `templates/squads/agent-builder/agents/workflow-architect.md` — structural + graph + handoff checks (Task 1.2)
- `templates/squads/agent-builder/agents/squad-tester.md` — structural + validation criteria checks (Task 1.3)
- `templates/squads/agent-builder/squad.yaml` — 3 agents, 5 phases, no compliance, 4 domain_questions (Task 1.4)
- `templates/squads/agent-builder/templates/squad-design-worksheet.md` — 5 sections, Validation Checklist, ≥10 items (Task 2.1)
- `test/unit/engine/agent-builder-squad.test.ts` — US-042 test suite (45 tests)

### Project Structure Notes

- Squad source lives in `templates/squads/agent-builder/` — aligned with unified project structure
- Test file at `test/unit/engine/agent-builder-squad.test.ts` — aligned with `test/unit/engine/` location (same as software-squad.test.ts, medical-marketing-squad.test.ts, scientific-research-squad.test.ts, clinic-management-squad.test.ts)
- No `test/integration/` additions expected
- No `src/` changes expected

### References

- [Source: epics.md#Epic9-Story9.5] — User story, ACs, agent roles, guided flow requirements
- [Source: architecture.md#FR-1005] — Agent Builder Squad (Public, Beta) — meta-creation of new Squads
- [Source: architecture.md#NFR-13] — MIT License requirement for Agent Builder Squad
- [Source: architecture.md#FR-902] — 6-layer agent anatomy requirements
- [Source: architecture.md#FR-903] — Voice DNA 5-section template
- [Source: architecture.md#squads-directory] — `src/squads/` module structure
- [Source: src/engine/squad-scaffolder.ts] — `validateSquadStructure`, `validateHandoffGraph`
- [Source: test/unit/engine/agent-builder-squad.test.ts] — US-042 full structural + quality gate tests
- [Source: story 9-4-clinic-management-squad.md] — 1760 tests baseline, read-only verification pattern, 7 structural checks per agent

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blockers encountered. Read-only verification story — no source code changes required.

### Completion Notes List

- ✅ Task 1.1: agent-designer.md passes all structural checks — 6 layers, Voice DNA 5 sections, 5✘ Anti-Patterns, 5 IF/THEN heuristics, VETO present, 3 examples, 4 handoffs, 6-layer anatomy reference, handoff to Squad Tester
- ✅ Task 1.2: workflow-architect.md passes all structural checks — 6 layers, Voice DNA 5 sections, 5✘ Anti-Patterns, 5 IF/THEN heuristics (When/If), 2 VETOs, 3 examples, directed graph reference in Persona and Heuristic 1, IF/THEN in Persona
- ✅ Task 1.3: squad-tester.md passes all structural checks — 6 layers, Voice DNA 5 sections, 5✘ Anti-Patterns, 5 IF/THEN heuristics, 2 VETOs, 3 examples, validateHandoffGraph + zero handoffs in Never-Do Rules, partial pass in Anti-Patterns
- ✅ Task 1.4: squad.yaml confirmed — 3 agents, 5-phase routing with document phase, 4 domain_questions, bundle_disclaimers, NO compliance block
- ✅ Task 2.1: squad-design-worksheet.md confirmed — Squad Design Worksheet title, 5 sections (Purpose/Roster/Voice DNA/Workflow Map/VETO), Validation Checklist with exactly 10 checklist items, 6-layer + VETO + handoff references
- ✅ Task 3.1: npx vitest run — 1760/1760 tests pass, no regressions
- ✅ Task 3.2: US-042 (agent-builder-squad.test.ts) — 45/45 tests pass across all 8 test groups

### File List

No files were created or modified (read-only verification story).

### Change Log

- 2026-03-19: Story 9.5 verified — pre-built Agent Builder Squad assets pass all structural checks and US-042 test suite (45/45). Status → review.
