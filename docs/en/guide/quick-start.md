# Quick Start

Get from zero to your first BuildPact task in under 5 minutes.

## Prerequisites

- **Node.js** 20 or later (22+ recommended)
- **Git** installed and available in your PATH
- An AI coding tool: Claude Code, Cursor, Gemini CLI, or Codex

## Install BuildPact

```bash
npm install -g buildpact
```

## Initialize Your Project

```bash
cd my-project
buildpact init
```

The interactive wizard guides you through language, domain, IDE, and squad selection. After init completes, your project has a `.buildpact/` directory with configuration, constitution, and an installed squad.

## Run Your First Task

The fastest way to experience BuildPact is the `quick` command:

```bash
buildpact quick "add a health check endpoint that returns { status: ok }"
```

BuildPact generates a minimal spec, implements the change, and commits it — all in one shot.

## Use the Full Pipeline

For larger work, use the 4-phase pipeline:

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

Each phase produces auditable artifacts. Every AI output is checked against your project's constitution. Every task gets an atomic git commit.

## What's Next?

- [Installation details](/en/guide/installation) — greenfield and brownfield setup
- [The Pipeline](/en/guide/pipeline) — understand each phase in depth
- [CLI Reference](/en/cli/) — all available commands
- [Architecture](/en/architecture/overview) — how BuildPact is structured
