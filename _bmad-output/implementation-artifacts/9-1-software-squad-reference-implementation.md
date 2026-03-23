# Story 9.1: Software Squad — Reference Implementation

Status: done

## Story

As a developer using BuildPact for software projects,
I want the Software Squad pre-installed and ready to use out of the box,
So that I can immediately access specialized PM, Architect, Developer, QA, and Tech Writer agents without building my own Squad first.

## Acceptance Criteria

**AC-1: Software Squad Available After Installation with Software Domain**

Given I install BuildPact and select the Software domain during setup
When installation completes (with Squad installation confirmed)
Then the Software Squad is available in `.buildpact/squads/software/` with all agents fully defined: PM, Architect, Developer, QA, Tech Writer
And each agent follows the 6-layer anatomy and Voice DNA 5-section template
And the Squad passes all structural validation checks out of the box

**AC-2: Pipeline Phase Routing via Software Squad**

Given the Software Squad is active
When I run `/bp:specify`, `/bp:plan`, or `/bp:execute`
Then the appropriate Squad agent is engaged for each phase (PM for specify, Architect for plan, Developer for execute, QA for verify, Tech Writer for document)
And the `phases` mapping in `squad.yaml` drives this routing

**AC-3: Reference Implementation for Community Contributors**

Given the Software Squad is bundled in the npm package at `templates/squads/software/`
When community contributors study the Software Squad files
Then each agent serves as a canonical, complete example of the 6-layer anatomy and Voice DNA 5-section template
And the README documents the source of truth (github.com/buildpact/buildpact-squads) and update mechanism (`npx buildpact squad add software`)

## Tasks / Subtasks

- [x] Task 1: Verify all 5 agent files pass structural validation (AC: #1, #3)
  - [x] 1.1: Read `templates/squads/software/agents/developer.md` — confirm all 6 layers present, Voice DNA 5 sections, ≥5 ✘ anti-pattern pairs, ≥3 IF/THEN heuristics with at least one VETO, ≥3 examples, ≥1 handoff entry
  - [x] 1.2: Read `templates/squads/software/agents/qa.md` — same validation checks
  - [x] 1.3: Read `templates/squads/software/agents/tech-writer.md` — same validation checks
  - [x] 1.4: Read `templates/squads/software/squad.yaml` — confirm `phases:` block routes specify→pm, plan→architect, execute→developer, verify→qa, document→tech-writer
  - [x] 1.5: Run `validateSquadStructure(SOFTWARE_SQUAD_DIR)` manually OR run `npx vitest run test/unit/engine/software-squad.test.ts` to confirm zero errors

- [x] Task 2: Run full test suite and verify no regressions (AC: all)
  - [x] 2.1: `npx vitest run` — baseline was 1760 tests passing (story 8.6); all must remain green
  - [x] 2.2: Confirm `test/unit/engine/software-squad.test.ts` (US-038) passes all validation groups: squad.yaml, agent files (5×6 checks per agent), validateSquadStructure, validateHandoffGraph
  - [x] 2.3: Confirm `test/integration/pipeline/init-flow.test.ts` AC-3 group passes (offline bundled squad install)

- [x] Task 3: Verify README serves as reference implementation guide (AC: #3)
  - [x] 3.1: Read `templates/squads/software/README.md` — confirm it documents source of truth URL and `squad add` update command
  - [x] 3.2: If README is missing agent role descriptions or source-of-truth info, add the missing content (file currently has basic content — check adequacy)

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The Software Squad agent files, squad.yaml, and all tests were pre-built before formal story tracking. **Read-only verification is the primary task.**

| File | Status | Notes |
|------|--------|-------|
| `templates/squads/software/squad.yaml` | ✅ Complete | All required YAML fields + `phases:` routing |
| `templates/squads/software/agents/pm.md` | ✅ Complete | All 6 layers, Voice DNA 5 sections verified |
| `templates/squads/software/agents/architect.md` | ✅ Complete | All 6 layers, Voice DNA 5 sections verified |
| `templates/squads/software/agents/developer.md` | Pre-built | Needs verification (Task 1.1) |
| `templates/squads/software/agents/qa.md` | Pre-built | Needs verification (Task 1.2) |
| `templates/squads/software/agents/tech-writer.md` | Pre-built | Needs verification (Task 1.3) |
| `templates/squads/software/README.md` | ✅ Complete | Source of truth + squad add documented |
| `test/unit/engine/software-squad.test.ts` | ✅ Complete | US-038 — comprehensive structural validation |
| `test/integration/pipeline/init-flow.test.ts` | ✅ Complete | AC-3 group: offline bundled install |
| `src/foundation/installer.ts` | ✅ Complete | Copies `templates/squads/software/` when `installSquad=true` |

### squad.yaml — Current Complete State

```yaml
name: software
version: "0.1.0"
domain: software
domain_type: software
description: "Full-stack software development squad — PM, Architect, Developer, QA, Tech Writer"
initial_level: L2

bundle_disclaimers:
  pt-br: "Este conteúdo foi gerado por IA e deve ser revisado antes do uso em produção."
  en: "This content was AI-generated and should be reviewed before production use."

agents:
  pm:
    file: agents/pm.md
  architect:
    file: agents/architect.md
  developer:
    file: agents/developer.md
  qa:
    file: agents/qa.md
  tech-writer:
    file: agents/tech-writer.md

phases:
  specify: pm
  plan: architect
  execute: developer
  verify: qa
  document: tech-writer
```

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

Each agent's `## Voice DNA` MUST contain exactly these 5 subsections:

| Subsection | Requirement |
|-----------|-------------|
| `### Personality Anchors` | 3–5 core behavioral traits as actionable statements |
| `### Opinion Stance` | Explicit declaration the agent has preferences and can disagree |
| `### Anti-Patterns` | ≥5 ✘/✔ pairs — what the agent NEVER does vs. ALWAYS does |
| `### Never-Do Rules` | Explicit prohibitions with no ambiguity |
| `### Inspirational Anchors` | Reference personas/archetypes that calibrate tone |

Validated by `validateSquadStructure()` in `src/engine/squad-scaffolder.ts`:
- Checks: ≥5 ✘ markers in Anti-Patterns
- Checks: ≥3 IF/THEN rules in Heuristics
- Checks: ≥1 VETO condition
- Checks: ≥3 examples (matching `/^\d+\.\s+\*\*/m` pattern)
- Checks: ≥1 handoff (`- ←` or `- →`)

### How Installation Works (AC-1)

The installer (`src/foundation/installer.ts`) handles squad copy at install time:

```typescript
// Step 7: Install Squad (bundled fallback)
if (installSquad) {
  const squadSrc = join(templatesDir, 'squads', 'software')
  const squadDest = join(buildpactDir, 'squads', 'software')
  await copyDir(squadSrc, squadDest)
}
```

**Important:** `installSquad` is a boolean from the CLI's Step 6 (yes/no confirm). It is NOT automatically tied to domain selection. When `installSquad=true` (user confirmed), the software squad is always installed. The Software Squad is the ONLY bundled squad in v1.0 Alpha.

### How Phase Routing Works (AC-2)

The `phases:` block in `squad.yaml` maps pipeline commands to agents:

```yaml
phases:
  specify: pm        # /bp:specify → pm.md loads
  plan: architect    # /bp:plan → architect.md loads
  execute: developer # /bp:execute → developer.md loads
  verify: qa         # /bp:verify → qa.md loads
  document: tech-writer # /bp:document → tech-writer.md loads
```

The squad loader (`src/squads/loader.ts` — from Story 8.6) reads the squad.yaml via `readSquadManifest()` and the `phases` routing is consumed by the command handlers to activate the correct agent for each pipeline phase.

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

**File system classification (squads are read-only in normal use):**
- `templates/squads/software/` — npm package bundled copy (source for installer)
- `.buildpact/squads/software/` — installed copy in user's project (read-only via squad commands)
- Squad files modified ONLY via explicit `squad add` / `squad create` commands

**FR mapping:**
- `FR-901` — 4-tier squad hierarchy (Software Squad uses T1 agents throughout)
- `FR-902` — 6-layer agent anatomy
- `FR-903` — Voice DNA 5-section template
- `FR-1001` — Bundled Software Squad copy in npm package
- `FR-1002` — Software Squad as reference implementation for community

### Test Coverage Reference

The existing test file `test/unit/engine/software-squad.test.ts` covers:

```
Software Squad — squad.yaml
  ✓ has all required YAML fields
  ✓ has phases mapping for all pipeline phases
  ✓ lists all 5 agents in agents block

Software Squad — agent files
  ✓ has exactly 5 agent files
  agents/pm.md (×6 checks: layers, Voice DNA, anti-patterns, heuristics, VETO, examples, handoffs)
  agents/architect.md (same ×6)
  agents/developer.md (same ×6)
  agents/qa.md (same ×6)
  agents/tech-writer.md (same ×6)

Software Squad — validateSquadStructure
  ✓ passes structural validation with zero errors

Software Squad — validateHandoffGraph
  ✓ passes handoff graph validation with zero errors
```

And `test/integration/pipeline/init-flow.test.ts` covers:

```
AC-3: Offline fallback — bundled Software Squad
  ✓ installs bundled Software Squad without network access
```

### Anti-Patterns to Avoid

- ❌ Do NOT modify the functional validation logic in `validateSquadStructure` — it's pure and tested at 90%+ coverage
- ❌ Do NOT add `phases:` parsing to `readSquadManifest()` in `src/squads/loader.ts` — the loader only handles agent file refs; phase routing is read by command handlers separately
- ❌ Do NOT add a YAML library — squad.yaml parsing still uses regex (from Story 8.6 pattern)
- ❌ Do NOT create `src/squads/router.ts` — that file is planned but not this story's scope
- ❌ Do NOT change squad agent markdown format — the format is frozen; validator checks it
- ❌ Do NOT add `export default` — named exports only throughout `src/`

### Previous Story Intelligence (Story 8.6)

- **1760 tests passing** at end of story 8.6 — all must remain green
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching filesystem
- **`src/squads/index.ts` after 8.6:** exports `validateSquad`, leveling functions, AND loader functions (`readSquadManifest`, `buildAgentIndex`, `loadAgentDefinition`)
- **`templates/commands/squad.md` at 163 lines** (≤ 300 budget) after 8.6

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `@clack/prompts` | ^1.1.0 | ONLY in CLI handler — never in templates |
| yaml library | **NONE** | No yaml dep; squad.yaml read via regex |

### Key Files to Read During Implementation

- `templates/squads/software/agents/developer.md` — verify Task 1.1
- `templates/squads/software/agents/qa.md` — verify Task 1.2
- `templates/squads/software/agents/tech-writer.md` — verify Task 1.3
- `src/engine/squad-scaffolder.ts` — `validateSquadStructure()` and `validateHandoffGraph()` implementations (to understand exactly what's checked)
- `test/unit/engine/software-squad.test.ts` — existing test coverage (US-038)
- `test/integration/pipeline/init-flow.test.ts` — AC-3 offline install integration test

### References

- [Source: epics.md#Epic9-Story9.1] — User story, ACs, Technical Requirements, squad.yaml structure
- [Source: architecture.md#FR-1001] — Software Squad bundling decision (Model B: bundled copy + squad add)
- [Source: architecture.md#FR-902] — 6-layer agent anatomy requirements
- [Source: architecture.md#FR-903] — Voice DNA 5-section template
- [Source: architecture.md#squads-directory] — `src/squads/` module structure
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/`
- [Source: src/foundation/installer.ts#147-160] — Squad copy logic (Step 7)
- [Source: src/squads/loader.ts] — `readSquadManifest`, `buildAgentIndex` (from 8.6)
- [Source: src/engine/squad-scaffolder.ts] — `validateSquadStructure`, `validateHandoffGraph`
- [Source: test/unit/engine/software-squad.test.ts] — US-038 structural validation tests
- [Source: test/integration/pipeline/init-flow.test.ts] — AC-3 offline squad install
- [Source: story 8-6-lazy-agent-loading.md] — 1760 tests baseline, loader.ts exports

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues. All 5 agents were pre-built and fully compliant. Test suite passed on first run.

### Completion Notes List

- Task 1: Read-only verification of all 5 agent files. developer.md, qa.md, and tech-writer.md all confirmed complete: 6 layers present, Voice DNA 5 sections (with ≥5 ✘ anti-pattern markers, ≥3 IF/THEN heuristics, ≥1 VETO each), ≥3 examples, ≥1 handoff entries. pm.md and architect.md already verified during create-story. squad.yaml confirmed with complete `phases:` routing (specify→pm, plan→architect, execute→developer, verify→qa, document→tech-writer).
- Task 2: `npx vitest run` — 1760 tests passed, 71 files, 0 failures. Exact match to story 8.6 baseline. software-squad.test.ts (US-038) passes all groups: squad.yaml checks, per-agent structural checks (5×6 assertions), validateSquadStructure (zero errors), validateHandoffGraph (zero errors). init-flow.test.ts AC-3 group passes (offline bundled squad install).
- Task 3: README confirmed complete — source of truth (github.com/buildpact/buildpact-squads), `npx buildpact squad add software` update command, and all 5 agent role descriptions documented. No additions needed.
- This is a read-only verification story following the pre-built pattern from Epic 8. All files were built before formal story tracking. No source code changes were made.

### File List

_No files created or modified — read-only verification story._

## Change Log

- 2026-03-19: Verified Story 9.1 — Software Squad Reference Implementation. All 5 agent files pass 6-layer anatomy + Voice DNA 5-section validation. squad.yaml phases routing confirmed. 1760 tests pass, 0 regressions. README complete with source-of-truth and update mechanism documented.
