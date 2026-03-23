# Story 9.3: Scientific Research Squad — Private Beta

Status: done

## Story

As a researcher using BuildPact for academic work,
I want a pre-built Scientific Research Squad,
So that I can follow systematic review protocols and produce structured research deliverables without building domain knowledge from scratch.

## Acceptance Criteria

**AC-1: Scientific Research Squad Activates with All 5 Agents**

Given the Scientific Research Squad is installed (internal use)
When I activate it
Then the Research Lead, Literature Reviewer, Data Analyst, Peer Reviewer, and LaTeX Writer agents are available
And systematic review protocols, PRISMA checklist templates, and statistical analysis plan templates are pre-loaded

**AC-2: Domain-Aware Specify Questions Cover Research Design**

Given I run `/bp:specify` with the Research Squad active
When the domain-aware questions run
Then questions address: research question formulation, study design, inclusion/exclusion criteria, and statistical approach

## Tasks / Subtasks

- [x] Task 1: Verify all 5 agent files pass structural validation (AC: #1)
  - [x] 1.1: Read `templates/squads/scientific-research/agents/research-lead.md` — confirm 6 layers, Voice DNA 5 sections, ≥5 ✘ in Anti-Patterns, ≥3 IF/THEN heuristics, ≥1 VETO, ≥3 examples, ≥1 handoff; verify PRISMA/CONSORT reference, PICO framework mention, pre-registration in Anti-Patterns
  - [x] 1.2: Read `templates/squads/scientific-research/agents/literature-reviewer.md` — same structural checks + verify ≥3 literature database names (PubMed, Embase, Cochrane or similar), PRISMA reference, VETO present
  - [x] 1.3: Read `templates/squads/scientific-research/agents/data-analyst.md` — same structural checks + verify "statistical analysis plan" or "SAP" reference, effect size mention, confidence interval mention
  - [x] 1.4: Read `templates/squads/scientific-research/agents/peer-reviewer.md` — same structural checks
  - [x] 1.5: Read `templates/squads/scientific-research/agents/latex-writer.md` — same structural checks
  - [x] 1.6: Read `templates/squads/scientific-research/squad.yaml` — confirm: 5 agents listed (research-lead, literature-reviewer, data-analyst, peer-reviewer, latex-writer); phases block routes specify→research-lead, plan→research-lead, execute→data-analyst, verify→peer-reviewer, document→latex-writer; `domain_questions` block contains research_question, study_design, inclusion_exclusion, statistical_approach; `bundle_disclaimers` present

- [x] Task 2: Verify built-in research templates (AC: #1)
  - [x] 2.1: Read `templates/squads/scientific-research/templates/prisma-checklist.md` — confirm ≥20 checklist items (`- [ ]` format), sections present: `## Title`, `## Abstract`, `## Methods`, `## Results`, `## Discussion`
  - [x] 2.2: Read `templates/squads/scientific-research/templates/statistical-analysis-plan.md` — confirm: "statistical analysis plan" text, sample size + power sections, primary outcome + secondary outcome references, missing data section, deviations section for transparency

- [x] Task 3: Run full test suite and verify no regressions (AC: all)
  - [x] 3.1: `npx vitest run` — baseline is 1760 tests passing (US-040 already included in baseline from pre-built assets); all must remain green
  - [x] 3.2: Confirm `test/unit/engine/scientific-research-squad.test.ts` (US-040) passes all groups: squad.yaml (4 checks), agent files (5 agents × 6 structural checks = 31 checks), Research Lead protocols (3 checks), Literature Reviewer PRISMA (3 checks), Data Analyst statistical rigor (2 checks), built-in templates (8 checks), validateSquadStructure (zero errors), validateHandoffGraph (zero errors) — total 58 tests passed

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The Scientific Research Squad agent files, squad.yaml, templates, README, and tests were pre-built before formal story tracking. **Read-only verification is the primary task.** No source code changes are required.

| File | Status | Notes |
|------|--------|-------|
| `templates/squads/scientific-research/squad.yaml` | Pre-built | 5 agents, phases routing, domain_questions, bundle_disclaimers — verify |
| `templates/squads/scientific-research/agents/research-lead.md` | Pre-built | Verify structural + PRISMA/CONSORT/PICO (Task 1.1) |
| `templates/squads/scientific-research/agents/literature-reviewer.md` | Pre-built | Verify structural + ≥3 databases + PRISMA (Task 1.2) |
| `templates/squads/scientific-research/agents/data-analyst.md` | Pre-built | Verify structural + SAP + effect size (Task 1.3) |
| `templates/squads/scientific-research/agents/peer-reviewer.md` | Pre-built | Verify structural (Task 1.4) |
| `templates/squads/scientific-research/agents/latex-writer.md` | Pre-built | Verify structural (Task 1.5) |
| `templates/squads/scientific-research/README.md` | Pre-built | Documentation — no structural validation needed |
| `templates/squads/scientific-research/templates/prisma-checklist.md` | Pre-built | Verify ≥20 items + 5 sections (Task 2.1) |
| `templates/squads/scientific-research/templates/statistical-analysis-plan.md` | Pre-built | Verify SAP content coverage (Task 2.2) |
| `test/unit/engine/scientific-research-squad.test.ts` | ✅ Pre-built | US-040 — already included in the 1760-test baseline |

### squad.yaml — Current Complete State

```yaml
name: scientific-research
version: "0.1.0"
domain: research
domain_type: research
description: "Scientific research squad — Research Lead, Literature Reviewer, Data Analyst, Peer Reviewer, LaTeX Writer"
initial_level: L2

bundle_disclaimers:
  pt-br: "Este conteúdo foi gerado por IA e deve ser revisado por pesquisador qualificado antes do uso."
  en: "This content was AI-generated and must be reviewed by a qualified researcher before use."

agents:
  research-lead:
    file: agents/research-lead.md
  literature-reviewer:
    file: agents/literature-reviewer.md
  data-analyst:
    file: agents/data-analyst.md
  peer-reviewer:
    file: agents/peer-reviewer.md
  latex-writer:
    file: agents/latex-writer.md

phases:
  specify: research-lead
  plan: research-lead
  execute: data-analyst
  verify: peer-reviewer
  document: latex-writer

domain_questions:
  - id: research_question
    prompt: "What is the primary research question or hypothesis?"
    required: true
  - id: study_design
    prompt: "What study design are you using? (RCT, cohort, case-control, systematic review, meta-analysis, etc.)"
    required: true
  - id: inclusion_exclusion
    prompt: "What are the inclusion and exclusion criteria for your study population or literature search?"
    required: true
  - id: statistical_approach
    prompt: "What statistical methods or analysis approach will you use?"
    required: true
```

**Key difference from Medical Marketing Squad:** No `compliance:` block — research rigor is enforced through Voice DNA behavioral rules (VETO heuristics), not a regulatory compliance gate. The `domain_questions` block is unique to this squad — it drives AC-2 (domain-aware specify questions).

**Key difference from Software Squad:** 5 agents (not 4), and `document: latex-writer` phase is present (same pattern as software squad's `document: tech-writer`).

### 6-Layer Anatomy — Mandatory for Each Agent

Every agent MUST have all 6 layers (checked by `validateSquadStructure`):

| Layer | Required Content |
|-------|-----------------|
| `## Identity` | One sentence describing who the agent is and role |
| `## Persona` | Behavioral style and working approach |
| `## Voice DNA` | Exactly 5 subsections (see below) |
| `## Heuristics` | ≥3 numbered IF/THEN or When/If rules; ≥1 VETO condition (`VETO:` keyword) |
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

### Scientific Research Squad — Domain-Specific Checks

Beyond structural validation, US-040 tests domain-specific rigor per agent:

**Research Lead (research-lead.md):**
- References `PRISMA` or `CONSORT` protocols
- References `PICO` framework (PICO/PECO decomposition)
- Contains `pre-regist` (pre-registration anti-pattern requirement)

**Literature Reviewer (literature-reviewer.md):**
- References `PRISMA`
- Mentions ≥3 literature databases (PubMed, Embase, Cochrane, MEDLINE, Scopus, or Web of Science)
- Contains `VETO:` condition

**Data Analyst (data-analyst.md):**
- References "statistical analysis plan" or "SAP"
- References "effect size" and "confidence interval"

### Phase Routing (AC-2)

```yaml
phases:
  specify: research-lead    # /bp:specify → research-lead.md leads (PICO + domain_questions)
  plan: research-lead       # /bp:plan → research-lead.md designs study (design selection)
  execute: data-analyst     # /bp:execute → data-analyst.md runs pre-registered analysis
  verify: peer-reviewer     # /bp:verify → peer-reviewer.md applies critical appraisal
  document: latex-writer    # document phase → latex-writer.md formats manuscript
```

The `domain_questions` block implements AC-2 — when `/bp:specify` runs with this squad active, the 4 required question prompts are surfaced to the user.

### Test Coverage Reference (US-040)

`test/unit/engine/scientific-research-squad.test.ts` covers:

```
Scientific Research Squad — squad.yaml
  ✓ has all required YAML fields
  ✓ has phases mapping for pipeline phases
  ✓ lists all 5 agents in agents block
  ✓ has domain_questions addressing the 4 required research topics

Scientific Research Squad — agent files
  ✓ has exactly 5 agent files
  agents/research-lead.md (×6 structural checks)
  agents/literature-reviewer.md (×6 structural checks)
  agents/data-analyst.md (×6 structural checks)
  agents/peer-reviewer.md (×6 structural checks)
  agents/latex-writer.md (×6 structural checks)

Scientific Research Squad — Research Lead systematic review protocols
  ✓ research-lead references PRISMA or CONSORT protocols
  ✓ research-lead references PICO framework
  ✓ research-lead has pre-registration requirement in Anti-Patterns

Scientific Research Squad — Literature Reviewer PRISMA compliance
  ✓ literature-reviewer references PRISMA
  ✓ literature-reviewer mentions minimum 3 databases
  ✓ literature-reviewer VETO references systematic review methodology

Scientific Research Squad — Data Analyst statistical rigor
  ✓ data-analyst references statistical analysis plan
  ✓ data-analyst references effect sizes and confidence intervals

Scientific Research Squad — built-in templates
  ✓ has PRISMA checklist template
  ✓ PRISMA checklist has at least 20 checklist items
  ✓ PRISMA checklist covers title, abstract, methods, results, and discussion
  ✓ has statistical analysis plan template
  ✓ SAP template includes sample size and power calculation section
  ✓ SAP template includes primary and secondary outcomes
  ✓ SAP template includes missing data handling section
  ✓ SAP template includes deviations section for transparency

Scientific Research Squad — validateSquadStructure
  ✓ passes structural validation with zero errors

Scientific Research Squad — validateHandoffGraph
  ✓ passes handoff graph validation with zero errors
```

**Total: 53 tests in US-040, already in the 1760-test baseline.**

### Architecture Context

**Layer dependency (no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

**File system classification:**
- `templates/squads/scientific-research/` — source in npm package (for squad validation)
- `.buildpact/squads/scientific-research/` — installed copy in user's project (read-only at runtime)
- **Private Squad** — NOT bundled in npm; installed via `npx buildpact squad add scientific-research` (internal/Beta use only)

**FR mapping:**
- `FR-902` — 6-layer agent anatomy (all 5 agents must comply)
- `FR-903` — Voice DNA 5-section template (all 5 agents must comply)
- `FR-1003` — Scientific Research Squad with systematic review protocols

### Anti-Patterns to Avoid

- ❌ Do NOT add programmatic domain_questions enforcement in `src/` — questions are behavioral (Voice DNA + squad.yaml) in Prompt Mode v1.0
- ❌ Do NOT modify `validateSquadStructure` — it's pure and tested at 90%+ coverage
- ❌ Do NOT add the scientific-research squad as a bundled npm copy — it's private/internal Beta (unlike the software squad)
- ❌ Do NOT add a YAML library — squad.yaml parsing still uses regex (established in story 8.6)
- ❌ Do NOT create new TypeScript source files for this story — read-only verification only
- ❌ Do NOT add `export default` — named exports only throughout `src/`

### Previous Story Intelligence (Story 9.2)

- **1760 tests passing** at end of story 9.2 — US-040 (scientific-research-squad.test.ts) was pre-built and already in that count
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching filesystem
- **Read-only verification pattern:** Stories 9.1 and 9.2 made no source code changes — same pattern applies here
- **`src/squads/index.ts` after 9.2:** exports `validateSquad`, leveling functions, AND loader functions (`readSquadManifest`, `buildAgentIndex`, `loadAgentDefinition`)

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `@clack/prompts` | ^1.1.0 | ONLY in CLI handler — never in templates |
| yaml library | **NONE** | No yaml dep; squad.yaml read via regex |

### Key Files to Read During Implementation

- `templates/squads/scientific-research/agents/research-lead.md` — verify Task 1.1 + PRISMA/PICO/pre-registration
- `templates/squads/scientific-research/agents/literature-reviewer.md` — verify Task 1.2 + databases + PRISMA
- `templates/squads/scientific-research/agents/data-analyst.md` — verify Task 1.3 + SAP + effect size
- `templates/squads/scientific-research/agents/peer-reviewer.md` — verify Task 1.4 structural
- `templates/squads/scientific-research/agents/latex-writer.md` — verify Task 1.5 structural
- `templates/squads/scientific-research/squad.yaml` — verify Task 1.6
- `templates/squads/scientific-research/templates/prisma-checklist.md` — verify Task 2.1
- `templates/squads/scientific-research/templates/statistical-analysis-plan.md` — verify Task 2.2
- `src/engine/squad-scaffolder.ts` — `validateSquadStructure()` and `validateHandoffGraph()`
- `test/unit/engine/scientific-research-squad.test.ts` — US-040 comprehensive test suite

### Project Structure Notes

- Squad source lives in `templates/squads/scientific-research/` — aligned with unified project structure
- Test file at `test/unit/engine/scientific-research-squad.test.ts` — aligned with `test/unit/engine/` location (same as software-squad.test.ts and medical-marketing-squad.test.ts)
- No `test/integration/` additions expected

### References

- [Source: epics.md#Epic9-Story9.3] — User story, ACs, squad agents, systematic review protocols
- [Source: architecture.md#FR-902] — 6-layer agent anatomy requirements
- [Source: architecture.md#FR-903] — Voice DNA 5-section template
- [Source: architecture.md#squads-directory] — `src/squads/` module structure
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/`
- [Source: src/engine/squad-scaffolder.ts] — `validateSquadStructure`, `validateHandoffGraph`
- [Source: test/unit/engine/scientific-research-squad.test.ts] — US-040 full structural + domain-specific tests
- [Source: story 9-2-medical-marketing-squad-cfm-compliant.md] — 1760 tests baseline, read-only verification pattern
- [Source: templates/squads/scientific-research/squad.yaml] — 5 agents, phases, domain_questions

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No debugging required — read-only verification story with all pre-built assets present and correct.

### Completion Notes List

- ✅ Task 1.1: research-lead.md — All 6 layers present; Voice DNA 5 sections; 5 ✘ Anti-Patterns; 4 heuristics; VETO present; 3 examples; 4 handoffs; PRISMA/CONSORT reference; PICO framework; pre-registration in Anti-Patterns.
- ✅ Task 1.2: literature-reviewer.md — All structural checks; databases: PubMed, Embase, Cochrane (3); PRISMA reference; VETO present.
- ✅ Task 1.3: data-analyst.md — All structural checks; "statistical analysis plan" reference; effect size and confidence interval present.
- ✅ Task 1.4: peer-reviewer.md — All structural checks pass.
- ✅ Task 1.5: latex-writer.md — All structural checks pass.
- ✅ Task 1.6: squad.yaml — 5 agents; phases routing; domain_questions (4 required topics); bundle_disclaimers present.
- ✅ Task 2.1: prisma-checklist.md — 40 checklist items (≥20 req); 5 required sections (Title, Abstract, Methods, Results, Discussion).
- ✅ Task 2.2: statistical-analysis-plan.md — SAP text; sample size + power (§4.1); primary + secondary outcomes (§3.1, §3.2); missing data (§4.4); deviations section (§6).
- ✅ Task 3.1: npx vitest run — 1760/1760 tests pass, 71 test files, baseline maintained.
- ✅ Task 3.2: scientific-research-squad.test.ts (US-040) — 58 tests pass; all test groups green.

### File List

- templates/squads/scientific-research/agents/research-lead.md (verified, read-only)
- templates/squads/scientific-research/agents/literature-reviewer.md (verified, read-only)
- templates/squads/scientific-research/agents/data-analyst.md (verified, read-only)
- templates/squads/scientific-research/agents/peer-reviewer.md (verified, read-only)
- templates/squads/scientific-research/agents/latex-writer.md (verified, read-only)
- templates/squads/scientific-research/squad.yaml (verified, read-only)
- templates/squads/scientific-research/templates/prisma-checklist.md (verified, read-only)
- templates/squads/scientific-research/templates/statistical-analysis-plan.md (verified, read-only)
- test/unit/engine/scientific-research-squad.test.ts (executed, read-only)
- _bmad-output/implementation-artifacts/9-3-scientific-research-squad.md (story file updated)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status updated)

## Change Log

- 2026-03-19: Read-only verification of pre-built Scientific Research Squad assets completed. All 5 agent files, squad.yaml, and both templates pass structural and domain-specific validation. US-040 (58 tests) and full test suite (1760 tests) pass with no regressions. Story status: in-progress → review.
