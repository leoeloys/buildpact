import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  detectArtifactType,
  isOfficialArtifact,
  createChangeEntry,
  validateChangeEntry,
  appendToChangelog,
  formatChangeEntry,
  resetChangeCounter,
} from '../../../src/engine/artifact-changelog.js'

describe('detectArtifactType', () => {
  it('detects PRD', () => expect(detectArtifactType('docs/prd.md')).toBe('prd'))
  it('detects spec', () => expect(detectArtifactType('.buildpact/spec.md')).toBe('spec'))
  it('detects plan', () => expect(detectArtifactType('plan.md')).toBe('plan'))
  it('detects architecture', () => expect(detectArtifactType('architecture.md')).toBe('architecture'))
  it('detects constitution', () => expect(detectArtifactType('.buildpact/constitution.md')).toBe('constitution'))
  it('detects epics', () => expect(detectArtifactType('epics.md')).toBe('epics'))
  it('detects stories', () => expect(detectArtifactType('stories.md')).toBe('stories'))
  it('returns undefined for non-artifacts', () => expect(detectArtifactType('src/foo.ts')).toBeUndefined())
  it('is case-insensitive', () => expect(detectArtifactType('PRD.MD')).toBe('prd'))
})

describe('isOfficialArtifact', () => {
  it('returns true for official artifacts', () => expect(isOfficialArtifact('spec.md')).toBe(true))
  it('returns false for source files', () => expect(isOfficialArtifact('index.ts')).toBe(false))
})

describe('createChangeEntry', () => {
  beforeEach(() => resetChangeCounter())

  it('creates an entry with auto-incremented ID', () => {
    const entry = createChangeEntry('spec.md', 'modified', 'Added section 3', 'New requirement', 'T-001')
    expect(entry.id).toMatch(/^ACH-/)
    expect(entry.artifactType).toBe('spec')
    expect(entry.changeType).toBe('modified')
    expect(entry.summary).toBe('Added section 3')
    expect(entry.reason).toBe('New requirement')
    expect(entry.causedBy).toBe('T-001')
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('increments counter', () => {
    const e1 = createChangeEntry('spec.md', 'added', 's1', 'r1', 'T-1')
    const e2 = createChangeEntry('plan.md', 'modified', 's2', 'r2', 'T-2')
    expect(e1.id).toMatch(/^ACH-/)
    expect(e2.id).toMatch(/^ACH-/)
    expect(e1.id).not.toBe(e2.id)
  })

  it('defaults to spec when type unknown', () => {
    const entry = createChangeEntry('unknown-file.md', 'added', 's', 'r', 'T-1')
    expect(entry.artifactType).toBe('spec')
  })

  it('includes optional diff and impact', () => {
    const entry = createChangeEntry('spec.md', 'modified', 's', 'r', 'T-1', '- old\n+ new', ['plan.md'])
    expect(entry.diff).toBe('- old\n+ new')
    expect(entry.impact).toEqual(['plan.md'])
  })
})

describe('validateChangeEntry', () => {
  beforeEach(() => resetChangeCounter())

  it('validates a complete entry', () => {
    const entry = createChangeEntry('spec.md', 'modified', 's', 'Has reason', 'T-001')
    const result = validateChangeEntry(entry)
    expect(result.ok).toBe(true)
  })

  it('rejects entry without reason', () => {
    const entry = createChangeEntry('spec.md', 'modified', 's', '', 'T-001')
    const result = validateChangeEntry(entry)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('ARTIFACT_CHANGE_NO_REASON')
  })

  it('rejects entry without causedBy', () => {
    const entry = createChangeEntry('spec.md', 'modified', 's', 'reason', '')
    const result = validateChangeEntry(entry)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('ARTIFACT_CHANGE_NO_CAUSAL_TASK')
  })
})

describe('appendToChangelog', () => {
  let tempDir: string
  beforeEach(() => resetChangeCounter())
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('creates changelog file and appends entry', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-changelog-'))
    const entry = createChangeEntry('spec.md', 'added', 'Initial spec', 'Project kickoff', 'T-001')
    const result = await appendToChangelog(tempDir, entry)
    expect(result.ok).toBe(true)

    const content = await readFile(join(tempDir, '.buildpact', 'changelogs', 'spec.md'), 'utf-8')
    expect(content).toMatch(/ADDED \[ACH-/)
    expect(content).toContain('Initial spec')
    expect(content).toContain('Project kickoff')
    expect(content).toContain('T-001')
  })

  it('rejects invalid entry', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-changelog-'))
    const entry = createChangeEntry('spec.md', 'modified', 's', '', 'T-001')
    const result = await appendToChangelog(tempDir, entry)
    expect(result.ok).toBe(false)
  })
})

describe('formatChangeEntry', () => {
  beforeEach(() => resetChangeCounter())

  it('formats entry as single line', () => {
    const entry = createChangeEntry('spec.md', 'modified', 'Updated scope', 'Scope change', 'T-005')
    const formatted = formatChangeEntry(entry)
    expect(formatted).toMatch(/\[ACH-/)
    expect(formatted).toContain('spec:modified')
    expect(formatted).toContain('Updated scope')
  })
})
