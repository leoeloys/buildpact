## Multi-Agent Governance

> These rules are enforced programmatically by BuildPact's orchestration engine.
> Violations BLOCK execution — they are not warnings.

### Role Boundaries
- Orchestrators must not write code, edit files, or run shell commands
- Developers must not dispatch other agents or modify the constitution
- Reviewers must not modify any files — read-only analysis only
- Every agent must declare its role before performing actions

### Handoff Protocol
- Every agent dispatch must include a handoff packet with acceptance criteria
- Handoff packets must specify at least one expected output artifact
- Handoff briefings must not exceed 4KB to prevent context pollution
- No agent may dispatch a task to itself (prevents infinite recursion)

### Goal Ancestry
- Execute-phase tasks must carry full goal ancestry (mission → project → phase → task)
- Goal ancestry fields must not be empty — agents must always know the "why"
- Avoid executing tasks without connecting them to the project mission

### Artifact Accountability
- Changes to official artifacts (spec, plan, PRD, architecture, constitution) must have a documented reason
- Every artifact change must be traceable to a specific task or decision
- Never modify official documents without recording the change in the changelog

### Context Discipline
- Pipeline state files must not exceed 50 lines
- Do not accumulate context between orchestrator cycles — read from disk, decide, write back
- Handoff briefings must be condensed, not raw context dumps
