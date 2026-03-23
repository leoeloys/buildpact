# Story 11.3: Community Health & Governance Infrastructure

Status: done

## Story

As a BuildPact maintainer or first-time contributor,
I want the repository to include contribution guidelines, good-first-issue labels, and Architecture Decision Records,
So that the community can grow sustainably with clear standards and low barriers to entry.

## Acceptance Criteria

**AC-1: CONTRIBUTING.md — Bilingual Step-by-Step Guide + Good First Issues**

Given I visit the `buildpact-squads` repository as a new contributor,
When I look for how to get started,
Then I find a `CONTRIBUTING.md` with step-by-step instructions in both PT-BR and EN,
And there are at least 5 issues labeled `good first issue` with clear scope, estimated effort under 2 hours, and an assigned mentor.

**AC-2: ADR in docs/decisions/ Following MADR Format**

Given a significant architectural or governance decision is made,
When the decision is documented,
Then an ADR is added to `docs/decisions/` following the MADR template format.

**AC-3: PR Template Enforces Bilingual i18n Before Merge**

Given a PR modifies user-facing text in a Squad,
When it is reviewed,
Then the PR template enforces that bilingual content is provided for both PT-BR and EN before merge.

## Tasks / Subtasks

- [x] Task 1: Create `buildpact-squads/CONTRIBUTING.md` — bilingual Squad contribution guide (AC: 1)
  - [x] 1.1 EN section (h2): Step-by-step fork → create Squad dir → add required files → PR → CI → review → merge
  - [x] 1.2 EN section: Required file structure (`manifest.json`, `README.md`, `squad.yaml`, `agents/`)
  - [x] 1.3 EN section: Security requirements (no external URLs, no executable code, no path traversal, no prompt injection)
  - [x] 1.4 EN section: Voice DNA 5-section compliance requirement
  - [x] 1.5 EN section: Bilingual content requirement for user-facing text (PT-BR + EN)
  - [x] 1.6 EN section: Good first issues — link to labeled issues, explain <2hr scope and mentor availability
  - [x] 1.7 PT-BR section (h2): Full equivalent of EN steps in Brazilian Portuguese — NOT a summary, equal quality
  - [x] 1.8 Verify CONTRIBUTING.md itself has no external URLs that would fail the Squad security checks (static badge URLs are allowed in hub README, but CONTRIBUTING.md is a governance file — any links should be to GitHub issues/PRs, not third-party CDNs)

- [x] Task 2: Create `buildpact-squads/.github/labels.yml` — good-first-issue label definitions (AC: 1)
  - [x] 2.1 Create `.github/labels.yml` with at least 5 `good-first-issue` labels (use format: `good-first-issue: <scope>`)
  - [x] 2.2 Each label must include `name`, `color` (#7057ff = standard GFI purple), `description` with: scope, effort estimate <2hr, mentor note
  - [x] 2.3 Suggested labels (adapt as needed): add-squad-readme, fix-manifest-schema, add-voice-dna-section, translate-squad-readme, add-squad-example, improve-contributing, add-squad-heuristic
  - [x] 2.4 Also add supporting labels: `bug`, `enhancement`, `needs-review`, `needs-i18n`, `wontfix`, `duplicate` — mirror pattern from main repo's `.github/labels.yml`

- [x] Task 3: Create `buildpact-squads/.github/PULL_REQUEST_TEMPLATE.md` — Squad-specific PR checklist (AC: 3)
  - [x] 3.1 Describe change section (bilingual comments: EN + PT-BR)
  - [x] 3.2 Checklist section: Squad Structure (manifest.json present, squad.yaml present, README.md present, agents/ directory present)
  - [x] 3.3 Checklist section: Voice DNA Compliance (all 5 sections present in each agent: Role & Identity, Communication Style, Domain Knowledge, Decision Framework, Anti-Patterns)
  - [x] 3.4 Checklist section: Security (no external URLs in agent files, no executable code blocks, no path traversal, no prompt injection patterns)
  - [x] 3.5 Checklist section: Bilingual Content (if Squad has user-facing text: PT-BR and EN versions both present, equal quality — not a translation, both are first-class)
  - [x] 3.6 Checklist section: CI passes (`Squad Validation` check is green — automated CI from Story 11-2)
  - [x] 3.7 Test Plan section with Squad-specific commands (reference `npx buildpact squad validate <squad-dir>`)
  - [x] 3.8 DO NOT copy the main repo's PULL_REQUEST_TEMPLATE.md verbatim — Squads don't have TypeScript code, no `npm run typecheck`, no `Result<T, CliError>` checks

- [x] Task 4: Create `buildpact-squads/docs/decisions/ADR-001-squad-review-governance.md` — Governance ADR (AC: 2)
  - [x] 4.1 Follow MADR format exactly (same as `docs/decisions/TEMPLATE-MADR.md` in main repo)
  - [x] 4.2 Document the Squad review governance decision: two-stage review (automated CI + maintainer human review)
  - [x] 4.3 Capture decision drivers: low barrier to contribute, security trust model, maintainer bandwidth, `reviewed` boolean in manifest
  - [x] 4.4 Document considered options: (A) fully automated, (B) two-stage automated+human, (C) committee review
  - [x] 4.5 Set status: `accepted`; date: 2026-03-19; deciders: BuildPact maintainers
  - [x] 4.6 Also create `buildpact-squads/docs/decisions/TEMPLATE-MADR.md` — copy of the MADR template so community contributors can create ADRs for the hub

- [x] Task 5: Update `buildpact-squads/README.md` Contributing section link (AC: 1)
  - [x] 5.1 Verify `buildpact-squads/README.md` already links to `CONTRIBUTING.md` (line 64: `See [CONTRIBUTING.md](CONTRIBUTING.md)`) — if present, no change needed
  - [x] 5.2 If the Contributing section needs enhancement, add a note about good-first-issue labels

- [x] Task 6: No TypeScript changes — verify no regressions (AC: all)
  - [x] 6.1 This story adds ONLY Markdown/YAML files to `buildpact-squads/` — NO TypeScript is modified
  - [x] 6.2 Run `npx vitest run` in main `buildpact/` repo — all tests must still pass (≥1913 tests, 0 failures)
  - [x] 6.3 Validate `buildpact-squads/.github/labels.yml` is valid YAML (no syntax errors)

## Dev Notes

### Primary Deliverable — All Files in `buildpact-squads/` Scaffold

This story adds governance infrastructure to the **`buildpact-squads/` repository scaffold**. All files created here will be pushed to the separate `github.com/buildpact/buildpact-squads` GitHub repository — they are NOT part of the main `buildpact/` npm package.

```
buildpact-squads/
├── CONTRIBUTING.md                         ← Task 1 (NEW)
├── README.md                               ← Already exists (Task 5 may update)
├── software/
│   ├── manifest.json                       ← Already exists (Story 11-1)
│   └── README.md                           ← Already exists (Story 11-1)
├── docs/
│   └── decisions/
│       ├── TEMPLATE-MADR.md                ← Task 4.6 (NEW — copy from main repo)
│       └── ADR-001-squad-review-governance.md  ← Task 4 (NEW)
└── .github/
    ├── labels.yml                          ← Task 2 (NEW)
    ├── PULL_REQUEST_TEMPLATE.md            ← Task 3 (NEW)
    └── workflows/
        └── squad-validate.yml              ← Story 11-2's deliverable (do NOT touch)
```

### CRITICAL: Do NOT Modify Main Repo Files

The main `buildpact/` repository already has complete equivalents:
- `CONTRIBUTING.md` ✅ (TypeScript dev guide — do NOT modify)
- `.github/PULL_REQUEST_TEMPLATE.md` ✅ (TypeScript PR checklist — do NOT modify)
- `.github/labels.yml` ✅ (7 good-first-issue labels for TypeScript work — do NOT modify)
- `docs/decisions/` ✅ (ADR-000 and ADR-001 for main repo — do NOT modify)

All 4 files created by this story are SEPARATE files in `buildpact-squads/` — the community hub for Squad contributions.

### CRITICAL: .github/ Directory Interaction with Story 11-2

Story 11-2 creates `buildpact-squads/.github/workflows/squad-validate.yml`. Story 11-3 creates `buildpact-squads/.github/labels.yml` and `buildpact-squads/.github/PULL_REQUEST_TEMPLATE.md`.

If Story 11-2 hasn't been implemented yet when you work on 11-3, the `buildpact-squads/.github/` directory may not exist — create it. These are sibling paths, no conflicts.

### CONTRIBUTING.md — Squad-Specific, NOT TypeScript

The `buildpact-squads/CONTRIBUTING.md` documents how to **contribute a Squad** (Markdown + YAML files), not TypeScript code. Key differences from main repo's CONTRIBUTING.md:

| Main repo CONTRIBUTING.md | `buildpact-squads/` CONTRIBUTING.md |
|--------------------------|--------------------------------------|
| Fork + `npm install` | Fork (no npm install needed) |
| TypeScript layer rules | Squad file structure rules |
| `Result<T, CliError>` pattern | Voice DNA 5-section compliance |
| `locales/en.yaml` + `locales/pt-br.yaml` | PT-BR + EN bilingual Squad text |
| `npm run typecheck && npm test` | `npx buildpact squad validate <dir>` |
| Vitest coverage | Squad security checks |

Adapt the step-by-step structure from the main repo's CONTRIBUTING.md (8 numbered steps, EN then PT-BR), but all technical content must be Squad-specific.

### Voice DNA 5 Required Sections (from Architecture + Story 8-3)

Every agent file in a Squad must have these 5 sections — the PR template checklist must reference them by name:

1. **Role & Identity** — Who the agent is, its primary responsibility
2. **Communication Style** — How it speaks, formality level, language preferences
3. **Domain Knowledge** — What it knows, its expertise boundaries
4. **Decision Framework** — How it makes decisions, what heuristics it uses
5. **Anti-Patterns** — What it explicitly avoids doing (✘/✔ pairs)

### Squad Security Requirements (from Architecture + Story 11-2 validator)

The `bp squad validate` command checks these — PR template must reference:
- `validateNoExternalUrls()` — no URLs pointing outside the Squad directory
- `validateNoExecutableCode()` — no bash, eval, exec, or shell code blocks
- `validatePathBoundaries()` — no `../` or absolute path traversal
- `validateNoPromptInjection()` — no "ignore previous instructions" style patterns

### Bilingual Content Requirement — Squad User-Facing Text

From epic AC-3: PR template must enforce PT-BR and EN content. This applies to:
- Squad README.md (if it has descriptive text users will read)
- Agent description fields in squad.yaml (if user-facing)
- Usage instructions in Squad files

This does NOT require translating the agent prompt content itself (the agent IS the prompt). It applies to the **documentation** portions that new users encounter.

### Good First Issues — Label Strategy

The `labels.yml` should define labels that describe categories of GFI work in the community hub. These are different from the main repo (no TypeScript, no unit tests):

| Label | Scope | Effort | Notes |
|-------|-------|--------|-------|
| `good-first-issue: add-squad-readme` | Squad's README.md | <1hr | Template exists |
| `good-first-issue: fix-manifest-schema` | manifest.json fields | <30min | Schema documented |
| `good-first-issue: add-voice-dna-section` | Squad agent file | <1hr | Section template exists |
| `good-first-issue: translate-squad-readme` | Squad README bilingual | <2hr | EN→PT-BR or PT-BR→EN |
| `good-first-issue: add-squad-example` | Squad usage example | <1hr | Add to Squad's README |
| `good-first-issue: improve-contributing` | CONTRIBUTING.md | <30min | Clarify a step or FAQ |
| `good-first-issue: add-squad-heuristic` | Agent heuristic rule | <1hr | Add IF/THEN rule |

7 labels defined = satisfies the "at least 5" requirement with buffer.

### ADR Format — MADR Template

Copy the MADR template structure from `docs/decisions/TEMPLATE-MADR.md` in the main repo exactly. The required fields are:
- `# ADR-NNN — [Title]`
- `**Status:** accepted`
- `**Date:** YYYY-MM-DD`
- `**Deciders:** [names]`
- `## Context and Problem Statement` (2-4 sentences)
- `## Decision Drivers` (bullet list)
- `## Considered Options` (Option A, B, C)
- `## Decision Outcome` (chosen option + justification)
- `### Positive Consequences` / `### Negative Consequences`
- `## Pros and Cons of the Options`
- `## Links`

### PR Template — Must NOT Replicate TypeScript Checks

The `buildpact-squads/` PR template must NOT include:
- `npm run typecheck` or `npm test` — no TypeScript in this repo
- `Result<T, CliError>` pattern — no TypeScript
- ESM `.js` imports — no TypeScript
- `src/contracts/errors.ts` — no TypeScript
- References to Vitest coverage

The PR template MUST include:
- Squad structure completeness (all 4 required files)
- Voice DNA 5-section compliance per agent
- Security check pass (all 4 validators green)
- Bilingual content for user-facing text (if applicable)
- CI check passing (`Squad Validation` workflow from Story 11-2)
- `npx buildpact squad validate <squad-dir>` manual validation command

### Layer Architecture — Not Applicable

`buildpact-squads/` contains no TypeScript. The layer dependency rule (`contracts ← foundation ← engine ← commands ← cli`) does NOT apply to this story's deliverables.

### File Content Must Pass Squad Security Checks

The files created in `buildpact-squads/` by this story (CONTRIBUTING.md, labels.yml, PULL_REQUEST_TEMPLATE.md, ADR files) are governance files in the hub root and `.github/` — the Squad security validator runs on Squad DIRECTORIES (e.g., `buildpact-squads/software/`), NOT on root-level files. So CONTRIBUTING.md and `.github/` files do not need to pass the Squad validator. However, keep them clean (no executable code blocks, reasonable URL usage).

### Technical Stack Reference

| Item | Value |
|------|-------|
| Node.js minimum | 20.x (22.x recommended) |
| Vitest (for regression check) | ^4.1.0 — run `npx vitest run` |
| File formats in this story | Markdown (`.md`), YAML (`.yml`) |
| No TypeScript changes | This story touches zero `.ts` files |

### Previous Story Intelligence

**From Story 11-1 (review):**
- `buildpact-squads/README.md` line 64 already links to `CONTRIBUTING.md` — the link must resolve after Task 1 creates the file
- `manifest.json` schema is finalized and documented in `buildpact-squads/README.md` (do not re-document it in CONTRIBUTING.md beyond a brief reference)
- 1913 tests passed at end of 11-1 — maintain this baseline

**From Story 11-2 (ready-for-dev — not yet implemented):**
- `.github/workflows/squad-validate.yml` will be created by 11-2; CONTRIBUTING.md and PR template should reference it by name ("Squad Validation" workflow) for CI context
- The PR template's CI checklist item should say: "Squad Validation CI check is green" (referencing the workflow created by 11-2)
- If 11-2 has NOT been implemented when this story runs, the `.github/` directory will not exist yet — create it

**From Story 8-3 (Voice DNA template — review):**
- 5-section Voice DNA structure is the canonical template for all Squad agents
- PR template checklist should explicitly name all 5 sections to prevent agents from skipping them

### Cross-Epic Dependencies

- **Epic 8.3** — Voice DNA 5-section template defines what PR template checks
- **Epic 8.4** — Squad validation checks define what CI enforces (security validator)
- **Epic 11.1** — `buildpact-squads/` scaffold exists; README already links to CONTRIBUTING.md
- **Epic 11.2** — `.github/workflows/squad-validate.yml` is the CI that PR template references

### Anti-Patterns to Avoid

- ❌ Do NOT create CONTRIBUTING.md in the main `buildpact/` repo — it already exists and is complete
- ❌ Do NOT copy the main repo's TypeScript CONTRIBUTING.md into `buildpact-squads/` — Squad contribution is different
- ❌ Do NOT add TypeScript checklist items to `buildpact-squads/PULL_REQUEST_TEMPLATE.md`
- ❌ Do NOT add `.github/workflows/` in this story — that's Story 11-2
- ❌ Do NOT add `buildpact-squads/` to the npm `files` array in `package.json`
- ❌ Do NOT run `npm install` in `buildpact-squads/` — no package.json there
- ❌ Do NOT resolve OQ-04 (BDFL vs committee governance) — it's deferred to Month 6; the ADR documents the interim model

### Project Structure Notes

```
buildpact/ (main repo — this project root)
├── CONTRIBUTING.md                    ← MAIN REPO — DO NOT MODIFY
├── .github/
│   ├── labels.yml                     ← MAIN REPO — DO NOT MODIFY
│   ├── PULL_REQUEST_TEMPLATE.md       ← MAIN REPO — DO NOT MODIFY
│   └── workflows/                     ← MAIN REPO — DO NOT MODIFY
├── docs/decisions/                    ← MAIN REPO — DO NOT MODIFY
│   ├── ADR-000-esm-typescript-result-pattern.md
│   ├── ADR-001-autoResearch-isolation.md
│   └── TEMPLATE-MADR.md              ← Use this as reference for ADR format
└── buildpact-squads/                  ← COMMUNITY HUB SCAFFOLD (all deliverables here)
    ├── CONTRIBUTING.md                ← CREATE (Task 1)
    ├── README.md                      ← EXISTS (Task 5 — verify link, may no-op)
    ├── software/ ...                  ← EXISTS (Stories 11-1 — do not touch)
    ├── docs/decisions/
    │   ├── TEMPLATE-MADR.md           ← CREATE (Task 4.6)
    │   └── ADR-001-squad-review-governance.md  ← CREATE (Task 4)
    └── .github/
        ├── labels.yml                 ← CREATE (Task 2)
        ├── PULL_REQUEST_TEMPLATE.md   ← CREATE (Task 3)
        └── workflows/
            └── squad-validate.yml    ← Story 11-2 (may not exist yet — do not create)
```

### References

- Acceptance criteria: [Source: epics.md#Epic11-Story11.3]
- NFR-17: `CONTRIBUTING.md` (PT-BR + EN): [Source: architecture.md#FR-NFR-Mapping Line 893]
- NFR-20: ADRs in MADR format at `docs/decisions/`: [Source: architecture.md#FR-NFR-Mapping Line 894]
- MADR template: [Source: docs/decisions/TEMPLATE-MADR.md]
- OQ-04 governance deferred: [Source: architecture.md#Core-Architectural-Decisions Line 329]
- Voice DNA 5 sections: [Source: epics.md#Epic8-Story8.3]
- Squad security validators: [Source: 8-4-squad-structural-validation.md / 11-2-squad-contribution-flow-with-automated-ci.md]
- Main repo CONTRIBUTING.md pattern (EN first, PT-BR second): [Source: CONTRIBUTING.md]
- Main repo labels.yml pattern: [Source: .github/labels.yml]
- Main repo PR template pattern: [Source: .github/PULL_REQUEST_TEMPLATE.md]
- `buildpact-squads/` README links to CONTRIBUTING.md: [Source: buildpact-squads/README.md Line 64]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `buildpact-squads/CONTRIBUTING.md` — bilingual (EN + PT-BR) 8-step Squad contribution guide with Voice DNA, security, and bilingual content requirements
- Created `buildpact-squads/.github/labels.yml` — 7 good-first-issue labels (all #7057ff, all <2hr scope with mentor) + 6 supporting labels (bug, enhancement, needs-review, needs-i18n, wontfix, duplicate)
- Created `buildpact-squads/.github/PULL_REQUEST_TEMPLATE.md` — Squad-specific PR checklist covering Squad structure, Voice DNA compliance (5 sections by name), security (4 validators), bilingual content, and CI check; no TypeScript references
- Created `buildpact-squads/docs/decisions/TEMPLATE-MADR.md` — MADR template copied from main repo for community ADR contributions
- Created `buildpact-squads/docs/decisions/ADR-001-squad-review-governance.md` — accepted ADR documenting two-stage review governance (automated CI + human maintainer review)
- Task 5: `buildpact-squads/README.md` line 64 already links to `CONTRIBUTING.md` — no change needed
- Task 6: 1927 tests pass (0 failures), no TypeScript modified, labels.yml passes YAML validation

### File List

- buildpact-squads/CONTRIBUTING.md (new)
- buildpact-squads/.github/labels.yml (new)
- buildpact-squads/.github/PULL_REQUEST_TEMPLATE.md (new)
- buildpact-squads/docs/decisions/TEMPLATE-MADR.md (new)
- buildpact-squads/docs/decisions/ADR-001-squad-review-governance.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml (updated: 11-3 → review)
- _bmad-output/implementation-artifacts/11-3-community-health-and-governance-infrastructure.md (updated: tasks checked, status → review)
