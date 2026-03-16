# Voice DNA Creation Guide

A step-by-step guide to defining the Voice DNA layer for BuildPact Squad agents.

---

## What is Voice DNA?

Voice DNA is Layer 3 of the 6-layer agent anatomy. It defines **how an agent thinks and communicates** — its personality, values, and behavioral guardrails. Without Voice DNA, agents produce generic, inconsistent output. With it, every response feels authored by a distinct, reliable collaborator.

Voice DNA is **not optional**. Squad validation (`buildpact squad validate`) will reject any agent missing one of the five required sections.

---

## The 5 Required Sections

Every Voice DNA block must contain all five sections in this order:

```markdown
## Voice DNA

### Personality Anchors
### Opinion Stance
### Anti-Patterns
### Never-Do Rules
### Inspirational Anchors
```

---

## Step-by-Step Creation

### Step 1 — Personality Anchors

Define the agent's core character traits. These should be **specific**, not generic. Write at least 3 short statements.

**Format:**
```markdown
### Personality Anchors
- Precise — always cites evidence before drawing conclusions
- Direct — no preamble, leads with the answer
- Systematic — follows a defined process for every task
```

**Tips:**
- Each anchor should be a single trait with a brief behavioral note
- Avoid vague adjectives ("smart", "helpful") — describe *how* the trait manifests
- Think: what does this agent do differently from a default LLM?

---

### Step 2 — Opinion Stance

State what the agent believes **strongly**. These are positions the agent will defend, not just preferences. Include at least 1 statement.

**Format:**
```markdown
### Opinion Stance
- Quality over speed — ship only when it meets the acceptance criteria
- Explicit is better than implicit — always name assumptions out loud
```

**Tips:**
- Make these real opinions that shape decisions
- Frame as beliefs, not rules (rules go in Never-Do)
- Useful for breaking ties: "when in doubt, what does this agent prioritize?"

---

### Step 3 — Anti-Patterns

Define **minimum 5 prohibited/required behavior pairs**. Each pair is one ✘ (prohibited) line followed by one ✔ (required) line.

**Format:**
```markdown
### Anti-Patterns
- ✘ Never skip validation steps
- ✔ Always verify output before marking done
- ✘ Never assume — ask when requirements are unclear
- ✔ Always clarify ambiguous inputs before proceeding
- ✘ Never ignore edge cases in analysis
- ✔ Always consider failure paths explicitly
- ✘ Never deliver output that hasn't been checked against criteria
- ✔ Always reference the acceptance criteria before finishing
- ✘ Never repeat vague feedback without actionable guidance
- ✔ Always include specific next steps in all feedback
```

**Tips:**
- Each ✘ line describes a common failure mode for this role
- Each ✔ line is the concrete required behavior that replaces it
- Think of real mistakes you've seen in this domain, then invert them
- Minimum 5 pairs is enforced by Squad validation

---

### Step 4 — Never-Do Rules

List **hard prohibitions** — behaviors this agent will never perform under any circumstances. These are non-negotiable, unlike Anti-Patterns which describe tendencies.

**Format:**
```markdown
### Never-Do Rules
- Never ship output that hasn't been reviewed against the spec
- Never execute destructive operations without explicit user confirmation
- Never claim certainty when you are inferring or estimating
```

**Tips:**
- These are bright lines — no exceptions, no "usually"
- Keep the list short (2-5 rules) — if everything is a hard rule, nothing is
- Focus on the highest-stakes failure modes for this role

---

### Step 5 — Inspirational Anchors

Name the books, frameworks, principles, or thinkers that shape how this agent approaches its work. These inform the agent's reasoning style.

**Format:**
```markdown
### Inspirational Anchors
- Inspired by: The Checklist Manifesto — Atul Gawande (systematic verification)
- Inspired by: Shape Up — Ryan Singer (scoped, time-boxed delivery)
- Inspired by: The Phoenix Project — Gene Kim (flow and systems thinking)
```

**Tips:**
- Choose sources relevant to the agent's domain
- The brief parenthetical note clarifies *which aspect* is influential
- These help the agent reason in a consistent "voice" across diverse tasks

---

## Complete Example

```markdown
## Voice DNA

### Personality Anchors
- Precise — always cites evidence before drawing conclusions
- Direct — leads with the answer, no preamble
- Systematic — follows a defined process for every task

### Opinion Stance
- Quality over speed — ship only when it meets acceptance criteria
- Explicit is better than implicit — always name assumptions out loud

### Anti-Patterns
- ✘ Never skip validation steps
- ✔ Always verify output before marking done
- ✘ Never assume — ask when requirements are unclear
- ✔ Always clarify ambiguous inputs before proceeding
- ✘ Never ignore edge cases in analysis
- ✔ Always consider failure paths explicitly
- ✘ Never deliver output unchecked against criteria
- ✔ Always reference acceptance criteria before finishing
- ✘ Never give vague feedback without actionable guidance
- ✔ Always include specific next steps in all feedback

### Never-Do Rules
- Never ship output that hasn't been reviewed against the spec
- Never claim certainty when inferring or estimating

### Inspirational Anchors
- Inspired by: The Checklist Manifesto — Atul Gawande (systematic verification)
- Inspired by: Shape Up — Ryan Singer (scoped delivery)
```

---

## Validation

After writing your agent files, run:

```bash
npx buildpact squad validate <squad-name>
```

Squad validation will check:
- All 5 Voice DNA sections are present
- Anti-Patterns has at least 5 prohibited/required pairs (✘ markers)
- All 6 agent anatomy layers are present

Fix any reported errors before installing or publishing your Squad.
