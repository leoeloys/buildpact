import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseConstitutionPrinciples,
  enforceConstitution,
  formatViolationWarning,
  resolveConstitutionPath,
  checkModificationAttempt,
} from '../../../src/foundation/constitution.js'
import type { ConstitutionViolation } from '../../../src/contracts/task.js'

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
// parseConstitutionPrinciples
// ---------------------------------------------------------------------------

describe('parseConstitutionPrinciples', () => {
  it('extracts all named sections from a standard constitution', () => {
    const principles = parseConstitutionPrinciples(SAMPLE_CONSTITUTION)
    const sections = [...new Set(principles.map((p) => p.section))]
    expect(sections).toContain('Coding Standards')
    expect(sections).toContain('Architectural Constraints')
    expect(sections).toContain('Quality Gates')
    expect(sections).toContain('Domain-Specific Rules')
  })

  it('does not include Version History as a section', () => {
    const principles = parseConstitutionPrinciples(SAMPLE_CONSTITUTION)
    const sections = [...new Set(principles.map((p) => p.section))]
    expect(sections).not.toContain('Version History')
  })

  it('does not include Immutable Principles parent heading as a section', () => {
    const principles = parseConstitutionPrinciples(SAMPLE_CONSTITUTION)
    const sections = [...new Set(principles.map((p) => p.section))]
    expect(sections).not.toContain('Immutable Principles')
  })

  it('extracts individual rules with section reference', () => {
    const principles = parseConstitutionPrinciples(SAMPLE_CONSTITUTION)
    const archRules = principles.filter((p) => p.section === 'Architectural Constraints')
    expect(archRules.length).toBe(3)
    expect(archRules.map(r => r.name)).toContain('Layered architecture only')
    expect(archRules.map(r => r.name)).toContain('No circular dependencies')
    expect(archRules.map(r => r.name)).toContain('Never use global state')
  })

  it('each principle has name, section, and content fields', () => {
    const principles = parseConstitutionPrinciples(SAMPLE_CONSTITUTION)
    for (const p of principles) {
      expect(p.name).toBeTruthy()
      expect(p.section).toBeTruthy()
      expect(p.content).toBeTruthy()
    }
  })

  it('strips list markers from rule names', () => {
    const principles = parseConstitutionPrinciples(SAMPLE_CONSTITUTION)
    for (const p of principles) {
      expect(p.name).not.toMatch(/^[-*•]\s/)
    }
  })

  it('returns empty array for empty content', () => {
    const principles = parseConstitutionPrinciples('')
    expect(principles).toEqual([])
  })

  it('returns empty array when no headings found', () => {
    const principles = parseConstitutionPrinciples('Just some text\nNo headings here\n')
    expect(principles).toEqual([])
  })

  it('parses all 5 standard sections from template', () => {
    const principles = parseConstitutionPrinciples(SAMPLE_CONSTITUTION)
    const sections = [...new Set(principles.map((p) => p.section))]
    // Standard template has: Coding Standards, Compliance Requirements (empty — "None" is not a "- " item),
    // Architectural Constraints, Quality Gates, Domain-Specific Rules
    expect(sections).toContain('Coding Standards')
    expect(sections).toContain('Architectural Constraints')
    expect(sections).toContain('Quality Gates')
    expect(sections).toContain('Domain-Specific Rules')
  })
})

// ---------------------------------------------------------------------------
// enforceConstitution
// ---------------------------------------------------------------------------

describe('enforceConstitution', () => {
  it('returns hasViolations: false for compliant output', () => {
    const output = 'This output uses TypeScript strict mode and ESM modules.'
    const report = enforceConstitution(output, SAMPLE_CONSTITUTION)
    expect(report.hasViolations).toBe(false)
    expect(report.violations).toHaveLength(0)
  })

  it('detects violation when output contains a prohibited term', () => {
    // "No circular dependencies" — output mentions circular dependencies
    const output = 'This plan introduces circular dependencies between modules A and B.'
    const report = enforceConstitution(output, SAMPLE_CONSTITUTION)
    expect(report.hasViolations).toBe(true)
    expect(report.violations.length).toBeGreaterThan(0)
  })

  it('includes the principle section in the violation', () => {
    const output = 'We will use global state to manage session data.'
    const report = enforceConstitution(output, SAMPLE_CONSTITUTION)
    expect(report.hasViolations).toBe(true)
    const violation = report.violations[0]
    expect(violation.principle.section).toBe('Architectural Constraints')
  })

  it('includes the specific violated rule in the violation', () => {
    const output = 'The component will expose internal APIs publicly via HTTP.'
    const report = enforceConstitution(output, SAMPLE_CONSTITUTION)
    expect(report.hasViolations).toBe(true)
    const violation = report.violations[0]
    expect(violation.principle.name).toContain('expose internal APIs')
  })

  it('uses ConstitutionViolation shape with principle, explanation, severity', () => {
    const output = 'Use global state for the configuration cache.'
    const report = enforceConstitution(output, SAMPLE_CONSTITUTION)
    expect(report.hasViolations).toBe(true)
    const violation = report.violations[0]
    expect(violation.principle).toBeDefined()
    expect(violation.principle.name).toBeTruthy()
    expect(violation.principle.section).toBeTruthy()
    expect(violation.explanation).toBeTruthy()
    expect(violation.severity).toBe('warn')
  })

  it('returns hasViolations: false for empty principles list', () => {
    const report = enforceConstitution('some output containing anything', '')
    expect(report.hasViolations).toBe(false)
  })

  it('does not flag non-prohibition rules', () => {
    const output = 'This plan achieves 50% test coverage.'
    const report = enforceConstitution(output, SAMPLE_CONSTITUTION)
    const testCoverageViolation = report.violations.find((v) =>
      v.principle.name.includes('test coverage'),
    )
    expect(testCoverageViolation).toBeUndefined()
  })

  it('is case-insensitive when matching prohibited terms', () => {
    const output = 'The implementation introduces CIRCULAR DEPENDENCIES in the module graph.'
    const report = enforceConstitution(output, SAMPLE_CONSTITUTION)
    expect(report.hasViolations).toBe(true)
  })

  it('detects override language near principle keywords', () => {
    // "bypass" + "global" (from "Never use global state") triggers override detection
    const output = 'We will bypass the global state restriction for this module.'
    const report = enforceConstitution(output, SAMPLE_CONSTITUTION)
    expect(report.hasViolations).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// formatViolationWarning
// ---------------------------------------------------------------------------

describe('formatViolationWarning', () => {
  const sampleViolation: ConstitutionViolation = {
    principle: {
      name: 'No circular dependencies',
      section: 'Architectural Constraints',
      content: 'No circular dependencies',
    },
    explanation: 'Output contains prohibited term "circular dependencies"',
    severity: 'warn',
  }

  it('expert mode includes principle name', () => {
    const warning = formatViolationWarning(sampleViolation, false)
    expect(warning).toContain('No circular dependencies')
  })

  it('expert mode includes the violated rule text', () => {
    const warning = formatViolationWarning(sampleViolation, false)
    expect(warning).toContain('No circular dependencies')
  })

  it('beginner mode uses plain language', () => {
    const warning = formatViolationWarning(sampleViolation, true)
    expect(warning).toContain('No circular dependencies')
    expect(warning.toLowerCase()).toContain('review')
  })

  it('beginner mode does not use bracket format', () => {
    const warning = formatViolationWarning(sampleViolation, true)
    expect(warning).not.toContain('[Architectural Constraints]')
  })

  it('handles violation with i18n resolver (expert)', () => {
    const mockI18n = {
      lang: 'en' as const,
      t: (key: string, params?: Record<string, string>) => {
        if (key === 'cli.constitution.violation.title_expert') return `Violation: ${params?.principle}`
        if (key === 'cli.constitution.violation.explanation_expert') return `Conflicts with ${params?.principle} in ${params?.section}`
        if (key === 'cli.constitution.violation.action_expert') return 'Review output'
        return key
      },
    }
    const warning = formatViolationWarning(sampleViolation, false, mockI18n)
    expect(warning).toContain('Violation: No circular dependencies')
    expect(warning).toContain('Architectural Constraints')
    expect(warning).toContain('Review output')
  })

  it('handles violation with i18n resolver (beginner)', () => {
    const mockI18n = {
      lang: 'en' as const,
      t: (key: string, params?: Record<string, string>) => {
        if (key === 'cli.constitution.violation.title_beginner') return 'Not allowed'
        if (key === 'cli.constitution.violation.explanation_beginner') return `Rule about '${params?.principle_simple}'`
        if (key === 'cli.constitution.violation.action_beginner') return 'Check the output'
        return key
      },
    }
    const warning = formatViolationWarning(sampleViolation, true, mockI18n)
    expect(warning).toContain('Not allowed')
    expect(warning).toContain("Rule about 'No circular dependencies'")
  })
})

// ---------------------------------------------------------------------------
// checkModificationAttempt
// ---------------------------------------------------------------------------

describe('checkModificationAttempt', () => {
  it('returns false for normal output with no constitution reference', () => {
    expect(checkModificationAttempt('This spec uses TypeScript strict mode.')).toBe(false)
  })

  it('returns true when output contains writeFile targeting constitution', () => {
    expect(checkModificationAttempt('writeFile(".buildpact/constitution.md", newContent)')).toBe(true)
  })

  it('returns true when output contains appendFile targeting constitution', () => {
    expect(checkModificationAttempt('appendFile(".buildpact/constitution.md", rule)')).toBe(true)
  })

  it('returns true when output describes modifying constitution', () => {
    expect(checkModificationAttempt('update .buildpact/constitution.md to remove the TypeScript rule')).toBe(true)
  })

  it('returns false for read-only references to constitution path', () => {
    expect(checkModificationAttempt('Load constitution from .buildpact/constitution.md for context')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(checkModificationAttempt('WRITEFILE(".buildpact/constitution.md", data)')).toBe(true)
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
