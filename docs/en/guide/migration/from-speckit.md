# Migrating from SpecKit

SpecKit provides IDE-specific rule files and project templates for AI-assisted development. BuildPact takes the idea of codified project rules further with an IDE-agnostic constitution, a full execution pipeline, and domain-aware agent squads.

This guide maps SpecKit concepts to BuildPact equivalents and walks you through a complete migration.

## Why Migrate?

SpecKit provides `.cursorrules` and template files that shape AI behavior in your IDE. BuildPact keeps the principle of codified rules and adds:

- **IDE-agnostic constitution** that works with Claude Code, Cursor, Gemini CLI, and Codex
- **Enforcement at execution time**, not just as suggestions to the IDE
- **A full pipeline** (specify, plan, execute, verify) instead of ad-hoc AI prompts
- **Agent personas** with domain expertise and structured behavior
- **Budget guards** that prevent runaway AI costs
- **Audit trail** with traceability for every AI decision
- **Constitution versioning** with change tracking over time
- **Multi-domain support** beyond software

## Concept Mapping

| SpecKit Concept | BuildPact Equivalent | What's Different |
|---|---|---|
| `.cursorrules` | `.buildpact/constitution.md` | IDE-agnostic; enforced at execution time; versioned with change tracking |
| SpecKit templates | Command templates (`templates/commands/`) | Templates drive pipeline phases, not just IDE completion |
| SpecKit rules / conventions | Constitution principles | Versioned, enforced, auditable; not passive IDE hints |
| SpecKit project setup | `buildpact init` or `buildpact adopt` | Interactive wizard with squad selection, domain config, language preference |
| *(no equivalent)* | Agent squads | Named agents with 6-layer anatomy, Voice DNA, and autonomy levels |
| *(no equivalent)* | Pipeline phases | specify, plan, execute, verify -- structured workflow instead of ad-hoc prompts |
| *(no equivalent)* | Budget guards | Cost tracking and spending limits per task and session |
| *(no equivalent)* | Audit trail | Full log of AI decisions, constitution checks, and task outcomes |

## Step-by-Step Migration

### 1. Install BuildPact

```bash
npm install -g buildpact
```

### 2. Run Adopt in Your Project

```bash
cd your-speckit-project
buildpact adopt
```

The `adopt` command detects your SpecKit setup:

- Finds `.cursorrules` and extracts rules into constitution principles
- Identifies template files and maps them to BuildPact command templates
- Detects your IDE (Cursor, VS Code, etc.) and configures accordingly
- Prompts you for language, domain, and squad preferences
- Generates `.buildpact/` with pre-filled configuration

### 3. Review Your Constitution

```bash
cat .buildpact/constitution.md
```

The adopt command converts your SpecKit rules into constitution principles. Review them carefully:

- SpecKit rules become constitution sections
- Passive suggestions become enforceable principles
- IDE-specific instructions are separated into IDE config files

The constitution is checked at every pipeline phase. If a rule matters, it belongs here.

### 4. Review Your Configuration

```bash
cat .buildpact/config.yaml
```

Verify that:

- `language` matches your preference
- `domain` is set correctly
- `ide` reflects your current tool
- `budget` limits are configured (SpecKit has no equivalent)

### 5. Run Doctor

```bash
buildpact doctor
```

Fix any issues reported.

### 6. Test with a Quick Task

```bash
buildpact quick "describe a small change relevant to your project"
```

If this completes successfully, your migration is done.

## What's New in BuildPact

These capabilities have no SpecKit equivalent:

- **Full pipeline**: Instead of ad-hoc AI prompts shaped by rules, BuildPact provides a structured pipeline: specify requirements, generate a plan, execute tasks, and verify results.
- **Agent personas**: Named agents with domain expertise. The software squad includes Sofia (PM), Renzo (Architect), Coda (Developer), Crivo (QA), and Lira (Tech Writer).
- **Budget guards**: Set spending limits per task or session. SpecKit has no cost awareness.
- **Wave execution**: Independent tasks run in parallel, reducing execution time.
- **Constitution enforcement**: Rules are checked programmatically at each phase, not just presented to the IDE as context.
- **Constitution versioning**: Track how your project rules evolve over time with a full change history.
- **Memory tiers**: Session feedback, learned patterns, and decisions persist across sessions.
- **Multi-domain support**: Marketing, health, and research squads in addition to software.
- **Community hub**: Share and discover squads built by other teams.

## Known Differences

Be aware of these behavioral differences:

- **Not IDE-specific**: BuildPact's constitution is IDE-agnostic. If you relied on Cursor-specific features in `.cursorrules`, those IDE-specific behaviors won't transfer. BuildPact generates separate IDE config files during setup.
- **Rules are enforced, not suggested**: In SpecKit, rules guide the AI but don't block execution. In BuildPact, constitution violations can halt the pipeline. This is stricter by design.
- **More structure, more files**: SpecKit is lightweight -- a few rule files and templates. BuildPact creates a `.buildpact/` directory with config, constitution, output, audit logs, and memory. The trade-off is traceability and reproducibility.
- **Learning curve**: SpecKit is learn-in-minutes simple. BuildPact's pipeline has more concepts to understand. Start with `buildpact quick` for simple tasks and adopt the full pipeline gradually.

## Your SpecKit Files Are Safe

BuildPact does not delete or modify your `.cursorrules` or template files. You can keep using SpecKit alongside BuildPact while evaluating the migration. Remove SpecKit files when you're confident in the switch.
