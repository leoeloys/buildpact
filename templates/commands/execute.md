<!-- ORCHESTRATOR: execute | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:execute — Execution Pipeline

> Stub: Full implementation in Alpha phase.

This orchestrator guides the user through the execution pipeline:
1. Wave-parallel execution with subagent isolation (FR-701)
2. Atomic git commits per completed task (FR-702)
3. Crash recovery with automatic retry (FR-703)
4. Goal-backward wave verification (FR-704)
5. Budget guards during execution (FR-705)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/execute/index.ts`
- Output files written to: `.buildpact/specs/{{feature_slug}}/`
- Constitution validation: enforced per task before commit
- Triggers: `on_execute_start`, `on_execute_complete` hooks if Squad active
