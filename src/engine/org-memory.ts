/**
 * Organization-level memory — promote project patterns to an org-wide
 * knowledge base, search them, and strip project-specific details.
 * @module engine/org-memory
 * @see Epic 25.4 — Advanced Memory Tiers
 */

import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, type Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgMemoryEntry {
  id: string
  pattern: string
  source: string
  tags: string[]
  promotedAt: string
  promotedBy: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12)
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Remove file paths, variable names, and project-specific identifiers
 * from a pattern text to make it safe for cross-project sharing.
 */
export function stripProjectDetails(text: string): string {
  let result = text
  // Remove common project-specific identifiers (URLs first, before path regex)
  result = result.replace(/https?:\/\/[^\s]+/g, '<url>')
  // Remove absolute and relative file paths (Unix and Windows)
  result = result.replace(/(?:\/[\w.-]+){2,}/g, '<path>')
  result = result.replace(/(?:[A-Z]:\\[\w.-]+){2,}/g, '<path>')
  result = result.replace(/\.\/[\w./-]+/g, '<path>')
  // Remove camelCase and snake_case variable names (3+ chars with mixed case or underscores)
  result = result.replace(/\b[a-z]+(?:[A-Z][a-z]+){1,}\b/g, '<var>')
  result = result.replace(/\b[a-z]+(?:_[a-z]+){1,}\b/g, '<var>')
  return result
}

/**
 * Promote a pattern from a project to the org-level memory store.
 * Strips project details and writes a JSON entry to orgDir.
 */
export async function promoteToOrg(
  entry: { pattern: string; projectDir: string; tags: string[] },
  orgDir: string,
): Promise<Result<OrgMemoryEntry>> {
  try {
    const sanitized = stripProjectDetails(entry.pattern)
    const id = generateId(sanitized + Date.now().toString())
    const source = generateId(entry.projectDir)

    const orgEntry: OrgMemoryEntry = {
      id,
      pattern: sanitized,
      source,
      tags: [...entry.tags],
      promotedAt: new Date().toISOString(),
      promotedBy: 'buildpact',
    }

    await mkdir(orgDir, { recursive: true })
    const filePath = join(orgDir, `${id}.json`)
    await writeFile(filePath, JSON.stringify(orgEntry, null, 2), 'utf-8')

    return ok(orgEntry)
  } catch (e) {
    return err({
      code: 'FILE_WRITE_FAILED',
      i18nKey: 'error.org_memory.promote_failed',
      cause: e,
    })
  }
}

/**
 * List all org-level memory entries by reading JSON files from orgDir.
 */
export async function listOrgMemory(
  orgDir: string,
): Promise<Result<OrgMemoryEntry[]>> {
  try {
    await mkdir(orgDir, { recursive: true })
    const files = await readdir(orgDir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))

    const entries: OrgMemoryEntry[] = []
    for (const file of jsonFiles) {
      const content = await readFile(join(orgDir, file), 'utf-8')
      entries.push(JSON.parse(content) as OrgMemoryEntry)
    }

    return ok(entries)
  } catch (e) {
    return err({
      code: 'FILE_READ_FAILED',
      i18nKey: 'error.org_memory.list_failed',
      cause: e,
    })
  }
}

/**
 * Find patterns relevant to a query by simple keyword matching
 * against pattern text and tags.
 */
export function findRelevantPatterns(
  query: string,
  entries: OrgMemoryEntry[],
): OrgMemoryEntry[] {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)

  if (queryWords.length === 0) return []

  return entries.filter((entry) => {
    const text = `${entry.pattern} ${entry.tags.join(' ')}`.toLowerCase()
    return queryWords.some((word) => text.includes(word))
  })
}
