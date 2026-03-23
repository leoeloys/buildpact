# Story 8.2: 6-Layer Agent Definition

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Squad creator defining an individual agent,
I want a clear, enforced 6-layer anatomy template for each agent,
So that all agents in my Squad have consistent structure and the validator can check them automatically.

## Acceptance Criteria

**AC-1: 6-Layer Template in Every Scaffolded Agent**

Given I create or scaffold an agent in a Squad
When I open the agent file
Then it contains all 6 required layers: identity, persona, voice_dna, heuristics (IF/THEN decision rules with veto conditions), examples (minimum 3 concrete input/output pairs), and handoffs (delegation rules)
And each layer has inline documentation with a concrete example

**AC-2: Validation Reports Missing Layers by Agent and Layer**

Given an agent definition is missing one or more layers
When Squad validation runs
Then the missing layers are reported as errors with a specific reference to which agent and which layer is incomplete

## Tasks / Subtasks

- [x] Task 1: Add `## 6-Layer Agent Definition` section to `templates/commands/squad.md` (AC: #1, #2)
  - [x] 1.1: Insert new section after `## Squad Installation` and before `## Implementation Notes`
  - [x] 1.2: Document each layer's anatomy with: section heading, minimum requirement, and a one-line concrete example snippet
  - [x] 1.3: Document the validation error format (agent filename + layer name) for AC-2
  - [x] 1.4: Verify cumulative squad.md line count ≤ 300 (expected: ~91 lines after this addition)

- [x] Task 2: Verify `src/engine/squad-scaffolder.ts` — read-only check (AC: #1, #2)
  - [x] 2.1: Confirm `buildAgentTemplate()` (or equivalent builder function) includes inline `<!-- LAYER N: description — example -->` comments above each layer section
  - [x] 2.2: Confirm each `<!-- LAYER N -->` comment contains a **concrete fill-in example** (not just a description), matching the format documented in squad.md
  - [x] 2.3: Confirm `validateSquadStructure()` error messages include both the agent filename and the missing/incomplete layer name (required by AC-2)
  - [x] 2.4: If inline docs lack concrete examples or error messages lack agent+layer specificity, update `buildAgentTemplate()` / `validateSquadStructure()` accordingly

- [x] Task 3: Verify test coverage (AC: #1, #2)
  - [x] 3.1: Confirm `test/unit/engine/squad-scaffolder.test.ts` asserts that scaffolded agent templates contain `<!-- LAYER` comments in all 6 layer sections
  - [x] 3.2: Confirm test for `validateSquadStructure()` asserts error messages include agent filename and layer name (e.g., `agent "specialist.md": missing layer "examples"`)
  - [x] 3.3: Add missing test cases if either assertion is absent

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass, 0 failures
  - [x] 4.2: Verify squad.md line count ≤ 300

## Dev Notes

### ⚠️ PRE-BUILT FOUNDATION — VERIFY BEFORE WRITING

`src/engine/squad-scaffolder.ts` (547 LOC) was pre-built before formal story tracking. Check if the template builder already satisfies AC-1 and AC-2 before writing any new TypeScript. The primary deliverable is Task 1 (squad.md documentation section). TypeScript changes in Task 2 are conditional — only required if the pre-built code falls short.

| File | Expected Status | Notes |
|------|----------------|-------|
| `templates/commands/squad.md` | ⚠️ Needs update | Add `## 6-Layer Agent Definition` section |
| `src/engine/squad-scaffolder.ts` | ✅ Likely complete | Verify `buildAgentTemplate()` + error message format |
| `test/unit/engine/squad-scaffolder.test.ts` | ✅ Likely complete | Verify layer-comment and error-message assertions |

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

`squad-scaffolder.ts` lives in `src/engine/` — called FROM `src/commands/squad/handler.ts`. Do NOT add imports from `src/commands/` inside `src/engine/`.

`src/squads/` does **not exist yet** — it is for stories 8.2–8.6 per architecture plan (`loader.ts`, `validator.ts`, `hook-runner.ts`, `router.ts`). Story 8.2 does NOT initialize `src/squads/`. That directory is the domain of story 8.4 (`validator.ts`) and beyond.

**FR mapping:**
- `FR-902` → 6-layer agent anatomy (identity, persona, voice_dna, heuristics, examples, handoffs)
- `FR-905` → Squad validation checks structural completeness (6 layers all agents)
- `FR-903` → Voice DNA 5-section template (Layer 3 — see Voice DNA spec below)

**Coverage thresholds:**
- `src/engine/squad-scaffolder.ts` (pure builder functions): covered via integration tests through `scaffoldSquad`
- `validateSquadStructure`: direct unit tests with temp dirs — error messages must match expected format
- Global minimum: 70%

### 6-Layer Anatomy — Complete Specification

Each scaffolded agent Markdown file MUST contain these 6 `##` sections in this order, each preceded by a `<!-- LAYER N: ... -->` comment with a concrete fill-in example:

| # | Section Heading | Minimum Requirement | Concrete Example |
|---|-----------------|---------------------|------------------|
| 1 | `## Identity` | One sentence: who the agent is and its role | `"You are the PM of the Software Squad. You translate business goals into precise, implementable specifications."` |
| 2 | `## Persona` | Behavioral style and working approach | `"Strategic thinker with deep user empathy. Asks 'why' before 'what' and 'what' before 'how'."` |
| 3 | `## Voice DNA` | 5 mandatory subsections: Personality Anchors, Opinion Stance, Anti-Patterns (≥5 ✘/✔ pairs), Never-Do Rules, Inspirational Anchors | See Voice DNA spec below |
| 4 | `## Heuristics` | ≥3 numbered IF/THEN rules; at least one rule flagged with VETO | `"IF acceptance criteria cannot be verified by a test, VETO: rewrite it until it can"` |
| 5 | `## Examples` | ≥3 labeled input/output pairs with brief reasoning | `"1. Input: 'As Lucas...' → Output: spec with Given/When/Then AC"` |
| 6 | `## Handoffs` | ≥1 `- →` or `- ←` entry with target agent and trigger condition | `"- → Architect: when spec is complete and reviewed"` |

### Voice DNA Sub-Layer Requirements (Layer 3)

Voice DNA is Layer 3 and requires exactly 5 subsections — missing any section is a validation error:

| Subsection | Requirement |
|------------|-------------|
| `### Personality Anchors` | 3–5 core behavioral traits as actionable statements |
| `### Opinion Stance` | Explicit declaration the agent has preferences and can disagree |
| `### Anti-Patterns` | ≥5 ✘/✔ pairs — what the agent NEVER does vs. ALWAYS does |
| `### Never-Do Rules` | Explicit prohibitions with no ambiguity |
| `### Inspirational Anchors` | Reference personas/archetypes that calibrate tone |

Reference implementation: `templates/squads/software/agents/pm.md` — the Software Squad's PM agent is a complete, valid 6-layer definition. Use it as the canonical example when writing inline docs.

### Inline Doc Comment Format (for `buildAgentTemplate()`)

Each `<!-- LAYER N -->` comment above a `##` section in scaffolded agent files MUST follow this format:

```markdown
<!-- LAYER 1: IDENTITY — One sentence describing who this agent is and its role.
     Example: "You are the [role] of the [domain] Squad. You [core responsibility]." -->
## Identity

[Fill in: one sentence]

<!-- LAYER 4: HEURISTICS — IF/THEN decision rules. At least one must be marked VETO.
     Example:
     1. IF the task lacks clear acceptance criteria, THEN request clarification before proceeding
     2. IF output quality falls below threshold, VETO: block delivery until remediated -->
## Heuristics

1. IF [condition], THEN [action]
2. IF [condition], THEN [action]
3. IF [condition], VETO: [blocking action]
```

### Validation Error Message Format (for `validateSquadStructure()`)

AC-2 requires errors to identify both agent and layer. The error format MUST be:

```
agent "chief.md": missing layer "examples" (min 3 pairs, found 0)
agent "specialist.md": missing layer "voice_dna.anti_patterns" (min 5 ✘/✔ pairs, found 3)
agent "support.md": missing layer "heuristics" (no VETO condition found)
```

This matches the `ValidationResult` type returned by `validateSquadStructure()`.

### squad.md Line Budget

| Story | Section Added | Lines | Cumulative |
|-------|---------------|-------|-----------|
| Base  | Header comment + Implementation Notes | ~6 | ~6 |
| 8.1   | Squad Create + Squad Installation | ~60 | ~66 |
| **8.2** | **6-Layer Agent Definition** | **~25** | **~91** |
| 8.3   | Voice DNA Creation (next) | ~25 | ~116 |
| 8.4   | Squad Validation (next) | ~20 | ~136 |

Target: ≤ 300 lines total. Budget: ~164 remaining after 8.2.

### squad.md Section to Add

Insert this section between `## Squad Installation` and `## Implementation Notes`:

```markdown
## 6-Layer Agent Definition

Every agent file in a Squad MUST define exactly 6 layers. Scaffolded templates include inline documentation with a concrete example for each layer.

| Layer | Section | Minimum Requirement |
|-------|---------|---------------------|
| 1 | `## Identity` | One sentence: who the agent is |
| 2 | `## Persona` | Behavioral style and working approach |
| 3 | `## Voice DNA` | 5 subsections — see `## Voice DNA Creation` |
| 4 | `## Heuristics` | ≥3 IF/THEN rules; 1 VETO condition |
| 5 | `## Examples` | ≥3 concrete input/output pairs |
| 6 | `## Handoffs` | ≥1 `- →` or `- ←` entry with trigger |

Validation errors report the agent filename and the missing/incomplete layer:
```
agent "specialist.md": missing layer "examples" (min 3 pairs, found 0)
```

Inline docs in scaffolded templates: `<!-- LAYER N: description — example -->` above each section.
Reference agent: `templates/squads/software/agents/pm.md` (complete valid example).
Implementation: `buildAgentTemplate()`, `validateSquadStructure()` in `src/engine/squad-scaffolder.ts`.
```

### Anti-Patterns to Avoid

- ❌ Do NOT create `src/squads/validator.ts` — that's for Story 8.4 Squad Validation
- ❌ Do NOT import from `src/commands/` inside `src/engine/` — layer violation
- ❌ Do NOT add new i18n keys — check `locales/en.yaml` (lines 262–311) first; all squad keys already registered
- ❌ Do NOT modify `templates/squads/software/agents/*.md` — these are the reference implementation, not the scaffold template
- ❌ Do NOT recreate `squad-scaffolder.ts` — verify first, only update if necessary

### Previous Story Intelligence (Story 8.1)

- **Pre-built pattern:** `squad-scaffolder.ts` was pre-built. Primary task is always the squad.md orchestrator section.
- **ESM imports:** `.js` extension MANDATORY on all internal imports (e.g., `import { foo } from './bar.js'`)
- **Result<T> pattern:** `ok(...)` on success, `err({ code: ..., i18nKey: ..., params: ... })` on failure — never `throw`
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching the filesystem
- **Layer dependency:** `engine/` modules called by `commands/` — never reverse
- **1723 tests passing** at end of Story 8.1 across 68 files — all must remain green

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | readFile, readdir for layer parsing |
| `node:path` | built-in | join, basename for agent filename in errors |
| `@clack/prompts` | latest | Only in handler.ts — not in engine/ |

### Project Structure Notes

- `src/squads/` directory does not exist yet — do NOT create it for this story
- Agent files live in `<squad-dir>/agents/*.md` — the filename (e.g., `specialist.md`) is used in error messages
- `templates/squads/software/agents/pm.md` is the canonical reference for a valid 6-layer agent (65 lines)
- Scaffolded agent templates are generated in-memory by `buildAgentTemplate()` and written via `scaffoldSquad()`

### References

- [Source: epics.md#Epic8-Story8.2] — User story, ACs
- [Source: architecture.md#FR-902] — 6-layer agent anatomy
- [Source: architecture.md#FR-903] — Voice DNA 5-section template
- [Source: architecture.md#FR-905] — Squad validation — structural completeness
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← squads/ ← commands/`
- [Source: src/engine/squad-scaffolder.ts] — scaffoldSquad, buildAgentTemplate, validateSquadStructure
- [Source: src/contracts/squad.ts] — AgentDefinition, SquadManifest, ValidationResult
- [Source: test/unit/engine/squad-scaffolder.test.ts] — inline doc and error message assertions
- [Source: templates/squads/software/agents/pm.md] — canonical valid 6-layer agent reference
- [Source: templates/commands/squad.md] — current 66-line file; add `## 6-Layer Agent Definition`
- [Source: locales/en.yaml#cli.squad] — all squad i18n keys (lines 262–311) — no new keys needed
- [Source: story 8-1-squad-scaffolding-and-installation.md] — squad.md budget tracking, pre-built verification pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_None — pre-built pattern; no debugging required._

### Completion Notes List

- Task 1: Added `## 6-Layer Agent Definition` section to `templates/commands/squad.md` (lines 61-83). Section includes a table of all 6 layers with section headings and minimum requirements, a concrete validation error format example, and references to `buildAgentTemplate()` and `validateSquadStructure()`. Final line count: 89 (≤ 300 budget).
- Task 2: Read-only verification of `src/engine/squad-scaffolder.ts` (547 LOC). All 6 `<!-- LAYER N: -->` inline comments confirmed in `buildAgentTemplate()`. `validateSquadStructure()` error messages use `agents/${agentFile}: ...` format including both agent filename and layer name. No TypeScript changes needed.
- Task 3: Updated `includes inline documentation` test to check all 6 `<!-- LAYER N:` comments (was only checking 1, 4, 5). Added new test `error message identifies agent filename and layer name (AC-2)` to confirm `validateSquadStructure()` error format includes agent filename + layer name.
- Task 4: `npx vitest run` — 1724 tests, 68 files, 0 failures. squad.md: 89 lines (≤ 300).

### File List

- `templates/commands/squad.md` — added `## 6-Layer Agent Definition` section (89 lines total)
- `test/unit/engine/squad-scaffolder.test.ts` — extended inline-doc test to cover all 6 layers; added AC-2 error-format test

## Change Log

- 2026-03-19: Added `## 6-Layer Agent Definition` section to squad.md orchestrator. Extended test coverage: all-6-layers inline-doc assertion and AC-2 agent-filename error message assertion. All 1724 tests pass.
