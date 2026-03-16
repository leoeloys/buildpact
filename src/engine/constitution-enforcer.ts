/**
 * Constitution enforcement — validate output against project constitution rules.
 * Parses the constitution into named principles and flags explicit violations.
 * @module engine/constitution-enforcer
 * @see FR-203 — Auto Constitution Enforcement
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A named principle group extracted from the constitution */
export interface ConstitutionPrinciple {
  /** Section heading, e.g. "Coding Standards" or "Architectural Constraints" */
  name: string
  /** Individual rules extracted from the section (non-empty lines) */
  rules: string[]
}

/** A single detected violation of a constitution principle */
export interface PrincipleViolation {
  /** Name of the violated principle (section heading) */
  principle: string
  /** Full text of the specific rule that was violated */
  rule: string
  /** The token in the output that triggered the match (if detected) */
  trigger?: string
}

/** Result of validating output against constitution principles */
export interface ViolationReport {
  violations: PrincipleViolation[]
  hasViolations: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Keywords that signal a prohibition in a constitution rule.
 * Checked case-insensitively against the rule text.
 */
const PROHIBITION_KEYWORDS = [
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract text after a prohibition keyword in a rule */
function extractProhibitedTerm(rule: string): string | undefined {
  const lower = rule.toLowerCase()
  for (const kw of PROHIBITION_KEYWORDS) {
    const idx = lower.indexOf(kw)
    if (idx !== -1) {
      const after = rule.slice(idx + kw.length).trim()
      // Take up to the first punctuation or end of meaningful phrase
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract named principles from the constitution markdown content.
 * Sections are delimited by ## and ### headings.
 * Each section's non-empty, non-heading lines become its rule list.
 */
export function extractPrinciples(content: string): ConstitutionPrinciple[] {
  const principles: ConstitutionPrinciple[] = []
  const lines = content.split('\n')

  let currentName: string | null = null
  let currentRules: string[] = []

  const flush = () => {
    if (currentName !== null && currentRules.length > 0) {
      principles.push({ name: currentName, rules: currentRules })
    }
  }

  for (const raw of lines) {
    const line = raw.trim()

    // Detect headings (## or ###)
    if (line.startsWith('###')) {
      flush()
      currentName = line.replace(/^###\s*/, '').trim()
      currentRules = []
      continue
    }
    if (line.startsWith('##') && !line.startsWith('###')) {
      flush()
      // Exclude the Version History section — it's metadata, not a rule
      const heading = line.replace(/^##\s*/, '').trim()
      if (heading === 'Version History' || heading === 'Immutable Principles') {
        currentName = null
        currentRules = []
      } else {
        currentName = heading
        currentRules = []
      }
      continue
    }

    // Collect rules (skip blank lines and top-level h1)
    if (line && !line.startsWith('#') && currentName !== null) {
      // Strip list markers (- * •)
      const cleaned = line.replace(/^[-*•]\s*/, '').trim()
      if (cleaned) {
        currentRules.push(cleaned)
      }
    }
  }

  // Flush the last section
  flush()

  return principles
}

/**
 * Validate a text output against the given constitution principles.
 * Only prohibition-type rules are checked (rules containing "no X", "never X", etc.).
 * Returns a ViolationReport listing each detected violation with the principle name.
 */
export function validateOutput(
  output: string,
  principles: ConstitutionPrinciple[],
): ViolationReport {
  const violations: PrincipleViolation[] = []
  const lowerOutput = output.toLowerCase()

  for (const principle of principles) {
    for (const rule of principle.rules) {
      if (!isProhibitionRule(rule)) continue

      const prohibited = extractProhibitedTerm(rule)
      if (!prohibited) continue

      const lowerProhibited = prohibited.toLowerCase()
      if (lowerProhibited.length < 3) continue // too short to match meaningfully

      if (lowerOutput.includes(lowerProhibited)) {
        violations.push({
          principle: principle.name,
          rule,
          trigger: prohibited,
        })
      }
    }
  }

  return { violations, hasViolations: violations.length > 0 }
}

/**
 * Format a single violation as a human-readable warning string.
 * @param violation - The detected violation
 * @param beginnerMode - When true, uses plain language without technical jargon
 */
export function formatViolationWarning(
  violation: PrincipleViolation,
  beginnerMode: boolean,
): string {
  if (beginnerMode) {
    return (
      `Warning: The output doesn't follow a rule in "${violation.principle}": ` +
      `"${violation.rule}". Please review the output before accepting it.`
    )
  }

  return (
    `Constitution violation [${violation.principle}]: "${violation.rule}"` +
    (violation.trigger ? ` — trigger: "${violation.trigger}"` : '')
  )
}

/**
 * Build the constitution context path for injection into subagent payloads.
 * Returns the resolved absolute path to constitution.md, or undefined if it does not exist.
 */
export async function resolveConstitutionPath(projectDir: string): Promise<string | undefined> {
  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const constitutionPath = join(projectDir, '.buildpact', 'constitution.md')
  try {
    await readFile(constitutionPath, 'utf-8')
    return constitutionPath
  } catch {
    return undefined
  }
}
