/**
 * @module engine/constitution-conflict-detector
 * @see Story 15.1 — Constitution Conflict Detection
 *
 * Detect contradictory rules and duplicates in a project constitution.
 * Pure function — no side effects, returns Result<ConstitutionConflict[]>.
 */

import { ok, type Result } from '../contracts/errors.js'
import { parseConstitutionPrinciples, PROHIBITION_KEYWORDS, extractProhibitedTerm } from '../foundation/constitution.js'
import type { ConstitutionPrinciple } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity of a constitution conflict */
export type ConflictSeverity = 'error' | 'warning'

/** A detected conflict between two constitution rules */
export interface ConstitutionConflict {
  /** Type of conflict */
  type: 'contradiction' | 'duplicate'
  /** Severity level */
  severity: ConflictSeverity
  /** First rule in the conflicting pair */
  ruleA: ConstitutionPrinciple & { line?: number }
  /** Second rule in the conflicting pair */
  ruleB: ConstitutionPrinciple & { line?: number }
  /** Human-readable explanation of the conflict */
  explanation: string
  /** Suggested resolution */
  suggestedAction: string
}

// ---------------------------------------------------------------------------
// Permission keywords — signal that a rule allows something
// ---------------------------------------------------------------------------

const PERMISSION_KEYWORDS = [
  'use ',
  'allow ',
  'always ',
  'must ',
  'should ',
  'prefer ',
  'enable ',
  'require ',
  'include ',
  'adopt ',
]

// ---------------------------------------------------------------------------
// Enhanced parser — adds line numbers to principles
// ---------------------------------------------------------------------------

/**
 * Parse constitution content into principles with line numbers.
 * Extends the base parseConstitutionPrinciples with line tracking.
 */
export function parseConstitutionWithLineNumbers(
  content: string,
): (ConstitutionPrinciple & { line: number })[] {
  const principles: (ConstitutionPrinciple & { line: number })[] = []
  let currentSection = ''
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!
    const line = raw.trim()

    if (line.startsWith('### ')) {
      currentSection = line.slice(4).trim()
      continue
    }
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const heading = line.slice(3).trim()
      if (heading === 'Version History' || heading === 'Immutable Principles') {
        currentSection = ''
      } else {
        currentSection = heading
      }
      continue
    }

    if (line.startsWith('- ') && currentSection) {
      const name = line.slice(2).trim()
      if (name) {
        principles.push({
          name,
          section: currentSection,
          content: name,
          line: i + 1, // 1-based line number
        })
      }
    }
  }

  return principles
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Normalize a rule string for comparison (lowercase, remove punctuation, collapse spaces) */
function normalizeRule(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Check if a rule is a prohibition rule */
function isProhibitionRule(rule: string): boolean {
  const lower = rule.toLowerCase()
  return PROHIBITION_KEYWORDS.some((kw) => lower.includes(kw))
}

/** Check if a rule is a permission/requirement rule */
function isPermissionRule(rule: string): boolean {
  const lower = rule.toLowerCase()
  return PERMISSION_KEYWORDS.some((kw) => lower.includes(kw))
}

/** Extract the subject term from a permission rule */
function extractPermittedTerm(rule: string): string | undefined {
  const lower = rule.toLowerCase()
  for (const kw of PERMISSION_KEYWORDS) {
    const idx = lower.indexOf(kw)
    if (idx !== -1) {
      const after = rule.slice(idx + kw.length).trim()
      const end = after.search(/[,;:.()\n]/)
      return end === -1 ? after : after.slice(0, end).trim()
    }
  }
  return undefined
}

/** Check if two terms overlap — significant words overlap (case-insensitive) */
function termsOverlap(termA: string, termB: string): boolean {
  const a = termA.toLowerCase().trim()
  const b = termB.toLowerCase().trim()
  if (a.length < 3 || b.length < 3) return false

  // Direct substring check
  if (a.includes(b) || b.includes(a)) return true

  // Word overlap — extract significant words (≥3 chars) and check overlap
  const stopWords = new Set(['the', 'for', 'and', 'use', 'with', 'from', 'that', 'this', 'are', 'was', 'not'])
  const wordsA = a.split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w))
  const wordsB = b.split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w))

  if (wordsA.length === 0 || wordsB.length === 0) return false

  const overlap = wordsA.filter((w) => wordsB.includes(w))
  // Require at least half of the shorter word list to overlap
  const minLen = Math.min(wordsA.length, wordsB.length)
  return overlap.length >= Math.ceil(minLen / 2) && overlap.length > 0
}

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

/**
 * Detect conflicts in constitution content.
 * Returns a list of contradiction and duplicate conflicts.
 */
export function detectConflicts(content: string): Result<ConstitutionConflict[]> {
  const principles = parseConstitutionWithLineNumbers(content)
  const conflicts: ConstitutionConflict[] = []

  // 1. Contradiction detection: prohibition vs permission
  for (let i = 0; i < principles.length; i++) {
    const ruleA = principles[i]!
    if (!isProhibitionRule(ruleA.content)) continue

    const prohibitedTerm = extractProhibitedTerm(ruleA.content)
    if (!prohibitedTerm || prohibitedTerm.length < 3) continue

    for (let j = 0; j < principles.length; j++) {
      if (i === j) continue
      const ruleB = principles[j]!
      if (!isPermissionRule(ruleB.content)) continue

      const permittedTerm = extractPermittedTerm(ruleB.content)
      if (!permittedTerm) continue

      if (termsOverlap(prohibitedTerm, permittedTerm)) {
        // Don't add duplicate conflict pairs
        const alreadyFound = conflicts.some(
          (c) =>
            c.type === 'contradiction' &&
            ((c.ruleA.line === ruleA.line && c.ruleB.line === ruleB.line) ||
              (c.ruleA.line === ruleB.line && c.ruleB.line === ruleA.line)),
        )
        if (!alreadyFound) {
          conflicts.push({
            type: 'contradiction',
            severity: 'error',
            ruleA,
            ruleB,
            explanation: `Rule "${ruleA.name}" (line ${ruleA.line}) prohibits "${prohibitedTerm}" but rule "${ruleB.name}" (line ${ruleB.line}) permits "${permittedTerm}"`,
            suggestedAction:
              'Clarify which rule takes precedence, or add a scope qualifier (e.g., "except for email templates")',
          })
        }
      }
    }
  }

  // 2. Duplicate detection: normalized string comparison
  for (let i = 0; i < principles.length; i++) {
    const ruleA = principles[i]!
    const normA = normalizeRule(ruleA.content)

    for (let j = i + 1; j < principles.length; j++) {
      const ruleB = principles[j]!
      const normB = normalizeRule(ruleB.content)

      if (normA === normB) {
        conflicts.push({
          type: 'duplicate',
          severity: 'warning',
          ruleA,
          ruleB,
          explanation: `Rule "${ruleA.name}" (line ${ruleA.line}, section "${ruleA.section}") is identical to rule "${ruleB.name}" (line ${ruleB.line}, section "${ruleB.section}")`,
          suggestedAction: 'Consolidate into a single rule in the most appropriate section',
        })
      }
    }
  }

  return ok(conflicts)
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

/**
 * Format a conflict report as markdown for writing to file.
 */
export function formatConflictReportMarkdown(conflicts: ConstitutionConflict[]): string {
  if (conflicts.length === 0) {
    return '# Constitution Conflict Report\n\nNo conflicts detected. Your constitution is clean.\n'
  }

  const lines: string[] = [
    '# Constitution Conflict Report',
    `> Generated: ${new Date().toISOString()}`,
    `> Total conflicts: ${conflicts.length}`,
    '',
  ]

  const contradictions = conflicts.filter((c) => c.type === 'contradiction')
  const duplicates = conflicts.filter((c) => c.type === 'duplicate')

  if (contradictions.length > 0) {
    lines.push('## Contradictions', '')
    for (const c of contradictions) {
      lines.push(`### [ERROR] Prohibition vs Permission Conflict`)
      lines.push(`- **Rule A** (line ${c.ruleA.line}, ${c.ruleA.section}): "${c.ruleA.name}"`)
      lines.push(`- **Rule B** (line ${c.ruleB.line}, ${c.ruleB.section}): "${c.ruleB.name}"`)
      lines.push(`- **Explanation**: ${c.explanation}`)
      lines.push(`- **Suggested Action**: ${c.suggestedAction}`)
      lines.push('')
    }
  }

  if (duplicates.length > 0) {
    lines.push('## Duplicates', '')
    for (const c of duplicates) {
      lines.push(`### [WARNING] Duplicate Rule`)
      lines.push(`- **Rule A** (line ${c.ruleA.line}, ${c.ruleA.section}): "${c.ruleA.name}"`)
      lines.push(`- **Rule B** (line ${c.ruleB.line}, ${c.ruleB.section}): "${c.ruleB.name}"`)
      lines.push(`- **Suggested Action**: ${c.suggestedAction}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
