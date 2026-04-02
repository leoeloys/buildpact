import { describe, it, expect } from 'vitest'
import {
  createVersion,
  formatVersion,
  parseVersion,
  classifyChange,
  computeNextVersion,
  generateImpactReport,
  createVersionChange,
} from '../../../src/engine/constitution-semantic-versioning.js'

describe('createVersion', () => {
  it('creates version with defaults', () => {
    const v = createVersion()
    expect(v).toEqual({ major: 1, minor: 0, patch: 0 })
  })

  it('creates version with custom values', () => {
    const v = createVersion(2, 3, 4)
    expect(v).toEqual({ major: 2, minor: 3, patch: 4 })
  })
})

describe('formatVersion', () => {
  it('formats as semver string', () => {
    expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3')
  })
})

describe('parseVersion', () => {
  it('parses valid semver', () => {
    expect(parseVersion('2.1.0')).toEqual({ major: 2, minor: 1, patch: 0 })
  })

  it('returns null for invalid string', () => {
    expect(parseVersion('not-a-version')).toBeNull()
  })

  it('returns null for partial version', () => {
    expect(parseVersion('1.2')).toBeNull()
  })
})

describe('classifyChange', () => {
  it('classifies breaking as major', () => {
    const change = createVersionChange('removed', 'no-production-before-test', 'breaking')
    expect(classifyChange(change)).toBe('major')
  })

  it('classifies additive as minor', () => {
    const change = createVersionChange('added', 'new-principle', 'additive')
    expect(classifyChange(change)).toBe('minor')
  })

  it('classifies cosmetic as patch', () => {
    const change = createVersionChange('clarified', 'existing-principle', 'cosmetic')
    expect(classifyChange(change)).toBe('patch')
  })
})

describe('computeNextVersion', () => {
  const base = createVersion(1, 2, 3)

  it('bumps major on breaking change', () => {
    const changes = [createVersionChange('removed', 'principle', 'breaking')]
    expect(computeNextVersion(base, changes)).toEqual({ major: 2, minor: 0, patch: 0 })
  })

  it('bumps minor on additive change', () => {
    const changes = [createVersionChange('added', 'principle', 'additive')]
    expect(computeNextVersion(base, changes)).toEqual({ major: 1, minor: 3, patch: 0 })
  })

  it('bumps patch on cosmetic change', () => {
    const changes = [createVersionChange('clarified', 'principle', 'cosmetic')]
    expect(computeNextVersion(base, changes)).toEqual({ major: 1, minor: 2, patch: 4 })
  })

  it('breaking takes precedence over additive', () => {
    const changes = [
      createVersionChange('added', 'new', 'additive'),
      createVersionChange('removed', 'old', 'breaking'),
    ]
    expect(computeNextVersion(base, changes)).toEqual({ major: 2, minor: 0, patch: 0 })
  })
})

describe('generateImpactReport', () => {
  it('identifies affected specs and plans', () => {
    const changes = [
      createVersionChange('removed', 'p1', 'breaking', ['spec-auth.md', 'plan-v2.md']),
    ]
    const report = generateImpactReport(createVersion(), changes)
    expect(report.affectedSpecs).toContain('spec-auth.md')
    expect(report.affectedPlans).toContain('plan-v2.md')
    expect(report.migrationRequired).toBe(true)
  })

  it('does not require migration for non-breaking', () => {
    const changes = [createVersionChange('added', 'p1', 'additive', ['spec-new.md'])]
    const report = generateImpactReport(createVersion(), changes)
    expect(report.migrationRequired).toBe(false)
  })
})

describe('createVersionChange', () => {
  it('creates change record with defaults', () => {
    const change = createVersionChange('modified', 'principle-x', 'additive')
    expect(change.type).toBe('modified')
    expect(change.principle).toBe('principle-x')
    expect(change.impact).toBe('additive')
    expect(change.affectedArtifacts).toEqual([])
  })
})
