# The Pipeline

BuildPact organizes work into a 4-phase pipeline. Each phase produces artifacts that feed the next:

```
  specify          plan            execute          verify
 ─────────>    ─────────>      ─────────>      ─────────>
   "what"        "how"         "do it"         "check it"

  spec.md     plan-wave-N.md   git commits    verification
  + ACs       + research       + audit log     report
              + validation
```

## Phase 1: Specify

```bash
buildpact specify "add dark mode toggle to the settings page"
```

Transforms your natural language into a structured specification:

- **User Story** — "As a [persona], I want [goal], so that [motivation]"
- **Acceptance Criteria** — Numbered, testable conditions
- **Functional Requirements** — What the system must do
- **Non-Functional Requirements** — Performance, security, accessibility
- **Constitution Self-Assessment** — How this spec relates to project rules

**Ambiguity detection** catches vague words like "fast", "scalable", "easy" and asks you to define them.

Output: `.buildpact/specs/{slug}/spec.md`

## Phase 2: Plan

```bash
buildpact plan
```

Generates an implementation plan with:

- **Parallel research** — Multiple agents analyze your stack and domain simultaneously
- **Wave-based tasks** — Tasks sorted into waves; same-wave tasks run in parallel
- **Human step detection** — Design reviews and approvals tagged for manual action
- **Nyquist validation** — Multi-perspective checks for missing ACs, circular dependencies, scope creep

Output: `.buildpact/plans/{slug}/plan.md` + wave files + research summary

## Phase 3: Execute

```bash
buildpact execute
```

Implements the plan:

- Each task runs in an **isolated subagent context**
- Each completed task gets an **atomic git commit**
- **Budget guards** check spend limits before each wave
- **Goal-backward verification** checks each wave's output against the spec
- If an AC fails, a **fix plan** is auto-generated

Output: Git commits + verification reports per wave

## Phase 4: Verify

```bash
buildpact verify
```

Walks you through User Acceptance Testing:

```
  AC-1: Dark mode toggle visible in settings page
  Verdict: (Pass / Fail / Skip) > Pass

  AC-2: Toggle persists preference across sessions
  Verdict: (Pass / Fail / Skip) > Fail
  What went wrong? > Preference resets after browser refresh

  Result: 1 passed, 1 failed, 0 skipped
  Fix plan generated: .buildpact/specs/dark-mode/fix/plan-uat.md
```

Failed ACs automatically generate a fix plan you can feed back into `buildpact execute`.

## Quick Flow

For smaller tasks, skip the full pipeline:

| Variant | Behavior |
|---------|---------|
| `buildpact quick "..."` | Zero ceremony — straight to code and commit |
| `buildpact quick "..." --discuss` | 3-5 clarifying questions first |
| `buildpact quick "..." --full` | Full pipeline in one command |
