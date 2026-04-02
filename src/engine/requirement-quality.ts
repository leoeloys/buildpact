/**
 * Requirement Quality — "unit tests for English".
 * Checklists that test the quality of REQUIREMENTS, not implementation.
 *
 * 6 dimensions: Completeness, Clarity, Consistency, Measurability, Coverage, Testability
 * 80%+ items must have traceability reference; blocks plan if below threshold.
 *
 * @module engine/requirement-quality
 * @see Concept 6.3 (Spec-Kit requirement quality checklists)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { QualityDimension, RequirementCheckItem, RequirementChecklist } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default minimum pass rate to proceed (80%) */
export const DEFAULT_MIN_PASS_RATE = 0.8

/** Default minimum traceability rate (80%) */
export const DEFAULT_MIN_TRACEABILITY = 0.8

/** All quality dimensions */
export const QUALITY_DIMENSIONS: QualityDimension[] = [
  'COMPLETENESS', 'CLARITY', 'CONSISTENCY',
  'MEASURABILITY', 'COVERAGE', 'TESTABILITY',
]

// ---------------------------------------------------------------------------
// ID generation (collision-safe across parallel agents)
// ---------------------------------------------------------------------------

let checkCounter = 0

/** Generate a unique check item ID (counter is fine here — single-session checklist creation) */
function generateCheckId(): string {
  checkCounter++
  return `CHK-${String(checkCounter).padStart(3, '0')}`
}

/** Reset counter (for testing) */
export function resetCheckCounter(): void {
  checkCounter = 0
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new requirement checklist.
 */
export function createChecklist(specId: string, items: Omit<RequirementCheckItem, 'id'>[]): RequirementChecklist {
  const checkItems: RequirementCheckItem[] = items.map(item => {
    checkCounter++
    return {
      ...item,
      id: `CHK-${String(checkCounter).padStart(3, '0')}`,
    }
  })

  return {
    specId,
    items: checkItems,
    traceabilityRate: calculateTraceability({ specId, items: checkItems, traceabilityRate: 0, passRate: 0 }),
    passRate: calculatePassRate({ specId, items: checkItems, traceabilityRate: 0, passRate: 0 }),
  }
}

/**
 * Create a single checklist item (without auto-id — used internally).
 */
export function createCheckItem(
  question: string,
  dimension: QualityDimension,
  specReference: string | null = null,
): Omit<RequirementCheckItem, 'id'> {
  return {
    question,
    dimension,
    specReference,
    status: 'na',
    notes: null,
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single checklist item. Returns updated checklist with recalculated rates.
 */
export function evaluateItem(
  checklist: RequirementChecklist,
  itemId: string,
  status: 'pass' | 'fail' | 'na',
  notes: string | null = null,
): RequirementChecklist {
  const updated = checklist.items.map(item =>
    item.id === itemId ? { ...item, status, notes } : item,
  )

  const result: RequirementChecklist = { ...checklist, items: updated, traceabilityRate: 0, passRate: 0 }
  result.traceabilityRate = calculateTraceability(result)
  result.passRate = calculatePassRate(result)
  return result
}

// ---------------------------------------------------------------------------
// Calculations
// ---------------------------------------------------------------------------

/**
 * Calculate traceability rate: % of evaluated items that have a specReference.
 * Items with status='na' are excluded from the calculation.
 */
export function calculateTraceability(checklist: RequirementChecklist): number {
  const evaluated = checklist.items.filter(i => i.status !== 'na')
  if (evaluated.length === 0) return 1 // No evaluated items = trivially traceable
  const withRef = evaluated.filter(i => i.specReference !== null && i.specReference.trim() !== '')
  return withRef.length / evaluated.length
}

/**
 * Calculate pass rate: % of evaluated items that passed.
 * Items with status='na' are excluded from the calculation.
 */
export function calculatePassRate(checklist: RequirementChecklist): number {
  const evaluated = checklist.items.filter(i => i.status !== 'na')
  if (evaluated.length === 0) return 1 // No evaluated items = trivially passing
  const passed = evaluated.filter(i => i.status === 'pass')
  return passed.length / evaluated.length
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Check if the checklist meets quality thresholds.
 * BLOCKS if pass rate or traceability is below minimum.
 */
export function checkQualityThreshold(
  checklist: RequirementChecklist,
  minPassRate: number = DEFAULT_MIN_PASS_RATE,
  minTraceability: number = DEFAULT_MIN_TRACEABILITY,
): Result<void> {
  const passRate = calculatePassRate(checklist)
  const traceability = calculateTraceability(checklist)

  if (passRate < minPassRate) {
    return err({
      code: ERROR_CODES.REQUIREMENT_QUALITY_BELOW_THRESHOLD,
      i18nKey: 'error.requirement_quality.pass_rate_below',
      params: {
        passRate: `${(passRate * 100).toFixed(0)}%`,
        minimum: `${(minPassRate * 100).toFixed(0)}%`,
        specId: checklist.specId,
      },
    })
  }

  if (traceability < minTraceability) {
    return err({
      code: ERROR_CODES.REQUIREMENT_QUALITY_BELOW_THRESHOLD,
      i18nKey: 'error.requirement_quality.traceability_below',
      params: {
        traceability: `${(traceability * 100).toFixed(0)}%`,
        minimum: `${(minTraceability * 100).toFixed(0)}%`,
        specId: checklist.specId,
      },
    })
  }

  return ok(undefined)
}
