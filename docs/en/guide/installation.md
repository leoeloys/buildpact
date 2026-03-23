# Installation

## Requirements

- **Node.js** 20 or later (22+ recommended)
- **Git** installed and available in your PATH
- An AI coding tool: Claude Code, Cursor, Gemini CLI, or Codex

## Install BuildPact

```bash
npm install -g buildpact
```

## New Project (Greenfield)

Use `buildpact init` when starting from scratch:

```bash
# Initialize in the current directory
cd my-new-project
buildpact init

# Or create a new directory
buildpact init my-new-project
```

The interactive wizard walks you through 6 steps:

| Step | What it asks | What it does |
|------|-------------|-------------|
| 1. Language | English or Português (Brasil) | Sets all CLI messages to your language |
| 2. Location | Here or new folder | Decides where `.buildpact/` is created |
| 3. Domain | Software, Marketing, Health, Research, Management, Custom | Configures domain-specific rules |
| 4. IDE | Claude Code, Cursor, Gemini, Codex (multi-select) | Installs slash commands and config files |
| 5. Experience | Beginner, Intermediate, Expert | Controls how much guidance the CLI gives |
| 6. Squad | Install the Software Squad? | Adds a multi-agent team |

After init completes:

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
```

**Next step:** Run `buildpact specify` to create your first spec.

## Existing Project (Brownfield)

Use `buildpact adopt` when you already have a project:

```bash
cd my-existing-project
buildpact adopt
```

The adopt command **scans your project first** and pre-fills configuration:

| What it detects | How it uses it |
|----------------|---------------|
| `package.json`, `Cargo.toml`, `go.mod` | Identifies your language and package manager |
| `tsconfig.json` | Adds "TypeScript strict mode" to constitution |
| `.eslintrc`, `biome.json`, `.prettierrc` | Adds linter rules to constitution |
| `.github/workflows/` | Adds CI quality gates to constitution |
| Git history | Shows commit count, contributors |

The generated `constitution.md` already contains rules extracted from your linters and CI — review and adjust them.

**Next step:** Run `buildpact doctor` to verify setup.

## What to Commit to Git

**Always commit:**
- `.buildpact/config.yaml`, `constitution.md`, `project-context.md`
- `.buildpact/profiles/`, `.buildpact/squads/`
- `.claude/commands/bp/`

**Do not commit:**
- `.buildpact/audit/` — local action logs
- `.buildpact/memory/` — local agent memory
