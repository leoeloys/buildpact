# CLAUDE.md — BuildPact

Spec-Driven Development framework — bilingual CLI (EN/PT-BR) for developers and domain experts.

See `.buildpact/constitution.md` for immutable project rules.

## Quick Reference

```bash
npm run build          # Build with tsdown → dist/
npm run dev            # Watch mode (tsdown --watch)
npm run test           # Run all tests (vitest)
npm run test -- --run src/engine  # Run tests for a specific module
npm run lint           # Type-check only (tsc --noEmit)
npm run docs:dev       # Local docs server (vitepress)
npm run benchmark      # Run benchmarks (requires build first)
```

## Tech Stack

- **Language**: TypeScript (strict mode, ES2022, NodeNext modules)
- **Runtime**: Node.js >= 20
- **Bundler**: tsdown → `dist/`
- **Tests**: vitest (unit in `test/unit/`, integration in `test/integration/`, e2e in `test/e2e/`)
- **Docs**: VitePress (`docs/`)
- **Dependencies**: `@anthropic-ai/sdk`, `@clack/prompts`
- **CI**: GitHub Actions (gates: build, test)

## Architecture

```
src/
├── cli/          # Entry point (dist/cli/index.mjs) — zero business logic, delegates to commands
├── commands/     # One directory per CLI command (adopt, plan, execute, verify, squad, etc.)
├── engine/       # Core pipeline: orchestrator, wave executor, subagent isolation, budget guard
├── foundation/   # Shared infra: config, i18n, audit, installer, diagnostics, scanner
├── contracts/    # Type contracts: errors, tasks, squads, budgets, profiles, i18n
├── squads/       # Squad definitions, validation, and web bundling
├── optimize/     # Domain metrics, experiment loop, optimization ratchet
├── data/         # Static data: compression rules, elicitation methods
└── benchmark/    # Performance benchmarks
```

Key patterns:
- **Orchestrator → Subagent isolation**: heavy computation dispatched via `engine/` with mandatory session reset
- **Wave execution**: tasks run in parallel waves with concurrency limits
- **Constitution enforcement**: rules in `.buildpact/constitution.md` are enforced at runtime
- **Bilingual**: all user-facing strings go through `foundation/i18n.ts`, locales in `locales/`

## Conventions

- ESM only (`"type": "module"`, use `.js` extensions in imports)
- Strict TypeScript: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` enabled
- No default exports — use named exports
- Tests mirror `src/` structure under `test/unit/` and `test/integration/`
- Atomic commits — one commit per completed task
- Spec before code — no implementation without a reviewed specification

## BuildPact Slash Commands

Available as `/bp:<command>`:

| Command | Purpose |
|---------|---------|
| `specify` | Generate specifications from requirements |
| `plan` | Create execution plans from specs |
| `execute` | Run planned tasks with wave parallelization |
| `verify` | Validate built features against specs |
| `quick` | Fast-track simple tasks (specify→plan→execute→verify) |
| `diagnose` | Debug pipeline issues |
| `investigate` | Deep-dive analysis of problems |
| `doctor` | Health check for project setup |
| `constitution` | View/edit project constitution |
| `squad` | Manage agent squads |
| `optimize` | Performance optimization loop |
| `docs` | Generate/manage documentation |
| `distill` | Extract lessons learned |
| `export-web` | Export project for web viewing |
| `memory` | Manage project memory |
| `upgrade` | Upgrade BuildPact version |
| `quality` | Run quality gates |
| `map` | Generate per-directory MAP.md overviews |
| `orchestrate` | Multi-command orchestration |
| `help` | Show available commands |
