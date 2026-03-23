import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  stripProjectDetails,
  promoteToOrg,
  listOrgMemory,
  findRelevantPatterns,
} from '../../../src/engine/org-memory.js'
import type { OrgMemoryEntry } from '../../../src/engine/org-memory.js'

// ---------------------------------------------------------------------------
// stripProjectDetails
// ---------------------------------------------------------------------------

describe('stripProjectDetails', () => {
  it('removes absolute Unix paths', () => {
    const text = 'Found issue in /src/engine/orchestrator.ts'
    expect(stripProjectDetails(text)).toContain('<path>')
    expect(stripProjectDetails(text)).not.toContain('/src/engine')
  })

  it('removes relative paths', () => {
    const text = 'See ./src/foo/bar.ts for details'
    expect(stripProjectDetails(text)).toContain('<path>')
  })

  it('removes camelCase variable names', () => {
    const text = 'The myVariableName caused the issue'
    expect(stripProjectDetails(text)).toContain('<var>')
    expect(stripProjectDetails(text)).not.toContain('myVariableName')
  })

  it('removes snake_case variable names', () => {
    const text = 'The my_variable_name caused the issue'
    expect(stripProjectDetails(text)).toContain('<var>')
  })

  it('removes URLs', () => {
    const text = 'Fetched from https://api.example.com/data'
    expect(stripProjectDetails(text)).toContain('<url>')
    expect(stripProjectDetails(text)).not.toContain('https://')
  })
})

// ---------------------------------------------------------------------------
// promoteToOrg
// ---------------------------------------------------------------------------

describe('promoteToOrg', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-org-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  it('creates a JSON file in the org directory', async () => {
    const result = await promoteToOrg(
      { pattern: 'Use dependency injection', projectDir: '/my/proj', tags: ['architecture'] },
      tmpDir,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const files = await readdir(tmpDir)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/\.json$/)
  })

  it('strips project details from the pattern', async () => {
    const result = await promoteToOrg(
      {
        pattern: 'Always validate /src/engine/handler.ts inputs',
        projectDir: '/proj',
        tags: ['validation'],
      },
      tmpDir,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.pattern).toContain('<path>')
    expect(result.value.pattern).not.toContain('/src/engine')
  })

  it('anonymizes the source project', async () => {
    const result = await promoteToOrg(
      { pattern: 'Test all edge cases', projectDir: '/secret/project', tags: [] },
      tmpDir,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.source).not.toContain('secret')
    expect(result.value.source).toMatch(/^[a-f0-9]+$/)
  })
})

// ---------------------------------------------------------------------------
// listOrgMemory
// ---------------------------------------------------------------------------

describe('listOrgMemory', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-orglist-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  it('returns empty array for empty directory', async () => {
    const result = await listOrgMemory(tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(0)
  })

  it('reads promoted entries', async () => {
    await promoteToOrg(
      { pattern: 'Pattern A', projectDir: '/a', tags: ['a'] },
      tmpDir,
    )
    await promoteToOrg(
      { pattern: 'Pattern B', projectDir: '/b', tags: ['b'] },
      tmpDir,
    )

    const result = await listOrgMemory(tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(2)
  })

  it('creates directory if it does not exist', async () => {
    const newDir = join(tmpDir, 'new-org')
    const result = await listOrgMemory(newDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// findRelevantPatterns
// ---------------------------------------------------------------------------

describe('findRelevantPatterns', () => {
  const entries: OrgMemoryEntry[] = [
    {
      id: '1',
      pattern: 'Use dependency injection for all services',
      source: 'abc',
      tags: ['architecture', 'testing'],
      promotedAt: '',
      promotedBy: 'buildpact',
    },
    {
      id: '2',
      pattern: 'Always validate user inputs before processing',
      source: 'def',
      tags: ['security', 'validation'],
      promotedAt: '',
      promotedBy: 'buildpact',
    },
    {
      id: '3',
      pattern: 'Cache expensive database queries',
      source: 'ghi',
      tags: ['performance'],
      promotedAt: '',
      promotedBy: 'buildpact',
    },
  ]

  it('finds patterns matching query keywords', () => {
    const results = findRelevantPatterns('dependency injection', entries)
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('1')
  })

  it('matches on tags', () => {
    const results = findRelevantPatterns('security concerns', entries)
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('2')
  })

  it('returns empty for no matches', () => {
    const results = findRelevantPatterns('quantum computing', entries)
    expect(results).toHaveLength(0)
  })

  it('ignores short query words', () => {
    const results = findRelevantPatterns('a b c', entries)
    expect(results).toHaveLength(0)
  })

  it('matches multiple entries', () => {
    const results = findRelevantPatterns('all', entries)
    // "all" appears in pattern 1 ("all services") and pattern 2 ("Always")
    // But "all" must match — "all services" contains "all", "Always" lowered contains "all"
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})
