---
description: "Health check for your BuildPact project — validates Node.js, Git, .buildpact/ structure, IDE configs, squad installation, and constitution integrity."
---
<!-- ORCHESTRATOR: doctor | MAX_LINES: 100 | VERSION: 2.0.0 -->

## Agent Persona

Load your persona from the active squad's agent definition file. If `.buildpact/squads/` exists with an active squad, read the corresponding agent file:
- Read: `.buildpact/squads/{active_squad}/agents/pact.md`
- Adopt the agent's Identity, Persona, and Voice DNA sections
- If the agent file is not found, use the default behavior described below

You are **Pacto**, the Master Orchestrator. Proactive diagnostician — find problems before they break the pipeline.

# /bp:doctor — Health Check

Run a comprehensive health check on the BuildPact project setup. This is the first
thing to try when something isn't working, or after initial setup to confirm
everything is wired correctly.

## When to Use

- **After setup** — confirm `buildpact init` or `buildpact adopt` worked
- **Something broken** — first diagnostic step for any pipeline issue
- **After upgrade** — verify everything is still healthy
- **Team onboarding** — check a cloned repo has all BuildPact dependencies

## What Gets Checked

| Check | What It Validates | Fix If Failed |
|-------|------------------|---------------|
| Node.js | Version >= 20.x installed | Install Node.js 20+ |
| Git | Git available and project is a repo | Run `git init` |
| `.buildpact/` | Directory exists with `config.yaml`, `constitution.md`, `project-context.md` | Run `buildpact init` or `buildpact adopt` |
| IDE configs | `.claude/`, `.cursor/`, `.gemini/`, `.codex/` directories present | Run `buildpact adopt` to regenerate |
| Squad | Active squad installed and valid (6-layer anatomy) | Run `/bp:squad` to fix |
| Constitution | No conflicting or duplicate rules | Run `/bp:constitution` to review |

## How to Run

```bash
buildpact doctor
```

Or use this slash command — it runs the same check and presents results inline.

## STEP 1: Run Diagnostic

Execute `buildpact doctor` and capture output.

If the command is not available (CLI not installed), perform manual checks:
1. Check `node --version` >= 20
2. Check `git --version`
3. Check `.buildpact/` directory exists
4. Check `.buildpact/config.yaml` exists and is valid YAML
5. Check `.buildpact/constitution.md` exists
6. Check IDE config directories

→ NEXT: STEP 2

## STEP 2: Report Results

Display results in a clear table:
```
BuildPact Health Check
[PASS] Node.js 22.1.0
[PASS] Git 2.44.0
[PASS] .buildpact/ structure
[FAIL] IDE configs — missing .cursor/
[PASS] Squad "software" installed
[WARN] Constitution — 0 rules defined

Issues found: 1 failure, 1 warning

Suggested fixes:
1. Run `buildpact adopt` to regenerate IDE configs
2. Run `/bp:constitution` to add project rules
```

## STEP 3: Offer Quick Fixes

If issues are found, offer to fix what can be fixed automatically:
- Missing directories → create them
- Missing IDE configs → suggest `buildpact adopt`
- Empty constitution → suggest `/bp:constitution`
- Invalid squad → suggest `/bp:squad validate`

## Implementation Notes
- Entry point: `src/commands/doctor/handler.ts`
- No subagent dispatch needed — pure filesystem + version checks
- Output: terminal only (no file written)
- Audit log action: `doctor.check`
