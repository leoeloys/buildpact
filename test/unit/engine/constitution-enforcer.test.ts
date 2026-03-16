import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  extractPrinciples,
  validateOutput,
  formatViolationWarning,
  resolveConstitutionPath,
} from '../../../src/engine/constitution-enforcer.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_CONSTITUTION = `# Project Constitution — Acme

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- ESM modules only — no CommonJS

### Compliance Requirements
None

### Architectural Constraints
- Layered architecture only
- No circular dependencies
- Never use global state

### Quality Gates
- 80% test coverage required
- All tests must pass before merging

## Domain-Specific Rules
- Do not expose internal APIs publicly

## Version History
| Date | Change | Reason |
|------|--------|--------|
| 2026-01-01 | Initial creation | Project setup |
`

// ---------------------------------------------------------------------------
// extractPrinciples
// ---------------------------------------------------------------------------

describe('extractPrinciples', () => {
  it('extracts all named sections from a standard constitution', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const names = principles.map((p) => p.name)
    expect(names).toContain('Coding Standards')
    expect(names).toContain('Architectural Constraints')
    expect(names).toContain('Quality Gates')
    expect(names).toContain('Domain-Specific Rules')
  })

  it('does not include Version History as a principle', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const names = principles.map((p) => p.name)
    expect(names).not.toContain('Version History')
  })

  it('does not include Immutable Principles parent heading as a principle', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const names = principles.map((p) => p.name)
    expect(names).not.toContain('Immutable Principles')
  })

  it('extracts rules from each section', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const arch = principles.find((p) => p.name === 'Architectural Constraints')
    expect(arch).toBeDefined()
    expect(arch!.rules).toContain('Layered architecture only')
    expect(arch!.rules).toContain('No circular dependencies')
    expect(arch!.rules).toContain('Never use global state')
  })

  it('strips list markers (- * •) from rules', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const coding = principles.find((p) => p.name === 'Coding Standards')
    expect(coding).toBeDefined()
    coding!.rules.forEach((rule) => {
      expect(rule).not.toMatch(/^[-*•]\s/)
    })
  })

  it('returns empty array for empty content', () => {
    const principles = extractPrinciples('')
    expect(principles).toEqual([])
  })

  it('returns empty array when no headings found', () => {
    const principles = extractPrinciples('Just some text\nNo headings here\n')
    expect(principles).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// validateOutput
// ---------------------------------------------------------------------------

describe('validateOutput', () => {
  it('returns no violations when output follows all prohibition rules', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const output = 'This output uses TypeScript strict mode and ESM modules.'
    const report = validateOutput(output, principles)
    expect(report.hasViolations).toBe(false)
    expect(report.violations).toHaveLength(0)
  })

  it('detects violation when output contains a prohibited term', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    // "No circular dependencies" — output mentions circular dependencies
    const output = 'This plan introduces circular dependencies between modules A and B.'
    const report = validateOutput(output, principles)
    expect(report.hasViolations).toBe(true)
    expect(report.violations.length).toBeGreaterThan(0)
  })

  it('includes the principle name in the violation', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const output = 'We will use global state to manage session data.'
    const report = validateOutput(output, principles)
    expect(report.hasViolations).toBe(true)
    const violation = report.violations[0]
    expect(violation.principle).toBe('Architectural Constraints')
  })

  it('includes the specific violated rule in the violation', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    // Use the exact prohibited phrase from the constitution rule
    const output = 'The component will expose internal APIs publicly via HTTP.'
    const report = validateOutput(output, principles)
    expect(report.hasViolations).toBe(true)
    const violation = report.violations[0]
    expect(violation.rule).toContain('expose internal APIs')
  })

  it('detects "never" prohibition keyword', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const output = 'Use global state for the configuration cache.'
    const report = validateOutput(output, principles)
    expect(report.hasViolations).toBe(true)
  })

  it('returns hasViolations: false for empty principles list', () => {
    const report = validateOutput('some output containing anything', [])
    expect(report.hasViolations).toBe(false)
  })

  it('does not flag non-prohibition rules', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    // "80% test coverage required" is not a prohibition — "required" is not in prohibition list
    const output = 'This plan achieves 50% test coverage.'
    const report = validateOutput(output, principles)
    // May or may not have violations, but specifically "test coverage" rule should not trigger
    const testCoverageViolation = report.violations.find((v) =>
      v.rule.includes('test coverage'),
    )
    expect(testCoverageViolation).toBeUndefined()
  })

  it('is case-insensitive when matching prohibited terms', () => {
    const principles = extractPrinciples(SAMPLE_CONSTITUTION)
    const output = 'The implementation introduces CIRCULAR DEPENDENCIES in the module graph.'
    const report = validateOutput(output, principles)
    expect(report.hasViolations).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// formatViolationWarning
// ---------------------------------------------------------------------------

describe('formatViolationWarning', () => {
  const sampleViolation = {
    principle: 'Architectural Constraints',
    rule: 'No circular dependencies',
    trigger: 'circular dependencies',
  }

  it('expert mode includes principle name in brackets', () => {
    const warning = formatViolationWarning(sampleViolation, false)
    expect(warning).toContain('[Architectural Constraints]')
  })

  it('expert mode includes the violated rule text', () => {
    const warning = formatViolationWarning(sampleViolation, false)
    expect(warning).toContain('No circular dependencies')
  })

  it('expert mode includes the trigger term', () => {
    const warning = formatViolationWarning(sampleViolation, false)
    expect(warning).toContain('circular dependencies')
  })

  it('beginner mode uses plain language without brackets', () => {
    const warning = formatViolationWarning(sampleViolation, true)
    expect(warning).not.toContain('[Architectural Constraints]')
  })

  it('beginner mode includes the principle name in readable form', () => {
    const warning = formatViolationWarning(sampleViolation, true)
    expect(warning).toContain('Architectural Constraints')
  })

  it('beginner mode message mentions "review"', () => {
    const warning = formatViolationWarning(sampleViolation, true)
    expect(warning.toLowerCase()).toContain('review')
  })

  it('handles violation without trigger gracefully', () => {
    const violation = {
      principle: 'Quality Gates',
      rule: 'Must not skip tests',
    }
    const warning = formatViolationWarning(violation, false)
    expect(warning).toContain('[Quality Gates]')
    expect(warning).toContain('Must not skip tests')
  })
})

// ---------------------------------------------------------------------------
// resolveConstitutionPath
// ---------------------------------------------------------------------------

describe('resolveConstitutionPath', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-enforcer-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns undefined when constitution does not exist', async () => {
    const path = await resolveConstitutionPath(tmpDir)
    expect(path).toBeUndefined()
  })

  it('returns the constitution path when file exists', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'constitution.md'),
      '# Constitution',
      'utf-8',
    )
    const path = await resolveConstitutionPath(tmpDir)
    expect(path).toBeDefined()
    expect(path).toContain('constitution.md')
    expect(path).toContain(tmpDir)
  })
})
