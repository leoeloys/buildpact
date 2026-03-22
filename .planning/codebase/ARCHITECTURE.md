# Architecture

**Analysis Date:** 2026-03-22

## Pattern Overview

**Overall:** Layered CLI with Command/Handler separation, Result monad error handling, and wave-based parallel execution engine.

**Key Characteristics:**
- Business logic never throws — all fallible functions return `Result<T, CliError>` from `src/contracts/errors.ts`
- Commands are lazy-loaded via a registry (`src/commands/registry.ts`), costing zero boot time for unresolved commands
- The engine layer dispatches isolated subagent payloads (TaskDispatchPayload ≤ 20KB) rather than calling AI directly from command handlers
- Constitution enforcement is cross-cutting: every pipeline output is validated against `.buildpact/constitution.md` before being accepted
- i18n is built in at the foundation layer — all user-facing strings go through `src/foundation/i18n.ts` with `locales/en.yaml` and `locales/pt-br.yaml`

## Layers

**CLI Entry Point:**
- Purpose: Argument parsing, version guard, audit logging init, and delegation to commands or the installer
- Location: `src/cli/index.ts`
- Contains: `main()` function, Node.js version check, install flow (`runInstallFlow`)
- Depends on: `src/commands/registry.ts`, `src/foundation/installer.ts`, `src/foundation/audit.ts`, `src/foundation/version-guard.ts`
- Used by: Node.js binary (`dist/index.mjs` via `bin.buildpact` in `package.json`)

**Contracts:**
- Purpose: Shared type definitions and the Result monad — the lingua franca of all layers
- Location: `src/contracts/`
- Contains: `errors.ts` (Result type, CliError, ERROR_CODES), `task.ts` (TaskDispatchPayload, TaskResult), `squad.ts` (SquadManifest, AgentDefinition), `profile.ts`, `budget.ts`, `i18n.ts`, `provider.ts`, `cross-squad.ts`
- Depends on: Nothing — pure types only
- Used by: All other layers import from `src/contracts/index.ts`

**Foundation:**
- Purpose: Filesystem utilities, i18n, installation, audit logging, and project-level services that do not orchestrate execution
- Location: `src/foundation/`
- Contains: `constitution.ts`, `installer.ts`, `audit.ts`, `i18n.ts`, `version-guard.ts`, `migrator.ts`, `scanner.ts`, `bundle.ts`, `profile.ts`, `sharding.ts`, `context.ts`, `adopter.ts`, `diagnostician.ts`, `monitor.ts`, `performance-mode.ts`, `decisions.ts`
- Depends on: `src/contracts/`
- Used by: Engine layer, Command handlers

**Engine:**
- Purpose: Subagent isolation, wave orchestration, constitution enforcement, budget guarding, cost projection, and provider abstraction
- Location: `src/engine/`
- Contains: `orchestrator.ts`, `wave-executor.ts`, `subagent.ts`, `budget-guard.ts`, `cost-projector.ts`, `progress-renderer.ts`, `result-validator.ts`, `recovery.ts`, `atomic-commit.ts`, `session-feedback.ts`, `lessons-distiller.ts`, `decisions-log.ts`, `lazy-agent-loader.ts`, `community-hub.ts`, `concurrency.ts`, `constitution-enforcer.ts`, `constitution-versioner.ts`, `plan-validator.ts`, `wave-verifier.ts`, `providers/`
- Depends on: `src/contracts/`, `src/foundation/`
- Used by: Command handlers

**Commands:**
- Purpose: One directory per CLI command — each has an `index.ts` (exports `handler`) and a `handler.ts` (implements `CommandHandler.run(args)`)
- Location: `src/commands/<command-name>/`
- Contains: `specify/`, `plan/`, `execute/`, `verify/`, `quick/`, `constitution/`, `squad/`, `doctor/`, `memory/`, `export-web/`, `status/`, `diff/`, `completion/`, `adopt/`, `audit/`, `docs/`, `help/`, `investigate/`, `migrate-to-agent/`, `optimize/`, `orchestrate/`, `quality/`, `upgrade/`
- Depends on: `src/contracts/`, `src/foundation/`, `src/engine/`
- Used by: `src/commands/registry.ts`

**Squads:**
- Purpose: Squad manifest loading, validation, leveling system, and web-bundle generation
- Location: `src/squads/`
- Contains: `loader.ts`, `validator.ts`, `leveling.ts`, `web-bundle.ts`, `index.ts`
- Depends on: `src/contracts/squad.ts`
- Used by: Command handlers (squad, execute, plan)

**Provider Abstraction:**
- Purpose: Resolve the correct AI provider (Anthropic or Stub) based on environment
- Location: `src/engine/providers/`
- Contains: `anthropic.ts` (real Anthropic SDK calls), `stub.ts` (Alpha no-op), `index.ts` (factory via `resolveProvider()`)
- Depends on: `@anthropic-ai/sdk`, `src/contracts/provider.ts`, `src/engine/model-profile-manager.ts`
- Used by: Command handlers that dispatch tasks

## Data Flow

**Spec-Plan-Execute Pipeline:**

1. User invokes `buildpact specify` → `src/cli/index.ts` routes to `src/commands/specify/handler.ts`
2. Handler collects natural language input via `@clack/prompts` interactive prompts
3. Handler calls `buildTaskPayload()` in `src/engine/subagent.ts` to assemble a ≤20KB `TaskDispatchPayload`
4. Constitution enforcement: output checked against `.buildpact/constitution.md` via `enforceConstitutionOnOutput()` in `src/engine/orchestrator.ts`
5. Spec written to `.buildpact/specs/<slug>.md`
6. User invokes `buildpact plan` → `src/commands/plan/handler.ts`
7. Parallel research agents spawned via `spawnResearchAgents()` in `src/commands/plan/researcher.ts`
8. Tasks extracted, dependency-analyzed, and split into waves via `analyzeWaves()` / `splitIntoPlanFiles()` in `src/engine/wave-executor.ts`
9. Wave plan files written to `.buildpact/plans/<slug>/wave-N-plan-M.md`
10. User invokes `buildpact execute` → `src/commands/execute/handler.ts`
11. Handler reads wave files, calls `parseWaveTasksFromPlanFile()` and dispatches via `executeWave()` / `executeWaves()` in `src/engine/wave-executor.ts`
12. Budget guard checks run before each wave: `checkBudget()` in `src/engine/budget-guard.ts`
13. Each wave task gets an isolated `TaskDispatchPayload` — subagents receive ONLY plan content + task context
14. Results validated by `validateTaskResult()` in `src/engine/result-validator.ts`; failed tasks retry per `maxRetries`
15. Atomic commit created per task via `runAtomicCommit()` in `src/engine/atomic-commit.ts`
16. Audit entry appended to `.buildpact/audit/cli.jsonl` at every step

**State Management:**
- No in-memory global state — all state is written to `.buildpact/` on disk between commands
- Audit log at `.buildpact/audit/cli.jsonl` (append-only JSON Lines)
- Constitution at `.buildpact/constitution.md`
- Plans at `.buildpact/plans/<slug>/`
- Specs at `.buildpact/specs/`
- Budget spend tracked at `.buildpact/budget/daily-<date>.json`
- Session feedback at `.buildpact/memory/feedback.json`
- Lessons at `.buildpact/memory/lessons.json`
- Decisions at `.buildpact/memory/decisions.json`

## Key Abstractions

**Result Monad:**
- Purpose: Eliminates thrown errors from business logic — every fallible function returns `Result<T, CliError>`
- Examples: `src/contracts/errors.ts` (`ok()`, `err()`, `Result<T>` type)
- Pattern: Callers check `.ok` before accessing `.value` or `.error.code`

**CommandHandler Interface:**
- Purpose: Uniform contract for all CLI commands — one `run(args: string[])` method returning `Result<void>`
- Examples: `src/commands/registry.ts` (`CommandHandler` interface), every `handler.ts` in `src/commands/*/`
- Pattern: Lazy-loaded via `CommandFactory` in `REGISTRY` map; never imported eagerly

**TaskDispatchPayload:**
- Purpose: The only data structure a subagent sees — enforces context isolation (≤20KB limit via `validatePayloadSize()`)
- Examples: `src/contracts/task.ts`, `src/engine/subagent.ts`
- Pattern: Built by `buildTaskPayload()`, serialized by `serializePayload()`, validated before dispatch

**SubagentProvider:**
- Purpose: Abstraction over AI provider — `AnthropicProvider` or `StubProvider`
- Examples: `src/contracts/provider.ts`, `src/engine/providers/index.ts`
- Pattern: Resolved by `resolveProvider(projectDir)` which checks `ANTHROPIC_API_KEY` env var

**SquadManifest:**
- Purpose: Describes a multi-agent squad — agents, hooks, automation level, domain type
- Examples: `src/contracts/squad.ts`, loaded via `src/squads/loader.ts`
- Pattern: Agents defined as file references in `squad.yaml`; loaded on-demand (lazy agent loading)

**WaveTask / WaveExecutionResult:**
- Purpose: Represents a unit of parallel execution within a single wave
- Examples: `src/engine/wave-executor.ts` (`WaveTask`, `executeWave()`, `executeWaves()`)
- Pattern: Waves run sequentially; tasks within a wave run in parallel; each task gets isolated context

## Entry Points

**Binary Entry Point:**
- Location: `src/cli/index.ts` (compiled to `dist/index.mjs`)
- Triggers: `buildpact <command> [args]` or `buildpact init <project-name>`
- Responsibilities: Argument dispatch, Node.js version check, version guard, audit init, command resolution

**Command Registry:**
- Location: `src/commands/registry.ts`
- Triggers: Called by `src/cli/index.ts` via `resolveCommand(command)`
- Responsibilities: Lazy-load command handlers from their module, return `CommandHandler` or error

**Installer:**
- Location: `src/foundation/installer.ts` (exported as `install()`)
- Triggers: Called by `runInstallFlow()` in `src/cli/index.ts` when `buildpact init` runs
- Responsibilities: Copy templates to project dir, scaffold `.buildpact/` structure, write IDE slash commands

**Engine Public API:**
- Location: `src/engine/index.ts`
- Triggers: Imported by command handlers
- Responsibilities: Re-exports all engine utilities — orchestrator, wave executor, budget guard, cost projector, recovery, atomic commit, session feedback, lessons distiller, decisions log, lazy agent loader, community hub

## Error Handling

**Strategy:** Railway-oriented programming — all errors are values, never exceptions.

**Patterns:**
- Business functions return `Result<T, CliError>` — never throw
- `CliError` carries `code` (SCREAMING_SNAKE_CASE), `i18nKey` (dot-notation), optional `params`, `phase` (stub phase), `cause` (original error)
- CLI entry point (`src/cli/index.ts`) unwraps Results and calls `process.exit(1)` on error
- Error codes are centralised in `ERROR_CODES` const in `src/contracts/errors.ts`
- Audit logger records every failure before the process exits

## Cross-Cutting Concerns

**Logging:** Append-only JSON Lines via `AuditLogger` in `src/foundation/audit.ts`. Written to `.buildpact/audit/<context>.jsonl`. Every command logs start and completion.

**Validation:** Constitution enforcement runs on every AI-generated output via `enforceConstitutionOnOutput()` in `src/engine/orchestrator.ts` which delegates to `enforceConstitution()` in `src/foundation/constitution.ts`.

**Authentication:** No user auth — project-level API keys via environment variables (`ANTHROPIC_API_KEY`). Provider resolved in `src/engine/providers/index.ts`.

**Internationalization:** All user-facing strings use `i18n.t('key')` from `src/foundation/i18n.ts`. Locale files at `locales/en.yaml` and `locales/pt-br.yaml`. Language is selected at install time and stored in `.buildpact/config.yaml`.

**Budget:** Cost limits enforced before every execution wave via `checkBudget()` in `src/engine/budget-guard.ts`. Limits read from `.buildpact/config.yaml`. Daily spend tracked in `.buildpact/budget/`.

---

*Architecture analysis: 2026-03-22*
