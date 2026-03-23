---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - docs/prd/buildpact-prd-v2.3.0.md
  - _bmad-output/planning-artifacts/architecture.md
status: complete
completedAt: '2026-03-15'
v1_v2_epics_added: '2026-03-22'
v1_v2_epics_scope: 'Epics 18-25 (v1.0 + v2.0) — 8 epics, 30 stories'
v1_v2_methods: 'First Principles Analysis, User Persona Focus Group, Party Mode review'
---

# BuildPact - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for BuildPact, decomposing the requirements from the PRD and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-101: One-Command Installation. The framework MUST install via `npx buildpact init <project-name>` with no prior dependencies beyond Node.js 18+. No Python, no uv, no global npm packages required. — Priority: MUST

FR-102: Interactive TUI. The installer MUST provide a bilingual (PT-BR/EN) Terminal User Interface using `@clack/prompts` with: language selection, domain selection (Software/Marketing/Health/Research/Management/Custom), IDE selection (multi-select from 10+ options), experience level selection (Beginner/Intermediate/Expert), and optional Squad installation. — Priority: MUST

FR-103: Diagnostic Tool. The command `buildpact doctor` MUST check: Node.js version, Git availability, IDE configuration validity, Squad integrity, and context file consistency. Output in the user's selected language. — Priority: SHOULD

FR-104: Cross-IDE Configuration. Installation MUST generate correct configuration files for all selected IDEs simultaneously: `.claude/commands/` for Claude Code, `.cursor/rules/` for Cursor, `.gemini/` for Gemini CLI, `.codex/` skills for Codex, and `CLAUDE.md`/`.cursorrules` as appropriate. — Priority: MUST

FR-105: Web Bundle Export. The command `/bp:export-web <platform>` MUST generate a single copiable prompt for Claude.ai, ChatGPT, and Gemini web interfaces, containing compressed versions of all active commands, Constitution, and project context. Web Bundles are the primary delivery mechanism for serving Persona A end-users. — Priority: MUST

FR-105a: Token Budget Management. Each generated bundle MUST include a token count estimate and MUST NOT exceed platform-specific limits: 180K tokens for Claude.ai, 128K for ChatGPT (GPT-4), 1M for Gemini. The export command MUST warn if the bundle approaches 80% of any platform's limit. — Priority: MUST

FR-105b: Compression Strategy. The bundle MUST apply progressive compression: (1) inline only active Squad agent definitions, (2) compress Constitution to essential rules only, (3) exclude optimization history and memory lessons, (4) include only the current project context. The compression algorithm MUST be documented and deterministic. — Priority: MUST

FR-105c: Conversational Interface Adaptation. For web interfaces, the bundle MUST replace all slash commands with natural language conversation flows. Beginner-level commands MUST be expressed as guided questions in the user's selected language. — Priority: MUST

FR-105d: Bundle Versioning and Staleness Detection. Each bundle MUST include a generation timestamp and a hash of source files. The bundle SHOULD warn if older than 7 days or if source files may have changed. — Priority: SHOULD

FR-105e: Graceful Degradation. If a bundle exceeds a platform's token limit, the export command MUST offer tiered degradation down to a minimal "quick session" bundle. Each degradation tier MUST be documented in the bundle. — Priority: SHOULD

FR-106: Prompt-to-Agent Mode Migration. When transitioning from Prompt Mode to Agent Mode, the framework MUST preserve full backwards compatibility of all existing artifacts. The migration command MUST validate files, generate additional config, preserve Git history, and report compatibility summary. — Priority: SHOULD

FR-201: Constitution Creation. `/bp:constitution` MUST create or update `.buildpact/constitution.md` supporting: coding standards, compliance requirements (CFM, ANVISA, LGPD, HIPAA), architectural constraints, quality gates, and domain-specific rules. — Priority: MUST

FR-202: Constitution Enforcement. All subsequent commands (specify, plan, execute) MUST reference and validate against the Constitution automatically. Violations MUST generate warnings with specific references to violated principles. — Priority: MUST

FR-203: Constitution Versioning. Each modification to the Constitution MUST generate an update checklist tracking what changed, why, and what downstream artifacts need review. — Priority: SHOULD

FR-301: Orchestrator Size Limit. No orchestrator workflow or command file MUST exceed 300 lines or consume more than 15% of the active model's maximum context window. — Priority: MUST

FR-302: Subagent Isolation with Mandatory Session Reset. All heavy computation MUST be delegated to subagents via Task() dispatch, each receiving a clean context window. Subagents MUST NOT inherit accumulated context from the orchestrator beyond the specific task payload. — Priority: MUST

FR-303: Context and Cost Monitor. In CLI environments, the framework MUST display real-time context usage with WARNING (>50%) and CRITICAL (>75%) alerts. SHOULD also display estimated cost per phase, accumulated cost per milestone, and alternative model profile comparison. — Priority: SHOULD

FR-304: Document Sharding. Any spec, plan, or PRD exceeding 500 lines MUST be automatically sharded into atomic files with an `index.md` for navigation. Target: ~90% token savings per agent load. — Priority: MUST

FR-401: Quick Command. `/bp:quick <description>` MUST bypass all ceremony and execute: minimal spec generation → execution → atomic commit in under 5 minutes for bugs, small features, and configuration changes. — Priority: MUST

FR-402: Quick Discuss Flag. `/bp:quick --discuss` MUST optionally gather lightweight context before execution (3–5 targeted questions) without entering the full planning pipeline. — Priority: SHOULD

FR-403: Quick Full Flag. `/bp:quick --full` MUST add plan-checking and verification steps to the quick flow for higher-risk ad-hoc tasks. — Priority: SHOULD

FR-501: Natural Language Input. `/bp:specify` MUST capture requirements in plain natural language. Technical implementation details MUST be explicitly prohibited at this stage. For beginner users, MUST use guided sequential questions (wizard mode). — Priority: MUST

FR-502: Spec Output. The command MUST generate `spec.md` containing: user stories with acceptance criteria, functional requirements, non-functional requirements, assumptions, and a self-assessment against the Constitution. — Priority: MUST

FR-503: Clarification Flow. `/bp:specify` MUST offer clarification questions when ambiguities are detected, presenting a minimum of 3 numbered options per ambiguity. An "Other (free text)" option MUST always be included as the final choice. — Priority: SHOULD

FR-504a: Domain Awareness (Framework → Spec Author). When a Squad is active, the specify phase MUST inject domain-specific question templates into the `/bp:specify` workflow for the spec author. — Priority: MUST

FR-504b: Domain Awareness (Squad → End-User). Squad agent definitions MAY include domain-specific conversational question flows for end-users. The framework MUST support Squad-defined question flows in Web Bundle mode. — Priority: MUST

FR-505: Automation Maturity Advisor. During the Specify phase, the framework SHOULD evaluate the task against a 5-stage automation maturity model: (1) Manual, (2) Documented Skill, (3) Alias/Shortcut, (4) Heartbeat Check, (5) Full Automation. — Priority: SHOULD

FR-601: Automated Research. `/bp:plan` MUST spawn parallel research agents to investigate the domain, technology stack, and existing codebase before generating the plan. — Priority: SHOULD

FR-602: Wave Analysis. The planner MUST analyze task dependencies and group them into execution waves. Vertical slices MUST be preferred over horizontal layers. — Priority: MUST

FR-603: Atomic Plans. Each plan file MUST contain a maximum of 2–3 tasks. Plans exceeding this limit MUST be automatically split. — Priority: MUST

FR-604: Model Profiles with Operation-Level Routing and Failover Chains. Users MUST be able to configure quality/balanced/budget profiles. Each profile MUST include a failover chain specifying fallback models with retry delays and max wait before escalation. — Priority: SHOULD

FR-605: Nyquist Validation with Multi-Perspective Analysis. Before execution, all plans MUST pass quality validation checking: completeness vs. spec, internal consistency, dependency correctness, and feasibility. MUST use 3–4 independent analysis perspectives. — Priority: SHOULD

FR-606: Non-Software Plans. For non-software domains, plans MUST clearly distinguish between human actions and AI agent actions, with checklists for human steps and automated execution for agent steps. — Priority: MUST

FR-701: Wave Execution. `/bp:execute` MUST execute plans in waves with subagent isolation. Each subagent receives a clean context window with only the relevant plan, task files, and necessary codebase context. — Priority: MUST

FR-702: Atomic Commits. Each completed task MUST produce exactly one Git commit with a standardized format: `type(phase-plan): description`. — Priority: MUST

FR-703: Recovery System. If a task fails, the system MUST: (a) track the failure, (b) attempt up to 3 different approaches automatically, (c) detect stuck loops, (d) rollback to the last functional state, (e) escalate to the user only after exhausting automated options. — Priority: MUST

FR-704: Goal-Backward Verification. After each wave, the system MUST generate a pass/fail report for each spec acceptance criterion relevant to the completed wave. Failed criteria MUST block progression and trigger a fix plan. — Priority: SHOULD

FR-705: Budget Guards. The framework MUST allow users to configure spending limits at three levels: per session, per phase, and per day. When a limit is reached, the system MUST pause execution and notify the user. — Priority: MUST

FR-801: Guided UAT. `/bp:verify` MUST walk the user through a structured acceptance test based on the spec's acceptance criteria, generating a pass/fail report per criterion. — Priority: MUST

FR-802: Fix Plan Generation. Failed verification items MUST automatically generate fix plans executable via `/bp:execute` without re-running the full pipeline. — Priority: SHOULD

FR-803: Memory Layer with Structured Feedback Loops. After verification, the system MUST automatically capture insights, patterns, and decisions in `.buildpact/memory/`. Implements progressive tiers: Tier 1 (Feedback Files v1.0 MUST), Tier 2 (Lessons Files v1.1 SHOULD), Tier 3 (Decisions Files v1.1 SHOULD). — Priority: MUST

FR-804: Memory Layer Free. The Memory Layer MUST be included in the open-source core at no cost. MUST NOT be gated behind a paid tier. — Priority: MUST

FR-901: 4-Tier Hierarchy. Each Squad MUST follow the hierarchy: Tier 0 (Chief/Orchestrator) → Tier 1 (Masters/Primary Specialists) → Tier 2 (Specialists/Niche Experts) → Tier 3 (Support/Utilities). — Priority: MUST

FR-902: 6-Layer Agent Anatomy. Each agent MUST define 6 layers: identity, persona, voice_dna, heuristics, examples (minimum 3), and handoffs. — Priority: MUST

FR-903: Voice DNA System with Mandatory 5-Section Template. Voice DNA MUST follow a mandatory 5-section template: (1) Personality Anchors, (2) Opinion Stance, (3) Anti-Patterns with Concrete Examples, (4) "Never Do" Rules, (5) Inspirational Anchors. Documentation MUST include a step-by-step creation guide. — Priority: MUST

FR-904: Squad Installation. `npx buildpact squad add <n>` MUST install a Squad from the community hub or local path. `npx buildpact squad create <n>` MUST scaffold a new Squad with all required files. — Priority: MUST

FR-905: Squad Validation. `/bp:squad validate` MUST check: structural completeness, Voice DNA consistency, heuristic coverage, example quality (min 3 per agent), and handoff graph validity. — Priority: MUST

FR-906: Lazy Agent Loading. In Agent Mode (v2.0), Squad agents MUST NOT all be loaded into context simultaneously. Only the Chief agent definition and a lightweight agent index (≤1KB) are loaded initially. In Prompt Mode (v1.0), the framework MUST provide documented guidance on manual agent loading best practices. — Priority: SHOULD

FR-907: Agent Autonomy Leveling System (L1–L4). Each agent MUST have an autonomy level: L1 (Observer), L2 (Contributor), L3 (Operator), L4 (Trusted). New agents MUST start at L1 or L2. System SHOULD suggest promotion after 7-day review with >85% approval, and suggest demotion if rejection rate >30% in rolling 7-day window. — Priority: SHOULD

FR-1001: Software Squad (Alpha, Public). PM, Architect, Developer, QA, Tech Writer. Based on BMAD v6 agent profiles with GSD execution patterns. Default Squad and reference implementation for community-created Squads. — Priority: MUST

FR-1002: Medical Marketing Squad (Private). Strategist, Copywriter (with CFM Voice DNA), Designer, Analytics. Includes CFM compliance checklists, ANVISA reference rules, WhatsApp CTA templates, Schema JSON-LD medical templates. Internal use only. — Priority: MUST

FR-1003: Scientific Research Squad (Private). Research Lead, Literature Reviewer, Data Analyst, Peer Reviewer, LaTeX Writer. Includes systematic review protocols, PRISMA checklists, statistical analysis plan templates. Internal use only. — Priority: SHOULD

FR-1004: Clinic Management Squad (Private). Operations Manager, Finance Analyst, Compliance Checker, Patient Flow Optimizer. Internal use only. — Priority: SHOULD

FR-1005: Agent Builder Squad (Public). Agent Designer, Workflow Architect, Tester. Enables meta-creation of new Squads. SHOULD be included in open-source distribution. — Priority: SHOULD

FR-1101: Public Hub Repository. A dedicated GitHub repository (`buildpact-squads`) MUST serve as the community hub for discovering, sharing, and installing community-created Squads. All Squads in the hub are free and open source under MIT license. — Priority: SHOULD

FR-1102: Contribution Flow. Contributors MUST be able to: fork, create a Squad, validate locally, and submit a Pull Request. Automated CI MUST run Squad validation on all PRs. — Priority: SHOULD

FR-1103: Squad Security Review. All community-submitted Squads MUST pass automated security checks: (a) no external URL references, (b) no executable code in YAML/Markdown, (c) no file system paths outside `.buildpact/`, (d) no prompt injection patterns. Maintainers MUST manually review flagged Squads. — Priority: MUST

FR-1201: AutoResearch Command. `/bp:optimize` MUST launch an autonomous experimentation loop on a specified target file with a defined metric. Available at Expert level. — Priority: MUST

FR-1202: Program File. Each optimization session MUST be governed by a `program.md` file defining: optimization goal, constraints, suggested experiment directions, and acceptance criteria. — Priority: MUST

FR-1203: Fixed-Budget Experiments. Each individual experiment MUST execute within a fixed time budget (default: 5 minutes). Total session has its own budget (default: 30 minutes, configurable up to 24 hours). — Priority: MUST

FR-1204: Git Ratchet Mechanism. After each experiment, the system MUST: run the metric function, compare to current best, commit if improved (standardized message format), revert if equal or worse. — Priority: MUST

FR-1205: Target File Size Constraint. Any file targeted for AutoResearch MUST be under 600 lines. Files exceeding this MUST be sharded first (FR-304). — Priority: MUST

FR-1206: Budget Guard Integration. The AutoResearch loop MUST respect the Budget Guards defined in FR-705. If cost limit is reached, the loop MUST pause, preserve results to date, and notify the user. — Priority: MUST

FR-1301: Code Metrics. For Software Squad: test pass rate, bundle size, Lighthouse score, build time, code coverage, type-check pass/fail. — Priority: MUST

FR-1302: Copy Metrics with Structured Evaluation Rubric. For Marketing Squad: readability score, compliance check pass rate, keyword density, CTA clarity score. Evaluator model MUST differ from generator model. — Priority: SHOULD

FR-1303: Agent Metrics. For Squad optimization: output quality score, Voice DNA consistency score, heuristic coverage rate, task completion rate across 10+ benchmark test inputs. — Priority: SHOULD

FR-1304: Custom Metrics. Users MUST be able to define custom metric scripts (any executable returning a numeric score to stdout). — Priority: MUST

FR-1401: Squad AutoResearch Mode. `/bp:optimize-squad <squad-name>` MUST launch an optimization loop targeting Squad agent definitions (Voice DNA, heuristics, examples). — Priority: SHOULD (v2.0)

FR-1402: Benchmark Sets. Each Squad SHOULD include a `benchmark/` directory with at least 10 input-output golden pairs. — Priority: SHOULD (v2.0)

FR-1403: Optimization Isolation. Squad optimization MUST occur on a dedicated Git branch (`optimize/{squad-name}/{timestamp}`). Only after human review are optimized definitions merged. — Priority: MUST

FR-1404: Optimization Report. After an optimization session, the system MUST generate `optimization-report.md` containing: experiments run, improvements found, changes made, before/after metric comparison, and diff of kept modifications. — Priority: MUST

### NonFunctional Requirements

NFR-01: Installation Speed. `npx buildpact init` MUST complete in under 60 seconds on a standard broadband connection. — Priority: MUST

NFR-02: Context Efficiency. Orchestrator commands MUST consume less than 15% of the model's context window. Individual agent payloads MUST be under 20KB of text. — Priority: MUST

NFR-03: Token Savings. Document Sharding MUST achieve at least 70% token reduction vs. monolithic document loading. Stretch target for v1.0 is 90%. — Priority: SHOULD

NFR-04: First-Value Time. A beginner user MUST achieve first useful output (a completed spec) within 10 minutes of installation. — Priority: MUST

NFR-05: Bilingual Parity. All user-facing text MUST be available in both PT-BR and EN with equal quality. No language should feel like a translation of the other. — Priority: MUST

NFR-06: Zero Jargon in Beginner Mode. In beginner mode, the framework MUST NOT use terms like: repository, branch, commit, YAML, merge, subagent, context window, orchestrator, or pipeline. — Priority: MUST

NFR-07: Recovery Resilience. The Recovery System MUST handle: task failure (3 retry strategies), session interruption (state persisted to disk), context overflow (automatic subagent delegation), and network errors (graceful degradation). — Priority: MUST

NFR-08: State Persistence. All project state MUST be stored in human-readable files (Markdown + JSON + YAML) in the `.buildpact/` directory. No databases, no binary files, no external services. — Priority: MUST

NFR-09: Runtime Support. Prompt Mode MUST support: Claude Code, Cursor Agent, Windsurf, Gemini CLI, Codex CLI, OpenCode, and web interfaces (Claude.ai, ChatGPT, Gemini). Agent Mode MUST support any environment with Node.js 18+. — Priority: MUST

NFR-10: OS Support. The CLI MUST work on macOS (ARM64/x64), Linux (x64/ARM64), and Windows (x64) without platform-specific workarounds. — Priority: MUST

NFR-11: Squad Extensibility. Any user MUST be able to create a custom Squad without modifying core framework code. Squad creation MUST require only YAML/Markdown files. — Priority: MUST

NFR-12: Agent-Agnostic Design. The framework MUST NOT hard-code dependencies on any specific AI model or provider. Model profiles MUST support any provider accessible via the selected runtime. — Priority: MUST

NFR-13: MIT License. The entire core framework, Software Squad, Agent Builder Squad, and community hub MUST be released under MIT license with no restrictive clauses. — Priority: MUST

NFR-14: Attribution. All components inspired by existing frameworks MUST include clear attribution in source comments and documentation. — Priority: MUST

NFR-15: Cache-Aware File Structure. All framework files loaded repeatedly across subagent sessions MUST be structured for maximum prompt cache efficiency. Target: >80% cache hit rate on static content. — Priority: SHOULD

NFR-16: Token Budget Transparency. The framework MUST provide, upon request, a breakdown of token consumption per component. The `/bp:token-audit` command SHOULD display this breakdown with actionable recommendations. — Priority: SHOULD

NFR-17: Contribution Architecture. The repository MUST include: `CONTRIBUTING.md` in both languages, a single-command dev environment bootstrap (`npm run dev`), and a clear module boundary map. — Priority: MUST

NFR-18: Code Review Standards. All PRs MUST include: a description of which FR/NFR the change addresses, tests covering changed behavior, and i18n strings for both languages if user-facing text is modified. — Priority: SHOULD

NFR-19: First-Contribution Path. The repository SHOULD maintain curated "good first issue" labels with clear scope, expected effort (<2 hours), and mentor assignment. Target: 5+ good-first-issue tickets at all times. — Priority: SHOULD

NFR-20: Architecture Decision Records (ADRs). Significant architectural decisions MUST be documented as ADRs in `docs/decisions/` following the MADR template format. — Priority: SHOULD

NFR-21: Execution Sandboxing. In Agent Mode (v2.0), all subagent-executed code MUST run within the host IDE's existing sandboxing mechanism. — Priority: MUST

NFR-22: Filesystem Permission Boundaries. Squad agents and pipeline operations MUST NOT access files outside the project directory and `.buildpact/` directory unless explicitly granted via Constitution rules. — Priority: MUST

NFR-23: Audit Trail. All pipeline actions MUST be logged to `.buildpact/audit/session-{timestamp}.log` with: timestamp, action type, agent responsible, files modified, and outcome. Audit logs MUST be human-readable and MUST NOT be deleted by any automated process. — Priority: MUST

NFR-24: Community Squad Security. Community-submitted Squads MUST be treated as untrusted input. The framework MUST validate Squad files against FR-1103 security checks before loading. Users MUST receive a warning when installing an unreviewed Squad. — Priority: MUST

NFR-25: Consent Model. Regardless of autonomy level, the following actions ALWAYS require explicit user consent: (a) modifying the Constitution, (b) deleting audit logs, (c) spending above configured budget limits, (d) modifying Squad agent definitions outside AutoResearch branches. — Priority: MUST

NFR-26: Project Decision Log. The project root MUST maintain `DECISIONS.md` (append-only log of significant decisions) and `STATUS.md` (living document of current project state). The framework's Web Bundle SHOULD include STATUS.md content automatically. — Priority: MUST

### Additional Requirements

**From Architecture — Starter Template & Infrastructure:**
- No opinionated third-party starter; BuildPact defines its own conventions as the reference implementation
- Node.js minimum version: 20.x (18.x reached EOL April 2025); Node.js 22.x recommended as current LTS
- TypeScript 5.x with strict mode enabled
- ESM output (`"type": "module"` in package.json) with npx-compatible binary entry via `bin` field

**From Architecture — Build & Testing Infrastructure:**
- tsdown ~0.20.3 (official successor to tsup) — zero-config, powered by Rolldown/Oxc; outputs ESM + CJS dual bundle + .d.ts declarations
- Markdown/YAML agent template files shipped as-is (no compilation required)
- Vitest 4.x with workspace config (monorepo-ready for v2.0)
- GitHub Actions CI/CD: `test.yml` (Vitest on PR/push), `publish.yml` (npm publish on semver tag), `squad-validate.yml` (Squad structure validation on buildpact-squads PRs)

**From Architecture — Package Structure & Distribution:**
- Single package structure for Alpha → v1.0 (simpler, faster iteration); monorepo (packages/cli + packages/core + packages/agent-mode) planned for v2.0
- Software Squad bundled copy shipped inside npm package for offline/zero-config use; `buildpact-squads` repo is source of truth with sync mechanism
- VitePress documentation site on GitHub Pages with native PT-BR + EN i18n support
- Community Squads in separate `buildpact-squads` repo from Alpha

**From Architecture — Core Source Structure (`src/`):**
- `src/contracts/` — TypeScript interfaces only (no implementation): task.ts, squad.ts, profile.ts, budget.ts, i18n.ts
- `src/cli/` — TUI installer entry point using @clack/prompts; zero business logic in entry point
- `src/commands/` — Slash command handlers with lazy loading registry; kebab-case internal naming
- `src/commands/*.md` — Markdown orchestrator files (≤300 lines hard limit per file)
- `src/engine/` — Pipeline orchestrator, subagent isolation, wave execution
- `src/foundation/` — Constitution loader, context manager, document sharding, i18n loader, audit logger
- `src/squads/` — Squad loader, validator, hook runner, lazy loader
- `src/memory/` — Feedback/lessons/decisions tier system
- `src/optimize/` — AutoResearch loop + Git Ratchet abstraction (independent testable module, ≥80% test coverage)
- `src/utils/` — Shared utilities including file-lock mechanism (≤30 lines, 5-minute TTL for `.lock` files)

**From Architecture — Orchestrator Architecture:**
- Dual-layer Orchestrator: Markdown layer is specification/source of truth; TypeScript layer is executor; TypeScript always invokes Markdown (never duplicates logic)
- Command Registry with lazy loading using dynamic imports

**From Architecture — File System & State Persistence Patterns:**
- Constitution — read-only at runtime
- project-context.md — read-write (both modes)
- config.yaml — read-only at runtime (only installer writes)
- memory/feedback/*.json — read-write with FIFO max 30 entries
- audit/session-*.log — append-only, never deleted by automation
- specs/ — read-write, auto-sharded at 500 lines
- squads/*/agents/*.md — read-only, modified only via explicit squad commands
- optimize/*/results.tsv — append-only + file-lock with 5-minute TTL

**From Architecture — i18n Architecture:**
- Two-layer separation: Layer 1 (UI strings in `locales/pt-br.yaml` + `locales/en.yaml`), Layer 2 (Domain rules in `squads/{domain}/data/compliance-rules.yaml`)
- PT-BR Squads carry regulatory context (CFM, ANVISA) with no EN equivalent; system must support language-conditional business logic

**From Architecture — Squad Plugin API:**
- 6 pipeline hook points: `on_specify_start`, `on_specify_complete`, `on_plan_complete`, `on_execute_start`, `on_execute_complete`, `on_verify_complete`
- Each hook is a Markdown file ≤2KB (context budget constraint)

**From Architecture — Security & Validation:**
- Squad Validator as pure, side-effect-free module with independently testable functions: validateNoExternalUrls(), validateNoExecutableCode(), validatePathBoundaries(), validateNoPromptInjection()
- Validation behavior by context: Block (community source), Warn (local path), Report only (buildpact doctor), Fail hard (CI/CD)

**From Architecture — AutoResearch Isolation & Git Ratchet:**
- All AutoResearch operations run on isolated branch: `optimize/{target-type}/{session-name}/{timestamp}`
- Git Ratchet: independent TypeScript module (`src/optimize/ratchet.ts`), ≥80% Vitest coverage
- Human review required before merge to main — no auto-merge
- ADR-001 required before implementation begins

**From Architecture — Implementation Sequence (Alpha-critical, strict dependency order):**
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

### UX Design Requirements

_No UX Design document was provided for this project._

### FR Coverage Map

FR-101: Epic 1 — One-command installation (npx buildpact init)
FR-102: Epic 1 — Interactive bilingual TUI installer
FR-103: Epic 1 — Diagnostic tool (buildpact doctor)
FR-104: Epic 1 — Cross-IDE configuration generation
FR-301: Epic 1 — Orchestrator size limit (≤300 lines, ≤15% context)
FR-302: Epic 1 — Subagent isolation with mandatory session reset
FR-303: Epic 1 — Context and cost monitor (status bar, WARNING/CRITICAL alerts)
FR-304: Epic 1 — Document sharding (auto-shard at 500 lines)
FR-201: Epic 2 — Constitution creation (/bp:constitution)
FR-202: Epic 2 — Constitution enforcement on all pipeline commands
FR-203: Epic 2 — Constitution versioning and update checklist
FR-401: Epic 3 — Quick command (/bp:quick)
FR-402: Epic 3 — Quick --discuss flag
FR-403: Epic 3 — Quick --full flag
FR-501: Epic 4 — Natural language spec capture (/bp:specify)
FR-502: Epic 4 — Spec output (spec.md with user stories + AC)
FR-503: Epic 4 — Clarification flow with numbered options
FR-504a: Epic 4 — Domain awareness for spec author (Squad question injection)
FR-504b: Epic 4 — Domain awareness for end-user (Squad Web Bundle flows)
FR-505: Epic 4 — Automation Maturity Advisor
FR-601: Epic 5 — Automated parallel research agents (/bp:plan)
FR-602: Epic 5 — Wave analysis (dependency grouping, vertical slices)
FR-603: Epic 5 — Atomic plans (max 2–3 tasks per file)
FR-604: Epic 5 — Model profiles with operation-level routing and failover chains
FR-605: Epic 5 — Nyquist validation with multi-perspective analysis
FR-606: Epic 5 — Non-software plan support (human vs. AI action distinction)
FR-701: Epic 6 — Wave execution with subagent isolation (/bp:execute)
FR-702: Epic 6 — Atomic commits per task (standardized format)
FR-703: Epic 6 — Recovery system (3 retries, rollback, escalation)
FR-704: Epic 6 — Goal-backward verification per wave
FR-705: Epic 6 — Budget guards (per session, per phase, per day)
FR-801: Epic 7 — Guided UAT (/bp:verify)
FR-802: Epic 7 — Fix plan generation for failed verification items
FR-803: Epic 7 — Memory Layer with structured feedback loops (Tiers 1–3)
FR-804: Epic 7 — Memory Layer free in open-source core
FR-901: Epic 8 — 4-tier Squad hierarchy
FR-902: Epic 8 — 6-layer agent anatomy
FR-903: Epic 8 — Voice DNA system with mandatory 5-section template
FR-904: Epic 8 — Squad installation and scaffolding commands
FR-905: Epic 8 — Squad validation (/bp:squad validate)
FR-906: Epic 8 — Lazy agent loading (Agent Mode v2.0)
FR-907: Epic 8 — Agent autonomy leveling system (L1–L4)
FR-1001: Epic 9 — Software Squad (public, Alpha)
FR-1002: Epic 9 — Medical Marketing Squad (private, Beta)
FR-1003: Epic 9 — Scientific Research Squad (private, Beta)
FR-1004: Epic 9 — Clinic Management Squad (private, Beta)
FR-1005: Epic 9 — Agent Builder Squad (public, Beta)
FR-105: Epic 10 — Web Bundle export (/bp:export-web)
FR-105a: Epic 10 — Token budget management per platform
FR-105b: Epic 10 — Progressive compression strategy
FR-105c: Epic 10 — Conversational interface adaptation for web
FR-105d: Epic 10 — Bundle versioning and staleness detection
FR-105e: Epic 10 — Graceful degradation tiers
FR-106: Epic 10 — Prompt-to-Agent Mode migration
FR-1101: Epic 11 — Public community hub repository (buildpact-squads)
FR-1102: Epic 11 — Contribution flow with automated CI validation
FR-1103: Epic 11 — Squad security review (automated + maintainer review)
FR-1201: Epic 12 — AutoResearch command (/bp:optimize)
FR-1202: Epic 12 — Program file (program.md) per optimization session
FR-1203: Epic 12 — Fixed-budget experiments (default 5 min per experiment)
FR-1204: Epic 12 — Git Ratchet mechanism (commit if improved, revert if not)
FR-1205: Epic 12 — Target file size constraint (≤600 lines)
FR-1206: Epic 12 — Budget Guard integration in AutoResearch loop
FR-1301: Epic 12 — Code metrics for Software Squad
FR-1302: Epic 12 — Copy metrics with structured evaluation rubric
FR-1303: Epic 12 — Agent metrics for Squad optimization
FR-1304: Epic 12 — Custom metrics (user-defined executable scripts)
FR-1401: Epic 13 — Squad AutoResearch mode (/bp:optimize-squad)
FR-1402: Epic 13 — Benchmark sets (10+ golden input-output pairs)
FR-1403: Epic 13 — Optimization isolation on dedicated Git branch
FR-1404: Epic 13 — Optimization report (optimization-report.md)
FR-1501: Epic 18 — Documentation site (VitePress + i18n)
FR-1502: Epic 18 — Squad creation guide
FR-1503: Epic 18 — Migration guides (BMAD/GSD/SpecKit)
FR-1504: Epic 18 — Performance budget validation
FR-1505: Epic 19 — Non-interactive CI mode (--ci flag)
FR-1506: Epic 19 — GitHub Actions adapter
FR-1507: Epic 19 — Webhook notifications
FR-1508: Epic 20 — Hub search & discovery
FR-1509: Epic 20 — Squad quality scores
FR-1510: Epic 21 — Onboarding learn command
FR-1511: Epic 21 — GitHub Sponsors & contributor infrastructure
FR-1512: Epic 21 — Release validation & readonly mode
FR-2001: Epic 22 — Agent Mode CLI supervisor
FR-2002: Epic 22 — Auto-advance walk-away execution
FR-2003: Epic 22 — Event bus (pub/sub + advanced routing)
FR-2004: Epic 22 — Real-time execution dashboard
FR-2005: Epic 22 — State persistence & recovery
FR-2006: Epic 22 — Prompt-to-agent migration command
FR-2007: Epic 23 — Squad optimization with A/B testing
FR-2008: Epic 23 — Domain-specific benchmark sets
FR-2009: Epic 23 — Optimization isolation
FR-2010: Epic 23 — Statistical optimization reports
FR-2011: Epic 24 — RBAC middleware & permission guards
FR-2012: Epic 24 — Centralized constitution management
FR-2013: Epic 24 — Marketplace ratings & reviews
FR-2014: Epic 24 — Squad certification program
FR-2015: Epic 25 — Cross-project learning
FR-2016: Epic 25 — Multi-language localization
FR-2017: Epic 25 — Domain expansion packs
FR-2018: Epic 25 — Org-level memory tiers

## Epic List

### Epic 1: Project Foundation & Setup
Framework users can install BuildPact from zero to first working session in under 2 minutes — with IDE configurations generated automatically, bilingual support, real-time context monitoring, subagent isolation, and document sharding built in from the start.
**FRs covered:** FR-101, FR-102, FR-103, FR-104, FR-301, FR-302, FR-303, FR-304, NFR-26
**Stories:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
**Phase:** Alpha-critical
**Personas:** B, C, D

### Epic 2: Project Governance via Constitution
Teams can define immutable project rules — coding standards, compliance requirements (CFM, LGPD, HIPAA), architectural constraints, and quality gates — and have every subsequent AI action automatically validated against them.
**FRs covered:** FR-201, FR-202, FR-203
**Phase:** Alpha-critical
**Personas:** B, C

### Epic 3: Quick Flow — Instant Task Execution
Developers can go from a natural language description of a bug fix, config tweak, or small feature directly to a committed change in under 5 minutes, skipping all planning ceremony.
**FRs covered:** FR-401, FR-402, FR-403
**Phase:** Alpha
**Personas:** B primarily

### Epic 4: Specification Pipeline (/bp:specify)
Users can transform a natural language idea into a structured spec with user stories and acceptance criteria — with domain-aware questions, ambiguity resolution, and automatic Constitution compliance check.
**FRs covered:** FR-501, FR-502, FR-503, FR-504a, FR-504b, FR-505
**Phase:** Alpha-critical
**Personas:** B, C, D

### Epic 5: Planning Pipeline (/bp:plan)
Users can generate a validated, wave-based execution plan before writing a single line of code — with parallel research agents, Nyquist multi-perspective validation, and model cost optimization built in.
**FRs covered:** FR-601, FR-602, FR-603, FR-604, FR-605, FR-606
**Phase:** Alpha-critical
**Personas:** B, C

### Epic 6: Execution Pipeline (/bp:execute)
Users can execute plans in wave-parallel fashion with atomic Git commits, crash recovery with 3-retry strategies, goal-backward verification per wave, and hard budget guards — without losing work.
**FRs covered:** FR-701, FR-702, FR-703, FR-704, FR-705
**Phase:** Alpha/Beta
**Personas:** B, C

### Epic 7: Verification & Memory Layer (/bp:verify)
Users can validate every built feature against its acceptance criteria through guided UAT, auto-generate fix plans for failures, and persistently capture patterns and decisions that make future sessions smarter.
**FRs covered:** FR-801, FR-802, FR-803, FR-804
**Stories:** 7.1, 7.2, 7.3 (Alpha), 7.4 (Beta), 7.5 (v1.0)
**Phase:** v1.0
**Personas:** B, C, D

### Epic 8: Squad Architecture — Build Domain AI Teams
Domain experts can design, validate, and deploy specialized multi-agent squads — each with 6-layer anatomy, Voice DNA cloned from real specialists, autonomy leveling, and an automated structural validator.
**FRs covered:** FR-901, FR-902, FR-903, FR-904, FR-905, FR-906, FR-907
**Stories:** 8.1, 8.2, 8.3, 8.4, 8.5, 8.6 (v2.0)
**Phase:** Alpha (core) + v2.0 (Lazy Loading)
**Personas:** D primarily, also C

### Epic 9: Pre-Built Squads — Immediate Domain Value
Users can immediately start working in their domain using ready-to-use, production-grade squad teams: Software Squad (public, Alpha), Medical Marketing Squad (private, Beta), Scientific Research Squad (private, Beta), Clinic Management Squad (private, Beta), and Agent Builder Squad (public, Beta).
**FRs covered:** FR-1001, FR-1002, FR-1003, FR-1004, FR-1005
**Stories:** 9.1, 9.2, 9.3 (Beta), 9.4 (Beta), 9.5
**Phase:** Alpha (Software Squad) + Beta (others)
**Personas:** All

### Epic 10: Web Bundle — Non-Technical User Enablement
Squad creators can export a single-file Web Bundle that enables non-technical professionals (doctors, marketers, clinic managers) to interact with AI agents through Claude.ai or ChatGPT — in Portuguese, with no setup whatsoever.
**FRs covered:** FR-105, FR-105a, FR-105b, FR-105c, FR-105d, FR-105e, FR-106
**Phase:** Alpha-critical
**Personas:** D (creates), A (receives)

### Epic 11: Community Hub — Squad Ecosystem
Community members can discover, publish, and safely install community-created Squads from a dedicated GitHub repository — with automated CI validation, security checks, and maintainer review gates ensuring quality.
**FRs covered:** FR-1101, FR-1102, FR-1103
**Phase:** Beta+
**Personas:** D primarily, also B

### Epic 12: AutoResearch — Autonomous Optimization Engine
Expert users can launch autonomous, budget-controlled experimentation loops that optimize code quality, marketing copy, or agent behavior — with a Git Ratchet mechanism that only commits proven improvements and generates full optimization reports.
**FRs covered:** FR-1201, FR-1202, FR-1203, FR-1204, FR-1205, FR-1206, FR-1301, FR-1302, FR-1303, FR-1304
**Stories:** 12.0 (pre-requisite ADR), 12.1, 12.2, 12.3, 12.4, 12.5
**Phase:** v1.0
**Personas:** B, C, D (Expert level)

### Epic 13: Self-Optimizing Squads (v2.0)
Squad creators can run automated benchmark-driven optimization loops that continuously improve their agents' Voice DNA, heuristics, and examples — on isolated Git branches with human review before any changes reach production.
**FRs covered:** FR-1401, FR-1402, FR-1403, FR-1404
**Phase:** v2.0
**Personas:** D

## Epic 1: Project Foundation & Setup

Framework users can install BuildPact from zero to first working session in under 2 minutes — with IDE configurations generated automatically, bilingual support, real-time context monitoring, subagent isolation, and document sharding built in from the start.

### Story 1.1: Project Initialization via CLI

As a framework user (developer, domain expert, or tech lead),
I want to run `npx buildpact init <project-name>` and complete a guided TUI setup,
So that I have a complete, IDE-specific project structure ready in under 2 minutes with no manual configuration.

**Acceptance Criteria:**

**Given** I have Node.js 20+ installed
**When** I run `npx buildpact init my-project`
**Then** the bilingual TUI launches with language selection (PT-BR / EN)
**And** the installer prompts sequentially for: domain, IDE(s) (multi-select), experience level, and optional Squad installation
**And** all selected IDE config files are generated (`.claude/commands/`, `.cursor/rules/`, `.gemini/`, `.codex/` as applicable)
**And** a `.buildpact/` directory is created with `constitution.md` scaffold, `config.yaml`, `project-context.md`, and `audit/` directory
**And** the entire installation completes within 60 seconds on standard broadband

**Given** I select multiple IDEs (e.g., Claude Code + Cursor)
**When** installation completes
**Then** configuration files for all selected IDEs are generated simultaneously with correct format for each
**And** `CLAUDE.md` and `.cursorrules` are generated where applicable

**Given** I run `npx buildpact init` with no internet connection
**When** the installer attempts to fetch remote Squad templates
**Then** it falls back to the bundled Software Squad included in the npm package
**And** reports which resources were unavailable and which were served from the bundle

---

### Story 1.2: Diagnostic Health Check

As a developer troubleshooting or verifying a BuildPact installation,
I want to run `buildpact doctor` to check the health of my entire setup,
So that I can quickly identify and fix configuration issues without trial and error.

**Acceptance Criteria:**

**Given** I have an initialized BuildPact project
**When** I run `buildpact doctor`
**Then** it checks: Node.js version (≥20.x), Git availability, IDE configuration file validity, Squad structural integrity, and `.buildpact/` file consistency
**And** outputs results in my configured language (PT-BR or EN)
**And** marks each check as ✅ PASS, ⚠️ WARN, or ❌ FAIL with a specific message

**Given** `buildpact doctor` detects a misconfigured or missing IDE file
**When** the diagnosis completes
**Then** the output includes an actionable remediation step explaining exactly what to fix

---

### Story 1.3: Subagent Isolation Architecture

As a developer running BuildPact pipeline commands,
I want all heavy computation delegated to isolated subagents with clean context windows,
So that each agent operates with focused context only and I never experience quality degradation from context contamination.

**Acceptance Criteria:**

**Given** a pipeline operation requires heavy computation (planning, research, execution)
**When** the framework dispatches it
**Then** it is delegated to a subagent via Task() dispatch receiving only the specific task payload
**And** the subagent does NOT inherit accumulated orchestrator context
**And** every orchestrator command file is ≤300 lines and consumes ≤15% of the model's context window

**Given** any subagent session begins
**When** the task payload is assembled
**Then** it contains only: the relevant plan or spec file, task-specific context, and necessary codebase context — nothing more

---

### Story 1.4: Real-Time Context & Cost Monitoring

As a developer running BuildPact commands in a CLI environment,
I want a real-time status bar showing context usage percentage and estimated cost,
So that I can make informed decisions about model usage and catch context overflow before it happens.

**Acceptance Criteria:**

**Given** I am running a BuildPact command in a CLI environment
**When** the session context usage exceeds 50%
**Then** a WARNING alert is displayed in the status bar
**And** when usage exceeds 75%, a CRITICAL alert appears with a suggestion to delegate or shard

**Given** I am in an active pipeline session
**When** the status bar updates
**Then** it shows estimated cost for the current phase and accumulated cost for the current milestone

---

### Story 1.5: Automatic Document Sharding

As a developer working with large specs, plans, or PRDs,
I want documents exceeding 500 lines to be automatically split into focused atomic files with a navigation index,
So that each AI agent loads only the content it needs and stays well within context budget.

**Acceptance Criteria:**

**Given** a spec or plan document reaches 500 lines during generation
**When** sharding is triggered
**Then** the document is split into atomic section files organized by epic/section
**And** an `index.md` is generated with navigation links to each shard
**And** the original file path serves as the index entry point

**Given** sharding has been applied to a document
**When** a pipeline agent loads a specific section
**Then** it loads only the relevant shard, not the full document
**And** token consumption for that agent load is at least 70% lower than the monolithic equivalent

---

### Story 1.6: Project Decision Log (DECISIONS.md + STATUS.md)

As a developer working across multiple AI-assisted sessions,
I want the project root to maintain a DECISIONS.md and STATUS.md that restore full context at the start of each new session,
So that no context or decision history is lost between sessions.

**Acceptance Criteria:**

**Given** I initialize a new BuildPact project
**When** the setup completes
**Then** both `DECISIONS.md` (append-only log of significant decisions) and `STATUS.md` (living document of current project state) are created in the project root

**Given** I make a significant decision during a pipeline session
**When** I update DECISIONS.md
**Then** the entry is appended (never overwrites previous entries) with: date, decision made, rationale, and affected artifacts

**Given** a new AI-assisted session begins
**When** I reference DECISIONS.md and STATUS.md
**Then** the AI agent has full context of all previous decisions and current project state without needing prior conversation history

**Given** a Web Bundle is generated (Epic 10)
**When** the bundle is exported
**Then** STATUS.md content is automatically included in the bundle

---

## Epic 2: Project Governance via Constitution

Teams can define immutable project rules — coding standards, compliance requirements (CFM, LGPD, HIPAA), architectural constraints, and quality gates — and have every subsequent AI action automatically validated against them.

### Story 2.1: Create and Edit Project Constitution

As a tech lead or developer,
I want to run `/bp:constitution` to create or update my project's immutable rules,
So that all AI pipeline actions automatically respect my coding standards, compliance requirements, and architectural constraints.

**Acceptance Criteria:**

**Given** I run `/bp:constitution` in an initialized project
**When** the command executes
**Then** a guided flow helps me define: coding standards, compliance requirements (CFM, ANVISA, LGPD, HIPAA as applicable), architectural constraints, quality gates, and domain-specific rules
**And** the result is saved to `.buildpact/constitution.md`

**Given** a Constitution already exists
**When** I run `/bp:constitution` again
**Then** I can view the current Constitution and make targeted edits without rewriting it from scratch
**And** all changes are persisted to `.buildpact/constitution.md`

**Given** the Constitution is saved
**When** any subsequent pipeline command runs
**Then** the Constitution is automatically loaded and injected into every subagent context

---

### Story 2.2: Automatic Constitution Enforcement

As a developer running pipeline commands,
I want every specify, plan, and execute action to automatically validate against the Constitution,
So that no AI-generated output can violate my project's established rules without my knowledge.

**Acceptance Criteria:**

**Given** a Constitution exists in `.buildpact/constitution.md`
**When** I run `/bp:specify`, `/bp:plan`, or `/bp:execute`
**Then** the Constitution is injected into the subagent context automatically
**And** the output is validated against Constitution rules before being accepted

**Given** an AI-generated output violates a Constitution principle
**When** the violation is detected
**Then** a warning is generated referencing the specific violated principle by name
**And** the user is informed of the violation with a clear explanation before the output is finalized

**Given** a pipeline action would modify the Constitution itself
**When** the action is attempted at any autonomy level
**Then** explicit user consent is required — this action is never automated

**Given** I am in Beginner experience level and an AI-generated output violates a Constitution principle
**When** the violation is detected
**Then** the warning message uses plain language with no technical jargon (no terms like "Constitution principle", "FR-202", "orchestrator")
**And** the message explains what the issue is and what I should do next in simple terms appropriate for a first-time user

---

### Story 2.3: Constitution Versioning & Change Tracking

As a tech lead managing a team project,
I want every Constitution change to generate an update checklist,
So that I know exactly what changed, why, and which downstream artifacts need review.

**Acceptance Criteria:**

**Given** I modify the Constitution via `/bp:constitution`
**When** changes are saved
**Then** a `constitution_update_checklist.md` is generated (or appended) tracking: what changed, the stated reason, and which downstream artifacts (specs, plans, squads) may need review

**Given** the update checklist is generated
**When** I open it
**Then** it lists all previously generated specs and plans that reference the changed principles with a recommended review action for each

---

## Epic 3: Quick Flow — Instant Task Execution

Developers can go from a natural language description of a bug fix, config tweak, or small feature directly to a committed change in under 5 minutes, skipping all planning ceremony.

### Story 3.1: Quick Command — Zero-Ceremony Execution

As a developer with a small, well-defined task,
I want to run `/bp:quick <description>` and go directly from natural language to a committed change,
So that I can fix bugs and make small improvements in under 5 minutes without going through the full planning pipeline.

**Acceptance Criteria:**

**Given** I run `/bp:quick "fix the null pointer in user login"`
**When** the command executes
**Then** the framework generates a minimal spec, executes the change, and produces exactly one atomic Git commit
**And** the entire flow completes in under 5 minutes
**And** the Constitution is still validated even in quick mode
**And** the commit message follows the standardized format `type(quick): description`

**Given** the quick command executes successfully
**When** I review the Git history
**Then** there is exactly one new commit with a clear description of what was changed and why

---

### Story 3.2: Quick Flow with Lightweight Context Gathering

As a developer with a task that needs a bit of clarification before execution,
I want to use `/bp:quick --discuss` to answer 3–5 targeted questions before the change is made,
So that I get a better result without entering the full planning pipeline.

**Acceptance Criteria:**

**Given** I run `/bp:quick --discuss "add rate limiting to the API"`
**When** the discuss flow begins
**Then** the framework asks 3–5 focused clarifying questions relevant to the task
**And** each question presents numbered options with an "Other (free text)" option as the final choice
**And** after my answers, it proceeds directly to execution without entering the full plan/specify pipeline

**Given** I answer the clarifying questions
**When** execution completes
**Then** the output reflects my specific answers, not generic assumptions

---

### Story 3.3: Quick Flow with Plan Verification

As a developer working on a higher-risk small change,
I want to use `/bp:quick --full` to add plan-checking and verification to the quick flow,
So that I get safety guarantees without committing to the full multi-phase pipeline.

**Acceptance Criteria:**

**Given** I run `/bp:quick --full "migrate users table to add soft delete"`
**When** the full quick flow executes
**Then** it generates a minimal plan, validates it with a lightweight 2-perspective consistency check (completeness vs. stated goal + dependency correctness), executes the change, and runs a verification pass against the stated goal
**And** if verification fails, a fix plan is automatically generated and offered for execution

**Given** the --full flag is used and plan validation detects a risk
**When** the risk is identified
**Then** the user is notified before execution proceeds with the option to abort or continue

---

## Epic 4: Specification Pipeline (/bp:specify)

Users can transform a natural language idea into a structured spec with user stories and acceptance criteria — with domain-aware questions, ambiguity resolution, and automatic Constitution compliance check.

### Story 4.1: Natural Language Specification Capture

As a developer or domain expert,
I want to run `/bp:specify` and describe what I need in plain natural language,
So that the framework produces a structured `spec.md` with user stories and acceptance criteria without me having to know any technical implementation details.

**Acceptance Criteria:**

**Given** I run `/bp:specify "add user authentication with email and Google OAuth"`
**When** the specify flow begins
**Then** the framework accepts plain natural language input and explicitly rejects any attempt to describe technical implementation details at this stage
**And** for beginner users, a guided wizard presents sequential questions rather than a free-text prompt

**Given** the specification flow completes
**When** `spec.md` is generated
**Then** it contains: user stories, acceptance criteria in Given/When/Then format, functional requirements, non-functional requirements, assumptions, and a self-assessment against the active Constitution
**And** the spec is saved to `.buildpact/specs/`

---

### Story 4.2: Ambiguity Detection and Clarification Flow

As a developer describing a requirement with inherent ambiguities,
I want the framework to detect unclear points and offer me structured choices to resolve them,
So that the final spec reflects my actual intent rather than the framework's best guess.

**Acceptance Criteria:**

**Given** `/bp:specify` detects an ambiguity in my description
**When** the clarification flow is triggered
**Then** the framework presents at least 3 numbered options per detected ambiguity
**And** an "Other (free text)" option is always the final choice
**And** my selections are incorporated into the generated `spec.md`

**Given** no ambiguities are detected
**When** the spec is generated
**Then** the framework proceeds directly to spec generation without unnecessary clarification questions

---

### Story 4.3: Domain-Aware Specification with Squad Integration

As a developer or Squad creator working in a specific domain,
I want `/bp:specify` to inject domain-specific question templates when a Squad is active,
So that my spec automatically captures domain constraints without me having to know them upfront.

**Acceptance Criteria:**

**Given** I have a Squad active (e.g., Software Squad or Medical Marketing Squad)
**When** I run `/bp:specify`
**Then** the framework injects domain-specific question templates relevant to that Squad's domain into the specify flow
**And** the generated `spec.md` includes domain-specific constraints and compliance notes drawn from my answers

**Given** a Web Bundle is active targeting Persona A end-users
**When** the specify-equivalent flow runs inside the bundle
**Then** the Squad's defined conversational question flows are used instead of the standard framework questions
**And** the flow is presented in the user's language with no technical jargon

---

### Story 4.4: Automation Maturity Assessment

As a developer deciding how to implement a task,
I want `/bp:specify` to evaluate my task against a 5-stage automation maturity model and recommend the right level,
So that I don't over-engineer manual tasks or under-engineer tasks that deserve full automation.

**Acceptance Criteria:**

**Given** I complete the specification for a task
**When** the Automation Maturity Advisor runs
**Then** it evaluates the task against 5 stages: Manual, Documented Skill, Alias/Shortcut, Heartbeat Check, Full Automation
**And** recommends the appropriate stage based on: task frequency, predictability, human decision requirements, and cost-benefit heuristic
**And** the recommendation is included as a section in `spec.md` with a brief justification

**Given** the advisor recommends a stage below Full Automation
**When** I review the recommendation
**Then** I can override it and proceed with a higher stage, with my override noted in the spec

---

## Epic 5: Planning Pipeline (/bp:plan)

Users can generate a validated, wave-based execution plan before writing a single line of code — with parallel research agents, Nyquist multi-perspective validation, and model cost optimization built in.

### Story 5.1: Automated Parallel Research Before Planning

As a developer starting the planning phase,
I want `/bp:plan` to automatically spawn parallel research agents that investigate my domain, tech stack, and codebase before generating the plan,
So that my plan is grounded in real context rather than assumptions.

**Acceptance Criteria:**

**Given** I run `/bp:plan` after completing a spec
**When** the planning phase begins
**Then** parallel research agents are spawned to investigate: the relevant technology stack, the existing codebase (if applicable), and domain-specific constraints from the active Squad
**And** each research agent runs in an isolated subagent context
**And** the research results are consolidated and used as input to plan generation

**Given** research agents complete their investigation
**When** the plan is generated
**Then** it references specific findings from the research (e.g., existing patterns in the codebase, relevant library APIs, domain constraints)

---

### Story 5.2: Wave-Based Plan Generation

As a developer planning a multi-task feature,
I want `/bp:plan` to analyze task dependencies and group them into sequential execution waves with parallel tasks within each wave,
So that independent work runs in parallel and dependent work waits for its prerequisites — maximizing speed without race conditions.

**Acceptance Criteria:**

**Given** a spec with multiple tasks of varying dependencies
**When** the planner analyzes the dependency graph
**Then** it groups independent tasks into the same wave and places dependent tasks in subsequent waves
**And** vertical slices (full feature slices) are preferred over horizontal layers

**Given** the wave structure is generated
**When** individual plan files are created
**Then** each plan file contains a maximum of 2–3 tasks
**And** any plan exceeding this limit is automatically split into additional plan files

---

### Story 5.3: Model Profile Configuration

As a tech lead managing AI costs,
I want to configure model profiles that assign different AI models to different pipeline phases,
So that I use expensive models only where quality matters and cheaper models for routine work — with automatic failover if a model is unavailable.

**Acceptance Criteria:**

**Given** I configure a model profile in `config.yaml` (quality/balanced/budget)
**When** `/bp:plan` or any pipeline command executes
**Then** the framework uses the model specified for that phase in the active profile
**And** if the primary model is unavailable, it automatically falls back to the next model in the failover chain with configured retry delay and max wait before escalation

**Given** I configure operation-level routing in my profile
**When** a phase executes operations of different types (e.g., research vs. plan writing)
**Then** the framework applies the correct model per operation type within the phase

---

### Story 5.4: Nyquist Multi-Perspective Plan Validation

As a developer who wants confidence before execution begins,
I want all generated plans to pass through a multi-perspective quality validation,
So that gaps, inconsistencies, and risks are caught at planning time — not mid-execution.

**Acceptance Criteria:**

**Given** a plan is generated by `/bp:plan`
**When** Nyquist validation runs
**Then** 3–4 independent analysis perspectives evaluate the plan for: completeness vs. spec, internal consistency, dependency correctness, and feasibility
**And** a validation report is generated listing any issues found per perspective

**Given** Nyquist validation finds critical issues
**When** the report is presented
**Then** execution is blocked until issues are resolved or explicitly overridden by the user
**And** the user can request automatic plan revision to address the flagged issues

---

### Story 5.5: Non-Software Domain Planning

As a domain expert using BuildPact for non-software work,
I want `/bp:plan` to distinguish between tasks I must do manually and tasks the AI agent can execute automatically,
So that my plan is actionable across both human and AI steps without confusion about who does what.

**Acceptance Criteria:**

**Given** the active Squad is a non-software domain Squad
**When** `/bp:plan` generates a plan
**Then** each task is clearly tagged as either `[HUMAN]` (requires manual action) or `[AGENT]` (automatically executable)
**And** human steps include a checklist format for manual completion tracking
**And** agent steps include the standard automated execution format

**Given** a plan with mixed human and agent steps is executed
**When** an agent step completes and the next step is human
**Then** the system pauses and prompts the user to complete the human step before proceeding
**And** progress is persisted so the session can resume if interrupted

---

## Epic 6: Execution Pipeline (/bp:execute)

Users can execute plans in wave-parallel fashion with atomic Git commits, crash recovery with 3-retry strategies, goal-backward verification per wave, and hard budget guards — without losing work.

### Story 6.1: Wave-Parallel Execution with Subagent Isolation

As a developer executing a multi-wave plan,
I want `/bp:execute` to run each wave's tasks in parallel using isolated subagents,
So that independent tasks complete faster without sharing context that could cause drift or hallucination.

**Acceptance Criteria:**

**Given** I run `/bp:execute` with a plan containing multiple waves
**When** execution begins
**Then** tasks within the same wave are dispatched to independent subagents simultaneously
**And** each subagent receives a clean context window containing only: the relevant plan file, task-specific context, and necessary codebase context
**And** subagents do NOT share state or inherit accumulated orchestrator context
**And** subsequent waves only begin after all tasks in the current wave complete successfully

---

### Story 6.2: Atomic Git Commits per Task

As a developer reviewing execution history,
I want every completed task to produce exactly one Git commit with a standardized message,
So that my Git history is clean, traceable, and maps 1:1 to planned tasks.

**Acceptance Criteria:**

**Given** a subagent completes a task successfully
**When** the task result is finalized
**Then** exactly one Git commit is created for that task
**And** the commit message follows the standardized format: `type(phase-plan): description` (e.g., `feat(02-03): create login endpoint`)
**And** no task produces zero commits or multiple commits

**Given** I review the Git log after a full execution
**When** I count the commits
**Then** the number of commits equals the number of tasks that were executed

---

### Story 6.3: Crash Recovery with Automatic Retry

As a developer whose execution session fails mid-way,
I want the framework to automatically attempt up to 3 different recovery strategies before escalating to me,
So that transient failures don't require me to manually restart from scratch.

**Acceptance Criteria:**

**Given** a task fails during execution
**When** the failure is detected
**Then** the framework tracks the failure and attempts up to 3 different recovery approaches automatically
**And** if a stuck loop is detected, the loop is broken and a different strategy is tried
**And** if all 3 approaches fail, the framework rolls back to the last known good state and escalates to the user with a clear failure summary

**Given** the framework rolls back to the last good state
**When** I review the project
**Then** no partial or broken changes exist in the codebase
**And** the Git history reflects only successful commits up to the point of failure

---

### Story 6.4: Goal-Backward Wave Verification

As a developer who wants quality gates between waves,
I want the framework to verify each wave's output against the relevant spec acceptance criteria before proceeding to the next wave,
So that errors are caught early rather than compounding across multiple waves.

**Acceptance Criteria:**

**Given** a wave completes execution
**When** goal-backward verification runs
**Then** a pass/fail report is generated for each spec acceptance criterion whose scope tag matches the completed wave's task labels — relevance is determined by the wave tag assigned to each AC in the spec during planning
**And** a 100% pass rate is required before the next wave begins

**Given** one or more acceptance criteria fail wave verification
**When** the failure is reported
**Then** progression to the next wave is blocked
**And** a targeted fix plan is automatically generated for the failed criteria
**And** the fix plan can be executed via `/bp:execute` without re-running the full pipeline

---

### Story 6.5: Budget Guards

As a developer or tech lead managing AI spend,
I want to configure hard spending limits at session, phase, and day levels,
So that runaway executions are automatically paused before exceeding my budget — never silently.

**Acceptance Criteria:**

**Given** I configure budget limits in `config.yaml` (per_session_usd, per_phase_usd, per_day_usd)
**When** any pipeline execution reaches a configured limit
**Then** the framework pauses execution immediately and notifies the user with a clear cost summary: spend to date, limit hit, and remaining budget at other levels

**Given** execution is paused due to a budget limit
**When** I review my options
**Then** the framework offers: (1) increase the limit and resume, (2) continue with a cheaper model profile, (3) stop and preserve all results to date
**And** no further AI calls are made until I make a choice

---

## Epic 7: Verification & Memory Layer (/bp:verify)

Users can validate every built feature against its acceptance criteria through guided UAT, auto-generate fix plans for failures, and persistently capture patterns and decisions that make future sessions smarter.

### Story 7.1: Guided Acceptance Test (UAT)

As a developer who just completed an execution phase,
I want `/bp:verify` to walk me through each acceptance criterion from the spec with a structured pass/fail test,
So that I have documented proof of what works and what doesn't — not just a gut feeling.

**Acceptance Criteria:**

**Given** I run `/bp:verify` after execution completes
**When** the verification flow begins
**Then** the framework loads the active `spec.md` and presents each acceptance criterion one at a time
**And** for each criterion it guides me through the test: what to check, what the expected outcome is, and prompts me to mark it PASS or FAIL
**And** a structured verification report is generated listing all criteria with their PASS/FAIL status

**Given** all acceptance criteria pass
**When** the verification report is finalized
**Then** the spec is marked as verified and the session is logged to `.buildpact/audit/`

---

### Story 7.2: Automatic Fix Plan Generation

As a developer with failed verification items,
I want the framework to automatically generate a targeted fix plan for each failed criterion,
So that I can go directly from "what broke" to "how to fix it" without re-running the entire pipeline.

**Acceptance Criteria:**

**Given** one or more acceptance criteria fail during `/bp:verify`
**When** the verification report is complete
**Then** a fix plan is automatically generated targeting only the failed criteria
**And** the fix plan does not re-plan the entire feature

**Given** a fix plan is generated
**When** I run `/bp:execute` on it
**Then** only the failing items are re-executed
**And** after execution, `/bp:verify` can be re-run to confirm the fixes

---

### Story 7.3: Memory Layer Tier 1 — Session Feedback (Alpha)

As a developer completing a pipeline session,
I want the framework to automatically capture what worked and what didn't as structured feedback files,
So that future sessions load this feedback and avoid repeating the same mistakes.

**Acceptance Criteria:**

**Given** a verification session completes
**When** the Memory Layer Tier 1 runs
**Then** structured feedback files are created in `.buildpact/memory/feedback/` capturing: what worked, what failed, and the session outcome
**And** the FIFO cap of 30 entries per feedback file is enforced — oldest entries evicted when cap is reached

**Given** feedback files exist from previous sessions
**When** a new pipeline session begins
**Then** the 5 most recent feedback files are automatically loaded into the subagent context to inform planning and execution — "most recent" defined as highest timestamp in filename

**Given** I check Memory Layer availability
**When** I review the framework features
**Then** it is fully available in the open-source core at no cost with no paid tier required

---

### Story 7.4: Memory Layer Tier 2 — Lessons & Patterns (Beta)

> **Note: Beta milestone — not included in Alpha scope**

As a developer who wants reusable patterns captured across sessions,
I want the framework to distill recurring successful approaches into lessons files,
So that proven patterns are systematically reused rather than rediscovered each session.

**Acceptance Criteria:**

**Given** multiple feedback files exist with recurring patterns
**When** Memory Layer Tier 2 processing runs (triggered manually or after 5 sessions)
**Then** lessons files are created in `.buildpact/memory/lessons/` capturing reusable approaches with context on when to apply them

**Given** lessons files exist
**When** a new planning session begins
**Then** relevant lessons are loaded alongside feedback to inform the plan

---

### Story 7.5: Memory Layer Tier 3 — Decisions Log (v1.0)

> **Note: v1.0 milestone — not included in Alpha or Beta scope**

As a tech lead who needs architectural decisions captured permanently,
I want the framework to save key architectural and implementation decisions to a decisions log,
So that any future agent session can understand WHY the system was built a certain way.

**Acceptance Criteria:**

**Given** I mark a decision as significant during a session
**When** Memory Layer Tier 3 processing runs
**Then** a decisions file is created in `.buildpact/memory/decisions/` with: the decision, the rationale, alternatives considered, and the date

**Given** decisions files exist
**When** any pipeline command runs
**Then** the decisions log is available as reference context for planning agents

---

## Epic 8: Squad Architecture — Build Domain AI Teams

Domain experts can design, validate, and deploy specialized multi-agent squads — each with 6-layer anatomy, Voice DNA cloned from real specialists, autonomy leveling, and an automated structural validator.

### Story 8.1: Squad Scaffolding & Installation

As a domain expert wanting to build a custom AI team,
I want to scaffold a new Squad or install an existing one with a single command,
So that I have the correct file structure ready to fill in without starting from scratch.

**Acceptance Criteria:**

**Given** I run `npx buildpact squad create medical-marketing`
**When** the scaffold is generated
**Then** a complete Squad directory is created with: the 4-tier hierarchy template (Tier 0–3), placeholder agent files with all 6 required layers, a `squad.yaml` manifest, and a `benchmark/` directory
**And** the scaffold includes inline documentation explaining each layer's purpose

**Given** I run `npx buildpact squad add <name>` with a community hub Squad name
**When** the installation completes
**Then** the Squad is downloaded and placed in `.buildpact/squads/<name>/`
**And** the Squad is validated against structural and security checks before being activated
**And** I receive a warning if the Squad has not been reviewed by a maintainer

---

### Story 8.2: 6-Layer Agent Definition

As a Squad creator defining an individual agent,
I want a clear, enforced 6-layer anatomy template for each agent,
So that all agents in my Squad have consistent structure and the validator can check them automatically.

**Acceptance Criteria:**

**Given** I create or scaffold an agent in a Squad
**When** I open the agent file
**Then** it contains all 6 required layers: identity, persona, voice_dna, heuristics (IF/THEN decision rules with veto conditions), examples (minimum 3 concrete input/output pairs), and handoffs (delegation rules)
**And** each layer has inline documentation with a concrete example

**Given** an agent definition is missing one or more layers
**When** Squad validation runs
**Then** the missing layers are reported as errors with a specific reference to which agent and which layer is incomplete

---

### Story 8.3: Voice DNA Creation with 5-Section Template

As a Squad creator wanting to clone a specialist's communication style,
I want a mandatory 5-section Voice DNA template with a step-by-step creation guide,
So that every agent speaks authentically in the specialist's voice rather than sounding like a generic AI.

**Acceptance Criteria:**

**Given** I am filling in the `voice_dna` layer of an agent
**When** I follow the template
**Then** it requires all 5 mandatory sections: (1) Personality Anchors, (2) Opinion Stance, (3) Anti-Patterns with Concrete Examples (minimum 5 ✘/✔ pairs), (4) "Never Do" Rules, (5) Inspirational Anchors
**And** omitting any section causes Squad validation to fail with a clear error

**Given** I am new to Voice DNA creation
**When** I access the Squad documentation
**Then** a step-by-step Voice DNA creation guide is available explaining how to analyze specialist content and fill each of the 5 sections

---

### Story 8.4: Squad Structural Validation

As a Squad creator preparing to deploy a Squad,
I want `/bp:squad validate` to run a comprehensive structural and security check,
So that I can catch all issues before my Squad is used in production sessions.

**Acceptance Criteria:**

**Given** I run `/bp:squad validate <squad-name>`
**When** validation executes
**Then** it checks: structural completeness (all 6 layers for all agents), Voice DNA 5-section compliance, heuristic coverage, example quality (minimum 3 per agent), and handoff graph validity
**And** a detailed report is generated listing all PASS/FAIL checks with specific references

**Given** the Squad is from the community hub (untrusted source)
**When** validation runs
**Then** security checks are also enforced: no external URLs, no executable code in YAML/Markdown, no filesystem paths outside `.buildpact/`, no prompt injection patterns
**And** the Squad is blocked from activation until all security checks pass

---

### Story 8.5: Agent Autonomy Leveling System

As a Squad creator managing agent trust over time,
I want each agent to have an autonomy level (L1–L4) that evolves based on its track record,
So that new agents operate conservatively and proven agents can act more independently.

**Acceptance Criteria:**

**Given** I create a new agent in a Squad
**When** the agent is initialized
**Then** it is assigned autonomy level L1 (Observer) or L2 (Contributor) as the default
**And** the level is recorded in the agent's identity layer

**Given** an agent has been active for at least 7 days with an approve/reject ratio exceeding 85% approval
**When** the threshold is met
**Then** the system suggests promoting the agent to the next level and requires explicit user confirmation

**Given** an agent's rejection rate exceeds 30% in a rolling 7-day window
**When** the threshold is crossed
**Then** the system suggests demoting the agent one level with explicit user confirmation required

**Given** any pipeline action requires write/commit operations
**When** the command dispatcher evaluates the request
**Then** the agent's autonomy level is checked — L1 agents always require explicit user confirmation for write operations

---

### Story 8.6: Lazy Agent Loading (v2.0)

> **Note: v2.0 milestone — not included in Alpha scope. In Prompt Mode (v1.0), framework provides documented guidance on manual agent loading best practices.**

As a developer using BuildPact in Agent Mode (v2.0) with a large Squad,
I want Squad agents to be loaded into context only when needed rather than all at once,
So that I stay well within context budget even with large multi-agent Squads.

**Acceptance Criteria:**

**Given** Agent Mode v2.0 is active and a Squad is initialized
**When** the Squad is loaded
**Then** only the Chief agent definition and a lightweight agent index (≤1KB) are loaded into context initially
**And** all Specialist agents remain unloaded

**Given** a Chief agent triggers a handoff to a Specialist
**When** the handoff is processed
**Then** the target Specialist agent definition is loaded on-demand into the context
**And** after the Specialist completes its task, it is unloaded to free context

**Given** Prompt Mode v1.0 is active
**When** a user installs a Squad
**Then** the framework documentation includes a guide explaining manual agent loading best practices for the host IDE's context window management

---

## Epic 9: Pre-Built Squads — Immediate Domain Value

Users can immediately start working in their domain using ready-to-use, production-grade squad teams: Software Squad (public, Alpha), Medical Marketing Squad (private, Beta), Scientific Research Squad (private, Beta), Clinic Management Squad (private, Beta), and Agent Builder Squad (public, Beta).

### Story 9.1: Software Squad — Reference Implementation (Public)

As a developer using BuildPact for software projects,
I want the Software Squad pre-installed and ready to use out of the box,
So that I can immediately access specialized PM, Architect, Developer, QA, and Tech Writer agents without building my own Squad first.

**Acceptance Criteria:**

**Given** I install BuildPact and select the Software domain during setup
**When** installation completes
**Then** the Software Squad is available in `.buildpact/squads/software/` with all agents fully defined: PM, Architect, Developer, QA, Tech Writer
**And** each agent follows the 6-layer anatomy and Voice DNA 5-section template
**And** the Squad passes all structural validation checks out of the box

**Given** the Software Squad is active
**When** I run `/bp:specify`, `/bp:plan`, or `/bp:execute`
**Then** the appropriate Squad agent is engaged for each phase
**And** the Software Squad serves as the reference implementation that community contributors can study to create their own Squads

---

### Story 9.2: Medical Marketing Squad — CFM-Compliant AI Team (Private)

As a medical marketing professional (Persona D),
I want a pre-built Medical Marketing Squad with CFM-aware agents,
So that I can generate compliant marketing content for healthcare clients without building compliance rules from scratch.

**Acceptance Criteria:**

**Given** the Medical Marketing Squad is installed (internal use)
**When** I activate it and run a specify flow
**Then** the Strategist, Copywriter, Designer, and Analytics agents are available
**And** the Copywriter agent's Voice DNA enforces CFM nº 1.974/2011 compliance — it refuses to generate prohibited claims and flags potential violations
**And** built-in compliance checklists (CFM, ANVISA), WhatsApp CTA templates, and Schema JSON-LD medical templates are available

**Given** content is generated by the Medical Marketing Squad
**When** the compliance gate runs
**Then** any CFM or ANVISA violations are identified with specific rule references before content is delivered

---

### Story 9.3: Scientific Research Squad (Private, Beta)

> **Note: Beta milestone — not included in Alpha scope**

As a researcher using BuildPact for academic work,
I want a pre-built Scientific Research Squad,
So that I can follow systematic review protocols and produce structured research deliverables without building domain knowledge from scratch.

**Acceptance Criteria:**

**Given** the Scientific Research Squad is installed (internal use)
**When** I activate it
**Then** the Research Lead, Literature Reviewer, Data Analyst, Peer Reviewer, and LaTeX Writer agents are available
**And** systematic review protocols, PRISMA checklist templates, and statistical analysis plan templates are pre-loaded

**Given** I run `/bp:specify` with the Research Squad active
**When** the domain-aware questions run
**Then** questions address: research question formulation, study design, inclusion/exclusion criteria, and statistical approach

---

### Story 9.4: Clinic Management Squad (Private, Beta)

> **Note: Beta milestone — not included in Alpha scope**

As a clinic manager using BuildPact for operational workflows,
I want a pre-built Clinic Management Squad,
So that I can optimize patient flow, manage compliance, and handle financial analysis without building these workflows from scratch.

**Acceptance Criteria:**

**Given** the Clinic Management Squad is installed (internal use)
**When** I activate it
**Then** the Operations Manager, Finance Analyst, Compliance Checker, and Patient Flow Optimizer agents are available

**Given** I run a workflow with the Clinic Management Squad
**When** outputs are generated
**Then** the Compliance Checker agent validates all outputs against applicable Brazilian healthcare regulations before delivery

---

### Story 9.5: Agent Builder Squad — Meta Squad Creation Tool (Public)

As a domain expert wanting to create a new custom Squad,
I want an Agent Builder Squad that guides me through the Squad creation process,
So that I can build a production-quality Squad without having to understand all structural requirements from scratch.

**Acceptance Criteria:**

**Given** I install the Agent Builder Squad
**When** I activate it and run `/bp:squad create <name>`
**Then** the Agent Designer, Workflow Architect, and Tester agents guide me through: defining agent roles, building Voice DNA, writing heuristics, creating examples, and mapping handoffs
**And** the Tester agent validates each agent against the 6-layer anatomy and Voice DNA 5-section requirements as I build
**And** the completed Squad is ready for `/bp:squad validate` upon finishing the guided flow

---

## Epic 10: Web Bundle — Non-Technical User Enablement

Squad creators can export a single-file Web Bundle that enables non-technical professionals to interact with AI agents through Claude.ai or ChatGPT — in Portuguese, with no setup whatsoever.

### Story 10.1: Web Bundle Export Command

As a Squad creator (Persona D),
I want to run `/bp:export-web <platform>` to generate a single copiable prompt file,
So that non-technical users can paste it into Claude.ai or ChatGPT and immediately access my Squad's workflows without any setup.

**Acceptance Criteria:**

**Given** I have an active Squad and run `/bp:export-web claude.ai`
**When** the export completes
**Then** a single `.txt` bundle file is generated containing: compressed active Squad agent definitions, Constitution essential rules, current project context, and all necessary workflow instructions
**And** the bundle includes a token count estimate
**And** if the bundle approaches 80% of the platform's token limit (180K for Claude.ai, 128K for ChatGPT, 1M for Gemini), a warning is displayed

**Given** the bundle is generated
**When** a non-technical user pastes it into Claude.ai
**Then** the host model activates the Squad's guided workflow in the user's configured language without any additional setup

---

### Story 10.2: Progressive Bundle Compression

As a Squad creator exporting a large Squad,
I want the bundle generator to apply deterministic compression to stay within platform token limits,
So that my bundle always fits within the target platform without me having to manually trim content.

**Acceptance Criteria:**

**Given** the bundle generation begins
**When** compression is applied
**Then** the algorithm follows a documented, deterministic sequence: (1) inline only active Squad agents, (2) compress Constitution to essential rules only, (3) exclude optimization history and memory lessons, (4) include only current project context

**Given** the bundle still exceeds the platform's token limit after standard compression
**When** graceful degradation is triggered
**Then** the export command offers tiered degradation options: (1) remove agent examples, (2) remove heuristic detail, (3) reduce to Chief-only mode, (4) generate a minimal "quick session" bundle for specify phase only
**And** each degradation tier is documented inside the bundle with a note explaining what was removed

---

### Story 10.3: Conversational Interface Adaptation

As a non-technical end-user (Persona A) receiving a Web Bundle,
I want all framework interactions to be natural language conversations — no commands, no jargon,
So that I can complete my workflow in plain Portuguese or English without any technical knowledge.

**Acceptance Criteria:**

**Given** a Web Bundle is activated in Claude.ai or ChatGPT
**When** the session begins
**Then** all slash commands are replaced with natural language conversation flows
**And** the host model presents options as numbered choices in natural language instead of expecting command syntax
**And** no technical terms (repository, branch, commit, YAML, pipeline, subagent) appear in the user-facing conversation

**Given** the Web Bundle is configured for PT-BR
**When** a non-technical user interacts with it
**Then** all questions, options, outputs, and error messages are in Portuguese with no English fallback

---

### Story 10.4: Bundle Versioning & Staleness Detection

As a non-technical user who received a Web Bundle weeks ago,
I want the bundle to warn me if it is outdated,
So that I am not working with stale workflows or compliance rules without knowing it.

**Acceptance Criteria:**

**Given** a Web Bundle is generated
**When** I inspect the bundle file
**Then** it includes a generation timestamp and a hash of the source files it was built from

**Given** a Web Bundle older than 7 days is activated
**When** the host model loads the bundle
**Then** the bundle instructions cause the host model to warn the user that the bundle may be outdated and suggest requesting a fresh export from the Squad creator

---

### Story 10.5: Prompt-to-Agent Mode Migration Path

> **Note: v2.0 milestone — not included in Alpha or Beta scope**

As a developer transitioning from Prompt Mode to Agent Mode (v2.0),
I want a migration command that validates and upgrades all my existing artifacts,
So that I can transition without losing any specs, Constitution rules, memory files, or Squad configurations.

**Acceptance Criteria:**

**Given** I run `npx buildpact migrate-to-agent`
**When** migration executes
**Then** it validates all existing files against Agent Mode schema requirements
**And** generates any additional configuration files needed by Agent Mode
**And** preserves all Git history intact
**And** produces a compatibility report listing any manual adjustments needed

**Given** migration completes with warnings
**When** I review the compatibility report
**Then** each warning includes a specific file reference and an actionable remediation step
**And** my project continues to work in Prompt Mode until I explicitly activate Agent Mode

---

## Epic 11: Community Hub — Squad Ecosystem

Community members can discover, publish, and safely install community-created Squads from a dedicated GitHub repository — with automated CI validation, security checks, and maintainer review gates ensuring quality.

### Story 11.1: Public Community Hub Repository

As a BuildPact user looking for domain-specific Squads,
I want a dedicated GitHub repository where I can discover and install community-created Squads with a single command,
So that I don't have to build every Squad from scratch and can benefit from the community's domain expertise.

**Acceptance Criteria:**

**Given** the `buildpact-squads` repository exists on GitHub
**When** I browse it
**Then** I can find available community Squads organized by domain
**And** each Squad has a README describing its agents, use cases, usage instructions, MIT license, and a validation badge

**Given** I want to install a community Squad
**When** I run `npx buildpact squad add <squad-name>`
**Then** the Squad is downloaded, validated locally (structural + security checks), and installed to `.buildpact/squads/<name>/`
**And** I receive a warning if the Squad has not yet received a maintainer review

---

### Story 11.2: Squad Contribution Flow with Automated CI

As a domain expert who built a valuable Squad,
I want a clear contribution flow for publishing it to the community hub,
So that other users can discover and install my Squad with confidence that it passed quality and security gates.

**Acceptance Criteria:**

**Given** I fork `buildpact-squads`, create my Squad, and submit a Pull Request
**When** the PR is opened
**Then** automated CI runs Squad validation (structural completeness, Voice DNA 5-section compliance, example quality) and security checks (no external URLs, no executable code, no path violations, no prompt injection)
**And** CI results are posted as PR check summaries with specific pass/fail details

**Given** all CI checks pass
**When** a maintainer approves and merges the PR
**Then** the Squad is immediately available for community installation via `npx buildpact squad add <name>`

**Given** CI checks fail
**When** the contributor reviews the results
**Then** each failure includes a specific message and a suggested fix, enabling the contributor to iterate without maintainer involvement

---

### Story 11.3: Community Health & Governance Infrastructure

As a BuildPact maintainer or first-time contributor,
I want the repository to include contribution guidelines, good-first-issue labels, and Architecture Decision Records,
So that the community can grow sustainably with clear standards and low barriers to entry.

**Acceptance Criteria:**

**Given** I visit the `buildpact-squads` repository as a new contributor
**When** I look for how to get started
**Then** I find a `CONTRIBUTING.md` with step-by-step instructions in both PT-BR and EN
**And** there are at least 5 issues labeled `good first issue` with clear scope, estimated effort under 2 hours, and an assigned mentor

**Given** a significant architectural or governance decision is made
**When** the decision is documented
**Then** an ADR is added to `docs/decisions/` following the MADR template format

**Given** a PR modifies user-facing text
**When** it is reviewed
**Then** the PR template enforces that i18n strings are provided for both PT-BR and EN before merge

---

## Epic 12: AutoResearch — Autonomous Optimization Engine

Expert users can launch autonomous, budget-controlled experimentation loops that optimize code quality, marketing copy, or agent behavior — with a Git Ratchet mechanism that only commits proven improvements and generates full optimization reports.

### Story 12.0: AutoResearch Architecture Decision Record (ADR-001)

> **Note: This story must be completed before any other Epic 12 story. ADR-001 is required by Architecture before AutoResearch implementation begins.**

As a developer implementing the AutoResearch feature,
I want ADR-001 to document the AutoResearch isolation architecture before any code is written,
So that all implementation decisions are grounded in a reviewed architectural decision rather than ad-hoc choices.

**Acceptance Criteria:**

**Given** Epic 12 implementation is about to begin
**When** ADR-001 is created
**Then** it documents in `docs/decisions/ADR-001-autoResearch-isolation.md`: the problem statement, considered alternatives (isolated branch vs. working copy vs. temp directory), the chosen approach (isolated Git branch), consequences, and open questions

**Given** ADR-001 is drafted
**When** it is reviewed
**Then** it must be approved (via PR or explicit sign-off) before any Story 12.1+ implementation begins

**Given** ADR-001 exists
**When** any AutoResearch implementation deviates from the documented approach
**Then** the ADR must be updated to reflect the deviation and re-approved

---

### Story 12.1: AutoResearch Command & Program File

As an expert developer wanting to optimize a target file autonomously,
I want to run `/bp:optimize <target>` with a `program.md` that defines my optimization goal and constraints,
So that the framework runs experiments automatically within my defined boundaries without me having to supervise each iteration.

**Acceptance Criteria:**

**Given** I create a `program.md` defining: the optimization goal, constraints the agent must respect, suggested experiment directions, and acceptance criteria for keeping changes
**When** I run `/bp:optimize src/commands/specify.md`
**Then** the framework launches an autonomous experimentation loop on the target file
**And** the loop respects all constraints defined in `program.md`
**And** the command is only available at Expert experience level

**Given** the target file exceeds 600 lines
**When** `/bp:optimize` is invoked
**Then** execution is blocked with a message instructing the user to shard the file first

---

### Story 12.2: Fixed-Budget Experiment Loop

As an expert user running an overnight optimization session,
I want each experiment to have a fixed time budget and the total session to have a configurable budget,
So that I can run long optimization sessions without runaway costs or infinite loops.

**Acceptance Criteria:**

**Given** I run `/bp:optimize` with default settings
**When** the loop executes
**Then** each individual experiment runs within a 5-minute time budget (configurable)
**And** the total session respects a 30-minute overall budget (configurable up to 24 hours)
**And** when either budget is exhausted, the loop stops cleanly and preserves all results to date

**Given** the session's AI cost reaches the Budget Guard limit
**When** the limit is hit during the loop
**Then** the loop pauses immediately, preserves all results, and notifies the user with options to continue or stop

---

### Story 12.3: Git Ratchet — Commit Only Proven Improvements

As an expert user running automated experiments,
I want the framework to automatically commit changes only when the metric improves and revert everything else,
So that my codebase only ever moves forward — every experiment either improves the score or leaves no trace.

**Acceptance Criteria:**

**Given** an experiment completes
**When** the metric function compares the result to the current best
**Then** if improved: the change is committed with the standardized message `optimize(N): description | metric: X.XX → Y.YY`
**And** if equal or worse: the change is git-reverted to the last successful state automatically

**Given** the Git Ratchet module runs
**When** I inspect it as a developer
**Then** it exists as an independent TypeScript module (`src/optimize/ratchet.ts`) with ≥80% Vitest test coverage
**And** all AutoResearch operations run on an isolated branch: `optimize/{target-type}/{session-name}/{timestamp}`
**And** human review is required before merge — no auto-merge to main is permitted

---

### Story 12.4: Domain-Specific Metrics

As an expert user optimizing different types of content,
I want built-in metric functions for code, marketing copy, and agent behavior — plus the ability to define custom metrics,
So that the AutoResearch loop can objectively measure improvement regardless of my domain.

**Acceptance Criteria:**

**Given** I am optimizing a Software Squad target
**When** I configure the metric
**Then** built-in metrics available include: test pass rate, bundle size, Lighthouse score, build time, code coverage, and type-check pass/fail

**Given** I am optimizing a Marketing Squad target
**When** I configure the metric
**Then** built-in metrics available include: readability score, compliance check pass rate (CFM/ANVISA deterministic checklist), keyword density, and CTA clarity score
**And** the evaluator model differs from the generator model to mitigate auto-evaluation circularity

**Given** I want a domain-specific metric not covered by built-ins
**When** I provide a custom metric script (any executable returning a numeric score to stdout)
**Then** the AutoResearch loop uses it as the optimization target without any framework modifications

---

### Story 12.5: Optimization Report

As an expert user reviewing the results of an optimization session,
I want an automatically generated report summarizing every experiment and improvement found,
So that I can make an informed decision about which optimizations to merge into main.

**Acceptance Criteria:**

**Given** an AutoResearch session completes
**When** the report is generated
**Then** `optimization-report.md` is created containing: total experiments run, improvements found, specific changes made, before/after metric comparison, and a diff of all kept modifications

**Given** I review the report and decide to merge improvements
**When** I proceed with the merge
**Then** the report clearly indicates which branch to merge and the expected metric impact
**And** the `results.tsv` append-only log contains the full experiment history for audit purposes

---

# ═══════════════════════════════════════════════════
# v1.0 MILESTONE — Production Grade
# ═══════════════════════════════════════════════════

## Epic 18: Documentation & Developer Experience

New users and squad creators find comprehensive, well-structured documentation that makes adoption and contribution effortless.

**FRs covered:** FR-1501, FR-1502, FR-1503, FR-1504
**NFRs:** NFR-14, NFR-17, NFR-20
**Stories:** 18.1, 18.2, 18.3, 18.4
**Phase:** v1.0

---

### Story 18.1: Documentation Site with VitePress & i18n

As a new BuildPact user,
I want a comprehensive documentation site with tutorials, API reference, and conceptual guides,
So that I can learn the framework without reading source code.

**Acceptance Criteria:**

**Given** a user visits the docs site
**When** they browse the navigation
**Then** they find sections for: Quick Start, Tutorials (step-by-step), CLI Reference (all commands), Architecture Overview, and FAQ
**And** each CLI command has usage examples, options, and expected output

**Given** the docs site infrastructure
**When** a developer inspects the setup
**Then** it uses VitePress with i18n folder structure (`docs/en/`, `docs/pt-br/`) configured from day 1
**And** language switching works between EN and PT-BR

**Given** a Portuguese-speaking user visits the docs
**When** they toggle the language selector
**Then** all content is available in PT-BR with native-quality translations

**Given** a user follows the Quick Start tutorial
**When** they complete all steps
**Then** they have a working BuildPact project with a squad installed and their first `buildpact quick` task completed in under 5 minutes

**Given** the documentation source files
**When** deployed
**Then** the site is hosted on GitHub Pages with automatic deployment from the `docs/` branch

---

### Story 18.2: Squad Creation Guide

As a domain expert wanting to create a custom squad,
I want a comprehensive guide with examples explaining the 6-layer agent structure, voice DNA, and squad.yaml configuration,
So that I can create production-quality squads without guessing.

**Acceptance Criteria:**

**Given** a user reads the Squad Creation Guide
**When** they follow it end-to-end
**Then** they can create a complete squad with: squad.yaml, at least 2 agent markdown files with all 6 layers, and voice DNA with 5 subsections

**Given** the guide content
**When** a user looks for examples
**Then** each concept includes a concrete example from the built-in software squad and at least one non-software domain example

**Given** a user creates a squad following the guide
**When** they run `buildpact doctor --smoke`
**Then** the squad passes all structural validation checks

**Given** the guide covers voice DNA creation
**When** a user reads the voice DNA section
**Then** it explains lexicon, tone, cadence, signature-phrases, and anti-patterns with before/after examples showing the difference good voice DNA makes

---

### Story 18.3: Migration Guides

As a developer currently using BMAD, GSD, or SpecKit,
I want a migration guide that maps my existing workflow concepts to BuildPact equivalents,
So that I can adopt BuildPact without losing my investment in my current framework.

**Acceptance Criteria:**

**Given** a BMAD user reads the BMAD migration guide
**When** they look for concept mapping
**Then** they find a table mapping: BMAD agents → BuildPact squad agents, BMAD workflows → BuildPact pipeline phases, BMAD artifacts → BuildPact output structure

**Given** a GSD user reads the GSD migration guide
**When** they look for workflow equivalents
**Then** they find mappings for: GSD phases → BuildPact pipeline, GSD roadmap → BuildPact plan, GSD executor → BuildPact execute

**Given** a SpecKit user reads the SpecKit migration guide
**When** they look for setup equivalents
**Then** they find: SpecKit rules → BuildPact constitution, SpecKit templates → BuildPact commands, SpecKit cursorrules → BuildPact IDE config

**Given** any migration guide
**When** a user follows the step-by-step instructions
**Then** they can migrate an existing project to BuildPact in under 30 minutes with their existing artifacts preserved

---

### Story 18.4: Performance Budget Validation

As a tech lead evaluating BuildPact for production use,
I want automated benchmarks that validate BuildPact meets its stated performance budgets,
So that I can trust it won't degrade my team's workflow.

**Acceptance Criteria:**

**Given** the performance benchmark suite
**When** `npm run benchmark` is executed
**Then** it measures and reports: CLI startup time (target: <500ms), command parse time (target: <50ms), squad load time (target: <100ms), constitution check time (target: <200ms), audit write time (target: <10ms)

**Given** any measurement exceeds its target
**When** the benchmark report is generated
**Then** the failing metric is highlighted with the actual value vs target, and the overall benchmark exits with code 1

**Given** the benchmark suite
**When** it runs in CI (GitHub Actions)
**Then** it produces a machine-readable JSON report compatible with benchmark tracking tools

**Given** the memory usage benchmark
**When** a standard operation runs (single squad, 50 tasks)
**Then** resident memory stays below 256MB as measured by process.memoryUsage().rss

---

## Epic 19: CI/CD Integration & Automation

Teams can run BuildPact in automated pipelines with GitHub Actions, receive execution notifications, and trust all commands work non-interactively.

**FRs covered:** FR-1505, FR-1506, FR-1507
**NFRs:** NFR-09, NFR-15
**Stories:** 19.1, 19.2, 19.3
**Phase:** v1.0

---

### Story 19.1: Non-Interactive Mode Hardening

As a developer running BuildPact in CI,
I want all commands to work without interactive prompts when `--ci` flag is set,
So that automated pipelines never hang waiting for user input.

**Acceptance Criteria:**

**Given** any BuildPact command is invoked with `--ci` flag or `BP_CI=true` environment variable
**When** the command would normally display an interactive prompt
**Then** the command uses the defined CI defaults and logs the auto-selected choice

**Given** `buildpact plan --ci` is invoked
**When** the plan handler encounters interactive steps
**Then** it: skips research phase (too expensive for CI), skips Nyquist validation, auto-accepts the generated plan
**And** logs `[ci] auto-skipped: research phase` for each skipped step

**Given** `buildpact specify --ci` is invoked with `--description "Build a REST API"`
**When** the specify handler runs
**Then** it uses the provided description literally, skips ambiguity resolution, skips maturity assessment

**Given** `buildpact execute --ci` is invoked
**When** the execute handler runs
**Then** it auto-confirms execution start, enforces budget guard strictly (no override prompt)
**And** exit code is 0 for success and non-zero for any task failure

**Given** `buildpact quick --ci` is invoked with `--description "Add login endpoint"`
**When** the quick handler runs
**Then** it uses the description literally, skips discussion flow

**Given** a developer audits the codebase for interactive calls
**When** they grep for `clack.confirm`, `clack.select`, `clack.text`, and `isCancel`
**Then** every occurrence (13 known locations across 5 handlers) has a CI-mode guard that bypasses the interactive call

---

### Story 19.2: GitHub Actions Adapter

As a team lead integrating BuildPact into our GitHub Actions workflow,
I want a reusable GitHub Action that runs BuildPact commands and reports results as check annotations,
So that AI-assisted tasks are part of our automated CI/CD pipeline.

**Acceptance Criteria:**

**Given** a repository with a GitHub Actions workflow
**When** the workflow includes `uses: buildpact/action@v1` with `command: plan`
**Then** BuildPact installs, runs `buildpact plan --ci`, and completes without manual intervention

**Given** the action configuration
**When** the user specifies `budget: 1.00`
**Then** the budget guard is enforced and execution halts if projected costs exceed $1.00

**Given** a BuildPact execution fails in CI
**When** the action completes
**Then** failed tasks appear as GitHub check annotations with file paths, error messages, and fix suggestions

**Given** the action runs successfully on a pull_request event
**When** the workflow completes
**Then** an execution summary is posted as a PR comment containing: tasks completed, cost incurred, and time elapsed

**Given** the action source code
**When** a developer inspects it
**Then** it is a composite action defined in `action.yml` with inputs: `command` (required), `plan` (optional path), `budget` (optional, default 1.00), and `ci-mode` (default true)

---

### Story 19.3: Webhook Notifications

As a team using Slack/Discord for project communication,
I want BuildPact to send execution event notifications to a webhook URL,
So that my team is notified when pipeline stages complete or fail.

**Acceptance Criteria:**

**Given** a webhook URL is configured in `.buildpact/config.yaml` under `notifications.webhook`
**When** a pipeline stage completes (specify, plan, execute, verify)
**Then** a POST request is sent with JSON payload containing: `event`, `status`, `timestamp`, `summary` (task count, cost, duration), and `projectName`

**Given** the webhook URL points to a Slack-compatible endpoint
**When** the notification is sent
**Then** the payload format is compatible with Slack's incoming webhook API (includes `text` field)

**Given** the webhook endpoint is unreachable
**When** the notification fails
**Then** BuildPact logs a warning but does NOT fail the pipeline (fire-and-forget with single retry)

**Given** a user wants selective notifications
**When** they set `notifications.events: [execute, verify]`
**Then** only execute and verify completions trigger notifications

**Given** `notifications.webhook` is not configured
**When** any pipeline stage completes
**Then** no webhook request is attempted

---

## Epic 20: Community Hub Enhancement

Squad authors and consumers have a better discovery experience with search filters, quality signals, and automated trust scoring.

**FRs covered:** FR-1508, FR-1509
**Stories:** 20.1, 20.2
**Phase:** v1.0

---

### Story 20.1: Hub Search & Discovery

As a developer looking for a squad for my domain,
I want to search and filter the Community Hub by domain, popularity, and compatibility,
So that I find the right squad quickly instead of browsing a flat list.

**Acceptance Criteria:**

**Given** a user runs `buildpact hub search "mobile app"`
**When** the Hub has squads tagged with "mobile" or "app"
**Then** results are returned ranked by relevance, showing: squad name, description, author, download count, and compatibility badge

**Given** a user runs `buildpact hub search --domain healthcare`
**When** the Hub has squads in the healthcare category
**Then** only healthcare-tagged squads are returned

**Given** a user runs `buildpact hub search --sort downloads`
**When** results are returned
**Then** they are sorted by download count descending

**Given** the Hub has no matching squads
**When** the search returns empty
**Then** a helpful message suggests broadening the search or visiting the Hub website

**Given** a user runs `buildpact hub info <squad-name>`
**When** the squad exists
**Then** a detailed card shows: full description, agent list, author info, version history, quality score, and installation command

---

### Story 20.2: Squad Quality Scores

As a developer evaluating a community squad,
I want to see an automated quality score based on objective checks,
So that I can trust the squad before installing it.

**Acceptance Criteria:**

**Given** a squad is published to the Hub
**When** the CI validation pipeline runs
**Then** it produces a quality score (0-100) based on: structural completeness (30%), voice DNA completeness (20%), smoke test pass rate (20%), documentation coverage (15%), and test fixture presence (15%)

**Given** the quality score is calculated
**When** a user views the squad in search results or `hub info`
**Then** the score is displayed as: Gold (90-100), Silver (70-89), Bronze (50-69), or Unrated (<50)

**Given** a squad author publishes an update
**When** the quality score changes
**Then** the author is notified with the new score and improvement suggestions

**Given** a user runs `buildpact adopt <squad>` for a squad scoring below 50
**When** the install begins
**Then** a warning is shown: "Low quality score (XX/100). Install anyway? [y/N]"

---

## Epic 21: v1.0 Release & Stabilization

BuildPact v1.0 launches as a polished, adoption-ready product with onboarding, sponsorship infrastructure, and a verified release.

**FRs covered:** FR-1510, FR-1511, FR-1512
**NFRs:** NFR-18, TEST-01 through TEST-05
**Stories:** 21.1, 21.2, 21.3
**Phase:** v1.0

---

### Story 21.1: Onboarding Learn Command

As a first-time BuildPact user,
I want a `buildpact learn` command that opens the getting started tutorial,
So that I can quickly find the guided learning path.

**Acceptance Criteria:**

**Given** a user runs `buildpact learn`
**When** the command executes
**Then** it opens the docs site tutorial page (`https://buildpact.dev/guide/getting-started`) in the default browser
**And** prints a terminal summary: "Opening BuildPact tutorial... If the browser didn't open, visit: https://buildpact.dev/guide/getting-started"

**Given** the user is in a non-GUI environment (SSH, CI)
**When** `buildpact learn` cannot open a browser
**Then** it prints the URL to stdout without attempting to open

**Given** a PT-BR locale is active
**When** `buildpact learn` runs
**Then** it opens the PT-BR version of the tutorial (`https://buildpact.dev/pt-br/guide/getting-started`)

---

### Story 21.2: GitHub Sponsors & Contributor Onboarding

As the BuildPact maintainer,
I want GitHub Sponsors configured with clear tiers and a CONTRIBUTING.md that guides new contributors,
So that the project is financially sustainable and community-driven.

**Acceptance Criteria:**

**Given** the GitHub Sponsors configuration
**When** a potential sponsor visits the Sponsors page
**Then** they see tiers: Individual ($5/mo), Supporter ($25/mo), Organization ($100/mo) with clear benefits per tier

**Given** a developer wants to contribute
**When** they read CONTRIBUTING.md
**Then** they find: development setup, code style guide, PR process, and architecture overview

**Given** a first-time contributor opens a PR
**When** CI runs on their branch
**Then** all tests pass, linting passes, and a bot comments with a welcome message

**Given** the project README
**When** a visitor reads it
**Then** it includes: value proposition, installation one-liner, 30-second demo GIF, CI/npm/sponsors badges, and docs links

---

### Story 21.3: v1.0 Release Checklist

As the BuildPact maintainer,
I want a comprehensive release checklist that validates v1.0 is production-ready,
So that the first stable release meets all quality gates.

**Acceptance Criteria:**

**Given** the release checklist script `npm run release:check`
**When** executed
**Then** it validates: all tests pass, coverage thresholds met (80% line, 70% branch), zero critical npm audit vulnerabilities, all commands work with `--ci`, performance benchmarks pass, CHANGELOG.md is current, package.json version matches tag

**Given** all checks pass
**When** `npm run release:publish` is executed
**Then** it publishes to npm as `buildpact@1.0.0`, creates a GitHub release, and tags `v1.0.0`

**Given** the release includes readonly access control
**When** a user sets `readonly: true` in `.buildpact/config.yaml`
**Then** state-modifying commands (`execute`, `plan --write`, `specify --write`) are blocked with `BP210: Project is in readonly mode`

**Given** the v1.0 announcement
**When** published
**Then** it includes: what's new since beta, migration notes, known limitations, and roadmap link

---

# ═══════════════════════════════════════════════════
# v2.0 MILESTONE — Agent Mode & Scale
# ═══════════════════════════════════════════════════

## Epic 22: Agent Mode Runtime

Users can launch persistent AI agents that react to events, communicate with each other, and survive restarts — enabling walk-away autonomous execution.

**FRs covered:** FR-2001, FR-2002, FR-2003, FR-2004, FR-2005, FR-2006
**Architecture:** Agent Supervisor, Event Bus, state persistence, health metrics, recovery policies
**Stories:** 22.1, 22.2, 22.3a, 22.3b, 22.4, 22.5, 22.6
**Phase:** v2.0

---

### Story 22.1: Agent Mode TypeScript CLI

As a power user wanting autonomous AI execution,
I want a `buildpact agent` command that launches a persistent agent supervisor,
So that I can start long-running AI workflows that outlive a single command invocation.

**Acceptance Criteria:**

**Given** a user runs `buildpact agent start`
**When** the supervisor launches
**Then** a persistent process starts in the background, writes its PID to `.buildpact/agent.pid`, and logs startup to `.buildpact/agent.log`

**Given** the supervisor is running
**When** the user runs `buildpact agent status`
**Then** it shows: supervisor PID, uptime, active agents, total tasks processed, and memory usage

**Given** the supervisor is running
**When** the user runs `buildpact agent stop`
**Then** all agents complete their current task (graceful shutdown with 30s timeout), PID file is removed, and shutdown summary is logged

**Given** the supervisor process crashes
**When** the user runs `buildpact agent start` again
**Then** it detects the stale PID file, cleans up, and starts fresh with a warning

---

### Story 22.2: Auto-Advance Walk-Away Execution

As a developer with a large plan,
I want the agent supervisor to automatically advance through plan waves,
So that I can start execution and walk away while the AI completes all waves.

**Acceptance Criteria:**

**Given** a plan with multiple waves
**When** `buildpact agent execute --plan <path>` is invoked
**Then** the supervisor processes waves sequentially: execute → validate → advance → repeat until complete

**Given** a task fails during auto-advance
**When** retries are exhausted
**Then** execution pauses, writes `.buildpact/agent-paused.json` with failure details

**Given** execution is paused
**When** the user runs `buildpact agent resume`
**Then** execution resumes from the failed wave

**Given** the budget guard triggers
**When** projected cost exceeds the limit
**Then** execution pauses, the user is notified via webhook if configured, and cost summary is written to pause file

---

### Story 22.3a: Event Bus — Basic Pub/Sub

As a system running multiple agents,
I want agents to publish and subscribe to topics,
So that agents can be notified when relevant events occur.

**Acceptance Criteria:**

**Given** the event bus is initialized
**When** agent A publishes to topic `task.completed`
**Then** all agents subscribed to `task.completed` receive the message with: `id`, `from`, `type`, `topic`, `payload`, and `timestamp`

**Given** agent A sends a direct message to agent B
**When** `to` is set to agent B's name
**Then** only agent B receives the message

**Given** an agent publishes with `to: '*'` (broadcast)
**When** the bus routes the message
**Then** all active agents receive it

**Given** the event bus
**When** inspected by a developer
**Then** it is an in-process EventEmitter-based implementation with typed message schemas, no external dependencies

---

### Story 22.3b: Event Bus — Advanced Routing

As a system with high-throughput agent communication,
I want message priorities, TTL, and correlation tracking,
So that critical messages are processed first and stale messages don't clog the system.

**Acceptance Criteria:**

**Given** a message is published with `priority: 'critical'`
**When** the recipient has queued messages
**Then** the critical message is processed before lower-priority messages

**Given** a message has `ttl: 30000` (30 seconds)
**When** the message is not consumed within 30 seconds
**Then** it is discarded and logged as expired

**Given** a request-response pattern
**When** agent A sends a message with `correlationId`
**Then** agent B's response includes the same `correlationId` for matching

**Given** the priority system
**When** messages arrive with priorities low, normal, high, critical
**Then** processing order is: critical > high > normal > low within each subscription

---

### Story 22.4: Real-Time Execution Dashboard

As a user monitoring agent execution,
I want a terminal dashboard showing real-time progress,
So that I can see what's happening without reading log files.

**Acceptance Criteria:**

**Given** agent execution is in progress
**When** `buildpact agent dashboard` is invoked
**Then** a terminal UI shows: active agents (name + current task), wave progress, cost accumulator, and elapsed time

**Given** the dashboard is running
**When** an agent completes a task
**Then** the display updates within 1 second

**Given** a non-TTY environment
**When** `buildpact agent dashboard --json` is used
**Then** a JSON snapshot is printed to stdout

**Given** the dashboard is running
**When** the user presses `q`
**Then** the dashboard closes but agent execution continues

---

### Story 22.5: State Persistence — ADR & Implementation

As a user whose agent process was interrupted,
I want the supervisor to recover its full state from persistent storage,
So that no work is lost and execution resumes where it left off.

> **Note:** This story begins with an Architecture Decision Record (ADR) evaluating state persistence options: (1) SQLite via better-sqlite3, (2) flat-file JSON with WAL pattern, (3) LevelDB via classic-level. The chosen technology is then implemented.

**Acceptance Criteria:**

**Given** the ADR phase
**When** the developer evaluates persistence options
**Then** an ADR document is produced at `.buildpact/docs/adr-state-persistence.md` comparing: native dependency burden, Node.js version compatibility, performance characteristics, and recovery guarantees

**Given** the chosen persistence technology
**When** the agent supervisor runs with active tasks
**Then** state is periodically checkpointed (every 10 seconds and after each task completion)

**Given** a crashed supervisor
**When** `buildpact agent start` is invoked
**Then** it detects the state store, loads the last checkpoint, and presents: "Previous session found. Resume? [Y/n]"

**Given** the user chooses to resume
**When** the supervisor restarts
**Then** completed tasks are NOT re-executed, pending tasks resume from their checkpoint, and cost accumulator continues from the persisted total

---

### Story 22.6: Prompt-to-Agent Migration Command

As a user currently using BuildPact in prompt mode,
I want a migration command that converts my setup to agent mode,
So that I can upgrade without starting over.

**Acceptance Criteria:**

**Given** a project with prompt-mode configuration
**When** `buildpact migrate --to agent-mode` runs
**Then** the migration: validates existing files, generates `agent.yaml`, preserves all artifacts, and reports a compatibility summary

**Given** the migration completes
**When** `buildpact agent start` is invoked
**Then** the supervisor starts successfully with the migrated configuration

**Given** incompatible configurations are found
**When** a conflict is detected
**Then** the migration reports the specific issue and suggests a manual fix

---

## Epic 23: Self-Optimizing Squads

Squads automatically improve prompt performance through A/B testing with statistical validation.

**FRs covered:** FR-2007, FR-2008, FR-2009, FR-2010
**Architecture:** Execution metrics, optimization loop, prompt variant tracking
**Stories:** 23.1, 23.2, 23.3, 23.4
**Phase:** v2.0
**Dependency:** Requires Epic 22 (agent runtime for execution)

---

### Story 23.1: Squad Optimization Command

As a squad author wanting to improve agent quality,
I want a `buildpact optimize` command that runs controlled experiments,
So that I can objectively measure and improve my squad's performance.

**Acceptance Criteria:**

**Given** `buildpact optimize --squad software --target developer --metric quality`
**When** the optimization loop starts
**Then** it loads the baseline, generates N variants (default 3), executes each against benchmarks, and reports results

**Given** a variant outperforms baseline with p < 0.05
**When** results are presented
**Then** the user is prompted: "Variant N improved quality by X%. Apply? [y/N]"

**Given** a budget is configured
**When** cost reaches the limit
**Then** the loop stops, preserves results, and reports partial findings

**Given** experiments run
**When** the optimizer creates files
**Then** all work happens on branch `optimize/<squad>/<agent>/<timestamp>`

---

### Story 23.2: Benchmark Sets

As a squad author running optimization,
I want domain-specific benchmark tasks,
So that optimization measures real capability.

**Acceptance Criteria:**

**Given** the software squad benchmark
**When** loaded
**Then** it contains at least 5 tasks: code generation, bug fixing, test writing, documentation, refactoring

**Given** a custom benchmark at `.buildpact/benchmarks/<name>.yaml`
**When** the optimizer runs
**Then** it uses the custom benchmark instead of built-in

**Given** each benchmark task
**When** evaluation criteria are defined
**Then** they include: expected output patterns, quality rubric (0-10), and max cost per task

---

### Story 23.3: Optimization Isolation

As a user running experiments on production squads,
I want optimization to never modify my working squad until approval,
So that experiments can't break my workflow.

**Acceptance Criteria:**

**Given** an optimization session starts
**When** variants are created
**Then** all variant files are in a temporary directory, never in `.buildpact/squad/`

**Given** the user approves a winner
**When** the session ends
**Then** a git commit applies the variant with message `optimize(agent): improve metric X.X → Y.Y`

**Given** the user rejects all variants
**When** the session ends
**Then** the temporary directory is deleted and no changes are made

---

### Story 23.4: Optimization Reports

As a squad author reviewing results,
I want a detailed report comparing variants with statistical analysis,
So that I can make informed decisions.

**Acceptance Criteria:**

**Given** an optimization session completes
**When** the report is generated
**Then** `optimization-report.md` contains: experiment summary, per-variant metrics (mean, std dev, p-value), winning variant diff, and cost summary

**Given** a variant's p-value > 0.05
**When** displayed
**Then** it is marked "Not statistically significant" with a recommendation to run more trials

**Given** machine-readable data is needed
**When** the report generates
**Then** `optimization-results.json` is also produced with raw metrics

---

## Epic 24: Enterprise & Marketplace

Enterprises get full RBAC and centralized governance, while the community gets a mature marketplace with ratings and certification.

**FRs covered:** FR-2011, FR-2012, FR-2013, FR-2014
**Architecture:** RBAC model, org-level config, marketplace extensions
**Stories:** 24.1a, 24.1b, 24.2, 24.3, 24.4
**Phase:** v2.0

---

### Story 24.1a: RBAC Middleware & Role Resolution

As an enterprise architect,
I want a role-based access control engine that resolves user roles and checks permissions,
So that access decisions are centralized and consistent.

**Acceptance Criteria:**

**Given** `.buildpact/rbac.yaml` defines roles (admin, lead, member, viewer) with permission sets
**When** the RBAC middleware loads
**Then** it parses the config and provides a `checkPermission(user, permission): boolean` function

**Given** a user identity is determined from environment (`BP_USER` or git config)
**When** the middleware resolves their role
**Then** the role's permissions are loaded and cached for the session

**Given** no `rbac.yaml` exists
**When** the middleware initializes
**Then** all users are treated as admin (backward compatible, no restrictions)

**Given** the RBAC engine
**When** inspected by a developer
**Then** it is a standalone module at `src/engine/rbac.ts` with ≥90% test coverage

---

### Story 24.1b: RBAC Command Permission Guards

As an enterprise admin,
I want every BuildPact command to check permissions before executing,
So that unauthorized actions are blocked with clear error messages.

**Acceptance Criteria:**

**Given** a user with "member" role runs `buildpact execute`
**When** their role allows `squad.execute`
**Then** the command proceeds

**Given** a user with "viewer" role runs `buildpact execute`
**When** their role lacks `squad.execute`
**Then** the command fails with: `BP300: Permission denied. Role 'viewer' lacks 'squad.execute'. Contact your admin.`

**Given** the permissions enforced per command
**When** all commands are audited
**Then** guards exist for: `squad.install` (adopt), `squad.execute` (execute, quick), `config.write` (specify, plan), `audit.read` (audit), `budget.set` (config changes), `budget.override` (execute with override)

**Given** an access violation
**When** logged
**Then** the audit trail records: user, role, denied permission, timestamp, and command

---

### Story 24.2: Centralized Constitution Management

As an enterprise architect managing multiple projects,
I want an organization-level constitution that all projects inherit,
So that company-wide standards are enforced consistently.

**Acceptance Criteria:**

**Given** `.buildpact-org/constitution.md` exists
**When** a project's pipeline runs
**Then** org rules merge with project rules (org takes precedence on conflict)

**Given** the org constitution has `no-external-apis: true`
**When** a project tries to override with `no-external-apis: false`
**Then** the org rule wins with warning: "Organization rule cannot be overridden"

**Given** `.buildpact-org/` structure
**When** inspected
**Then** it contains: `constitution.md`, `approved-squads.yaml`, `defaults.yaml`

---

### Story 24.3: Marketplace Ratings & Reviews

As a developer who used a community squad,
I want to rate and review it,
So that others benefit from my experience.

**Acceptance Criteria:**

**Given** a user has used a squad for at least one execution
**When** `buildpact hub review <name> --rating 4 --comment "Great"`
**Then** the review is submitted with verified identity

**Given** multiple reviews exist
**When** `buildpact hub info <name>` is viewed
**Then** average rating, count, and 3 most recent reviews are shown

**Given** inappropriate content
**When** the filter detects it
**Then** the review is flagged for moderation

---

### Story 24.4: Squad Certification Program

As a squad author wanting to demonstrate quality,
I want a certification process with rigorous criteria,
So that users trust "Certified" squads.

**Acceptance Criteria:**

**Given** `buildpact hub certify <name>` is invoked
**When** the pipeline runs
**Then** it validates: quality score ≥ 90, all 6 layers present, voice DNA complete, ≥3 examples per agent, smoke test passes, README with usage

**Given** all checks pass
**When** submitted
**Then** the squad receives a "Certified" badge in search and `hub info`

**Given** a certified squad update breaks criteria
**When** CI re-validates
**Then** the badge is revoked with notification to the author

---

## Epic 25: Cross-Project Intelligence & Expansion

BuildPact learns across projects, speaks more languages, and provides domain expansion packs.

**FRs covered:** FR-2015, FR-2016, FR-2017, FR-2018
**Architecture:** Project fingerprints, pattern matching, differential privacy
**Stories:** 25.1, 25.2, 25.3, 25.4
**Phase:** v2.0
**Dependency:** Requires Epic 22 (agent persistence for fingerprint storage)

---

### Story 25.1: Cross-Project Learning

As an organization running multiple BuildPact projects,
I want the system to suggest patterns from successful projects,
So that new projects benefit from organizational knowledge.

**Acceptance Criteria:**

**Given** a project completes a full pipeline
**When** execution finishes
**Then** a fingerprint is generated: domain, tech stack, complexity, scale, successful pattern hashes

**Given** a new project starts planning
**When** fingerprints are compared (similarity > 0.7)
**Then** successful patterns from similar projects are suggested during planning

**Given** privacy mode is active (default)
**When** data is stored
**Then** differential privacy (epsilon=1.0) is applied and identifiers are hashed

**Given** a user sets `crossProject.enabled: false`
**When** configured
**Then** no fingerprints are generated or shared

---

### Story 25.2: Multi-Language Localization

As a non-English speaking user,
I want BuildPact in my language,
So that I can use the framework without language barriers.

**Acceptance Criteria:**

**Given** the localization infrastructure
**When** a contributor wants to add Spanish
**Then** they create `locales/es.yaml` following `en.yaml` structure and submit a PR

**Given** `LANG=es` or `BP_LOCALE=es` is set
**When** any command runs
**Then** all strings are in Spanish

**Given** v2.0 launches
**When** language support is counted
**Then** at minimum ES, FR, DE, JA are available as community translations

**Given** a locale file is incomplete
**When** a key is missing
**Then** English fallback is used for that key with a debug log

---

### Story 25.3: Domain Expansion Packs

As a domain expert wanting quick adoption,
I want pre-built expansion packs with squads, constitutions, and templates,
So that I get domain-specific tooling out of the box.

**Acceptance Criteria:**

**Given** `buildpact adopt --pack legal`
**When** the legal pack installs
**Then** it provides: a legal squad, domain constitution rules, and example specifications

**Given** the pack registry
**When** browsed
**Then** packs for at least healthcare, legal, education, and fintech are available

**Given** a user already has a squad
**When** a pack is installed
**Then** pack constitution merges with existing (not replaces) and pack squad installs alongside (not overwrites)

---

### Story 25.4: Advanced Memory Tiers

As an organization wanting to share learnings across teams,
I want org-level memory that captures cross-team insights,
So that lessons from one team are available to all.

**Acceptance Criteria:**

**Given** org-level memory at `.buildpact-org/memory/`
**When** a project identifies a reusable pattern
**Then** `buildpact memory promote --to org "pattern-name"` copies it to org level

**Given** org memory has promoted patterns
**When** any project runs `buildpact plan`
**Then** relevant org patterns are included in planning context

**Given** `buildpact memory --scope org`
**When** queried
**Then** all org entries are listed with anonymized source, date, and tags

**Given** privacy concerns
**When** promoting to org memory
**Then** project-specific details (paths, variables) are stripped, preserving only abstract patterns
