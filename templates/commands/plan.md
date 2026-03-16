<!-- ORCHESTRATOR: plan | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:plan — Planning Pipeline

> Stub: Full implementation in Alpha phase.

This orchestrator guides the user through the planning pipeline:
1. Automated parallel research before planning (FR-501)
2. Wave-based plan generation (FR-502)
3. Model profile configuration (FR-503)
4. Nyquist multi-perspective plan validation (FR-504)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/plan/index.ts`
- Output files written to: `.buildpact/specs/{{feature_slug}}/plan.md`
- Constitution validation: called after plan generation, before user review
- Triggers: `on_plan_complete` hook if Squad active
