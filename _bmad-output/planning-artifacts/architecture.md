---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/prd/buildpact-prd-v2.3.0.md
  - docs/prd/buildpact-prd-v2.2.0-validation-report.md
  - docs/DECISIONS.md
  - docs/STATUS.md
  - docs/project-context.md
workflowType: 'architecture'
project_name: 'BuildPact'
user_name: 'Leo'
date: '2026-03-14'
lastStep: 8
status: 'complete'
completedAt: '2026-03-14'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

> _Synthesized from PRD v2.3.0, DECISIONS.md, STATUS.md, project-context.md, and multi-agent Party Mode analysis (Winston 🏗️, John 📋, Mary 📊, Barry 🚀)._

---

### Requirements Overview

**Functional Requirements: 68 total (44 MUST · 24 SHOULD)**

| Layer | FR Series | Count | Scope |
|-------|-----------|-------|-------|
| Foundation | FR-100–300 | 13 | Install/TUI, Constitution, Context Engineering |
| Engine | FR-400–800 | 23 | Quick Flow, Specify, Plan, Execute, Verify+Learn |
| Domain (Squads) | FR-900–1100 | 15 | Squad Architecture, Pre-built Squads, Community Hub |
| Autonomous Optimization | FR-1200–1400 | 17 | AutoResearch Core, Domain Metrics, Self-Optimizing Squads |

**Non-Functional Requirements: 23 total (17 MUST · 6 SHOULD)**

Critical NFRs with direct architectural impact:

| NFR | Constraint | Architectural Impact |
|-----|-----------|----------------------|
| NFR-02 | Orchestrators ≤15% context window; payloads ≤20KB | Hard size limits on every component file |
| NFR-05 | PT-BR/EN bilingual parity — not a translation, equal quality | Conditional i18n system (see Cross-Cutting Concerns) |
| NFR-07 | Recovery: 4 failure modes handled | Recovery subsystem is a first-class architectural component |
| NFR-08 | All state in Markdown/JSON/YAML — zero databases, zero external services | File system is the database; all persistence design flows from this |
| NFR-09 | 7+ IDEs + web interfaces (Prompt Mode) | Configuration generation must be IDE-agnostic and extensible |
| NFR-12 | No hard-coded AI provider dependencies | Model calls are abstracted behind a profile interface |
| NFR-13 | MIT — no Commons Clause, no SSPL | Affects package boundary design and Squad distribution policy |
| NFR-15 | Cache-aware file structure (>80% hit rate on static content) | Static content must precede dynamic content in every file |
| NFR-23 | Audit trail for all pipeline actions | Audit logger is cross-cutting, not optional |
| NFR-25 | Consent model tied to autonomy level (L1–L4) | Security model is behavioral, not just access-control |

---

### Scale & Complexity

- **Project complexity:** HIGH — This is a developer meta-framework (framework-for-building-frameworks), not an application.
- **Primary technical domain:** CLI framework / developer tooling
- **Complexity level:** High
- **Estimated architectural subsystems:** ~18 discrete components
- **Alpha-critical subsystems (8):** CLI Installer, Constitution System, Context Manager, Pipeline Orchestrator, Subagent Isolation Engine, Software Squad, Web Bundle Generator, i18n System
- **Beta/v1.0 subsystems (10):** Budget Guards, Recovery System, Memory Layer, AutoResearch Loop, Agent Leveling, Squad Router, Squad Loader, Model Profile Manager, Audit Logger, Community Hub integration

> **John (PM) note:** Not all 18 subsystems need full implementation for Alpha. The architecture must accommodate **stubs and empty contracts** for deferred subsystems without breaking the Persona B pipeline. R-01 (scope creep) is HIGH/HIGH — the architecture should make it structurally easy to ship partial implementations.

---

### Technical Constraints & Dependencies

**Hard constraints (non-negotiable):**

- Node.js 18+ only. No Python, no global installs beyond `npx`.
- Zero external services in Prompt Mode. The `.buildpact/` directory is the sole state store.
- No binary files. All artifacts: Markdown, JSON, YAML — human-readable, Git-diffable.
- Orchestrator files: ≤300 lines, ≤15% of active model context window (FR-301).
- Agent payloads: ≤20KB text (NFR-02).
- Any file >500 lines must be auto-sharded with `index.md` (FR-304).
- Hooks: ≤2KB per hook file (FR-303 + Squad Plugin API).
- MIT license on all public components. Private Squads are excluded from distribution.
- Clean-room rewrite of AIOX-inspired components (D-009). No source code copying.

**Dual-Mode Interface Contract (Winston + John consensus):**

Agent Mode (v2.0) is deferred and OQ-02 (Pi SDK vs custom harness) is unresolved. However, the architecture **must define the interface contract between modes today** — even if Agent Mode implementation is empty in v1.0. Specifically:

- Every file that Agent Mode will read/write must be identified in the `.buildpact/` schema now.
- Files must be classified as: `read-only` (Constitution, agent definitions) vs `read-write` (project-context, memory, audit) by mode.
- The Pipeline Orchestrator's dispatch interface (Task payload schema — defined in FR-302) serves as the **primary seam** between Prompt Mode and Agent Mode. This schema must be stable before v1.0 ships.

**Open Questions affecting architecture:**

| ID | Question | When | Impact |
|----|----------|------|--------|
| OQ-02 | Pi SDK vs custom agent harness for Agent Mode | Before v2.0 planning (Month 5) | Agent Mode runtime design |
| OQ-04 | BDFL vs committee governance | Month 6 | Community hub moderation architecture |
| OQ-05 | Migration paths from SpecKit/BMAD/GSD/AIOX | Post-v1.0 | Migration command design |

---

### Cross-Cutting Concerns

Nine concerns span multiple subsystems and must be designed as first-class architectural infrastructure — not bolted on per-feature.

| # | Concern | Scope | Key Requirement |
|---|---------|-------|-----------------|
| 1 | **i18n — Conditional Rules** | Every user-facing string + domain rules | Not simple string substitution. PT-BR Squads carry regulatory context (CFM, ANVISA) with no EN equivalent. i18n system must support language-conditional business logic, not just text replacement. (Mary 📊) |
| 2 | **Context Budget Management** | Every component file, every dispatch | Hard limits: orchestrators ≤15% context, payloads ≤20KB, files auto-shard at 500 lines. Every new component must be designed within these limits by default. |
| 3 | **Audit Logging** | All pipeline actions | Append-only `.buildpact/audit/session-{timestamp}.log`. Never deleted by automation. Cross-cutting — not optional for any phase. |
| 4 | **Budget Guards** | All execution phases + AutoResearch | 3-level limits (session/phase/day). Must be consulted before and during every cost-generating operation. AutoResearch loop is the highest-risk surface. |
| 5 | **State Persistence (File-as-DB)** | All persistent state | Markdown + JSON + YAML only. No external services. File size limits per NFR-02. Append-only patterns for audit and feedback. FIFO eviction for memory/feedback (max 30 entries). |
| 6 | **Agent-Agnostic Design** | All model calls | Model profiles abstract providers. No `claude.*` or `openai.*` hard-coded in orchestrators. Failover chains (FR-604) must be resolvable at runtime. |
| 7 | **Constitution Enforcement** | All pipeline phases | Constitution is injected into every subagent context. Violations generate structured warnings with principle references. Not optional — FR-202 is MUST. |
| 8 | **Community Squad Security** | Squad load/install boundary | Community Squads are untrusted. Validation (FR-1103) runs before any Squad is loaded into context. Checks: no external URLs, no executable code, no filesystem paths outside `.buildpact/`, no prompt injection patterns. |
| 9 | **Squad API Discoverability** | Squad creation and hook injection | Persona D (Ricardo) must know what hooks are available at each pipeline point without trial-and-error. The Squad Plugin API (6 hook points) requires self-documenting manifests — either auto-generated from `squad.yaml` or via `buildpact doctor`. (Mary 📊) |

---

### AutoResearch Isolation — Architectural Risk

> **Barry 🚀 + Winston 🏗️ joint recommendation — flagged as requiring ADR.**

FR-1403 mandates that Squad optimization runs on a dedicated branch. This principle must extend to **all AutoResearch targets** (code, copy, and Squad), not just Squads. Rationale:

1. **Concurrent execution risk:** If AutoResearch runs while a normal pipeline execute is in progress, Git conflicts and Budget Guard non-determinism will occur.
2. **Git Ratchet integrity:** FR-1204 (commit-on-improvement, revert-on-regression) must be implemented as a **testable abstraction independent of the optimization loop**. A bug in the Ratchet silently committing regressions is a critical quality risk.
3. **`results.tsv` as append-only log:** The experiment log must be append-only with a file-lock mechanism — even in Prompt Mode — to prevent corrupt state if the loop is interrupted.
4. **Branch naming convention:** `optimize/{target-type}/{session-name}/{timestamp}` must be standardized across all AutoResearch targets from Alpha (even if only code targets are available in v1.0).

> **Recommendation:** Create ADR-001 for AutoResearch Isolation Pattern before implementation begins. This is the highest-risk feature for unintended side effects.

---

### File-Based Database — Scale Boundaries

> **Winston 🏗️ note — to be resolved in technology/data architecture decisions.**

NFR-08 mandates file-based state with no external databases. This is correct for the target use case (solo-to-small-team, Git-friendly). However, scale limits must be defined explicitly to avoid v2.0 architectural debt:

- **Memory/feedback files:** FIFO max 30 entries (FR-803 — already defined). ✅
- **Squad agent definitions:** Lazy loading cap at ≤1KB agent index (FR-906). ✅
- **Audit logs:** Per-session files (not a single growing file). ✅
- **Specs/plans:** Auto-sharded at 500 lines (FR-304). ✅
- **Unresolved:** What is the maximum number of Squads the router can handle before context load becomes problematic? What is the maximum depth of the Squad hierarchy before lazy loading breaks down? → **These limits must be defined in the Squad Router architecture decision.**

---

## Starter Template Evaluation

### Primary Technology Domain

CLI framework / npm package — Node.js TypeScript package with CLI entry point.
BuildPact is not a web application. No UI framework, no CSS, no client-side bundle.

### Starter Options Considered

| Option | Verdict | Reason |
|--------|---------|--------|
| create-typescript-app | Rejected | Too opinionated; conflicts with BuildPact's own structural conventions |
| typescript-npm-cli-template | Rejected | Less active; not aligned with PRD technology choices |
| Custom Minimal | **Selected** | Full control, PRD-aligned, BuildPact-as-reference-implementation |

**Rationale:** BuildPact defines its own conventions. Using an external opinionated starter adds conflicting layers and sends an inconsistent message to community contributors. The framework's own structure IS the reference implementation for its users.

### Resolved Package Versions (verified March 2026)

| Package | Version | Notes |
|---------|---------|-------|
| Node.js (minimum) | **20.x** | 18 reached EOL April 2025; tsdown requires 20.19+ |
| Node.js (recommended) | **22.x** | Current LTS; `--experimental-require-module` for ESM/CJS compat |
| TypeScript | 5.x strict | |
| @clack/prompts | ^1.1.0 | PRD-specified TUI — actively maintained (v1.1.0, Mar 2026) |
| tsdown | ~0.20.3 | Official successor to tsup (tsup no longer maintained); pinned with `~` until 1.0 |
| vitest | ^4.1.0 | PRD-specified test framework — Vitest 4.1 released Mar 2026; workspace-ready |
| vitepress | latest | Docs site (PT-BR + EN) |

> **PRD Correction Required:** NFR-01 specifies Node.js 18+. Updated to **Node.js 20.x minimum, 22.x recommended**. Node.js 18 reached EOL in April 2025. This must be captured as a DECISIONS.md entry before implementation begins.

### Initialization

```bash
mkdir buildpact && cd buildpact
git init
npm init -y
```

### Architectural Decisions Established

**Language & Runtime:**
- TypeScript 5.x with strict mode enabled
- ESM output (`"type": "module"` in package.json)
- Node.js 20.x minimum, 22.x recommended
- npx-compatible binary entry via `bin` field in package.json

**bin entry (package.json):**
```json
{
  "bin": {
    "buildpact": "./dist/cli/index.js"
  }
}
```
`src/cli/index.ts` is the entry point — minimalist, only instantiates @clack/prompts and delegates to command handlers. Zero business logic in the entry point.

**Build Tooling:**
- tsdown ~0.20.3 — zero-config, powered by Rolldown/Oxc, official tsup successor
- Outputs: ESM + CJS dual bundle + `.d.ts` declarations
- Markdown/YAML agent template files shipped as-is (no compilation)
- `tsdown.config.ts` at root

**Testing:**
- Vitest 4.x with workspace config (monorepo-ready for v2.0 — no future reconfiguration needed)
- `vitest.config.ts` at root

**CI/CD (GitHub Actions):**
- `test.yml` — Vitest on PR and push to main
- `publish.yml` — npm publish on tag push
- `squad-validate.yml` — Squad structure validation on PRs to buildpact-squads repo

### Package Structure (Alpha — single package)

```
buildpact/
├── src/
│   ├── cli/              # TUI installer entry point (@clack/prompts) — no business logic
│   ├── contracts/        # TypeScript interfaces: shared Prompt↔Agent Mode contracts
│   │   ├── task.ts       # Task Dispatch Payload schema (FR-302)
│   │   ├── squad.ts      # Squad manifest + hook interface (6 pipeline points)
│   │   ├── profile.ts    # Model Profile + failover chain (FR-604)
│   │   └── budget.ts     # Budget Guard configuration (FR-705)
│   ├── commands/         # Slash command handlers (specify, plan, execute, verify…)
│   ├── engine/           # Pipeline orchestrator, subagent isolation, wave execution
│   ├── foundation/       # Constitution, context manager, sharding, i18n loader
│   ├── squads/           # Squad loader, validator, hook runner, lazy loader
│   ├── memory/           # Feedback/lessons/decisions tier system
│   ├── optimize/         # AutoResearch loop + Git Ratchet abstraction
│   └── utils/            # Shared utilities
├── templates/            # Markdown/YAML template files shipped with npm package
│   ├── constitution.md
│   ├── project-context.md
│   └── squads/
│       └── software/     # BUNDLED copy of Software Squad (offline/zero-config use)
│           └── README.md # "Source of truth: github.com/buildpact/buildpact-squads"
├── locales/              # i18n string files (conditional rule support, not just substitution)
│   ├── pt-br.yaml
│   └── en.yaml
├── test/
│   ├── unit/             # Pure functions, parsers, validators
│   ├── integration/      # Pipeline transitions, Squad loading, context injection
│   ├── snapshots/        # Generated artifact output (spec.md, plan files, commit messages)
│   └── fixtures/         # Foundation for integration tests
│       ├── squads/
│       │   └── software/ # Software Squad copy for tests
│       ├── projects/
│       │   └── minimal/  # Minimal .buildpact/ project for tests
│       └── constitutions/
│           └── default.md
├── docs/                 # VitePress site (PT-BR + EN)
├── .github/
│   └── workflows/
│       ├── test.yml
│       ├── publish.yml
│       └── squad-validate.yml
├── tsdown.config.ts
├── vitest.config.ts
└── package.json
```

### contracts/ — Prompt↔Agent Mode Interface Contract (Winston 🏗️)

The `src/contracts/` directory contains **TypeScript interfaces only — no implementation**. These are the stable API surface that:
- Prompt Mode (v1.0) implements
- Agent Mode (v2.0) must satisfy without breaking changes
- Community Squad builders depend on for hook definitions

These files are **stubs in Alpha** but must exist and be imported by all runtime code from commit one. This prevents the v2.0 breaking-change scenario where interfaces are defined ad hoc.

### Monorepo Strategy

| Phase | Structure | Reason |
|-------|-----------|--------|
| Alpha → v1.0 | Single package (`buildpact`) | Simpler, faster to iterate |
| v2.0 consideration | Monorepo (`packages/cli` + `packages/core` + `packages/agent-mode`) | Agent Mode (TypeScript + Pi SDK) may warrant isolation |
| Community Squads | Separate repo `buildpact-squads` from Alpha | FR-1101 — independent contribution flow |

### Open Question: Software Squad Source of Truth (John 📋)

The PRD states the Software Squad is "included in the open-source distribution" (FR-1001) and installable via `npx buildpact squad add software`. Two possible models:

- **Model A:** Software Squad lives only in `buildpact-squads` repo; `npx buildpact squad add software` fetches from there.
- **Model B:** A bundled copy ships inside the npm package (offline/zero-config); `buildpact-squads` is the source of truth with sync mechanism.

**Decision (resolved in Step 4):** Model B — bundled copy in npm + squad add updates from buildpact-squads. See Core Architectural Decisions section.

**Note:** Project scaffold creation is the first implementation story in Alpha.

---

## Core Architectural Decisions

> _Synthesized from step-04 analysis and multi-agent Party Mode review (Winston 🏗️, John 📋, Barry 🚀, Quinn 🧪, Mary 📊)._

---

### Decision Priority Analysis

**Critical — Block Implementation:**
- Command Registry with lazy loading + naming convention
- Dual-layer Orchestrator (Markdown spec · TypeScript executor) + precedence rule
- `src/contracts/` — five TypeScript interfaces including i18n resolver
- Audit Logger positioned before Foundation in implementation sequence
- Software Squad bundling model (npm bundle + `squad add` updates)
- Squad Validator error handling flow by context
- File-lock with 5-minute TTL

**Important — Shape Architecture:**
- i18n two-layer separation (UI strings vs. Squad domain rules)
- `bundle_disclaimers` field in squad.yaml for framework-injected compliance notices
- File access classification per mode (Prompt vs. Agent)
- AutoResearch Git Ratchet as independent testable module

**Deferred — Post-Alpha / v2.0:**
- Agent Mode TypeScript wrappers (OQ-02: Pi SDK vs. custom harness — Month 5)
- Monorepo migration (packages/cli + packages/agent-mode)
- BDFL vs. committee governance (OQ-04 — Month 6)
- Migration paths from SpecKit/BMAD/GSD/AIOX (OQ-05 — post-v1.0)

---

### Phase Delivery Table (scope protection against R-01)

| Decision / Component | Alpha | Beta | v1.0 | v2.0 |
|----------------------|-------|------|------|------|
| Command Registry + lazy loading | ✅ | — | — | — |
| Markdown orchestrators (specify/plan/execute/verify) | ✅ | — | — | — |
| CLI entry point + TUI installer | ✅ | — | — | — |
| `src/contracts/` (all 5 interfaces) | ✅ stubs | — | — | — |
| Constitution enforcement | ✅ | — | — | — |
| Squad Validator | ✅ | — | — | — |
| i18n loader (2-layer) | ✅ | — | — | — |
| Audit Logger | ✅ | — | — | — |
| Software Squad (bundled) | ✅ | — | — | — |
| Web Bundle Generator | ✅ | — | — | — |
| Budget Guards | 🔲 stub | ✅ | — | — |
| Memory Layer Tier 1 (feedback) | 🔲 stub | — | ✅ | — |
| AutoResearch + Git Ratchet | 🔲 stub | — | ✅ | — |
| Recovery System | 🔲 stub | — | ✅ | — |
| Agent Mode TypeScript wrappers | 🔲 contract only | — | — | ✅ |
| Lazy Squad loading (runtime) | 🔲 documented only | — | — | ✅ |

> **Rule:** Any component marked 🔲 stub in Alpha ships as an empty module that satisfies the `src/contracts/` interface. No implementation — just the type signature and a `throw new Error('Not implemented until Beta/v1.0')`.

---

### CLI Command Architecture

**Decision: Command Registry with lazy loading.**

```typescript
// src/commands/registry.ts
const registry: CommandRegistry = {
  'specify': () => import('./specify/index.js'),
  'plan':    () => import('./plan/index.js'),
  'execute': () => import('./execute/index.js'),
  'verify':  () => import('./verify/index.js'),
  'quick':   () => import('./quick/index.js'),
  // Expert-level commands
  'constitution': () => import('./constitution/index.js'),
  'squad':        () => import('./squad/index.js'),
  'memory':       () => import('./memory/index.js'),
  'optimize':     () => import('./optimize/index.js'),
}
```

**Naming convention:** Kebab-case internally. The `/bp:` prefix exists only in the user-facing CLI interface (slash commands). Internal registry uses simple kebab-case names. No `bp-`, no `buildpact-` prefix inside the codebase.

**Decision: Dual-layer Orchestrator with unidirectional precedence rule.**
- **Markdown layer** (`src/commands/*.md`): instruction files executed by the host model (Claude Code, Cursor, etc.) via slash commands. Hard limit: ≤300 lines per file. **These are the spec.**
- **TypeScript layer** (`src/commands/*.ts`): thin wrappers for Agent Mode v2.0. In Prompt Mode v1.0, TypeScript layer is installer-TUI only.
- **Precedence rule (Winston 🏗️):** The TypeScript wrapper always invokes the Markdown orchestrator as its source of truth. It never duplicates orchestrator logic. Markdown is the spec; TypeScript is the executor. One-way dependency: TypeScript → Markdown.

---

### Contracts Layer (`src/contracts/`)

Five TypeScript interface files — **no implementation, stubs in Alpha, stable from commit one:**

```typescript
// src/contracts/task.ts — Task Dispatch Payload (FR-302)
export interface TaskDispatchPayload { ... }
export interface TaskResult { ... }

// src/contracts/squad.ts — Squad manifest + hook interface
export interface SquadManifest { ... }
export interface SquadHook { ... }   // 6 pipeline points
export interface BundleDisclaimer { 'pt-br': string; en: string }

// src/contracts/profile.ts — Model Profile + failover chain (FR-604)
export interface ModelProfile { ... }
export interface FailoverChain { ... }

// src/contracts/budget.ts — Budget Guard configuration (FR-705)
export interface BudgetConfig { ... }
export interface BudgetGuardResult { ... }

// src/contracts/i18n.ts — i18n resolver interface (Winston 🏗️)
export interface I18nResolver {
  t(key: string, params?: Record<string, string>): string
  lang: 'pt-br' | 'en'
}
```

Every module that resolves strings, dispatches tasks, loads Squads, manages model profiles, or checks budgets imports from `src/contracts/` — not from implementation files. This is the Prompt↔Agent Mode compatibility guarantee.

---

### File System & State Architecture

**Decision:** PRD Section 6.5 file structure is authoritative. Access classification added:

| File / Dir | Prompt Mode | Agent Mode v2.0 | Notes |
|------------|-------------|-----------------|-------|
| `constitution.md` | read-only | read-only | Immutable at runtime |
| `project-context.md` | read-write | read-write | |
| `config.yaml` | read-only (runtime) | read-only | Only installer writes |
| `memory/feedback/*.json` | read-write | read-write | FIFO max 30 entries |
| `audit/session-*.log` | append-only | append-only | Never deleted by automation |
| `specs/` | read-write | read-write | Auto-sharded at 500 lines |
| `squads/*/agents/*.md` | read-only | read-only | Modified only via explicit squad commands |
| `optimize/*/results.tsv` | append-only + lock | append-only + lock | File-lock with 5-min TTL |

**File-lock mechanism (Barry 🚀):**
- A `.lock` sentinel file is created before any AutoResearch write operation
- Removed after the write completes
- **TTL: 5 minutes** — if the `.lock` file is older than 5 minutes, it is stale (process crashed); auto-removed on next access
- Implementation: single utility function in `src/utils/file-lock.ts`, ≤30 lines

---

### i18n Architecture

**Decision: Two-layer separation:**

**Layer 1 — UI strings** (`locales/pt-br.yaml` + `locales/en.yaml`):
- Pure text substitution for all CLI messages, errors, prompts, and help text
- Accessed via `I18nResolver.t('key', params)` interface
- No conditional logic — if a string exists in the YAML, it is used as-is

**Layer 2 — Domain rules** (`squads/{domain}/data/compliance-rules.yaml`):
- Language-conditional business rules (CFM nº 1.974/2011, ANVISA, LGPD, HIPAA)
- Each Squad owns its domain rules — not the framework i18n system
- Loaded by Squad Validator and injected into subagent context via hooks

**Bundle disclaimers (Mary 📊):**
Compliance notices that the framework injects into Web Bundles — framework responsibility, Squad-defined:

```yaml
# squad.yaml — bundle_disclaimers field
bundle_disclaimers:
  pt-br: "Este conteúdo deve ser revisado por um profissional de saúde antes da publicação."
  en: "This content must be reviewed by a healthcare professional before publication."
```

The Web Bundle Generator reads `bundle_disclaimers` from the active Squad's `squad.yaml` and appends the disclaimer in the user's active language. If the field is absent, no disclaimer is injected. This keeps CFM compliance in the Squad (where it belongs) while the injection mechanism lives in the framework (where it belongs).

---

### Security & Trust Model

**Decision: Squad Validator as pure, side-effect-free module:**
- Input: Squad file tree · Output: typed `ValidationResult`
- Each check is an independently testable pure function: `validateNoExternalUrls()`, `validateNoExecutableCode()`, `validatePathBoundaries()`, `validateNoPromptInjection()`
- Result cached: `.buildpact/audit/squad-validation-{timestamp}.json`

**Validation behavior by context (Quinn 🧪):**

| Context | Behavior on Failure |
|---------|---------------------|
| `squad add` (community source) | **Block** — installation rejected; specific error with file + line |
| `squad add` (local path) | **Warn** — installs with `"trusted": false` flag in squad.yaml |
| `buildpact doctor` | **Report only** — user decides remediation |
| CI/CD (`buildpact-squads` PR) | **Fail hard** — blocks merge until all checks pass |

**Consent model middleware:** Autonomy level (L1–L4) is checked by command dispatcher before any write or commit operation. Implemented as a middleware function in the command registry — not duplicated per-command.

---

### Infrastructure & Distribution

**Software Squad bundling (resolved from Step 3 open question):**
- npm package ships a bundled copy of Software Squad (stable, versioned, offline-capable)
- `buildpact-squads` repo is source of truth (latest, community-contributed)
- `npx buildpact squad add software` fetches latest from buildpact-squads repo
- Bundled copy = bootstrap guarantee (works offline, zero network dependency on `init`)

**Hosting:**
- npm registry: automated `npm publish` via GitHub Actions on semver tag push
- Documentation: VitePress on GitHub Pages (free, adequate for OSS, native i18n)
- Community Squads: `github.com/buildpact/buildpact-squads` (separate repo from Alpha)

---

### AutoResearch Isolation (confirmed with additions)

**Decision:** All AutoResearch operations (code, copy, Squad) run on isolated branch:
- Branch convention: `optimize/{target-type}/{session-name}/{timestamp}`
- Git Ratchet: independent TypeScript module in `src/optimize/ratchet.ts`, ≥80% Vitest coverage
- `results.tsv`: append-only with `.lock` file (5-min TTL); never truncated
- Merge policy: human review required before merge to main — no auto-merge
- **ADR-001** must be written for this pattern before implementation begins

---

### Implementation Sequence

Order enforced by dependency graph — no step can begin before its predecessors are complete:

1. `src/contracts/` — all five TypeScript interfaces (stubs — no implementation)
2. Audit Logger (`src/foundation/audit.ts`) — append-only, before any write operation elsewhere
3. CLI entry point + Command Registry (`src/cli/`, `src/commands/registry.ts`)
4. Foundation: Constitution loader, config reader, i18n resolver, file-lock utility
5. Squad Validator — pure module, high test coverage before integration
6. Markdown orchestrators — specify.md, plan.md, execute.md, verify.md (each ≤300 lines)
7. Pipeline Engine — subagent isolation, wave executor, context monitor
8. Software Squad templates bundled into `templates/squads/software/`
9. Web Bundle Generator
10. Stub modules for Budget Guards, Memory Layer, AutoResearch (satisfy contracts, throw NotImplemented)

**Cross-component dependencies:**
- `contracts/` → all modules (must be first, always)
- Constitution enforcement → all pipeline phases (injected cross-cutting)
- i18n resolver → all user-facing output (cross-cutting via I18nResolver interface)
- Budget Guards → Engine + AutoResearch (cross-cutting — stubs in Alpha)
- Squad Validator → Squad Loader + Community Hub CI (shared module)
- Git Ratchet → AutoResearch loop (hard dependency within optimize module)
- Audit Logger → Foundation + Engine + Squad Validator (append-only cross-cutting)

---

## Implementation Patterns & Consistency Rules

> _Synthesized from step-05 analysis and multi-agent Party Mode review (Winston 🏗️, Amelia 💻, Quinn 🧪, Paige 📚)._
> _9 conflict areas identified and resolved. These rules are mandatory for all AI agents implementing BuildPact._

---

### Critical Conflict Points Identified: 9

Naming (4) · Structure (2) · Format (3) · Communication (3) · Process (3) · Documentation (3)

---

### Naming Patterns

**TypeScript — convention by artifact type:**

| Artifact | Convention | Example |
|----------|-----------|---------|
| `.ts` files | `kebab-case` | `squad-validator.ts`, `file-lock.ts` |
| Classes and Interfaces | `PascalCase` | `SquadValidator`, `I18nResolver` |
| Functions and variables | `camelCase` | `validateSquad()`, `budgetRemaining` |
| Constants | `SCREAMING_SNAKE_CASE` | `LOCK_TTL_MS`, `MAX_ORCHESTRATOR_LINES` |
| Contract files | `kebab-case` file, `PascalCase` interface | `task.ts` → `interface TaskDispatchPayload` |
| Enums | `PascalCase` type + `PascalCase` values | `enum AutomationLevel { Manual, Documented }` |

Anti-patterns: `const squad_validator` · `function GetSquad()` · `interface squad_manifest`

---

**Markdown orchestrators — kebab-case mandatory:**

| Artifact | Convention | Example |
|----------|-----------|---------|
| Command `.md` files | `kebab-case` | `specify.md`, `quick-flow.md` |
| H2/H3 sections | Title Case | `## Task Dispatch Protocol` |
| Context variable references | `{{snake_case}}` for variables | `{{project_name}}`, `{{active_squad}}` |
| File path references | `{{.buildpact/path}}` | `{{.buildpact/constitution.md}}` |

**Context variable convention (Amelia 💻):**
- `{{variable_name}}` — runtime variable (string, resolved by orchestrator)
- `{{.buildpact/path/to/file.md}}` — file reference (read and injected by orchestrator)
- Nested: `{{.buildpact/squads/{{active_squad}}/squad.yaml}}` — file path with variable interpolation

This is the canonical format parsed by Agent Mode TypeScript wrappers. No deviation permitted.

---

**YAML/JSON — snake_case for all keys:**

| Artifact | Convention | Example |
|----------|-----------|---------|
| `config.yaml` keys | `snake_case` | `active_squad`, `per_phase_usd` |
| `squad.yaml` manifest keys | `snake_case` | `bundle_disclaimers`, `initial_level` |
| `feedback/*.json` keys | `snake_case` | `approved_at`, `rejection_reason` |

Anti-pattern: `activeSquad:` in YAML · `{{projectName}}` in Markdown

---

**i18n keys — dot-notation hierarchy, max 3 levels:**

```yaml
# locales/pt-br.yaml — correct structure
error:
  squad:
    not_found: "Squad '{name}' não encontrado em .buildpact/squads/"
    validation_failed: "Validação falhou: {count} erro(s) encontrado(s)"
cli:
  install:
    welcome: "Bem-vindo ao BuildPact — {version}"
```

Pattern: `{domain}.{context}.{key}` — maximum 3 levels. Never flat keys (`"squad_not_found"`).

---

### Structure Patterns

**Single `index.ts` as public API — named exports only (Amelia 💻):**

```typescript
// src/squads/index.ts — only importable file from outside this module
export { validateSquad } from './validator.js'
export type { ValidationResult } from './types.js'

// ❌ Anti-pattern
export default class SquadValidator { ... }  // no default exports
```

Every module in `src/` exposes one `index.ts`. All other files in the module are private. External modules import only from `../squads/index.js` — never from `../squads/validator.js`.

---

**Test organization — by test type, not by source module:**

| Type | Location | Scope |
|------|----------|-------|
| Unit | `test/unit/` mirrors `src/` exactly | Pure functions, parsers, validators |
| Integration | `test/integration/` grouped by flow | `pipeline/specify-to-plan.test.ts` |
| Snapshots | `test/snapshots/` named by command | Structural schemas (not content) |
| Fixtures | `test/fixtures/` | Integration only — never imported by unit tests |

**Snapshot strategy (Quinn 🧪) — test structure, not content:**

AI-generated content is non-deterministic. Snapshots test the *structure* of generated artifacts:

```typescript
// test/snapshots/specify/basic-feature.schema.ts
export const specSchema = {
  required_sections: ['User Stories', 'Acceptance Criteria', 'Assumptions'],
  frontmatter_fields: ['feature', 'created_at', 'squad', 'status'],
  min_stories: 1,
  min_acceptance_criteria: 1,
}
```

The test runner parses the generated file, extracts structure, and compares to the schema. Never exact-match on generated prose.

---

### Format Patterns

**All fallible business functions return `Result<T, E>` — never throw:**

```typescript
type Result<T, E = CliError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

// ✅ Correct
const result = await validateSquad(squadPath)
if (!result.ok) {
  console.error(i18n.t(result.error.i18nKey, result.error.params))
  process.exit(1)
}

// ❌ Anti-pattern — throw in business logic
throw new Error('Squad not found')
```

**Exception:** Programming errors (invariant violations, bugs) MUST use `throw`. Business logic: always `Result<T>`.

---

**`CliError` — canonical error type (Amelia 💻 — sixth contracts file):**

```typescript
// src/contracts/errors.ts
export interface CliError {
  code: string                        // SCREAMING_SNAKE_CASE: 'SQUAD_NOT_FOUND'
  i18nKey: string                     // 'error.squad.not_found'
  params?: Record<string, string>     // interpolation params for i18n
  phase?: string                      // 'v1.0' — for NOT_IMPLEMENTED stubs
  cause?: unknown                     // original error if wrapping
}
```

Every `Result<T, E>` in the codebase uses `E = CliError`. No module defines its own error type.

---

**Audit log — JSON Lines format (one entry per line):**

```jsonl
{"ts":"2026-03-14T18:00:00Z","action":"specify.start","agent":"orchestrator","files":[],"outcome":"success"}
{"ts":"2026-03-14T18:00:05Z","action":"squad.validate","agent":"squad-validator","files":["squads/software/squad.yaml"],"outcome":"success","cost_usd":0.0}
```

Mandatory fields: `ts` (ISO 8601), `action` (`{module}.{operation}`), `agent`, `files` (array), `outcome` (`success` | `failure` | `rollback`). Optional: `error`, `cost_usd`, `tokens`.

---

### Communication Patterns

**ESM imports — `.js` extension mandatory, no exceptions:**

```typescript
// ✅ Correct
import { validateSquad } from '../squads/index.js'
import type { SquadManifest } from '../contracts/squad.js'

// ❌ Anti-pattern — breaks ESM resolution
import { validateSquad } from '../squads/index'
```

---

**Layer dependency — unidirectional, no cycles:**

```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
```

No layer imports from a layer to its right. `contracts/` imports nothing internal. Cycle detection must be enforced in CI (via `madge` or equivalent).

---

**i18n — always via `I18nResolver` interface, never direct YAML access:**

```typescript
// ✅ Correct — depends on interface, not implementation
function greetUser(i18n: I18nResolver): string {
  return i18n.t('cli.install.welcome', { version: VERSION })
}

// ❌ Anti-pattern — bypasses i18n layer
import ptBr from '../../locales/pt-br.yaml'
const msg = ptBr.cli.install.welcome
```

**i18n fallback (Paige 📚) — missing key returns formatted code, never crashes:**

```typescript
t(key: string, params?: Record<string, string>): string {
  const template = this.strings[key]
  if (!template) return `[${key.toUpperCase().replace(/\./g, '_')}]`  // visible bug indicator
  return template.replace(/\{(\w+)\}/g, (_, k) => params?.[k] ?? `{${k}}`)
}
// Missing 'error.squad.not_found' → returns '[ERROR_SQUAD_NOT_FOUND]'
```

---

### Process Patterns

**Stubs for deferred features — explicit `NOT_IMPLEMENTED` return:**

```typescript
// src/memory/index.ts — Alpha stub
import type { FeedbackEntry } from '../contracts/errors.js'
import type { Result } from '../contracts/task.js'

/**
 * Records a feedback entry in the Memory Layer.
 * @see FR-803 — Memory Layer Tier 1
 * @module memory
 */
export function recordFeedback(_entry: FeedbackEntry): Result<void> {
  // TODO: implement in v1.0 — FR-803 Memory Layer Tier 1
  return { ok: false, error: { code: 'NOT_IMPLEMENTED', i18nKey: 'error.stub.not_implemented', phase: 'v1.0' } }
}
```

Rule: every stub returns `Result<T>` with `ok: false` and `code: 'NOT_IMPLEMENTED'`. Never silent. Never `throw`. Never `return undefined`. The caller decides how to handle.

---

**Markdown orchestrator header — mandatory in every command file:**

```markdown
<!-- ORCHESTRATOR: specify | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# Specify Phase Orchestrator
...
## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/specify.ts`
- Output files written to: `.buildpact/specs/{{feature_slug}}/`
- Constitution validation: called after spec generation, before user review
- Triggers: `on_specify_complete` hook if Squad active
```

Every `.md` orchestrator file MUST have:
1. Header comment with `ORCHESTRATOR`, `MAX_LINES`, `CONTEXT_BUDGET`, `VERSION`
2. `## Implementation Notes` block at the end for Agent Mode

CI verification (Quinn 🧪):
```bash
# .github/workflows/test.yml — orchestrator compliance check
for f in src/commands/*.md; do
  grep -q "ORCHESTRATOR:" "$f" || echo "FAIL: $f missing orchestrator header"
  lines=$(wc -l < "$f")
  [ "$lines" -gt 300 ] && echo "FAIL: $f has $lines lines (max 300)"
done
```

---

**JSDoc minimum standard (Paige 📚) — every exported `index.ts`:**

```typescript
/**
 * Squad Validator — pure, side-effect-free validation of Squad file trees.
 * @module squads/validator
 * @see {@link SquadManifest} for the Squad manifest structure
 * @see FR-1103 for validation requirements
 */
export { validateSquad } from './validator.js'
export type { ValidationResult } from './types.js'
```

Required fields: description line, `@module`, at least one `@see FR-{number}`. Optional but encouraged: `@see {@link ContractType}`. This creates PRD traceability — any agent can find the FR behind any module.

---

### All AI Agents MUST

1. **Use `src/contracts/` as source of truth** — never redefine shared interfaces locally
2. **Return `Result<T, CliError>` in all fallible business functions** — never `throw`
3. **YAML keys in `snake_case`, i18n keys in dot-notation max 3 levels** — no camelCase in YAML
4. **`.js` extension on all ESM imports** — no exceptions
5. **Respect layer dependency order** — imports are unidirectional, zero cycles
6. **All deferred features return `{ ok: false, error: { code: 'NOT_IMPLEMENTED' } }`** — never silent
7. **Every Markdown orchestrator has header comment + `## Implementation Notes`** — verified by CI
8. **All user-facing strings go through `I18nResolver.t()`** — never hardcoded
9. **Named exports only** — no `export default` anywhere in `src/`
10. **Every exported `index.ts` has JSDoc with `@see FR-{number}`** — PRD traceability

### Anti-Pattern Reference Table

| ❌ Anti-pattern | ✅ Correct |
|-----------------|-----------|
| `throw new Error('Squad not found')` in business logic | `return { ok: false, error: { code: 'SQUAD_NOT_FOUND', i18nKey: '...' } }` |
| `import { x } from '../squad/validator'` (no .js) | `import { x } from '../squad/validator.js'` |
| `import { x } from '../engine'` from within `contracts/` | Contracts import nothing internal |
| Local `interface SquadManifest { ... }` redefinition | `import type { SquadManifest } from '../contracts/squad.js'` |
| `config.yaml` key `activeSquad:` | `active_squad:` |
| `{{projectName}}` in Markdown | `{{project_name}}` |
| `{{path/to/file}}` for file references | `{{.buildpact/path/to/file}}` |
| Stub returning `undefined` silently | `return { ok: false, error: { code: 'NOT_IMPLEMENTED', phase: 'v1.0' } }` |
| Orchestrator `.md` without header comment | `<!-- ORCHESTRATOR: specify \| MAX_LINES: 300 \| ... -->` |
| `export default class Validator` | `export { validate } from './validator.js'` |
| Module importing from `../other-module/internal-file.js` | `import from '../other-module/index.js'` only |
| Direct YAML import for i18n | `i18n.t('key', params)` via `I18nResolver` |

---

## Project Structure & Boundaries

> _Synthesized from step-06 analysis and Party Mode review (Winston 🏗️ · Amelia 💻 · Bob 🏃 · Quinn 🧪)._

### FR Category → Directory Mapping

| FR Series | Category | `src/` location |
|-----------|----------|-----------------|
| FR-100–105 | Install/TUI | `src/cli/` + `src/foundation/installer.ts` |
| FR-200 | Constitution | `src/foundation/constitution.ts` |
| FR-300 | Context Engineering | `src/foundation/sharding.ts`, `src/foundation/monitor.ts` |
| FR-400 | Quick Flow | `src/commands/quick/` |
| FR-500 | Specify | `src/commands/specify/` + `templates/commands/specify.md` |
| FR-600 | Plan | `src/commands/plan/` + `templates/commands/plan.md` |
| FR-700 | Execute | `src/engine/` + `templates/commands/execute.md` |
| FR-800 | Verify+Learn | `src/commands/verify/`, `src/memory/` |
| FR-900 | Squad Architecture | `src/squads/` |
| FR-1000 | Pre-built Squads | `templates/squads/` |
| FR-1001 | Software Squad | `templates/squads/software/` (bundled) |
| FR-1100 | Community Hub | `.github/workflows/squad-validate.yml` |
| FR-1200–1400 | AutoResearch | `src/optimize/` |
| NFR-14 | Attribution | `ATTRIBUTION.md` |
| NFR-17 | Contribution | `CONTRIBUTING.md` (PT-BR + EN) |
| NFR-20 | ADRs | `docs/decisions/` |
| NFR-23 | Audit trail | `src/foundation/audit.ts` |

### Complete Project Tree

```
buildpact/
│
├── package.json                      # bin, type: module, files: [dist/, templates/, locales/]
├── tsdown.config.ts
├── vitest.config.ts                  # workspace-ready, per-module coverage thresholds
├── tsconfig.json                     # strict, NodeNext moduleResolution
├── .gitignore
├── CHANGELOG.md
├── ATTRIBUTION.md                    # NFR-14 — all inspiration sources
├── CONTRIBUTING.md                   # NFR-17 — PT-BR + EN setup guide
├── LICENSE                           # MIT
│
├── src/
│   ├── cli/
│   │   └── index.ts                  # Entry point — @clack/prompts TUI, delegates to registry
│   │
│   ├── contracts/                    # 6 interface files — no implementation, stubs in Alpha
│   │   ├── task.ts                   # TaskDispatchPayload, TaskResult (FR-302)
│   │   ├── squad.ts                  # SquadManifest, SquadHook, BundleDisclaimer
│   │   ├── profile.ts                # ModelProfile, FailoverChain (FR-604)
│   │   ├── budget.ts                 # BudgetConfig, BudgetGuardResult (FR-705)
│   │   ├── i18n.ts                   # I18nResolver
│   │   └── errors.ts                 # CliError, Result<T,E>
│   │
│   ├── commands/
│   │   ├── registry.ts               # Lazy-loading command registry
│   │   ├── specify/index.ts          # loads templates/commands/specify.md at runtime
│   │   ├── plan/index.ts
│   │   ├── execute/index.ts
│   │   ├── verify/index.ts
│   │   ├── quick/index.ts
│   │   ├── constitution/index.ts
│   │   ├── squad/index.ts
│   │   ├── memory/index.ts           # stub Alpha → v1.0
│   │   └── optimize/index.ts         # stub Alpha → v1.0
│   │
│   ├── foundation/
│   │   ├── index.ts
│   │   ├── audit.ts                  # Append-only JSON Lines logger (NFR-23)
│   │   ├── bundle.ts                 # Compression, token budget, platform limits (FR-105a–c)
│   │   ├── constitution.ts           # Read/enforce constitution.md (FR-201–202)
│   │   ├── config.ts                 # config.yaml reader
│   │   ├── context.ts                # project-context.md read/write
│   │   ├── sharding.ts               # Auto-shard >500 lines (FR-304)
│   │   ├── monitor.ts                # Context % + cost tracker (FR-303) — stub Alpha
│   │   ├── i18n.ts                   # I18nResolver implementation + fallback
│   │   ├── file-lock.ts              # .lock utility, 5-min TTL (Barry 🚀)
│   │   └── installer.ts              # Copies templates/ → .buildpact/ on init (Bob 🏃)
│   │
│   ├── engine/
│   │   ├── index.ts
│   │   ├── orchestrator.ts           # Pipeline coordinator (FR-301–302)
│   │   ├── wave-executor.ts          # Wave analysis + parallel dispatch (FR-602, FR-701)
│   │   ├── subagent.ts               # Task() dispatch + clean context (FR-302)
│   │   ├── recovery.ts               # stub Alpha → v1.0 (FR-703)
│   │   └── budget-guard.ts           # stub Alpha → Beta (FR-705)
│   │
│   ├── squads/
│   │   ├── index.ts
│   │   ├── loader.ts                 # Squad manifest reader, lazy load guidance (FR-906)
│   │   ├── validator.ts              # Pure validation — 90%+ coverage (FR-905, FR-1103)
│   │   ├── hook-runner.ts            # 6 pipeline hook points (Squad Plugin API)
│   │   ├── router.ts                 # Squad routing by domain (FR-901)
│   │   └── web-bundle.ts             # Orchestrates foundation/bundle.ts + Squad templates (FR-105)
│   │
│   ├── memory/
│   │   ├── index.ts                  # stub Alpha → v1.0
│   │   └── feedback.ts               # Tier 1 FIFO feedback (FR-803) — stub
│   │
│   └── optimize/
│       ├── index.ts                  # stub Alpha → v1.0
│       ├── loop.ts                   # AutoResearch experiment loop (FR-1201–1206)
│       └── ratchet.ts                # Git Ratchet — independent testable module, 85%+ coverage
│
├── templates/                        # Shipped in npm package (no compilation)
│   ├── commands/                     # Markdown orchestrators — loaded at runtime by commands/*/index.ts
│   │   ├── specify.md                # <!-- ORCHESTRATOR: specify | MAX_LINES: 300 | ... -->
│   │   ├── plan.md
│   │   ├── execute.md
│   │   ├── verify.md
│   │   ├── quick.md
│   │   ├── constitution.md
│   │   ├── squad.md
│   │   ├── memory.md                 # stub
│   │   └── optimize.md               # stub
│   ├── constitution.md               # Default Constitution template
│   ├── project-context.md            # Default project-context template
│   └── squads/
│       └── software/                 # Bundled Software Squad (FR-1001)
│           ├── squad.yaml
│           ├── agents/
│           │   ├── pm.md
│           │   ├── architect.md
│           │   ├── developer.md
│           │   ├── qa.md
│           │   └── tech-writer.md
│           ├── templates/
│           ├── hooks/
│           └── README.md             # "Source of truth: buildpact-squads repo"
│
├── locales/
│   ├── pt-br.yaml                    # PT-BR UI strings (dot-notation keys)
│   └── en.yaml                       # EN UI strings
│
├── test/
│   ├── unit/                         # Mirrors src/ exactly
│   │   ├── foundation/
│   │   ├── squads/
│   │   └── optimize/
│   ├── integration/                  # Grouped by flow
│   │   └── pipeline/
│   ├── snapshots/                    # Structural schemas — not content (Quinn 🧪)
│   │   └── specify/
│   └── fixtures/
│       ├── squads/software/
│       ├── projects/minimal/
│       ├── constitutions/default.md
│       └── git-repos/
│           └── minimal/              # Bare git repo for ratchet.ts tests (Bob 🏃)
│
├── docs/
│   ├── decisions/                    # ADRs in MADR format (NFR-20) (Winston 🏗️)
│   │   └── adr-001-autorescarch-isolation.md
│   ├── .vitepress/config.ts
│   ├── pt-br/
│   └── en/
│
└── .github/
    └── workflows/
        ├── test.yml                  # Vitest + orchestrator header CI check
        ├── publish.yml               # npm publish on semver tag
        └── squad-validate.yml        # Squad structure validation for buildpact-squads PRs

```

### Architectural Boundaries

**Layer dependency (unidirectional, enforced by CI):**
```
contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/
                                   ↑
                              optimize/ (parallel, isolated branches)
```

**External integrations:**
- Git — `engine/wave-executor.ts` (commits), `optimize/ratchet.ts` (branch/revert)
- npm registry — publish only, via CI on semver tag
- GitHub API — Squad install from `buildpact-squads`, via `squads/loader.ts`
- AI model providers — abstracted via `contracts/profile.ts`, called by `engine/subagent.ts`

**Data flow (Prompt Mode):**
```
User CLI → registry.ts → commands/*/index.ts → foundation/ (config, constitution)
         → engine/orchestrator.ts → engine/subagent.ts (Task dispatch)
         → [host model executes templates/commands/*.md]
         → foundation/audit.ts (append JSON Lines log)
         → squads/hook-runner.ts (if Squad active — on_* hooks)
```

**Coverage thresholds (vitest.config.ts — Quinn 🧪):**

| Module | Lines threshold |
|--------|----------------|
| `src/contracts/**` | 100% |
| `src/squads/validator.ts` | 90% |
| `src/optimize/ratchet.ts` | 85% |
| `src/foundation/**` | 75% |
| global | 70% |

---

## Architecture Validation Results

> _Step 7 validation — March 2026._

### Coherence Validation ✅

**Decision Compatibility:** All technology choices confirmed mutually compatible (Node 22 LTS + TypeScript 5.x strict + tsdown ~0.20.3 + Vitest 4.x + @clack/prompts ^1.1.0). No version conflicts.

**Pattern Consistency:** `Result<T, CliError>`, `I18nResolver`, `.js` ESM imports, and layer dependency arrow (`contracts/ ← foundation/ ← engine/ ← squads/ ← commands/ ← cli/`) are internally consistent with no cycles or contradictions.

**Structure Alignment:** Project tree aligns with all architectural decisions. All 18 subsystems mapped to file locations. FR→directory table is complete and non-overlapping.

---

### Requirements Coverage Validation ✅

**Functional Requirements:** All 68 FRs (FR-100–FR-1403) are architecturally supported. FR series mapped to source locations in Project Structure section. Phase delivery table scopes Alpha/Beta/v1.0/v2.0 boundaries.

**Non-Functional Requirements:** 22 of 23 NFRs addressed at start of validation. NFR-15 (cache-aware file ordering) identified as GAP-03 — resolved below.

---

### Gap Analysis & Resolutions

#### GAP-01 — `AutomationLevel` Enum (Critical) — RESOLVED

Add to `src/contracts/` (new file `autonomy.ts`):

```typescript
// src/contracts/autonomy.ts
export enum AutomationLevel {
  L1 = 'manual',       // User approves every action
  L2 = 'supervised',   // User approves writes and commits
  L3 = 'assisted',     // User approves commits only
  L4 = 'autonomous',   // AI acts without approval (explicit opt-in)
}
```

The command dispatcher middleware checks `config.yaml` `autonomy_level` key against this enum before any write or commit operation. Default: `L2`.

**Update to `src/contracts/` count: 7 files (was 6).**

---

#### GAP-02 — `buildpact doctor` Command (Critical) — RESOLVED

**Decision:** `doctor` is a standalone top-level command added to the registry.

```typescript
// src/commands/registry.ts — add:
'doctor': () => import('./doctor/index.js'),
```

`doctor` runs Squad Validator in report-only mode + checks Constitution presence + validates config.yaml schema. Does not block or install. Output: structured health report to stdout.

---

#### GAP-03 — NFR-15 Cache-Aware Ordering Pattern (Important) — RESOLVED

**Rule added to Implementation Patterns:** In every Markdown file (orchestrators, agent definitions, Squad templates), content ordering is mandatory:

1. Static blocks first: system instructions, persona definitions, constraints, Constitution reference
2. Semi-static blocks: Squad manifest injection, active config values
3. Dynamic blocks last: `{{variable}}` injections, `{{.buildpact/file}}` references

CI check added to `test.yml`: verify that no `{{variable}}` appears before the first static instruction block in any `templates/commands/*.md` file.

---

#### GAP-04 — `config.yaml` Formal Schema (Important) — RESOLVED

**Canonical `.buildpact/config.yaml` schema:**

```yaml
# .buildpact/config.yaml — generated by installer, modified by user
version: "1"                    # string, schema version
active_squad: "software"        # string, squad directory name under .buildpact/squads/
autonomy_level: "L2"            # string, one of: L1 | L2 | L3 | L4
language: "en"                  # string, "en" | "pt-br"
budget:
  per_session_usd: 2.00         # number, 0 = unlimited
  per_phase_usd: 0.50           # number, 0 = unlimited
  per_day_usd: 10.00            # number, 0 = unlimited
model_profile: "default"        # string, profile name from .buildpact/profiles/
```

`src/foundation/config.ts` is the sole reader. No other module reads `config.yaml` directly. All keys have defaults in installer template — config is always valid after `init`.

---

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (68 FRs + 23 NFRs mapped)
- [x] Scale and complexity assessed (~18 subsystems, HIGH complexity)
- [x] Technical constraints identified (Node 20+, file-based state, MIT, ≤300 line orchestrators)
- [x] Cross-cutting concerns mapped (9 concerns, all first-class)

**✅ Architectural Decisions**

- [x] Critical decisions documented with exact versions
- [x] Technology stack fully specified (all packages pinned with rationale)
- [x] Integration patterns defined (Prompt Mode data flow diagram)
- [x] Phase delivery table (Alpha→v2.0 scope boundaries)

**✅ Implementation Patterns**

- [x] Naming conventions (TypeScript + Markdown + YAML + i18n keys)
- [x] Structure patterns (module index.ts, test organization, snapshot strategy)
- [x] Format patterns (`Result<T>`, `CliError`, audit log format)
- [x] Communication patterns (ESM imports, layer dependency, i18n)
- [x] Process patterns (stubs, orchestrator headers, JSDoc standard)
- [x] 10 mandatory AI Agent rules + anti-pattern reference table

**✅ Project Structure**

- [x] Complete directory tree with file-level annotations
- [x] FR→directory mapping (all 68 FRs traceable to src/ locations)
- [x] Architectural boundaries and unidirectional dependency graph
- [x] Coverage thresholds per module (CI-enforced)

---

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**

- Contracts-first design guarantees Prompt↔Agent Mode compatibility from commit one
- Phase delivery table provides structural protection against scope creep (R-01)
- 10 AI Agent mandatory rules + anti-pattern table make consistent implementation achievable across parallel agents
- File-as-DB design is fully specified with access classification, size limits, and FIFO eviction rules
- Implementation sequence enforces correct dependency order

**Areas for Future Enhancement:**

- Agent Mode TypeScript wrappers (OQ-02 — Month 5, post-v1.0)
- Monorepo migration when Agent Mode warrants package isolation
- Squad hierarchy depth limits (Squad Router max depth — deferred to v1.0 implementation)
- BDFL vs. committee governance (OQ-04 — Month 6)

---

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use the 10 mandatory rules and anti-pattern table as your consistency checklist
- Respect the implementation sequence — `src/contracts/` is always first
- `src/contracts/` now has **7 files** (add `autonomy.ts`)
- `registry.ts` now has **10 commands** (add `doctor`)
- Refer to this document for all architectural questions before making decisions

**First Implementation Priority:** Project scaffold — `src/contracts/` (all 7 interface files as stubs) + `src/foundation/audit.ts` + `src/cli/index.ts` + `src/commands/registry.ts`

