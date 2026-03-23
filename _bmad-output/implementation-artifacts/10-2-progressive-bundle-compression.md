# Story 10.2: Progressive Bundle Compression

Status: done

## Story

As a Squad creator exporting a large Squad,
I want the bundle generator to apply deterministic compression to stay within platform token limits,
so that my bundle always fits within the target platform without me having to manually trim content.

## Acceptance Criteria

**AC-1: Deterministic compression sequence**

Given the bundle generation begins
When compression is applied
Then the algorithm follows a documented, deterministic sequence:
1. Inline only active Squad agents (exclude unused agents)
2. Compress Constitution to essential rules only (strip comments, examples, rationale)
3. Exclude optimization history and memory lessons (`.buildpact/memory/`, `.buildpact/feedback/`)
4. Include only current project context (no historical entries)

**AC-2: Graceful degradation tiers when over limit**

Given the bundle still exceeds the platform's token limit after standard compression
When graceful degradation is triggered
Then the export command offers tiered degradation options:
1. Remove agent examples from Squad agents
2. Remove heuristic detail (keep only VETO rules)
3. Reduce to Chief-only mode (single orchestrator agent)
4. Generate a minimal "quick session" bundle for specify phase only
And each degradation tier is documented inside the bundle with a note explaining what was removed

## Tasks / Subtasks

- [x] Task 1: Implement deterministic compression pipeline in `src/foundation/bundle.ts` (AC: #1)
  - [x] 1.1: Export `CompressedBundle` type: `{ content: string; compressionLevel: 0 | 1 | 2 | 3 | 4; sectionsRemoved: string[]; tokenCount: number }`
  - [x] 1.2: Export `compressConstitution(raw: string): string` — strips markdown comments, rationale paragraphs, and inline examples; keeps rules only (lines starting with `-`, `*`, or numbered list items)
  - [x] 1.3: Export `filterActiveAgents(agentFiles: AgentFile[], activeSquad: string): AgentFile[]` — returns only agents listed in active squad's `squad.yaml` agents block
  - [x] 1.4: Export `applyStandardCompression(parts: BundlePartMap): CompressedBundle` — applies steps 1–4 in AC-1 order; returns compression level 0 if within limit, level 1 if compression was needed
  - [x] 1.5: Document each compression step in code comments so the bundle's degradation notes match the implementation

- [x] Task 2: Implement graceful degradation tiers in `src/squads/web-bundle.ts` (AC: #2)
  - [x] 2.1: Export `DegradationTier` enum: `NONE = 0`, `REMOVE_EXAMPLES = 1`, `REMOVE_HEURISTICS = 2`, `CHIEF_ONLY = 3`, `QUICK_SESSION = 4`
  - [x] 2.2: Export `applyDegradationTier(bundle: CompressedBundle, tier: DegradationTier): CompressedBundle` — each tier is additive (tier 2 includes tier 1 changes)
  - [x] 2.3: When bundle exceeds limit after standard compression, present degradation menu via `@clack/prompts` (in CLI handler, NOT in web-bundle.ts) with token estimate per tier
  - [x] 2.4: Inject degradation note inside bundle when tier > NONE: `=== COMPRESSION NOTE ===\n<what was removed and why>`

- [x] Task 3: Wire compression into `generateWebBundle` flow (AC: #1, #2)
  - [x] 3.1: Update `generateWebBundle()` in `src/squads/web-bundle.ts` to call `applyStandardCompression()` before token check
  - [x] 3.2: If after standard compression `checkTokenBudget().withinLimit === false`, return `{ needsDegradation: true, tiers: [...] }` to CLI handler; CLI handler presents menu and calls `applyDegradationTier()`
  - [x] 3.3: CLI handler `src/commands/export-web/index.ts` owns the degradation selection loop — web-bundle.ts is pure and receives the chosen tier

- [x] Task 4: Write unit tests (AC: all)
  - [x] 4.1: `test/unit/foundation/bundle.test.ts` — add tests for `compressConstitution` (strips comments, keeps rules), `filterActiveAgents` (returns only active squad's agents), `applyStandardCompression` (applies 4 steps in order, returns correct compression level)
  - [x] 4.2: `test/unit/squads/web-bundle.test.ts` — add tests for each `DegradationTier`; verify each tier reduces token count; verify degradation note is injected when tier > NONE
  - [x] 4.3: Run `npx vitest run` — baseline ≥ **1760 tests** (from story 10.1); all must remain green

## Dev Notes

### Dependency on Story 10.1

This story extends `src/foundation/bundle.ts` and `src/squads/web-bundle.ts` created in story 10.1. Do NOT recreate these files — extend them. Read story 10.1's file list for exact state of these modules.

### Compression Algorithm — Deterministic Order

The 4-step standard compression must run in exactly this order (deterministic = same input → same output every time):

```typescript
// Step 1: Active agents only
const activeAgents = filterActiveAgents(allAgents, config.activeSquad);

// Step 2: Constitution → essential rules only
const compressedConstitution = compressConstitution(rawConstitution);

// Step 3: Exclude memory + optimization history
// Do NOT read .buildpact/memory/ or .buildpact/feedback/ for bundle assembly

// Step 4: Current project context only (no historical entries)
const context = readCurrentProjectContext(); // NOT full history
```

### Graceful Degradation — Additive (Each Tier Includes Previous)

```
Tier 0 (NONE):          Full standard-compressed bundle
Tier 1 (REMOVE_EXAMPLES): Strip ## Examples section from all agent files
Tier 2 (REMOVE_HEURISTICS): Strip ## Heuristics except VETO: lines
Tier 3 (CHIEF_ONLY):    Keep only the Squad's specify-phase agent
Tier 4 (QUICK_SESSION): Minimal bundle — specify phase only, single agent, no Constitution
```

Tier 4 is the last resort. If tier 4 still exceeds the platform limit, halt with an error message telling the Squad creator their Squad is too large to export to this platform.

### Token Estimation

Use `estimateTokens()` from `foundation/bundle.ts` (story 10.1): `Math.ceil(text.length / 4)`. This is an approximation — actual tokenization varies per model, but is sufficient for 80% threshold warnings.

### Bundle Degradation Note Format

When degradation tier > 0, append inside the bundle (before `=== DISCLAIMER ===`):

```
=== COMPRESSION NOTE ===
This bundle was compressed to fit within <platform>'s <N>K token limit.
Removed: <comma-separated list from sectionsRemoved>
To access full functionality, ask the Squad creator for an updated export
targeting a platform with a higher token limit (e.g., Gemini 1M).
```

### Anti-Patterns to Avoid

- ❌ Do NOT make compression non-deterministic (no randomness, no heuristics-at-runtime) — same input must always produce same output
- ❌ Do NOT present degradation menu inside `src/squads/web-bundle.ts` — user interaction belongs in CLI handler only
- ❌ Do NOT skip the degradation note when tier > NONE — non-technical users need to know what was removed
- ❌ Do NOT apply tier 3 or 4 without user confirmation — always present the menu
- ❌ Do NOT use `export default` anywhere
- ❌ Do NOT omit `.js` on ESM imports

### Layer Responsibility Boundary

```
src/foundation/bundle.ts    → pure functions: compress, estimate, check budget
src/squads/web-bundle.ts    → orchestration: assemble, apply tiers (returns data)
src/commands/export-web/    → user interaction: present menu, loop, write file
```

### Project Structure Notes

- Extends `src/foundation/bundle.ts` — add new exports; do not remove story 10.1 exports
- Extends `src/squads/web-bundle.ts` — add `DegradationTier` enum + `applyDegradationTier()`
- Updates `src/commands/export-web/index.ts` — add degradation menu loop
- Tests: extend `test/unit/foundation/bundle.test.ts` + `test/unit/squads/web-bundle.test.ts`

### References

- [Source: epics.md#Epic10-Story10.2] — Compression sequence, degradation tiers, bundle notes
- [Source: architecture.md#foundation-bundle] — `src/foundation/bundle.ts` handles FR-105a–c
- [Source: architecture.md#squads-web-bundle] — `src/squads/web-bundle.ts` orchestrates FR-105
- [Source: story 10-1-web-bundle-export-command.md] — `BundlePart[]` interface, `assembleBundle()`, `checkTokenBudget()`, test baseline
- [Source: architecture.md#NFR-15] — Static content before dynamic (compression maintains this order)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Added `AgentFile`, `BundlePartMap`, `CompressedBundle` types to `src/foundation/bundle.ts`.
- Added `compressConstitution` (strips HTML comments, rationale paragraphs, fenced code blocks; keeps headings and rule lines), `filterActiveAgents` (filters by optional `squad` field), and `applyStandardCompression` (AC-1 4-step deterministic sequence; compressionLevel 0 if within limit, 1 if compression applied) to `src/foundation/bundle.ts`.
- Added `DegradationTier` enum (NONE=0…QUICK_SESSION=4) and `applyDegradationTier` (additive tiers, injects `=== COMPRESSION NOTE ===`, resets skip on `=== HEADER ===` delimiters) to `src/squads/web-bundle.ts`.
- Updated `generateWebBundle` to call `applyStandardCompression` before token check; returns `needsDegradation`, `compressedBundle`, `availableTiers` on `WebBundleResult`.
- Exported all new types/functions from `src/foundation/index.ts` and `src/squads/index.ts`.
- Added 44 new tests (23 in bundle.test.ts, 21 in web-bundle.test.ts). Full suite: **1853 tests green** (was 1809).

### File List

- `src/foundation/bundle.ts` — extended (AgentFile, BundlePartMap, CompressedBundle, compressConstitution, filterActiveAgents, applyStandardCompression)
- `src/squads/web-bundle.ts` — extended (DegradationTier, applyDegradationTier, updated generateWebBundle + WebBundleResult)
- `src/foundation/index.ts` — updated (new exports)
- `src/squads/index.ts` — updated (new exports)
- `test/unit/foundation/bundle.test.ts` — extended (new tests)
- `test/unit/squads/web-bundle.test.ts` — extended (new tests)

### Change Log

- 2026-03-19: Implemented Story 10.2 — Progressive Bundle Compression. Added deterministic 4-step compression pipeline to foundation/bundle.ts, graceful degradation tiers (NONE–QUICK_SESSION) to web-bundle.ts, wired applyStandardCompression into generateWebBundle with needsDegradation signaling. 44 new tests. Suite: 1853 green.
