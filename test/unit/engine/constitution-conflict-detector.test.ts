import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  parseConstitutionWithLineNumbers,
  formatConflictReportMarkdown,
} from '../../../src/engine/constitution-conflict-detector.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CLEAN_CONSTITUTION = `# Project Constitution — Clean

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- ESM modules only

### Architectural Constraints
- Layered architecture only
- No circular dependencies

### Quality Gates
- 80% test coverage required
`

const CONTRADICTORY_CONSTITUTION = `# Project Constitution — Contradictory

## Immutable Principles

### Coding Standards
- Never use inline styles
- Use inline styles for email templates

### Architectural Constraints
- No global state
- Use global state for configuration

### Quality Gates
- 80% test coverage required
`

const DUPLICATE_CONSTITUTION = `# Project Constitution — Duplicates

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- ESM modules only

### Architectural Constraints
- Use TypeScript strict mode

### Quality Gates
- 80% test coverage required
`

const MIXED_CONSTITUTION = `# Project Constitution — Mixed

## Immutable Principles

### Coding Standards
- Never use inline styles
- Use inline styles for email templates
- Use TypeScript strict mode

### Architectural Constraints
- Use TypeScript strict mode
- No circular dependencies

### Quality Gates
- 80% test coverage required
`

// ---------------------------------------------------------------------------
// parseConstitutionWithLineNumbers
// ---------------------------------------------------------------------------

describe('parseConstitutionWithLineNumbers', () => {
  it('returns principles with line numbers', () => {
    const principles = parseConstitutionWithLineNumbers(CLEAN_CONSTITUTION)
    expect(principles.length).toBeGreaterThan(0)
    for (const p of principles) {
      expect(p.line).toBeGreaterThan(0)
      expect(p.name).toBeTruthy()
      expect(p.section).toBeTruthy()
    }
  })

  it('assigns correct line numbers', () => {
    const lines = CLEAN_CONSTITUTION.split('\n')
    const principles = parseConstitutionWithLineNumbers(CLEAN_CONSTITUTION)
    for (const p of principles) {
      const sourceLine = lines[p.line - 1]!.trim()
      expect(sourceLine).toBe(`- ${p.name}`)
    }
  })

  it('returns empty array for empty content', () => {
    const principles = parseConstitutionWithLineNumbers('')
    expect(principles).toEqual([])
  })

  it('excludes Version History section', () => {
    const content = CLEAN_CONSTITUTION + `
## Version History
| Date | Change |
| 2026-01-01 | Initial |
`
    const principles = parseConstitutionWithLineNumbers(content)
    const sections = [...new Set(principles.map((p) => p.section))]
    expect(sections).not.toContain('Version History')
  })
})

// ---------------------------------------------------------------------------
// detectConflicts — contradiction detection
// ---------------------------------------------------------------------------

describe('detectConflicts — contradictions', () => {
  it('detects prohibition vs permission contradiction', () => {
    const result = detectConflicts(CONTRADICTORY_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const contradictions = result.value.filter((c) => c.type === 'contradiction')
    expect(contradictions.length).toBeGreaterThan(0)
  })

  it('includes line numbers in contradiction report', () => {
    const result = detectConflicts(CONTRADICTORY_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const contradictions = result.value.filter((c) => c.type === 'contradiction')
    for (const c of contradictions) {
      expect(c.ruleA.line).toBeGreaterThan(0)
      expect(c.ruleB.line).toBeGreaterThan(0)
    }
  })

  it('contradictions have error severity', () => {
    const result = detectConflicts(CONTRADICTORY_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const contradictions = result.value.filter((c) => c.type === 'contradiction')
    for (const c of contradictions) {
      expect(c.severity).toBe('error')
    }
  })

  it('includes rule sections in the conflict', () => {
    const result = detectConflicts(CONTRADICTORY_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const contradictions = result.value.filter((c) => c.type === 'contradiction')
    expect(contradictions.length).toBeGreaterThan(0)
    for (const c of contradictions) {
      expect(c.ruleA.section).toBeTruthy()
      expect(c.ruleB.section).toBeTruthy()
    }
  })

  it('includes suggested action for contradictions', () => {
    const result = detectConflicts(CONTRADICTORY_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const contradictions = result.value.filter((c) => c.type === 'contradiction')
    for (const c of contradictions) {
      expect(c.suggestedAction).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// detectConflicts — duplicate detection
// ---------------------------------------------------------------------------

describe('detectConflicts — duplicates', () => {
  it('detects duplicate rules across sections', () => {
    const result = detectConflicts(DUPLICATE_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const duplicates = result.value.filter((c) => c.type === 'duplicate')
    expect(duplicates.length).toBeGreaterThan(0)
  })

  it('duplicates have warning severity', () => {
    const result = detectConflicts(DUPLICATE_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const duplicates = result.value.filter((c) => c.type === 'duplicate')
    for (const d of duplicates) {
      expect(d.severity).toBe('warning')
    }
  })

  it('suggests consolidation for duplicates', () => {
    const result = detectConflicts(DUPLICATE_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const duplicates = result.value.filter((c) => c.type === 'duplicate')
    for (const d of duplicates) {
      expect(d.suggestedAction.toLowerCase()).toContain('consolidate')
    }
  })

  it('reports correct sections for duplicate rules', () => {
    const result = detectConflicts(DUPLICATE_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const duplicates = result.value.filter((c) => c.type === 'duplicate')
    expect(duplicates.length).toBe(1)
    const dup = duplicates[0]!
    expect(dup.ruleA.section).toBe('Coding Standards')
    expect(dup.ruleB.section).toBe('Architectural Constraints')
  })
})

// ---------------------------------------------------------------------------
// detectConflicts — clean constitution
// ---------------------------------------------------------------------------

describe('detectConflicts — clean constitution', () => {
  it('returns empty conflicts array for clean constitution', () => {
    const result = detectConflicts(CLEAN_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value).toEqual([])
  })

  it('returns empty conflicts for empty content', () => {
    const result = detectConflicts('')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// detectConflicts — mixed (contradictions + duplicates)
// ---------------------------------------------------------------------------

describe('detectConflicts — mixed', () => {
  it('detects both contradictions and duplicates in the same constitution', () => {
    const result = detectConflicts(MIXED_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const contradictions = result.value.filter((c) => c.type === 'contradiction')
    const duplicates = result.value.filter((c) => c.type === 'duplicate')
    expect(contradictions.length).toBeGreaterThan(0)
    expect(duplicates.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// formatConflictReportMarkdown
// ---------------------------------------------------------------------------

describe('formatConflictReportMarkdown', () => {
  it('returns clean message for no conflicts', () => {
    const report = formatConflictReportMarkdown([])
    expect(report).toContain('No conflicts detected')
  })

  it('formats contradiction conflicts as markdown', () => {
    const result = detectConflicts(CONTRADICTORY_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const report = formatConflictReportMarkdown(result.value)
    expect(report).toContain('# Constitution Conflict Report')
    expect(report).toContain('## Contradictions')
    expect(report).toContain('[ERROR]')
  })

  it('formats duplicate conflicts as markdown', () => {
    const result = detectConflicts(DUPLICATE_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const report = formatConflictReportMarkdown(result.value)
    expect(report).toContain('## Duplicates')
    expect(report).toContain('[WARNING]')
  })

  it('includes line numbers in formatted report', () => {
    const result = detectConflicts(CONTRADICTORY_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const report = formatConflictReportMarkdown(result.value)
    expect(report).toMatch(/line \d+/)
  })
})
