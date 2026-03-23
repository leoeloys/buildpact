/**
 * Centralized Constitution Management — supports org-level constitutions
 * that cascade down to project-level with conflict detection.
 * Org constitutions live in `.buildpact-org/constitution.md` in any ancestor directory.
 * @see Epic 24.2: Centralized Constitution Management
 */

import { readFile } from 'node:fs/promises'
import { join, dirname, parse } from 'node:path'
import { ok, err } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_DIR = '.buildpact-org'
const CONSTITUTION_FILE = 'constitution.md'

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Search upward from startDir for `.buildpact-org/constitution.md`.
 * Returns the file contents if found, null if not.
 */
export async function loadOrgConstitution(startDir: string): Promise<Result<string | null>> {
  let dir = startDir

  // Walk upward until we reach the filesystem root
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = join(dir, ORG_DIR, CONSTITUTION_FILE)
    try {
      const content = await readFile(candidate, 'utf-8')
      return ok(content)
    } catch {
      // Not found at this level — continue upward
    }

    const parent = dirname(dir)
    if (parent === dir) break // reached root
    dir = parent
  }

  return ok(null)
}

/**
 * Merge org-level and project-level constitutions.
 * Org rules take precedence: they appear first and conflicting project rules
 * are annotated with a warning comment.
 */
export function mergeConstitutions(orgRules: string, projectRules: string): string {
  const conflicts = detectConflicts(orgRules, projectRules)
  const conflictSet = new Set(conflicts)

  const orgSection = orgRules.trim()
  const projectLines = projectRules.trim().split('\n')

  // Filter project lines, commenting out conflicting ones
  const filteredProject = projectLines.map(line => {
    const trimmed = line.trim()
    if (conflictSet.has(trimmed)) {
      return `<!-- OVERRIDDEN BY ORG --> ${line}`
    }
    return line
  }).join('\n')

  const parts = [
    '<!-- Organization Constitution (takes precedence) -->',
    orgSection,
    '',
    '<!-- Project Constitution -->',
    filteredProject,
  ]

  return parts.join('\n')
}

/**
 * Detect conflicts between org-level and project-level constitutions.
 * A conflict occurs when the project constitution contains a rule that
 * contradicts an org rule. Detection is based on matching rule identifiers
 * (lines starting with `- ` or numbered items) that share the same prefix
 * but differ in content.
 */
export function detectConflicts(orgRules: string, projectRules: string): string[] {
  const orgParsed = extractRules(orgRules)
  const projectParsed = extractRules(projectRules)
  const conflicts: string[] = []

  for (const [id, orgText] of orgParsed) {
    const projectText = projectParsed.get(id)
    if (projectText && projectText !== orgText) {
      conflicts.push(projectText)
    }
  }

  return conflicts
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract rules as Map<ruleId, fullLine> from constitution markdown.
 * Rule ID is the first significant word after a list marker.
 */
function extractRules(content: string): Map<string, string> {
  const rules = new Map<string, string>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // Match list items: "- Rule text" or "1. Rule text" or "* Rule text"
    const match = trimmed.match(/^(?:[-*]|\d+\.)\s+(.+)$/)
    if (match && match[1]) {
      // Use first two words as the rule identifier for matching
      const words = match[1].split(/\s+/)
      const id = words.slice(0, 3).join(' ').toLowerCase()
      rules.set(id, trimmed)
    }
  }

  return rules
}
