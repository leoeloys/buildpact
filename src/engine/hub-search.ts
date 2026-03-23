/**
 * Hub Search & Discovery — search, filter, and score community squads.
 * Extends the Community Hub with search/filter/sort and quality scoring.
 * @see Epic 20.1: Hub Search & Discovery
 * @see Epic 20.2: Squad Quality Scores
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import { REGISTRY_BASE_URL, buildSquadFileUrl } from './community-hub.js'
import type { SmokeTestReport } from './squad-smoke-test.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A squad entry in the registry index with metadata */
export interface HubSquadEntry {
  name: string
  version: string
  domain: string
  description: string
  author: string
  downloads: number
  qualityScore: number
  qualityBadge: QualityBadge
  reviewed: boolean
  tags: string[]
}

/** Quality badge tiers */
export type QualityBadge = 'Gold' | 'Silver' | 'Bronze' | 'Unrated'

/** Search options for hub queries */
export interface HubSearchOptions {
  query?: string | undefined
  domain?: string | undefined
  sort?: 'relevance' | 'downloads' | 'quality' | 'name' | undefined
}

/** Detailed squad info for `hub info` */
export interface HubSquadDetail extends HubSquadEntry {
  agents: string[]
  installCommand: string
  qualityBreakdown: QualityBreakdown
}

/** Quality score breakdown by category */
export interface QualityBreakdown {
  structuralCompleteness: number   // 30%
  voiceDnaCompleteness: number     // 20%
  smokeTestPassRate: number        // 20%
  documentationCoverage: number    // 15%
  testFixturePresence: number      // 15%
  total: number
}

// ---------------------------------------------------------------------------
// Quality scoring
// ---------------------------------------------------------------------------

/** Map a score (0-100) to a badge tier */
export function scoreToBadge(score: number): QualityBadge {
  if (score >= 90) return 'Gold'
  if (score >= 70) return 'Silver'
  if (score >= 50) return 'Bronze'
  return 'Unrated'
}

/**
 * Calculate quality score for a squad based on smoke test results
 * and additional file checks.
 *
 * Weights:
 * - Structural completeness: 30%
 * - Voice DNA completeness: 20%
 * - Smoke test pass rate: 20%
 * - Documentation coverage: 15%
 * - Test fixture presence: 15%
 */
export function calculateQualityScore(report: SmokeTestReport, extras: {
  hasReadme: boolean
  hasChangelog: boolean
  hasExamples: boolean
  testFixtureCount: number
  agentCount: number
}): QualityBreakdown {
  // Structural: based on structure checks passing
  const structureChecks = report.checks.filter(c => c.name === 'structure')
  const structurePass = structureChecks.filter(c => c.status === 'pass').length
  const structureTotal = Math.max(structureChecks.length, 1)
  const structuralCompleteness = Math.round((structurePass / structureTotal) * 100)

  // Voice DNA: based on voice-dna checks
  const voiceChecks = report.checks.filter(c => c.name === 'voice-dna')
  const voicePass = voiceChecks.filter(c => c.status === 'pass').length
  const voiceTotal = Math.max(voiceChecks.length, 1)
  const voiceDnaCompleteness = Math.round((voicePass / voiceTotal) * 100)

  // Smoke test overall pass rate
  const smokeTestPassRate = report.summary.total > 0
    ? Math.round((report.summary.passed / report.summary.total) * 100)
    : 0

  // Documentation: README + changelog + examples
  let docScore = 0
  if (extras.hasReadme) docScore += 50
  if (extras.hasChangelog) docScore += 25
  if (extras.hasExamples) docScore += 25
  const documentationCoverage = docScore

  // Test fixtures: score based on having at least 1 per agent
  const fixtureRatio = extras.agentCount > 0
    ? Math.min(extras.testFixtureCount / extras.agentCount, 1)
    : 0
  const testFixturePresence = Math.round(fixtureRatio * 100)

  // Weighted total
  const total = Math.round(
    structuralCompleteness * 0.30 +
    voiceDnaCompleteness * 0.20 +
    smokeTestPassRate * 0.20 +
    documentationCoverage * 0.15 +
    testFixturePresence * 0.15,
  )

  return {
    structuralCompleteness,
    voiceDnaCompleteness,
    smokeTestPassRate,
    documentationCoverage,
    testFixturePresence,
    total,
  }
}

// ---------------------------------------------------------------------------
// Search functions
// ---------------------------------------------------------------------------

/**
 * Compute relevance score for a squad entry against a search query.
 * Simple substring matching with weighted fields.
 */
export function computeRelevance(entry: HubSquadEntry, query: string): number {
  const q = query.toLowerCase()
  let score = 0
  if (entry.name.toLowerCase().includes(q)) score += 10
  if (entry.description.toLowerCase().includes(q)) score += 5
  if (entry.domain.toLowerCase().includes(q)) score += 8
  for (const tag of entry.tags) {
    if (tag.toLowerCase().includes(q)) score += 6
  }
  return score
}

/**
 * Filter and sort hub entries by search options.
 */
export function searchSquads(
  entries: HubSquadEntry[],
  options: HubSearchOptions,
): HubSquadEntry[] {
  let results = [...entries]

  // Filter by domain
  if (options.domain) {
    const domain = options.domain.toLowerCase()
    results = results.filter(e => e.domain.toLowerCase() === domain)
  }

  // Filter by query (relevance > 0)
  if (options.query) {
    results = results.filter(e => computeRelevance(e, options.query!) > 0)
  }

  // Sort
  const sort = options.sort ?? (options.query ? 'relevance' : 'downloads')
  switch (sort) {
    case 'relevance':
      if (options.query) {
        results.sort((a, b) => computeRelevance(b, options.query!) - computeRelevance(a, options.query!))
      }
      break
    case 'downloads':
      results.sort((a, b) => b.downloads - a.downloads)
      break
    case 'quality':
      results.sort((a, b) => b.qualityScore - a.qualityScore)
      break
    case 'name':
      results.sort((a, b) => a.name.localeCompare(b.name))
      break
  }

  return results
}

// ---------------------------------------------------------------------------
// Registry index fetching
// ---------------------------------------------------------------------------

/**
 * Fetch the registry index listing all available squads.
 * The index is at REGISTRY_BASE_URL/index.json
 */
export async function fetchRegistryIndex(
  registryBase = REGISTRY_BASE_URL,
  fetchFn: typeof fetch = fetch,
): Promise<Result<HubSquadEntry[]>> {
  const url = `${registryBase}/index.json`
  try {
    const response = await fetchFn(url)
    if (!response.ok) {
      return err({
        code: ERROR_CODES.REMOTE_FETCH_FAILED,
        i18nKey: 'error.network.remote_fetch_failed',
        params: { url, reason: `HTTP ${response.status}` },
      })
    }
    const data = await response.json() as unknown
    if (!Array.isArray(data)) {
      return err({
        code: ERROR_CODES.REMOTE_FETCH_FAILED,
        i18nKey: 'error.network.remote_fetch_failed',
        params: { url, reason: 'index.json is not an array' },
      })
    }

    const entries: HubSquadEntry[] = (data as Record<string, unknown>[]).map(raw => ({
      name: String(raw['name'] ?? ''),
      version: String(raw['version'] ?? '1.0'),
      domain: String(raw['domain'] ?? 'custom'),
      description: String(raw['description'] ?? ''),
      author: String(raw['author'] ?? 'unknown'),
      downloads: Number(raw['downloads'] ?? 0),
      qualityScore: Number(raw['qualityScore'] ?? 0),
      qualityBadge: scoreToBadge(Number(raw['qualityScore'] ?? 0)),
      reviewed: raw['reviewed'] === true,
      tags: Array.isArray(raw['tags']) ? (raw['tags'] as unknown[]).map(String) : [],
    }))

    return ok(entries)
  } catch (cause) {
    return err({
      code: ERROR_CODES.REMOTE_FETCH_FAILED,
      i18nKey: 'error.network.remote_fetch_failed',
      params: { url, reason: cause instanceof Error ? cause.message : String(cause) },
      cause,
    })
  }
}

/**
 * Fetch detailed info for a specific squad from the registry.
 */
export async function fetchSquadDetail(
  squadName: string,
  registryBase = REGISTRY_BASE_URL,
  fetchFn: typeof fetch = fetch,
): Promise<Result<HubSquadDetail>> {
  const url = buildSquadFileUrl(registryBase, squadName, 'detail.json')
  try {
    const response = await fetchFn(url)
    if (!response.ok) {
      return err({
        code: ERROR_CODES.HUB_SQUAD_NOT_FOUND,
        i18nKey: 'error.hub.squad_not_found',
        params: { name: squadName },
      })
    }
    const raw = await response.json() as Record<string, unknown>
    const qualityScore = Number(raw['qualityScore'] ?? 0)
    const entry: HubSquadDetail = {
      name: String(raw['name'] ?? squadName),
      version: String(raw['version'] ?? '1.0'),
      domain: String(raw['domain'] ?? 'custom'),
      description: String(raw['description'] ?? ''),
      author: String(raw['author'] ?? 'unknown'),
      downloads: Number(raw['downloads'] ?? 0),
      qualityScore,
      qualityBadge: scoreToBadge(qualityScore),
      reviewed: raw['reviewed'] === true,
      tags: Array.isArray(raw['tags']) ? (raw['tags'] as unknown[]).map(String) : [],
      agents: Array.isArray(raw['agents']) ? (raw['agents'] as unknown[]).map(String) : [],
      installCommand: `buildpact squad add ${squadName}`,
      qualityBreakdown: (raw['qualityBreakdown'] as QualityBreakdown) ?? {
        structuralCompleteness: 0,
        voiceDnaCompleteness: 0,
        smokeTestPassRate: 0,
        documentationCoverage: 0,
        testFixturePresence: 0,
        total: qualityScore,
      },
    }
    return ok(entry)
  } catch (cause) {
    return err({
      code: ERROR_CODES.HUB_SQUAD_NOT_FOUND,
      i18nKey: 'error.hub.squad_not_found',
      params: { name: squadName },
      cause,
    })
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format search results as a human-readable table string.
 */
export function formatSearchResults(entries: HubSquadEntry[]): string {
  if (entries.length === 0) return ''

  const lines: string[] = []
  for (const e of entries) {
    const badge = e.qualityBadge === 'Unrated' ? '' : ` [${e.qualityBadge}]`
    const reviewed = e.reviewed ? ' (reviewed)' : ''
    lines.push(`  ${e.name}  v${e.version}  ${e.domain}${badge}${reviewed}`)
    lines.push(`    ${e.description}`)
    lines.push(`    Author: ${e.author} | Downloads: ${e.downloads} | Score: ${e.qualityScore}/100`)
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * Format detailed squad info as a card string.
 */
export function formatSquadDetail(detail: HubSquadDetail): string {
  const lines: string[] = [
    `${detail.name} v${detail.version}`,
    `${'─'.repeat(40)}`,
    `Domain:      ${detail.domain}`,
    `Author:      ${detail.author}`,
    `Downloads:   ${detail.downloads}`,
    `Quality:     ${detail.qualityScore}/100 (${detail.qualityBadge})`,
    `Reviewed:    ${detail.reviewed ? 'Yes' : 'No'}`,
    `Tags:        ${detail.tags.length > 0 ? detail.tags.join(', ') : 'none'}`,
    '',
    detail.description,
    '',
    `Agents: ${detail.agents.length > 0 ? detail.agents.join(', ') : 'unknown'}`,
    '',
    `Quality Breakdown:`,
    `  Structure:      ${detail.qualityBreakdown.structuralCompleteness}% (weight: 30%)`,
    `  Voice DNA:      ${detail.qualityBreakdown.voiceDnaCompleteness}% (weight: 20%)`,
    `  Smoke Tests:    ${detail.qualityBreakdown.smokeTestPassRate}% (weight: 20%)`,
    `  Documentation:  ${detail.qualityBreakdown.documentationCoverage}% (weight: 15%)`,
    `  Test Fixtures:  ${detail.qualityBreakdown.testFixturePresence}% (weight: 15%)`,
    '',
    `Install: ${detail.installCommand}`,
  ]
  return lines.join('\n')
}
