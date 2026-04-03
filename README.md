# BuildPact

**Stop prompting. Start building with a contract.**

BuildPact is a spec-driven development framework that brings structure to AI-assisted workflows. Describe what you want in plain language — BuildPact turns it into structured specs, actionable plans, and verified code through a repeatable 4-phase pipeline: **Specify → Plan → Execute → Verify**.

Works with **Claude Code**, **Cursor**, **Gemini CLI**, and **Codex**. Fully bilingual: **English** and **Português (Brasil)**.

---

## Table of Contents

- [Why BuildPact?](#why-buildpact)
- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started: Greenfield Project](#getting-started-greenfield-project)
- [Getting Started: Brownfield Project](#getting-started-brownfield-project)
- [The Pipeline: Step by Step](#the-pipeline-step-by-step)
- [Slash Commands Reference](#slash-commands-reference)
- [Meet Your Squad](#meet-your-squad)
- [Constitution: Your Project Rulebook](#constitution-your-project-rulebook)
- [Model Profiles & Budget Guards](#model-profiles--budget-guards)
- [Autonomy Levels](#autonomy-levels)
- [Project Structure](#project-structure)
- [CI Integration](#ci-integration)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Why BuildPact?

Most AI workflows are "prompt and pray" — you describe something, the AI writes code, and you hope it works. BuildPact replaces hope with a contract:

| Phase | What happens | Output |
|-------|-------------|--------|
| **Specify** | Your description becomes a structured spec with acceptance criteria | `spec.md` |
| **Plan** | Parallel research + wave-based task breakdown | `plan.md` + waves |
| **Execute** | Isolated agents implement each task with atomic commits | Git commits |
| **Verify** | Walk through each acceptance criterion with adversarial audit | Verification report |

Every step is auditable. Every AI output is checked against your project's **constitution** — immutable rules you define. Every task gets its own git commit.

---

## Requirements

- **Node.js** 20+ (22+ recommended)
- **Git** in your PATH
- An AI coding tool: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Cursor](https://cursor.sh), [Gemini CLI](https://github.com/google-gemini/gemini-cli), or [Codex](https://github.com/openai/codex)

---

## Installation

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/leoeloys/buildpact/main/scripts/install.sh | bash
```

That's it. Verify:

```bash
buildpact --version
```

### Alternative: npm from GitHub

```bash
npm install -g github:leoeloys/buildpact
```

### Use it in your project

```bash
# New project (greenfield)
mkdir my-app && cd my-app
git init
buildpact init

# OR existing project (brownfield)
cd my-existing-app
buildpact adopt
```

The `buildpact` command is global — use it from any project directory.

### Updating

```bash
buildpact upgrade
```

This auto-updates the CLI from GitHub and migrates your project schema. Or re-run the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/leoeloys/buildpact/main/scripts/install.sh | bash
buildpact upgrade
```

---

## Getting Started: Greenfield Project

A greenfield project starts from scratch. BuildPact scaffolds everything you need.

### Step 1 — Initialize

```bash
mkdir my-project && cd my-project
git init
buildpact init
```

The interactive wizard walks you through:

| Question | Options |
|----------|---------|
| **Language** | English / Português (Brasil) |
| **Location** | Initialize here / Create new folder |
| **Domain** | software / marketing / health / research / management / custom |
| **IDEs** | Claude Code, Cursor, Gemini CLI, Codex (multi-select) |
| **Experience** | beginner / intermediate / expert |
| **Install Squad** | Yes / No |

### Step 2 — Review what was created

After init completes, your project has:

```
my-project/
  .buildpact/
    config.yaml              # Project settings (language, domain, profile, budget)
    constitution.md          # Your project rules (coding standards, quality gates)
    project-context.md       # Context snapshot for AI agents
    profiles/
      balanced.yaml          # Default: Sonnet across all phases
      quality.yaml           # Opus for critical work
      budget.yaml            # Haiku for prototyping
    squads/
      software/              # Your agent team
        squad.yaml           # Squad manifest
        agents/              # Agent definitions (Pacto, Sofia, Renzo, Coda, Crivo, Lira)
        hooks/               # Pre/post-phase hooks
        templates/            # Squad-specific templates
  .claude/
    commands/bp/             # Slash commands (if Claude Code selected)
```

### Step 3 — Edit your constitution

The constitution defines the rules every AI agent must follow. Open it and customize:

```bash
buildpact constitution
```

Define rules across five areas: coding standards, compliance requirements, architectural constraints, quality gates, and domain rules.

### Step 4 — Build your first feature

**Quick path** (small tasks, zero ceremony):

```bash
buildpact quick "add a health check endpoint that returns { status: ok }"
```

This runs the entire pipeline in one shot — spec, plan, execute, and commit.

**Full pipeline** (larger features):

```bash
buildpact specify "user authentication with email and password"
buildpact plan
buildpact execute
buildpact verify
```

### Step 5 — Verify setup

```bash
buildpact doctor
```

Checks Node.js version, Git availability, `.buildpact/` structure, IDE configurations, and squad installation.

### Greenfield Workflow Diagram

```
buildpact init
    │
    ├── Wizard: language, domain, IDE, experience, squad
    │
    ├── Creates .buildpact/ with config, constitution, profiles, squad
    │
    ├── Installs IDE slash commands (.claude/commands/bp/)
    │
    └── Ready to build
         │
         ├── Small task?  →  buildpact quick "description"
         │                       └── Spec → Plan → Execute → Commit (one shot)
         │
         └── Large feature?  →  buildpact specify "description"
                                    → buildpact plan
                                    → buildpact execute
                                    → buildpact verify
```

---

## Getting Started: Brownfield Project

A brownfield project already has code, linters, CI, and conventions. BuildPact scans what exists and adapts.

### Step 1 — Adopt

```bash
cd my-existing-project
buildpact adopt
```

The adoption scanner automatically detects:

| What it scans | Examples |
|---------------|---------|
| **Language** | TypeScript, Python, Go, Rust, Java |
| **Package manager** | npm, pip, go modules, cargo |
| **Linters** | ESLint, Prettier, Ruff, gofmt, clippy |
| **CI pipelines** | GitHub Actions, CircleCI, Travis CI |
| **Build tools** | Webpack, Vite, Makefile, Gradle |
| **Git history** | Commits, branches, tags, conventions |
| **Frameworks** | Next.js, Express, Django, FastAPI |

### Step 2 — Review generated configuration

BuildPact creates `.buildpact/` pre-filled with what it found:

- **`config.yaml`** — language, package manager, and CI already set
- **`constitution.md`** — pre-populated with rules from your linters and CI (e.g., "ESLint required", "TypeScript strict mode", "tests must pass before merge")
- **`project-context.md`** — snapshot of your architecture for AI agents

The adoption **never overwrites** existing configuration — it merges safely.

### Step 3 — Customize and verify

Review the generated constitution and adjust:

```bash
buildpact constitution    # Review and edit rules
buildpact doctor          # Verify everything is set up correctly
```

### Step 4 — Start building

```bash
# Quick fix
buildpact quick "fix the login redirect bug"

# Add a feature with the full pipeline
buildpact specify "add CSV export to the reports page"
buildpact plan
buildpact execute
buildpact verify
```

### Brownfield Workflow Diagram

```
cd existing-project
    │
    buildpact adopt
    │
    ├── Scans: language, linters, CI, frameworks, git history
    │
    ├── Creates .buildpact/ pre-filled from detected stack
    │   ├── config.yaml (language, package manager, CI detected)
    │   ├── constitution.md (rules from ESLint, Prettier, CI, etc.)
    │   └── project-context.md (architecture snapshot)
    │
    ├── Installs IDE slash commands
    │
    └── buildpact doctor  →  Verify setup
         │
         └── Ready to build (same pipeline as greenfield)
```

### Key Differences: Greenfield vs Brownfield

| Aspect | Greenfield (`init`) | Brownfield (`adopt`) |
|--------|-------------------|---------------------|
| **Entry point** | `buildpact init` | `buildpact adopt` |
| **Configuration** | Wizard guides all choices | Auto-scanned from your project |
| **Constitution** | Template with example rules | Generated from linters, CI, and conventions |
| **Squad** | Bundled default (Software) | Detected or suggested based on domain |
| **Existing files** | All new | Merge only — never overwrites |
| **Time** | ~1 minute | ~2 minutes |

---

## The Pipeline: Step by Step

### Phase 1 — Specify (`/bp:specify`)

Sofia (Product Manager) transforms your natural language description into a structured specification.

```bash
buildpact specify "user authentication with email and password"
```

**What happens:**

1. Reads your description and project context
2. Asks clarifying questions to resolve ambiguity (beginner mode: more questions; expert mode: fewer)
3. Collects domain-specific constraints from your active squad
4. Generates acceptance criteria in Gherkin format with MoSCoW priority tags
5. Validates output against your constitution
6. Runs advanced elicitation (pre-mortem analysis, first principles, red team review)

**Output:** `.buildpact/specs/{feature-slug}/spec.md`

```markdown
# Spec: User Authentication

## Acceptance Criteria

- [MUST] Given a valid email and password, when the user submits login,
  then a session token is returned
- [MUST] Given an invalid password, when the user submits login,
  then a 401 error is returned with a generic message
- [SHOULD] Given 5 failed attempts, when the user tries again,
  then the account is temporarily locked for 15 minutes
```

---

### Phase 2 — Plan (`/bp:plan`)

Renzo (Architect) creates a wave-based implementation plan with parallel research.

```bash
buildpact plan
```

**What happens:**

1. **Parallel research** — 3 isolated subagents research simultaneously:
   - Tech stack analysis (package.json, frameworks, dependencies)
   - Codebase scan (existing patterns, architecture, conventions)
   - Squad domain constraints (compliance rules, best practices)
2. Extracts tasks from each acceptance criterion
3. Builds a dependency graph and assigns waves (tasks with no dependencies run in parallel)
4. Generates Architecture Decision Records (ADRs) for significant choices
5. Validates plan from 4 perspectives: completeness, consistency, dependencies, feasibility

**Output:** `.buildpact/plans/{feature-slug}/plan.md` + wave files + ADRs

```
Wave 1: [Setup auth middleware, Create user model]     ← Parallel
Wave 2: [Implement login endpoint, Add password hash]  ← After Wave 1
Wave 3: [Add rate limiting, Write integration tests]   ← After Wave 2
Wave 4: [Update documentation]                         ← After Wave 3
```

---

### Phase 3 — Execute (`/bp:execute`)

Coda (Developer) implements each task with isolated subagents and atomic commits.

```bash
buildpact execute
```

**What happens:**

1. Acquires execution lock (prevents concurrent sessions)
2. For each wave, creates isolated subagents — one per task
3. Each subagent receives a clean context package (~20KB): constitution, project context, research, and task plan
4. Tasks within a wave execute in parallel
5. Each completed task produces one atomic git commit
6. Crash recovery: retry → simplify → skip (3-level strategy)
7. Budget guards check limits before each wave

**Output:** Git commits (one per task) with conventional commit messages

```
feat(auth): add user model with email and password hash
feat(auth): implement POST /login endpoint
feat(auth): add bcrypt password hashing
feat(auth): add rate limiting (5 attempts / 15 min)
test(auth): add integration tests for login flow
docs(auth): update API documentation
```

---

### Phase 4 — Verify (`/bp:verify`)

Crivo (QA Engineer) walks through each acceptance criterion and runs adversarial audits.

```bash
buildpact verify
```

**What happens:**

1. Extracts all acceptance criteria from the original spec
2. Guides you through each criterion with keyword-matched verification steps
3. Runs a mandatory adversarial review (minimum 3 findings):
   - Edge cases, assumptions, security issues, error paths, race conditions, spec gaps
4. Generates fix plans for any failed criteria
5. Captures lessons and patterns into 3-tier memory:
   - **Tier 1:** Session feedback (per-spec outcomes)
   - **Tier 2:** Recurring patterns (failures that repeat across specs)
   - **Tier 3:** Architectural decisions (persisted for future reference)

**Output:** `.buildpact/specs/{feature-slug}/verification-report.md`

```markdown
| # | Acceptance Criterion | Verdict |
|---|---------------------|---------|
| 1 | Valid login returns session token | PASS |
| 2 | Invalid password returns 401 | PASS |
| 3 | Account locks after 5 failures | PASS |

Adversarial Findings:
- Token expiration not specified in spec (MINOR)
- No CSRF protection on login endpoint (MAJOR)
- Password length minimum not enforced (MEDIUM)
```

---

### The Quick Path

For small tasks that don't need the full pipeline:

```bash
# Zero ceremony — straight to code
buildpact quick "fix the login bug"

# With clarifying questions first
buildpact quick "add OAuth support" --discuss

# Full pipeline with verification (but still one command)
buildpact quick "add OAuth support" --full
```

The `quick` command assesses complexity (L0-L3) and picks the right mode:

| Scale | Complexity | Mode |
|-------|-----------|------|
| **L0** | Atomic (rename, typo fix) | `base` — direct implementation |
| **L1** | Small (bug fix, minor feature) | `base` — inline spec + implement |
| **L2** | Feature (new endpoint, new component) | `discuss` — clarifying questions first |
| **L3** | Complex (multi-file, architectural) | `full` — full pipeline with verification |

---

## Commands Reference

BuildPact has **33 commands** across CLI and IDE slash commands. When using **Claude Code**, slash commands are installed at `.claude/commands/bp/`.

### Core Pipeline (5 commands)

The heart of BuildPact — the 4-phase contract pipeline plus the quick shortcut.

| CLI | Slash | Agent | Description |
|-----|-------|-------|-------------|
| `buildpact specify "<description>"` | `/bp:specify` | Sofia (PM) | Transforms natural language into a structured spec with Gherkin acceptance criteria, ambiguity detection, MoSCoW priorities, and advanced elicitation (pre-mortem, red team, first principles) |
| `buildpact plan` | `/bp:plan` | Renzo (Architect) | Generates a wave-based implementation plan with parallel research (tech stack, codebase, domain), topological task sorting, Architecture Decision Records (ADRs), and 4-perspective validation (completeness, consistency, dependencies, feasibility) |
| `buildpact execute` | `/bp:execute` | Coda (Developer) | Executes plan waves with isolated subagents per task, atomic git commits, execution lock, crash recovery (retry → simplify → skip), and budget guards checked before each wave |
| `buildpact verify [spec_path]` | `/bp:verify` | Crivo (QA) | Walks through each acceptance criterion, runs mandatory adversarial audit (min. 3 findings: edge cases, security, race conditions, spec gaps), generates fix plans for failures, and captures lessons into 3-tier memory |
| `buildpact quick "<description>" [--discuss] [--full]` | `/bp:quick` | Sofia → Coda | Zero-ceremony execution — assesses complexity (L0-L3), picks the right mode (base/discuss/full), and runs the entire pipeline in one shot. Use `--discuss` for clarifying questions first, `--full` for verification included |

### Orchestration & Routing (3 commands)

Entry points for when you don't know which command to run next.

| CLI | Slash | Agent | Description |
|-----|-------|-------|-------------|
| `buildpact orchestrate` | `/bp:orchestrate` | Pacto | Master router — assesses your project state and user intent, then hands off to the right specialist (Sofia for features, Renzo for architecture, Coda for building, Crivo for testing, Lira for docs). **Recommended as the default starting command** |
| `buildpact diagnose` | `/bp:diagnose` | Pacto | Reads the diagnostic report, classifies project situation (fresh brownfield, has PRD, mid-sprint, stalled, ready to ship, healthy), and routes to the correct next action |
| `buildpact help` | `/bp:help` | Pacto | Context-aware help — scans project state, determines pipeline position (not initialized, fresh, spec ready, plan ready, executed, verified), and recommends the most useful next step with a quick reference card |

### Project Setup & Configuration (6 commands)

Initialize, adopt, configure, and maintain your BuildPact project.

| CLI | Slash | Description |
|-----|-------|-------------|
| `buildpact init [name]` | — | **Greenfield setup** — interactive wizard for language, domain, IDE, experience level, and squad selection. Scaffolds `.buildpact/` with config, constitution, profiles, and squad |
| `buildpact adopt` | — | **Brownfield adoption** — scans existing project (language, linters, CI, frameworks, git history) and generates pre-filled `.buildpact/` configuration. Never overwrites existing files |
| `buildpact constitution` | `/bp:constitution` | View and edit your project's immutable rules across 5 areas: coding standards, compliance, architecture, quality gates, and domain rules. Changes require explicit user consent and are versioned |
| `buildpact doctor` | `/bp:doctor` | Health check — verifies Node.js version (≥20), Git availability, `.buildpact/` directory structure, IDE configurations, squad installation, and constitution conflict detection |
| `buildpact upgrade` | `/bp:upgrade` | Updates BuildPact CLI to latest version, migrates project schema if needed, and reinstalls components (slash commands, squad templates, profiles). Run after updating the npm package |
| `buildpact status` | `/bp:status` | Pipeline dashboard — shows current phase, active spec/plan, progress metrics, squad status, and budget usage |

### Quality & Analysis (4 commands)

Audit, investigate, and maintain quality standards.

| CLI | Slash | Agent | Description |
|-----|-------|-------|-------------|
| `buildpact quality` | `/bp:quality` | Crivo (QA) | ISO 9001-inspired quality report — inventories all artifacts, checks process compliance (constitution validation, readiness gates, budget limits, adversarial reviews), measures first-pass yield (≥80%), traceability (100%), and adversarial density (≥3/spec). Outputs non-conformance report (CRITICAL/MAJOR/MINOR) |
| `buildpact investigate` | `/bp:investigate` | Renzo (Architect) | Deep research with 3 scope types: **domain** (industry standards, best practices, workflows), **codebase** (tech stack, architecture, conventions, pain points), **technology** (alternatives comparison, community health, migration cost) |
| `buildpact audit [--format json\|csv] [--from DATE] [--to DATE]` | — | — | Export action logs in JSON or CSV format with date filtering. All actions are logged to `.buildpact/audit/*.jsonl` (local, never committed) |
| `buildpact diff` | `/bp:diff` | — | Show changes since last verification — compare spec versions side by side |

### Documentation (3 commands)

Organize, index, and export project documentation.

| CLI | Slash | Agent | Description |
|-----|-------|-------|-------------|
| `buildpact docs` | `/bp:docs` | Lira (Tech Writer) | Scans entire project tree, detects misplaced files, checks for stale docs (>30 days), finds orphaned artifacts (specs without plans, unreferenced decisions), and generates a searchable `PROJECT-INDEX.md`. **Never moves files without explicit user authorization** |
| `buildpact export-web [platform]` | `/bp:export-web` | Lira (Tech Writer) | Generates a single copiable `.txt` bundle for pasting into Claude.ai (180K tokens), ChatGPT (128K tokens), or Gemini (1M tokens). Includes constitution, squad agents, project context, and disclaimers with token budget checking |
| `buildpact learn` | `/bp:learn` | — | Opens the getting-started tutorial in your default browser. Language-aware (EN/PT-BR) with SSH/CI fallback |

### Squads & Agents (5 commands)

Create, install, validate, and discover specialized agent teams.

| CLI | Slash | Description |
|-----|-------|-------------|
| `buildpact squad create <name>` | `/bp:squad` | Scaffold a custom squad with 4-tier agent hierarchy (Chief T1, Specialist T2, Support T3, Reviewer T4), 6-layer agent anatomy (Identity, Persona, Voice DNA, Heuristics, Examples, Handoffs), and squad.yaml manifest |
| `buildpact squad validate [dir] [--community]` | `/bp:squad` | Validate squad structure across 6 categories: structural completeness, Voice DNA, heuristics, examples, handoffs, and security. Use `--community` for stricter marketplace checks |
| `buildpact squad add <name>` | `/bp:squad` | Install a squad from the community hub. Runs structural + security validation before activation. Blocks unsafe squads automatically |
| `buildpact hub search [query]` | `/bp:hub` | Browse community squads with filtering by domain, sorting by downloads/quality/name, and relevance-ranked search |
| `buildpact hub info <name>` | `/bp:hub` | View squad details: description, agents, quality score (Gold 90+, Silver 70-89, Bronze 50-69, Unrated <50), download count, and compatibility |

### Agent Mode (3 commands)

Persistent agent supervisor for walk-away execution.

| CLI | Slash | Description |
|-----|-------|-------------|
| `buildpact agent start` | — | Start the persistent agent supervisor with PID management, event bus (pub/sub, messaging, broadcasts), and auto-advance execution. Processes waves sequentially, pauses on failure or budget limit |
| `buildpact agent stop` | — | Stop the agent supervisor gracefully |
| `buildpact agent status` | — | Check agent supervisor status, current wave, and execution progress |

### Advanced (3 commands)

Optimization, memory, and migration tools.

| CLI | Slash | Description |
|-----|-------|-------------|
| `buildpact optimize` | `/bp:optimize` | Autonomous optimization engine — runs fixed-budget experiment loops with Git Ratchet (commits only proven improvements), domain-specific metrics, and statistical winner selection (p < 0.05). Experiments run in temp dirs, never touch working code |
| `buildpact memory` | `/bp:memory` | Manage 3-tier agent memory: **Tier 1** session feedback (per-spec outcomes), **Tier 2** lessons & patterns (recurring failures distilled at ≥2 occurrences), **Tier 3** decisions log (architectural choices persisted as JSON) |
| `buildpact migrate-to-agent` | `/bp:migrate-to-agent` | Validates existing artifacts and generates Agent Mode configuration for persistent supervisor execution |

### System (2 commands)

Shell completion and version management.

| CLI | Slash | Description |
|-----|-------|-------------|
| `buildpact completion [--install]` | — | Generate shell completion scripts for bash, zsh, and fish |
| `buildpact --version` | — | Show installed BuildPact version (also `-v` or `version`) |

### Quick Reference: All Slash Commands

```
/bp:orchestrate    /bp:specify      /bp:plan         /bp:execute
/bp:verify         /bp:quick        /bp:diagnose     /bp:help
/bp:constitution   /bp:doctor       /bp:upgrade      /bp:status
/bp:quality        /bp:investigate  /bp:diff         /bp:docs
/bp:export-web     /bp:learn        /bp:squad        /bp:hub
/bp:optimize       /bp:memory       /bp:migrate-to-agent
```

---

## Meet Your Squad

BuildPact ships with specialized AI agent teams called **squads**. Each agent has a distinct role, personality, expertise, and guardrails.

### Default Squad: Software

| Agent | Role | Tier | What they do |
|-------|------|------|-------------|
| **Pacto** | Orchestrator | T0 | Routes work, manages handoffs between agents, celebrates progress |
| **Sofia** | Product Manager | T1 | Captures requirements, writes specs, detects ambiguity |
| **Renzo** | Architect | T1 | Designs systems, creates ADRs, validates plans |
| **Coda** | Developer | T2 | Implements code, writes tests, follows constitution |
| **Crivo** | QA Engineer | T2 | Adversarial audits, acceptance testing, quality reports |
| **Lira** | Tech Writer | T3 | Documentation, indexing, knowledge organization |

### Available Squads

| Squad | Domain | Use case |
|-------|--------|----------|
| **Software** | Full-stack development | Web apps, APIs, CLIs, libraries |
| **Medical Marketing** | CFM-compliant health marketing | Clinics, specialists, healthcare |
| **Scientific Research** | Academic methodology | Papers, studies, data analysis |
| **Clinic Management** | Healthcare operations | Scheduling, compliance, workflows |
| **Agent Builder** | Meta-squad | Creating new squads |

### Agent Architecture (6 Layers)

Every agent definition includes:

1. **Identity** — Who they are and their purpose
2. **Persona** — How they communicate (voice, tone)
3. **Voice DNA** — Personality anchors, opinion stance, anti-patterns, never-do rules
4. **Heuristics** — Decision-making rules and pattern matching
5. **Examples** — Real-world interaction samples
6. **Handoffs** — How they receive and pass work to other agents

### Installing Community Squads

```bash
buildpact hub search "healthcare"     # Browse available squads
buildpact hub info clinic-ops         # View details and quality score
buildpact squad add clinic-ops        # Install into your project
```

Squads are scored 0-100: **Gold** (90+), **Silver** (70-89), **Bronze** (50-69), **Unrated** (<50).

---

## Constitution: Your Project Rulebook

The constitution defines immutable rules that every AI agent must follow. Every AI output is validated against it.

```bash
buildpact constitution
```

### Five Rule Areas

| Area | Examples |
|------|---------|
| **Coding Standards** | TypeScript strict mode, no `console.log` in production, named exports only |
| **Compliance** | HIPAA, LGPD, GDPR, CFM advertising rules |
| **Architecture** | No circular dependencies, layered architecture, max file size |
| **Quality Gates** | All tests must pass, code review required, minimum coverage |
| **Domain Rules** | Medical disclaimers, WCAG 2.1 AA accessibility, data retention policies |

### Key Guarantees

- Constitution changes are **never automated** — even fully autonomous agents need your explicit approval
- Every change is versioned and logged
- Enforcement happens at phase boundaries (after specify, plan, execute, and verify)
- In `quick` mode, violations produce warnings (not hard blocks) to preserve zero-ceremony flow

---

## Model Profiles & Budget Guards

### Three Built-in Profiles

| Profile | Use case | Models | Cost |
|---------|---------|--------|------|
| **balanced** (default) | Day-to-day work | Sonnet across all phases | $$ |
| **quality** | Critical features | Opus for research + execution | $$$$ |
| **budget** | Prototyping, exploration | Haiku across all phases | $ |

Each profile includes failover chains — if your primary model is unavailable, BuildPact automatically falls back to the next model in the chain.

Set your profile in `.buildpact/config.yaml`:

```yaml
active_model_profile: "balanced"
```

### Budget Guards

Prevent runaway costs with configurable limits:

```yaml
budget:
  per_session_usd: 5.00        # Total per run
  per_phase_usd: 2.00          # Max per phase
  per_day_usd: 20.00           # Daily ceiling
  warning_threshold: 0.8       # Alert at 80%
```

BuildPact checks limits before each wave and blocks execution if exceeded.

---

## Autonomy Levels

Each agent operates at a configurable autonomy level:

| Level | Name | Behavior |
|-------|------|---------|
| **L1** | Supervised | Agent proposes, you approve every action |
| **L2** | Guided | Agent acts within guardrails, you approve risky actions |
| **L3** | Autonomous | Agent acts freely, you review results |
| **L4** | Full Auto | Agent acts and commits without intervention |

Default: **L2 (Guided)**.

Agents can be promoted automatically: ≥85% approval rate over 7 days → eligible for next level.

---

## Project Structure

```
.buildpact/
  config.yaml              # Settings (language, domain, profile, budget)
  constitution.md          # Project rules (immutable at runtime)
  project-context.md       # Architecture snapshot for AI agents
  audit/                   # Action logs — JSONL format (local, not committed)
  profiles/                # Model profiles (balanced, quality, budget)
  specs/{slug}/spec.md     # Specifications (one per feature)
  plans/{slug}/plan.md     # Plans + wave files (one per feature)
  squads/{name}/           # Agent teams (squad.yaml + agents/ + hooks/)
  memory/                  # Agent memory (local, not committed)
  reports/                 # Quality and verification reports
  investigations/          # Domain, codebase, and tech research
  exports/                 # Web bundles for Claude.ai/ChatGPT/Gemini
```

**Commit to git:** `config.yaml`, `constitution.md`, `project-context.md`, `profiles/`, `squads/`, specs, plans.

**Keep local:** `audit/`, `memory/`.

---

## CI Integration

BuildPact includes a GitHub Action for running commands in CI:

```yaml
# .github/workflows/buildpact.yml
name: BuildPact Verify
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: leoeloys/buildpact@v2
        with:
          command: verify
          budget: "1.00"
          ci-mode: true
```

### CI Mode

```bash
# Non-interactive execution via flag
buildpact plan --ci

# Or via environment variable
BP_CI=true buildpact execute
```

### Webhooks

Configure notifications for pipeline events in `.buildpact/config.yaml`:

```yaml
webhooks:
  - url: "https://hooks.slack.com/services/..."
    events: ["verify.complete", "execute.fail"]
```

---

## Full User Journey: End to End

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIRST TIME SETUP                         │
├────────────────────────┬────────────────────────────────────────┤
│    New Project         │    Existing Project                    │
│                        │                                        │
│    (install buildpact) │    (install buildpact)                 │
│    buildpact init      │    cd my-project                       │
│    (wizard)            │    buildpact adopt                     │
│                        │    (auto-scan)                         │
├────────────────────────┴────────────────────────────────────────┤
│                                                                 │
│    buildpact doctor         ← Verify setup                      │
│    buildpact constitution   ← Customize rules                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        DAILY WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    Small task:                                                   │
│      buildpact quick "fix the bug"                              │
│                                                                 │
│    Feature:                                                      │
│      buildpact specify "add user auth"   → spec.md              │
│      buildpact plan                      → plan.md + waves      │
│      buildpact execute                   → git commits          │
│      buildpact verify                    → verification report  │
│                                                                 │
│    Don't know where to start?                                    │
│      /bp:orchestrate    ← Pacto routes you to the right agent   │
│      /bp:help           ← Context-aware next step suggestion    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     QUALITY & MAINTENANCE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    buildpact quality       ← ISO 9001-inspired quality report   │
│    buildpact investigate   ← Deep domain/codebase/tech research │
│    buildpact docs          ← Organize and index documentation   │
│    buildpact audit         ← View action logs                   │
│    buildpact optimize      ← Continuous improvement loop        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## FAQ

**How is this different from just using Claude Code or Cursor?**
BuildPact adds a repeatable pipeline on top of your AI tool. Instead of ad-hoc prompts, you get specifications, plans, and verification. The AI still does the work — BuildPact makes sure it does the *right* work.

**Do I need all 4 phases?**
No. Use `quick` for small changes, `specify` + `plan` + `execute` for features, and the full pipeline with `verify` for critical work.

**Can I use it for non-software projects?**
Yes. BuildPact supports healthcare, research, marketing, and management domains. The pipeline stays the same — the squads, rules, and vocabulary adapt.

**Does it send data to external servers?**
No. BuildPact is a local CLI. It generates files on your machine and delegates to whatever AI tool you already use.

**What's the difference between `init` and `adopt`?**
`init` = new project, blank slate, wizard-guided. `adopt` = existing project, scans your stack and pre-fills configuration from what it finds.

**What's the difference between `quick` and the full pipeline?**
`quick` runs everything in one command — ideal for bug fixes, small features, and rapid prototyping. The full pipeline (`specify → plan → execute → verify`) gives you review points between each phase, wave-based parallelism, and thorough verification. Use the full pipeline for critical features.

**Can I create my own squad?**
Yes. Run `buildpact squad create my-domain` to scaffold a new squad, then customize the agents. See the [Squad Creation Guide](docs/en/guide/squad-creation.md).

**What languages does the CLI support?**
English and Português (Brasil). All commands, error messages, and agent interactions are fully translated. Set your language during `init`/`adopt` or in `.buildpact/config.yaml`.

---

## Contributing

```bash
git clone https://github.com/leoeloys/buildpact.git
cd buildpact
npm install
npm test              # 3557 tests
npm run build         # Compile with tsdown
npm link              # Make 'buildpact' available globally for testing
```

Architecture:

```
src/
  cli/          # Entry point and installation flow
  contracts/    # Types, error codes, Result<T, CliError> pattern
  foundation/   # i18n, audit, profiles, scanner, installer, adopter
  engine/       # 56 modules — orchestration, verification, enforcement, quality
  data/         # Compression rules, elicitation methods
  commands/     # One directory per command (29 commands)
```

The engine layer implements 67 concepts from 9 frameworks as programmatic enforcement — not prompt pressure. Key subsystems:

| Layer | Modules | Purpose |
|-------|---------|---------|
| **Orchestration** | role-boundary, handoff-protocol, dispatch-pipeline | Multi-agent governance |
| **Verification** | verification-gate, debug-protocol, faithfulness-checker | Evidence-based completion |
| **Enforcement** | tdd-enforcer, spec-first-gate, self-critique, approval-gates | Hard gates that block |
| **Quality** | quality-gates, consistency-analyzer, adversarial-review | Progressive QA |
| **Observability** | metrics-ledger, project-ledger, session-forensics | Cost tracking and audit |

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT
