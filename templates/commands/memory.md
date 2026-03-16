<!-- ORCHESTRATOR: memory | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:memory — Memory Layer

> Stub: Deferred to v1.0.

This orchestrator manages the three-tier memory layer:
1. Tier 1 — Session feedback (FR-803)
2. Tier 2 — Lessons and patterns (FR-804)
3. Tier 3 — Decisions log (FR-805)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/memory/index.ts`
- Output files written to: `.buildpact/memory/`
- FIFO eviction: max 30 entries per feedback store
- Deferred to v1.0 — returns NOT_IMPLEMENTED in Alpha
