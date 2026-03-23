# Pipeline Flow

BuildPact executes work through a 4-phase pipeline: **Specify -> Plan -> Execute -> Verify**. A fifth entry point, **Quick**, compresses all four phases into a single conversational flow for small tasks.

```mermaid
graph LR
    S[Specify] --> P[Plan]
    P --> E[Execute]
    E --> V[Verify]
    V -->|Fix Plan| E
    Q[Quick] -->|All-in-one| S
```

## Phase 1: Specify

**Purpose:** Capture what the user wants in a structured, unambiguous specification.

**Artifacts produced:**
- `.buildpact/specs/<task-id>.md` — The specification document with goals, constraints, acceptance criteria, and domain context.

**Key features:**
- Natural language input is parsed into structured sections.
- Ambiguity detection flags vague requirements and prompts the user for clarification before proceeding.
- Domain-aware specification pulls squad context so the spec uses correct terminology for the domain (medical, legal, software, etc.).
- Automation maturity assessment evaluates how much of the task can be automated versus what needs human review.

**Command:** `buildpact specify` or `bp specify`

## Phase 2: Plan

**Purpose:** Turn the specification into a wave-based execution plan with parallelism, dependencies, and budget estimates.

**Artifacts produced:**
- `.buildpact/plans/<task-id>.yaml` — The execution plan with waves, tasks, agent assignments, and cost estimates.

**Key features:**
- **Automated research.** Before planning, research agents investigate the codebase, dependencies, and relevant documentation in parallel. This gives the planner full context without consuming the orchestrator's context budget.
- **Wave-based structure.** Tasks are organized into waves. Tasks within a wave run in parallel; waves execute sequentially. This maximizes throughput while respecting dependency order.
- **Model profiles.** Each task is tagged with a recommended model profile (fast, balanced, powerful) based on task complexity. This controls cost.
- **Nyquist validation.** Multi-perspective plan validation where different reviewer personas (pessimist, optimist, domain expert) critique the plan before execution begins. Named after the sampling theorem: you need multiple perspectives to faithfully reconstruct the full picture.
- **Non-software support.** Plans are not limited to code. Scientific research, marketing campaigns, clinic workflows, and other domains produce plans with domain-appropriate task types.

**Command:** `buildpact plan` or `bp plan`

## Phase 3: Execute

**Purpose:** Run the plan by dispatching tasks to subagents in wave order.

**Artifacts produced:**
- `.buildpact/output/<task-id>/` — Task outputs (code, documents, reports, etc.).
- `.buildpact/audit/` — Execution logs with timing, cost, and token usage per task.
- Atomic git commits per completed task (when applicable).

**Key features:**
- **Wave executor.** Runs all tasks within a wave concurrently, waits for completion, then advances to the next wave. Failed tasks are retried with exponential backoff before escalating.
- **Subagent isolation.** Each subagent receives only its task payload: the task description, relevant file context, and the constitution. No shared memory between subagents.
- **Budget guards.** Real-time cost tracking against the plan's budget estimate. If spend exceeds the configured threshold (default 80%), execution pauses and asks for user approval to continue.
- **Crash recovery.** If execution is interrupted (terminal closed, process killed), the next `buildpact execute` picks up from the last completed task. Wave state is persisted to `.buildpact/state/`.
- **Atomic git commits.** Each completed task produces an isolated git commit with a descriptive message. This makes rollback granular: revert one task without losing others.

**Command:** `buildpact execute` or `bp execute`

## Phase 4: Verify

**Purpose:** Validate that execution results meet the original specification.

**Artifacts produced:**
- `.buildpact/verify/<task-id>.md` — Verification report with pass/fail per acceptance criterion.
- `.buildpact/memory/` — Lessons learned and pattern extractions (fed back to future runs).

**Key features:**
- **Guided acceptance testing.** The verifier walks through each acceptance criterion from the spec and checks the output against it.
- **Automatic fix plan generation.** If verification finds failures, a fix plan is generated automatically. This loops back to Execute for another pass.
- **Memory layers.** Three tiers of memory are updated after verification:
  - **Tier 1 (Session):** Immediate feedback for the current session.
  - **Tier 2 (Lessons):** Patterns and lessons extracted across sessions.
  - **Tier 3 (Decisions):** Architectural decisions logged permanently.

**Command:** `buildpact verify` or `bp verify`

## Quick Mode

Quick mode is not a separate phase but a compressed pipeline. It runs Specify -> Plan -> Execute -> Verify in a single conversational flow, suitable for small tasks that don't warrant separate steps.

**Key features:**
- Lightweight context gathering instead of full specification.
- Inline plan verification (does the plan look right?) before execution.
- Discussion flow for iterating on requirements conversationally.

**Command:** `buildpact quick` or `bp quick`

## Cross-Cutting Concerns

These systems operate across all pipeline phases:

### i18n (Internationalization)

All user-facing strings are loaded from locale files (`locales/en.yaml`, `locales/pt-br.yaml`). The locale is detected from the system environment or set explicitly in `.buildpact/config.yaml`. Templates and error messages are fully localized.

### Audit Logging

Every pipeline action is logged to `.buildpact/audit/cli.jsonl` in structured JSONL format. Each entry includes timestamp, command, phase, duration, token usage, and cost. This provides a complete execution trail for debugging and cost analysis.

### Budget Guards

Budget guards run continuously during execution. They track cumulative token usage and estimated cost against the plan's budget. Configurable thresholds trigger warnings (at 60%) and hard pauses (at 80%) to prevent runaway spending. The user can override limits explicitly.

### Constitution Enforcement

The constitution (`.buildpact/constitution.md`) is injected into every agent context window. The constitution enforcer validates that agent outputs comply with project rules. Violations are flagged in the audit log and can block task completion depending on severity.

### Context Budget Management

Every context window has a finite token budget. BuildPact tracks usage across all injected content (constitution, task payload, file context, agent persona) and ensures no window exceeds its model's limit. When context is tight, lower-priority sections are trimmed automatically with a warning.
