<!-- ORCHESTRATOR: optimize | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:optimize — AutoResearch (Autonomous Optimization Engine)

> Stub: Deferred to v1.0.

This orchestrator manages the AutoResearch optimization engine:
1. AutoResearch command and program file (FR-1201)
2. Fixed-budget experiment loop (FR-1202)
3. Git Ratchet — commit only proven improvements (FR-1204)
4. Domain-specific metrics (FR-1205)
5. Optimization report (FR-1206)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/optimize/index.ts`
- Output files written to: `.buildpact/optimize/{{target_type}}/`
- Runs on dedicated branch: `optimize/{{target_type}}/{{session_name}}/{{timestamp}}`
- Deferred to v1.0 — returns NOT_IMPLEMENTED in Alpha
