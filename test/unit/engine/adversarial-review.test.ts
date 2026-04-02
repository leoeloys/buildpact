import { describe, it, expect } from 'vitest'
import {
  createReviewConfig,
  createFinding,
  createReviewResult,
  validateReviewResult,
  summarizeFindings,
  formatFindings,
  DEFAULT_MINIMUM_FINDINGS,
  REVIEWER_POSTURE,
} from '../../../src/engine/adversarial-review.js'
import type { AdversarialFinding } from '../../../src/contracts/task.js'

function makeFinding(severity: AdversarialFinding['severity'] = 'medium'): AdversarialFinding {
  return createFinding('Test finding', severity, 'missing', 'Evidence here')
}

describe('createReviewConfig', () => {
  it('creates config with defaults', () => {
    const config = createReviewConfig('code content', 'code')
    expect(config.content).toBe('code content')
    expect(config.contentType).toBe('code')
    expect(config.minimumFindings).toBe(DEFAULT_MINIMUM_FINDINGS)
  })

  it('accepts custom minimum findings', () => {
    const config = createReviewConfig('spec', 'spec', 5)
    expect(config.minimumFindings).toBe(5)
  })
})

describe('createFinding', () => {
  it('creates finding with all fields', () => {
    const f = createFinding('Missing auth check', 'critical', 'security', 'No token validation')
    expect(f.description).toBe('Missing auth check')
    expect(f.severity).toBe('critical')
    expect(f.category).toBe('security')
    expect(f.evidence).toBe('No token validation')
  })
})

describe('createReviewResult', () => {
  it('creates result with findings and default suspicious false', () => {
    const result = createReviewResult([makeFinding()])
    expect(result.findings).toHaveLength(1)
    expect(result.suspicious).toBe(false)
    expect(result.reviewerPosture).toBe(REVIEWER_POSTURE)
  })
})

describe('validateReviewResult', () => {
  it('errors on zero findings', () => {
    const config = createReviewConfig('code', 'code')
    const result = createReviewResult([])
    const validated = validateReviewResult(config, result)
    expect(validated.ok).toBe(false)
    if (!validated.ok) expect(validated.error.code).toBe('ADVERSARIAL_ZERO_FINDINGS')
  })

  it('marks suspicious when below minimum', () => {
    const config = createReviewConfig('code', 'code', 5)
    const result = createReviewResult([makeFinding(), makeFinding()])
    const validated = validateReviewResult(config, result)
    expect(validated.ok).toBe(true)
    if (validated.ok) expect(validated.value.suspicious).toBe(true)
  })

  it('not suspicious when at or above minimum', () => {
    const config = createReviewConfig('code', 'code', 2)
    const result = createReviewResult([makeFinding(), makeFinding()])
    const validated = validateReviewResult(config, result)
    expect(validated.ok).toBe(true)
    if (validated.ok) expect(validated.value.suspicious).toBe(false)
  })
})

describe('summarizeFindings', () => {
  it('counts by severity', () => {
    const findings = [makeFinding('critical'), makeFinding('high'), makeFinding('high'), makeFinding('low')]
    const summary = summarizeFindings(findings)
    expect(summary.critical).toBe(1)
    expect(summary.high).toBe(2)
    expect(summary.medium).toBe(0)
    expect(summary.low).toBe(1)
  })
})

describe('formatFindings', () => {
  it('formats findings with numbering and evidence', () => {
    const findings = [createFinding('Auth gap', 'critical', 'security', 'No JWT check')]
    const text = formatFindings(findings)
    expect(text).toContain('1.')
    expect(text).toContain('[CRITICAL]')
    expect(text).toContain('Auth gap')
    expect(text).toContain('Evidence: No JWT check')
  })
})
