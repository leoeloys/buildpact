/**
 * @module foundation/sharding
 * @see FR-304
 *
 * Automatic document sharding for BuildPact CLI.
 * Splits documents exceeding 500 lines into atomic section files with a navigation index.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** FR-304 canonical threshold. Documents with strictly MORE than this many lines are sharded. */
export const SHARD_LINE_THRESHOLD = 500

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single atomic section extracted from a sharded document. */
export interface ShardSection {
  /** Section title extracted from `## ` heading (without the `## ` prefix). */
  title: string
  /** URL-safe slug derived from title, used as the shard filename. */
  slug: string
  /** Full section content including the `## Title` heading line. */
  content: string
}

/** The complete result of sharding a document. */
export interface ShardManifest {
  /** Base name used for directory and file naming (e.g., `"epics"`). */
  baseName: string
  /** Content before the first `## ` heading (preamble / intro). */
  preamble: string
  /** Ordered array of extracted sections. */
  sections: ShardSection[]
  /** Generated index.md markdown content with navigation links. */
  indexContent: string
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Returns the number of lines in a string.
 * Empty string → 1 line. Single newline → 2 lines.
 */
export function countLines(content: string): number {
  return content.split('\n').length
}

/**
 * Returns true if the document strictly exceeds SHARD_LINE_THRESHOLD lines.
 * A 500-line document returns false; a 501-line document returns true.
 */
export function shouldShard(content: string): boolean {
  return countLines(content) > SHARD_LINE_THRESHOLD
}

/**
 * Converts a heading title to a URL-safe slug.
 * "Epic 1: Setup" → "epic-1-setup"
 */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  )
}

/**
 * Splits document content into sections at `## ` heading boundaries.
 * If no `## ` headings exist, returns the entire content as one section.
 */
export function splitIntoSections(content: string): ShardSection[] {
  const parts = content.split(/\n(?=## )/)
  const sectionParts = parts.filter(p => p.trimStart().startsWith('## '))

  if (sectionParts.length === 0) {
    // No ## headings — treat entire content as one section
    const titleMatch = content.match(/^#\s+(.+)$/m)
    const title = titleMatch?.[1]?.trim() ?? 'section-1'
    return [{ title, slug: slugify(title), content }]
  }

  return sectionParts.map(part => {
    const firstLine = part.split('\n')[0] ?? ''
    const title = firstLine.replace(/^##\s+/, '').trim()
    return { title, slug: slugify(title), content: part }
  })
}

/**
 * Builds a complete ShardManifest from document content and a base name.
 * Pure function — no I/O. Call writeShards() to persist to disk.
 */
export function buildShardManifest(content: string, baseName: string): ShardManifest {
  const firstH2 = content.indexOf('\n## ')
  const preamble = firstH2 !== -1 ? content.slice(0, firstH2 + 1) : ''

  const sections = splitIntoSections(content)

  const titleMatch = preamble.match(/^#\s+(.+)$/m)
  const indexTitle = titleMatch?.[1]?.trim() ?? baseName

  const sectionLinks = sections
    .map(s => `- [${s.title}](./${baseName}/${s.slug}.md)`)
    .join('\n')

  const indexContent = [
    `# ${indexTitle}`,
    '',
    `> ⚡ Auto-sharded by BuildPact (FR-304) — ${sections.length} sections. Load individual shards for efficient context usage.`,
    '',
    '## Sections',
    '',
    sectionLinks,
  ].join('\n')

  return { baseName, preamble, sections, indexContent }
}

// ---------------------------------------------------------------------------
// I/O function
// ---------------------------------------------------------------------------

/**
 * Writes shard files and index.md to disk.
 *
 * Layout:
 *   {outputDir}/index.md
 *   {outputDir}/{baseName}/{slug}.md  (one per section)
 *
 * Returns the list of written file paths on success, or FILE_WRITE_FAILED on any I/O error.
 */
export async function writeShards(
  manifest: ShardManifest,
  outputDir: string,
): Promise<Result<string[]>> {
  const shardsDir = join(outputDir, manifest.baseName)
  try {
    await mkdir(shardsDir, { recursive: true })
    const writtenPaths: string[] = []

    const indexPath = join(outputDir, 'index.md')
    await writeFile(indexPath, manifest.indexContent, 'utf-8')
    writtenPaths.push(indexPath)

    const usedSlugs = new Map<string, number>()
    for (const section of manifest.sections) {
      const baseSlug = section.slug
      const count = usedSlugs.get(baseSlug) ?? 0
      usedSlugs.set(baseSlug, count + 1)
      const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
      const shardPath = join(shardsDir, `${slug}.md`)
      await writeFile(shardPath, section.content, 'utf-8')
      writtenPaths.push(shardPath)
    }

    return ok(writtenPaths)
  } catch (cause) {
    return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.sharding.write_failed', cause })
  }
}
