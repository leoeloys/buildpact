# Prompt Mode — Manual Agent Loading Best Practices

> **Who is this for?** Developers using BuildPact in **Prompt Mode** (non-Agent Mode), where
> agents are not automatically managed. Follow these guidelines to stay within context limits
> and get consistent, high-quality outputs from your Squad.

---

## Why Manual Agent Loading Matters

In Agent Mode, BuildPact automatically loads only the Chief agent + a lightweight index (≤1KB)
at startup and pulls specialist agents on-demand during handoffs. In Prompt Mode, this
orchestration is your responsibility.

Loading too many agents at once bloats the context window, dilutes focus, and increases cost.
Loading agents lazily — one at a time, only when needed — keeps each interaction sharp.

---

## The Golden Rule

**Load one agent at a time. Unload before loading the next.**

---

## Step-by-Step Loading Protocol

### 1. Start with the Chief agent only

When beginning a new task, paste only the Chief agent's content into your context.

```
[Paste agents/chief.md here]

I need to implement: <your task description>
```

The Chief will analyse the task and tell you which specialist to involve next.

### 2. Follow the Chief's handoff instruction

The Chief's output will include a handoff directive, e.g.:

```
→ Specialist: this task requires database schema design
```

At that point, and only then, load the Specialist agent.

### 3. Load the specialist agent for the active subtask

Remove the Chief agent from your context (or start a fresh context window) and paste the
specialist's file:

```
[Paste agents/specialist.md here]

Context from Chief: <paste the Chief's task summary>

Task: <the specific subtask>
```

### 4. Release the specialist after completion

Once the specialist has produced its output, **do not carry it forward**. Start a new context
window or remove the specialist's content before loading the next agent.

### 5. Return to Chief for review and next handoff

Load the Chief again with a summary of what was produced. The Chief will decide the next step.

---

## The Lightweight Index Pattern

Instead of loading any full agent for orientation, use the agent index — a compact summary of
all agents in the squad (≤1KB). You can generate this with:

```
buildpact squad list  # v2.0 — shows name, tier, and file for each agent
```

Or manually construct it from `squad.yaml`:

```
Squad: software  Domain: software
Agents (4):
  T1 Chief        agents/chief.md
  T2 Specialist   agents/specialist.md
  T3 Support      agents/support.md
  T4 Reviewer     agents/reviewer.md
```

Paste this index at the start of any session instead of full agent files.

---

## When to Load Each Agent Tier

| Tier | Agent       | Load when…                                          |
|------|-------------|-----------------------------------------------------|
| T1   | Chief       | Starting a task; reviewing outputs; making decisions |
| T2   | Specialist  | Doing core domain work (design, implementation)      |
| T3   | Support     | Breaking down subtasks; running automatable steps    |
| T4   | Reviewer    | Validating output before committing or shipping      |

---

## Anti-Patterns to Avoid

| Anti-Pattern                            | Problem                                              |
|-----------------------------------------|------------------------------------------------------|
| Loading all 4 agents at once            | Fills context window; agents override each other     |
| Keeping a specialist loaded across tasks | Stale context contaminates unrelated outputs         |
| Skipping the Chief for orientation      | Misroutes work to wrong specialist                   |
| Loading agents without task context     | Agent has no grounding; output is generic            |

---

## Quick Reference Checklist

- [ ] Load **index only** to orient yourself (no full agent content)
- [ ] Load **Chief** with the task description
- [ ] Follow Chief's handoff → load the named specialist
- [ ] Complete the specialist's subtask
- [ ] **Clear context** (new window or remove agent)
- [ ] Return to Chief with the result summary
- [ ] Repeat until Chief signals completion

---

## Related Documentation

- `docs/voice-dna-guide.md` — how to write effective agent Voice DNA
- `squad.yaml` — agent file paths and tier configuration
- `buildpact squad validate` — verify your squad structure before use
