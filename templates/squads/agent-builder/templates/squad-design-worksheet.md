# Squad Design Worksheet

Use this worksheet to capture the design decisions for your custom Squad before creating the agent files.
Work through each section with the Agent Builder Squad: Agent Designer handles Sections 1–3, Workflow Architect handles Sections 4–5, and Squad Tester validates the completed output.

---

## Section 1 — Squad Purpose

**What is this Squad's primary mission?**
> _One sentence. Start with a verb: "Automates...", "Reviews...", "Manages..."_

[ Write here ]

**Who is the primary user of this Squad?**
> _Job title or role (e.g., "solo developer", "marketing manager", "legal team lead")_

[ Write here ]

**What is the Squad's most common task (top 3)?**
1. [ Task 1 ]
2. [ Task 2 ]
3. [ Task 3 ]

---

## Section 2 — Agent Roster

List every agent you need. For each agent, fill in all fields.

### Agent 1
- **Name:** [ e.g., contract-reviewer ]
- **Tier:** [ T1 / T2 / T3 / T4 ]
- **Primary responsibility:** [ one sentence ]
- **What this agent must NOT do:** [ one sentence ]
- **Three real examples of this agent's output:**
  1. [ Example 1 ]
  2. [ Example 2 ]
  3. [ Example 3 ]

### Agent 2
- **Name:** [ ]
- **Tier:** [ T1 / T2 / T3 / T4 ]
- **Primary responsibility:** [ ]
- **What this agent must NOT do:** [ ]
- **Three real examples of this agent's output:**
  1. [ ]
  2. [ ]
  3. [ ]

### Agent 3 _(add more as needed)_
- **Name:** [ ]
- **Tier:** [ T1 / T2 / T3 / T4 ]
- **Primary responsibility:** [ ]
- **What this agent must NOT do:** [ ]
- **Three real examples of this agent's output:**
  1. [ ]
  2. [ ]
  3. [ ]

---

## Section 3 — Voice DNA Inputs

For each agent, answer these questions to drive Voice DNA design.

| Agent | "This agent sounds like..." | "This agent never says..." | "This agent always does..." |
|-------|-----------------------------|----------------------------|-----------------------------|
| Agent 1 | [ ] | [ ] | [ ] |
| Agent 2 | [ ] | [ ] | [ ] |
| Agent 3 | [ ] | [ ] | [ ] |

---

## Section 4 — Workflow Map

Draw the handoff graph as a list of directed arrows.

```
[ Agent 1 ] → [ Agent 2 ]: when [trigger condition]
[ Agent 2 ] → [ Agent 3 ]: when [trigger condition]
[ Agent 3 ] → [ Agent 1 ]: when [feedback condition]
```

**Failure path:** What happens when the primary workflow fails?

```
[ Agent X ] → [ Agent Y ]: when [failure condition]
```

---

## Section 5 — VETO Conditions

Every agent must have at least one VETO — a condition that blocks progress until resolved.

| Agent | VETO condition |
|-------|----------------|
| Agent 1 | VETO: [ condition ] — [ what must happen before continuing ] |
| Agent 2 | VETO: [ condition ] — [ what must happen before continuing ] |
| Agent 3 | VETO: [ condition ] — [ what must happen before continuing ] |

---

## Validation Checklist

Run this checklist before submitting your Squad to `/bp:squad validate`:

- [ ] Every agent has a unique, non-overlapping Identity
- [ ] Every agent has all 6 layers: Identity, Persona, Voice DNA, Heuristics, Examples, Handoffs
- [ ] Voice DNA has all 5 sections: Personality Anchors, Opinion Stance, Anti-Patterns, Never-Do Rules, Inspirational Anchors
- [ ] Every agent has ≥5 Anti-Pattern pairs (✘ prohibited + ✔ required)
- [ ] Every agent has ≥3 IF/THEN heuristics and at least 1 VETO
- [ ] Every agent has ≥3 numbered Examples with real domain artefacts
- [ ] Every → handoff has a matching ← in the receiving agent
- [ ] No agent has zero handoffs (orphan node)
- [ ] squad.yaml has: name, version, domain, description, initial_level, agents, phases
- [ ] All agent YAML frontmatter includes agent name, squad name, tier (T1–T4), and level (L1–L4)
