/**
 * Distillator — lossless document compression for LLM consumption.
 * NOT summarization (lossy). Every fact, decision, and constraint survives.
 *
 * Rules: STRIP filler/hedging → PRESERVE numbers/entities/decisions → TRANSFORM verbose→compressed
 *
 * @module engine/distillator
 * @see Concept 10.1 (BMAD distillator)
 */

import { readFile } from 'node:fs/promises'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { DistillateConfig, DistillateResult, CompressionRule } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Rough token estimate: ~4 chars per token for English text.
 */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4)
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Extract all markdown headings (## and ###) from content.
 */
export function extractHeadings(content: string): string[] {
  const headings: string[] = []
  for (const line of content.split('\n')) {
    const match = line.match(/^#{2,3}\s+(.+)/)
    if (match) headings.push(match[1]!.trim())
  }
  return headings
}

/**
 * Extract named entities: capitalized multi-word terms, tech names, version numbers.
 * Simple heuristic — catches "BuildPact", "TypeScript", "v2.3.1", "FR-201", etc.
 */
export function extractNamedEntities(content: string): string[] {
  const entities = new Set<string>()

  // Capitalized multi-word terms (e.g. "Build Pact", "Visual Studio Code")
  const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g
  for (const match of content.matchAll(capitalizedPattern)) {
    entities.add(match[0])
  }

  // PascalCase/camelCase tech terms (e.g. "TypeScript", "buildpact")
  const pascalPattern = /\b[A-Z][a-z]+[A-Z]\w+\b/g
  for (const match of content.matchAll(pascalPattern)) {
    entities.add(match[0])
  }

  // Version numbers (e.g. "v2.3.1", "1.0.0")
  const versionPattern = /\bv?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?\b/g
  for (const match of content.matchAll(versionPattern)) {
    entities.add(match[0])
  }

  // Identifiers with hyphens/prefixes (e.g. "FR-201", "CLR-001", "US-056")
  const idPattern = /\b[A-Z]{2,}-\d+\b/g
  for (const match of content.matchAll(idPattern)) {
    entities.add(match[0])
  }

  return Array.from(entities).sort()
}

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

/**
 * Apply a single compression rule to content.
 */
export function applyRule(content: string, rule: CompressionRule): string {
  try {
    const regex = new RegExp(rule.pattern, 'gi')
    switch (rule.action) {
      case 'strip':
        return content.replace(regex, '')
      case 'transform':
        return content.replace(regex, rule.replacement ?? '')
      case 'preserve':
        return content // preserve = no-op (marker for validation)
    }
  } catch {
    return content // Invalid regex — skip silently
  }
}

/**
 * Apply all compression rules in order.
 * Strip rules first, then transform. Preserve rules are no-ops.
 */
export function applyCompressionRules(content: string, rules: CompressionRule[]): string {
  let result = content

  // Apply strip rules first
  for (const rule of rules.filter(r => r.action === 'strip')) {
    result = applyRule(result, rule)
  }

  // Then transform rules
  for (const rule of rules.filter(r => r.action === 'transform')) {
    result = applyRule(result, rule)
  }

  // Clean up: collapse multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n')

  // Clean up: trim trailing whitespace on lines
  result = result.split('\n').map(line => line.trimEnd()).join('\n')

  return result.trim()
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Check if a heading survives in the distilled content.
 * Uses fuzzy matching: if >70% of words in the heading appear in the distilled text,
 * it's considered present (handles minor rephrasing during compression).
 */
export function headingSurvives(heading: string, distilledLower: string): boolean {
  // Exact match (case-insensitive)
  if (distilledLower.includes(heading.toLowerCase())) return true

  // Fuzzy: check if majority of significant words survive
  const words = heading.toLowerCase().split(/\s+/).filter(w => w.length >= 3)
  if (words.length === 0) return true // trivial heading
  const found = words.filter(w => distilledLower.includes(w))
  return found.length / words.length >= 0.7
}

/**
 * Round-trip validation: verify that headings and entities from the original
 * survive in the distilled version.
 * Headings use fuzzy matching (70% word overlap).
 * Entities use exact match (identifiers, version numbers must be exact).
 */
export function validateRoundTrip(
  originalHeadings: string[],
  originalEntities: string[],
  distilled: string,
): Result<void> {
  const distilledLower = distilled.toLowerCase()

  const missingHeadings = originalHeadings.filter(h => !headingSurvives(h, distilledLower))
  // Entities: exact match — identifiers like FR-201 and versions like v2.3.1 must be exact
  const missingEntities = originalEntities.filter(e => !distilled.includes(e))

  if (missingHeadings.length > 0 || missingEntities.length > 0) {
    const details: string[] = []
    if (missingHeadings.length > 0) details.push(`headings: ${missingHeadings.join(', ')}`)
    if (missingEntities.length > 0) details.push(`entities: ${missingEntities.join(', ')}`)

    return err({
      code: ERROR_CODES.DISTILLATE_ROUND_TRIP_FAILED,
      i18nKey: 'error.distillate.round_trip_failed',
      params: { missing: details.join('; ') },
    })
  }

  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Distill source documents using compression rules.
 * Reads sources, applies rules, optionally validates round-trip.
 */
export async function distill(
  config: DistillateConfig,
  rules: CompressionRule[],
): Promise<Result<DistillateResult>> {
  // Read and concatenate sources, tracking skipped files
  let combined = ''
  const skippedFiles: string[] = []
  for (const path of config.sourcePaths) {
    try {
      const content = await readFile(path, 'utf-8')
      combined += content + '\n\n'
    } catch {
      skippedFiles.push(path)
    }
  }

  combined = combined.trim()
  if (combined === '') {
    return err({
      code: ERROR_CODES.DISTILLATE_ZERO_CONTENT,
      i18nKey: 'error.distillate.zero_content',
      params: { paths: config.sourcePaths.join(', ') },
    })
  }

  // Extract before compression (for validation)
  const originalHeadings = extractHeadings(combined)
  const originalEntities = extractNamedEntities(combined)
  const originalTokens = estimateTokens(combined)

  // Apply compression
  let distilled = applyCompressionRules(combined, rules)

  // Add downstream consumer header if specified
  if (config.downstreamConsumer) {
    distilled = `> Distilled for: ${config.downstreamConsumer}\n\n${distilled}`
  }

  const distilledTokens = estimateTokens(distilled)

  // Validate round-trip if requested
  if (config.validate) {
    const validation = validateRoundTrip(originalHeadings, originalEntities, distilled)
    if (!validation.ok) return validation as Result<never>
  }

  return ok({
    content: distilled,
    sourceHeadings: originalHeadings,
    namedEntities: originalEntities,
    tokenEstimate: distilledTokens,
    compressionRatio: originalTokens > 0 ? distilledTokens / originalTokens : 1,
  })
}
