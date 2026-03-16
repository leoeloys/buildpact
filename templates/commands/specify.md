<!-- ORCHESTRATOR: specify | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:specify — Specification Pipeline

> Stub: Full implementation in Alpha phase.

This orchestrator guides the user through the specification pipeline:
1. Capture natural language intent
2. Detect ambiguities and clarify
3. Generate structured spec with acceptance criteria
4. Domain-aware spec with Squad integration

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/specify/index.ts`
- Output files written to: `.buildpact/specs/{{feature_slug}}/`
- Constitution validation: called after spec generation, before user review
- Triggers: `on_specify_complete` hook if Squad active
