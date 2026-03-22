# Codebase Structure

**Analysis Date:** 2026-03-22

## Directory Layout

```
buildpact/
├── src/                        # All TypeScript source code
│   ├── cli/                    # Binary entry point only
│   │   └── index.ts            # main() — routes to commands or installer
│   ├── commands/               # One directory per CLI command
│   │   ├── registry.ts         # Lazy-loading command registry
│   │   ├── specify/            # buildpact specify
│   │   ├── plan/               # buildpact plan (+ researcher, tagger, types, progress)
│   │   ├── execute/            # buildpact execute
│   │   ├── verify/             # buildpact verify
│   │   ├── quick/              # buildpact quick (+ discuss-flow, plan-verifier)
│   │   ├── constitution/       # buildpact constitution
│   │   ├── squad/              # buildpact squad
│   │   ├── doctor/             # buildpact doctor
│   │   ├── memory/             # buildpact memory
│   │   ├── export-web/         # buildpact export-web
│   │   ├── status/             # buildpact status
│   │   ├── diff/               # buildpact diff
│   │   ├── completion/         # buildpact completion (shell completions)
│   │   ├── adopt/              # buildpact adopt
│   │   ├── audit/              # buildpact audit
│   │   ├── docs/               # buildpact docs
│   │   ├── help/               # buildpact help
│   │   ├── investigate/        # buildpact investigate
│   │   ├── migrate-to-agent/   # buildpact migrate-to-agent
│   │   ├── optimize/           # buildpact optimize
│   │   ├── orchestrate/        # buildpact orchestrate
│   │   ├── quality/            # buildpact quality
│   │   └── upgrade/            # buildpact upgrade
│   ├── contracts/              # Shared types only — no logic
│   │   ├── index.ts            # Barrel — external code imports only from here
│   │   ├── errors.ts           # Result<T>, CliError, ok(), err(), ERROR_CODES
│   │   ├── task.ts             # TaskDispatchPayload, TaskResult
│   │   ├── squad.ts            # SquadManifest, AgentDefinition, VoiceDna
│   │   ├── profile.ts          # ModelProfile, FailoverChain
│   │   ├── budget.ts           # BudgetConfig, BudgetGuardResult
│   │   ├── i18n.ts             # I18nResolver, SupportedLanguage
│   │   ├── provider.ts         # SubagentProvider interface
│   │   └── cross-squad.ts      # CrossSquadMessage, HandoffPayload, RoutingRule
│   ├── engine/                 # Execution engine — subagents, waves, constitution
│   │   ├── index.ts            # Engine public API barrel
│   │   ├── orchestrator.ts     # Template loader + constitution enforcement
│   │   ├── wave-executor.ts    # Wave/task parallel execution + plan parsing
│   │   ├── subagent.ts         # TaskDispatchPayload builder + size validator
│   │   ├── budget-guard.ts     # Cost limit checks (session/phase/day)
│   │   ├── cost-projector.ts   # Pre-execution cost estimation
│   │   ├── progress-renderer.ts # TUI wave progress display
│   │   ├── result-validator.ts # Task output validation
│   │   ├── recovery.ts         # Crash recovery and retry strategies
│   │   ├── atomic-commit.ts    # One git commit per completed task
│   │   ├── session-feedback.ts # Tier-1 memory: session feedback FIFO
│   │   ├── lessons-distiller.ts# Tier-2 memory: pattern distillation
│   │   ├── decisions-log.ts    # Tier-3 memory: architectural decisions
│   │   ├── lazy-agent-loader.ts# Agent index + on-demand agent loading
│   │   ├── community-hub.ts    # Squad registry download + manifest fetch
│   │   ├── concurrency.ts      # Limiter + timeout utilities
│   │   ├── constitution-enforcer.ts  # Re-exports from foundation/constitution
│   │   ├── constitution-versioner.ts # Constitution diff and change tracking
│   │   ├── constitution-conflict-detector.ts # Principle conflict detection
│   │   ├── plan-validator.ts   # Plan Markdown structural validation
│   │   ├── wave-verifier.ts    # Goal-backward wave ACS verification
│   │   ├── squad-scaffolder.ts # Squad directory generation
│   │   ├── squad-smoke-test.ts # Agent behavioral smoke tests
│   │   ├── squad-lock.ts       # Squad version pinning
│   │   ├── model-profile-manager.ts # Profile YAML parsing + tier resolution
│   │   ├── scale-router.ts     # Route tasks to appropriate model tier
│   │   ├── autonomy-manager.ts # Agent autonomy level (L1–L4) enforcement
│   │   ├── readiness-gate.ts   # Pre-execution project readiness check
│   │   ├── output-versioning.ts# Versioned artifact output management
│   │   ├── execution-config.ts # Execution mode config resolution
│   │   ├── execution-lock.ts   # Prevent concurrent execution
│   │   ├── dashboard-state.ts  # Status dashboard state builder
│   │   ├── best-practices.ts   # Domain best-practice injection
│   │   ├── conclave.ts         # Multi-agent deliberation protocol
│   │   ├── agent-namer.ts      # Agent display name formatting
│   │   ├── types.ts            # TaskNode, WaveGroup, PlanFile
│   │   └── providers/          # Provider implementations
│   │       ├── index.ts        # resolveProvider() factory
│   │       ├── anthropic.ts    # AnthropicProvider (real @anthropic-ai/sdk)
│   │       └── stub.ts         # StubProvider (Alpha no-op)
│   ├── foundation/             # Project-level filesystem services
│   │   ├── index.ts            # Foundation public API barrel
│   │   ├── constitution.ts     # Read/write/enforce .buildpact/constitution.md
│   │   ├── installer.ts        # Scaffold project from templates/
│   │   ├── audit.ts            # AuditLogger — append-only JSON Lines
│   │   ├── i18n.ts             # createI18n() — YAML locale loader
│   │   ├── version-guard.ts    # Schema version compatibility check
│   │   ├── migrator.ts         # Schema migration runner
│   │   ├── scanner.ts          # Project artifact scanner
│   │   ├── bundle.ts           # Token budget + context assembly
│   │   ├── profile.ts          # Model profile loader + failover executor
│   │   ├── sharding.ts         # Document sharding for large files
│   │   ├── context.ts          # Experience level reader from config
│   │   ├── adopter.ts          # Adopt existing project into BuildPact
│   │   ├── diagnostician.ts    # Project health diagnostics
│   │   ├── monitor.ts          # Context window usage monitoring
│   │   ├── performance-mode.ts # Performance mode config (fast/balanced/quality)
│   │   └── decisions.ts        # Decision log append helper
│   └── squads/                 # Squad lifecycle management
│       ├── index.ts            # Squads public API barrel
│       ├── loader.ts           # squad.yaml manifest parser + agent index
│       ├── validator.ts        # Squad structural validation
│       ├── leveling.ts         # Automation level (L1–L4) system
│       └── web-bundle.ts       # Export squad as web-consumable bundle
├── templates/                  # Bundled project templates (shipped in npm package)
│   ├── config.yaml             # Default project configuration template
│   ├── constitution.md         # Default constitution template
│   ├── project-context.md      # Project context template
│   ├── STATUS.md               # Sprint status template
│   ├── DECISIONS.md            # Decisions log template
│   ├── commands/               # Markdown orchestrator files (one per command)
│   │   ├── specify.md
│   │   ├── plan.md
│   │   ├── execute.md
│   │   ├── verify.md
│   │   ├── quick.md
│   │   └── ...
│   ├── squads/                 # Reference squad implementations
│   │   ├── software/           # Software squad (reference implementation)
│   │   │   ├── squad.yaml
│   │   │   ├── agents/         # pm.md, architect.md, developer.md, qa.md, tech-writer.md, pact.md
│   │   │   ├── hooks/
│   │   │   └── templates/
│   │   ├── medical-marketing/
│   │   ├── scientific-research/
│   │   ├── clinic-management/
│   │   └── agent-builder/
│   ├── profiles/               # Model profile YAML templates
│   └── best-practices/         # Domain best-practice Markdown files
├── locales/                    # i18n locale files (shipped in npm package)
│   ├── en.yaml
│   └── pt-br.yaml
├── test/                       # All tests
│   ├── unit/                   # Unit tests (mirror src/ structure)
│   │   ├── commands/
│   │   ├── engine/
│   │   │   └── providers/
│   │   ├── foundation/
│   │   ├── contracts/
│   │   ├── squads/
│   │   └── optimize/
│   ├── integration/            # Integration tests (pipeline flows)
│   │   └── pipeline/
│   ├── e2e/                    # End-to-end tests
│   │   ├── pipeline/
│   │   └── personas/
│   ├── fixtures/               # Static test data
│   │   ├── projects/minimal/   # Minimal .buildpact project fixture
│   │   └── squads/software/
│   └── snapshots/              # Snapshot files for quick/specify flows
│       ├── quick/
│       └── specify/
├── dist/                       # Compiled output (gitignored, generated by tsdown)
├── .buildpact/                 # Project's own BuildPact config
│   └── audit/                  # CLI audit log
├── docs/                       # Architecture diagrams
│   ├── architecture.mermaid
│   └── pipeline-flow.mermaid
├── package.json
├── tsconfig.json
└── vitest.config.ts (or equivalent)
```

## Directory Purposes

**`src/cli/`:**
- Purpose: Single-file entry point — zero business logic allowed (enforced by comment in source)
- Contains: `index.ts` only
- Key files: `src/cli/index.ts`

**`src/commands/`:**
- Purpose: One directory per CLI command, each self-contained
- Contains: `index.ts` (exports `handler: CommandHandler`), `handler.ts` (implements `run(args)`), optional sub-modules
- Key files: `src/commands/registry.ts` (lazy registry), `src/commands/plan/handler.ts`, `src/commands/execute/handler.ts`

**`src/contracts/`:**
- Purpose: Shared interfaces and types — the only layer with no dependencies on other src/ modules
- Contains: Type definitions and the Result monad utilities
- Key files: `src/contracts/errors.ts`, `src/contracts/task.ts`, `src/contracts/squad.ts`, `src/contracts/index.ts`

**`src/engine/`:**
- Purpose: All execution intelligence — never called directly by CLI, only by command handlers
- Contains: Wave execution, constitution enforcement, budget guards, memory layers, provider abstraction
- Key files: `src/engine/wave-executor.ts`, `src/engine/subagent.ts`, `src/engine/orchestrator.ts`, `src/engine/providers/index.ts`

**`src/foundation/`:**
- Purpose: Project filesystem services — reads/writes `.buildpact/` files, manages templates, locale loading
- Contains: Stateless utility modules — each function is independently importable
- Key files: `src/foundation/constitution.ts`, `src/foundation/installer.ts`, `src/foundation/audit.ts`, `src/foundation/i18n.ts`

**`src/squads/`:**
- Purpose: Squad manifest parsing, validation, leveling, and web-bundle generation
- Contains: Thin utilities over `src/contracts/squad.ts` types
- Key files: `src/squads/loader.ts`, `src/squads/validator.ts`, `src/squads/leveling.ts`

**`templates/`:**
- Purpose: Files shipped with the npm package, copied to user projects during `buildpact init`
- Contains: Markdown orchestrator commands, squad definitions, config templates, locale-aware constitution
- Key files: `templates/config.yaml`, `templates/constitution.md`, `templates/squads/software/squad.yaml`

**`locales/`:**
- Purpose: i18n string tables — flat YAML with dot-notation keys
- Contains: `en.yaml`, `pt-br.yaml`
- Shipped: Yes — listed in `package.json` `files`

**`test/`:**
- Purpose: All automated tests — mirrors `src/` structure
- Contains: Unit, integration, e2e, fixtures, and snapshot tests

## Key File Locations

**Entry Points:**
- `src/cli/index.ts`: Binary entry point (compiled to `dist/index.mjs`)
- `src/commands/registry.ts`: Command lookup table and `CommandHandler` interface

**Configuration:**
- `package.json`: `"bin"`, `"files"`, `"engines"`, dependencies
- `templates/config.yaml`: Default `.buildpact/config.yaml` installed into user projects

**Core Logic:**
- `src/engine/wave-executor.ts`: Wave parallel execution, plan file parsing (`parseWaveTasksFromPlanFile`, `executeWave`, `executeWaves`)
- `src/engine/subagent.ts`: Task payload assembly and size validation (`buildTaskPayload`, `validatePayloadSize`)
- `src/foundation/constitution.ts`: Constitution load/save/enforce (`loadConstitution`, `enforceConstitution`, `parseConstitutionPrinciples`)
- `src/contracts/errors.ts`: Result monad (`Result<T>`, `ok()`, `err()`, `ERROR_CODES`)

**Testing:**
- `test/unit/`: Unit tests mirroring `src/` module structure
- `test/integration/pipeline/`: Multi-step pipeline integration tests
- `test/fixtures/projects/minimal/`: Reusable minimal project fixture
- `test/snapshots/`: Snapshot files for regression testing

## Naming Conventions

**Files:**
- `kebab-case.ts` for all source files: `wave-executor.ts`, `budget-guard.ts`, `constitution-enforcer.ts`
- Command directories mirror the CLI command name: `export-web/`, `migrate-to-agent/`
- Test files match the module they test: `wave-executor.ts` → `test/unit/engine/wave-executor.ts` (implied; named descriptively in practice)

**Directories:**
- `kebab-case` for all directories: `src/commands/export-web/`, `src/engine/providers/`

**TypeScript:**
- Interfaces: `PascalCase` — `TaskDispatchPayload`, `WaveTask`, `SquadManifest`
- Type aliases: `PascalCase` — `AutomationLevel`, `SupportedLanguage`, `CommandId`
- Functions: `camelCase` — `buildTaskPayload()`, `executeWave()`, `resolveCommand()`
- Constants: `SCREAMING_SNAKE_CASE` — `ERROR_CODES`, `MAX_PAYLOAD_BYTES`, `PROHIBITION_KEYWORDS`
- Enums/literal union members: `'lowercase-kebab'` for IDs — `'claude-code'`, `'pt-br'`, `'L1'`

## Where to Add New Code

**New CLI Command:**
- Create directory: `src/commands/<command-name>/`
- Implement: `src/commands/<command-name>/handler.ts` (exports class/object implementing `CommandHandler`)
- Expose: `src/commands/<command-name>/index.ts` (re-exports `handler`)
- Register: Add entry to `REGISTRY` in `src/commands/registry.ts`
- Add command template: `templates/commands/<command-name>.md`
- Tests: `test/unit/commands/<command-name>.test.ts`

**New Engine Utility:**
- Implement: `src/engine/<utility-name>.ts`
- Export: Add to `src/engine/index.ts`
- Tests: `test/unit/engine/<utility-name>.test.ts`

**New Foundation Service:**
- Implement: `src/foundation/<service-name>.ts`
- Export: Add to `src/foundation/index.ts`
- Tests: `test/unit/foundation/<service-name>.test.ts`

**New Contract Type:**
- Add to the most specific `src/contracts/<domain>.ts` file
- Re-export from `src/contracts/index.ts` (types only — no logic)

**New Squad Template:**
- Create: `templates/squads/<squad-name>/squad.yaml`
- Add agents: `templates/squads/<squad-name>/agents/<agent-name>.md`
- Register squad for download: entry in community hub registry

**New i18n String:**
- Add key to both `locales/en.yaml` and `locales/pt-br.yaml` simultaneously
- Use dot-notation: `cli.<command>.<context>.<key>`

**Utilities (shared helpers):**
- If reusable across commands and engine: `src/foundation/`
- If execution-specific: `src/engine/`
- Do not add shared logic to `src/contracts/` — types only

## Special Directories

**`.buildpact/`:**
- Purpose: Project runtime state written by the CLI during operation
- Contains: `audit/`, `plans/`, `specs/`, `config.yaml`, `constitution.md`, `budget/`, `memory/`
- Generated: Yes — created by `buildpact init`
- Committed: Partially — `config.yaml`, `constitution.md`, `plans/`, `specs/` should be committed; `audit/` optional

**`dist/`:**
- Purpose: Compiled output from `tsdown` build
- Generated: Yes — via `npm run build`
- Committed: No — in `.gitignore`

**`templates/`:**
- Purpose: Static files shipped inside the npm package
- Generated: No — hand-authored
- Committed: Yes — listed in `package.json` `files`

**`_bmad/` and `_bmad-output/`:**
- Purpose: BMAD framework files used for BuildPact's own product development planning
- Generated: BMAD-managed
- Committed: Yes — part of the project meta-process

---

*Structure analysis: 2026-03-22*
