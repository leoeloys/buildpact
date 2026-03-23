/**
 * Snapshot: Software Squad expected structure.
 * Used by tests to validate the bundled software squad has all expected agents.
 * @see Story 17.1 — Snapshot-based output validation
 */

/** Expected agent files in templates/squads/software/agents/ */
export const expectedAgents = [
  'pact.md',
  'pm.md',
  'architect.md',
  'developer.md',
  'qa.md',
  'tech-writer.md',
] as const

/** Expected top-level files in templates/squads/software/ */
export const expectedSquadFiles = [
  'squad.yaml',
] as const

/** Required YAML fields in squad.yaml */
export const requiredYamlFields = [
  'name',
  'version',
  'domain',
  'description',
  'initial_level',
] as const

/** Required 6-layer sections for specialist agents */
export const required6Layers = [
  '## Identity',
  '## Persona',
  '## Voice DNA',
  '## Heuristics',
  '## Examples',
  '## Handoffs',
] as const

/** Required Voice DNA subsections for specialist agents */
export const requiredVoiceDnaSections = [
  '### Personality Anchors',
  '### Opinion Stance',
  '### Anti-Patterns',
  '### Never-Do Rules',
  '### Inspirational Anchors',
] as const

/** Pipeline phases that must be mapped in squad.yaml */
export const requiredPhases = [
  'specify',
  'plan',
  'execute',
  'verify',
] as const
