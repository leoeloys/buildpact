import { describe, it, expect } from 'vitest'
import {
  createSpecComplianceReview,
  createCodeQualityReview,
  runTwoStageReview,
  hasCriticalIssues,
  formatReviewReport,
} from '../../../src/engine/two-stage-review.js'
import type { ReviewIssue } from '../../../src/contracts/task.js'

const critical: ReviewIssue = {
  severity: 'critical',
  category: 'missing-endpoint',
  description: 'POST /users not implemented',
  file: 'src/api.ts',
  line: 42,
  recommendation: 'Implement the endpoint.',
}

const suggestion: ReviewIssue = {
  severity: 'suggestion',
  category: 'naming',
  description: 'Consider renaming variable',
  file: 'src/utils.ts',
  recommendation: 'Use camelCase.',
}

describe('createSpecComplianceReview', () => {
  it('passes when no critical issues', () => {
    const stage = createSpecComplianceReview([suggestion])
    expect(stage.stage).toBe('spec-compliance')
    expect(stage.passed).toBe(true)
    expect(stage.issues).toHaveLength(1)
  })

  it('fails when critical issue exists', () => {
    const stage = createSpecComplianceReview([critical])
    expect(stage.passed).toBe(false)
  })

  it('passes with empty issues', () => {
    const stage = createSpecComplianceReview([])
    expect(stage.passed).toBe(true)
    expect(stage.issues).toHaveLength(0)
  })
})

describe('createCodeQualityReview', () => {
  it('sets stage to code-quality', () => {
    const stage = createCodeQualityReview([])
    expect(stage.stage).toBe('code-quality')
    expect(stage.passed).toBe(true)
  })

  it('fails on critical issues', () => {
    const stage = createCodeQualityReview([critical])
    expect(stage.passed).toBe(false)
  })
})

describe('runTwoStageReview', () => {
  it('skips quality review when spec fails', () => {
    const spec = createSpecComplianceReview([critical])
    const quality = createCodeQualityReview([])
    const result = runTwoStageReview(spec, quality)
    expect(result.overallPassed).toBe(false)
    expect(result.qualityReview).toBeNull()
  })

  it('passes when both stages pass', () => {
    const spec = createSpecComplianceReview([suggestion])
    const quality = createCodeQualityReview([])
    const result = runTwoStageReview(spec, quality)
    expect(result.overallPassed).toBe(true)
    expect(result.qualityReview).not.toBeNull()
  })

  it('fails when quality has critical issues', () => {
    const spec = createSpecComplianceReview([])
    const quality = createCodeQualityReview([critical])
    const result = runTwoStageReview(spec, quality)
    expect(result.overallPassed).toBe(false)
  })

  it('passes with no quality review provided', () => {
    const spec = createSpecComplianceReview([])
    const result = runTwoStageReview(spec)
    expect(result.overallPassed).toBe(true)
    expect(result.qualityReview).toBeNull()
  })
})

describe('hasCriticalIssues', () => {
  it('returns true when critical issues exist', () => {
    const stage = createSpecComplianceReview([critical])
    expect(hasCriticalIssues(stage)).toBe(true)
  })

  it('returns false when no critical issues', () => {
    const stage = createSpecComplianceReview([suggestion])
    expect(hasCriticalIssues(stage)).toBe(false)
  })
})

describe('formatReviewReport', () => {
  it('includes PASSED for passing review', () => {
    const spec = createSpecComplianceReview([])
    const result = runTwoStageReview(spec)
    const report = formatReviewReport(result)
    expect(report).toContain('PASSED')
    expect(report).toContain('Two-Stage Review Report')
  })

  it('includes FAILED and SKIPPED when spec fails', () => {
    const spec = createSpecComplianceReview([critical])
    const result = runTwoStageReview(spec)
    const report = formatReviewReport(result)
    expect(report).toContain('FAILED')
    expect(report).toContain('SKIPPED')
  })

  it('includes issue details with file and line', () => {
    const spec = createSpecComplianceReview([critical])
    const quality = createCodeQualityReview([])
    const result = runTwoStageReview(spec, quality)
    const report = formatReviewReport(result)
    expect(report).toContain('src/api.ts:42')
    expect(report).toContain('CRITICAL')
  })
})
