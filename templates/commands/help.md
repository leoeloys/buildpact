<!-- ORCHESTRATOR: help | MAX_LINES: 200 | CONTEXT_BUDGET: 10% | VERSION: 2.0.0 -->
# /bp:help — Contextual Help & Next Steps

You are the BuildPact help orchestrator. Your goal: scan the project state and recommend the most useful next step.

## STEP 1: Project State Scan

Check these paths and report what exists:

| Artifact | Path | Status |
|----------|------|--------|
| Config | `.buildpact/config.yaml` | exists? |
| Constitution | `.buildpact/constitution.md` | exists? |
| Any specs | `.buildpact/specs/*/spec.md` | count |
| Any plans | `.buildpact/plans/*/wave-*.md` | count |
| Any verifications | `.buildpact/specs/*/verification-report.md` | count |
| Memory feedback | `.buildpact/memory/feedback/*.json` | count |
| Memory lessons | `.buildpact/memory/lessons/lessons.json` | exists? |
| Active Squad | `.buildpact/squads/*/squad.yaml` | which? |

→ NEXT: STEP 2

## STEP 2: Determine Pipeline Position

Based on what exists, determine where the user is in the pipeline:

| State | Condition | Recommendation |
|-------|-----------|----------------|
| **Not initialized** | No `.buildpact/` directory | Run `buildpact init` to set up your project |
| **Fresh project** | Config exists, no specs | Run `/bp:specify` to capture your first requirement |
| **Spec ready** | Spec exists, no plans | Run `/bp:plan` to create an execution plan |
| **Plan ready** | Plan exists, no verification | Run `/bp:execute` to implement the plan |
| **Executed** | Execution done, no verification | Run `/bp:verify` to validate the implementation |
| **Verified** | Verification exists | Ready for next feature — run `/bp:specify` for the next one |
| **Has failures** | Verification with fails | Run `/bp:execute .buildpact/specs/{slug}/fix/` to fix failures |

Display the recommendation with the reasoning.

→ NEXT: STEP 3

## STEP 3: Available Commands Quick Reference

Display a compact reference:

```
Pipeline:      /bp:specify → /bp:plan → /bp:execute → /bp:verify
Quick path:    /bp:quick "description"  (zero-ceremony for small tasks)
Setup:         buildpact init | buildpact doctor | buildpact adopt
Advanced:      /bp:squad | /bp:constitution | /bp:optimize
Help:          /bp:help (you are here)
```

## STEP 4: Squad Status

If an active squad exists, show:
- Squad name and domain
- Phase routing (which agent handles which phase)
- Active model profile

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only -->
- Entry point: src/commands/help/handler.ts
- No subagent dispatch needed — pure filesystem scan
- Output: terminal only (no file written)
- Audit log action: help.scan
