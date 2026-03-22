# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- TypeScript 5.x - All source code in `src/`

**Secondary:**
- YAML - Locale files (`locales/en.yaml`, `locales/pt-br.yaml`), config templates (`templates/config.yaml`), squad definitions (`templates/squads/*/squad.yaml`)
- Markdown - Agent definitions, command templates, constitution, project context (`templates/commands/*.md`, `templates/squads/**/*.md`)

## Runtime

**Environment:**
- Node.js >=20.0.0 (minimum enforced at runtime in `src/cli/index.ts`)
- Tested and developed on Node.js 22.19.0

**Package Manager:**
- npm 11.6.0
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None — no web framework; this is a Node.js CLI tool

**CLI UI:**
- `@clack/prompts` ^1.1.0 — Interactive TUI prompts (select, multiselect, text, confirm, spinner, note, outro). Used exclusively in `src/cli/index.ts`

**Testing:**
- `vitest` ^4.1.0 — Test runner (globals enabled, node environment)
- `@vitest/coverage-v8` ^4.1.0 — Coverage via V8 (lcov + text reporters, 70% threshold)

**Build/Dev:**
- `tsdown` ~0.20.3 — TypeScript bundler (wraps rollup); produces both ESM (`dist/index.mjs`) and CJS outputs
- `typescript` ^5.0.0 — Compilation and type checking (`tsc --noEmit` for lint)

## Key Dependencies

**Critical:**
- `@anthropic-ai/sdk` ^0.52.0 — The only production AI dependency. Dispatches tasks to Claude via the Messages API. Used in `src/engine/providers/anthropic.ts`. Auth via `ANTHROPIC_API_KEY` env var.
- `@clack/prompts` ^1.1.0 — All interactive installation UX. Removal breaks the `init` command entirely.

**Infrastructure:**
- No ORM, no database driver, no HTTP server framework, no logging library — the stack is intentionally minimal. All persistence is local filesystem (JSON Lines audit logs, YAML configs, Markdown files).

## Configuration

**Environment:**
- `ANTHROPIC_API_KEY` — Required for live AI dispatch; if absent, `StubProvider` is used automatically (no crash)
- No `.env` file present in the repo; env vars are read directly via `process.env`

**Build:**
- `tsdown.config.ts` — Entry: `src/cli/index.ts`, formats: ESM + CJS, output: `dist/`
- `tsconfig.json` — Target ES2022, `NodeNext` module resolution, strict mode + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
- `vitest.config.ts` — Coverage thresholds 70%, excludes CLI entry, contracts, and barrel files from coverage

**Project Config (per-project, generated at install):**
- `.buildpact/config.yaml` — Contains `buildpact_schema`, `project_name`, `language`, `active_squad`, `active_model_profile`, `model_profile_*` keys
- `.buildpact/constitution.md` — Project-level rules enforced by `src/engine/constitution-enforcer.ts`

## Module System

- ESM-first (`"type": "module"` in `package.json`)
- All imports use `.js` extensions (NodeNext resolution requirement)
- No path aliases configured in tsconfig

## Locale / i18n

- Two locales: `en` and `pt-br`
- YAML files parsed with a hand-rolled parser (no YAML library dependency) in `src/foundation/i18n.ts`
- Keys are dot-notation flat strings with `{param}` interpolation

## Platform Requirements

**Development:**
- Node.js >=20.0.0
- npm for dependency management
- No Docker, no containerization required

**Production:**
- Distributed as an npm package (`npx buildpact` or global install)
- Published to npm as public (`"access": "public"`)
- Binary entrypoint: `dist/index.mjs`
- Shipped files: `dist/`, `templates/`, `locales/`

---

*Stack analysis: 2026-03-22*
