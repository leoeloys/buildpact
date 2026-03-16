<!-- ORCHESTRATOR: constitution | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:constitution — Project Constitution

> Stub: Full implementation in Alpha phase.

This orchestrator guides the user through creating and editing the project constitution:
1. Create or update immutable project rules (FR-201)
2. Automatic constitution enforcement across all pipeline phases (FR-202)
3. Constitution versioning and change tracking (FR-203)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/constitution/index.ts`
- Output files written to: `.buildpact/constitution.md`
- Constitution is immutable at runtime — only this command may modify it
- Explicit user consent required for all changes
