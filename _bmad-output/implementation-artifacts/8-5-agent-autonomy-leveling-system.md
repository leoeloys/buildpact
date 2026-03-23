# Story 8.5: Agent Autonomy Leveling System

Status: done

## Story

As a Squad creator managing agent trust over time,
I want each agent to have an autonomy level (L1–L4) that evolves based on its track record,
So that new agents operate conservatively and proven agents can act more independently.

## Acceptance Criteria

**AC-1: New Agents Assigned Default Level Recorded in Identity Layer**

Given I create a new agent in a Squad
When the agent is initialized
Then it is assigned autonomy level L1 (Observer) for T3 Support agents or L2 (Contributor) for T1/T2/T4 agents as the default
And the level is recorded in the agent's identity layer (YAML frontmatter `level:` field in the scaffolded template)

**AC-2: 85% Approval Over 7 Days → Suggest Promotion with User Confirmation**

Given an agent has been active for at least 7 days with an approve/reject ratio exceeding 85% approval (and ≥5 records in the window)
When the threshold is met
Then `buildpact squad level check` suggests promoting the agent to the next level and requires explicit user confirmation

**AC-3: 30% Rejection Over 7 Days → Suggest Demotion with User Confirmation**

Given an agent's rejection rate exceeds 30% in a rolling 7-day window
When the threshold is crossed
Then `buildpact squad level check` suggests demoting the agent one level with explicit user confirmation required

**AC-4: L1 Agents Require Explicit Confirmation for Write Operations**

Given any pipeline action requires write/commit operations
When the command dispatcher evaluates the request
Then the agent's autonomy level is checked — L1 agents always require explicit user confirmation for write operations
(This AC is satisfied by existing implementation in `src/commands/execute/handler.ts` lines 277–351 — verified read-only task)

## Tasks / Subtasks

- [x] Task 1: Create `src/squads/leveling.ts` — squads-layer facade for autonomy-manager (AC: #1, #2, #3)
  - [x] 1.1: Re-export all types from `src/engine/autonomy-manager.ts` needed by commands layer: `AgentApprovalStore`, `AgentApprovalRecord`, `AgentLevelState`, `LevelChangeSuggestion`
  - [x] 1.2: Re-export engine functions through squads boundary: `getAgentLevel`, `requiresWriteConfirmation`, `scanAgentSuggestions`, `recordApproval`, `applyLevelChange`, `checkPromotion`, `checkDemotion`, `readApprovalStore`
  - [x] 1.3: Implement `defaultLevelForTier(tier)` — returns `'L1'` for `'T3'`, `'L2'` for `'T1'` | `'T2'` | `'T4'`
  - [x] 1.4: Add JSDoc `@module squads` + `@see FR-851`

- [x] Task 2: Update `src/squads/index.ts` — add leveling exports (AC: #1, #2, #3)
  - [x] 2.1: Add named re-exports from `./leveling.js`: `defaultLevelForTier` function + all types
  - [x] 2.2: Keep existing `validateSquad` export untouched

- [x] Task 3: Add `runLevelCheck()` to `src/commands/squad/handler.ts` + wire subcommand (AC: #2, #3)
  - [x] 3.1: Add imports: `readApprovalStore`, `scanAgentSuggestions`, `applyLevelChange` from `../../squads/leveling.js`
  - [x] 3.2: Implement `runLevelCheck(args, projectDir)` — load store → scan suggestions → for each: show promote/demote confirm prompt → apply if confirmed
  - [x] 3.3: Wire `squad level check` route: when `subcommand === 'level' && subArgs[0] === 'check'` → call `runLevelCheck()`
  - [x] 3.4: Update `usage_hint` i18n key in `locales/en.yaml` and `locales/pt-br.yaml` to include `buildpact squad level check`

- [x] Task 4: Add `## Agent Autonomy Leveling` section to `templates/commands/squad.md` (AC: #1, #2, #3)
  - [x] 4.1: Insert after `## Squad Validation` and before `## Implementation Notes`
  - [x] 4.2: Include L1–L4 level table + promotion/demotion criteria + `squad level check` command usage
  - [x] 4.3: Verify squad.md line count ≤ 300 (currently 129 lines; target after 8.5 ≈ 151 lines)

- [x] Task 5: Create `test/unit/squads/leveling.test.ts` — unit tests for leveling module (AC: #1, #2, #3)
  - [x] 5.1: `defaultLevelForTier('T3')` returns `'L1'`
  - [x] 5.2: `defaultLevelForTier('T1')`, `'T2'`, `'T4'` all return `'L2'`
  - [x] 5.3: Re-exported `getAgentLevel` + `requiresWriteConfirmation` work correctly via leveling module
  - [x] 5.4: Re-exported `scanAgentSuggestions` returns promotion/demotion suggestions via leveling module
  - [x] 5.5: Re-exported `readApprovalStore` returns empty store when file absent (no side effects on missing file)

- [x] Task 6: Run full test suite and verify no regressions (AC: all)
  - [x] 6.1: `npx vitest run` — all tests pass, 0 failures
  - [x] 6.2: Verify squad.md line count ≤ 300

## Dev Notes

### ⚠️ PRE-BUILT FOUNDATION — VERIFY BEFORE WRITING

`src/engine/autonomy-manager.ts` (330 LOC) was completed before formal story tracking as part of Epic 6 execution pipeline work. **The primary deliverables for story 8.5 are `src/squads/leveling.ts` and the `## Agent Autonomy Leveling` section in squad.md.**

**Current known state (as of story 8.4 completion, 2026-03-19):**

| File | Expected Status | Notes |
|------|----------------|-------|
| `src/engine/autonomy-manager.ts` | ✅ Complete | All pure functions + persistence — AC-2/3 logic fully implemented |
| `src/commands/execute/handler.ts` | ✅ Complete | L1 write confirmation wired (lines 277–351) — AC-4 satisfied |
| `test/unit/engine/autonomy-manager.test.ts` | ✅ Complete | 43 tests covering engine functions |
| `src/squads/leveling.ts` | ❌ Does NOT exist | Must be created |
| `src/squads/index.ts` | ✅ Exists (from 8.4) | Must be updated to add leveling exports |
| `templates/commands/squad.md` | ⚠️ Needs update | Add `## Agent Autonomy Leveling` section (currently 129 lines) |
| `test/unit/squads/leveling.test.ts` | ❌ Does NOT exist | Must be created |

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

- `src/squads/leveling.ts` lives in `src/squads/` — it CAN import from `src/engine/` and `src/contracts/`
- `src/commands/squad/handler.ts` MUST import leveling functions from `../../squads/leveling.js` — NOT directly from `../../engine/autonomy-manager.js`
- Do NOT import from `src/commands/` inside `src/squads/`

**FR mapping:**
- `FR-851` → Agent Autonomy Leveling (Epic 8.5)
- `NFR-25` → Consent model tied to autonomy level (L1–L4)

**Coverage threshold (MUST maintain):**
| Module | Threshold |
|--------|-----------|
| `src/squads/validator.ts` | **90%** (from 8.4) |
| `src/contracts/**` | 100% |
| global | 70% |

### `src/squads/leveling.ts` — Complete Design Specification

This is a **squads-layer facade** — it exposes engine/autonomy-manager through the squads module boundary. Thin re-export module + one new helper.

```typescript
/**
 * Leveling — Agent autonomy leveling facade for the squads domain.
 * Exposes engine/autonomy-manager through the squads module boundary.
 * @module squads
 * @see FR-851 Agent Autonomy Leveling
 * @see NFR-25 Consent model tied to autonomy level
 */

import {
  getAgentLevel,
  requiresWriteConfirmation,
  scanAgentSuggestions,
  recordApproval,
  applyLevelChange,
  checkPromotion,
  checkDemotion,
  readApprovalStore,
} from '../engine/autonomy-manager.js'
import type { AutomationLevel } from '../contracts/squad.js'

export type {
  AgentApprovalRecord,
  AgentLevelState,
  AgentApprovalStore,
  LevelChangeSuggestion,
} from '../engine/autonomy-manager.js'

export {
  getAgentLevel,
  requiresWriteConfirmation,
  scanAgentSuggestions,
  recordApproval,
  applyLevelChange,
  checkPromotion,
  checkDemotion,
  readApprovalStore,
}

/** Default autonomy level for a new agent by tier. T3 Support starts at L1 (Observer); all others at L2 (Contributor). */
export function defaultLevelForTier(tier: 'T1' | 'T2' | 'T3' | 'T4'): AutomationLevel {
  return tier === 'T3' ? 'L1' : 'L2'
}
```

### `src/squads/index.ts` — Updated Exports

Current state after 8.4:
```typescript
export { validateSquad } from './validator.js'
export type { SquadCheckResult, SquadValidationReport, ValidateSquadOptions } from './validator.js'
```

Must become:
```typescript
export { validateSquad } from './validator.js'
export type { SquadCheckResult, SquadValidationReport, ValidateSquadOptions } from './validator.js'
export { defaultLevelForTier, getAgentLevel, requiresWriteConfirmation, scanAgentSuggestions, recordApproval, applyLevelChange, checkPromotion, checkDemotion, readApprovalStore } from './leveling.js'
export type { AgentApprovalRecord, AgentLevelState, AgentApprovalStore, LevelChangeSuggestion } from './leveling.js'
```

### `runLevelCheck()` — Complete Implementation Pattern

Add to `src/commands/squad/handler.ts`, importing from squads layer:

```typescript
import {
  readApprovalStore,
  scanAgentSuggestions,
  applyLevelChange,
} from '../../squads/leveling.js'

export async function runLevelCheck(args: string[], projectDir: string): Promise<Result<undefined>> {
  const lang = await readLanguage(projectDir)
  const i18n = createI18n(lang)

  clack.intro(i18n.t('cli.autonomy.check_welcome'))

  const store = await readApprovalStore(projectDir)
  const suggestions = scanAgentSuggestions(store)

  if (suggestions.length === 0) {
    clack.outro(i18n.t('cli.autonomy.no_suggestions'))
    return ok(undefined)
  }

  for (const suggestion of suggestions) {
    const i18nKey = suggestion.direction === 'promotion'
      ? 'cli.autonomy.promote_suggest'
      : 'cli.autonomy.demote_suggest'

    const confirmed = await clack.confirm({
      message: i18n.t(i18nKey, {
        agent: suggestion.agentId,
        rate: Math.round(suggestion.rate * 100).toString(),
        from: suggestion.currentLevel,
        to: suggestion.suggestedLevel,
      }),
    })

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.log.info(i18n.t('cli.autonomy.level_unchanged', { agent: suggestion.agentId }))
      continue
    }

    const applyResult = await applyLevelChange(suggestion, projectDir)
    if (!applyResult.ok) {
      clack.log.error(i18n.t('error.autonomy.store_failed'))
      return err(applyResult.error)
    }

    clack.log.success(i18n.t('cli.autonomy.level_changed', {
      agent: suggestion.agentId,
      from: suggestion.currentLevel,
      to: suggestion.suggestedLevel,
    }))
  }

  clack.outro(i18n.t('cli.autonomy.check_welcome'))
  return ok(undefined)
}
```

**Route wiring in `handler.run()`** — add after the `'validate'` route:
```typescript
if (subcommand === 'level' && subArgs[0] === 'check') {
  return runLevelCheck(subArgs.slice(1), projectDir)
}
```

### `usage_hint` i18n update

**`locales/en.yaml` line 311** — update to:
```yaml
usage_hint: "Usage: buildpact squad create <name> | buildpact squad add <name-or-path> | buildpact squad validate <path> | buildpact squad level check"
```

**`locales/pt-br.yaml` line 311** — update to:
```yaml
usage_hint: "Uso: buildpact squad create <nome> | buildpact squad add <nome-ou-caminho> | buildpact squad validate <caminho> | buildpact squad level check"
```

### squad.md Section to Add

Insert between `## Squad Validation` and `## Implementation Notes`:

```markdown
## Agent Autonomy Leveling

Each agent in a Squad operates at one of four autonomy levels. New agents start at L1 or L2 by default.

| Level | Name | Behavior | Default for |
|-------|------|----------|-------------|
| L1 | Observer | Requires user confirmation for ALL write operations | T3 Support |
| L2 | Contributor | Standard oversight — user confirmation for commits | T1/T2/T4 agents |
| L3 | Specialist | Reduced oversight — user confirms commits only | — (earned) |
| L4 | Autonomous | Full autonomy — explicit opt-in required | — (earned) |

Level is recorded in the agent's YAML frontmatter `level:` field and tracked in `.buildpact/agent-levels.json`.

**Promotion criteria:** ≥85% approval rate over a rolling 7-day window (minimum 5 records).
**Demotion criteria:** >30% rejection rate in a rolling 7-day window.

Run `npx buildpact squad level check` to review pending promotions and demotions.
Implementation: `defaultLevelForTier()`, `scanAgentSuggestions()` in `src/squads/leveling.ts` (FR-851).
```

### squad.md Line Budget

| Story | Section Added | Lines | Cumulative |
|-------|---------------|-------|-----------|
| 8.1–8.4 | (completed) | — | 129 |
| **8.5** | **Agent Autonomy Leveling** | **~22** | **~151** |
| 8.6 | Lazy Agent Loading | ~20 | ~171 |

Target: ≤ 300 lines total. Budget: ~149 remaining after 8.5.

### Anti-Patterns to Avoid

- ❌ Do NOT import directly from `src/engine/autonomy-manager.ts` inside `src/commands/squad/handler.ts` — use `../../squads/leveling.js`
- ❌ Do NOT duplicate any logic from `src/engine/autonomy-manager.ts` — it is the source of truth
- ❌ Do NOT add `export default` — named exports only
- ❌ Do NOT omit `.js` extension on ESM imports
- ❌ Do NOT add new i18n keys — all autonomy keys already in `locales/en.yaml` and `locales/pt-br.yaml` (lines 312–320)
- ❌ Do NOT modify `src/commands/execute/handler.ts` — AC-4 is already satisfied there
- ❌ Do NOT create `src/squads/router.ts`, `loader.ts`, `hook-runner.ts` — Story 8.6 territory

### Previous Story Intelligence (Story 8.4)

- **Pre-built pattern confirmed:** engine module was pre-built before formal story tracking. Primary deliverable is always the new `src/squads/` module + orchestrator section in squad.md.
- **1731 tests passing** at end of story 8.4 — all must remain green
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching the filesystem
- **squad.md was at 129 lines** after story 8.4 (target ≤ 300)
- **`src/squads/index.ts` exists** from story 8.4 — DO NOT recreate; UPDATE it

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `@clack/prompts` | latest | Only in handler.ts — never in squads/ or engine/ |

### Key Existing Files to Read Before Implementing

- `src/engine/autonomy-manager.ts` — full pre-built implementation (all exported names, constants, types)
- `src/squads/index.ts` — current state (validator.ts exports only — must be updated)
- `src/commands/squad/handler.ts` — full handler (add import + `runLevelCheck()` + route)
- `test/unit/engine/autonomy-manager.test.ts` — existing 43 tests (do NOT modify)

### References

- [Source: epics.md#Epic8-Story8.5] — User story, ACs
- [Source: architecture.md#FR-851] — Agent Autonomy Leveling
- [Source: architecture.md#NFR-25] — Consent model tied to autonomy level (L1–L4)
- [Source: architecture.md#layer-dependency] — `contracts/ ← engine/ ← squads/ ← commands/`
- [Source: src/engine/autonomy-manager.ts] — Pre-built engine: all pure functions + persistence
- [Source: src/commands/execute/handler.ts#277-351] — L1 write confirmation (AC-4 satisfied)
- [Source: src/squads/index.ts] — Must be updated to add leveling exports
- [Source: locales/en.yaml#312-320] — Autonomy i18n keys already registered
- [Source: locales/pt-br.yaml#312-320] — Autonomy i18n keys (PT-BR) already registered
- [Source: story 8-4-squad-structural-validation.md] — squad.md budget tracking, 1731 tests baseline

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues encountered. All files pre-specified in Dev Notes; implementation was straightforward.

### Completion Notes List

- Created `src/squads/leveling.ts` — thin squads-layer facade re-exporting all engine/autonomy-manager functions and types, plus `defaultLevelForTier()` helper (T3→L1, others→L2).
- Updated `src/squads/index.ts` — added all leveling exports alongside existing `validateSquad` exports.
- Updated `src/commands/squad/handler.ts` — added `runLevelCheck()` function + `level check` route wiring; imports via squads layer per architecture rules.
- Updated `locales/en.yaml` and `locales/pt-br.yaml` — appended `squad level check` to `usage_hint`.
- Updated `templates/commands/squad.md` — inserted `## Agent Autonomy Leveling` section (148 lines total, ≤300 budget).
- Created `test/unit/squads/leveling.test.ts` — 16 unit tests covering all 5.x subtasks.
- Full test suite: **1747 tests passed, 0 failures** (baseline was 1731).
- squad.md line count: **148** (≤300 ✅).
- AC-4 was pre-satisfied in `src/commands/execute/handler.ts` — no changes needed there.

### File List

- `src/squads/leveling.ts` — NEW
- `src/squads/index.ts` — MODIFIED
- `src/commands/squad/handler.ts` — MODIFIED
- `locales/en.yaml` — MODIFIED
- `locales/pt-br.yaml` — MODIFIED
- `templates/commands/squad.md` — MODIFIED
- `test/unit/squads/leveling.test.ts` — NEW

## Change Log

- 2026-03-19: Implemented Story 8.5 — Agent Autonomy Leveling System. Created `src/squads/leveling.ts` facade, updated `src/squads/index.ts` exports, added `runLevelCheck()` + `squad level check` route to `src/commands/squad/handler.ts`, updated i18n usage hints in both locale files, added `## Agent Autonomy Leveling` section to `templates/commands/squad.md` (148 lines). Created 16 unit tests in `test/unit/squads/leveling.test.ts`. All 1747 tests pass.
