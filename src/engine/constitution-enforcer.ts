/**
 * Constitution enforcement — re-exports from foundation/constitution.ts.
 * Enforcement logic lives in the foundation layer per architecture spec (FR-201, FR-202).
 * This module provides backwards-compatible imports for command handlers.
 * @module engine/constitution-enforcer
 */

import { parseConstitutionPrinciples as _parseFlat } from '../foundation/constitution.js'

// Re-export enforcement functions from foundation layer
export {
  parseConstitutionPrinciples,
  checkModificationAttempt,
  enforceConstitution,
  formatViolationWarning,
  resolveConstitutionPath,
} from '../foundation/constitution.js'

// Re-export types from contracts layer
export type {
  ConstitutionPrinciple,
  ConstitutionViolation,
  EnforcementResult,
} from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Grouped principle view (used by constitution-versioner)
// ---------------------------------------------------------------------------

/** A grouped principle — section heading with its rule list */
export interface GroupedPrinciple {
  name: string
  rules: string[]
}

/**
 * Extract principles grouped by section heading.
 * Each section becomes one GroupedPrinciple with all its rules as a string array.
 * Used by constitution-versioner for diffing.
 */
export function extractPrincipleGroups(content: string): GroupedPrinciple[] {
  const flat = _parseFlat(content)
  const map = new Map<string, string[]>()

  for (const p of flat) {
    const existing = map.get(p.section) ?? []
    existing.push(p.name)
    map.set(p.section, existing)
  }

  return Array.from(map.entries()).map(([name, rules]) => ({ name, rules }))
}
