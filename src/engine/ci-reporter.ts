/**
 * CI Reporter for the BuildPact Community Hub.
 * Formats Squad validation results as GitHub Actions step summaries and
 * workflow annotations. Used by the automated CI workflow in the
 * buildpact-squads registry.
 *
 * @see US-049 (Epic 11.2: Squad Contribution Flow with Automated CI)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a single CI check (structural or security) */
export interface CiCheckResult {
  /** Human-readable check name, e.g. "structural-validation" */
  checkName: string
  /** True when there are zero errors */
  passed: boolean
  /** Raw error strings from validateSquadStructure / validateSquadSecurity */
  errors: string[]
  /** Actionable fix suggestion for each error (parallel array) */
  suggestions: string[]
}

/** GitHub Actions annotation for a single error */
export interface CiAnnotation {
  level: 'error' | 'warning'
  /** Short label shown in the annotation title */
  title: string
  /** Full message including suggestion */
  message: string
}

/** Aggregated CI report for a single Squad PR */
export interface CiSummaryReport {
  squadName: string
  allPassed: boolean
  checks: CiCheckResult[]
  /** Markdown for $GITHUB_STEP_SUMMARY */
  stepSummaryMarkdown: string
  /** GitHub Actions annotation lines (one per error) */
  annotations: CiAnnotation[]
}

// ---------------------------------------------------------------------------
// Suggestion mapping
// ---------------------------------------------------------------------------

/** Known fix patterns indexed by partial error substring (lowercase) */
const SUGGESTION_MAP: Array<{ match: string; fix: string }> = [
  { match: 'missing squad.yaml', fix: 'Create a squad.yaml file in the root of your squad directory with the required fields: name, version, domain, description, initial_level.' },
  { match: 'squad.yaml is missing required field', fix: 'Add the missing field to squad.yaml. Required fields: name, version, domain, description, initial_level.' },
  { match: 'missing agents/ directory', fix: 'Create an agents/ directory inside your squad directory and add at least one .md agent file.' },
  { match: 'no agent files found', fix: 'Add at least one .md agent definition file inside the agents/ directory.' },
  { match: 'missing layer "identity"', fix: 'Add an ## Identity section to the agent file describing what this agent does.' },
  { match: 'missing layer "persona"', fix: 'Add a ## Persona section defining the agent\'s character and communication style.' },
  { match: 'missing layer "voice dna"', fix: 'Add a ## Voice DNA section with all 5 sub-sections: Personality Anchors, Opinion Stance, Anti-Patterns, Never-Do Rules, Inspirational Anchors.' },
  { match: 'missing layer "heuristics"', fix: 'Add a ## Heuristics section with at least 3 IF/THEN rules and one VETO condition.' },
  { match: 'missing layer "examples"', fix: 'Add a ## Examples section with at least 3 concrete input/output pairs.' },
  { match: 'missing layer "handoffs"', fix: 'Add a ## Handoffs section listing which agents to route to and when.' },
  { match: 'voice dna missing section "personality anchors"', fix: 'Add a ### Personality Anchors sub-section inside ## Voice DNA.' },
  { match: 'voice dna missing section "opinion stance"', fix: 'Add a ### Opinion Stance sub-section inside ## Voice DNA.' },
  { match: 'voice dna missing section "anti-patterns"', fix: 'Add a ### Anti-Patterns sub-section inside ## Voice DNA.' },
  { match: 'voice dna missing section "never-do rules"', fix: 'Add a ### Never-Do Rules sub-section inside ## Voice DNA.' },
  { match: 'voice dna missing section "inspirational anchors"', fix: 'Add a ### Inspirational Anchors sub-section inside ## Voice DNA.' },
  { match: 'anti-patterns requires minimum 5', fix: 'Add more prohibited/required pairs to the Anti-Patterns section. Each pair should have a ✘ marker. Minimum 5 required.' },
  { match: 'examples requires minimum 3', fix: 'Add more numbered examples to the ## Examples section. Format: "1. **Input:** ... **Output:** ..." Minimum 3 required.' },
  { match: 'heuristics requires minimum 3', fix: 'Add more IF/THEN rules to ## Heuristics. Format: "1. When <condition> → <action>" Minimum 3 required.' },
  { match: 'heuristics requires at least one veto', fix: 'Add at least one VETO condition to ## Heuristics. Format: "VETO: <condition that blocks all action>".' },
  { match: 'external url', fix: 'Remove all external URLs from agent files. Squads must be self-contained and not reference external resources.' },
  { match: 'executable code', fix: 'Remove code blocks with executable content (shell, python, js, etc.) from agent files. Squads are prompt-only.' },
  { match: 'path traversal', fix: 'Remove path traversal sequences (../) from agent files to prevent directory escape attacks.' },
  { match: 'prompt injection', fix: 'Remove prompt injection patterns (ignore previous instructions, disregard, jailbreak) from agent files.' },
]

/**
 * Map a raw validation error string to a human-readable fix suggestion.
 * Falls back to a generic message when no specific pattern matches.
 */
export function mapErrorToSuggestion(error: string): string {
  const lower = error.toLowerCase()
  for (const entry of SUGGESTION_MAP) {
    if (lower.includes(entry.match)) return entry.fix
  }
  return 'Review the BuildPact Squad specification at https://github.com/buildpact/buildpact-squads/blob/main/CONTRIBUTING.md'
}

// ---------------------------------------------------------------------------
// Pure builders
// ---------------------------------------------------------------------------

/**
 * Build a CiCheckResult from a check name and its raw error list.
 */
export function buildCheckResult(checkName: string, errors: string[]): CiCheckResult {
  const suggestions = errors.map(mapErrorToSuggestion)
  return {
    checkName,
    passed: errors.length === 0,
    errors,
    suggestions,
  }
}

/**
 * Convert CiCheckResults into GitHub Actions annotation objects.
 * Each error becomes one annotation with its suggestion appended.
 */
export function buildCiAnnotations(checks: CiCheckResult[]): CiAnnotation[] {
  return checks.flatMap(check =>
    check.errors.map((error, i) => ({
      level: 'error' as const,
      title: check.checkName,
      message: `${error}\n\nSuggestion: ${check.suggestions[i] ?? mapErrorToSuggestion(error)}`,
    })),
  )
}

/**
 * Format a GitHub Step Summary markdown report for the given checks.
 * The summary includes a result table and per-check error detail sections.
 */
export function formatStepSummary(squadName: string, checks: CiCheckResult[]): string {
  const allPassed = checks.every(c => c.passed)
  const statusIcon = allPassed ? '✅' : '❌'
  const statusText = allPassed ? 'All checks passed' : 'One or more checks failed'

  const lines: string[] = [
    `# ${statusIcon} BuildPact Squad CI — \`${squadName}\``,
    '',
    `**${statusText}**`,
    '',
    '## Check Summary',
    '',
    '| Check | Result |',
    '|-------|--------|',
  ]

  for (const check of checks) {
    const icon = check.passed ? '✅ Pass' : '❌ Fail'
    lines.push(`| ${check.checkName} | ${icon} |`)
  }

  lines.push('')

  for (const check of checks) {
    if (check.passed) continue

    lines.push(`## ❌ ${check.checkName} — Errors & Fixes`)
    lines.push('')

    for (let i = 0; i < check.errors.length; i++) {
      const error = check.errors[i]!
      const suggestion = check.suggestions[i] ?? mapErrorToSuggestion(error)
      lines.push(`### Error ${i + 1}`)
      lines.push('')
      lines.push(`> ${error}`)
      lines.push('')
      lines.push(`**How to fix:** ${suggestion}`)
      lines.push('')
    }
  }

  if (allPassed) {
    lines.push('## 🎉 Next Steps')
    lines.push('')
    lines.push('Your Squad passed all checks. The maintainers will review and merge your PR.')
    lines.push('Once merged, your Squad will be available via:')
    lines.push('')
    lines.push('```bash')
    lines.push(`npx buildpact squad add ${squadName}`)
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format GitHub Actions annotation strings for stdout (one per line).
 * Consumers should print this to stdout in the CI workflow step.
 */
export function formatAnnotationsOutput(annotations: CiAnnotation[]): string {
  return annotations
    .map(a => `::${a.level} title=${a.title}::${a.message.replaceAll('\n', '%0A')}`)
    .join('\n')
}

/**
 * Build the complete CI summary report for a Squad PR.
 *
 * @param squadName - Name of the Squad being validated
 * @param structuralErrors - Errors from validateSquadStructure
 * @param securityErrors - Errors from validateSquadSecurity
 */
export function buildCiSummaryReport(
  squadName: string,
  structuralErrors: string[],
  securityErrors: string[],
): CiSummaryReport {
  const checks = [
    buildCheckResult('structural-validation', structuralErrors),
    buildCheckResult('security-validation', securityErrors),
  ]
  const allPassed = checks.every(c => c.passed)
  return {
    squadName,
    allPassed,
    checks,
    stepSummaryMarkdown: formatStepSummary(squadName, checks),
    annotations: buildCiAnnotations(checks),
  }
}
