# BuildPact

**Open-source Spec-Driven Development framework — bilingual CLI for developers and domain experts.**

BuildPact helps teams write clear specifications before coding, enforce project constitutions, run AI squads, and continuously optimize their workflow.

## Install

```bash
npm install -g buildpact@alpha
```

> Requires Node.js 20+

## Quick Start

```bash
# Initialize BuildPact in your project
buildpact init

# Capture a requirement as a spec
buildpact specify

# Plan implementation from a spec
buildpact plan

# Execute the plan
buildpact execute

# Verify the result
buildpact verify
```

## Commands

| Command | Description |
|---|---|
| `init` | Initialize BuildPact in your project |
| `specify` | Capture a requirement as a structured spec |
| `plan` | Generate an implementation plan from a spec |
| `execute` | Execute a plan with an AI agent |
| `verify` | Verify implementation against spec ACs |
| `quick` | Zero-ceremony commit with auto spec |
| `constitution` | Manage your project's guiding principles |
| `squad` | Run a multi-agent squad |
| `optimize` | Continuous improvement loop with ratchet commits |
| `doctor` | Diagnose your BuildPact setup |
| `memory` | Manage agent memory |
| `export-web` | Export specs/plans as web pages |
| `migrate-to-agent` | Migrate existing project to agent-driven workflow |

## Bilingual

BuildPact supports **English** and **Português (Brasil)** — switch at any time via `buildpact init`.

## License

MIT
