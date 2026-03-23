# BuildPact

**Spec-Driven Development framework** — bilingual CLI that turns natural language into structured specs, plans, and verified code.

BuildPact works with any AI coding tool (Claude Code, Cursor, Gemini CLI, Codex) and any domain (software, marketing, health, research, management). You describe what you want in plain language; BuildPact handles the pipeline from specification to verified delivery.

```
npm install -g buildpact
buildpact init
```

---

## Meet Your Squad

BuildPact comes with a team of named AI agents, each with distinct expertise:

| Agent | Role | What They Do |
|-------|------|-------------|
| **Pacto** | Master Orchestrator | Guides the entire process, routes to specialists |
| **Sofia** | Product Manager | Captures requirements, writes specs |
| **Renzo** | System Architect | Designs architecture, creates ADRs |
| **Coda** | Developer | Implements code, writes tests |
| **Crivo** | QA + ISO 9001 | Verifies quality, runs adversarial audits |
| **Lira** | Technical Writer | Organizes documentation |

Start with `/bp:orchestrate` — Pacto will assess your project and guide you to the right specialist.

---

## Table of Contents

- [Why BuildPact?](#why-buildpact)
- [Quick Start](#quick-start)
- [Installation](#installation)
  - [New Project (Greenfield)](#new-project-greenfield)
  - [Existing Project (Brownfield)](#existing-project-brownfield)
- [The Pipeline](#the-pipeline)
- [Commands Reference](#commands-reference)
- [Squads (Multi-Agent Teams)](#squads-multi-agent-teams)
- [Model Profiles](#model-profiles)
- [Constitution (Project Rules)](#constitution-project-rules)
- [Project Structure](#project-structure)
- [Upgrading](#upgrading)
- [FAQ](#faq)
- [Contributing](#contributing)

---

## Why BuildPact?

Most AI coding workflows follow a "prompt and pray" approach — you describe something, the AI writes code, and you hope it's correct. BuildPact replaces hope with structure:

1. **Specify** — Capture what you want as a structured spec with acceptance criteria
2. **Plan** — Generate a wave-based plan with parallel tasks and validation
3. **Execute** — AI agents implement the plan with isolated context per task
4. **Verify** — Walk through each acceptance criterion to confirm delivery

Every step produces auditable artifacts. Every AI output is checked against your project's constitution (immutable rules). Every task gets an atomic git commit.

---

## Quick Start

The fastest way to experience BuildPact is the `quick` command. It goes from description to committed code in one shot:

```bash
# Install globally
npm install -g buildpact

# Initialize in your project
cd my-project
buildpact init

# Make a change with zero ceremony
buildpact quick "add a health check endpoint that returns { status: ok }"
```

That's it. BuildPact will generate a minimal spec, implement the change, and commit it.

For larger work, use the full pipeline:

```bash
# 1. Describe what you want
buildpact specify "user authentication with email and password"

# 2. Generate an implementation plan
buildpact plan

# 3. Execute the plan
buildpact execute

# 4. Verify the results
buildpact verify
```

---

## Installation

### Requirements

- **Node.js** 20 or later (22+ recommended)
- **Git** installed and available in your PATH
- An AI coding tool: Claude Code, Cursor, Gemini CLI, or Codex

### Install BuildPact

```bash
npm install -g buildpact
```

### New Project (Greenfield)

Use `buildpact init` when starting a brand new project:

```bash
# Option A: initialize in the current directory
cd my-new-project
buildpact init

# Option B: create a new directory
buildpact init my-new-project
```

The interactive wizard will guide you through 6 steps:

| Step | What it asks | What it does |
|------|-------------|-------------|
| 1. Language | English or Portugues (Brasil) | Sets all CLI messages to your language |
| 2. Location | Here or new folder | Decides where `.buildpact/` is created |
| 3. Domain | Software, Marketing, Health, Research, Management, Custom | Configures domain-specific rules and squad suggestions |
| 4. IDE | Claude Code, Cursor, Gemini, Codex (multi-select) | Installs slash commands and config files for each IDE |
| 5. Experience | Beginner, Intermediate, Expert | Controls how much guidance the CLI gives you |
| 6. Squad | Install the Software Squad? | Adds a multi-agent team with specialized roles |

After init completes, your project will have:

```
my-project/
  .buildpact/
    config.yaml          # Your settings
    constitution.md      # Project rules (edit these!)
    project-context.md   # Context for AI agents
    profiles/            # Model quality/cost profiles
    squads/software/     # Your agent team (if installed)
    audit/               # Action logs
  .claude/commands/bp/   # Slash commands (if Claude Code selected)
  CLAUDE.md              # Claude Code project file
  DECISIONS.md           # Decision log
  STATUS.md              # Living status doc
```

**Next step:** Run `buildpact specify` to create your first spec.

### Existing Project (Brownfield)

Use `buildpact adopt` when you already have a project with code, linters, CI, etc.:

```bash
cd my-existing-project
buildpact adopt
```

The adopt command **scans your project first** and pre-fills configuration based on what it finds:

| What it detects | How it uses it |
|----------------|---------------|
| `package.json`, `Cargo.toml`, `go.mod`, etc. | Identifies your package manager and language |
| `tsconfig.json` | Adds "TypeScript strict mode" to constitution |
| `.eslintrc`, `biome.json`, `.prettierrc` | Adds linter rules to constitution |
| `.github/workflows/` | Adds CI quality gates to constitution |
| Git history | Shows commit count, contributors |
| Existing `.claude/`, `.cursor/`, `.gemini/` | Skips IDE configs that already exist |
| Existing `.buildpact/` | Asks: merge, overwrite, or cancel |

**Example output:**

```
  BuildPact — Adopt Existing Project

  Scanning project structure...
  Scan complete

  ── Detected Stack ──────────────────────────────
  TypeScript + Node.js, npm, eslint, prettier,
  github-actions, 847 commits, 3 contributor(s)
  ────────────────────────────────────────────────

  Apply changes to this project? Yes

  Project adopted successfully
  12 file(s) created
  Run 'buildpact doctor' to verify your setup.
```

The generated `constitution.md` will already contain rules extracted from your linters and CI — review and adjust them.

**Next step:** Run `buildpact doctor` to verify everything is set up correctly.

---

## The Pipeline

BuildPact organizes work into a 4-phase pipeline. Each phase produces artifacts that feed the next:

```
  specify          plan            execute          verify
 ─────────>    ─────────>      ─────────>      ─────────>
   "what"        "how"         "do it"         "check it"

  spec.md     plan-wave-N.md   git commits    verification
  + ACs       + research       + audit log     report
              + validation
```

### Phase 1: Specify

```bash
buildpact specify "add dark mode toggle to the settings page"
```

The specify command transforms your natural language into a structured specification:

- **User Story** — "As a [persona], I want [goal], so that [motivation]"
- **Acceptance Criteria** — Numbered, testable conditions (AC-1, AC-2, ...)
- **Functional Requirements** — What the system must do (FR-101, FR-102, ...)
- **Non-Functional Requirements** — Performance, security, accessibility
- **Assumptions** — What we're assuming to be true
- **Constitution Self-Assessment** — How this spec relates to project rules

**Beginner mode** asks you 5 simple questions:
1. Who is this for? (persona)
2. What do they want to do? (goal)
3. Why? (motivation)
4. How will you know it's done? (success criteria)
5. Any constraints? (limits)

**Expert mode** accepts a single description and generates everything.

**Ambiguity detection** catches vague words like "fast", "scalable", "easy" and asks you to define them concretely.

Output: `.buildpact/specs/{slug}/spec.md`

### Phase 2: Plan

```bash
buildpact plan
```

The plan command generates an implementation plan with:

- **Parallel research** — Multiple research agents analyze your tech stack, codebase, and domain constraints simultaneously
- **Wave-based tasks** — Tasks are sorted into waves. Tasks in the same wave can run in parallel; waves run sequentially
- **Human step detection** — Design reviews, manual approvals, and decisions are tagged as human steps
- **Nyquist validation** — Multi-perspective validation checks for missing ACs, circular dependencies, and scope creep

If the plan has critical issues, BuildPact auto-revises it (up to 3 attempts).

**Resumable sessions** — If you interrupt planning, BuildPact saves progress and offers to resume next time.

Output: `.buildpact/plans/{slug}/plan.md` + wave files + research summary

### Phase 3: Execute

```bash
buildpact execute
```

The execute command implements the plan:

- Each task runs in an **isolated subagent context** (only the task payload, no orchestrator state)
- Each completed task gets an **atomic git commit** (`feat(execute): description`)
- **Budget guards** check spend limits before each wave
- **Goal-backward verification** checks each wave's output against the original spec
- If an AC fails, a **fix plan** is auto-generated

Output: Git commits + verification reports per wave

### Phase 4: Verify

```bash
buildpact verify
```

The verify command walks you through User Acceptance Testing:

```
  AC-1: Dark mode toggle visible in settings page
  Verdict: (Pass / Fail / Skip) > Pass

  AC-2: Toggle persists preference across sessions
  Verdict: (Pass / Fail / Skip) > Fail
  What went wrong? > Preference resets after browser refresh

  Result: 1 passed, 1 failed, 0 skipped
  Fix plan generated: .buildpact/specs/dark-mode/fix/plan-uat.md
```

Failed ACs automatically generate a fix plan you can feed back into `buildpact execute`.

---

## Commands Reference

### Core Pipeline

| Command | Description |
|---------|------------|
| `buildpact specify [description]` | Capture a requirement as a structured spec |
| `buildpact plan [spec-path]` | Generate a wave-based implementation plan |
| `buildpact execute [plan-dir]` | Execute the plan with subagent isolation |
| `buildpact verify [spec-path]` | Guided acceptance testing |
| `buildpact quick [description]` | All-in-one: description to committed code |

### Quick Flow Variants

| Flag | Behavior |
|------|---------|
| `buildpact quick "..."` | Zero ceremony — straight to code and commit |
| `buildpact quick "..." --discuss` | 3-5 clarifying questions first |
| `buildpact quick "..." --full` | Full pipeline: spec + plan + validation + execute + verify |

### Setup & Maintenance

| Command | Description |
|---------|------------|
| `buildpact init [name]` | Initialize a new project |
| `buildpact adopt` | Onboard an existing project |
| `buildpact doctor` | Health check — verify Node.js, Git, configs, squads |
| `buildpact upgrade [--dry-run]` | Migrate project to current CLI schema version |
| `buildpact constitution` | Create or edit project rules |

### Squads & Agents

| Command | Description |
|---------|------------|
| `buildpact squad create <name>` | Scaffold a new squad |
| `buildpact squad validate [dir]` | Validate squad structure and security |
| `buildpact squad add <name>` | Install a squad from the community hub |

### Advanced

| Command | Description |
|---------|------------|
| `buildpact memory` | Manage agent memory layers |
| `buildpact optimize` | Continuous improvement with git ratchet |
| `buildpact export-web` | Export as web bundle for Claude.ai / ChatGPT / Gemini |
| `buildpact migrate-to-agent` | Prepare project for Agent Mode (v2.0) |

### Slash Commands (IDE Integration)

When you select Claude Code during init, BuildPact installs slash commands in `.claude/commands/bp/`. Use them directly in your IDE:

| Slash Command | Maps to |
|--------------|---------|
| `/bp:specify` | `buildpact specify` |
| `/bp:plan` | `buildpact plan` |
| `/bp:execute` | `buildpact execute` |
| `/bp:verify` | `buildpact verify` |
| `/bp:quick` | `buildpact quick` |
| `/bp:constitution` | `buildpact constitution` |
| `/bp:squad` | `buildpact squad` |
| `/bp:doctor` | `buildpact doctor` |
| `/bp:orchestrate` | Meet Pacto, your project orchestrator |
| `/bp:help` | See project status and recommended next step |
| `/bp:quality` | ISO 9001-inspired quality report |
| `/bp:docs` | Organize and index project documentation |
| `/bp:investigate` | Research domain, codebase, or technology |
| `/bp:optimize` | `buildpact optimize` |
| `/bp:export-web` | `buildpact export-web` |

---

## Squads (Multi-Agent Teams)

A **Squad** is a team of AI agents with specialized roles, domain knowledge, and coordination rules. Each agent has:

- **Role** — What it does (e.g., "Product Manager", "Architect")
- **Expertise** — What it knows deeply
- **Voice DNA** — How it communicates (tone, vocabulary, anti-patterns)
- **Guardrails** — What it must never do
- **Heuristics** — Decision rules (IF/THEN) and VETO conditions
- **Examples** — Concrete input/output pairs for calibration

### Bundled Squads

| Squad | Domain | Agents |
|-------|--------|--------|
| **Software** | Full-stack development | PM, Architect, Developer, QA, Tech Writer |
| **Medical Marketing** | CFM-compliant health marketing | Strategist, Copywriter, Designer, Analytics |
| **Scientific Research** | Academic research methodology | Methodologist, Analyst, Reviewer |
| **Clinic Management** | Healthcare operations | Operations Manager, Scheduler, Compliance |
| **Agent Builder** | Meta-squad for creating squads | Architect, Tester, Documenter |

### Using a Squad

Squads are activated during `init` or `adopt`. The active squad's domain constraints are injected into every pipeline phase:

```yaml
# .buildpact/config.yaml
active_squad: "software"
```

To switch squads:

```bash
# Install a different squad
buildpact squad add scientific-research

# Then edit config.yaml to set active_squad
```

### Creating Your Own Squad

```bash
buildpact squad create my-custom-squad
```

This scaffolds the directory structure. Then fill in:

1. `squad.yaml` — Name, version, domain, agents list
2. `agents/chief.md` — The lead agent (routes tasks to specialists)
3. `agents/*.md` — One file per specialist agent

Validate your squad:

```bash
buildpact squad validate .buildpact/squads/my-custom-squad
```

### Autonomy Levels

Each agent operates at an autonomy level that controls how much human oversight is required:

| Level | Name | Behavior |
|-------|------|---------|
| **L1** | Supervised | Agent proposes; human approves every action |
| **L2** | Guided | Agent acts within guardrails; human approves risky actions |
| **L3** | Autonomous | Agent acts freely; human reviews results |
| **L4** | Full Auto | Agent acts and commits without human intervention |

The default level for new squads is **L2** (Guided).

---

## Model Profiles

BuildPact supports three model profiles that balance quality and cost:

| Profile | Best for | Research | Planning | Execution | Verification |
|---------|---------|----------|----------|-----------|-------------|
| **balanced** (default) | Most projects | Sonnet | Sonnet | Sonnet | Sonnet |
| **quality** | Critical work | Opus | Sonnet | Opus | Sonnet |
| **budget** | Prototyping | Haiku | Haiku | Haiku | Haiku |

Each profile includes a **failover chain** — if the primary model is unavailable, BuildPact automatically tries the next model in the chain.

### Switching Profiles

Edit `.buildpact/config.yaml`:

```yaml
active_model_profile: "quality"
```

Or customize per-phase by editing `.buildpact/profiles/balanced.yaml`.

### Budget Guards

Set spending limits in `.buildpact/config.yaml`:

```yaml
budget:
  per_session_usd: 5.00
  per_phase_usd: 2.00
  per_day_usd: 20.00
  warning_threshold: 0.8
```

BuildPact checks these limits before each wave execution and blocks if exceeded.

### Performance Mode

Choose your execution style during setup:

| Mode | Description | Best For |
|------|-------------|----------|
| Quality First | Best models for all phases | Production features, compliance work |
| Balanced | Smart model mix | Day-to-day development |
| Speed First | Fastest models | Iteration, prototyping, quick fixes |

---

## Constitution (Project Rules)

The constitution is a set of immutable rules that every AI output is checked against. Think of it as a project-wide linter for AI behavior.

### Creating a Constitution

```bash
buildpact constitution
```

The interactive editor walks you through 5 sections:

| Section | Examples |
|---------|---------|
| **Coding Standards** | "TypeScript strict mode", "No console.log in production" |
| **Compliance** | "HIPAA required", "LGPD data handling", "CFM advertising rules" |
| **Architectural Constraints** | "No circular dependencies", "Node.js >= 22" |
| **Quality Gates** | "All tests must pass", "Code review required" |
| **Domain Rules** | "Medical disclaimers on all patient-facing content" |

### How Enforcement Works

Every time BuildPact generates output (specs, plans, code), it runs a constitution check:

1. Parse all principles from `constitution.md`
2. Scan the output for violations
3. If violations found: show warning and ask for explicit user approval
4. Log the decision to the audit trail

Constitution modification is **never automated** — even L4 (fully autonomous) agents must get human approval to change project rules.

### Version Tracking

When you edit the constitution, BuildPact:
1. Diffs the old and new versions
2. Generates an update checklist at `.buildpact/constitution_update_checklist.md`
3. Lists which existing specs and plans reference changed rules
4. Records the change reason in the version history table

---

## Project Structure

```
my-project/
+-- .buildpact/                    # BuildPact workspace
|   +-- config.yaml                # Project settings
|   +-- constitution.md            # Immutable project rules
|   +-- project-context.md         # Context document for AI agents
|   +-- audit/                     # JSONL action logs
|   +-- profiles/                  # Model quality/cost profiles
|   |   +-- balanced.yaml
|   |   +-- quality.yaml
|   |   +-- budget.yaml
|   +-- specs/                     # Generated specifications
|   |   +-- {slug}/
|   |       +-- spec.md
|   +-- plans/                     # Generated plans
|   |   +-- {slug}/
|   |       +-- plan.md
|   |       +-- plan-wave-1.md
|   |       +-- progress.json
|   +-- squads/                    # Installed agent teams
|   |   +-- software/
|   |       +-- squad.yaml
|   |       +-- agents/
|   +-- memory/                    # Agent memory layers
+-- .claude/commands/bp/           # IDE slash commands
+-- CLAUDE.md                      # Claude Code project file
+-- DECISIONS.md                   # Decision log
+-- STATUS.md                      # Living status document
```

### What to Commit to Git

**Always commit:**
- `.buildpact/config.yaml`
- `.buildpact/constitution.md`
- `.buildpact/project-context.md`
- `.buildpact/profiles/`
- `.buildpact/squads/`
- `.claude/commands/bp/`
- `CLAUDE.md`, `DECISIONS.md`, `STATUS.md`

**Optional (depends on team preference):**
- `.buildpact/specs/` — useful for traceability
- `.buildpact/plans/` — useful for auditing

**Do not commit:**
- `.buildpact/audit/` — local action logs, can be large
- `.buildpact/memory/` — local agent memory

Add to your `.gitignore`:

```gitignore
.buildpact/audit/
.buildpact/memory/
```

---

## Upgrading

When you update BuildPact to a newer version:

```bash
npm update -g buildpact
```

If the new version changes the project structure, BuildPact will tell you:

```
  Project schema v0 can be upgraded to v1. Run 'buildpact upgrade'.
```

### Running Upgrades

```bash
# Preview what will change
buildpact upgrade --dry-run

# Apply migrations
buildpact upgrade
```

Migrations run sequentially (v0 -> v1 -> v2) and are logged to the audit trail.

### Version Compatibility

| Situation | What happens |
|-----------|-------------|
| CLI and project are compatible | Normal operation, no warnings |
| CLI is newer than project | Warning: "Run `buildpact upgrade`" |
| CLI is older than project | Error: "Update BuildPact: `npm update -g buildpact`" |
| Legacy project (no schema) | Warning: "Run `buildpact upgrade` to add version tracking" |

---

## FAQ

### How is BuildPact different from just using Claude Code / Cursor directly?

BuildPact adds **structure** on top of your AI tool. Instead of ad-hoc prompts, you get a repeatable pipeline with specifications, plans, and verification. The AI still does the work — BuildPact makes sure it does the *right* work and that you can prove it.

### Do I need to use all 4 phases?

No. Use what makes sense:
- **Quick changes**: `buildpact quick "fix the login bug"` (one command)
- **Medium features**: `buildpact specify` + `buildpact plan` + `buildpact execute`
- **Critical work**: Full pipeline including `buildpact verify`

### Can I use BuildPact for non-software projects?

Yes. BuildPact supports marketing, health, research, and management domains. The pipeline is the same — specify what you want, plan how to do it, execute, verify — but the squads, rules, and vocabulary adapt to your domain.

### What if I disagree with the generated spec or plan?

Edit it. BuildPact generates markdown files that you can modify before proceeding to the next phase. The plan won't execute until you say so.

### How does bilingual support work?

You choose your language during `init` or `adopt`. All CLI prompts, error messages, and generated content respect your choice. You can switch by editing `language` in `.buildpact/config.yaml`.

### Does BuildPact send data to external servers?

No. BuildPact is a local CLI tool. It generates files on your machine and delegates to whatever AI tool you're already using (Claude Code, Cursor, etc.). BuildPact itself makes no network requests in the current alpha.

### What's the difference between `init` and `adopt`?

- **`init`** = new project from scratch, generic templates
- **`adopt`** = existing project, scans your stack and pre-fills configuration from what it finds (linters, CI, language, etc.)

---

## Contributing

BuildPact is open source under the MIT license.

```bash
# Clone the repository
git clone https://github.com/leoeloys/buildpact.git
cd buildpact

# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run lint

# Build
npm run build

# Run locally
node dist/index.mjs init
```

### Project Architecture

```
src/
+-- cli/          # Entry point (zero business logic)
+-- contracts/    # Type definitions and error codes
+-- foundation/   # Core utilities (i18n, audit, profiles, scanner, migrator)
+-- engine/       # Pipeline engine (orchestrator, wave executor, budget guard)
+-- commands/     # Command handlers (one directory per command)
+-- squads/       # Squad loader and validator
```

**Key rules:**
- Business logic never throws — returns `Result<T, CliError>`
- Layered dependencies: contracts <- foundation <- engine <- commands <- cli
- All fallible functions return `Result` type
- Orchestrators stay under 300 lines
- Subagents receive only their task payload (no shared state)

---

## License

MIT
