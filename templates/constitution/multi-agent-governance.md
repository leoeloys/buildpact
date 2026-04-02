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

### Verification Protocol
- Agents MUST provide VerificationEvidence before claiming task completion
- Evidence older than 5 minutes is stale and must be refreshed
- Output containing "probably", "should work", "seems correct" triggers red flag review
- TaskResult with success:true but no evidence is BLOCKED

### Debug Protocol
- Debug agents MUST complete INVESTIGATION phase before proposing fixes
- Each hypothesis must be tested individually — one variable at a time
- After 3 failed fix attempts, agents must question architecture, not hypotheses
- Never skip from INVESTIGATION directly to IMPLEMENTATION

### Specification Quality
- Specifications with unresolved [NEEDS CLARIFICATION] markers MUST NOT proceed to planning
- Maximum 3 unresolved markers allowed after clarify phase
- Requirements MUST pass quality checklist (80%+ pass rate, 80%+ traceability) before planning

### Build Recovery
- Build checkpoints saved after each completed task
- Builds without activity for >1 hour are marked ABANDONED
- Recovery sessions MUST resume from last checkpoint, not restart

### Budget Policy Protocol
- Budget policies enforce hard stops — agents MUST pause when budget is exceeded
- Budget incidents require explicit resolution before work can resume
- Monthly budget windows reset on the 1st of each month UTC

### Distillation Protocol
- Distillation MUST be lossless — all headings, entities, and decisions must survive
- Round-trip validation required for critical artifacts (spec, plan, architecture)
- Compression strips filler and hedging but NEVER strips numbers, decisions, or constraints

### Anti-Sycophancy Protocol
- Agents receiving feedback MUST restate it in own technical terms before acting
- Agents MUST verify claims against codebase reality before implementing suggestions
- Agents MUST NOT express agreement without technical justification
- Agents MUST NOT use performative language ("Great point!", "Absolutely right!", "You're correct!")
- Implement changes one at a time with individual verification, not all at once

### TDD Enforcement Protocol
- Implementation tasks MUST follow RED-GREEN-REFACTOR cycle
- In RED phase: create test file BEFORE any production file — test MUST fail
- In GREEN phase: ONLY production files may be modified — test MUST pass
- In REFACTOR phase: tests MUST continue passing after each change
- Config files and generated code are exempt from TDD requirements

### Spec-First Gate
- Execute MUST NOT proceed without an approved specification
- Specs with unresolved [NEEDS CLARIFICATION] markers MUST NOT be approved
- Bypass via --skip-spec is allowed but MUST be recorded in audit log

### Self-Critique Protocol
- Implementation agents MUST complete self-critique at post-code and post-test gates
- Minimum 3 predicted bugs + 3 edge cases per critique — vague descriptions are rejected
- Skipping self-critique MUST be flagged in audit log

### Adversarial Review Protocol
- Adversarial reviews MUST produce a minimum of 10 findings
- 0 findings is a suspicious result requiring re-analysis
- Reviews attack the work, not the person — cynical but professional

### Research Phase Protocol
- Blocking technical unknowns MUST be resolved before planning
- Informational unknowns may be resolved during planning
- Low-confidence findings generate warnings in the plan

### Approval Gate Protocol
- Spec approval, plan approval, architecture decisions, budget increases, and constitution changes require explicit human sign-off
- Rejected approvals MUST include a decision note explaining the reason
- Revision requests return the artifact to the agent with feedback

### Constitution Versioning Protocol
- Constitution changes are classified as MAJOR (breaking), MINOR (additive), or PATCH (cosmetic)
- MAJOR changes require approval and generate a sync impact report
- Affected specs and plans receive warnings on next execution
