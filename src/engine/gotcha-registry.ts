/**
 * Gotcha Registry — explicit trap tracking and context injection.
 * Known pitfalls that "look right but aren't" are registered, matched by file path,
 * and formatted as warnings for agent context.
 * @module engine/gotcha-registry
 * @see BuildPact concept 8.5
 */

import type { Gotcha } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/** Generate a unique gotcha ID using timestamp + random suffix */
function generateGotchaId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `GOT-${ts}-${rand}`
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/**
 * Create a new gotcha entry with auto-generated ID.
 */
export function createGotcha(
  trigger: string,
  consequence: string,
  workaround: string,
  discoveredIn: string,
  affectedFiles: string[],
  severity: Gotcha['severity'],
): Gotcha {
  return {
    id: generateGotchaId(),
    trigger,
    consequence,
    workaround,
    discoveredIn,
    affectedFiles,
    severity,
  }
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Find all gotchas that affect a given file path.
 * Matches if any entry in affectedFiles is a substring of filePath or vice versa.
 */
export function matchGotchas(gotchas: readonly Gotcha[], filePath: string): Gotcha[] {
  return gotchas.filter(g =>
    g.affectedFiles.some(af =>
      filePath.includes(af) || af.includes(filePath),
    ),
  )
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a single gotcha as a warning string.
 */
export function formatGotchaWarning(gotcha: Gotcha): string {
  const icon = gotcha.severity === 'critical' ? 'CRITICAL' : 'WARNING'
  return [
    `[${icon}] ${gotcha.id}: ${gotcha.trigger}`,
    `  Consequence: ${gotcha.consequence}`,
    `  Workaround: ${gotcha.workaround}`,
    `  Discovered in: ${gotcha.discoveredIn}`,
    `  Affected files: ${gotcha.affectedFiles.join(', ')}`,
  ].join('\n')
}

/**
 * Format multiple gotchas for injection into agent context.
 */
export function formatGotchasForContext(gotchas: readonly Gotcha[]): string {
  if (gotchas.length === 0) return ''

  const header = `## Known Gotchas (${gotchas.length})\n`
  const body = gotchas.map(g => formatGotchaWarning(g)).join('\n\n')
  return header + '\n' + body
}
