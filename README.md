# BuildPact

**Stop prompting. Start building with a contract.**

BuildPact is a spec-driven development framework that brings structure to AI-assisted workflows. Describe what you want in plain language — BuildPact turns it into structured specs, actionable plans, and verified code.

Works with **Claude Code**, **Cursor**, **Gemini CLI**, and **Codex**. Supports **English** and **Portugues (Brasil)**.

```bash
npm install -g buildpact
cd my-project
buildpact init
```

---

## Why BuildPact?

Most AI workflows are "prompt and pray" — you describe something, the AI writes code, and you hope it works.

BuildPact replaces hope with a contract:

| Phase | What happens | Output |
|-------|-------------|--------|
| **Specify** | Your description becomes a structured spec with acceptance criteria | `spec.md` |
| **Plan** | Parallel research + wave-based task breakdown | `plan.md` + waves |
| **Execute** | Isolated agents implement each task with atomic commits | Git commits |
| **Verify** | Walk through each acceptance criterion | Verification report |

Every step is auditable. Every AI output is checked against your project's **constitution** — immutable rules you define. Every task gets its own git commit.

---

## Quick Start

```bash
# One-shot: description to committed code
buildpact quick "add a health check endpoint that returns { status: ok }"

# Full pipeline for larger work
buildpact specify "user authentication with email and password"
buildpact plan
buildpact execute
buildpact verify
```

The `quick` command is the fastest path — zero ceremony, straight to code. For critical features, use the full pipeline.

---

## Meet Your Squad

BuildPact ships with a team of specialized AI agents. Each has a distinct role, personality, expertise, and guardrails.

| Agent | Role | Specialty |
|-------|------|-----------|
| **Pacto** | Orchestrator | Routes work, manages handoffs between agents |
| **Sofia** | Product Manager | Captures requirements, writes specs, detects ambiguity |
| **Renzo** | Architect | Designs systems, creates ADRs, reviews plans |
| **Coda** | Developer | Implements code, writes tests, follows constitution |
| **Crivo** | QA Engineer | Adversarial audits, acceptance testing, quality reports |
| **Lira** | Tech Writer | Documentation, indexing, knowledge organization |

Start with `/bp:orchestrate` in your IDE — Pacto assesses your project and routes you to the right specialist.

### Available Squads

| Squad | Domain | Use case |
|-------|--------|----------|
| **Software** | Full-stack development | Web apps, APIs, CLIs, libraries |
| **Medical Marketing** | CFM-compliant health marketing | Clinics, specialists, healthcare |
| **Scientific Research** | Academic methodology | Papers, studies, data analysis |
| **Clinic Management** | Healthcare operations | Scheduling, compliance, workflows |
| **Agent Builder** | Meta-squad | Creating new squads |

---

## Installation

### Requirements

- **Node.js** 20+ (22+ recommended)
- **Git** in your PATH
- An AI coding tool (Claude Code, Cursor, Gemini CLI, or Codex)

### New Project

```bash
buildpact init
```

The wizard walks you through language, domain, IDE, experience level, and squad selection. When it's done:

```
my-project/
  .buildpact/
    config.yaml            # Settings
    constitution.md        # Your project rules
    project-context.md     # Context for AI agents
    profiles/              # Model cost/quality profiles
    squads/software/       # Your agent team
  .claude/commands/bp/     # Slash commands (if Claude Code)
```

### Existing Project

```bash
buildpact adopt
```

Scans your codebase and pre-fills configuration from what it finds — linters, CI pipelines, language, package manager, git history. The generated constitution already contains rules from your existing tooling.

### Verify Setup

```bash
buildpact doctor
```

---

## Commands

### Core Pipeline

| Command | What it does |
|---------|-------------|
| `buildpact specify [description]` | Natural language to structured spec |
| `buildpact plan` | Generate wave-based implementation plan |
| `buildpact execute` | Run the plan with isolated subagents |
| `buildpact verify` | Guided acceptance testing |
| `buildpact quick [description]` | All-in-one: describe, build, commit |

### Quick Variants

```bash
buildpact quick "fix the login bug"           # Zero ceremony
buildpact quick "add OAuth" --discuss          # Clarifying questions first
buildpact quick "add OAuth" --full             # Full pipeline with verification
```

### Project Management

| Command | What it does |
|---------|-------------|
| `buildpact init [name]` | New project setup |
| `buildpact adopt` | Onboard existing project |
| `buildpact doctor` | Health check |
| `buildpact upgrade` | Migrate to latest schema |
| `buildpact constitution` | Edit project rules |
| `buildpact status` | Project overview |
| `buildpact diagnose` | Deep project diagnostic |

### Agents & Squads

| Command | What it does |
|---------|-------------|
| `buildpact squad create <name>` | Scaffold a custom squad |
| `buildpact squad validate [dir]` | Validate squad structure |
| `buildpact squad add <name>` | Install from community hub |
| `buildpact hub search [query]` | Browse community squads |
| `buildpact hub info <name>` | Squad details and quality score |
| `buildpact agent start\|stop\|status` | Persistent agent supervisor |

### Quality & Docs

| Command | What it does |
|---------|-------------|
| `buildpact quality` | ISO 9001-inspired quality report |
| `buildpact docs` | Organize and index documentation |
| `buildpact investigate` | Research domain, codebase, or tech |
| `buildpact audit` | View action logs |
| `buildpact diff` | Compare spec versions |

### Advanced

| Command | What it does |
|---------|-------------|
| `buildpact memory` | Manage agent memory layers |
| `buildpact optimize` | Continuous improvement with git ratchet |
| `buildpact export-web` | Bundle for Claude.ai / ChatGPT / Gemini |
| `buildpact migrate-to-agent` | Prepare for persistent Agent Mode |
| `buildpact learn` | Open getting-started tutorial |

### IDE Slash Commands

When using Claude Code, slash commands are installed at `.claude/commands/bp/`:

```
/bp:orchestrate   /bp:specify   /bp:plan      /bp:execute
/bp:verify        /bp:quick     /bp:quality   /bp:doctor
/bp:docs          /bp:help      /bp:investigate
/bp:optimize      /bp:export-web
```

---

## Constitution

The constitution is your project's rulebook. Every AI output is validated against it.

```bash
buildpact constitution
```

Define rules across five areas:

| Area | Examples |
|------|---------|
| **Coding Standards** | TypeScript strict mode, no `console.log` in production |
| **Compliance** | HIPAA, LGPD, CFM advertising rules |
| **Architecture** | No circular dependencies, minimum Node 22 |
| **Quality Gates** | All tests must pass, code review required |
| **Domain Rules** | Medical disclaimers on patient-facing content |

Constitution changes are **never automated** — even fully autonomous agents need your approval to modify rules. Every change is versioned and logged.

---

## Model Profiles

Three profiles balance quality and cost:

| Profile | Use case | Models |
|---------|---------|--------|
| **balanced** | Day-to-day work | Sonnet across all phases |
| **quality** | Critical features | Opus for research + execution |
| **budget** | Prototyping | Haiku across all phases |

Each profile includes failover chains. Set yours in `.buildpact/config.yaml`:

```yaml
active_model_profile: "balanced"
```

### Budget Guards

```yaml
budget:
  per_session_usd: 5.00
  per_phase_usd: 2.00
  per_day_usd: 20.00
  warning_threshold: 0.8
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

---

## CI Integration

BuildPact includes a GitHub Action for running commands in CI:

```yaml
# .github/workflows/buildpact.yml
- uses: leoeloys/buildpact@v2
  with:
    command: verify
    budget: "1.00"
    ci-mode: true
```

Supports `--ci` flag and `BP_CI=true` for headless execution. Webhook notifications available for Slack, Discord, and custom endpoints.

---

## Project Structure

```
.buildpact/
  config.yaml              # Settings
  constitution.md          # Project rules
  project-context.md       # AI context
  audit/                   # Action logs (local)
  profiles/                # Model profiles
  specs/{slug}/spec.md     # Specifications
  plans/{slug}/plan.md     # Plans + waves
  squads/software/         # Agent teams
  memory/                  # Agent memory (local)
```

**Commit to git:** `config.yaml`, `constitution.md`, `project-context.md`, `profiles/`, `squads/`, specs, plans.

**Keep local:** `audit/`, `memory/`.

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
`init` = new project, blank slate. `adopt` = existing project, scans your stack and pre-fills configuration.

---

## Contributing

```bash
git clone https://github.com/leoeloys/buildpact.git
cd buildpact
npm install
npm test
npm run build
```

Architecture:

```
src/
  cli/          # Entry point
  contracts/    # Types and error codes
  foundation/   # i18n, audit, profiles, scanner, migrator
  engine/       # Pipeline, orchestrator, wave executor, budget guard
  commands/     # One directory per command
  squads/       # Squad loader and validator
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT
