<!-- ORCHESTRATOR: verify | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:verify — Verification & Memory Layer

> Stub: Full implementation in Alpha phase.

This orchestrator guides the user through the verification pipeline:
1. Guided acceptance test against story criteria (FR-801)
2. Automatic fix-plan generation on failures (FR-802)
3. Memory Layer Tier 1 — session feedback capture (FR-803)
4. Memory Layer Tier 2 — lessons and patterns (FR-804)
5. Memory Layer Tier 3 — decisions log (FR-805)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/verify/index.ts`
- Output files written to: `.buildpact/memory/feedback/`
- Constitution validation: applied to all accepted outputs
- Triggers: `on_verify_complete` hook if Squad active
