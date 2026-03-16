<!-- ORCHESTRATOR: quick | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:quick — Quick Flow (Zero-Ceremony Execution)

> Stub: Full implementation in Alpha phase.

This orchestrator guides the user through rapid, lightweight task execution:
1. Zero-ceremony command execution (FR-401)
2. Lightweight context gathering (FR-402)
3. Plan verification before execution (FR-403)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/quick/index.ts`
- Output files written to: `.buildpact/specs/{{feature_slug}}/`
- Constitution validation: called before execution
- Triggers: `on_quick_complete` hook if Squad active
