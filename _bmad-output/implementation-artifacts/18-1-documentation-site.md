# Story 18.1: Documentation Site with VitePress & i18n

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new BuildPact user,
I want a comprehensive documentation site with tutorials, API reference, and conceptual guides,
so that I can learn the framework without reading source code.

## Acceptance Criteria

**AC-1: Site Navigation Structure**

Given a user visits the docs site
When they browse the navigation
Then they find sections for: Quick Start, Tutorials (step-by-step), CLI Reference (all commands), Architecture Overview, and FAQ
And each CLI command has usage examples, options, and expected output

**AC-2: VitePress with i18n Infrastructure**

Given the docs site infrastructure
When a developer inspects the setup
Then it uses VitePress with i18n folder structure (`docs/en/`, `docs/pt-br/`) configured from day 1
And language switching works between EN and PT-BR

**AC-3: Portuguese Content Parity**

Given a Portuguese-speaking user visits the docs
When they toggle the language selector
Then all content is available in PT-BR with native-quality translations

**AC-4: Quick Start Tutorial**

Given a user follows the Quick Start tutorial
When they complete all steps
Then they have a working BuildPact project with a squad installed and their first `buildpact quick` task completed in under 5 minutes

**AC-5: GitHub Pages Deployment**

Given the documentation source files
When deployed
Then the site is hosted on GitHub Pages with automatic deployment from the `docs/` branch

## Tasks / Subtasks

- [x] Task 1: Initialize VitePress project structure (AC: #2)
  - [x] 1.1: Install VitePress as devDependency, add `docs:dev`, `docs:build`, `docs:preview` scripts to package.json
  - [x] 1.2: Create `docs/.vitepress/config.ts` with i18n configuration for EN (default) and PT-BR locales
  - [x] 1.3: Create folder structure: `docs/en/` and `docs/pt-br/` with matching page hierarchy
  - [x] 1.4: Configure VitePress theme with BuildPact branding (no custom CSS framework — use default theme with minimal overrides)
  - [x] 1.5: Verify `npm run docs:dev` serves the site locally with language switching functional

- [x] Task 2: Create site navigation and sidebar structure (AC: #1)
  - [x] 2.1: Define EN sidebar config in `docs/.vitepress/config.ts` with sections: Getting Started, Tutorials, CLI Reference, Architecture, FAQ
  - [x] 2.2: Define PT-BR sidebar config mirroring EN structure with translated labels
  - [x] 2.3: Create index pages (`index.md`) for each section in both locales
  - [x] 2.4: Add top navigation bar with: Home, Guide, CLI Reference, GitHub link

- [x] Task 3: Write Quick Start tutorial (AC: #4)
  - [x] 3.1: Write `docs/en/guide/quick-start.md` covering: install via npm, `buildpact init`, install software squad, run `buildpact quick "add hello world endpoint"`
  - [x] 3.2: Include terminal output examples for each step (use VitePress code blocks with shell language)
  - [x] 3.3: Add prerequisites section (Node.js >= 20, an AI provider API key)
  - [x] 3.4: Translate to `docs/pt-br/guide/quick-start.md` — native-quality PT-BR, not machine translation

- [x] Task 4: Write CLI Reference pages (AC: #1)
  - [x] 4.1: Create `docs/en/cli/` directory with one page per command: init, quick, specify, plan, execute, verify, squad, doctor, status, memory, export-web, quality, docs, investigate, audit, diff, adopt, upgrade, completion, orchestrate, help
  - [x] 4.2: Each command page must include: description, usage syntax, options/flags, examples with expected output, related commands
  - [x] 4.3: Extract command info from existing `templates/commands/*.md` files and `src/commands/*/index.ts` handler registrations
  - [x] 4.4: Translate all CLI reference pages to PT-BR in `docs/pt-br/cli/`

- [x] Task 5: Write Architecture Overview (AC: #1)
  - [x] 5.1: Create `docs/en/architecture/overview.md` explaining the 3-layer architecture (Foundation, Engine, Domain)
  - [x] 5.2: Create `docs/en/architecture/pipeline.md` explaining the pipeline flow (Quick → Specify → Plan → Execute → Verify)
  - [x] 5.3: Create `docs/en/architecture/squads.md` explaining squad architecture (4-tier hierarchy, 6-layer anatomy, Voice DNA, agent leveling)
  - [x] 5.4: Include mermaid diagrams from existing `docs/architecture.mermaid` and `docs/pipeline-flow.mermaid`
  - [x] 5.5: Translate architecture pages to PT-BR

- [x] Task 6: Write FAQ page (AC: #1)
  - [x] 6.1: Create `docs/en/faq.md` with common questions: What is BuildPact? How is it different from BMAD/GSD? What AI providers work? How to create custom squads? How to contribute?
  - [x] 6.2: Translate FAQ to PT-BR

- [x] Task 7: Configure GitHub Pages deployment (AC: #5)
  - [x] 7.1: Create `.github/workflows/docs.yml` workflow that builds VitePress and deploys to GitHub Pages on push to main
  - [x] 7.2: Configure VitePress `base` path for GitHub Pages (`/buildpact/` if using project pages)
  - [x] 7.3: Add build verification step that ensures both EN and PT-BR locales build without errors

- [x] Task 8: Verify full acceptance criteria (AC: #1, #2, #3, #4, #5)
  - [x] 8.1: Run `npm run docs:build` and verify zero errors
  - [x] 8.2: Verify language switcher toggles between EN and PT-BR on all pages
  - [x] 8.3: Walk through Quick Start tutorial end-to-end and verify accuracy
  - [x] 8.4: Verify every CLI command listed in registry.ts has a corresponding docs page
  - [x] 8.5: Verify GitHub Actions workflow file is valid YAML and references correct paths

## Dev Notes

### Architecture Requirements

- **VitePress** is the PRD-mandated docs framework (FR-1501, architecture.md line 179, project-context.md)
- **i18n structure:** `docs/en/` and `docs/pt-br/` folder-based locales — VitePress native i18n, NOT vue-i18n or custom solution
- **Hosting:** GitHub Pages with automated deployment from main branch (FR-1501)
- **No custom CSS frameworks:** Use VitePress default theme. Minimal overrides for BuildPact branding only.

### Existing Content to Reuse

- `README.md` — comprehensive existing content covering commands, pipeline, squads, model profiles, FAQ. **Extract and restructure into docs pages, do NOT duplicate.**
- `docs/voice-dna-guide.md` — existing guide, incorporate into squad architecture docs
- `docs/prompt-mode-agent-loading-guide.md` — existing guide, incorporate into architecture docs
- `docs/architecture.mermaid` and `docs/pipeline-flow.mermaid` — existing diagrams to embed
- `docs/DECISIONS.md` — reference but don't duplicate (link to it)
- `templates/commands/*.md` — command templates contain usage info. Extract command descriptions and options.
- `locales/en.yaml` and `locales/pt-br.yaml` — existing i18n strings for CLI. Docs site has its OWN i18n (VitePress locale folders), separate from CLI i18n.

### CLI Commands to Document (from src/commands/)

Full command list from `src/commands/` directory:
adopt, audit, completion, constitution, diff, docs, doctor, execute, export-web, help, investigate, memory, migrate-to-agent, optimize, orchestrate, plan, quality, quick, specify, squad, status, upgrade, verify

Each command's handler is in `src/commands/{name}/index.ts` or `src/commands/{name}/handler.ts`. The registry is `src/commands/registry.ts`.

### Critical Anti-Patterns to Avoid

- **Do NOT create a separate VitePress project/repo.** The docs live inside the BuildPact repo at `docs/`.
- **Do NOT use `docs/` root for VitePress config.** VitePress config goes in `docs/.vitepress/config.ts`. The existing `docs/` files (DECISIONS.md, project-context.md, etc.) are NOT VitePress pages — they are developer reference files. Move them or colocate carefully.
- **Do NOT duplicate README.md content verbatim into docs pages.** Extract, restructure, and expand for docs format.
- **Do NOT use a markdown-to-docs generator.** Write docs content directly for VitePress.
- **Do NOT install vue, vite, or other VitePress internals as explicit dependencies.** VitePress bundles its own vue/vite. Only `vitepress` is needed as devDependency.
- **Do NOT add VitePress output (`docs/.vitepress/dist/`) to git.** Add to `.gitignore`.

### VitePress i18n Pattern

VitePress uses folder-based i18n:
```
docs/
├── .vitepress/
│   └── config.ts          # i18n config, sidebar, nav
├── en/
│   ├── index.md           # EN homepage
│   ├── guide/
│   │   └── quick-start.md
│   ├── cli/
│   │   ├── quick.md
│   │   └── ...
│   └── architecture/
│       └── overview.md
└── pt-br/
    ├── index.md           # PT-BR homepage
    ├── guide/
    │   └── quick-start.md
    └── ...
```

In `config.ts`:
```ts
export default defineConfig({
  locales: {
    en: { label: 'English', lang: 'en' },
    'pt-br': { label: 'Português (BR)', lang: 'pt-BR' }
  }
})
```

### Existing docs/ Directory Conflict

The `docs/` directory already contains non-VitePress files:
- `DECISIONS.md`, `STATUS.md`, `project-context.md` — developer reference files
- `voice-dna-guide.md`, `prompt-mode-agent-loading-guide.md` — guides
- `prd/` — PRD documents
- `decisions/` — ADR files
- `community/` — community docs

**Strategy:** Used `srcExclude` in VitePress config to exclude non-docs files. VitePress processes only `docs/en/`, `docs/pt-br/`, and `docs/.vitepress/`. Added `docs/.vitepress/dist/` and `docs/.vitepress/cache/` to `.gitignore`.

### Package.json Scripts to Add

```json
{
  "docs:dev": "vitepress dev docs",
  "docs:build": "vitepress build docs",
  "docs:preview": "vitepress preview docs"
}
```

### Testing Standards

- No unit tests needed for pure markdown content
- Verify `docs:build` succeeds with zero errors (build test)
- Verify all internal links resolve (VitePress reports broken links at build time)
- Verify both locales build completely
- GitHub Actions workflow YAML must be valid

### Project Structure Notes

- VitePress docs live at `docs/` in the repo root (architecture.md line 262)
- Docs deployment is via GitHub Pages (architecture.md line 502)
- The existing `docs/` files (DECISIONS.md, project-context.md, etc.) are developer-facing references, NOT part of the VitePress site
- VitePress config and build artifacts go in `docs/.vitepress/`
- The npm package does NOT include docs site files (package.json `files` field: dist, templates, locales)

### References

- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-1501] — Documentation site requirements
- [Source: docs/prd/buildpact-prd-v2.3.0.md#FR-1502] — Squad creation guide (Story 18.2, not this story)
- [Source: _bmad-output/planning-artifacts/architecture.md#line-262] — VitePress docs directory placement
- [Source: _bmad-output/planning-artifacts/architecture.md#line-179] — VitePress version (latest)
- [Source: _bmad-output/planning-artifacts/architecture.md#line-502] — GitHub Pages hosting decision
- [Source: docs/project-context.md#Technology-Stack] — VitePress (PT-BR + EN) for docs
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-18] — NFRs: NFR-14 (attribution), NFR-17 (contribution architecture), NFR-20 (ADRs)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- VitePress 1.6.4 installed as devDependency
- Full i18n config with EN (default) and PT-BR locales in docs/.vitepress/config.ts
- srcExclude configured to skip non-docs files (decisions/, prd/, DECISIONS.md, etc.)
- 32 EN pages: homepage, 3 guide pages, 23 CLI reference pages, 3 architecture pages, 1 FAQ page, 1 CLI index
- 32 PT-BR pages: exact parity with EN, native-quality Brazilian Portuguese translations
- GitHub Actions workflow at .github/workflows/docs.yml for automated deployment to GitHub Pages
- VitePress base path set to /buildpact/ for GitHub project pages
- .gitignore updated with docs/.vitepress/dist/ and docs/.vitepress/cache/
- docs:dev, docs:build, docs:preview scripts added to package.json
- Build passes with zero errors and zero dead links
- All CLI commands from src/commands/ documented (except migrate-to-agent which is v2.0 deferred)
- Pre-existing test failures (62 in E2E/integration) are unrelated to docs changes — caused by guardConstitutionModification function issue

### File List

- docs/.vitepress/config.ts (new)
- docs/en/index.md (new)
- docs/en/guide/quick-start.md (new)
- docs/en/guide/installation.md (new)
- docs/en/guide/pipeline.md (new)
- docs/en/cli/index.md (new)
- docs/en/cli/quick.md (new)
- docs/en/cli/specify.md (new)
- docs/en/cli/plan.md (new)
- docs/en/cli/execute.md (new)
- docs/en/cli/verify.md (new)
- docs/en/cli/orchestrate.md (new)
- docs/en/cli/init.md (new)
- docs/en/cli/adopt.md (new)
- docs/en/cli/doctor.md (new)
- docs/en/cli/upgrade.md (new)
- docs/en/cli/constitution.md (new)
- docs/en/cli/squad.md (new)
- docs/en/cli/memory.md (new)
- docs/en/cli/status.md (new)
- docs/en/cli/export-web.md (new)
- docs/en/cli/optimize.md (new)
- docs/en/cli/quality.md (new)
- docs/en/cli/docs.md (new)
- docs/en/cli/investigate.md (new)
- docs/en/cli/audit.md (new)
- docs/en/cli/diff.md (new)
- docs/en/cli/completion.md (new)
- docs/en/cli/help.md (new)
- docs/en/architecture/overview.md (new)
- docs/en/architecture/pipeline.md (new)
- docs/en/architecture/squads.md (new)
- docs/en/faq.md (new)
- docs/pt-br/index.md (new)
- docs/pt-br/guide/quick-start.md (new)
- docs/pt-br/guide/installation.md (new)
- docs/pt-br/guide/pipeline.md (new)
- docs/pt-br/cli/index.md (new)
- docs/pt-br/cli/quick.md (new)
- docs/pt-br/cli/specify.md (new)
- docs/pt-br/cli/plan.md (new)
- docs/pt-br/cli/execute.md (new)
- docs/pt-br/cli/verify.md (new)
- docs/pt-br/cli/orchestrate.md (new)
- docs/pt-br/cli/init.md (new)
- docs/pt-br/cli/adopt.md (new)
- docs/pt-br/cli/doctor.md (new)
- docs/pt-br/cli/upgrade.md (new)
- docs/pt-br/cli/constitution.md (new)
- docs/pt-br/cli/squad.md (new)
- docs/pt-br/cli/memory.md (new)
- docs/pt-br/cli/status.md (new)
- docs/pt-br/cli/export-web.md (new)
- docs/pt-br/cli/optimize.md (new)
- docs/pt-br/cli/quality.md (new)
- docs/pt-br/cli/docs.md (new)
- docs/pt-br/cli/investigate.md (new)
- docs/pt-br/cli/audit.md (new)
- docs/pt-br/cli/diff.md (new)
- docs/pt-br/cli/completion.md (new)
- docs/pt-br/cli/help.md (new)
- docs/pt-br/architecture/overview.md (new)
- docs/pt-br/architecture/pipeline.md (new)
- docs/pt-br/architecture/squads.md (new)
- docs/pt-br/faq.md (new)
- .github/workflows/docs.yml (new)
- package.json (modified — added docs scripts, vitepress devDependency)
- .gitignore (modified — added docs/.vitepress/dist/ and cache/)

### Change Log

- Story created by create-story workflow (Date: 2026-03-22)
- Implementation completed: VitePress docs site with 64 pages (32 EN + 32 PT-BR), GitHub Pages deployment workflow (Date: 2026-03-22)
