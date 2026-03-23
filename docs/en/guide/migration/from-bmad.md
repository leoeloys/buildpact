# Migrating from BMAD

BuildPact evolved from the ideas behind BMAD. If you've been using BMAD's agent workflows, you'll find BuildPact familiar -- but with significant additions like budget guards, wave-based parallel execution, constitution enforcement, and multi-domain support.

This guide maps every BMAD concept to its BuildPact equivalent and walks you through a complete migration.

## Why Migrate?

BMAD provides agent-driven workflows for software development. BuildPact keeps that foundation and adds:

- **Structured agents** with 6-layer anatomy and Voice DNA (not just role prompts)
- **Budget guards** that prevent runaway AI costs
- **Wave-based execution** that runs independent tasks in parallel
- **Constitution enforcement** checked at every pipeline phase
- **Model profiles** that route tasks to cost-appropriate AI models
- **Audit trail** with full traceability of every AI decision
- **Multi-domain support** beyond software (marketing, health, research)
- **Bilingual CLI** with native English and Portuguese (BR) support

## Concept Mapping

### Agents

| BMAD Agent | BuildPact Agent | What's Different |
|---|---|---|
| `pm` | **Sofia** (Product Manager) | Voice DNA personality, autonomy leveling, structured output format |
| `architect` | **Renzo** (Architect) | Wave-based plan generation, multi-perspective validation (Nyquist) |
| `dev` | **Coda** (Developer) | Subagent isolation, atomic git commits, crash recovery |
| `qa` | **Crivo** (QA Engineer) | Goal-backward verification, constitution compliance checks |
| `tech-writer` | **Lira** (Tech Writer) | Documentation generation integrated into the pipeline |

BuildPact agents have a 6-layer anatomy: role, expertise, voice DNA, tools, constraints, and autonomy level. BMAD agents are defined by a single prompt file. The richer structure means BuildPact agents produce more consistent output and can be fine-tuned for your project.

### Workflows

| BMAD Workflow | BuildPact Command | What's Different |
|---|---|---|
| `create-prd` | `buildpact specify` | Natural language capture with ambiguity detection; produces a structured spec, not a PRD document |
| `create-architecture` | `buildpact plan` | Generates wave-organized tasks with parallel groups; includes automated research phase |
| `create-epics` | `buildpact plan` (output) | Plans produce waves and tasks, not traditional epics; each task is independently executable |
| `dev-story` | `buildpact execute` | Subagent isolation per task; budget guards; atomic git commits; crash recovery with retry |
| `code-review` | `buildpact verify` | Goal-backward verification checks results against the original spec, not just code quality |
| `party-mode` | `buildpact orchestrate` | Structured conclave deliberation with consensus protocol; not free-form multi-agent chat |

### Artifacts and Configuration

| BMAD | BuildPact | Notes |
|---|---|---|
| `_bmad-output/` | `.buildpact/` | Structured subdirectories: `output/`, `audit/`, `memory/`, `config.yaml` |
| `config.yaml` (project root) | `.buildpact/config.yaml` | Enhanced with model profiles, budget limits, squad configuration, language preference |
| `.cursorrules` | `.buildpact/constitution.md` | IDE-agnostic; enforced at execution time; versioned with change tracking |
| Agent prompt files | Squad YAML + agent markdown | Agents defined in `templates/squads/{domain}/agents/` with structured anatomy |

## Step-by-Step Migration

### 1. Install BuildPact

```bash
npm install -g buildpact
```

### 2. Run Adopt in Your Project

```bash
cd your-bmad-project
buildpact adopt
```

The `adopt` command detects your BMAD setup automatically:

- Finds `_bmad-output/` and reads existing artifacts
- Detects your `config.yaml` and maps settings to BuildPact format
- Identifies `.cursorrules` and converts rules to constitution principles
- Prompts you for language, domain, and IDE preferences
- Generates `.buildpact/` with pre-filled configuration

### 3. Review Your Configuration

```bash
cat .buildpact/config.yaml
```

Verify that:

- `language` matches your preference (`en` or `pt-br`)
- `domain` is set correctly (likely `software`)
- `squad` references the right squad template
- `budget` limits are set (BMAD has no equivalent -- set these now)

### 4. Review the Constitution

```bash
cat .buildpact/constitution.md
```

If you had `.cursorrules`, the adopt command converted your rules into constitution principles. Review them and adjust as needed. The constitution is enforced at every pipeline phase -- it's more than a suggestion file.

### 5. Run Doctor

```bash
buildpact doctor
```

Fix any issues reported.

### 6. Test with a Quick Task

```bash
buildpact quick "add a health check endpoint"
```

If this completes successfully, your migration is done.

## What's New in BuildPact

These capabilities have no BMAD equivalent:

- **Budget guards**: Set spending limits per task, plan, or session. BuildPact tracks token usage and stops execution before exceeding your budget.
- **Wave execution**: Independent tasks run in parallel within waves, reducing total execution time.
- **Model profiles**: Route cheap tasks to fast models and complex tasks to capable models. BMAD sends everything to the same model.
- **Memory tiers**: Session feedback, learned patterns, and decision logs persist across sessions.
- **Community hub**: Share and discover squads built by other teams.
- **Constitution versioning**: Track changes to your project rules over time with full audit trail.

## Known Differences

Be aware of these behavioral differences:

- **No PRD document**: BuildPact's `specify` phase produces a structured spec, not a traditional PRD. The spec is designed for machine consumption, not stakeholder review.
- **No epic structure**: Plans produce waves and tasks instead of epics and stories. The wave structure optimizes for parallel execution.
- **Agent names are fixed per squad**: The software squad always uses Sofia, Renzo, Coda, Crivo, and Lira. You customize their behavior through the constitution and squad config, not by renaming them.
- **Output location**: Artifacts go to `.buildpact/` instead of `_bmad-output/`. If other tools depend on `_bmad-output/`, you'll need to update those references.

## Your BMAD Files Are Safe

BuildPact does not touch your `_bmad-output/` directory or your existing `config.yaml`. You can run both frameworks side by side while evaluating BuildPact. Remove BMAD files when you're confident in the migration.
