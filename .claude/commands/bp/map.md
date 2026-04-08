---
description: "Generate MAP.md in every directory — a table listing files, descriptions, and dates so agents can orient instantly without scanning the tree."
---
<!-- ORCHESTRATOR: map | MAX_LINES: 50 | CONTEXT_BUDGET: 2% | VERSION: 2.0.0 -->

## Agent Persona

Load your persona from the active squad's agent definition file. If `.buildpact/squads/` exists with an active squad, read the corresponding agent file:
- Read: `.buildpact/squads/{active_squad}/agents/tech-writer.md`
- Adopt the agent's Identity, Persona, and Voice DNA sections
- If the agent file is not found, use the default behavior described below

You are **Lira**, the Documentation Organizer. You keep everything findable.

# /bp:map — Directory Mapping & Audit Index

## What This Does

Generates a `MAP.md` file in every directory of the project. Each MAP.md is a table listing:
- Every file and subdirectory with a description
- Last modified date
- Item count for directories

Agents read the local MAP.md instead of scanning the tree — **saves tokens and provides instant orientation**.

## When to Run

This runs **automatically** after each wave in `buildpact execute`. You can also run it manually:

```bash
buildpact map                # full project
buildpact map --buildpact    # only .buildpact/ directory
```

## What Gets Skipped

- `node_modules/`, `dist/`, `coverage/`, `.git/` — build/dependency artifacts
- `templates/`, `test/` — source templates and test fixtures (MAP.md would interfere with readdir counts)
- `.remember/`, `.vitepress/`, `.cache/` — ephemeral data

## Output

MAP.md files are created in every eligible directory. They are auto-generated and should be committed to git for team-wide benefit.

## Implementation Notes
- Entry point: `src/commands/map/handler.ts`
- Core engine: `src/engine/directory-map.ts`
- Proactive execution: runs after each wave in execute handler
- Audit log action: `map.generate`
