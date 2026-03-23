# Story 8.1: Squad Scaffolding & Installation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a domain expert wanting to build a custom AI team,
I want to scaffold a new Squad or install an existing one with a single command,
So that I have the correct file structure ready to fill in without starting from scratch.

## Acceptance Criteria

**AC-1: Squad Create — Complete Scaffold**

Given I run `npx buildpact squad create medical-marketing`
When the scaffold is generated
Then a complete Squad directory is created with: the 4-tier hierarchy template (T1 Chief → T2 Specialist → T3 Support → T4 Reviewer), placeholder agent files with all 6 required layers, a `squad.yaml` manifest, and a `benchmark/` directory
And the scaffold includes inline documentation in each agent file explaining each layer's purpose

**AC-2: Squad Add — Download, Validate, Install**

Given I run `npx buildpact squad add <name>` with a community hub Squad name
When the installation completes
Then the Squad is downloaded and placed in `.buildpact/squads/<name>/`
And the Squad is validated against structural and security checks before being activated
And I receive a warning if the Squad has not been reviewed by a maintainer

**AC-3: Squad Add — Local Path Support**

Given I run `npx buildpact squad add ./my-local-squad`
When the path is detected as a local directory (contains `/` or starts with `.`)
Then the Squad is loaded directly from that path (no download)
And the same structural and security validation applies before installation

**AC-4: Squad Create & Add Documented in squad.md**

Given the `## Squad Create` and `## Squad Installation` sections exist in `templates/commands/squad.md`
When I open the orchestrator template
Then it documents: generated structure (4-tier hierarchy), 6-layer anatomy requirements, installation flow (warn → detect → validate → install), community hub registry protocol, and security check summary
And the cumulative squad.md line count remains ≤ 300

## Tasks / Subtasks

- [x] Task 1: Add `## Squad Create` and `## Squad Installation` sections to `templates/commands/squad.md` (AC: #1, #2, #3, #4)
  - [x] 1.1: Replace stub content — keep header comment + `## Implementation Notes`; add new sections above `## Implementation Notes`
  - [x] 1.2: Add `## Squad Create` — document `npx buildpact squad create <name>`, generated structure (4-tier hierarchy), 6-layer anatomy table with requirements per layer
  - [x] 1.3: Add `## Squad Installation` — document `npx buildpact squad add <name>`: community warning, source detection (registry name vs. local path), structural validation, security validation, install to `.buildpact/squads/<name>/`
  - [x] 1.4: Add community hub registry subsection: `github.com/buildpact/buildpact-squads`, manifest protocol (`<name>/manifest.json` → download all files)
  - [x] 1.5: Reference implementation locations: `scaffoldSquad()`, `validateSquadStructure()` in `src/engine/squad-scaffolder.ts`; `isRegistryName()`, `downloadSquadFromHub()` in `src/engine/community-hub.ts`; types in `src/contracts/squad.ts`
  - [x] 1.6: Verify cumulative squad.md line count ≤ 300 (actual: 66 lines)

- [x] Task 2: Verify `src/engine/squad-scaffolder.ts` (DO NOT recreate — read-only check)
  - [x] 2.1: Confirm `scaffoldSquad(name, targetDir)` creates `agents/` (4 files: chief T1, specialist T2, support T3, reviewer T4), `hooks/`, `benchmark/README.md`, `squad.yaml`, `README.md`
  - [x] 2.2: Confirm each generated agent template contains all 6 layers with inline `<!-- LAYER N: ... -->` documentation comments
  - [x] 2.3: Confirm `validateSquadStructure(squadDir)` checks: squad.yaml required fields (`name`, `version`, `domain`, `description`, `initial_level`), 6-layer anatomy, Voice DNA 5-section, min 5 anti-patterns (✘ markers), min 3 examples, min 3 IF/THEN heuristics, VETO condition
  - [x] 2.4: Confirm `validateSquadSecurity(squadDir)` checks all `.md`/`.yaml`/`.yml` files for: external URLs, executable code blocks (bash/sh/eval/exec), path traversal (`../`), prompt injection patterns
  - [x] 2.5: Confirm `validateHandoffGraph(squadDir)` checks each agent has at least one valid `- ←` or `- →` entry in the Handoffs section
  - [x] 2.6: Confirm `installSquad(sourceDir, projectDir)` copies to `projectDir/.buildpact/squads/<name>/` using `node:fs/promises` `cp`

- [x] Task 3: Verify `src/engine/community-hub.ts` (DO NOT recreate — read-only check)
  - [x] 3.1: Confirm `isRegistryName(input)` returns `true` for simple names (no `/`, no `\`, no leading `.`), `false` for local paths
  - [x] 3.2: Confirm `fetchSquadManifest(squadName, registryBase, fetchFn)` fetches `<registryBase>/<name>/manifest.json`, injectable `fetchFn` for testing
  - [x] 3.3: Confirm `downloadSquadFromHub(squadName, targetDir, registryBase, fetchFn)` orchestrates fetchManifest → downloadManifestFiles
  - [x] 3.4: Confirm `parseSquadManifest(json)` returns `err()` on invalid JSON or missing `name`/`files` fields
  - [x] 3.5: Confirm handler.ts correctly routes: `isRegistryName` → `downloadSquadFromHub` to temp dir → validate → install; else `resolve(rawName)` as local path

- [x] Task 4: Verify test coverage in `test/unit/engine/squad-scaffolder.test.ts` and `test/unit/commands/squad.test.ts` (DO NOT recreate — read-only check)
  - [x] 4.1: `squad-scaffolder.test.ts` (534 LOC) covers: `scaffoldSquad` (squad.yaml, README, 4 agents, 6 layers, benchmark dir, filesCreated list), `validateSquadStructure` (missing yaml/agents, incomplete layers, Voice DNA sections, anti-pattern count, examples count, heuristics + VETO), `validateSquadSecurity` (URLs, executable code, path traversal, prompt injection), `validateHandoffGraph` (missing entries), `installSquad` (copies to `.buildpact/squads/`)
  - [x] 4.2: `squad.test.ts` (417 LOC) covers: `validateSquadName` (valid/invalid names), `runCreate` (success, invalid name, scaffold failure), `runAdd` (local path, hub name, structure failure, security failure), `runValidate` (pass, structural fail, handoff warn, community security fail)

- [x] Task 5: Run full test suite and verify no regressions (AC: all)
  - [x] 5.1: `npx vitest run` — 1723 tests, 68 files, all pass
  - [x] 5.2: Verify squad.md line count ≤ 300 (actual: 66 lines)

## Dev Notes

### ⚠️ PRE-BUILT CODE — DO NOT RECREATE

The TypeScript implementation was pre-built before formal story tracking. **Read-only verification only:**

| File | Status | LOC | Notes |
|------|--------|-----|-------|
| `src/engine/squad-scaffolder.ts` | ✅ Complete | 547 | 5 exported functions |
| `src/engine/community-hub.ts` | ✅ Complete | 281 | 4 pure + 4 I/O functions |
| `src/commands/squad/handler.ts` | ✅ Complete | 475 | runCreate, runAdd, runValidate |
| `src/commands/squad/index.ts` | ✅ Complete | 2 | re-exports handler |
| `src/contracts/squad.ts` | ✅ Complete | 58 | SquadManifest, AgentDefinition, SquadHook |
| `test/unit/engine/squad-scaffolder.test.ts` | ✅ Complete | 534 | all 5 functions covered |
| `test/unit/engine/community-hub.test.ts` | ✅ Complete | — | community hub functions |
| `test/unit/commands/squad.test.ts` | ✅ Complete | 417 | all 3 subcommands covered |
| `templates/squads/software/` | ✅ Complete | — | 5 agents + squad.yaml (reference impl) |

**The PRIMARY task is Task 1: add `## Squad Create` and `## Squad Installation` sections to `templates/commands/squad.md`** (currently an 19-line stub).

### Architecture Context

**Layer dependency (MUST follow — no exceptions):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

`squad-scaffolder.ts` and `community-hub.ts` are in `src/engine/` — called FROM `src/commands/squad/handler.ts`. Do NOT add imports from `src/commands/` inside `src/engine/` — layer violation.

`src/squads/` module (loader.ts, validator.ts, hook-runner.ts, router.ts) is for later stories (8.2–8.6). Do NOT create files there for this story.

**FR mapping:**
- `FR-901` → 4-tier hierarchy (T0 Chief → T1 Masters → T2 Specialists → T3 Support)
- `FR-902` → 6-layer agent anatomy (identity, persona, voice_dna, heuristics, examples, handoffs)
- `FR-903` → Voice DNA 5-section template
- `FR-904` → `squad create` + `squad add` commands
- `FR-1103` / `NFR-24` → Security validation mandatory for community Squads

**Coverage thresholds:**
- `src/squads/validator.ts` (future): 90%+ (not in this story)
- Global: 70% minimum

### Key Implementation Details

**`scaffoldSquad()` generates this structure:**
```
<name>/
├── squad.yaml          # name, version, domain, description, initial_level, agents, bundle_disclaimers
├── README.md           # structure + 6-layer anatomy reference table
├── agents/
│   ├── chief.md        # tier: T1, level: L2
│   ├── specialist.md   # tier: T2, level: L2
│   ├── support.md      # tier: T3, level: L1
│   └── reviewer.md     # tier: T4, level: L2
├── hooks/              # (empty dir — ready for pipeline hooks)
└── benchmark/
    └── README.md       # benchmark placeholder
```

**Agent template format (6 layers with inline docs):**
```markdown
---
agent: chief
squad: <name>
tier: T1
level: L2
---

# Chief — Chief — Orchestrator

<!-- LAYER 1: IDENTITY ... -->
## Identity
...
<!-- LAYER 3: VOICE DNA ... -->
## Voice DNA
### Personality Anchors  ← (1 of 5 required subsections)
### Opinion Stance       ← (2 of 5)
### Anti-Patterns        ← (3 of 5) — min 5 ✘/✔ pairs
### Never-Do Rules       ← (4 of 5)
### Inspirational Anchors ← (5 of 5)
...
```

**`isRegistryName()` routing in handler.ts:**
```typescript
if (isRegistryName(rawName)) {
  // Download from hub → temp dir → validate → install → rm temp
} else {
  sourceDir = resolve(rawName)  // local path
}
```

**Security checks (`validateSquadSecurity`) patterns:**
- External URLs: `/https?:\/\/[^\s)>\]"']+/gi`
- Executable code: `` ```bash/sh/shell ``, `eval(`, `exec(`, `spawnSync`, `execSync`
- Path traversal: `/\.\.[/\\]/g`
- Prompt injection: `ignore.*previous.*instructions`, `you are now`, etc.

### squad.md Line Budget

| Story | Section | Lines | Cumulative |
|-------|---------|-------|-----------|
| Base  | Header comment + Implementation Notes | ~6 | ~6 |
| 8.1   | Squad Create + Squad Installation | ~60 | ~66 |
| 8.2   | 6-Layer Agent Definition (next) | ~25 | ~91 |
| 8.3   | Voice DNA Creation (next) | ~25 | ~116 |
| 8.4   | Squad Validation (next) | ~20 | ~136 |

Target: ≤ 300 lines. Budget: ~164 remaining after 8.1.

### squad.md Section Template

Replace the stub body (lines 3–19) with the following content, keeping the header comment (line 1) and adding `## Implementation Notes` at end:

```markdown
# /bp:squad — Squad Architecture

## Squad Create

Run `npx buildpact squad create <name>` to scaffold a new Squad in the current directory.

### Generated Structure

```
<name>/
├── squad.yaml          # Manifest (name, version, domain, initial_level, agents)
├── README.md           # Structure docs + 6-layer anatomy reference
├── agents/             # 4-tier hierarchy — fill in each file
│   ├── chief.md        # T1 Chief — orchestrates the Squad workflow
│   ├── specialist.md   # T2 Specialist — core domain expert
│   ├── support.md      # T3 Support — assists specialists with sub-tasks
│   └── reviewer.md     # T4 Reviewer — validates output quality
├── hooks/              # Optional pipeline hook handlers (6 hook points)
└── benchmark/          # Quality benchmarks for agent evaluation
```

### 6-Layer Agent Anatomy

Each generated agent template includes all 6 required layers with inline documentation:

| Layer | Requirement |
|-------|-------------|
| Identity | Who the agent is — one sentence |
| Persona | Behavioral style and working approach |
| Voice DNA | 5 sections: Personality Anchors, Opinion Stance, Anti-Patterns (≥5 ✘/✔ pairs), Never-Do Rules, Inspirational Anchors |
| Heuristics | ≥3 IF/THEN rules; at least one VETO condition |
| Examples | ≥3 concrete input/output pairs |
| Handoffs | ≥1 valid `- ←` or `- →` entry |

Implementation: `scaffoldSquad()`, `validateSquadStructure()` in `src/engine/squad-scaffolder.ts`.
Types: `AgentDefinition`, `SquadManifest`, `AutomationLevel` in `src/contracts/squad.ts`.

## Squad Installation

Run `npx buildpact squad add <name>` to install a Squad from the community hub or a local path.

### Installation Flow

1. **Community warning** — user confirms they trust the source (NFR-24, FR-1103)
2. **Source detection** — no `/` or `.` prefix → registry name (download from hub); otherwise → local path
3. **Structural validation** — squad.yaml fields + 6-layer anatomy + Voice DNA 5 sections
4. **Security validation** — no external URLs, no executable code (`bash`/`eval`/`exec`), no `../` paths, no prompt injection
5. **Install** — copies to `.buildpact/squads/<name>/`

Community Squads are blocked from activation if security checks fail.

### Community Hub Registry

Registry: `github.com/buildpact/buildpact-squads`
Protocol: fetch `<name>/manifest.json` → download all listed files to temp dir → validate → install → cleanup.

Implementation: `isRegistryName()`, `downloadSquadFromHub()` in `src/engine/community-hub.ts`.
Types: `SquadManifest`, `RegistrySquad` in `src/engine/community-hub.ts`.

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/squad/index.ts`
- Output files written to: `.buildpact/squads/{{squad_name}}/`
- Squad Validator runs before any Squad is loaded into context (FR-1103)
- Triggers: `on_squad_install` hook after successful installation
```

### Anti-Patterns to Avoid

- ❌ Do NOT create `src/squads/validator.ts` — that's for Story 8.4 Squad Validation
- ❌ Do NOT import from `src/commands/` inside `src/engine/` — layer violation
- ❌ Do NOT add new i18n keys — all squad keys already in `locales/en.yaml` (lines 262–311)
- ❌ Do NOT modify the agent templates in `templates/squads/software/` — pre-built reference implementation
- ❌ Do NOT change `isRegistryName()` logic — it must distinguish hub names from paths without filesystem calls

### Previous Story Intelligence (Stories 7.1–7.3)

- **Pre-built pattern is identical:** Implementation already exists; primary task is the Markdown orchestrator section
- **ESM imports:** `.js` extension MANDATORY on all internal imports
- **Result<T> pattern:** `ok(...)` on success, `err({ code: ..., i18nKey: ..., params: ... })` on failure — never `throw`
- **Named exports only:** No `export default` anywhere in `src/`
- **Test isolation:** `mkdtemp(join(tmpdir(), prefix))` + `rm(tmpDir, { recursive: true })` — do NOT change test patterns
- **Layer dependency:** `engine/` modules called by `commands/` — never reverse

### Technical Stack (verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | mkdir, writeFile, readFile, readdir, cp |
| `node:path` | built-in | join, basename, dirname, resolve |
| `@clack/prompts` | latest | spinner, log, confirm — in handler.ts only |

### Coverage Expectations

- `src/engine/squad-scaffolder.ts` pure template functions (`buildSquadYaml`, `buildReadme`, `buildAgentTemplate`): covered via scaffoldSquad integration tests
- `validateSquadStructure`, `validateSquadSecurity`, `validateHandoffGraph`: direct unit tests with temp dirs
- `src/engine/community-hub.ts` I/O functions (`fetchSquadManifest`, `downloadManifestFiles`): injectable `fetchFn` pattern for testing without network
- Global project threshold: 70%

### References

- [Source: epics.md#Epic8-Story8.1] — User story, ACs
- [Source: architecture.md#FR-904] — Squad installation and scaffolding commands
- [Source: architecture.md#FR-901] — 4-tier Squad hierarchy
- [Source: architecture.md#FR-902] — 6-layer agent anatomy
- [Source: architecture.md#FR-903] — Voice DNA system with mandatory 5-section template
- [Source: architecture.md#FR-1103] — Squad security review (community Squads)
- [Source: architecture.md#NFR-24] — Community Squad treated as untrusted input
- [Source: architecture.md#layer-dependency] — `contracts/ ← foundation/ ← engine/ ← squads/ ← commands/`
- [Source: architecture.md#complete-project-tree] — `src/squads/` for later stories; engine modules here
- [Source: src/engine/squad-scaffolder.ts] — scaffoldSquad, validateSquadStructure, validateSquadSecurity, validateHandoffGraph, installSquad
- [Source: src/engine/community-hub.ts] — isRegistryName, downloadSquadFromHub, parseSquadManifest
- [Source: src/commands/squad/handler.ts] — runCreate, runAdd, runValidate, validateSquadName
- [Source: src/contracts/squad.ts] — SquadManifest, AgentDefinition, SquadHook, SquadHookPoint
- [Source: templates/squads/software/] — Reference Squad implementation (5 agents)
- [Source: locales/en.yaml#cli.squad] — All i18n keys registered (lines 262–311)
- [Source: templates/commands/squad.md] — Current stub (19 lines) → to be expanded

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_None — pre-built pattern; no debugging required._

### Completion Notes List

- Task 1: Replaced stub content in `templates/commands/squad.md` with `## Squad Create` and `## Squad Installation` sections. Kept header comment and `## Implementation Notes`. Documents 4-tier hierarchy, 6-layer anatomy table, installation flow (5 steps), community hub registry protocol. Final line count: 66 (≤ 300 budget).
- Task 2: Read-only verification of `src/engine/squad-scaffolder.ts` (547 LOC) — all 6 subtasks confirmed: scaffoldSquad, validateSquadStructure, validateSquadSecurity, validateHandoffGraph, installSquad.
- Task 3: Read-only verification of `src/engine/community-hub.ts` (281 LOC) — all 5 subtasks confirmed: isRegistryName, fetchSquadManifest, downloadSquadFromHub, parseSquadManifest, handler routing.
- Task 4: Read-only verification of `squad-scaffolder.test.ts` (534 LOC) and `squad.test.ts` (417 LOC) — all functions covered.
- Task 5: `npx vitest run` — 1723 tests, 68 files, 0 failures, 0 regressions.

### File List

- `templates/commands/squad.md` — replaced stub with `## Squad Create` and `## Squad Installation` sections (66 lines total)

## Change Log

- 2026-03-19: Replaced stub in `templates/commands/squad.md` with Squad Create and Squad Installation sections. Verified all pre-built engine/command files. All 1723 tests pass.
