# Creating Squads

A comprehensive guide to building custom BuildPact Squads from scratch. By the end, you will know how to write a `squad.yaml`, define agents with all 6 layers, configure pipeline routing, and validate your Squad with `buildpact doctor --smoke`.

## Anatomy of a Squad

A Squad is a directory containing a configuration file and one or more agent definitions:

```
squads/my-squad/
  squad.yaml          # Squad configuration — agents, phases, metadata
  agents/
    lead.md           # Agent file — 6-layer definition
    specialist.md     # Agent file — 6-layer definition
```

The `squad.yaml` is the manifest. It declares which agents exist, how they route through the pipeline, and what validation rules apply. Each agent `.md` file defines a complete personality with identity, persona, voice DNA, heuristics, examples, and handoffs.

**How they relate:** `squad.yaml` references agent files by key and relative path. The agent files are self-contained definitions that the pipeline loads when routing a command to that agent.

```
squad.yaml
  agents:
    architect:
      file: agents/architect.md  ──→  agents/architect.md
    developer:
      file: agents/developer.md  ──→  agents/developer.md
  phases:
    plan: architect       ──→  routes "plan" phase to the architect agent
    execute: developer    ──→  routes "execute" phase to the developer agent
```

## squad.yaml Reference

Every Squad starts with a `squad.yaml`. Here is the complete field reference, using the built-in Software Squad as the primary example.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique Squad identifier (e.g., `software`, `medical-marketing`) |
| `version` | string | Semantic version (e.g., `"0.1.0"`) |
| `domain` | string | Domain category (e.g., `software`, `health`, `legal`) |
| `description` | string | One-line description of the Squad's purpose |
| `initial_level` | string | Default autonomy level: `L1`, `L2`, `L3`, or `L4` |
| `bundle_disclaimers` | object | AI-generated content disclaimers, at least `en` key required |
| `agents` | object | Agent definitions with `file` paths |
| `phases` | object | Pipeline phase-to-agent routing, at least `execute` required |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `domain_type` | string | Sub-classification (e.g., `software` for the software domain) |
| `maturity` | string | Squad maturity: `experimental`, `operational`, `stable` |
| `mission` | string | Squad mission statement |
| `executor_types` | object | Maps task types to executor mode (`human`, `agent`, `hybrid`) |
| `workflow_chains` | object | Deterministic handoff sequences between agents |
| `smoke_tests` | object | Behavioral validation tests per agent |
| `collaboration` | object | Cross-squad data exchange: `provides` and `consumes` |
| `compliance` | object | Regulatory gate configuration |

### Software Squad Example (Complete)

```yaml
# Software Squad — Reference Implementation
name: software
version: "0.1.0"
domain: software
domain_type: software
description: "Full-stack software development squad — PM, Architect, Developer, QA, Tech Writer"
initial_level: L2

bundle_disclaimers:
  pt-br: "Este conteudo foi gerado por IA e deve ser revisado antes do uso em producao."
  en: "This content was AI-generated and should be reviewed before production use."

agents:
  pact:
    file: agents/pact.md
    display_name: Pacto
  pm:
    file: agents/pm.md
    display_name: Sofia
  architect:
    file: agents/architect.md
    display_name: Renzo
  developer:
    file: agents/developer.md
    display_name: Coda
  qa:
    file: agents/qa.md
    display_name: Crivo
  tech-writer:
    file: agents/tech-writer.md
    display_name: Lira

phases:
  orchestrate: pact
  specify: pm
  plan: architect
  execute: developer
  verify: qa
  quality: qa
  document: tech-writer
```

### Non-Software Example: Medical Marketing

A health-domain Squad with regulatory compliance and cross-squad collaboration:

```yaml
name: medical-marketing
version: "0.1.0"
domain: health
description: "Medical marketing squad — Strategist, Copywriter, Designer, Analytics — CFM/ANVISA compliant"
initial_level: L2

collaboration:
  provides:
    - marketing-campaign-data
    - brand-guidelines
    - audience-analytics
  consumes:
    - compliance-audit-reports
    - patient-flow-analysis
    - research-clinical-evidence

bundle_disclaimers:
  pt-br: "Este conteudo foi gerado por IA e deve ser revisado por profissional de saude antes do uso."
  en: "This content was AI-generated and must be reviewed by a healthcare professional before use."

agents:
  strategist:
    file: agents/strategist.md
  copywriter:
    file: agents/copywriter.md
  designer:
    file: agents/designer.md
  analytics:
    file: agents/analytics.md

phases:
  specify: strategist
  plan: strategist
  execute: copywriter
  verify: analytics

compliance:
  gate: cfm-anvisa
  regulation: "CFM n. 1.974/2011 + ANVISA RDC n. 96/2008"
  block_on_violation: true
```

Notice how the medical-marketing Squad differs from software: the `strategist` handles both `specify` and `plan` (smaller teams can double up), it adds `collaboration` for cross-squad data exchange, and `compliance` for regulatory gates.

## The 6-Layer Agent Anatomy

Every agent `.md` file must contain these six sections in order, plus YAML frontmatter.

### Frontmatter

```yaml
---
agent: architect        # Agent key (matches squad.yaml)
squad: software         # Squad name
tier: T1                # Tier: T0, T1, T2, or T3
level: L2               # Autonomy level: L1-L4
---
```

### Layer 1: Identity

Who the agent is. Name, role, and the meaning behind the name.

**Software example (Renzo, T1 Architect):**
```markdown
## Identity

You are Renzo, the System Architect of the Software Squad. Named after master
builders who create lasting structures, you design systems that are simple,
testable, and built to last.
```

**Non-software example (Copywriter, T2):**
```markdown
## Identity

You are the Medical Copywriter of the Medical Marketing Squad. You write
compelling, compliant copy that educates patients and builds practitioner
authority while strictly enforcing CFM n. 1.974/2011 and ANVISA RDC n. 96/2008
at every word.
```

### Layer 2: Persona

The behavioral archetype in 1-2 sentences. This sets the overall tone.

**Renzo:** "Engineering pragmatist. You choose boring technology that works over clever technology that impresses. You document decisions before code."

**Copywriter:** "Precision communicator with deep regulatory fluency. You know every prohibited phrase by heart and can rewrite any non-compliant copy into a compliant equivalent without losing persuasive power."

### Layer 3: Voice DNA

The most detailed layer. Defines personality, values, and guardrails through 5 required subsections. See the [Voice DNA Deep-Dive](/en/guide/voice-dna) for complete guidance.

### Layer 4: Heuristics

Numbered decision-making rules. Must include at least one **VETO pattern** -- a hard stop that prevents dangerous actions.

**Renzo's heuristics:**
```markdown
## Heuristics

1. When two options are equally good, choose the one with fewer dependencies
2. When a module is getting complex, look for a missing abstraction
3. When a test is hard to write, it's usually an architecture problem
4. If a proposed change introduces a circular dependency VETO: reject and
   redesign before proceeding
```

**Copywriter's VETO:**
```markdown
4. If the copy contains an absolute medical outcome claim VETO: block delivery
   and flag with rule reference (CFM 1.974/2011 Art. 7 S1)
```

The VETO pattern follows the format: `If [condition] VETO: [action]`. It creates a non-negotiable behavioral gate.

### Layer 5: Examples

Minimum 3 concrete input-to-output examples showing the agent in action.

**Coda (Developer):**
```markdown
## Examples

1. **Red phase:** Write `expect(result.ok).toBe(true)` before writing the function
2. **Result type:** `return { ok: false, error: { code: 'FILE_READ_FAILED',
   i18nKey: 'error.file.read_failed' } }`
3. **ESM import:** `import { createI18n } from '../foundation/i18n.js'` --
   `.js` extension required
```

### Layer 6: Handoffs

Directional arrows showing upstream and downstream agent connections.

**Renzo:**
```markdown
## Handoffs

- <- PM: when spec is complete and approved
- -> Developer: when architecture document is complete
- -> QA: when test strategy needs architectural guidance
```

**Copywriter:**
```markdown
## Handoffs

- <- Strategist: when campaign brief and compliance approval are received
- -> Designer: with copy and compliance notes for visual integration
- -> Analytics: with copy variants for A/B testing setup
- <- Strategist: when compliance gate blocks copy for revision
```

Use `<-` for incoming and `->` for outgoing. Each arrow describes the trigger condition.

## Agent Tier Hierarchy

Tiers define an agent's scope and authority within the Squad.

| Tier | Name | Scope | When to Use |
|------|------|-------|-------------|
| **T0** | Chief | Entire pipeline | One per Squad. Routes commands, tracks progress, orchestrates handoffs. The Software Squad's `pact.md` (Pacto) is T0. |
| **T1** | Master | Owns a pipeline phase | Senior specialists who lead phases. Renzo (Architect) owns `plan`, Sofia (PM) owns `specify`. |
| **T2** | Specialist | Executes within a phase | The hands-on workers. Coda (Developer) executes code, the Copywriter writes copy. |
| **T3** | Support | Cross-cutting services | Agents that support other agents without owning a phase. A Tech Writer or Analytics agent. |

**Guidelines:**
- Every Squad needs at least one agent mapped to the `execute` phase
- T0 is optional but recommended for Squads with 3+ agents
- A single agent can be T1 for one phase and still handle another (like the medical-marketing Strategist handling both `specify` and `plan`)
- T3 agents are never directly routed by the pipeline -- they are invoked by other agents via handoffs

## Agent Leveling System

Levels control how much autonomy an agent has. The `initial_level` in `squad.yaml` sets the default; individual agents can override it in their frontmatter.

| Level | Name | Permissions | Use When |
|-------|------|-------------|----------|
| **L1** | Observer | Read-only. Can analyze and recommend but not act. | New or untested Squads. High-risk domains. |
| **L2** | Contributor | Can create and modify files within scope. Requires confirmation for destructive actions. | Default for most Squads. Balanced safety and productivity. |
| **L3** | Operator | Full execution within scope. Can commit, run tests, invoke tools. | Trusted Squads with proven track record. |
| **L4** | Trusted | Full autonomy including cross-scope actions. | Only for mature, well-tested Squads in production. |

**How levels interact:**
- `squad.yaml` sets `initial_level: L2` -- this is the floor for all agents
- An agent's frontmatter can set `level: L3` to override upward
- An agent cannot set a level lower than the squad's `initial_level`
- The level affects what BuildPact permits during execution

## Pipeline Phase Routing

The `phases:` block in `squad.yaml` maps each pipeline command to the agent that leads it.

**Software Squad routing:**
```yaml
phases:
  orchestrate: pact       # Pacto (T0) routes all commands
  specify: pm             # Sofia captures requirements
  plan: architect         # Renzo designs architecture
  execute: developer      # Coda writes code
  verify: qa              # Crivo runs tests
  quality: qa             # Crivo also handles ISO audits
  document: tech-writer   # Lira writes docs
```

**Medical Marketing routing:**
```yaml
phases:
  specify: strategist     # Strategist gathers campaign brief
  plan: strategist        # Strategist also creates the plan
  execute: copywriter     # Copywriter produces the content
  verify: analytics       # Analytics validates performance
```

Notice the difference: the Software Squad has 6 agents covering 7 phases (QA doubles up on `verify` and `quality`). The Medical Marketing Squad has 4 agents covering 4 phases, with the Strategist handling both `specify` and `plan`.

**Rule:** At minimum, the `execute` phase must be mapped. All other phases are optional but recommended.

## Workflow Chains

The `workflow_chains:` block defines deterministic handoff sequences -- what happens after an agent finishes a command.

```yaml
workflow_chains:
  version: "2.0"
  chains:
    - from_agent: pm
      last_command: specify-complete
      next_commands: [review-spec]
      next_agent: architect
    - from_agent: architect
      last_command: plan-complete
      next_commands: [readiness-gate, execute]
      next_agent: developer
    - from_agent: developer
      last_command: implement-complete
      next_commands: [verify, code-review]
      next_agent: qa
    - from_agent: qa
      last_command: verify-complete
      next_commands: [document]
      next_agent: tech-writer
```

Each chain entry defines:
- `from_agent`: the agent that just finished
- `last_command`: the command that was completed
- `next_commands`: which command(s) to trigger next
- `next_agent`: who takes over

This creates a predictable flow: `PM -> Architect -> Developer -> QA -> Tech Writer`, where each transition is triggered by a specific completion signal.

## Smoke Tests

Smoke tests validate that agents behave according to their Voice DNA. Define them in `squad.yaml` under `smoke_tests:`:

```yaml
smoke_tests:
  pm:
    - description: "PM focuses on user needs, not implementation"
      input: "Build a login form with React hooks and JWT"
      expected_behavior: "Asks about user needs and goals before mentioning implementation"
      must_not_contain: ["React hooks", "JWT implementation"]
  architect:
    - description: "Architect produces ADRs for significant choices"
      input: "We need to choose between REST and GraphQL for our API"
      expected_behavior: "Creates structured ADR with options, rationale, and trade-offs"
      must_contain: ["ADR", "trade-off", "options"]
```

Each smoke test specifies:
- `description`: what the test validates
- `input`: the prompt given to the agent
- `expected_behavior`: what a correct response looks like
- `must_contain` / `must_not_contain`: keyword checks on the output

Run smoke tests with:

```bash
buildpact doctor --smoke
```

This loads each agent, sends the test inputs, and verifies the responses match expectations.

## Validation Checklist

Follow these steps to create and validate a Squad:

1. **Create the directory structure:**
   ```bash
   mkdir -p squads/my-squad/agents
   ```

2. **Write `squad.yaml`** with all required fields (`name`, `version`, `domain`, `description`, `initial_level`, `bundle_disclaimers`, `agents`, `phases`)

3. **Write agent `.md` files** with all 6 layers (Identity, Persona, Voice DNA, Heuristics, Examples, Handoffs) and proper frontmatter (`agent`, `squad`, `tier`, `level`)

4. **Run validation:**
   ```bash
   buildpact doctor --smoke
   ```

5. **Fix any reported issues.** Common errors:
   - Missing Voice DNA subsection (all 5 are required)
   - Fewer than 5 anti-pattern pairs (minimum 5 with `X` markers)
   - Agent file referenced in `squad.yaml` but not found on disk
   - Missing `execute` phase in `phases:` block
   - Dangling handoff references (agent mentions a handoff target that doesn't exist in the Squad)

## Next Steps

- **Voice DNA deep-dive:** Learn how to write effective personality anchors, anti-patterns, and VETO rules in the [Voice DNA Guide](/en/guide/voice-dna)
- **CLI reference:** See [`buildpact doctor`](/en/cli/doctor) for all validation options
- **Architecture:** Learn how Squads fit into the pipeline in [Squads Architecture](/en/architecture/squads)
