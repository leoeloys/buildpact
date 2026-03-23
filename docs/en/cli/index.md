# CLI Reference

All BuildPact commands available via `buildpact <command>`.

## Core Pipeline

| Command | Description |
|---------|------------|
| [`quick`](/en/cli/quick) | All-in-one: description to committed code |
| [`specify`](/en/cli/specify) | Capture a requirement as a structured spec |
| [`plan`](/en/cli/plan) | Generate a wave-based implementation plan |
| [`execute`](/en/cli/execute) | Execute the plan with subagent isolation |
| [`verify`](/en/cli/verify) | Guided acceptance testing |
| [`orchestrate`](/en/cli/orchestrate) | Meet Pacto, your project orchestrator |

## Setup & Maintenance

| Command | Description |
|---------|------------|
| [`init`](/en/cli/init) | Initialize a new project |
| [`adopt`](/en/cli/adopt) | Onboard an existing project |
| [`doctor`](/en/cli/doctor) | Health check — verify Node.js, Git, configs, squads |
| [`upgrade`](/en/cli/upgrade) | Migrate project to current CLI schema version |
| [`constitution`](/en/cli/constitution) | Create or edit project rules |

## Squads & Agents

| Command | Description |
|---------|------------|
| [`squad`](/en/cli/squad) | Create, validate, and install squads |

## Advanced

| Command | Description |
|---------|------------|
| [`memory`](/en/cli/memory) | Manage agent memory layers |
| [`status`](/en/cli/status) | Pipeline dashboard and project status |
| [`export-web`](/en/cli/export-web) | Export as web bundle for Claude.ai / ChatGPT / Gemini |
| [`optimize`](/en/cli/optimize) | Continuous improvement with git ratchet |
| [`quality`](/en/cli/quality) | ISO 9001-inspired quality report |
| [`docs`](/en/cli/docs) | Organize and index project documentation |
| [`investigate`](/en/cli/investigate) | Research domain, codebase, or technology |
| [`audit`](/en/cli/audit) | Export and inspect audit trails |
| [`diff`](/en/cli/diff) | Track changes between pipeline runs |
| [`completion`](/en/cli/completion) | Shell completion for bash/zsh/fish |
| [`help`](/en/cli/help) | Show available commands and project status |

## Slash Commands (IDE Integration)

When you select Claude Code during init, BuildPact installs slash commands in `.claude/commands/bp/`:

| Slash Command | Maps to |
|--------------|---------|
| `/bp:quick` | `buildpact quick` |
| `/bp:specify` | `buildpact specify` |
| `/bp:plan` | `buildpact plan` |
| `/bp:execute` | `buildpact execute` |
| `/bp:verify` | `buildpact verify` |
| `/bp:orchestrate` | Project orchestrator |
| `/bp:doctor` | `buildpact doctor` |
| `/bp:help` | Project status and next steps |
