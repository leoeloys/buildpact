# Squad Architecture

Squads are BuildPact's domain-specific agent teams. Each squad is a self-contained group of AI agents with defined roles, personas, and interaction protocols tailored to a specific domain.

## 4-Tier Agent Hierarchy

Every squad organizes its agents into four tiers:

| Tier | Role | Description |
|------|------|-------------|
| **T0 — Chief** | Strategic leadership | One per squad. Owns the pipeline, delegates work, resolves conflicts. Always loaded. |
| **T1 — Masters** | Domain leads | Senior agents responsible for major areas (architecture, QA, research). Loaded when their area is active. |
| **T2 — Specialists** | Task executors | Agents with deep expertise in narrow areas (frontend, testing, documentation). Loaded on demand. |
| **T3 — Support** | Assistants | Utility agents for repetitive or mechanical tasks (formatting, linting, data entry). Loaded on demand. |

The Chief (T0) is the only agent loaded at pipeline start. It reads the task, decides which Masters and Specialists are needed, and loads them as the pipeline progresses.

## 6-Layer Agent Anatomy

Each agent is defined as a Markdown file with six required sections:

### 1. Identity

The agent's name, tier, role title, and one-line mission statement. This section is used for agent selection and display.

### 2. Persona

A narrative description of how the agent thinks and works. This shapes the agent's reasoning style and decision-making approach. Personas reference real-world archetypes (e.g., a QA agent inspired by a methodical testing pioneer, a PM agent modeled after a legendary product leader).

### 3. Voice DNA

A structured template that controls the agent's communication style. See the Voice DNA section below for the full 5-section specification.

### 4. Heuristics

Decision rules the agent follows. These are concrete, actionable guidelines specific to the agent's role. Example: "If a function exceeds 30 lines, recommend extraction before proceeding."

### 5. Examples (minimum 3)

At least three input/output examples showing the agent's expected behavior. These serve as few-shot demonstrations in the context window.

### 6. Handoffs

Defines when and how this agent hands work to another agent. Includes trigger conditions, the target agent, and what context is passed. This prevents agents from overstepping their role boundaries.

## Voice DNA

Voice DNA is a 5-section template that gives each agent a distinctive, consistent communication style:

| Section | Purpose |
|---------|---------|
| **Personality Anchors** | 3-5 adjectives that define the agent's tone (e.g., "precise, skeptical, encouraging"). |
| **Opinion Stance** | How opinionated the agent is on a spectrum from neutral advisor to strong advocate. Defines whether the agent suggests or insists. |
| **Anti-Patterns** (min 5) | At least 5 communication behaviors the agent must avoid. Examples: "Never use corporate jargon", "Never give vague timelines", "Never agree just to avoid conflict". |
| **Never-Do Rules** | Hard prohibitions that override all other instructions. These are non-negotiable regardless of context. |
| **Inspirational Anchors** | Real-world figures, methodologies, or philosophies that inform the agent's worldview. These are referenced in the persona to ground the agent's voice in something recognizable. |

Voice DNA ensures that two different agents on the same squad sound different and play distinct roles in conversations, even when discussing the same topic.

## Agent Leveling: L1 through L4

Agents operate at one of four autonomy levels. The level determines how much an agent can do without human approval:

| Level | Name | Autonomy |
|-------|------|----------|
| **L1** | Observer | Can analyze and report but cannot modify anything. All actions require human approval. |
| **L2** | Contributor | Can create new files and propose changes. Modifications to existing files require approval. |
| **L3** | Operator | Can create, modify, and delete within its assigned scope. Cross-scope actions require approval. |
| **L4** | Trusted | Full autonomy within the project. Only destructive operations (force push, production deploy) require approval. |

Levels are configured per agent in the squad definition. New or community-contributed agents start at L1 and are promoted by the project owner. The constitution can set a maximum level for the entire project.

## Lazy Loading

Squad loading is optimized to minimize context window usage:

1. **Initial load:** Only the Chief (T0) agent and the squad's agent index are loaded. The index is a lightweight manifest (target: 1KB or less) listing all agents with their tier, role, and file path.
2. **On-demand loading:** When the Chief assigns a task to a specialist, that agent's full definition is loaded into a new subagent context window. The specialist is never loaded into the Chief's context.
3. **Unloading:** Once a subagent completes its task and returns results, its context window is released. Only the results (not the agent definition) persist.

This approach keeps the orchestrator's context window lean. A squad with 10 agents never loads all 10 simultaneously.

## Bundled Squads

BuildPact ships with five reference squads:

| Squad | Domain | Key Agents |
|-------|--------|------------|
| **Software** | Software development | PM, Architect, Developer, QA, Tech Writer |
| **Medical Marketing** | Healthcare marketing (CFM-compliant) | Strategist, Content Creator, Compliance Reviewer |
| **Scientific Research** | Academic and applied research | Principal Investigator, Literature Reviewer, Data Analyst |
| **Clinic Management** | Healthcare operations | Operations Manager, Scheduler, Patient Communications |
| **Agent Builder** | Meta-squad for creating new squads | Squad Designer, Persona Crafter, Validator |

The Software squad is the most complete and serves as the reference implementation for squad authors. The Agent Builder squad is unique in that it creates other squads, making BuildPact self-extending.

Bundled squads are stored in `templates/squads/` and copied into the project's `.buildpact/squads/` directory during installation.

## Community Hub

The community hub is a separate repository (`buildpact-squads`) where anyone can contribute squads. The contribution flow:

1. Author creates a squad following the 6-layer agent anatomy and squad YAML schema.
2. A pull request triggers automated CI validation: schema checks, required section verification, Voice DNA completeness, and example count enforcement.
3. Approved squads are published to the hub and available via `buildpact adopt <squad-name>`.

## Squad Security

Community squads are treated as **untrusted** by default. Before loading a community squad, BuildPact runs validation checks:

- **Schema validation.** The squad YAML must conform to the expected schema. Missing required fields or unexpected fields are rejected.
- **Agent completeness.** Every agent referenced in the squad manifest must have a corresponding definition file with all 6 required layers.
- **Level cap enforcement.** Community agents are capped at the project's configured maximum autonomy level, regardless of what the squad definition requests.
- **Constitution compliance.** Agent heuristics and never-do rules are checked for conflicts with the project constitution. Conflicts are reported and must be resolved before the squad can be used.

Bundled squads (shipped with BuildPact) skip security checks since they are maintained by the core team.
