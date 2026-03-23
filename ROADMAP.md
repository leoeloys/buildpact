# BuildPact Roadmap

## Current Version: 0.1.0-alpha.5

BuildPact is a spec-driven development framework that turns natural language into structured specs, plans, and verified code. This roadmap tracks completed work, in-progress items, and future direction.

---

## Alpha Phase (Complete)

### Done (Epics 1-12)

- **Epic 1: Project Foundation & Setup** -- CLI init, doctor diagnostics, subagent isolation, context monitoring, document sharding, decision log
- **Epic 2: Constitution** -- Create/edit project constitution, automatic enforcement at every phase, versioning and change tracking
- **Epic 3: Quick Flow** -- Zero-ceremony single-shot execution, discuss mode (conversational), plan verification variant
- **Epic 4: Specify** -- Natural language to structured spec, ambiguity detection with clarification, domain-aware squad integration, automation maturity assessment
- **Epic 5: Plan** -- Automated parallel research, wave-based plan generation, model profile configuration, Nyquist multi-perspective validation, non-software domain planning
- **Epic 6: Execute** -- Wave parallel execution with subagent isolation, atomic git commits per task, crash recovery with strategy rotation, goal-backward wave verification, budget guards, execution lock
- **Epic 7: Verify & Memory** -- Guided acceptance test, automatic fix plan generation, 3-tier memory layer (session feedback, lessons/patterns, decisions log)
- **Epic 8: Squad Architecture** -- 6-layer agent definition, voice DNA (5-section template), structural validation, autonomy leveling (L0-L4), lazy agent loading, squad scaffolder
- **Epic 9: Reference Squads** -- Software (PM, Architect, Dev, QA, Writer), Medical Marketing (CFM-compliant), Scientific Research, Clinic Management, Agent Builder (meta-squad)
- **Epic 10: Web Bundle Export** -- Export command, progressive compression, conversational interface adaptation, bundle versioning and staleness detection
- **Epic 11: Community Hub** -- Public hub repository, squad contribution flow with automated CI, community health and governance infrastructure
- **Epic 12: AutoResearch** -- Architecture decision record, command and program file, fixed-budget experiment loop, git ratchet (commit only proven improvements), domain-specific metrics, optimization report

### Alpha -- Prompt Mode Only (CLI shows guidance)

These commands work fully as IDE slash commands (`/bp:*` templates). The CLI handlers display guidance directing users to slash-command mode:

- `orchestrate` -- Master orchestrator (Pacto) routes to specialists
- `quality` -- ISO 9001-inspired quality report (Crivo)
- `docs` -- Documentation organization (Lira)
- `investigate` -- Domain, codebase, and technology research

### Known Alpha Stubs

These shipped as architectural frameworks with stubbed execution:

- `executeTaskStub()` in wave-executor -- returns success without real AI dispatch
- AutoResearch experiment loop -- completes after 1 "no_change" iteration
- Budget guard uses `STUB_COST_PER_TASK_USD = 0.001` (simulated cost)
- CLI `memory` command -- returns NOT_IMPLEMENTED
- CLI `export-web` command -- returns NOT_IMPLEMENTED

---

## Beta Phase (Next -- Pipeline Goes Live)

> **Theme:** Replace every stub with real execution. The pipeline becomes production-capable.

### Epic 13: Live Subagent Dispatch

The single most important Beta deliverable. Replace `executeTaskStub()` with real AI task execution.

- **13-1: Subagent provider abstraction** -- Provider interface supporting Claude Code (Tool Use API), with extension points for future providers. Clean context window per task (FR-302).
- **13-2: Task payload serialization** -- Serialize plan tasks into structured payloads with: task description, relevant file paths, spec context, constitution rules, and autonomy level constraints.
- **13-3: Live wave execution with concurrency** -- Replace sequential stub dispatch with real parallel execution within waves. Respect wave ordering (wave N completes before wave N+1 starts).
- **13-4: Streaming progress output** -- Real-time task progress in terminal during wave execution. Show: task name, agent status, elapsed time, cost accumulation.
- **13-5: Result validation and error routing** -- Validate subagent outputs against task requirements. Route failures to crash recovery system (FR-703). Map subagent errors to actionable user messages.
- **13-6: Real cost tracking integration** -- Replace stub cost with actual API token usage. Cost projection before execution ("this plan will cost ~$X"). Budget guard enforcement with real spend data.

### Epic 14: CLI Command Completion

Activate the remaining CLI commands that currently return NOT_IMPLEMENTED or redirect to IDE.

- **14-1: `bp memory` CLI command** -- Read, search, and manage all 3 memory tiers from terminal. List lessons, view decisions, search feedback by keyword/date.
- **14-2: `bp export-web` CLI command** -- Functional web bundle export for Claude.ai, ChatGPT, Gemini. Token budget management and platform-specific limits. Progressive compression applied.
- **14-3: `bp status` pipeline dashboard** -- Show current pipeline state: specs created, plans generated, execution progress, verification results, memory entries. Color-coded progress indicators.
- **14-4: `bp diff` change tracker** -- Show what files changed since last verify. Highlight unverified changes. Integration with git diff and .buildpact state.
- **14-5: Shell completion** -- Tab completion for all commands, flags, and common arguments. Support for bash, zsh, fish.

### Epic 15: Quality & Safety Hardening

- **15-1: Constitution conflict detection** -- Detect contradictory rules in constitution.md (e.g., "always use semicolons" vs "never use semicolons"). Report conflicts with line references and suggest resolution.
- **15-2: Audit trail export** -- Export `.buildpact/audit/` data as JSON or CSV. Include: command history, cost data, verification results, memory entries. Filterable by date range and command type.
- **15-3: CLI quality command (Crivo)** -- Full CLI implementation of ISO 9001-inspired quality report. Currently IDE-only; bring to CLI with same functionality.
- **15-4: CLI docs command (Lira)** -- Full CLI implementation of documentation organizer. Tree scan, misplacement detection, staleness check, PROJECT-INDEX.md generation.
- **15-5: CLI investigate command** -- Full CLI implementation of domain/codebase/technology research. Currently IDE-only; bring to CLI.

### Epic 16: Squad Ecosystem Maturity

- **16-1: Squad version pinning** -- Lock squad versions in `.buildpact/squad-lock.yaml`. Detect version drift. Support `bp squad update` to bump versions.
- **16-2: Squad smoke test runner** -- `bp squad test <squad-name>` runs validation suite against squad agents. Tests: agent loading, voice DNA parsing, autonomy level checks, domain question flows.
- **16-3: Cross-squad collaboration protocol** -- Define how agents from different squads communicate during execution. Message format, handoff protocol, shared context rules.

### Epic 17: E2E Testing & Stabilization

- **17-1: E2E pipeline test suite** -- Automated tests covering full specify -> plan -> execute -> verify flow. Test with Software Squad across both languages. Snapshot-based output validation.
- **17-2: Persona validation scripts** -- Persona B (developer) end-to-end journey automated. Persona D (web user) bundle export and session validated. Persona A (Dr. Ana) medical marketing flow validated.
- **17-3: Error message audit** -- Review all error paths for actionable messages. Replace technical errors with user-friendly guidance. Ensure i18n coverage for all error messages.
- **17-4: Beta release stabilization** -- Bug triage, performance profiling, dependency audit. Release as v0.2.0-beta.1.

---

## v1.0 Release -- Production Grade

> **Theme:** Enterprise readiness, official integrations, production polish.

### Epic 18: Enterprise Compliance & Access Control

- **18-1: Compliance profile system** -- Pre-built compliance profiles: SOC 2, HIPAA, GDPR, LGPD. Each profile auto-generates constitution rules for the target framework. `bp init --compliance hipaa` during setup.
- **18-2: Team role-based pipeline access** -- Define roles (admin, developer, reviewer, viewer) with pipeline phase permissions. Role definitions in `.buildpact/team.yaml`. Enforcement at command level.
- **18-3: Centralized constitution management** -- Multi-repo constitution inheritance. Organization-level base constitution with per-repo overrides. `bp constitution pull <org-base-url>` to sync.
- **18-4: Audit log shipping** -- Export audit events to external systems: webhooks, Slack, Datadog, PagerDuty. Configurable event filters. Real-time streaming or batch export.

### Epic 19: Community Marketplace

- **19-1: Marketplace browsing from CLI** -- `bp squad browse` searches community hub. Filter by domain, rating, downloads. Show squad metadata, author, last update.
- **19-2: Ratings and reviews system** -- Users rate and review community squads. Aggregate scores displayed in browse results. Flag system for policy violations.
- **19-3: Squad certification program** -- Verified badge for squads meeting quality criteria: test coverage, documentation completeness, author identity verification, security audit pass.
- **19-4: Featured squads curation** -- Editorial picks and trending squads on community hub. Monthly spotlight program for outstanding contributions.

### Epic 20: Plugin System & Integrations

- **20-1: Pipeline phase plugin API** -- Extension points for custom pipeline phases. Plugin manifest format. Lifecycle hooks: before/after each phase. Plugin registry in `.buildpact/plugins/`.
- **20-2: GitHub Actions integration** -- Official action: `buildpact/verify-action`. Run verification on PR. Post results as PR comment. Block merge on failed verification.
- **20-3: GitLab CI integration** -- Official CI template for GitLab. Same verify-on-MR workflow as GitHub.
- **20-4: Slack integration** -- Notification bot for pipeline events: execution complete, verification failed, budget alert. Channel-based routing by project.

### Epic 21: Production Documentation & Launch

- **21-1: Complete documentation site** -- All commands, workflows, and APIs documented. Tutorials for each persona. Architecture guides for contributors. Hosted on docs site.
- **21-2: Migration guides** -- Upgrade guide from Alpha -> Beta -> v1.0. Breaking changes documented with automated migration scripts.
- **21-3: GitHub Sponsors setup** -- Sponsor tiers defined. Sponsor benefits documented. Integration with community hub for sponsor badges.
- **21-4: v1.0 release** -- Final bug triage, security audit, performance benchmarks. Release as v1.0.0. Announcement and launch campaign.

---

## v2.0 Vision -- Agent Mode & Self-Optimization

> **Theme:** Autonomous execution, self-improving agents, cross-project intelligence.
>
> **Prerequisite:** Resolve OQ-02 (Pi SDK vs custom agent harness) before v2.0 planning begins.

### Epic 22: Agent Mode Runtime

- **22-1: Agent Mode TypeScript CLI** -- Standalone CLI with direct session control. Multi-provider support: Claude, Gemini, GPT. Provider-agnostic task dispatch interface.
- **22-2: Auto-advance walk-away execution** -- Execute full pipeline unattended with safety guardrails. Configurable autonomy boundaries. Emergency stop mechanism. Progress notifications.
- **22-3: Agent-to-agent communication** -- Direct channels between agents during execution. Shared context negotiation. Conflict resolution protocol when agents disagree.
- **22-4: Real-time execution dashboard** -- Terminal UI showing: active agents, task progress, cost burn rate, context usage per agent. Interactive controls: pause, skip, retry.
- **22-5: Crash recovery with session persistence** -- Full session state serialization. Resume from exact failure point after crash. Automatic retry with strategy rotation across providers.
- **22-6: Prompt-to-Agent migration command** -- `npx buildpact migrate-to-agent` validates and upgrades all v1.0 artifacts. Compatibility report with actionable remediation steps. Preserves git history intact.

### Epic 23: Self-Optimizing Squads

- **23-1: Squad optimization command** -- `/bp:optimize-squad <squad-name>` targets squad agent definitions. AutoResearch-powered prompt refinement for Voice DNA, heuristics, examples.
- **23-2: Benchmark sets** -- 10+ golden input-output pairs per squad. Automated scoring against benchmarks. Regression detection on prompt changes.
- **23-3: Optimization isolation** -- Dedicated git branches: `optimize/{squad-name}/{timestamp}`. No production impact until human review approves merge.
- **23-4: Optimization reports** -- Before/after metrics comparison. Specific prompt changes with rationale. Confidence scores and statistical significance.

### Epic 24: Cross-Project Intelligence

- **24-1: Cross-project learning (opt-in)** -- Lessons and patterns shared across repositories. Privacy-preserving aggregation. Organization-scoped knowledge bases.
- **24-2: Memory Layer advanced tiers** -- Tier 2: Lessons & Patterns with cross-session correlation. Tier 3: Decisions Log with architectural decision records. Auto-consolidation of recurring patterns.

### Epic 25: Localization & Expansion

- **25-1: Multi-language localization** -- Add ES, FR, DE, JA to existing EN/PT-BR. Locale files for all commands, errors, and templates. Community translation contribution flow.
- **25-2: Domain expansion packs** -- Pre-built squad templates: Legal, Finance, Education, DevOps. Each pack includes domain-specific constitution rules, agent definitions, and example workflows.
- **25-3: Visual pipeline editor** -- Web UI for designing custom pipeline flows. Drag-and-drop phase ordering. Visual dependency graph. Export as `.buildpact/pipeline.yaml`.
- **25-4: Federated squad networks** -- Organizations share private squads across teams. Access control and versioning. Central registry with distributed execution.

---

## Milestone Summary

| Milestone | Epics | Key Deliverable | Release |
|-----------|-------|-----------------|---------|
| **Alpha** | 1-12 (done) | Full pipeline in Prompt Mode | v0.1.0-alpha.5 |
| **Beta** | 13-17 | Live AI dispatch, CLI completion, E2E testing | v0.2.0-beta.1 |
| **v1.0** | 18-21 | Enterprise features, marketplace, plugins, launch | v1.0.0 |
| **v2.0** | 22-25 | Agent Mode, self-optimization, cross-project | v2.0.0 |

---

## How to Contribute

BuildPact is under active development. See the [Community Hub](https://github.com/buildpact/buildpact-squads) for squad contributions, or open an issue to suggest roadmap items.
