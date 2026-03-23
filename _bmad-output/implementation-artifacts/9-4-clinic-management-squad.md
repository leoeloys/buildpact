# Story 9.4: Clinic Management Squad — Private Beta

Status: done

## Story

As a clinic manager using BuildPact for operational workflows,
I want a pre-built Clinic Management Squad,
So that I can optimize patient flow, manage compliance, and handle financial analysis without building these workflows from scratch.

## Acceptance Criteria

**AC-1: Clinic Management Squad Activates with All 4 Agents**

Given the Clinic Management Squad is installed (internal use)
When I activate it
Then the Operations Manager, Finance Analyst, Compliance Checker, and Patient Flow Optimizer agents are available

**AC-2: Compliance Checker Validates Against Brazilian Healthcare Regulations**

Given I run a workflow with the Clinic Management Squad
When outputs are generated
Then the Compliance Checker agent validates all outputs against applicable Brazilian healthcare regulations (Lei 8.080/90, CFM CEM 2019, ANS RN 566/2022, LGPD Lei 13.709/18) before delivery

## Tasks / Subtasks

- [x] Task 1: Verify all 4 agent files pass structural validation (AC: #1)
  - [x] 1.1: Read `templates/squads/clinic-management/agents/operations-manager.md` — confirm 6 layers (Identity, Persona, Voice DNA, Heuristics, Examples, Handoffs); Voice DNA 5 sections; ≥5 ✘ in Anti-Patterns; ≥3 IF/THEN heuristics (`When`/`If`); ≥1 VETO; ≥3 examples; ≥1 handoff entry
  - [x] 1.2: Read `templates/squads/clinic-management/agents/finance-analyst.md` — same structural checks + verify TISS reference, ANS reference, VETO present
  - [x] 1.3: Read `templates/squads/clinic-management/agents/compliance-checker.md` — same structural checks + verify: `8.080/90` present, CFM + (`CEM` or `Código de Ética`) present, `ANS` present, `LGPD` + `13.709` present, (`Estatuto do Idoso` or `10.741`) present, `VETO:` present
  - [x] 1.4: Read `templates/squads/clinic-management/agents/patient-flow-optimizer.md` — same structural checks + verify: (`Estatuto do Idoso` or `10.741`) + (`Art. 15` or `priority`) present, `VETO:` present
  - [x] 1.5: Read `templates/squads/clinic-management/squad.yaml` — confirm: 4 agents listed (operations-manager, finance-analyst, compliance-checker, patient-flow-optimizer); phases block routes specify→operations-manager, plan→operations-manager, execute→patient-flow-optimizer, verify→compliance-checker; `compliance:` block contains ANS, CFM, LGPD; `domain_questions` block contains clinic_specialty, patient_volume, health_plan_agreements, compliance_context; `bundle_disclaimers` present

- [x] Task 2: Verify built-in clinic templates (AC: #1)
  - [x] 2.1: Read `templates/squads/clinic-management/templates/brazil-healthcare-compliance-checklist.md` — confirm: `Lei 8.080/90`, `CFM`, `ANS`, `LGPD` present; ≥20 checklist items (`- [ ]` format); sections present: `Patient Rights`, `LGPD`, `Estatuto do Idoso`, `Health Plan Billing`
  - [x] 2.2: Read `templates/squads/clinic-management/templates/patient-flow-dashboard.md` — confirm: Patient Flow content; `No-show rate` present; (`Priority` or `Idoso` or `60`) present; `Estatuto do Idoso` present

- [x] Task 3: Run full test suite and verify no regressions (AC: all)
  - [x] 3.1: `npx vitest run` — baseline is 1760 tests passing (US-041 already included from pre-built assets); all must remain green
  - [x] 3.2: Confirm `test/unit/engine/clinic-management-squad.test.ts` (US-041) passes all groups: squad.yaml (5 checks), agent files (4 agents × 7 structural checks + 1 count check = 29 checks), Compliance Checker regulatory (6 checks), Patient Flow Optimizer elderly rights (2 checks), Finance Analyst ANS/TISS (3 checks), built-in templates (5 checks), validateSquadStructure (zero errors), validateHandoffGraph (zero errors) — total ~52 tests

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The Clinic Management Squad agent files, squad.yaml, templates, README, and tests were pre-built before formal story tracking. **Read-only verification is the primary task.** No source code changes are required.

| File | Status | Notes |
|------|--------|-------|
| `templates/squads/clinic-management/squad.yaml` | Pre-built | 4 agents, phases routing, compliance gate, domain_questions, bundle_disclaimers — verify |
| `templates/squads/clinic-management/agents/operations-manager.md` | Pre-built | Verify structural (Task 1.1) |
| `templates/squads/clinic-management/agents/finance-analyst.md` | Pre-built | Verify structural + TISS + ANS (Task 1.2) |
| `templates/squads/clinic-management/agents/compliance-checker.md` | Pre-built | Verify structural + 6 regulation checks (Task 1.3) |
| `templates/squads/clinic-management/agents/patient-flow-optimizer.md` | Pre-built | Verify structural + Estatuto do Idoso (Task 1.4) |
| `templates/squads/clinic-management/templates/brazil-healthcare-compliance-checklist.md` | Pre-built | Verify ≥20 items + 4 coverage sections (Task 2.1) |
| `templates/squads/clinic-management/templates/patient-flow-dashboard.md` | Pre-built | Verify patient flow content + elderly priority (Task 2.2) |
| `templates/squads/clinic-management/README.md` | Pre-built | Documentation — no structural validation needed |
| `test/unit/engine/clinic-management-squad.test.ts` | ✅ Pre-built | US-041 — already included in the 1760-test baseline |

### squad.yaml — Current Complete State

```yaml
name: clinic-management
version: "0.1.0"
domain: health
domain_type: management
description: "Clinic management squad — Operations Manager, Finance Analyst, Compliance Checker, Patient Flow Optimizer"
initial_level: L2

bundle_disclaimers:
  pt-br: "Este conteúdo foi gerado por IA e deve ser revisado por profissional de saúde qualificado antes do uso."
  en: "This content was AI-generated and must be reviewed by a qualified healthcare professional before use."

agents:
  operations-manager:
    file: agents/operations-manager.md
  finance-analyst:
    file: agents/finance-analyst.md
  compliance-checker:
    file: agents/compliance-checker.md
  patient-flow-optimizer:
    file: agents/patient-flow-optimizer.md

phases:
  specify: operations-manager
  plan: operations-manager
  execute: patient-flow-optimizer
  verify: compliance-checker

compliance:
  gate: ans-cfm-anvisa
  regulation: "Lei 8.080/90 + CFM CEM 2019 + ANS RN 566/2022 + LGPD Lei 13.709/18"
  block_on_violation: true

domain_questions:
  - id: clinic_specialty
    prompt: "What is the clinic's medical specialty? (e.g., cardiology, dermatology, orthopedics, general practice)"
    required: true
  - id: patient_volume
    prompt: "What is the average daily patient volume and operating hours?"
    required: true
  - id: health_plan_agreements
    prompt: "Which health plans (convênios) does the clinic operate with? (ANS-registered plans, TISS standard)"
    required: true
  - id: compliance_context
    prompt: "Are there any active ANVISA, CFM, or ANS compliance requirements or audits in progress?"
    required: true
```

**Key difference from Scientific Research Squad:** Has `compliance:` block with `block_on_violation: true` — same pattern as Medical Marketing Squad. Compliance gate is regulatory enforcement, not behavioral-only. The `domain_questions` block drives AC-2 (domain-aware specify questions).

**Key difference from Medical Marketing Squad:** 4 agents (not 4 with same names), healthcare management domain (not marketing), Brazilian clinic-specific regulations (Lei 8.080/90, ANS, LGPD, Estatuto do Idoso) in addition to CFM. No `document:` phase — verify is the terminal phase.

**Key difference from Software Squad:** No `document:` phase; has `compliance:` block; phase count is 4 (specify, plan, execute, verify) not 5.

### 6-Layer Anatomy — Mandatory for Each Agent

Every agent MUST have all 6 layers (checked by `validateSquadStructure`):

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

### Clinic Management Squad — Domain-Specific Checks

Beyond structural validation, US-041 tests domain-specific compliance per agent:

**Compliance Checker (compliance-checker.md):**
- Contains `8.080/90` (Lei Orgânica da Saúde)
- Contains `CFM` AND (`CEM` or `Código de Ética`) — CFM Código de Ética Médica 2019
- Contains `ANS` — Agência Nacional de Saúde Suplementar
- Contains `LGPD` AND `13.709` — Lei Geral de Proteção de Dados
- Contains `Estatuto do Idoso` or `10.741` — elderly patient rights law
- Contains `VETO:` condition

**Patient Flow Optimizer (patient-flow-optimizer.md):**
- Contains (`Estatuto do Idoso` or `10.741`) AND (`Art. 15` or `priority`) — priority scheduling requirement
- Contains `VETO:` condition

**Finance Analyst (finance-analyst.md):**
- Contains `TISS` — Troca de Informações em Saúde Suplementar billing standard
- Contains `ANS` — ANS billing regulations
- Contains `VETO:` condition (billing without fee table validation)

### Phase Routing

```yaml
phases:
  specify: operations-manager    # /bp:specify → operations-manager leads (domain_questions surface)
  plan: operations-manager       # /bp:plan → operations-manager designs workflows
  execute: patient-flow-optimizer # /bp:execute → patient-flow-optimizer runs analysis
  verify: compliance-checker     # /bp:verify → compliance-checker validates regulatory compliance
  # NO document phase — this squad has 4 phases only (different from scientific-research)
```

### Test Coverage Reference (US-041)

`test/unit/engine/clinic-management-squad.test.ts` covers:

```
Clinic Management Squad — squad.yaml (5 tests)
  ✓ has all required YAML fields
  ✓ has phases mapping for pipeline phases
  ✓ lists all 4 agents in agents block
  ✓ references Brazilian healthcare regulations in compliance section
  ✓ has domain_questions addressing the 4 required clinic topics

Clinic Management Squad — agent files (29 tests)
  ✓ has exactly 4 agent files
  agents/operations-manager.md (×7 structural checks)
  agents/finance-analyst.md (×7 structural checks)
  agents/compliance-checker.md (×7 structural checks)
  agents/patient-flow-optimizer.md (×7 structural checks)

Clinic Management Squad — Compliance Checker regulatory coverage (6 tests)
  ✓ compliance-checker references Lei 8.080/90
  ✓ compliance-checker references CFM Código de Ética Médica
  ✓ compliance-checker references ANS regulations
  ✓ compliance-checker references LGPD patient data protection
  ✓ compliance-checker references Estatuto do Idoso elderly patient rights
  ✓ compliance-checker VETO references regulatory violation

Clinic Management Squad — Patient Flow Optimizer elderly rights compliance (2 tests)
  ✓ patient-flow-optimizer references Estatuto do Idoso Art. 15 priority scheduling
  ✓ patient-flow-optimizer VETO blocks flow changes that reduce elderly priority slots

Clinic Management Squad — Finance Analyst ANS/TISS billing compliance (3 tests)
  ✓ finance-analyst references TISS billing standard
  ✓ finance-analyst references ANS regulations
  ✓ finance-analyst VETO blocks billing without fee table validation

Clinic Management Squad — built-in templates (5 tests)
  ✓ has Brazilian healthcare compliance checklist template
  ✓ compliance checklist has at least 20 checklist items
  ✓ compliance checklist covers patient rights, LGPD, elderly rights, and ANS billing
  ✓ has patient flow dashboard template
  ✓ patient flow dashboard includes elderly priority compliance row

Clinic Management Squad — validateSquadStructure (1 test)
  ✓ passes structural validation with zero errors

Clinic Management Squad — validateHandoffGraph (1 test)
  ✓ passes handoff graph validation with zero errors
```

**Total: ~52 tests in US-041, already in the 1760-test baseline.**

### Architecture Context

**Layer dependency (no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

**File system classification:**
- `templates/squads/clinic-management/` — source in npm package (for squad validation)
- `.buildpact/squads/clinic-management/` — installed copy in user's project (read-only at runtime)
- **Private Squad** — NOT bundled in npm; installed via `npx buildpact squad add clinic-management` (internal/Beta use only)

**FR mapping:**
- `FR-902` — 6-layer agent anatomy (all 4 agents must comply)
- `FR-903` — Voice DNA 5-section template (all 4 agents must comply)
- `FR-1004` — Clinic Management Squad with Brazilian healthcare compliance gate

### Anti-Patterns to Avoid

- ❌ Do NOT add programmatic compliance enforcement in `src/` — compliance gate is behavioral (Voice DNA + squad.yaml `compliance:` block) in Prompt Mode v1.0
- ❌ Do NOT modify `validateSquadStructure` or `validateHandoffGraph` — pure, tested at 90%+ coverage
- ❌ Do NOT add the clinic-management squad as a bundled npm copy — it's private/internal Beta (unlike software squad)
- ❌ Do NOT add a YAML library — squad.yaml parsing still uses regex (established in story 8.6)
- ❌ Do NOT create new TypeScript source files for this story — read-only verification only
- ❌ Do NOT add `export default` — named exports only throughout `src/`
- ❌ Do NOT add a `document:` phase to this squad — it only has 4 phases (specify, plan, execute, verify)

### Previous Story Intelligence (Story 9.3 — Scientific Research Squad)

- **1760 tests passing** at end of story 9.3 — US-041 (clinic-management-squad.test.ts) was pre-built and already in that count
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching filesystem
- **Read-only verification pattern:** Stories 9.1, 9.2, and 9.3 made no source code changes — same pattern applies here
- **Structural checks per agent are 7 (not 6):** US-041 tests 7 structural properties per agent (6 layers, 5 Voice DNA, ≥5 ✘, ≥3 heuristics, VETO, ≥3 examples, ≥1 handoff) — story 9.3 had 6 checks, story 9.4 has 7; confirm with actual test run
- **`src/squads/index.ts` after 9.3:** exports `validateSquad`, leveling functions, AND loader functions (`readSquadManifest`, `buildAgentIndex`, `loadAgentDefinition`)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `@clack/prompts` | ^1.1.0 | ONLY in CLI handler — never in templates |
| yaml library | **NONE** | No yaml dep; squad.yaml read via regex |

### Key Files to Read During Verification

- `templates/squads/clinic-management/agents/operations-manager.md` — structural check (Task 1.1)
- `templates/squads/clinic-management/agents/finance-analyst.md` — structural + TISS + ANS (Task 1.2)
- `templates/squads/clinic-management/agents/compliance-checker.md` — structural + 6 Brazilian regulation checks (Task 1.3)
- `templates/squads/clinic-management/agents/patient-flow-optimizer.md` — structural + Estatuto do Idoso (Task 1.4)
- `templates/squads/clinic-management/squad.yaml` — 4 agents, phases, compliance block, domain_questions (Task 1.5)
- `templates/squads/clinic-management/templates/brazil-healthcare-compliance-checklist.md` — ≥20 items, 4 coverage sections (Task 2.1)
- `templates/squads/clinic-management/templates/patient-flow-dashboard.md` — flow content + elderly priority (Task 2.2)
- `test/unit/engine/clinic-management-squad.test.ts` — US-041 test suite

### Project Structure Notes

- Squad source lives in `templates/squads/clinic-management/` — aligned with unified project structure
- Test file at `test/unit/engine/clinic-management-squad.test.ts` — aligned with `test/unit/engine/` location (same as software-squad.test.ts, medical-marketing-squad.test.ts, scientific-research-squad.test.ts)
- No `test/integration/` additions expected
- No `src/` changes expected

### References

- [Source: epics.md#Epic9-Story9.4] — User story, ACs, squad agents, Brazilian healthcare regulations
- [Source: architecture.md#FR-902] — 6-layer agent anatomy requirements
- [Source: architecture.md#FR-903] — Voice DNA 5-section template
- [Source: architecture.md#squads-directory] — `src/squads/` module structure
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/`
- [Source: src/engine/squad-scaffolder.ts] — `validateSquadStructure`, `validateHandoffGraph`
- [Source: test/unit/engine/clinic-management-squad.test.ts] — US-041 full structural + domain-specific tests
- [Source: story 9-3-scientific-research-squad.md] — 1760 tests baseline, read-only verification pattern, 7 structural checks per agent

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues encountered — read-only verification story, no source code changes required.

### Completion Notes List

- Read-only verification completed for all 4 pre-built agent files (operations-manager, finance-analyst, compliance-checker, patient-flow-optimizer)
- All agents pass 6-layer structural checks, Voice DNA 5-section check, ≥5 ✘ Anti-Patterns, ≥3 IF/THEN heuristics, VETO conditions, ≥3 examples, ≥1 handoff
- compliance-checker.md: confirmed 8.080/90, CFM CEM, ANS, LGPD 13.709, Estatuto do Idoso 10.741, VETO
- patient-flow-optimizer.md: confirmed Estatuto do Idoso Art. 15 priority scheduling + VETO
- finance-analyst.md: confirmed TISS, ANS, VETO
- squad.yaml: confirmed 4 agents, correct phase routing, compliance block (ANS/CFM/LGPD), 4 domain_questions, bundle_disclaimers
- brazil-healthcare-compliance-checklist.md: 44 checklist items (≥20 ✅), 4 coverage sections present
- patient-flow-dashboard.md: No-show rate, Priority/Idoso/60 references, Estatuto do Idoso section present
- US-041: 52/52 tests pass
- Full regression: 1760/1760 tests pass, zero regressions

### File List

No files modified — read-only verification story. All source files were pre-built before formal story tracking.

- `templates/squads/clinic-management/agents/operations-manager.md` (verified)
- `templates/squads/clinic-management/agents/finance-analyst.md` (verified)
- `templates/squads/clinic-management/agents/compliance-checker.md` (verified)
- `templates/squads/clinic-management/agents/patient-flow-optimizer.md` (verified)
- `templates/squads/clinic-management/squad.yaml` (verified)
- `templates/squads/clinic-management/templates/brazil-healthcare-compliance-checklist.md` (verified)
- `templates/squads/clinic-management/templates/patient-flow-dashboard.md` (verified)
- `test/unit/engine/clinic-management-squad.test.ts` (executed — 52 tests pass)
- `_bmad-output/implementation-artifacts/9-4-clinic-management-squad.md` (story file updated)
