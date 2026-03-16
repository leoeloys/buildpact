# Agent Builder Squad

**Purpose:** Meta-creation tool that guides domain experts through building production-quality custom Squads for BuildPact.

**Visibility:** Public — available to all BuildPact users.

---

## Agents

| Agent | Tier | Responsibility |
|-------|------|----------------|
| Agent Designer | T1 | Defines agent roles, Identity, Persona, and Voice DNA |
| Workflow Architect | T2 | Designs Heuristics, Examples, and Handoffs for the full workflow |
| Squad Tester | T3 | Validates all agent files against 6-layer and Voice DNA requirements |

---

## Workflow

```
Agent Designer → Workflow Architect → Squad Tester
      ↑                  ↑                 |
      └──────────────────┴─────────────────┘
              (feedback loops on failures)
```

1. **Agent Designer** interviews the domain expert and writes Identity, Persona, and Voice DNA for each agent
2. **Workflow Architect** designs Heuristics, Examples, and Handoffs, producing a valid handoff graph
3. **Squad Tester** validates every agent against the 6-layer anatomy checklist and returns failures to the appropriate agent for correction

---

## Usage

After activating this Squad, run your Squad creation through the BuildPact pipeline:

```bash
# Start a Squad design session
bp:specify

# Plan the agent files
bp:plan

# Validate the completed Squad
bp:squad validate <path-to-squad-dir>
```

See `templates/squad-design-worksheet.md` for a guided design worksheet.

---

## Validation Rules

This Squad validates custom Squads against these BuildPact requirements:

- **6-layer anatomy:** Identity, Persona, Voice DNA, Heuristics, Examples, Handoffs
- **Voice DNA 5 sections:** Personality Anchors, Opinion Stance, Anti-Patterns (≥5 pairs), Never-Do Rules, Inspirational Anchors
- **Heuristics:** ≥3 numbered IF/THEN rules + at least 1 VETO condition
- **Examples:** ≥3 numbered examples with real domain artefacts
- **Handoffs:** All agents connected; no orphan nodes; every → has a matching ←
