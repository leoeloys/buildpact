# Story 11.1: Public Community Hub Repository

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a BuildPact user looking for domain-specific Squads,
I want a dedicated GitHub repository where I can discover and install community-created Squads with a single command,
so that I don't have to build every Squad from scratch and can benefit from the community's domain expertise.

## Acceptance Criteria

**AC-1: Hub Repository Structure — Domain-Organized Discovery**

Given the `buildpact-squads` repository exists
When I browse it
Then I can find available community Squads organized by domain
And each Squad has a `README.md` describing its agents, use cases, usage instructions, MIT license, and a validation badge

**AC-2: `npx buildpact squad add <name>` — Download + Validate + Install**

Given I want to install a community Squad
When I run `npx buildpact squad add <squad-name>`
Then the Squad is downloaded from `github.com/buildpact/buildpact-squads`, validated locally (structural + security checks), and installed to `.buildpact/squads/<name>/`
And I receive a warning if the Squad has not yet received a maintainer review (`reviewed: false` in manifest)

## Tasks / Subtasks

- [x] Task 1: Create `buildpact-squads/` repository scaffold (AC: #1)
  - [x] 1.1: Create `buildpact-squads/README.md` — hub index organized by domain with badge legend, install command examples (`npx buildpact squad add <name>`), contribution guide link, and MIT license note
  - [x] 1.2: Create `buildpact-squads/software/manifest.json` — manifest for the Software Squad: `name`, `domain`, `description`, `version`, `reviewed`, `files` array listing all squad file paths
  - [x] 1.3: Create `buildpact-squads/software/README.md` — Software Squad entry: agents table, use cases, install instruction, `![Validated](badge URL)` badge markup, MIT license
  - [x] 1.4: Verify `buildpact-squads/` directory has no executable code, no external URLs beyond expected GitHub badge URLs, no path traversal — passes its own security checks

- [x] Task 2: Define and document `manifest.json` schema (AC: #2)
  - [x] 2.1: Confirm the manifest schema: `{ name: string, domain: string, description: string, version: string, reviewed: boolean, files: string[] }` — document in `buildpact-squads/README.md`
  - [x] 2.2: Verify `src/engine/community-hub.ts` function `parseSquadManifest()` handles the `reviewed` field — returns `reviewed: false` when field is absent (safe default)
  - [x] 2.3: Verify `src/commands/squad/handler.ts` `runAdd()` emits warning (via i18n key `cli.squad.hub.unreviewed_warning`) when `manifest.reviewed === false` — warning MUST display before install proceeds (do NOT block; only warn)

- [x] Task 3: Add i18n keys for hub-specific messages if missing (AC: #2)
  - [x] 3.1: Check `locales/en.yaml` and `locales/pt-br.yaml` for `cli.squad.hub.*` keys — verify these exist: `cli.squad.hub.unreviewed_warning`, `cli.squad.hub.downloading`, `cli.squad.hub.install_success`
  - [x] 3.2: Add missing keys to BOTH locale files if absent — keep dot-notation max 3 levels; snake_case key segments

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1: `npx vitest run` — all tests pass, no regressions
  - [x] 4.2: Verify `buildpact-squads/software/manifest.json` is valid JSON (no syntax errors)

## Dev Notes

### ⚠️ CRITICAL: What's Already Built (DO NOT RECREATE)

Story 8.1 pre-built the entire CLI side of `squad add`. **Do NOT modify these unless Task 2.2/2.3 reveals a bug:**

| File | Status | LOC | Notes |
|------|--------|-----|-------|
| `src/engine/community-hub.ts` | ✅ Complete | 281 | `isRegistryName`, `fetchSquadManifest`, `downloadSquadFromHub`, `parseSquadManifest` |
| `src/engine/squad-scaffolder.ts` | ✅ Complete | 547 | `validateSquadStructure`, `validateSquadSecurity`, `installSquad` |
| `src/commands/squad/handler.ts` | ✅ Complete | 475 | `runAdd` already handles download → validate → install → warn flow |
| `src/contracts/squad.ts` | ✅ Complete | 58 | `SquadManifest`, `AgentDefinition` |
| `templates/squads/software/` | ✅ Complete | — | Full 5-agent Software Squad (reference implementation) |
| `templates/commands/squad.md` | ✅ Complete | 66 | Documents `squad add` and `squad create` |

**Primary deliverable for this story = the `buildpact-squads/` repository scaffold (files 1.1–1.3).**

### Project Structure Notes

**Where `buildpact-squads/` lives:**

The `buildpact-squads/` directory is created at the root of the main BuildPact repo as the scaffold for the separate `github.com/buildpact/buildpact-squads` GitHub repository. It is:
- NOT compiled or imported by TypeScript
- NOT included in the npm package (`files` field in package.json only ships `dist/`, `templates/`, `locales/`)
- A standalone scaffold that will become its own GitHub repository

**Directory structure to create:**
```
buildpact-squads/
├── README.md                     # Hub index — domain-organized discovery
└── software/
    ├── manifest.json             # Hub manifest (fetched by `squad add software`)
    └── README.md                 # Squad entry page with validation badge
```

**No `.github/` workflows yet** — those are Story 11.2. Do NOT create `.github/` in `buildpact-squads/` for this story.

### manifest.json Schema

`community-hub.ts` fetches `<registryBase>/<name>/manifest.json` and calls `parseSquadManifest()`.
From Story 8.1, `parseSquadManifest()` returns `err()` if `name` or `files` fields are missing. The `reviewed` field gates the warning.

**Required schema for `buildpact-squads/software/manifest.json`:**
```json
{
  "name": "software",
  "domain": "software",
  "description": "Full-stack software development Squad (PM, Architect, Developer, QA, Tech Writer)",
  "version": "0.1.0",
  "reviewed": true,
  "files": [
    "squad.yaml",
    "README.md",
    "agents/chief.md",
    "agents/specialist.md",
    "agents/support.md",
    "agents/reviewer.md"
  ]
}
```

`files` array must list paths RELATIVE to the squad directory (matching what `downloadSquadFromHub` downloads).

### reviewed Field → Warning Logic

From Story 8.1, `runAdd()` in `handler.ts` already warns when Squad has not been reviewed. Verify the check matches:
```typescript
// Expected pattern in handler.ts — verify, do NOT rewrite
if (!manifest.reviewed) {
  log.warn(i18n.t('cli.squad.hub.unreviewed_warning', { name: squadName }))
  // installation CONTINUES after warning
}
```

`reviewed: true` = maintainer has reviewed; no warning shown.
`reviewed: false` (or field absent) = warning MUST be shown; install still proceeds.

### Validation Badge Markup

From architecture, squads in the hub display a validation badge. Use this static badge pattern:
```markdown
![Validated](https://img.shields.io/badge/BuildPact-Validated-brightgreen)
```

This is a static URL (shields.io) — it does NOT violate the "no external URLs" security check because the security check runs on Squad AGENT files (`.md`/`.yaml` in the Squad itself), not on the hub's README.md.

### i18n Keys Pattern

From architecture and Story 8.1, all `locales/en.yaml` squad keys are at `cli.squad.*`. Verify these keys exist and add if missing:

```yaml
# locales/en.yaml — under cli.squad.hub:
hub:
  downloading: "Downloading '{name}' from community hub..."
  install_success: "Squad '{name}' installed to .buildpact/squads/{name}/"
  unreviewed_warning: "⚠️  Squad '{name}' has not been reviewed by a BuildPact maintainer. Install anyway?"
```

```yaml
# locales/pt-br.yaml — under cli.squad.hub:
hub:
  downloading: "Baixando '{name}' do hub da comunidade..."
  install_success: "Squad '{name}' instalado em .buildpact/squads/{name}/"
  unreviewed_warning: "⚠️  O Squad '{name}' ainda não foi revisado por um maintainer do BuildPact. Instalar mesmo assim?"
```

**Pattern from architecture:** dot-notation, max 3 levels, snake_case segments. `{name}` = i18n interpolation param.

### Layer Dependency — MUST Follow

```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

`buildpact-squads/` scaffold files are Markdown/JSON — no TypeScript layer concerns apply.

### Anti-Patterns to Avoid

- ❌ Do NOT recreate `src/engine/community-hub.ts` — it's complete (281 LOC, story 8.1)
- ❌ Do NOT modify `templates/squads/software/` — that is the bundled npm squad; `buildpact-squads/software/` is the hub entry (separate)
- ❌ Do NOT add a `.github/` workflows folder in `buildpact-squads/` — that's Story 11.2
- ❌ Do NOT add i18n keys with camelCase or more than 3 dot-notation levels
- ❌ Do NOT include executable code blocks (`bash`, `eval`, `exec`) in `buildpact-squads/software/README.md`
- ❌ Do NOT add `buildpact-squads/` to the npm `files` array in `package.json`

### Technical Stack (from architecture, verified March 2026)

| Package / Feature | Version | Notes |
|-------------------|---------|-------|
| Node.js minimum | **20.x** | 18 EOL April 2025 |
| TypeScript | **5.x strict** | NodeNext moduleResolution |
| Vitest | **^4.1.0** | Unit + integration testing |
| `node:fs/promises` | built-in | used by community-hub.ts |

### FRs Covered

- `FR-1101` — Public Hub Repository (`buildpact-squads`) with domain-organized Squads
- `NFR-24` — Community Squad Security: users warned when Squad is unreviewed

### References

- [Source: epics.md#Epic11-Story11.1] — User story, acceptance criteria
- [Source: epics.md#FR-1101] — Public Hub Repository requirement
- [Source: epics.md#FR-1103] — Squad security review (automated + maintainer review)
- [Source: epics.md#NFR-24] — Community Squad treated as untrusted; warning required
- [Source: architecture.md#community-squad-security] — Validation behavior: block on failure for community source, warn for unreviewed
- [Source: architecture.md#hosting-distribution] — `github.com/buildpact/buildpact-squads` separate repo from Alpha
- [Source: architecture.md#squad-validator-pure-module] — `parseSquadManifest()` cached in `.buildpact/audit/squad-validation-{timestamp}.json`
- [Source: architecture.md#complete-project-tree] — `templates/squads/software/` = bundled; hub is separate
- [Source: 8-1-squad-scaffolding-and-installation.md] — community-hub.ts (281 LOC), squad-scaffolder.ts (547 LOC), handler.ts (475 LOC) — all pre-built
- [Source: 8-1-squad-scaffolding-and-installation.md#manifest-protocol] — `<name>/manifest.json` → download all files to temp dir → validate → install
- [Source: locales/en.yaml#cli.squad] — Existing squad i18n keys (lines 262–311 per Story 8.1)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No debug issues encountered — all scaffold files and code were pre-built or already correct.

### Completion Notes List

- All 3 `buildpact-squads/` scaffold files verified present and correct (README.md, software/manifest.json, software/README.md)
- `parseSquadManifest()` confirmed safe-defaults `reviewed` to `false` when field is absent (line 171 community-hub.ts)
- `runAdd()` confirmed emits `cli.squad.hub.unreviewed_warning` warning when `manifest.reviewed === false`, install proceeds without blocking (handler.ts lines 195-197)
- All 3 `cli.squad.hub.*` i18n keys (`downloading`, `install_success`, `unreviewed_warning`) present in both `locales/en.yaml` and `locales/pt-br.yaml`
- Security check: no executable code, no unexpected external URLs, no path traversal in `buildpact-squads/`
- 1913 tests pass across 73 test files, 0 regressions

### File List

- `buildpact-squads/README.md` (hub index with badge legend, manifest schema docs, contribution guide, MIT license)
- `buildpact-squads/software/manifest.json` (Software Squad hub manifest)
- `buildpact-squads/software/README.md` (Software Squad entry with validation badge, agents table, use cases, install command)

## Change Log

- 2026-03-19: Story implementation complete — verified all scaffold files, code behavior, i18n keys, and security checks; all 1913 tests pass (Date: 2026-03-19)
