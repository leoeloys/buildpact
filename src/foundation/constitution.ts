/**
 * @module foundation/constitution
 * @see FR-201, FR-202
 *
 * Read/write the project constitution file at .buildpact/constitution.md.
 * Parse constitution into named principles and enforce against pipeline output.
 */

import { readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'
import type {
  ConstitutionPrinciple,
  ConstitutionViolation,
  EnforcementResult,
} from '../contracts/task.js'
import type { I18nResolver } from '../contracts/i18n.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONSTITUTION_FILE = join('.buildpact', 'constitution.md')

/**
 * Keywords that signal a prohibition in a constitution rule.
 * Checked case-insensitively against the rule text.
 */
export const PROHIBITION_KEYWORDS = [
  'no ',
  'never ',
  'must not ',
  'do not ',
  "don't ",
  'prohibited',
  'forbidden',
  'disallowed',
  'avoid ',
  'ban ',
  'cannot ',
  "can't ",
]

/** Keywords that signal an explicit override attempt in output */
const OVERRIDE_KEYWORDS = ['override', 'ignore', 'bypass', 'disable', 'skip']

/** Write-API patterns that indicate file mutation */
const WRITE_PATTERNS = ['writefile', 'appendfile', 'overwrite', 'replacefile', 'writefilesync']

/** Verbs that indicate file modification intent */
const MODIFY_VERBS = ['modify', 'update', 'edit', 'change', 'rewrite', 'delete', 'remove']

// ---------------------------------------------------------------------------
// File I/O (existing from Story 2.1)
// ---------------------------------------------------------------------------

/**
 * Reads .buildpact/constitution.md and returns its content.
 * Returns CONSTITUTION_NOT_FOUND if file doesn't exist.
 */
export async function loadConstitution(projectDir: string): Promise<Result<string>> {
  const path = join(projectDir, CONSTITUTION_FILE)
  try {
    const content = await readFile(path, 'utf-8')
    return ok(content)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return err({ code: ERROR_CODES.CONSTITUTION_NOT_FOUND, i18nKey: 'error.constitution.not_found' })
    }
    return err({ code: ERROR_CODES.FILE_READ_FAILED, i18nKey: 'error.file.read_failed', cause })
  }
}

/**
 * Writes content to .buildpact/constitution.md.
 * Returns CONSTITUTION_EMPTY if content is blank.
 * Returns FILE_WRITE_FAILED on I/O errors.
 */
export async function saveConstitution(projectDir: string, content: string): Promise<Result<void>> {
  if (content.trim() === '') {
    return err({ code: ERROR_CODES.CONSTITUTION_EMPTY, i18nKey: 'error.constitution.empty' })
  }
  const path = join(projectDir, CONSTITUTION_FILE)
  try {
    await writeFile(path, content, 'utf-8')
    return ok(undefined)
  } catch (cause) {
    return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.file.write_failed', cause })
  }
}

/**
 * Returns true if .buildpact/constitution.md exists.
 * Used by the command handler to determine create vs edit mode.
 */
export async function constitutionExists(projectDir: string): Promise<boolean> {
  const path = join(projectDir, CONSTITUTION_FILE)
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve the absolute path to constitution.md if it exists, or undefined.
 * Used by command handlers to set constitutionPath in task payloads.
 */
export async function resolveConstitutionPath(projectDir: string): Promise<string | undefined> {
  const path = join(projectDir, CONSTITUTION_FILE)
  try {
    await access(path)
    return path
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Enforcement helpers (private)
// ---------------------------------------------------------------------------

/** Extract text after a prohibition keyword in a rule */
export function extractProhibitedTerm(rule: string): string | undefined {
  const lower = rule.toLowerCase()
  for (const kw of PROHIBITION_KEYWORDS) {
    const idx = lower.indexOf(kw)
    if (idx !== -1) {
      const after = rule.slice(idx + kw.length).trim()
      const end = after.search(/[,;:.()\n]/)
      return end === -1 ? after : after.slice(0, end).trim()
    }
  }
  return undefined
}

/** Determine whether a rule is a prohibition rule */
function isProhibitionRule(rule: string): boolean {
  const lower = rule.toLowerCase()
  return PROHIBITION_KEYWORDS.some((kw) => lower.includes(kw))
}

// ---------------------------------------------------------------------------
// Enforcement public API (Story 2.2)
// ---------------------------------------------------------------------------

/**
 * Parse the constitution markdown into named principles.
 * Each rule under a ### or ## section heading becomes a separate ConstitutionPrinciple.
 * Excludes Version History and the Immutable Principles parent heading.
 */
export function parseConstitutionPrinciples(content: string): ConstitutionPrinciple[] {
  const principles: ConstitutionPrinciple[] = []
  let currentSection = ''

  for (const raw of content.split('\n')) {
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

    // Collect rules (skip blank lines and h1)
    if (line.startsWith('- ') && currentSection) {
      const name = line.slice(2).trim()
      if (name) {
        principles.push({ name, section: currentSection, content: name })
      }
    }
  }

  return principles
}

/**
 * Detect if an output string attempts to modify the constitution file.
 * Checks for write/modify patterns targeting constitution.md.
 * Used as a pre-write guard — triggers user consent before any pipeline write.
 */
export function checkModificationAttempt(output: string): boolean {
  const lower = output.toLowerCase()
  const CONSTITUTION_MARKER = 'constitution'

  // Direct path reference to the constitution file in a write context
  if (lower.includes('.buildpact/constitution.md')) {
    const hasWriteContext = [...WRITE_PATTERNS, ...MODIFY_VERBS].some((v) => lower.includes(v))
    if (hasWriteContext) return true
  }

  // Write API call targeting constitution
  for (const pattern of WRITE_PATTERNS) {
    if (lower.includes(pattern) && lower.includes(CONSTITUTION_MARKER)) return true
  }

  return false
}

/**
 * Validate output against the constitution, returning an EnforcementResult.
 * Alpha scope: structural pattern matching only (prohibition rules + override language).
 *
 * @param output - The AI-generated output text to validate
 * @param constitutionContent - Raw markdown content of the constitution
 */
export function enforceConstitution(output: string, constitutionContent: string): EnforcementResult {
  // TODO(Beta): Replace structural check with LLM subagent semantic validation.
  // Subagent call: validate `output` against each principle in `principles` semantically.
  // For now, structural pattern matching only.

  const principles = parseConstitutionPrinciples(constitutionContent)
  const violations: ConstitutionViolation[] = []
  const lowerOutput = output.toLowerCase()

  // Check prohibition rules
  for (const principle of principles) {
    if (!isProhibitionRule(principle.content)) continue

    const prohibited = extractProhibitedTerm(principle.content)
    if (!prohibited || prohibited.length < 3) continue

    if (lowerOutput.includes(prohibited.toLowerCase())) {
      violations.push({
        principle,
        explanation: `Output contains prohibited term "${prohibited}" from rule "${principle.name}" in section "${principle.section}"`,
        severity: 'warn',
      })
    }
  }

  // Check override language targeting known principles
  for (const principle of principles) {
    const principleWords = principle.name.toLowerCase().split(/\s+/)
    for (const overrideKw of OVERRIDE_KEYWORDS) {
      const idx = lowerOutput.indexOf(overrideKw)
      if (idx === -1) continue
      // Check if any principle keyword follows the override keyword within a proximity window
      const OVERRIDE_PROXIMITY_CHARS = 50
      const nearby = lowerOutput.slice(idx, idx + overrideKw.length + OVERRIDE_PROXIMITY_CHARS)
      const hasMatchingPrinciple = principleWords.some(
        (pw) => pw.length >= 4 && nearby.includes(pw),
      )
      if (hasMatchingPrinciple) {
        violations.push({
          principle,
          explanation: `Output uses override language "${overrideKw}" near principle "${principle.name}"`,
          severity: 'warn',
        })
        break // one violation per principle for override detection
      }
    }
  }

  return { violations, hasViolations: violations.length > 0 }
}

/**
 * Format a single violation as a human-readable warning string.
 * Uses i18n keys when resolver is provided; falls back to English when omitted (tests).
 * @param violation - The detected violation
 * @param beginnerMode - When true, uses plain language without technical jargon
 * @param i18n - Optional i18n resolver for localized output
 */
export function formatViolationWarning(
  violation: ConstitutionViolation,
  beginnerMode: boolean,
  i18n?: I18nResolver,
): string {
  if (i18n) {
    if (beginnerMode) {
      return [
        i18n.t('cli.constitution.violation.title_beginner'),
        i18n.t('cli.constitution.violation.explanation_beginner', { principle_simple: violation.principle.name }),
        i18n.t('cli.constitution.violation.action_beginner'),
      ].join('\n')
    }
    return [
      i18n.t('cli.constitution.violation.title_expert', { principle: violation.principle.name }),
      i18n.t('cli.constitution.violation.explanation_expert', { principle: violation.principle.name, section: violation.principle.section }),
      i18n.t('cli.constitution.violation.action_expert'),
    ].join('\n')
  }

  // Fallback (no i18n) — used in tests and edge cases
  if (beginnerMode) {
    return (
      `Warning: The output doesn't follow a rule in "${violation.principle.name}": ` +
      `"${violation.principle.content}". Please review the output before accepting it.`
    )
  }
  return (
    `Constitution violation [${violation.principle.name}]: "${violation.principle.content}"` +
    (violation.explanation ? ` — ${violation.explanation}` : '')
  )
}
