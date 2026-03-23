/**
 * Hub Search & Discovery — unit tests
 * @see Epic 20.1, 20.2
 */

import { describe, it, expect } from 'vitest'
import {
  scoreToBadge,
  calculateQualityScore,
  computeRelevance,
  searchSquads,
  formatSearchResults,
  formatSquadDetail,
  fetchRegistryIndex,
  fetchSquadDetail,
} from '../../../src/engine/hub-search.js'
import type { HubSquadEntry, HubSquadDetail, QualityBreakdown } from '../../../src/engine/hub-search.js'
import type { SmokeTestReport } from '../../../src/engine/squad-smoke-test.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<HubSquadEntry> = {}): HubSquadEntry {
  return {
    name: 'test-squad',
    version: '1.0',
    domain: 'software',
    description: 'A test squad',
    author: 'tester',
    downloads: 100,
    qualityScore: 75,
    qualityBadge: 'Silver',
    reviewed: false,
    tags: ['testing', 'software'],
    ...overrides,
  }
}

function makeSmokeReport(overrides: Partial<SmokeTestReport> = {}): SmokeTestReport {
  return {
    squadName: 'test-squad',
    timestamp: '2026-01-01T00:00:00Z',
    checks: [
      { name: 'structure', status: 'pass', message: 'ok' },
      { name: 'agent-loading', status: 'pass', message: 'ok' },
      { name: 'voice-dna', status: 'pass', message: 'ok' },
      { name: 'autonomy', status: 'pass', message: 'ok' },
      { name: 'handoffs', status: 'pass', message: 'ok' },
    ],
    passed: true,
    summary: { total: 5, passed: 5, failed: 0, warned: 0 },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// scoreToBadge
// ---------------------------------------------------------------------------

describe('scoreToBadge', () => {
  it('returns Gold for 90+', () => {
    expect(scoreToBadge(90)).toBe('Gold')
    expect(scoreToBadge(100)).toBe('Gold')
  })

  it('returns Silver for 70-89', () => {
    expect(scoreToBadge(70)).toBe('Silver')
    expect(scoreToBadge(89)).toBe('Silver')
  })

  it('returns Bronze for 50-69', () => {
    expect(scoreToBadge(50)).toBe('Bronze')
    expect(scoreToBadge(69)).toBe('Bronze')
  })

  it('returns Unrated for below 50', () => {
    expect(scoreToBadge(49)).toBe('Unrated')
    expect(scoreToBadge(0)).toBe('Unrated')
  })
})

// ---------------------------------------------------------------------------
// calculateQualityScore
// ---------------------------------------------------------------------------

describe('calculateQualityScore', () => {
  it('calculates a perfect score when all checks pass', () => {
    const report = makeSmokeReport()
    const result = calculateQualityScore(report, {
      hasReadme: true,
      hasChangelog: true,
      hasExamples: true,
      testFixtureCount: 3,
      agentCount: 3,
    })

    expect(result.structuralCompleteness).toBe(100)
    expect(result.voiceDnaCompleteness).toBe(100)
    expect(result.smokeTestPassRate).toBe(100)
    expect(result.documentationCoverage).toBe(100)
    expect(result.testFixturePresence).toBe(100)
    expect(result.total).toBe(100)
  })

  it('scores zero for all failures', () => {
    const report = makeSmokeReport({
      checks: [
        { name: 'structure', status: 'fail', message: 'bad' },
        { name: 'voice-dna', status: 'fail', message: 'bad' },
      ],
      summary: { total: 2, passed: 0, failed: 2, warned: 0 },
    })
    const result = calculateQualityScore(report, {
      hasReadme: false,
      hasChangelog: false,
      hasExamples: false,
      testFixtureCount: 0,
      agentCount: 3,
    })

    expect(result.total).toBe(0)
  })

  it('calculates partial scores correctly', () => {
    const report = makeSmokeReport({
      checks: [
        { name: 'structure', status: 'pass', message: 'ok' },
        { name: 'voice-dna', status: 'fail', message: 'bad' },
        { name: 'autonomy', status: 'pass', message: 'ok' },
      ],
      summary: { total: 3, passed: 2, failed: 1, warned: 0 },
    })
    const result = calculateQualityScore(report, {
      hasReadme: true,
      hasChangelog: false,
      hasExamples: false,
      testFixtureCount: 1,
      agentCount: 2,
    })

    expect(result.structuralCompleteness).toBe(100)
    expect(result.voiceDnaCompleteness).toBe(0) // all voice checks failed
    expect(result.smokeTestPassRate).toBe(67)    // 2/3
    expect(result.documentationCoverage).toBe(50) // only README
    expect(result.testFixturePresence).toBe(50)   // 1/2
    expect(result.total).toBeGreaterThan(0)
    expect(result.total).toBeLessThan(100)
  })
})

// ---------------------------------------------------------------------------
// computeRelevance
// ---------------------------------------------------------------------------

describe('computeRelevance', () => {
  it('scores name matches highest', () => {
    const entry = makeEntry({ name: 'mobile-app' })
    expect(computeRelevance(entry, 'mobile')).toBeGreaterThanOrEqual(10)
  })

  it('scores description matches', () => {
    const entry = makeEntry({ description: 'A squad for mobile development' })
    expect(computeRelevance(entry, 'mobile')).toBeGreaterThanOrEqual(5)
  })

  it('scores domain matches', () => {
    const entry = makeEntry({ domain: 'healthcare' })
    expect(computeRelevance(entry, 'healthcare')).toBeGreaterThanOrEqual(8)
  })

  it('scores tag matches', () => {
    const entry = makeEntry({ tags: ['react', 'typescript'] })
    expect(computeRelevance(entry, 'react')).toBeGreaterThanOrEqual(6)
  })

  it('returns 0 for no match', () => {
    const entry = makeEntry()
    expect(computeRelevance(entry, 'zzz-nonexistent')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// searchSquads
// ---------------------------------------------------------------------------

describe('searchSquads', () => {
  const entries = [
    makeEntry({ name: 'healthcare-squad', domain: 'healthcare', downloads: 50 }),
    makeEntry({ name: 'software-dev', domain: 'software', downloads: 200 }),
    makeEntry({ name: 'mobile-app', domain: 'software', downloads: 150, tags: ['mobile'] }),
  ]

  it('filters by domain', () => {
    const results = searchSquads(entries, { domain: 'healthcare' })
    expect(results).toHaveLength(1)
    expect(results[0]!.name).toBe('healthcare-squad')
  })

  it('filters by query', () => {
    const results = searchSquads(entries, { query: 'mobile' })
    expect(results).toHaveLength(1)
    expect(results[0]!.name).toBe('mobile-app')
  })

  it('sorts by downloads', () => {
    const results = searchSquads(entries, { sort: 'downloads' })
    expect(results[0]!.name).toBe('software-dev')
    expect(results[2]!.name).toBe('healthcare-squad')
  })

  it('sorts by name', () => {
    const results = searchSquads(entries, { sort: 'name' })
    expect(results[0]!.name).toBe('healthcare-squad')
  })

  it('returns empty for no match', () => {
    const results = searchSquads(entries, { query: 'zzz-nonexistent' })
    expect(results).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// formatSearchResults
// ---------------------------------------------------------------------------

describe('formatSearchResults', () => {
  it('returns empty string for empty array', () => {
    expect(formatSearchResults([])).toBe('')
  })

  it('formats entries with metadata', () => {
    const output = formatSearchResults([makeEntry()])
    expect(output).toContain('test-squad')
    expect(output).toContain('v1.0')
    expect(output).toContain('Silver')
    expect(output).toContain('Author: tester')
  })
})

// ---------------------------------------------------------------------------
// formatSquadDetail
// ---------------------------------------------------------------------------

describe('formatSquadDetail', () => {
  it('formats a full detail card', () => {
    const detail: HubSquadDetail = {
      ...makeEntry(),
      agents: ['developer', 'architect'],
      installCommand: 'buildpact squad add test-squad',
      qualityBreakdown: {
        structuralCompleteness: 90,
        voiceDnaCompleteness: 80,
        smokeTestPassRate: 100,
        documentationCoverage: 75,
        testFixturePresence: 60,
        total: 83,
      },
    }
    const output = formatSquadDetail(detail)
    expect(output).toContain('test-squad v1.0')
    expect(output).toContain('developer, architect')
    expect(output).toContain('Quality Breakdown')
    expect(output).toContain('Structure:      90%')
    expect(output).toContain('buildpact squad add test-squad')
  })
})

// ---------------------------------------------------------------------------
// fetchRegistryIndex (with mock fetch)
// ---------------------------------------------------------------------------

describe('fetchRegistryIndex', () => {
  it('parses valid index', async () => {
    const mockFetch = async () => new Response(JSON.stringify([
      { name: 'squad-a', version: '1.0', domain: 'software', description: 'A', author: 'test', downloads: 10, qualityScore: 85, tags: ['tag1'] },
    ]), { status: 200 })

    const result = await fetchRegistryIndex('https://example.com', mockFetch as typeof fetch)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]!.name).toBe('squad-a')
      expect(result.value[0]!.qualityBadge).toBe('Silver')
    }
  })

  it('returns error on HTTP failure', async () => {
    const mockFetch = async () => new Response('', { status: 404 })
    const result = await fetchRegistryIndex('https://example.com', mockFetch as typeof fetch)
    expect(result.ok).toBe(false)
  })

  it('returns error on non-array response', async () => {
    const mockFetch = async () => new Response('{}', { status: 200 })
    const result = await fetchRegistryIndex('https://example.com', mockFetch as typeof fetch)
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// fetchSquadDetail (with mock fetch)
// ---------------------------------------------------------------------------

describe('fetchSquadDetail', () => {
  it('parses valid detail', async () => {
    const mockFetch = async () => new Response(JSON.stringify({
      name: 'test', version: '2.0', domain: 'health', description: 'desc',
      author: 'me', downloads: 50, qualityScore: 92, agents: ['doc', 'nurse'],
    }), { status: 200 })

    const result = await fetchSquadDetail('test', 'https://example.com', mockFetch as typeof fetch)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.qualityBadge).toBe('Gold')
      expect(result.value.agents).toEqual(['doc', 'nurse'])
    }
  })

  it('returns error when not found', async () => {
    const mockFetch = async () => new Response('', { status: 404 })
    const result = await fetchSquadDetail('missing', 'https://example.com', mockFetch as typeof fetch)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('HUB_SQUAD_NOT_FOUND')
    }
  })
})
