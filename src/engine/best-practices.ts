// Best Practices Injection — auto-inject domain best practices into agent context
// Inspired by OpenSquad's best-practices catalog

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'

/** Map of squad domain to relevant best practice file slugs */
const DOMAIN_PRACTICES: Record<string, string[]> = {
  software: ['software-testing', 'api-design', 'database-schema', 'security-review', 'code-review', 'architecture-patterns'],
  medical: ['security-review'],  // LGPD/HIPAA security is relevant
  research: [],                   // research domain has its own PRISMA/CONSORT in squad
  management: [],
  custom: [],
}

/** Map of pipeline phase to relevant best practice slugs (within software domain) */
const PHASE_PRACTICES: Record<string, string[]> = {
  specify: [],  // spec phase doesn't need implementation practices
  plan: ['architecture-patterns', 'database-schema', 'api-design'],
  execute: ['software-testing', 'code-review', 'security-review'],
  verify: ['software-testing', 'security-review', 'code-review'],
  quality: ['software-testing', 'security-review', 'architecture-patterns'],
}

export interface BestPractice {
  slug: string
  title: string
  content: string
}

/**
 * Load best practice files relevant to a domain and phase.
 * Returns concatenated content ready for context injection.
 */
export function loadBestPractices(
  templatesDir: string,
  domain: string,
  phase?: string,
): BestPractice[] {
  const bpDir = join(templatesDir, 'best-practices')
  if (!existsSync(bpDir)) return []

  // Get relevant slugs for this domain
  const domainSlugs = DOMAIN_PRACTICES[domain] ?? []

  // If phase specified, intersect with phase-relevant practices
  let targetSlugs: string[]
  if (phase && PHASE_PRACTICES[phase]) {
    const phaseSlugs = PHASE_PRACTICES[phase]!
    targetSlugs = domainSlugs.filter(s => phaseSlugs.includes(s))
    // If no intersection, use phase practices directly
    if (targetSlugs.length === 0) targetSlugs = phaseSlugs.filter(s => domainSlugs.includes(s))
  } else {
    targetSlugs = domainSlugs
  }

  const practices: BestPractice[] = []
  for (const slug of targetSlugs) {
    const filePath = join(bpDir, `${slug}.md`)
    if (!existsSync(filePath)) continue
    try {
      const content = readFileSync(filePath, 'utf8')
      const titleMatch = content.match(/^#\s+(.+)/m)
      practices.push({
        slug,
        title: titleMatch?.[1] ?? slug,
        content,
      })
    } catch {
      // Skip unreadable files
    }
  }

  return practices
}

/**
 * Format best practices for context injection into agent prompts.
 * Keeps it concise — just the relevant practices, no boilerplate.
 */
export function formatBestPracticesForContext(practices: BestPractice[]): string {
  if (practices.length === 0) return ''

  const sections = practices.map(p => p.content.trim())
  return [
    '---',
    '## Relevant Best Practices (auto-injected)',
    '',
    ...sections,
    '---',
  ].join('\n')
}

/**
 * List all available best practice files.
 */
export function listAvailablePractices(templatesDir: string): string[] {
  const bpDir = join(templatesDir, 'best-practices')
  if (!existsSync(bpDir)) return []
  try {
    return readdirSync(bpDir)
      .filter(f => f.endsWith('.md'))
      .map(f => basename(f, '.md'))
  } catch {
    return []
  }
}
