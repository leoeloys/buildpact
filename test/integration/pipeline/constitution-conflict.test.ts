import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectConflicts, formatConflictReportMarkdown } from '../../../src/engine/constitution-conflict-detector.js'

// ---------------------------------------------------------------------------
// Integration test: Multi-section constitution with mixed conflicts
// ---------------------------------------------------------------------------

const MULTI_SECTION_CONSTITUTION = `# Project Constitution — Integration Test

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- Never use any type
- ESM modules only — no CommonJS
- Use TypeScript strict mode

### Compliance Requirements
- HIPAA compliant data handling required
- No patient data in logs

### Architectural Constraints
- Layered architecture only
- No circular dependencies
- Never use global state
- Use global state for feature flags

### Quality Gates
- 80% test coverage required
- All tests must pass before merging
- No skipping tests

### Domain-Specific Rules
- Do not expose internal APIs publicly
- Avoid raw SQL queries

## Version History
| Date | Change | Reason |
|------|--------|--------|
| 2026-01-01 | Initial creation | Project setup |
`

describe('Constitution conflict detection — integration', () => {
  it('detects contradictions and duplicates in a multi-section constitution', () => {
    const result = detectConflicts(MULTI_SECTION_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const conflicts = result.value
    const contradictions = conflicts.filter((c) => c.type === 'contradiction')
    const duplicates = conflicts.filter((c) => c.type === 'duplicate')

    // "Never use global state" vs "Use global state for feature flags"
    expect(contradictions.length).toBeGreaterThan(0)
    const globalStateConflict = contradictions.find(
      (c) =>
        c.ruleA.name.includes('global state') || c.ruleB.name.includes('global state'),
    )
    expect(globalStateConflict).toBeDefined()

    // "Use TypeScript strict mode" appears twice
    expect(duplicates.length).toBeGreaterThan(0)
    const tsDuplicate = duplicates.find(
      (c) =>
        c.ruleA.name.includes('TypeScript strict') && c.ruleB.name.includes('TypeScript strict'),
    )
    expect(tsDuplicate).toBeDefined()
  })

  it('generates a complete markdown report from multi-section constitution', () => {
    const result = detectConflicts(MULTI_SECTION_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const report = formatConflictReportMarkdown(result.value)
    expect(report).toContain('# Constitution Conflict Report')
    expect(report).toContain('## Contradictions')
    expect(report).toContain('## Duplicates')
    expect(report).toContain('[ERROR]')
    expect(report).toContain('[WARNING]')
  })

  it('correctly assigns line numbers that map back to source', () => {
    const result = detectConflicts(MULTI_SECTION_CONSTITUTION)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const lines = MULTI_SECTION_CONSTITUTION.split('\n')
    for (const conflict of result.value) {
      const lineA = lines[conflict.ruleA.line! - 1]
      expect(lineA?.trim()).toBe(`- ${conflict.ruleA.name}`)

      const lineB = lines[conflict.ruleB.line! - 1]
      expect(lineB?.trim()).toBe(`- ${conflict.ruleB.name}`)
    }
  })

  it('file write round-trip works correctly', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-conflict-int-'))
    try {
      const reportDir = join(tmpDir, '.buildpact', 'reports')
      await mkdir(reportDir, { recursive: true })

      const result = detectConflicts(MULTI_SECTION_CONSTITUTION)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const reportContent = formatConflictReportMarkdown(result.value)
      const reportPath = join(reportDir, 'constitution-conflicts.md')
      await writeFile(reportPath, reportContent, 'utf-8')

      const written = await readFile(reportPath, 'utf-8')
      expect(written).toContain('# Constitution Conflict Report')
      expect(written).toContain('Total conflicts:')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })
})
