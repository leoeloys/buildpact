/**
 * @module commands/docs/scanner
 * @see Story 15.4 — CLI Docs Command (Lira)
 *
 * Project tree scanner, file type classifier, misplacement detector,
 * staleness checker, and PROJECT-INDEX.md generator.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, extname, relative, basename } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FileType =
  | 'spec'
  | 'plan'
  | 'code'
  | 'test'
  | 'config'
  | 'doc'
  | 'template'
  | 'asset'
  | 'unknown'

export interface FileEntry {
  path: string
  type: FileType
  title: string
  lastModified: Date
  sizeLines: number
  tags: string[]
}

export interface MisplacementSuggestion {
  file: string
  destination: string
  reason: string
}

export interface StalenessResult {
  file: string
  age: number
  suggestedAction: string
}

export interface OrphanResult {
  file: string
  kind: string
  suggestedAction: string
}

export interface DocsReport {
  files: FileEntry[]
  misplacements: MisplacementSuggestion[]
  staleDocuments: StalenessResult[]
  orphans: OrphanResult[]
  isBrownfield: boolean
}

// ---------------------------------------------------------------------------
// Default expected files
// ---------------------------------------------------------------------------

export const DEFAULT_EXPECTED_FILES = [
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  '.buildpact/constitution.md',
  '.buildpact/config.yaml',
]

// ---------------------------------------------------------------------------
// Excluded directories
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.buildpact/audit',
  '.next',
  '.nuxt',
  '.cache',
  '__pycache__',
])

/** Check if a directory should be excluded */
function shouldExclude(dirName: string, relativePath: string): boolean {
  if (EXCLUDED_DIRS.has(dirName)) return true
  if (EXCLUDED_DIRS.has(relativePath)) return true
  return false
}

// ---------------------------------------------------------------------------
// File type classification
// ---------------------------------------------------------------------------

const TAG_KEYWORDS = [
  'constitution',
  'squad',
  'wave',
  'budget',
  'spec',
  'plan',
  'execute',
  'verify',
  'agent',
  'template',
  'config',
  'migration',
  'memory',
  'feedback',
  'lesson',
  'decision',
  'adr',
]

/** Classify a file based on its path and extension */
export function classifyFile(filePath: string, projectDir: string): FileType {
  const rel = relative(projectDir, filePath)
  const ext = extname(filePath).toLowerCase()
  const name = basename(filePath).toLowerCase()

  // Spec files
  if (rel.includes('.buildpact/specs') || name.includes('spec.md') || name.startsWith('spec-')) {
    return 'spec'
  }

  // Plan files
  if (rel.includes('.buildpact/plans') || name.includes('plan.md') || name.startsWith('plan-')) {
    return 'plan'
  }

  // Test files
  if (
    rel.startsWith('test/') ||
    rel.startsWith('tests/') ||
    rel.startsWith('__tests__/') ||
    name.includes('.test.') ||
    name.includes('.spec.') ||
    name.includes('.e2e.')
  ) {
    return 'test'
  }

  // Template files
  if (rel.startsWith('templates/')) return 'template'

  // Config files
  if (
    ['.yaml', '.yml', '.json', '.toml', '.ini', '.env'].includes(ext) ||
    name.startsWith('tsconfig') ||
    name === 'package.json' ||
    name === '.eslintrc' ||
    name === '.prettierrc' ||
    name.startsWith('vitest') ||
    name === 'turbo.json'
  ) {
    return 'config'
  }

  // Doc files
  if (
    ext === '.md' ||
    ext === '.mdx' ||
    ext === '.txt' ||
    ext === '.rst' ||
    rel.startsWith('docs/')
  ) {
    return 'doc'
  }

  // Code files
  if (
    ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.rb', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt'].includes(ext)
  ) {
    return 'code'
  }

  // Asset files
  if (
    ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.pdf'].includes(ext)
  ) {
    return 'asset'
  }

  return 'unknown'
}

/** Extract title from a file (first # heading or filename) */
export async function extractTitle(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const firstLine = content.split('\n').find((l) => l.trim().startsWith('# '))
    if (firstLine) {
      return firstLine.trim().replace(/^#+\s*/, '')
    }
  } catch {
    // Can't read file content — use filename
  }
  return basename(filePath)
}

/** Auto-detect tags from file path and name */
export function detectTags(filePath: string): string[] {
  const lower = filePath.toLowerCase()
  return TAG_KEYWORDS.filter((kw) => lower.includes(kw))
}

/** Count lines in a file */
async function countFileLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Tree scanner
// ---------------------------------------------------------------------------

/**
 * Recursively scan a project directory, building a list of FileEntry objects.
 */
export async function scanProjectTree(projectDir: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = []

  async function walk(dir: string): Promise<void> {
    let dirEntries: Awaited<ReturnType<typeof readdir>>
    try {
      dirEntries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of dirEntries) {
      const fullPath = join(dir, entry.name)
      const relPath = relative(projectDir, fullPath)

      if (entry.isDirectory()) {
        if (!shouldExclude(entry.name, relPath)) {
          await walk(fullPath)
        }
        continue
      }

      if (entry.isFile()) {
        const fileStat = await stat(fullPath).catch(() => null)
        if (!fileStat) continue

        const type = classifyFile(fullPath, projectDir)
        const title = await extractTitle(fullPath)
        const tags = detectTags(relPath)
        const sizeLines = await countFileLines(fullPath)

        entries.push({
          path: relPath,
          type,
          title,
          lastModified: fileStat.mtime,
          sizeLines,
          tags,
        })
      }
    }
  }

  await walk(projectDir)
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

// ---------------------------------------------------------------------------
// Misplacement detection
// ---------------------------------------------------------------------------

/**
 * Detect files that appear to be in the wrong location.
 */
export function detectMisplacements(
  files: FileEntry[],
): MisplacementSuggestion[] {
  const suggestions: MisplacementSuggestion[] = []

  for (const file of files) {
    const name = basename(file.path).toLowerCase()
    const ext = extname(file.path).toLowerCase()

    // Spec files outside .buildpact/specs/
    if (
      (name.includes('spec.md') || name.startsWith('spec-')) &&
      !file.path.includes('.buildpact/specs')
    ) {
      suggestions.push({
        file: file.path,
        destination: `.buildpact/specs/${name.replace(/\.md$/, '')}/`,
        reason: 'Spec files should be stored in .buildpact/specs/',
      })
    }

    // Plan files outside .buildpact/plans/
    if (
      (name.includes('plan.md') || name.startsWith('plan-')) &&
      !file.path.includes('.buildpact/plans')
    ) {
      suggestions.push({
        file: file.path,
        destination: `.buildpact/plans/${name.replace(/\.md$/, '')}/`,
        reason: 'Plan files should be stored in .buildpact/plans/',
      })
    }

    // ADR files outside docs/
    if (
      name.startsWith('adr-') &&
      !file.path.includes('docs/') &&
      !file.path.includes('.buildpact/plans')
    ) {
      suggestions.push({
        file: file.path,
        destination: 'docs/adrs/',
        reason: 'ADR files should be stored in docs/adrs/ or .buildpact/plans/*/adrs/',
      })
    }

    // Stale temp files
    if (['.tmp', '.bak', '.old'].includes(ext)) {
      suggestions.push({
        file: file.path,
        destination: '(delete)',
        reason: 'Stale temporary file — consider deleting',
      })
    }
  }

  return suggestions
}

// ---------------------------------------------------------------------------
// Staleness and orphan detection
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Check for stale documents (>30 days without updates in active pipeline).
 */
export function checkStaleness(files: FileEntry[]): StalenessResult[] {
  const now = Date.now()
  const stale: StalenessResult[] = []

  for (const file of files) {
    if (file.type !== 'spec' && file.type !== 'plan') continue
    const age = Math.floor((now - file.lastModified.getTime()) / (24 * 60 * 60 * 1000))
    if (now - file.lastModified.getTime() > THIRTY_DAYS_MS) {
      stale.push({
        file: file.path,
        age,
        suggestedAction: file.type === 'spec'
          ? 'Review spec — may need planning or archival'
          : 'Review plan — may need execution or archival',
      })
    }
  }

  return stale
}

/**
 * Detect orphaned artifacts (specs without plans, plans without executions).
 */
export function detectOrphans(files: FileEntry[]): OrphanResult[] {
  const orphans: OrphanResult[] = []

  const specSlugs = files
    .filter((f) => f.type === 'spec')
    .map((f) => {
      const parts = f.path.split('/')
      return parts[parts.length - 2] ?? basename(f.path, '.md')
    })

  const planSlugs = files
    .filter((f) => f.type === 'plan')
    .map((f) => {
      const parts = f.path.split('/')
      return parts[parts.length - 2] ?? basename(f.path, '.md')
    })

  // Specs without plans
  for (const slug of specSlugs) {
    if (!planSlugs.includes(slug)) {
      orphans.push({
        file: slug,
        kind: 'Spec without plan',
        suggestedAction: 'Run /bp:plan to create a plan for this spec',
      })
    }
  }

  return orphans
}

// ---------------------------------------------------------------------------
// Expected files check
// ---------------------------------------------------------------------------

/**
 * Check if expected files exist in the scanned file list.
 * Returns a list of missing files.
 */
export function checkExpectedFiles(
  files: FileEntry[],
  expectedFiles: string[],
): string[] {
  const filePaths = new Set(files.map((f) => f.path))
  return expectedFiles.filter((expected) => !filePaths.has(expected))
}

// ---------------------------------------------------------------------------
// Brownfield detection
// ---------------------------------------------------------------------------

/**
 * Detect if the project is brownfield (existing code predates .buildpact/).
 */
export function detectBrownfield(files: FileEntry[]): boolean {
  const codeFiles = files.filter((f) => f.type === 'code' && f.path.startsWith('src/'))
  const buildpactFiles = files.filter((f) => f.path.startsWith('.buildpact/'))

  if (codeFiles.length === 0 || buildpactFiles.length === 0) return false

  const oldestCode = Math.min(...codeFiles.map((f) => f.lastModified.getTime()))
  const oldestBP = Math.min(...buildpactFiles.map((f) => f.lastModified.getTime()))

  return oldestCode < oldestBP
}

// ---------------------------------------------------------------------------
// PROJECT-INDEX.md generator
// ---------------------------------------------------------------------------

/**
 * Generate PROJECT-INDEX.md content from scanned files.
 */
export function generateProjectIndex(files: FileEntry[]): string {
  const timestamp = new Date().toISOString()
  const typeCounts = new Map<FileType, number>()
  for (const f of files) {
    typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1)
  }

  const typeBreakdown = Array.from(typeCounts.entries())
    .map(([t, c]) => `${t}: ${c}`)
    .join(', ')

  const lines: string[] = [
    '# Project File Index',
    `> Auto-generated by /bp:docs on ${timestamp}`,
    `> Total files: ${files.length} | Types: ${typeBreakdown}`,
    '',
    '## Quick Lookup',
    '',
    '### By Type',
    '| Type | Count |',
    '|------|-------|',
  ]

  for (const [type, count] of typeCounts) {
    lines.push(`| ${type} | ${count} |`)
  }
  lines.push('')

  // All files table
  lines.push('### All Files (Searchable)')
  lines.push('| Path | Type | Title | Tags | Modified | Lines |')
  lines.push('|------|------|-------|------|----------|-------|')

  for (const f of files) {
    const modified = f.lastModified.toISOString().split('T')[0]
    const tags = f.tags.length > 0 ? f.tags.join(', ') : '—'
    lines.push(`| ${f.path} | ${f.type} | ${f.title} | ${tags} | ${modified} | ${f.sizeLines} |`)
  }

  lines.push('')
  lines.push('### Agent Quick Reference')
  lines.push('When looking for a file, search this index by:')
  lines.push('- **Tag**: e.g., "constitution" finds all constitution-related files')
  lines.push('- **Type**: e.g., "spec" finds all specification files')
  lines.push('- **Path**: e.g., "src/engine" finds all engine modules')
  lines.push('')

  return lines.join('\n')
}
