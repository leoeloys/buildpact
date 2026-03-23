# Story 10.5: Prompt-to-Agent Mode Migration Path

Status: ready-for-dev

> **⚠️ v2.0 MILESTONE — NOT IN ALPHA OR BETA SCOPE**
>
> This story is explicitly scoped to the v2.0 milestone. It MUST NOT be implemented during Alpha or Beta. The epics.md file states: "Note: v2.0 milestone — not included in Alpha or Beta scope."
>
> **Dev agent instruction:** Do NOT implement this story. If you encounter this story in the backlog during Alpha or Beta, skip it. Implementation begins only after v1.0 ships and v2.0 milestone planning is complete.

## Story

As a developer transitioning from Prompt Mode to Agent Mode (v2.0),
I want a migration command that validates and upgrades all my existing artifacts,
so that I can transition without losing any specs, Constitution rules, memory files, or Squad configurations.

## Acceptance Criteria

**AC-1: Migration validates and upgrades existing artifacts**

Given I run `npx buildpact migrate-to-agent`
When migration executes
Then it validates all existing files against Agent Mode schema requirements
And generates any additional configuration files needed by Agent Mode
And preserves all Git history intact
And produces a compatibility report listing any manual adjustments needed

**AC-2: Compatibility report with actionable warnings**

Given migration completes with warnings
When I review the compatibility report
Then each warning includes a specific file reference and an actionable remediation step
And my project continues to work in Prompt Mode until I explicitly activate Agent Mode

## Tasks / Subtasks

> ⛔ No tasks — this story is deferred to v2.0. Tasks will be defined during v2.0 milestone planning.

Prerequisites that must be resolved before v2.0 planning:
- [ ] OQ-02 (architecture.md §Open Questions): "Pi SDK vs custom agent harness for Agent Mode" must be resolved before v2.0 planning begins (Month 5 per architecture.md)
- [ ] The Pipeline Orchestrator's dispatch interface (Task payload schema — FR-302) must be stable (v1.0 requirement)
- [ ] All `.buildpact/` file classifications (read-only vs. read-write per mode) must be documented (v1.0 requirement — architecture.md §Dual-Mode Interface Contract)

## Dev Notes

### Scope Gate — Why This Story Is Deferred

The architecture explicitly defers Agent Mode (v2.0):

> "Agent Mode (v2.0) is deferred and OQ-02 (Pi SDK vs custom harness) is unresolved. However, the architecture must define the interface contract between modes today — even if Agent Mode implementation is empty in v1.0."
> — architecture.md §Technical Constraints

The migration command cannot be designed until:
1. Agent Mode schema requirements are defined (depends on OQ-02 resolution)
2. The Task payload schema (FR-302) is stable in production
3. File access classification (read-only vs. read-write per mode) is finalized

### v1.0 Pre-Work Required (Not This Story)

During v1.0 (Alpha + Beta), the following architecture work must be done to **enable** this story later:
- Define the `.buildpact/` schema for Agent Mode (architecture.md §Dual-Mode Interface Contract)
- Classify all files as `read-only` or `read-write` by mode
- Keep the Task payload schema (FR-302) stable

This story will build upon that groundwork in v2.0.

### References

- [Source: epics.md#Epic10-Story10.5] — v2.0 milestone scope note, ACs
- [Source: architecture.md#Dual-Mode-Interface-Contract] — Interface contract between Prompt Mode and Agent Mode
- [Source: architecture.md#Open-Questions] — OQ-02: Pi SDK vs custom harness (Month 5)
- [Source: architecture.md#Technical-Constraints] — Agent Mode deferral rationale

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
