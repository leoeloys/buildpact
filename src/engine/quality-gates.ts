/**
 * Quality Gates — 3-layer progressive quality assurance.
 * Layer 1: fast local checks (lint, test, typecheck).
 * Layer 2: AI-assisted review (spec compliance + code quality).
 * Layer 3: human review (always starts as pending).
 * Layers must execute in order — layer 2 requires layer 1 passed.
 *
 * @module engine/quality-gates
 * @see Concept 8.2 (3-layer quality gates)
 * @see Concept 20.4 (Quality gate ordering enforcement)
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { QualityGateResult, ReviewIssue } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Layer 1 — Fast local checks
// ---------------------------------------------------------------------------

/** Command results for layer 1 checks */
export interface Layer1Commands {
  lint?: { passed: boolean; issues: ReviewIssue[] }
  test?: { passed: boolean; issues: ReviewIssue[] }
  typecheck?: { passed: boolean; issues: ReviewIssue[] }
}

/**
 * Run Layer 1 quality gate — fast, local, automated.
 * Passes only if all provided checks pass.
 */
export function runLayer1(commands: Layer1Commands): QualityGateResult {
  const allIssues: ReviewIssue[] = []
  let passed = true
  const start = Date.now()

  for (const check of [commands.lint, commands.test, commands.typecheck]) {
    if (check) {
      allIssues.push(...check.issues)
      if (!check.passed) passed = false
    }
  }

  return {
    layer: 1,
    mode: 'auto',
    passed,
    issues: allIssues,
    duration: Date.now() - start,
  }
}

// ---------------------------------------------------------------------------
// Layer 2 — AI-assisted review
// ---------------------------------------------------------------------------

/** Inputs for layer 2 AI-assisted review */
export interface Layer2Inputs {
  passed: boolean
  issues: ReviewIssue[]
}

/**
 * Run Layer 2 quality gate — AI-assisted spec compliance and code quality.
 * Passes only if both sub-reviews pass.
 */
export function runLayer2(
  specCompliance: Layer2Inputs,
  codeQuality: Layer2Inputs,
): QualityGateResult {
  const allIssues = [...specCompliance.issues, ...codeQuality.issues]
  const passed = specCompliance.passed && codeQuality.passed

  return {
    layer: 2,
    mode: 'hybrid',
    passed,
    issues: allIssues,
    duration: 0,
  }
}

// ---------------------------------------------------------------------------
// Layer 3 — Human review
// ---------------------------------------------------------------------------

/**
 * Run Layer 3 quality gate — human review.
 * Always returns passed=false (pending human decision).
 * The checklist items are recorded as suggestion-severity issues.
 */
export function runLayer3(checklist: string[]): QualityGateResult {
  const issues: ReviewIssue[] = checklist.map(item => ({
    severity: 'suggestion' as const,
    category: 'human-review',
    description: item,
    file: '',
    recommendation: 'Requires human verification.',
  }))

  return {
    layer: 3,
    mode: 'manual',
    passed: false,
    issues,
    duration: 0,
  }
}

// ---------------------------------------------------------------------------
// Ordering enforcement
// ---------------------------------------------------------------------------

/**
 * Require that quality gate layers execute in strict order.
 * Layer 1 must pass before layer 2 can run.
 * Layer 2 must pass before layer 3 can run.
 */
export function requireLayerOrder(results: QualityGateResult[]): Result<void> {
  const sorted = [...results].sort((a, b) => a.layer - b.layer)

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const curr = sorted[i]!

    // Layers must be sequential (no gaps)
    if (curr.layer !== prev.layer + 1) {
      return err({
        code: ERROR_CODES.REVIEW_STAGE_ORDER_VIOLATION,
        i18nKey: 'error.quality_gate.layer_gap',
        params: {
          expected: String(prev.layer + 1),
          actual: String(curr.layer),
        },
      })
    }

    // Previous layer must have passed (except layer 3 which is always pending)
    if (!prev.passed && curr.layer <= 3) {
      return err({
        code: ERROR_CODES.QUALITY_GATE_LAYER1_FAILED,
        i18nKey: 'error.quality_gate.prerequisite_failed',
        params: {
          failedLayer: String(prev.layer),
          blockedLayer: String(curr.layer),
        },
      })
    }
  }

  return ok(undefined)
}
