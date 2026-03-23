# Migrating from GSD

GSD (Get Shit Done) provides a structured planning and execution framework for AI-assisted development. BuildPact shares GSD's emphasis on phases and structured output, and extends it with agent personas, budget controls, constitution enforcement, and multi-domain support.

This guide maps GSD concepts to BuildPact equivalents and walks you through a complete migration.

## Why Migrate?

GSD provides research-plan-execute phases with file-based state tracking. BuildPact keeps that structured approach and adds:

- **Agent personas** with Voice DNA and domain expertise (GSD has no agent concept)
- **Budget guards** that prevent runaway AI costs
- **Wave-based execution** with subagent isolation per task
- **Constitution enforcement** that validates AI output against your project rules
- **Specify phase** for structured requirement capture before planning
- **Verify phase** with goal-backward validation after execution
- **Audit trail** with full traceability of every decision
- **Multi-domain support** beyond software

## Concept Mapping

### Directory Structure

| GSD | BuildPact | What's Different |
|---|---|---|
| `.planning/` | `.buildpact/` | Adds `audit/`, `memory/`, structured config |
| `.planning/STATE.md` | `.buildpact/output/` (per-phase outputs) | State tracked through pipeline artifacts, not a single state file |
| `.planning/ROADMAP.md` | `buildpact plan` output | Wave-organized tasks instead of linear roadmap |
| `.planning/REQUIREMENTS.md` | `buildpact specify` output | Natural language spec with ambiguity detection |
| `.planning/phases/` | `.buildpact/output/` | Outputs organized by pipeline phase, not numbered phases |

### Workflow Phases

| GSD Phase | BuildPact Phase | What's Different |
|---|---|---|
| Research | `buildpact plan --research` | Automated parallel research integrated into planning; not a separate manual phase |
| Plan | `buildpact plan` | Wave-based task groups with parallel execution support; multi-perspective validation |
| Execute | `buildpact execute` | Subagent isolation per task; atomic git commits; crash recovery; budget guards |
| *(no equivalent)* | `buildpact specify` | Structured requirement capture with ambiguity detection before planning |
| *(no equivalent)* | `buildpact verify` | Goal-backward verification checks results against the original spec |

### Configuration

| GSD | BuildPact | Notes |
|---|---|---|
| `config.json` / manual config | `.buildpact/config.yaml` | YAML format; includes model profiles, budget limits, squad config, language preference |
| Executor model selection | Model profiles in config | Route tasks to different models based on complexity and cost |
| Plan frontmatter | Plan YAML output | Structured plan with waves, dependencies, and task metadata |

### Execution Model

| GSD | BuildPact | Notes |
|---|---|---|
| Single executor agent | Subagent per task | Each task runs in isolation with its own context window |
| Sequential task execution | Wave-based parallelism | Independent tasks within a wave run concurrently |
| Manual checkpoint handling | Automated verification gates | Constitution checks at each phase boundary |
| Phase-level commits | Atomic commit per task | Every task produces exactly one git commit |

## Step-by-Step Migration

### 1. Install BuildPact

```bash
npm install -g buildpact
```

### 2. Run Adopt in Your Project

```bash
cd your-gsd-project
buildpact adopt
```

The `adopt` command detects your GSD setup:

- Finds `.planning/` directory and reads existing state
- Identifies your project's language and domain from existing artifacts
- Prompts you for squad selection, IDE preferences, and budget limits
- Generates `.buildpact/` with pre-filled configuration

### 3. Review Your Configuration

```bash
cat .buildpact/config.yaml
```

Verify that:

- `language` matches your preference
- `domain` is set correctly
- `budget` limits are configured (GSD has no equivalent -- set these now)
- `squad` references the appropriate squad template

### 4. Set Up a Constitution

GSD has no constitution concept. BuildPact generates a default constitution during `adopt`, but you should review and customize it:

```bash
cat .buildpact/constitution.md
```

Add your project's coding standards, architectural constraints, and quality requirements. The constitution is enforced at every pipeline phase.

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

These capabilities have no GSD equivalent:

- **Agent personas**: Named agents with domain expertise, Voice DNA, and autonomy levels. GSD uses generic executor prompts.
- **Specify phase**: Structured requirement capture with ambiguity detection before planning begins.
- **Verify phase**: Goal-backward verification checks that execution results match the original spec.
- **Constitution enforcement**: Project rules validated at every phase boundary, not just human review.
- **Budget guards**: Set spending limits and get warnings before exceeding them.
- **Memory tiers**: Session feedback, learned patterns, and decisions persist across sessions.
- **Community hub**: Share and discover squads built by other teams.
- **Multi-domain support**: Marketing, health, and research squads in addition to software.

## Known Differences

Be aware of these behavioral differences:

- **No STATE.md**: BuildPact tracks state through pipeline artifacts and audit logs, not a single state file. Use `buildpact status` to see current state.
- **No ROADMAP.md**: Plans produce wave-organized tasks, not a linear roadmap. The wave structure is optimized for parallel execution.
- **No phase numbering**: GSD uses numbered phases (01, 02, ...). BuildPact uses named phases (specify, plan, execute, verify) that always run in the same order.
- **No manual checkpoints**: GSD relies on human checkpoints within execution. BuildPact automates verification through constitution checks and the verify phase.
- **Research is integrated**: GSD treats research as a separate phase. BuildPact integrates research into the plan phase via `buildpact plan --research`.

## Your GSD Files Are Safe

BuildPact does not touch your `.planning/` directory. You can run both frameworks side by side while evaluating BuildPact. Remove GSD files when you're confident in the migration.
