# Story 8.6: Lazy Agent Loading

Status: done

## Story

As a developer using BuildPact in Agent Mode (v2.0) with a large Squad,
I want Squad agents to be loaded into context only when needed rather than all at once,
So that I stay well within context budget even with large multi-agent Squads.

## Acceptance Criteria

**AC-1: Initial Squad Load — Chief + Index Only (Agent Mode v2.0)**

Given Agent Mode v2.0 is active and a Squad is initialized
When the Squad is loaded
Then only the Chief agent definition and a lightweight agent index (≤1KB) are loaded into context initially
And all Specialist agents remain unloaded

**AC-2: On-Demand Specialist Loading via Handoff (Agent Mode v2.0)**

Given a Chief agent triggers a handoff to a Specialist
When the handoff is processed
Then the target Specialist agent definition is loaded on-demand into the context
And after the Specialist completes its task, it is unloaded to free context

**AC-3: Prompt Mode v1.0 — Manual Loading Guide in Documentation**

Given Prompt Mode v1.0 is active
When a user installs a Squad
Then the framework documentation includes a guide explaining manual agent loading best practices for the host IDE's context window management

## Tasks / Subtasks

- [x] Task 1: Create `src/squads/loader.ts` — Squad manifest reader and lazy agent loading facade (AC: #1, #2)
  - [x] 1.1: Define `AgentFileRef` type (`{ file: string }`)
  - [x] 1.2: Define `SquadFileManifest` type — same shape as `SquadManifest` but `agents: Record<string, AgentFileRef>` (file refs only, NOT inline AgentDefinition)
  - [x] 1.3: Define exported `AgentIndexEntry` type: `{ id: string; file: string; level: AutomationLevel }`
  - [x] 1.4: Define exported `AgentIndex` type: `{ squad_name: string; squad_version: string; chief: AgentIndexEntry; specialists: AgentIndexEntry[] }`
  - [x] 1.5: Implement `readSquadManifest(squadDir: string): Promise<Result<SquadFileManifest>>` — parse squad.yaml scalar fields (name, version, domain, description, initial_level) and agent file refs using regex (NO external yaml library)
  - [x] 1.6: Implement `buildAgentIndex(manifest: SquadFileManifest): AgentIndex` — creates ≤1KB lightweight index; agent named `'chief'` → `index.chief`; all other agents → `index.specialists`; level defaults to `manifest.initial_level`
  - [x] 1.7: Implement `loadAgentDefinition(squadDir: string, entry: AgentIndexEntry): Promise<Result<string>>` — reads agent markdown file on-demand; returns raw content string
  - [x] 1.8: Add JSDoc `@module squads` + `@see FR-906`

- [x] Task 2: Update `src/squads/index.ts` — add loader exports (AC: #1, #2)
  - [x] 2.1: Add named re-exports from `./loader.js`: `readSquadManifest`, `buildAgentIndex`, `loadAgentDefinition`
  - [x] 2.2: Add type re-exports from `./loader.js`: `AgentIndexEntry`, `AgentIndex`, `AgentFileRef`, `SquadFileManifest`
  - [x] 2.3: Keep existing `validateSquad` and leveling exports untouched

- [x] Task 3: Add `## Lazy Agent Loading` section to `templates/commands/squad.md` (AC: #3)
  - [x] 3.1: Insert after `## Agent Autonomy Leveling` and before `## Implementation Notes`
  - [x] 3.2: Section explains context budget management, Chief-first pattern, and on-demand loading steps
  - [x] 3.3: Verified squad.md line count: 163 lines (≤ 300 ✅)

- [x] Task 4: Create `test/unit/squads/loader.test.ts` — unit tests for loader module (AC: #1, #2)
  - [x] 4.1: `readSquadManifest` parses a valid squad.yaml → correct `SquadFileManifest` fields
  - [x] 4.2: `readSquadManifest` returns `err()` when squad.yaml does not exist
  - [x] 4.3: `buildAgentIndex` returns `AgentIndex` where `chief.id === 'chief'` and other agents are in `specialists[]`
  - [x] 4.4: `buildAgentIndex` serializes to ≤1KB (JSON.stringify(index).length ≤ 1024)
  - [x] 4.5: `loadAgentDefinition` returns agent markdown file content as string
  - [x] 4.6: `loadAgentDefinition` returns `err()` when agent file does not exist

- [x] Task 5: Run full test suite and verify no regressions (AC: all)
  - [x] 5.1: `npx vitest run` — 1760 tests passed, 0 failures (baseline was 1747; +13 new tests)
  - [x] 5.2: squad.md line count: 163 lines (≤ 300 ✅)

## Dev Notes

### ⚠️ v2.0 MILESTONE CONTEXT — READ BEFORE IMPLEMENTING

> **Story note from Epic:** "v2.0 milestone — not included in Alpha scope. In Prompt Mode (v1.0), framework provides documented guidance on manual agent loading best practices."

This story has **two parallel tracks:**
- **Track A (v1.0 deliverable):** `## Lazy Agent Loading` documentation section in `templates/commands/squad.md` (AC-3) — ships in Alpha
- **Track B (infrastructure):** `src/squads/loader.ts` — Squad manifest reader + agent index builder — creates the TypeScript foundation that v2.0 Agent Mode will use for actual runtime lazy loading (AC-1, AC-2)

**Both tracks ship now.** The infrastructure (Track B) makes the architecture consistent and gives v2.0 a stable interface to build on. The actual runtime lazy loading behavior (dynamic context injection/ejection) is a v2.0 concern.

### squad.yaml Actual Format (Critical — Different from SquadManifest Contract)

The scaffolded `squad.yaml` stores **file references**, NOT inline `AgentDefinition` objects. This is the actual format:

```yaml
name: my-squad
version: "0.1.0"
domain: custom
description: "Custom Squad description"
initial_level: L2

agents:
  chief:
    file: agents/chief.md
  specialist:
    file: agents/specialist.md
  support:
    file: agents/support.md
  reviewer:
    file: agents/reviewer.md

bundle_disclaimers:
  en: "..."
  pt-br: "..."
```

**Implication:** `readSquadManifest` must return a `SquadFileManifest` (with `agents: Record<string, AgentFileRef>`) — NOT the full `SquadManifest` from `contracts/squad.ts` (which has inline `AgentDefinition`). Do NOT attempt to parse agent layer content from squad.yaml.

### readSquadManifest — Regex Parsing (No YAML Library)

No external YAML library is available (`package.json` has only `@clack/prompts` as runtime dependency). Use line-based regex for scalar fields and the agent `file:` block.

**Regex patterns to implement:**
```typescript
// Scalar fields — simple "key: value" on a line
const nameMatch = content.match(/^name:\s*(.+)$/m)
const versionMatch = content.match(/^version:\s*["']?([^"'\n]+)["']?/m)
const domainMatch = content.match(/^domain:\s*(.+)$/m)
const descriptionMatch = content.match(/^description:\s*["']?([^"'\n]+)["']?/m)
const levelMatch = content.match(/^initial_level:\s*(L[1-4])/m)

// Agent block parsing — each agent entry follows:
// "  agentId:" on one line, "    file: path" on the next
const agentRegex = /^  (\w+):\n\s+file:\s*(.+)$/gm
```

Return `err(ERROR_CODES.VALIDATION_FAILED)` if any required field is missing.

### buildAgentIndex — ≤1KB Constraint

The index MUST serialize to ≤1KB (`JSON.stringify(index).length ≤ 1024`). With 4–8 agents at ~80 bytes each, this is comfortably achievable. Agent named `'chief'` (exact string match) → `index.chief`; all others → `index.specialists[]`.

```typescript
export function buildAgentIndex(manifest: SquadFileManifest): AgentIndex {
  const entries = Object.entries(manifest.agents).map(([id, ref]) => ({
    id,
    file: ref.file,
    level: manifest.initial_level,
  }))
  const chief = entries.find(e => e.id === 'chief') ?? entries[0]
  const specialists = entries.filter(e => e.id !== chief.id)
  return { squad_name: manifest.name, squad_version: manifest.version, chief, specialists }
}
```

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```
- `src/squads/loader.ts` lives in `src/squads/` — it MAY import from `src/contracts/` and Node.js built-ins (`fs/promises`, `path`)
- It MUST NOT import from `src/commands/`, `src/engine/`, or `src/cli/`
- `@clack/prompts` MUST NOT be used in `src/squads/` — only in handler files under `src/commands/`

**FR mapping:**
- `FR-906` → Lazy loading cap at ≤1KB agent index

**Coverage threshold (MUST maintain):**
| Module | Threshold |
|--------|-----------|
| `src/squads/validator.ts` | **90%** (from 8.4) |
| `src/contracts/**` | 100% |
| global | 70% |

### src/squads/loader.ts — Complete Module Design

```typescript
/**
 * Loader — Squad manifest reader and lazy agent loading facade.
 * Parses squad.yaml file references (NOT full AgentDefinition hydration).
 * Provides the ≤1KB agent index infrastructure for Agent Mode (v2.0) lazy loading.
 * @module squads
 * @see FR-906 Lazy loading cap at ≤1KB agent index
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { err, ok, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { AutomationLevel } from '../contracts/squad.js'

// File reference stored in squad.yaml under agents:
export interface AgentFileRef {
  file: string
}

// squad.yaml structure parsed by readSquadManifest
// Uses AgentFileRef instead of AgentDefinition — squad.yaml stores file paths, not inline layers
export interface SquadFileManifest {
  name: string
  version: string
  domain: string
  description: string
  initial_level: AutomationLevel
  agents: Record<string, AgentFileRef>
}

// Lightweight entry in the agent index (≤1KB total)
export interface AgentIndexEntry {
  id: string
  file: string
  level: AutomationLevel
}

// Agent index — Chief + Specialists, NO full definitions (lazy loading)
export interface AgentIndex {
  squad_name: string
  squad_version: string
  chief: AgentIndexEntry
  specialists: AgentIndexEntry[]
}

export async function readSquadManifest(squadDir: string): Promise<Result<SquadFileManifest>>
export function buildAgentIndex(manifest: SquadFileManifest): AgentIndex
export async function loadAgentDefinition(squadDir: string, entry: AgentIndexEntry): Promise<Result<string>>
```

### src/squads/index.ts — Updated Exports

Current state after 8.5:
```typescript
export { validateSquad } from './validator.js'
export type { SquadCheckResult, SquadValidationReport, ValidateSquadOptions } from './validator.js'
export { defaultLevelForTier, getAgentLevel, requiresWriteConfirmation, scanAgentSuggestions, recordApproval, applyLevelChange, checkPromotion, checkDemotion, readApprovalStore } from './leveling.js'
export type { AgentApprovalRecord, AgentLevelState, AgentApprovalStore, LevelChangeSuggestion } from './leveling.js'
```

Must become (add loader exports):
```typescript
// ... existing exports ...
export { readSquadManifest, buildAgentIndex, loadAgentDefinition } from './loader.js'
export type { AgentIndexEntry, AgentIndex } from './loader.js'
```

### squad.md Section to Add (AC-3)

Insert between `## Agent Autonomy Leveling` and `## Implementation Notes`:

```markdown
## Lazy Agent Loading

In Prompt Mode (v1.0), context budget is managed manually. Follow these best practices when working with multi-agent Squads to stay within your IDE's context window.

**Loading Strategy:**

1. **Start with Chief only.** Paste only `agents/chief.md` into context at session start.
2. **Load the agent index.** Paste the `squad.yaml` agent list (names and files only) alongside the Chief — this is your ≤1KB navigation map.
3. **Load Specialists on-demand.** When the Chief delegates to a Specialist, paste that agent's `.md` file into context before continuing.
4. **Unload when done.** Start a fresh context or remove the Specialist definition before loading the next one if context is tight.

**Agent Mode (v2.0):** Lazy loading is automatic — only Chief + index (≤1KB) loads on Squad init; Specialists load on handoff and unload after completion (FR-906).

Implementation: `readSquadManifest()`, `buildAgentIndex()`, `loadAgentDefinition()` in `src/squads/loader.ts`.
```

### squad.md Line Budget

| Story | Section Added | Lines | Cumulative |
|-------|---------------|-------|-----------|
| 8.1–8.4 | (completed) | — | 129 |
| 8.5 | Agent Autonomy Leveling | ~19 | 148 |
| **8.6** | **Lazy Agent Loading** | **~21** | **~169** |

Target: ≤ 300 lines total. Budget: ~131 remaining after 8.6.

### Test Fixture Pattern (from 8.5 — MANDATORY)

```typescript
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join, tmpdir } from 'node:path'

let tmpDir: string
beforeEach(async () => { tmpDir = await mkdtemp(join(tmpdir(), 'loader-test-')) })
afterEach(async () => { await rm(tmpDir, { recursive: true }) })
```

Minimal valid squad.yaml for test fixtures:
```yaml
name: test-squad
version: "0.1.0"
domain: software
description: "Test squad"
initial_level: L2
agents:
  chief:
    file: agents/chief.md
  specialist:
    file: agents/specialist.md
```

### Error Handling Pattern

Use `err(ERROR_CODES.VALIDATION_FAILED)` for missing squad.yaml. Use `err(ERROR_CODES.NOT_FOUND)` for missing agent file. Import `{ ok, err, ERROR_CODES }` from `'../contracts/errors.js'`.

### Anti-Patterns to Avoid

- ❌ Do NOT add `yaml`, `js-yaml`, or any external YAML library — use regex parsing for squad.yaml
- ❌ Do NOT attempt to parse full `AgentDefinition` layers from squad.yaml — use `AgentFileRef` (file path only)
- ❌ Do NOT import from `src/engine/` inside `src/squads/` — squads layer must NOT reach into engine
- ❌ Do NOT use `@clack/prompts` in loader.ts — CLI prompts belong in `src/commands/` only
- ❌ Do NOT add `export default` — named exports only throughout `src/`
- ❌ Do NOT omit `.js` extension on ESM imports — `from '../contracts/errors.js'` NOT `from '../contracts/errors'`
- ❌ Do NOT modify `src/contracts/squad.ts` — the contract is stable; loader.ts uses its own `SquadFileManifest` type
- ❌ Do NOT create `src/squads/router.ts`, `hook-runner.ts`, or `web-bundle.ts` — later story territory

### Previous Story Intelligence (Story 8.5)

- **1747 tests passing** at end of story 8.5 — all must remain green
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` in every test touching filesystem
- **squad.md was at 148 lines** after story 8.5 (target ≤ 300)
- **`src/squads/index.ts` exists** — DO NOT recreate; UPDATE it to add loader exports
- **Anti-pattern from 8.5:** "Do NOT create `src/squads/router.ts`, `loader.ts`, `hook-runner.ts` — Story 8.6 territory" — confirmed, create `loader.ts` now

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit testing |
| `@clack/prompts` | latest | ONLY in handler.ts — never in squads/ |
| yaml library | **NONE** | Use regex parsing — no yaml dep in package.json |

### Key Existing Files to Read Before Implementing

- `src/engine/squad-scaffolder.ts` — `buildSquadYaml()` at line 16 shows exact squad.yaml format generated
- `src/squads/index.ts` — current state after 8.5 (add loader exports here)
- `src/contracts/squad.ts` — `AutomationLevel` type needed by loader.ts (import type only)
- `src/contracts/errors.ts` — `ok()`, `err()`, `ERROR_CODES`, `Result<T>` — MUST use this pattern
- `test/unit/squads/leveling.test.ts` — reference for test structure, import patterns, fixture approach

### References

- [Source: epics.md#Epic8-Story8.6] — User story, ACs
- [Source: architecture.md#FR-906] — Lazy loading cap at ≤1KB agent index
- [Source: architecture.md#squads-directory] — `squads/loader.ts`: Squad manifest reader, lazy load guidance
- [Source: architecture.md#layer-dependency] — `contracts/ ← engine/ ← squads/ ← commands/`
- [Source: architecture.md#phase-delivery-table] — Story 8.6 is v2.0 scope; v1.0 delivers documentation
- [Source: src/engine/squad-scaffolder.ts#16-47] — `buildSquadYaml()` actual squad.yaml format
- [Source: src/contracts/squad.ts] — `AutomationLevel`, `SquadManifest` contract reference
- [Source: src/squads/index.ts] — Must be updated to add loader exports
- [Source: story 8-5-agent-autonomy-leveling-system.md] — 1747 tests baseline, squad.md 148 lines

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues encountered. squad.yaml uses file references (not inline AgentDefinition), which made the design clear: SquadFileManifest needed its own `agents: Record<string, AgentFileRef>` type rather than reusing contracts/squad.ts's SquadManifest. Regex-based YAML parsing was straightforward given the predictable scaffold format.

### Completion Notes List

- Created `src/squads/loader.ts` — Squad manifest reader and lazy agent loading facade. Exports: `readSquadManifest()` (regex-based squad.yaml parser, no external yaml library), `buildAgentIndex()` (creates ≤1KB agent index with Chief isolated from Specialists), `loadAgentDefinition()` (on-demand agent markdown loader). Types: `AgentFileRef`, `SquadFileManifest`, `AgentIndexEntry`, `AgentIndex`.
- Updated `src/squads/index.ts` — added all loader function and type exports alongside existing validator and leveling exports. Updated `@see` to include FR-906.
- Updated `templates/commands/squad.md` — inserted `## Lazy Agent Loading` section (163 lines total, ≤300 budget ✅). Section covers Prompt Mode v1.0 manual loading best practices and Agent Mode v2.0 automatic lazy loading description.
- Created `test/unit/squads/loader.test.ts` — 13 unit tests covering all 6 subtasks (4.1–4.6): manifest parsing, missing file errors, index structure, ≤1KB constraint, agent content loading, and missing agent error.
- Full test suite: **1760 tests passed, 0 failures** (baseline was 1747; +13 new tests).
- squad.md line count: **163** (≤300 ✅).
- AC-1 and AC-2 are satisfied by the TypeScript infrastructure in `loader.ts` — the lazy loading interface (`buildAgentIndex` + `loadAgentDefinition`) provides the foundation Agent Mode v2.0 will use for runtime context injection.
- AC-3 satisfied by `## Lazy Agent Loading` section in `templates/commands/squad.md`.

### File List

- `src/squads/loader.ts` — NEW
- `src/squads/index.ts` — MODIFIED
- `templates/commands/squad.md` — MODIFIED
- `test/unit/squads/loader.test.ts` — NEW

## Change Log

- 2026-03-19: Implemented Story 8.6 — Lazy Agent Loading. Created `src/squads/loader.ts` with `readSquadManifest()`, `buildAgentIndex()`, `loadAgentDefinition()` and exported types. Updated `src/squads/index.ts` to add loader exports. Added `## Lazy Agent Loading` section to `templates/commands/squad.md` (163 lines, ≤300 budget). Created 13 unit tests in `test/unit/squads/loader.test.ts`. All 1760 tests pass.
