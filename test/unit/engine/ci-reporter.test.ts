import { describe, it, expect } from 'vitest'
import {
  mapErrorToSuggestion,
  buildCheckResult,
  buildCiAnnotations,
  formatStepSummary,
  formatAnnotationsOutput,
  buildCiSummaryReport,
} from '../../../src/engine/ci-reporter.js'

// ---------------------------------------------------------------------------
// mapErrorToSuggestion
// ---------------------------------------------------------------------------
describe('mapErrorToSuggestion', () => {
  it('maps missing squad.yaml error to squad.yaml creation hint', () => {
    const suggestion = mapErrorToSuggestion('Missing squad.yaml in my-squad/')
    expect(suggestion).toContain('squad.yaml')
    expect(suggestion).toContain('name, version, domain')
  })

  it('maps missing required field error', () => {
    const suggestion = mapErrorToSuggestion('squad.yaml is missing required field: initial_level')
    expect(suggestion).toContain('initial_level')
  })

  it('maps missing agents directory error', () => {
    const suggestion = mapErrorToSuggestion('Missing agents/ directory in squad')
    expect(suggestion).toContain('agents/')
  })

  it('maps missing layer Identity error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: missing layer "Identity"')
    expect(suggestion.toLowerCase()).toContain('identity')
  })

  it('maps missing layer Voice DNA error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: missing layer "Voice DNA"')
    expect(suggestion).toContain('Voice DNA')
  })

  it('maps Voice DNA missing section error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: Voice DNA missing section "Personality Anchors"')
    expect(suggestion).toContain('Personality Anchors')
  })

  it('maps anti-patterns minimum count error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: Anti-Patterns requires minimum 5 prohibited/required pairs (found 2)')
    expect(suggestion).toContain('✘')
  })

  it('maps examples minimum count error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: Examples requires minimum 3 concrete input/output pairs (found 1)')
    expect(suggestion).toContain('3')
  })

  it('maps heuristics minimum IF/THEN error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: Heuristics requires minimum 3 IF/THEN rules (found 0)')
    expect(suggestion).toContain('IF/THEN')
  })

  it('maps heuristics VETO missing error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: Heuristics requires at least one veto condition (use VETO: keyword)')
    expect(suggestion).toContain('VETO')
  })

  it('maps external URL security error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: external url detected: https://example.com')
    expect(suggestion).toContain('external URL')
  })

  it('maps executable code security error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: executable code detected in code block')
    expect(suggestion).toContain('code block')
  })

  it('maps path traversal security error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: path traversal sequence detected: ../')
    expect(suggestion).toContain('path traversal')
  })

  it('maps prompt injection security error', () => {
    const suggestion = mapErrorToSuggestion('agents/cto.md: prompt injection pattern detected: ignore previous instructions')
    expect(suggestion).toContain('prompt injection')
  })

  it('falls back to generic message for unknown errors', () => {
    const suggestion = mapErrorToSuggestion('some totally unknown error xyz')
    expect(suggestion).toContain('CONTRIBUTING.md')
  })
})

// ---------------------------------------------------------------------------
// buildCheckResult
// ---------------------------------------------------------------------------
describe('buildCheckResult', () => {
  it('passes when errors array is empty', () => {
    const result = buildCheckResult('structural-validation', [])
    expect(result.passed).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.suggestions).toHaveLength(0)
    expect(result.checkName).toBe('structural-validation')
  })

  it('fails when errors are present', () => {
    const result = buildCheckResult('security-validation', ['Missing squad.yaml in my-squad/', 'Missing agents/ directory in squad'])
    expect(result.passed).toBe(false)
    expect(result.errors).toHaveLength(2)
    expect(result.suggestions).toHaveLength(2)
  })

  it('produces parallel suggestions array', () => {
    const errors = ['Missing squad.yaml in my-squad/', 'Missing agents/ directory in squad']
    const result = buildCheckResult('structural-validation', errors)
    expect(result.suggestions[0]).toContain('squad.yaml')
    expect(result.suggestions[1]).toContain('agents/')
  })
})

// ---------------------------------------------------------------------------
// buildCiAnnotations
// ---------------------------------------------------------------------------
describe('buildCiAnnotations', () => {
  it('returns empty array when all checks pass', () => {
    const checks = [
      buildCheckResult('structural-validation', []),
      buildCheckResult('security-validation', []),
    ]
    expect(buildCiAnnotations(checks)).toHaveLength(0)
  })

  it('produces one annotation per error across all checks', () => {
    const checks = [
      buildCheckResult('structural-validation', ['err1', 'err2']),
      buildCheckResult('security-validation', ['err3']),
    ]
    const annotations = buildCiAnnotations(checks)
    expect(annotations).toHaveLength(3)
  })

  it('sets level to error', () => {
    const checks = [buildCheckResult('structural-validation', ['some error'])]
    const annotations = buildCiAnnotations(checks)
    expect(annotations[0]!.level).toBe('error')
  })

  it('sets title to check name', () => {
    const checks = [buildCheckResult('security-validation', ['external url detected'])]
    const annotations = buildCiAnnotations(checks)
    expect(annotations[0]!.title).toBe('security-validation')
  })

  it('includes suggestion in annotation message', () => {
    const checks = [buildCheckResult('structural-validation', ['Missing squad.yaml in x/'])]
    const annotations = buildCiAnnotations(checks)
    expect(annotations[0]!.message).toContain('Suggestion:')
    expect(annotations[0]!.message).toContain('squad.yaml')
  })
})

// ---------------------------------------------------------------------------
// formatStepSummary
// ---------------------------------------------------------------------------
describe('formatStepSummary', () => {
  it('includes squad name in heading', () => {
    const checks = [buildCheckResult('structural-validation', [])]
    const summary = formatStepSummary('software-squad', checks)
    expect(summary).toContain('software-squad')
  })

  it('shows all passed when no errors', () => {
    const checks = [
      buildCheckResult('structural-validation', []),
      buildCheckResult('security-validation', []),
    ]
    const summary = formatStepSummary('my-squad', checks)
    expect(summary).toContain('✅')
    expect(summary).toContain('All checks passed')
  })

  it('shows failure when errors present', () => {
    const checks = [
      buildCheckResult('structural-validation', ['Missing squad.yaml in x/']),
      buildCheckResult('security-validation', []),
    ]
    const summary = formatStepSummary('bad-squad', checks)
    expect(summary).toContain('❌')
    expect(summary).toContain('One or more checks failed')
  })

  it('includes error detail section for failing checks', () => {
    const checks = [buildCheckResult('structural-validation', ['Missing squad.yaml in x/'])]
    const summary = formatStepSummary('bad-squad', checks)
    expect(summary).toContain('structural-validation')
    expect(summary).toContain('Missing squad.yaml')
    expect(summary).toContain('How to fix:')
  })

  it('includes next steps section when all pass', () => {
    const checks = [
      buildCheckResult('structural-validation', []),
      buildCheckResult('security-validation', []),
    ]
    const summary = formatStepSummary('my-squad', checks)
    expect(summary).toContain('npx buildpact squad add my-squad')
  })

  it('includes check summary table', () => {
    const checks = [
      buildCheckResult('structural-validation', []),
      buildCheckResult('security-validation', ['external url detected']),
    ]
    const summary = formatStepSummary('x', checks)
    expect(summary).toContain('Check Summary')
    expect(summary).toContain('✅ Pass')
    expect(summary).toContain('❌ Fail')
  })
})

// ---------------------------------------------------------------------------
// formatAnnotationsOutput
// ---------------------------------------------------------------------------
describe('formatAnnotationsOutput', () => {
  it('returns empty string for no annotations', () => {
    expect(formatAnnotationsOutput([])).toBe('')
  })

  it('formats annotation with GitHub Actions syntax', () => {
    const annotations = [{ level: 'error' as const, title: 'structural-validation', message: 'Some error\nSuggestion: fix it' }]
    const output = formatAnnotationsOutput(annotations)
    expect(output).toContain('::error title=structural-validation::')
  })

  it('encodes newlines in message as %0A', () => {
    const annotations = [{ level: 'error' as const, title: 'test', message: 'line1\nline2' }]
    const output = formatAnnotationsOutput(annotations)
    expect(output).toContain('%0A')
    expect(output).not.toContain('line1\nline2')
  })

  it('produces one line per annotation', () => {
    const annotations = [
      { level: 'error' as const, title: 'a', message: 'err1' },
      { level: 'error' as const, title: 'b', message: 'err2' },
    ]
    const lines = formatAnnotationsOutput(annotations).split('\n')
    expect(lines).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// buildCiSummaryReport
// ---------------------------------------------------------------------------
describe('buildCiSummaryReport', () => {
  it('sets allPassed true when both arrays are empty', () => {
    const report = buildCiSummaryReport('my-squad', [], [])
    expect(report.allPassed).toBe(true)
    expect(report.squadName).toBe('my-squad')
  })

  it('sets allPassed false when structural errors present', () => {
    const report = buildCiSummaryReport('x', ['Missing squad.yaml in x/'], [])
    expect(report.allPassed).toBe(false)
  })

  it('sets allPassed false when security errors present', () => {
    const report = buildCiSummaryReport('x', [], ['external url detected'])
    expect(report.allPassed).toBe(false)
  })

  it('has exactly 2 checks (structural + security)', () => {
    const report = buildCiSummaryReport('x', [], [])
    expect(report.checks).toHaveLength(2)
    expect(report.checks[0]!.checkName).toBe('structural-validation')
    expect(report.checks[1]!.checkName).toBe('security-validation')
  })

  it('populates stepSummaryMarkdown', () => {
    const report = buildCiSummaryReport('my-squad', [], [])
    expect(report.stepSummaryMarkdown).toContain('my-squad')
    expect(report.stepSummaryMarkdown.length).toBeGreaterThan(50)
  })

  it('populates annotations for each error', () => {
    const report = buildCiSummaryReport('x', ['err1', 'err2'], ['err3'])
    expect(report.annotations).toHaveLength(3)
  })

  it('produces zero annotations when all pass', () => {
    const report = buildCiSummaryReport('clean', [], [])
    expect(report.annotations).toHaveLength(0)
  })
})
