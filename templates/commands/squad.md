<!-- ORCHESTRATOR: squad | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->
# /bp:squad — Squad Architecture

> Stub: Full implementation in Alpha phase.

This orchestrator guides the user through Squad management:
1. Squad scaffolding and installation (FR-901)
2. 6-layer agent definition (FR-902)
3. Voice DNA creation with 5-section template (FR-903)
4. Squad structural validation (FR-905)
5. Agent autonomy leveling system (FR-906)

## Implementation Notes
<!-- For Agent Mode TypeScript wrapper only — ignored by Prompt Mode host -->
- Context variables parsed by: `src/commands/squad/index.ts`
- Output files written to: `.buildpact/squads/{{squad_name}}/`
- Squad Validator runs before any Squad is loaded into context (FR-1103)
- Triggers: `on_squad_install` hook after successful installation
