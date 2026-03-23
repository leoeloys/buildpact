# Story 8.3: Voice DNA Creation with 5-Section Template

Status: done

## Story

As a Squad creator wanting to clone a specialist's communication style,
I want a mandatory 5-section Voice DNA template with a step-by-step creation guide,
So that every agent speaks authentically in the specialist's voice rather than sounding like a generic AI.

## Acceptance Criteria

**AC-1: Voice DNA 5-Section Template in Every Scaffolded Agent**

Given I create or scaffold an agent in a Squad
When I open the agent file
Then the Voice DNA layer contains all 5 mandatory subsections: (1) Personality Anchors, (2) Opinion Stance, (3) Anti-Patterns (min 5 ✘/✔ pairs), (4) Never-Do Rules, (5) Inspirational Anchors
And each subsection has inline documentation explaining what to fill in

**AC-2: Validation Fails When Voice DNA Sections Are Missing**

Given an agent's Voice DNA layer is missing one or more of the 5 mandatory sections
When Squad validation runs
Then validation fails with a clear error identifying the agent file and the specific missing section
And the error message follows the format: `agents/<file>.md: Voice DNA missing section "<section_name>"`

**AC-3: Step-by-Step Voice DNA Creation Guide Available in Documentation**

Given I am new to Voice DNA creation
When I access the Squad documentation (`templates/commands/squad.md`)
Then a `## Voice DNA Creation` section is present with a step-by-step guide
And the guide explains how to analyze specialist content and fill each of the 5 sections
And the section references the canonical example (`templates/squads/software/agents/pm.md`)

## Tasks / Subtasks

- [x] Task 1: Add `## Voice DNA Creation` section to `templates/commands/squad.md` (AC: #3)
  - [x] 1.1: Insert new section between `## 6-Layer Agent Definition` and `## Implementation Notes`
  - [x] 1.2: Document all 5 subsections with purpose and fill-in guidance
  - [x] 1.3: Include a 3-step creation process: analyze, extract, fill
  - [x] 1.4: Reference `templates/squads/software/agents/pm.md` as canonical example
  - [x] 1.5: Verify cumulative squad.md line count ≤ 300 (expected: ~116 lines after this addition)

- [x] Task 2: Verify `src/engine/squad-scaffolder.ts` — read-only check (AC: #1, #2)
  - [x] 2.1: Confirm `buildAgentTemplate()` includes all 5 Voice DNA `###` subsections with inline placeholder text
  - [x] 2.2: Confirm `validateSquadStructure()` checks all 5 Voice DNA sections and errors identify agent filename + section name
  - [x] 2.3: Confirm Anti-Patterns minimum 5 ✘ pairs validation is present
  - [x] 2.4: Update `buildAgentTemplate()` or `validateSquadStructure()` only if gaps are found

- [x] Task 3: Verify test coverage (AC: #1, #2)
  - [x] 3.1: Confirm `test/unit/engine/squad-scaffolder.test.ts` has a test asserting all 5 Voice DNA sections exist in scaffolded agents
  - [x] 3.2: Confirm there is a test for missing Voice DNA section producing an error with agent filename + section name
  - [x] 3.3: Confirm Anti-Patterns < 5 pairs produces a validation error
  - [x] 3.4: Add any missing test cases

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass, 0 failures
  - [x] 4.2: Verify squad.md line count ≤ 300

## Dev Notes

### ⚠️ PRE-BUILT FOUNDATION — VERIFY BEFORE WRITING

Both `src/engine/squad-scaffolder.ts` (547 LOC) AND the test file were completed as part of stories 8.1 and 8.2. **The primary deliverable for story 8.3 is Task 1 (the `## Voice DNA Creation` section in squad.md).** TypeScript changes in Task 2 are conditional — only if verification reveals gaps.

**Current known state (as of story 8.2 completion, 2026-03-19):**

| File | Expected Status | Notes |
|------|----------------|-------|
| `templates/commands/squad.md` | ⚠️ Needs update | Add `## Voice DNA Creation` step-by-step guide (currently 89 lines) |
| `src/engine/squad-scaffolder.ts` | ✅ Likely complete | All 5 Voice DNA sections in `buildAgentTemplate()`, 5-section + anti-patterns validation in `validateSquadStructure()` |
| `test/unit/engine/squad-scaffolder.test.ts` | ✅ Likely complete | `each agent template contains Voice DNA 5 sections` test exists; anti-patterns test exists |

### ⚠️ squad.md Already References `## Voice DNA Creation`

In `squad.md` line 69, the 6-Layer Agent Anatomy table says:
```
| Voice DNA | 5 sections: Personality Anchors, Opinion Stance, Anti-Patterns (≥5 ✘/✔ pairs), Never-Do Rules, Inspirational Anchors |
```
And the 6-Layer Agent Definition section (lines 65-82) references:
```
| 3 | `## Voice DNA` | 5 subsections — see `## Voice DNA Creation` |
```
This forward reference to `## Voice DNA Creation` is a dangling reference — **this story fulfills it**.

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```
`squad-scaffolder.ts` lives in `src/engine/` — do NOT add imports from `src/commands/` inside `src/engine/`.

**FR mapping:**
- `FR-903` → Voice DNA 5-section mandatory template + step-by-step creation guide
- `FR-902` → 6-layer agent anatomy (Voice DNA is Layer 3)
- `FR-905` → Squad validation — Voice DNA 5-section compliance

**Coverage thresholds (must maintain):**
| Module | Threshold |
|--------|-----------|
| `src/contracts/**` | 100% |
| `src/squads/validator.ts` | 90% (does not exist yet — Story 8.4) |
| global | 70% |

### Voice DNA 5-Section Complete Specification

Story 8.3 documents this in `squad.md`. Each section is mandatory for every agent:

| # | Subsection | Minimum Requirement | Example |
|---|-----------|---------------------|---------|
| 1 | `### Personality Anchors` | 3–5 actionable behavioral traits | `"Direct and decisive — you recommend, not just list options"` |
| 2 | `### Opinion Stance` | ≥1 explicit opinion declaration | `"You have strong opinions on scope: ruthlessly cut features that don't serve the core use case"` |
| 3 | `### Anti-Patterns` | ≥5 ✘/✔ pairs (prohibited → required) | `"✘ Never say 'it depends' without a recommendation"` / `"✔ Always define AC in Given/When/Then"` |
| 4 | `### Never-Do Rules` | Explicit prohibitions — no exceptions | `"Never create a story without an acceptance criterion"` |
| 5 | `### Inspirational Anchors` | Reference personas/archetypes calibrating tone | `"Inspired by: Amazon's Working Backwards, Shape Up by Basecamp"` |

**Canonical reference:** `templates/squads/software/agents/pm.md` (65 lines) — complete, valid, production-quality example. Use it verbatim when writing the guide.

### squad.md Section to Add

Insert between `## 6-Layer Agent Definition` (ends at line 82) and `## Implementation Notes` (line 84):

```markdown
## Voice DNA Creation

Voice DNA (Layer 3) defines how an agent thinks and communicates. Every agent MUST include all 5 subsections.

**Step 1 — Analyze.** Collect 10–50 samples of the specialist's real output: emails, reports, decisions, feedback threads. Note recurring vocabulary, sentence length, opinion directness, and what the specialist refuses to do.

**Step 2 — Extract.** Distill patterns into each subsection:
| Subsection | What to extract | Min |
|-----------|----------------|-----|
| `### Personality Anchors` | 3–5 core traits as action statements | 3 |
| `### Opinion Stance` | Strong preferences — does the agent disagree? | 1 |
| `### Anti-Patterns` | ✘ (what they NEVER do) / ✔ (what they ALWAYS do) | 5 pairs |
| `### Never-Do Rules` | Hard prohibitions, no exceptions | 1 |
| `### Inspirational Anchors` | Archetypes or books that calibrate tone | 1 |

**Step 3 — Fill.** Paste into the agent file following the template structure in each scaffolded agent.

Reference example: `templates/squads/software/agents/pm.md` — complete valid Voice DNA.
Validation: `validateSquadStructure()` reports missing sections and Anti-Patterns < 5 pairs.
```

### Validation Error Message Format (Existing — Do NOT Change)

The current `validateSquadStructure()` error format for Voice DNA:
```
agents/specialist.md: Voice DNA missing section "Personality Anchors"
agents/chief.md: Anti-Patterns requires minimum 5 prohibited/required pairs (found 3)
```

**This format is already implemented and tested** in story 8.2. Story 8.3 does NOT change it.

### squad.md Line Budget

| Story | Section Added | Lines | Cumulative |
|-------|---------------|-------|-----------|
| Base  | Header comment + Implementation Notes | ~6 | ~6 |
| 8.1   | Squad Create + Squad Installation | ~60 | ~66 |
| 8.2   | 6-Layer Agent Definition | ~23 | ~89 |
| **8.3** | **Voice DNA Creation** | **~27** | **~116** |
| 8.4   | Squad Validation | ~20 | ~136 |

Target: ≤ 300 lines total. Budget: ~164 remaining after 8.3.

### Anti-Patterns to Avoid

- ❌ Do NOT create `src/squads/validator.ts` — that is for Story 8.4
- ❌ Do NOT modify `templates/squads/software/agents/*.md` — these are reference implementations, not scaffolds
- ❌ Do NOT add new i18n keys — check `locales/en.yaml` (lines 262–311) first; all squad keys already registered
- ❌ Do NOT recreate or restructure `squad-scaffolder.ts` — verify first, only update if AC gaps are found
- ❌ Do NOT import from `src/commands/` inside `src/engine/` — layer violation
- ❌ Do NOT change the validation error message format — it is already tested and locked

### Previous Story Intelligence (Story 8.2)

- **Pre-built pattern:** `squad-scaffolder.ts` was pre-built before formal story tracking. Primary deliverable is always the `squad.md` orchestrator section.
- **1724 tests passing** at end of story 8.2 across 68 files — all must remain green
- **ESM imports:** `.js` extension MANDATORY on all internal imports (e.g., `import { foo } from './bar.js'`)
- **Result<T> pattern:** `ok(...)` on success, `err({ code, i18nKey, params })` on failure — never `throw`
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching the filesystem
- **squad.yaml was at 89 lines** after story 8.2 (target ≤ 300)

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

- `templates/commands/squad.md` is the primary orchestrator — **this is the main deliverable**
- `src/squads/` directory does not exist yet — do NOT create it for this story
- Agent files live in `<squad-dir>/agents/*.md` — filename (e.g., `specialist.md`) is used in error messages
- `templates/squads/software/agents/pm.md` is the canonical reference for a complete valid Voice DNA (65 lines)

### References

- [Source: epics.md#Epic8-Story8.3] — User story, ACs
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-903] — Voice DNA 5-section mandatory template + creation guide requirement
- [Source: architecture.md#FR-902] — 6-layer agent anatomy
- [Source: architecture.md#FR-905] — Squad validation — Voice DNA 5-section compliance
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← squads/ ← commands/`
- [Source: src/engine/squad-scaffolder.ts] — buildAgentTemplate, validateSquadStructure (547 LOC)
- [Source: templates/squads/software/agents/pm.md] — canonical valid Voice DNA reference (65 lines)
- [Source: templates/commands/squad.md] — current 89-line file; add `## Voice DNA Creation` section
- [Source: test/unit/engine/squad-scaffolder.test.ts] — existing Voice DNA section and anti-patterns tests
- [Source: locales/en.yaml#cli.squad] — squad i18n keys (lines 262–311) — no new keys needed
- [Source: story 8-2-6-layer-agent-definition.md] — squad.md budget tracking, 1724 passing tests baseline

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: Added `## Voice DNA Creation` section to `templates/commands/squad.md` (109 lines total, budget ≤ 300 ✅). Inserted between `## 6-Layer Agent Definition` and `## Implementation Notes`. Section includes 3-step process (Analyze → Extract → Fill), extraction table for all 5 subsections with minimums, and references both the canonical example and the validator.
- Task 2: `src/engine/squad-scaffolder.ts` verified complete — `buildAgentTemplate()` has all 5 Voice DNA `###` subsections with inline placeholder text (lines 133–163); `validateSquadStructure()` checks all 5 sections with correct error format `agents/<file>.md: Voice DNA missing section "<section_name>"` (lines 344–356); Anti-Patterns ≥5 ✘ pairs enforcement present (lines 358–368). No changes needed.
- Task 3: Tests 3.1 (`each agent template contains Voice DNA 5 sections`) and 3.3 (`Anti-Patterns < 5 pairs produces error`) already existed. Added test 3.2: `error message identifies agent filename and Voice DNA section name when section is missing (AC-2)` — verifies exact format `agents/specialist.md: Voice DNA missing section "Opinion Stance"`.
- Task 4: `npx vitest run` — 1725 tests pass across 68 files, 0 failures. squad.md at 109 lines.

### File List

- `templates/commands/squad.md` — added `## Voice DNA Creation` section (~20 lines, total 109)
- `test/unit/engine/squad-scaffolder.test.ts` — added test for missing Voice DNA section error format (AC-2)
