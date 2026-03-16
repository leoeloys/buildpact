import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  diffConstitutionPrinciples,
  scanDownstreamArtifacts,
  buildChecklistContent,
  writeUpdateChecklist,
} from '../../../src/engine/constitution-versioner.js'
import type { UpdateChecklist } from '../../../src/engine/constitution-versioner.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OLD_CONSTITUTION = `# Project Constitution

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- ESM modules only

### Architectural Constraints
- Layered architecture
- No circular dependencies

## Domain-Specific Rules
- Follow Squad guidelines

## Version History
| Date | Change | Reason |
|------|--------|--------|
| 2024-01-01 | Initial creation | Project setup |
`

const NEW_CONSTITUTION_MODIFIED = `# Project Constitution

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- ESM modules only
- No default exports

### Architectural Constraints
- Layered architecture
- No circular dependencies

## Domain-Specific Rules
- Follow Squad guidelines

## Version History
| Date | Change | Reason |
|------|--------|--------|
| 2024-01-01 | Initial creation | Project setup |
`

const NEW_CONSTITUTION_ADDED = `# Project Constitution

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- ESM modules only

### Architectural Constraints
- Layered architecture
- No circular dependencies

### Quality Gates
- 80% test coverage
- All tests must pass

## Domain-Specific Rules
- Follow Squad guidelines

## Version History
`

const NEW_CONSTITUTION_REMOVED = `# Project Constitution

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- ESM modules only

## Domain-Specific Rules
- Follow Squad guidelines

## Version History
`

// ---------------------------------------------------------------------------
// diffConstitutionPrinciples
// ---------------------------------------------------------------------------

describe('diffConstitutionPrinciples', () => {
  it('returns empty array when constitutions are identical', () => {
    const changes = diffConstitutionPrinciples(OLD_CONSTITUTION, OLD_CONSTITUTION)
    expect(changes).toHaveLength(0)
  })

  it('detects a modified principle when rules change', () => {
    const changes = diffConstitutionPrinciples(OLD_CONSTITUTION, NEW_CONSTITUTION_MODIFIED)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      name: 'Coding Standards',
      type: 'modified',
    })
    expect(changes[0].oldRules).toContain('ESM modules only')
    expect(changes[0].newRules).toContain('No default exports')
  })

  it('detects an added principle', () => {
    const changes = diffConstitutionPrinciples(OLD_CONSTITUTION, NEW_CONSTITUTION_ADDED)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      name: 'Quality Gates',
      type: 'added',
    })
    expect(changes[0].newRules).toContain('80% test coverage')
  })

  it('detects a removed principle', () => {
    const changes = diffConstitutionPrinciples(OLD_CONSTITUTION, NEW_CONSTITUTION_REMOVED)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      name: 'Architectural Constraints',
      type: 'removed',
    })
    expect(changes[0].oldRules).toContain('Layered architecture')
  })

  it('detects multiple changes simultaneously', () => {
    const multiChange = `# Project Constitution

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode

### Quality Gates
- 90% coverage

## Domain-Specific Rules
- Follow Squad guidelines

## Version History
`
    const changes = diffConstitutionPrinciples(OLD_CONSTITUTION, multiChange)
    // Coding Standards modified, Architectural Constraints removed, Quality Gates added
    expect(changes.length).toBeGreaterThanOrEqual(2)
    const types = new Set(changes.map((c) => c.type))
    expect(types.has('modified') || types.has('removed')).toBe(true)
    expect(types.has('added')).toBe(true)
  })

  it('preserves oldRules and newRules for modified principles', () => {
    const changes = diffConstitutionPrinciples(OLD_CONSTITUTION, NEW_CONSTITUTION_MODIFIED)
    const modified = changes.find((c) => c.type === 'modified')
    expect(modified).toBeDefined()
    expect(modified!.oldRules).toBeDefined()
    expect(modified!.newRules).toBeDefined()
    expect(modified!.oldRules).not.toEqual(modified!.newRules)
  })

  it('returns undefined oldRules for added principles', () => {
    const changes = diffConstitutionPrinciples(OLD_CONSTITUTION, NEW_CONSTITUTION_ADDED)
    const added = changes.find((c) => c.type === 'added')
    expect(added!.oldRules).toBeUndefined()
    expect(added!.newRules).toBeDefined()
  })

  it('returns undefined newRules for removed principles', () => {
    const changes = diffConstitutionPrinciples(OLD_CONSTITUTION, NEW_CONSTITUTION_REMOVED)
    const removed = changes.find((c) => c.type === 'removed')
    expect(removed!.newRules).toBeUndefined()
    expect(removed!.oldRules).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// scanDownstreamArtifacts
// ---------------------------------------------------------------------------

describe('scanDownstreamArtifacts', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-versioner-'))
    await mkdir(join(tmpDir, '.buildpact', 'specs'), { recursive: true })
    await mkdir(join(tmpDir, '.buildpact', 'plans'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array when no changed principles given', async () => {
    const result = await scanDownstreamArtifacts(tmpDir, [])
    expect(result).toHaveLength(0)
  })

  it('returns empty array when no matching artifacts found', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'specs', 'auth.md'),
      '# Auth feature spec\n\nThis spec covers authentication.',
      'utf-8',
    )
    const result = await scanDownstreamArtifacts(tmpDir, ['Quality Gates'])
    expect(result).toHaveLength(0)
  })

  it('finds spec files referencing a changed principle', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'specs', 'api-spec.md'),
      '# API Spec\n\nMust comply with Coding Standards and ensure quality.',
      'utf-8',
    )
    const result = await scanDownstreamArtifacts(tmpDir, ['Coding Standards'])
    expect(result).toHaveLength(1)
    expect(result[0].path).toContain('api-spec.md')
    expect(result[0].referencedPrinciples).toContain('Coding Standards')
    expect(result[0].recommendedAction).toBeTruthy()
  })

  it('finds plan files referencing a changed principle', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'plans', 'wave1.md'),
      '# Wave 1 Plan\n\nTasks must adhere to Architectural Constraints.',
      'utf-8',
    )
    const result = await scanDownstreamArtifacts(tmpDir, ['Architectural Constraints'])
    expect(result).toHaveLength(1)
    expect(result[0].path).toContain('wave1.md')
  })

  it('reports multiple referenced principles per artifact', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'specs', 'big-spec.md'),
      '# Big Spec\n\nFollows Coding Standards and Architectural Constraints.',
      'utf-8',
    )
    const result = await scanDownstreamArtifacts(tmpDir, [
      'Coding Standards',
      'Architectural Constraints',
    ])
    expect(result).toHaveLength(1)
    expect(result[0].referencedPrinciples).toHaveLength(2)
  })

  it('skips non-markdown files', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'specs', 'notes.txt'),
      'Coding Standards reminder',
      'utf-8',
    )
    const result = await scanDownstreamArtifacts(tmpDir, ['Coding Standards'])
    expect(result).toHaveLength(0)
  })

  it('handles missing specs/plans directories gracefully', async () => {
    // Remove the directories
    await rm(join(tmpDir, '.buildpact', 'specs'), { recursive: true, force: true })
    await rm(join(tmpDir, '.buildpact', 'plans'), { recursive: true, force: true })

    const result = await scanDownstreamArtifacts(tmpDir, ['Coding Standards'])
    expect(result).toHaveLength(0)
  })

  it('is case-insensitive when matching principle names', async () => {
    await writeFile(
      join(tmpDir, '.buildpact', 'specs', 'spec.md'),
      'Must follow coding standards.',
      'utf-8',
    )
    const result = await scanDownstreamArtifacts(tmpDir, ['Coding Standards'])
    expect(result).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// buildChecklistContent
// ---------------------------------------------------------------------------

describe('buildChecklistContent', () => {
  const opts = (): UpdateChecklist => ({
    generatedAt: '2024-01-15T10:00:00.000Z',
    changes: [],
    reason: 'Test reason',
    artifacts: [],
  })

  it('includes the generation timestamp', () => {
    const content = buildChecklistContent(opts())
    expect(content).toContain('2024-01-15T10:00:00.000Z')
  })

  it('includes the reason for change', () => {
    const content = buildChecklistContent(opts())
    expect(content).toContain('Test reason')
  })

  it('shows no-changes message when changes array is empty', () => {
    const content = buildChecklistContent(opts())
    expect(content).toContain('No principle changes detected')
  })

  it('shows no-artifacts message when artifacts array is empty', () => {
    const content = buildChecklistContent(opts())
    expect(content).toContain('No existing specs or plans')
  })

  it('renders added principle with + prefix', () => {
    const checklist = opts()
    checklist.changes = [
      { name: 'Quality Gates', type: 'added', newRules: ['80% test coverage'] },
    ]
    const content = buildChecklistContent(checklist)
    expect(content).toContain('Quality Gates')
    expect(content).toContain('added')
    expect(content).toContain('+ 80% test coverage')
  })

  it('renders removed principle with strikethrough', () => {
    const checklist = opts()
    checklist.changes = [
      { name: 'Old Section', type: 'removed', oldRules: ['Old rule'] },
    ]
    const content = buildChecklistContent(checklist)
    expect(content).toContain('Old Section')
    expect(content).toContain('removed')
    expect(content).toContain('~~Old rule~~')
  })

  it('renders modified principle showing both old and new rules', () => {
    const checklist = opts()
    checklist.changes = [
      {
        name: 'Coding Standards',
        type: 'modified',
        oldRules: ['Use TypeScript'],
        newRules: ['Use TypeScript strict mode'],
      },
    ]
    const content = buildChecklistContent(checklist)
    expect(content).toContain('Coding Standards')
    expect(content).toContain('modified')
    expect(content).toContain('~~Use TypeScript~~')
    expect(content).toContain('+ Use TypeScript strict mode')
  })

  it('renders downstream artifact with path, references, and action', () => {
    const checklist = opts()
    checklist.artifacts = [
      {
        path: '.buildpact/specs/auth.md',
        referencedPrinciples: ['Coding Standards'],
        recommendedAction: 'Review for compliance with updated Constitution rules',
      },
    ]
    const content = buildChecklistContent(checklist)
    expect(content).toContain('.buildpact/specs/auth.md')
    expect(content).toContain('Coding Standards')
    expect(content).toContain('Review for compliance')
  })

  it('uses default no-reason message when reason is empty', () => {
    const checklist = opts()
    checklist.reason = ''
    const content = buildChecklistContent(checklist)
    expect(content).toContain('No reason provided')
  })

  it('includes closing recommendation', () => {
    const content = buildChecklistContent(opts())
    expect(content).toContain('Review each artifact above')
  })
})

// ---------------------------------------------------------------------------
// writeUpdateChecklist
// ---------------------------------------------------------------------------

describe('writeUpdateChecklist', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-versioner-write-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('writes constitution_update_checklist.md and returns its path', async () => {
    const checklist: UpdateChecklist = {
      generatedAt: '2024-01-15T10:00:00.000Z',
      changes: [],
      reason: 'Security update',
      artifacts: [],
    }

    const result = await writeUpdateChecklist(tmpDir, checklist)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('constitution_update_checklist.md')
    }

    const content = await readFile(
      join(tmpDir, '.buildpact', 'constitution_update_checklist.md'),
      'utf-8',
    )
    expect(content).toContain('Security update')
    expect(content).toContain('Constitution Update Checklist')
  })

  it('overwrites an existing checklist file', async () => {
    const firstChecklist: UpdateChecklist = {
      generatedAt: '2024-01-01T00:00:00.000Z',
      changes: [],
      reason: 'First update',
      artifacts: [],
    }
    const secondChecklist: UpdateChecklist = {
      generatedAt: '2024-01-15T00:00:00.000Z',
      changes: [],
      reason: 'Second update',
      artifacts: [],
    }

    await writeUpdateChecklist(tmpDir, firstChecklist)
    await writeUpdateChecklist(tmpDir, secondChecklist)

    const content = await readFile(
      join(tmpDir, '.buildpact', 'constitution_update_checklist.md'),
      'utf-8',
    )
    expect(content).toContain('Second update')
    expect(content).not.toContain('First update')
  })
})
