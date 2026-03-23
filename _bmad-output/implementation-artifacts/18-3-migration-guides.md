# Story 18.3: Migration Guides

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer currently using BMAD, GSD, or SpecKit,
I want a migration guide that maps my existing workflow concepts to BuildPact equivalents,
So that I can adopt BuildPact without losing my investment in my current framework.

## Acceptance Criteria

**AC-1: BMAD Concept Mapping**

Given a BMAD user reads the BMAD migration guide
When they look for concept mapping
Then they find a table mapping: BMAD agents -> BuildPact squad agents, BMAD workflows -> BuildPact pipeline phases, BMAD artifacts -> BuildPact output structure

**AC-2: GSD Workflow Equivalents**

Given a GSD user reads the GSD migration guide
When they look for workflow equivalents
Then they find mappings for: GSD phases -> BuildPact pipeline, GSD roadmap -> BuildPact plan, GSD executor -> BuildPact execute

**AC-3: SpecKit Setup Equivalents**

Given a SpecKit user reads the SpecKit migration guide
When they look for setup equivalents
Then they find: SpecKit rules -> BuildPact constitution, SpecKit templates -> BuildPact commands, SpecKit cursorrules -> BuildPact IDE config

**AC-4: Step-by-Step Migration Under 30 Minutes**

Given any migration guide
When a user follows the step-by-step instructions
Then they can migrate an existing project to BuildPact in under 30 minutes with their existing artifacts preserved

## Tasks / Subtasks

- [x] Task 1: Create BMAD migration guide (EN) (AC: #1, #4)
  - [x] 1.1: Create `docs/en/guide/migration/from-bmad.md` with introduction explaining BuildPact's relationship to BMAD (evolution, not replacement)
  - [x] 1.2: Write concept mapping table: BMAD agents (pm, architect, dev, qa, tech-writer) -> BuildPact software squad agents (same roles but with Voice DNA, 6-layer anatomy)
  - [x] 1.3: Write workflow mapping table: BMAD workflows (create-prd, create-architecture, create-epics, dev-story, code-review) -> BuildPact pipeline phases (specify, plan, execute, verify)
  - [x] 1.4: Write artifact mapping: `_bmad-output/` -> `.buildpact/`, `config.yaml` -> `.buildpact/config.yaml`, BMAD party-mode -> BuildPact `orchestrate` (conclave)
  - [x] 1.5: Write step-by-step migration instructions referencing `buildpact adopt` command for brownfield onboarding
  - [x] 1.6: Add "What's New in BuildPact" section highlighting capabilities BMAD doesn't have (budget guards, model profiles, wave execution, constitution enforcement, community hub)
  - [x] 1.7: Add "Known Differences" section honestly noting gaps or behavioral differences

- [x] Task 2: Create GSD migration guide (EN) (AC: #2, #4)
  - [x] 2.1: Create `docs/en/guide/migration/from-gsd.md` with introduction explaining BuildPact's relationship to GSD
  - [x] 2.2: Write concept mapping table: GSD `.planning/` -> BuildPact `.buildpact/`, GSD phases -> BuildPact pipeline phases, GSD roadmap -> BuildPact plan output
  - [x] 2.3: Write workflow mapping: GSD executor -> BuildPact `execute`, GSD research agents -> BuildPact `plan --research`, GSD `config.json` -> BuildPact `.buildpact/config.yaml`
  - [x] 2.4: Write step-by-step migration instructions referencing `buildpact adopt` command
  - [x] 2.5: Add "What's New" and "Known Differences" sections

- [x] Task 3: Create SpecKit migration guide (EN) (AC: #3, #4)
  - [x] 3.1: Create `docs/en/guide/migration/from-speckit.md` with introduction explaining BuildPact's relationship to SpecKit
  - [x] 3.2: Write concept mapping table: SpecKit `.cursorrules` -> BuildPact constitution + IDE config, SpecKit templates -> BuildPact command templates, SpecKit rules -> BuildPact constitution principles
  - [x] 3.3: Write step-by-step migration instructions referencing `buildpact adopt` command
  - [x] 3.4: Add "What's New" and "Known Differences" sections

- [x] Task 4: Create migration overview index page (EN) (AC: #1, #2, #3)
  - [x] 4.1: Create `docs/en/guide/migration/index.md` as a landing page listing all three migration guides with brief descriptions
  - [x] 4.2: Include a comparison table summarizing all three frameworks vs BuildPact at a glance
  - [x] 4.3: Include a "General Migration Steps" section covering the common workflow (install, adopt, configure, verify) applicable to any source framework

- [x] Task 5: Translate all migration guides to PT-BR (AC: #1, #2, #3, #4)
  - [x] 5.1: Translate `docs/en/guide/migration/index.md` -> `docs/pt-br/guide/migration/index.md` with native-quality PT-BR
  - [x] 5.2: Translate `docs/en/guide/migration/from-bmad.md` -> `docs/pt-br/guide/migration/from-bmad.md`
  - [x] 5.3: Translate `docs/en/guide/migration/from-gsd.md` -> `docs/pt-br/guide/migration/from-gsd.md`
  - [x] 5.4: Translate `docs/en/guide/migration/from-speckit.md` -> `docs/pt-br/guide/migration/from-speckit.md`
  - [x] 5.5: Verify all technical terms (command names, file paths, config keys) remain untranslated — only prose and headings are translated

- [x] Task 6: Integrate into VitePress navigation (AC: #1, #2, #3)
  - [x] 6.1: Add "Migration Guides" entry to the EN sidebar config under the "Guide" section in `docs/.vitepress/config.ts`
  - [x] 6.2: Add "Guias de Migração" entry to the PT-BR sidebar config
  - [x] 6.3: Link migration guides from the FAQ page (Story 18.1 creates FAQ — if not yet created, add a TODO note)

- [x] Task 7: Verify acceptance criteria (AC: #1, #2, #3, #4)
  - [x] 7.1: Verify BMAD guide contains complete concept mapping table with agents, workflows, and artifacts
  - [x] 7.2: Verify GSD guide contains complete workflow mapping with phases, roadmap, and executor equivalents
  - [x] 7.3: Verify SpecKit guide contains complete setup mapping with rules, templates, and cursorrules equivalents
  - [x] 7.4: Walk through each migration guide's step-by-step instructions and estimate time — must be achievable in under 30 minutes
  - [x] 7.5: Run `npm run docs:build` (if VitePress infra from Story 18.1 exists) and verify zero broken links
  - [x] 7.6: Verify PT-BR translations exist for all EN pages and maintain structural parity

## Dev Notes

### Dependency

This story **depends on Story 18.1** (Documentation Site with VitePress & i18n). Story 18.1 creates the VitePress infrastructure, folder structure (`docs/en/`, `docs/pt-br/`), sidebar config, and build scripts. If 18.1 is not yet implemented, the dev agent should create the migration guide markdown files in the correct paths but may not be able to integrate into sidebar navigation or verify with `docs:build`.

### Priority Level

FR-1503 classifies migration guides as **SHOULD** priority (not MUST). This means the guides are important but not blocking for the alpha/beta release. Content quality matters more than completeness — better to have one excellent guide than three mediocre ones.

### File Structure

```
docs/
├── en/
│   └── guide/
│       └── migration/
│           ├── index.md          # Overview + comparison table
│           ├── from-bmad.md      # BMAD -> BuildPact
│           ├── from-gsd.md       # GSD -> BuildPact
│           └── from-speckit.md   # SpecKit -> BuildPact
└── pt-br/
    └── guide/
        └── migration/
            ├── index.md
            ├── from-bmad.md
            ├── from-gsd.md
            └── from-speckit.md
```

### Concept Mapping Reference

**BMAD -> BuildPact:**

| BMAD Concept | BuildPact Equivalent | Notes |
|---|---|---|
| BMAD agents (pm, architect, dev, qa, tech-writer) | Software squad agents (same roles) | BuildPact adds Voice DNA, 6-layer anatomy, autonomy leveling |
| `create-prd` workflow | `buildpact specify` | Natural language spec capture with ambiguity detection |
| `create-architecture` workflow | `buildpact plan` | Adds wave-based parallelism, multi-perspective validation |
| `create-epics` workflow | `buildpact plan` (output) | Plan generates wave-organized tasks, not traditional epics |
| `dev-story` workflow | `buildpact execute` | Adds subagent isolation, budget guards, crash recovery |
| `code-review` workflow | `buildpact verify` | Goal-backward verification |
| `party-mode` | `buildpact orchestrate` (conclave) | Multi-agent deliberation with structured consensus |
| `config.yaml` (root) | `.buildpact/config.yaml` | Enhanced with model profiles, budget limits, squad config |
| `_bmad-output/` | `.buildpact/` | Structured directory with audit trail, memory tiers |
| BMAD `.cursorrules` | BuildPact constitution + IDE-specific config | Constitution is IDE-agnostic; IDE configs generated per tool |

**GSD -> BuildPact:**

| GSD Concept | BuildPact Equivalent | Notes |
|---|---|---|
| `.planning/` directory | `.buildpact/` directory | Structured with audit, memory, output subdirectories |
| GSD phases (research, plan, execute) | BuildPact pipeline (specify, plan, execute, verify) | BuildPact adds specify and verify phases |
| GSD roadmap | `buildpact plan` output | Wave-based execution plan with parallel task groups |
| GSD executor | `buildpact execute` | Adds subagent isolation, atomic commits, budget guards |
| GSD research agents | `buildpact plan --research` | Automated parallel research before planning |
| `config.json` | `.buildpact/config.yaml` | YAML format, richer configuration options |

**SpecKit -> BuildPact:**

| SpecKit Concept | BuildPact Equivalent | Notes |
|---|---|---|
| `.cursorrules` | BuildPact constitution (`.buildpact/constitution.md`) | IDE-agnostic; constitution enforced across all tools |
| SpecKit templates | BuildPact command templates (`templates/commands/`) | Templates drive pipeline behavior, not just IDE rules |
| SpecKit rules/conventions | BuildPact constitution principles | Versioned, enforced at execution time, auditable |
| SpecKit project setup | `buildpact init` or `buildpact adopt` | Guided interactive setup with squad installation |

### The `buildpact adopt` Command

The `adopt` command at `src/commands/adopt/` is the primary CLI tool for brownfield project adoption. Each migration guide's step-by-step section should reference this command as the recommended migration path. The adopt flow:

1. Scans the project for existing framework artifacts
2. Detects existing AI configs (Claude Code, Cursor, Gemini, Codex)
3. Prompts for domain selection, IDE preferences, experience level
4. Generates `.buildpact/` structure with pre-filled artifacts
5. Optionally runs a diagnostic report showing migration completeness

The scanner (`src/foundation/scanner.ts`) already detects existing framework artifacts — migration guides should explain what `adopt` will find and preserve.

### Writing Style Guidelines

- **Target audience:** Framework users, not contributors. Keep language accessible.
- **Tone:** Welcoming, not competitive. BuildPact evolves from these frameworks; respect the user's investment.
- **Structure:** Each guide should follow: Introduction -> Why Migrate? -> Concept Mapping Table -> Step-by-Step Migration -> What's New -> Known Differences -> FAQ
- **Honesty:** Be transparent about gaps. If BuildPact doesn't have a 1:1 equivalent for a feature, say so and explain the alternative approach.
- **Code examples:** Use minimal, focused examples. Show `buildpact` CLI commands, not TypeScript internals.
- **Time estimate:** Each guide should enable migration in under 30 minutes. Focus on `buildpact adopt` as the primary migration tool.

### Anti-Patterns to Avoid

- **Do NOT make migration guides too technical** — target audience is framework users, not contributors
- **Do NOT claim 1:1 feature parity** — be honest about gaps and new capabilities
- **Do NOT write migration scripts or automation** — these are documentation guides, not code
- **Do NOT create pages outside VitePress structure** — all pages go in `docs/en/` and `docs/pt-br/`
- **Do NOT skip PT-BR translations** — bilingual requirement is non-negotiable
- **Do NOT disparage source frameworks** — BuildPact stands on their shoulders; be respectful
- **Do NOT include internal implementation details** — users care about workflows and commands, not engine internals
- **Do NOT hardcode version numbers in migration steps** — use `latest` or `^0.x` patterns

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-1503] — Migration guide requirement (SHOULD priority)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-18.3] — Story definition and acceptance criteria
- [Source: src/commands/adopt/handler.ts] — Adopt command implementation (brownfield onboarding)
- [Source: src/foundation/scanner.ts] — Project scanner that detects existing framework artifacts
- [Source: src/foundation/adopter.ts] — Adoption logic that generates BuildPact artifacts
- [Source: _bmad-output/implementation-artifacts/18-1-documentation-site.md] — Dependency: VitePress infrastructure story
- [Source: _bmad-output/design-brownfield-and-upgrade.md] — Brownfield adoption design document
- [Source: _bmad-output/framework-analysis-buildpact-evolution.md] — Framework analysis with concept comparisons

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 8 migration guide files were created during Story 18-1 (documentation site)
- EN: index.md (82 lines), from-bmad.md (136), from-gsd.md (145), from-speckit.md (124)
- PT-BR: exact parity with EN pages
- Sidebar config already included migration guides from Story 18-1
- docs:build passes with zero errors and zero dead links
- Content verified against all ACs: concept mapping tables, workflow equivalents, step-by-step instructions

### File List

- docs/en/guide/migration/index.md (existing from 18-1)
- docs/en/guide/migration/from-bmad.md (existing from 18-1)
- docs/en/guide/migration/from-gsd.md (existing from 18-1)
- docs/en/guide/migration/from-speckit.md (existing from 18-1)
- docs/pt-br/guide/migration/index.md (existing from 18-1)
- docs/pt-br/guide/migration/from-bmad.md (existing from 18-1)
- docs/pt-br/guide/migration/from-gsd.md (existing from 18-1)
- docs/pt-br/guide/migration/from-speckit.md (existing from 18-1)

### Change Log

- Story created by create-story workflow (Date: 2026-03-22)
- Verified and marked done — content already existed from Story 18-1 (Date: 2026-03-22)
