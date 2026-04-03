/**
 * Directory Map — per-directory MAP.md index generator.
 * Creates a MAP.md in each .buildpact/ subdirectory with a table of contents,
 * file descriptions, and context. Agents read the local MAP.md instead of
 * scanning entire trees — saves tokens and provides instant orientation.
 *
 * @module engine/directory-map
 */

import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import { join, relative, extname, basename } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapEntry {
  name: string
  type: 'file' | 'dir'
  description: string
  lastModified: string
  size?: number
}

// ---------------------------------------------------------------------------
// Known file/directory descriptions
// ---------------------------------------------------------------------------

/** Well-known file descriptions within .buildpact/ */
const KNOWN_FILES: Record<string, string> = {
  'constitution.md': 'Project rules and principles — immutable contract for AI agents',
  'config.yaml': 'Project configuration (language, domain, IDE, experience level)',
  'project-context.md': 'High-level context for AI agents about this project',
  'LEDGER.md': 'Unified temporal index of all project events (append-only)',
  'MAP.md': 'This file — directory index (auto-generated)',
  'build-state.json': 'Current build state with checkpoints for resume capability',
  'metrics.json': 'Aggregated cost and token usage metrics',
  'squad-lock.yaml': 'Squad version pinning with content hash integrity',
}

/** Well-known directory descriptions */
const KNOWN_DIRS: Record<string, string> = {
  'audit': 'Append-only JSONL logs of every CLI operation',
  'specs': 'Structured specifications — one subdirectory per spec (slug-based)',
  'plans': 'Wave-based execution plans — one subdirectory per plan',
  'squads': 'Multi-agent squad definitions (one dir per squad)',
  'memory': 'Agent memory — decisions, lessons, gotchas, feedback',
  'changelogs': 'Per-artifact-type change tracking (spec.md, plan.md, etc.)',
  'handoffs': 'Formal agent-to-agent transition packets',
  'approvals': 'Human governance approval records',
  'budget': 'Budget tracking and incident records',
  'quality': 'Quality review reports',
  'forensics': 'Crash recovery traces and session forensics',
  'checkpoints': 'Build checkpoint snapshots for recovery',
  'profiles': 'Model cost/quality profiles',
}

// ---------------------------------------------------------------------------
// File description inference
// ---------------------------------------------------------------------------

/** Infer a description for a file based on its name and content. */
async function inferFileDescription(filePath: string, name: string): Promise<string> {
  // Check known files first
  if (KNOWN_FILES[name]) return KNOWN_FILES[name]

  const ext = extname(name).toLowerCase()

  // Try to extract first heading from markdown
  if (ext === '.md') {
    try {
      const content = await readFile(filePath, 'utf-8')
      const heading = content.split('\n').find(l => l.startsWith('# '))
      if (heading) return heading.replace(/^#+\s*/, '').trim()
      // Fallback: first non-empty line
      const firstLine = content.split('\n').find(l => l.trim().length > 0)
      if (firstLine && firstLine.length < 120) return firstLine.trim()
    } catch { /* can't read */ }
    return 'Markdown document'
  }

  if (ext === '.yaml' || ext === '.yml') {
    try {
      const content = await readFile(filePath, 'utf-8')
      // Look for a description or name field
      const descMatch = content.match(/^description:\s*(.+)/m)
      if (descMatch) return descMatch[1]!.replace(/^["']|["']$/g, '').trim()
      const nameMatch = content.match(/^name:\s*(.+)/m)
      if (nameMatch) return `Config: ${nameMatch[1]!.replace(/^["']|["']$/g, '').trim()}`
    } catch { /* can't read */ }
    return 'YAML configuration'
  }

  if (ext === '.json') return 'JSON data'
  if (ext === '.jsonl') return 'Append-only JSON Lines log'

  return 'Project file'
}

/** Infer a description for a directory. */
function inferDirDescription(name: string): string {
  if (KNOWN_DIRS[name]) return KNOWN_DIRS[name]

  // Spec slug directories (e.g., "user-auth", "payment-flow")
  if (name.match(/^[a-z0-9-]+$/)) return `Artifact directory: ${name}`

  return 'Subdirectory'
}

// ---------------------------------------------------------------------------
// MAP.md generation
// ---------------------------------------------------------------------------

/**
 * Generate MAP.md content for a single directory.
 * Lists all files and subdirectories with descriptions.
 */
async function generateDirectoryMap(
  dirPath: string,
  projectDir: string,
): Promise<string> {
  const relPath = relative(projectDir, dirPath)
  const dirName = relPath || '.buildpact'
  const entries: MapEntry[] = []

  let dirEntries: import('node:fs').Dirent[]
  try {
    dirEntries = await readdir(dirPath, { withFileTypes: true }) as unknown as import('node:fs').Dirent[]
  } catch {
    return ''
  }

  for (const entry of dirEntries) {
    if (entry.name === 'MAP.md') continue // skip self
    if (entry.name.startsWith('.')) continue // skip hidden

    const fullPath = join(dirPath, entry.name)
    const fileStat = await stat(fullPath).catch(() => null)
    if (!fileStat) continue

    if (entry.isFile()) {
      const description = await inferFileDescription(fullPath, entry.name)
      entries.push({
        name: entry.name,
        type: 'file',
        description,
        lastModified: fileStat.mtime.toISOString().slice(0, 10),
        size: fileStat.size,
      })
    } else if (entry.isDirectory()) {
      const description = inferDirDescription(entry.name)
      // Count children for context
      let childCount = 0
      try {
        const children = await readdir(fullPath)
        childCount = children.filter(c => c !== 'MAP.md' && !c.startsWith('.')).length
      } catch { /* can't read */ }
      entries.push({
        name: `${entry.name}/`,
        type: 'dir',
        description: `${description} (${childCount} item${childCount !== 1 ? 's' : ''})`,
        lastModified: fileStat.mtime.toISOString().slice(0, 10),
      })
    }
  }

  // Sort: directories first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const timestamp = new Date().toISOString().slice(0, 19)
  const lines = [
    `# MAP — ${dirName}`,
    '',
    `> Auto-generated index. Updated: ${timestamp}`,
    `> Agents: read this file for orientation instead of scanning the directory.`,
    '',
    '| Name | Type | Description | Modified |',
    '|------|------|-------------|----------|',
  ]

  for (const e of entries) {
    const icon = e.type === 'dir' ? '📁' : '📄'
    lines.push(`| ${icon} ${e.name} | ${e.type} | ${e.description} | ${e.lastModified} |`)
  }

  if (entries.length === 0) {
    lines.push('| _(empty)_ | — | — | — |')
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * Write MAP.md for a single directory.
 */
async function writeDirectoryMap(
  dirPath: string,
  projectDir: string,
): Promise<void> {
  const content = await generateDirectoryMap(dirPath, projectDir)
  if (!content) return
  await writeFile(join(dirPath, 'MAP.md'), content, 'utf-8')
}

/**
 * Recursively generate MAP.md for a directory and all its subdirectories.
 * Skips directories that should not be indexed (audit logs, node_modules).
 */
export async function generateMapsRecursive(
  rootDir: string,
  projectDir: string,
): Promise<string[]> {
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage'])
  // Slug-container directories: their children are slug-named dirs, not fixed structure.
  // MAP.md in these would conflict with readdir-based slug lookups.
  const SLUG_CONTAINERS = new Set(['specs', 'plans'])
  const generated: string[] = []

  async function walk(dir: string, isSlugContainer: boolean): Promise<void> {
    if (!isSlugContainer) {
      await writeDirectoryMap(dir, projectDir)
      generated.push(relative(projectDir, join(dir, 'MAP.md')))
    }

    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true }) as unknown as import('node:fs').Dirent[]
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SKIP_DIRS.has(entry.name)) continue
      if (entry.name.startsWith('.')) continue
      const childIsSlugContainer = SLUG_CONTAINERS.has(entry.name)
      await walk(join(dir, entry.name), childIsSlugContainer)
    }
  }

  await walk(rootDir, false)
  return generated
}

/**
 * Generate MAP.md files for the entire .buildpact/ tree.
 * Call after any pipeline phase that creates or modifies artifacts.
 */
export async function refreshBuildpactMaps(projectDir: string): Promise<string[]> {
  const buildpactDir = join(projectDir, '.buildpact')
  try {
    await stat(buildpactDir)
  } catch {
    return [] // no .buildpact/ yet
  }
  return generateMapsRecursive(buildpactDir, projectDir)
}
