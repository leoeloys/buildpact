/**
 * Pure functions for the --full quick flow.
 * Generates minimal plans, validates them from 2 perspectives,
 * and produces fix plans for verification failures.
 * No side effects — fully unit-testable.
 * @see FR-403
 */

/** A single step in a minimal plan */
export type PlanStep = {
  index: number
  description: string
}

/** Result from a single validation perspective */
export type PlanValidationResult = {
  isValid: boolean
  risks: string[]
  perspective: 'completeness' | 'dependency'
}

/** Stopwords to ignore when extracting key terms */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
  'these', 'those', 'it', 'its', 'not', 'all', 'each', 'every', 'any',
  'some', 'into', 'then', 'when', 'after', 'before',
])

/**
 * Extract key terms from text (words >= 5 chars, skip stopwords).
 */
function extractKeyTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ''))
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w))
}

/**
 * Count spec bullet points (lines starting with `- `).
 */
function countSpecBullets(spec: string): number {
  return spec.split('\n').filter((line) => /^\s*-\s/.test(line)).length
}

/**
 * Generate a minimal plan with 2–5 numbered steps.
 *
 * - Simple task (≤3 spec bullets) → 2–3 steps
 * - Complex task (4+ spec bullets) → 4–5 steps
 * - Steps derived from the description and spec content.
 */
export function generateMinimalPlan(_description: string, spec: string): PlanStep[] {
  // TODO(Beta): Use description for semantic step generation via LLM
  const bulletCount = countSpecBullets(spec)
  const isComplex = bulletCount >= 4

  const steps: PlanStep[] = []

  // Step 1: always analyze/identify
  steps.push({
    index: 1,
    description: 'Identify and analyze files and components that need to change',
  })

  // Step 2: implement the core change
  steps.push({
    index: 2,
    description: 'Implement the required changes',
  })

  if (isComplex) {
    // Step 3: handle dependencies/side effects
    steps.push({
      index: 3,
      description: `Update all related dependencies and references affected by the change`,
    })

    // Step 4: add/update tests
    steps.push({
      index: 4,
      description: `Add or update tests to cover the new behavior`,
    })

    // Step 5 for very complex specs
    if (bulletCount >= 5) {
      steps.push({
        index: 5,
        description: `Run quality checks and verify no regressions introduced`,
      })
    }
  } else {
    // Simple: step 3 is verify
    steps.push({
      index: 3,
      description: `Run existing tests and verify the change is complete`,
    })
  }

  return steps
}

/**
 * Perspective A — Completeness: verify all key terms from description
 * appear in at least one plan step.
 */
export function validatePlanCompleteness(
  description: string,
  plan: PlanStep[],
): PlanValidationResult {
  const keyTerms = extractKeyTerms(description)
  const planText = plan.map((s) => s.description).join(' ').toLowerCase()
  const risks: string[] = []

  for (const term of keyTerms) {
    if (!planText.includes(term)) {
      risks.push(`Key term "${term}" from description not covered in any plan step`)
    }
  }

  return {
    isValid: risks.length === 0,
    risks,
    perspective: 'completeness',
  }
}

/**
 * Perspective B — Dependency correctness: verify steps reference
 * only earlier steps, not later ones.
 */
export function validatePlanDependencies(plan: PlanStep[]): PlanValidationResult {
  const risks: string[] = []

  for (const step of plan) {
    // Check for forward references like "step 3" in step 1's description
    const stepRefs = step.description.match(/step\s+(\d+)/gi) ?? []
    for (const ref of stepRefs) {
      const refNum = parseInt(ref.replace(/step\s+/i, ''), 10)
      if (refNum > step.index) {
        risks.push(
          `Step ${step.index} references step ${refNum} which comes later (forward dependency)`,
        )
      }
    }
  }

  // Flag single-step plans for complex descriptions
  if (plan.length === 1) {
    risks.push('Plan has only 1 step — may be insufficient for the described task')
  }

  return {
    isValid: risks.length === 0,
    risks,
    perspective: 'dependency',
  }
}

/**
 * Generate 1–3 targeted fix steps for a verification failure.
 */
export function generateFixPlan(
  description: string,
  verificationFailure: string,
): PlanStep[] {
  const steps: PlanStep[] = []

  // Step 1: address the specific failure
  steps.push({
    index: 1,
    description: `Address verification failure: ${verificationFailure}`,
  })

  // Step 2: re-verify
  steps.push({
    index: 2,
    description: `Re-verify that "${description}" is fully addressed after the fix`,
  })

  // Step 3 if failure mentions multiple concerns
  const failureTerms = extractKeyTerms(verificationFailure)
  if (failureTerms.length >= 3) {
    steps.push({
      index: 3,
      description: `Run regression tests to ensure fix did not break existing functionality`,
    })
  }

  return steps
}
