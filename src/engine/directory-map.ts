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

/** Well-known file descriptions within the project */
const KNOWN_FILES: Record<string, string> = {
  // .buildpact/ files
  'constitution.md': 'Project rules and principles — immutable contract for AI agents',
  'config.yaml': 'Project configuration (language, domain, IDE, experience level)',
  'project-context.md': 'High-level context for AI agents about this project',
  'LEDGER.md': 'Unified temporal index of all project events (append-only)',
  'MAP.md': 'This file — directory index (auto-generated)',
  'build-state.json': 'Current build state with checkpoints for resume capability',
  'metrics.json': 'Aggregated cost and token usage metrics',
  'squad-lock.yaml': 'Squad version pinning with content hash integrity',
  // Project root files
  'README.md': 'Project overview, installation, and usage guide',
  'CLAUDE.md': 'Claude Code harness entry point — links to constitution',
  'CHANGELOG.md': 'Release history and version changelog',
  'CONTRIBUTING.md': 'Contributor guide — how to develop and submit changes',
  'DECISIONS.md': 'Append-only log of significant project decisions',
  'STATUS.md': 'Living document of current project state',
  'LICENSE': 'MIT License',
  'package.json': 'npm package manifest — dependencies, scripts, metadata',
  'package-lock.json': 'Locked dependency tree for reproducible installs',
  'tsconfig.json': 'TypeScript compiler configuration',
  'tsdown.config.ts': 'Build tool configuration (tsdown bundler)',
  'vitest.config.ts': 'Test runner configuration (Vitest)',
  '.gitignore': 'Git ignore rules — excludes dist, node_modules, .DS_Store',
  'action.yml': 'GitHub Action manifest for CI/CD pipeline integration',
  // Scripts
  'install.sh': 'One-liner installation script (curl | bash)',
  'release-check.ts': 'Pre-release validation checks',
  'release-publish.ts': 'Release publishing automation',
  // Squad files
  'squad.yaml': 'Squad definition — name, version, domain, agents, automation level',
  // Config files
  'balanced.yaml': 'Balanced cost/quality profile (default)',
  'quality.yaml': 'Quality-first profile (higher cost, better results)',
  'budget.yaml': 'Budget-first profile (lower cost, faster execution)',
}

/** Well-known directory descriptions */
const KNOWN_DIRS: Record<string, string> = {
  // .buildpact/ internals
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
  'reports': 'Generated reports (benchmarks, quality audits)',
  'agents': 'Squad agent persona definitions (one .md per agent)',
  'hooks': 'Squad lifecycle hooks',
  'templates': 'IDE-specific prompt templates for squad agents',
  // Project root directories
  'src': 'TypeScript source code — CLI, engine, commands, contracts, foundation',
  'test': 'Test suite — unit, integration, e2e, fixtures, snapshots',
  'docs': 'Documentation site (VitePress) — English + Português',
  'scripts': 'Build, release, and installation scripts',
  'action': 'GitHub Action for CI/CD pipeline integration',
  'locales': 'Internationalization message files (en, pt-br)',
  'dist': 'Compiled build output (auto-generated, gitignored)',
  // src/ subdirectories
  'cli': 'CLI entry point and argument parsing',
  'commands': 'Command handlers — one subdirectory per command',
  'contracts': 'TypeScript interfaces and type definitions (no logic)',
  'engine': 'Pipeline engine — orchestration, verification, budgets, agents',
  'foundation': 'Core infrastructure — i18n, audit, config, scanning, updates',
  'data': 'Static data files embedded in the CLI',
  'benchmark': 'Performance benchmark harness',
  'optimize': 'Code optimization and simplification engine',
  // test/ subdirectories
  'unit': 'Unit tests — mirrors src/ structure',
  'integration': 'Integration tests — cross-module flows',
  'e2e': 'End-to-end tests — full pipeline simulation',
  'fixtures': 'Test fixture data and mock files',
  'snapshots': 'Snapshot test baselines',
  // docs/ subdirectories
  'en': 'English documentation',
  'pt-br': 'Portuguese (Brazil) documentation',
  'guide': 'Getting started and usage guides',
  'reference': 'API and command reference',
  'concepts': 'Architecture and design concepts',
  // common
  'best-practices': 'Best practice guides for spec-driven development',
  'software': 'Software development squad (default)',
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

/** Infer a description for a directory based on name and parent context. */
function inferDirDescription(name: string, parentPath?: string): string {
  if (KNOWN_DIRS[name]) return KNOWN_DIRS[name]

  // Command handler directories (src/commands/*)
  if (parentPath?.endsWith('/commands') || parentPath?.endsWith('\\commands')) {
    return `\`buildpact ${name}\` command handler`
  }

  // Spec/plan slug directories
  if (parentPath?.includes('specs') || parentPath?.includes('plans')) {
    return `Pipeline artifact: ${name}`
  }

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
  const dirName = relPath || '.' // root = "."
  const entries: MapEntry[] = []

  let dirEntries: import('node:fs').Dirent[]
  try {
    dirEntries = await readdir(dirPath, { withFileTypes: true }) as unknown as import('node:fs').Dirent[]
  } catch {
    return ''
  }

  const SKIP_LISTING = new Set([
    'node_modules', '.git', 'dist', 'coverage',
    '.next', '.nuxt', '.cache', '__pycache__',
    '.remember', '.vitepress', 'rascunhos',
  ])

  for (const entry of dirEntries) {
    if (entry.name === 'MAP.md') continue // skip self
    if (entry.name.startsWith('.')) continue // skip hidden
    if (entry.isDirectory() && SKIP_LISTING.has(entry.name)) continue // skip build/cache dirs

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
      const description = inferDirDescription(entry.name, dirPath)
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
  const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'coverage',
    '.next', '.nuxt', '.cache', '__pycache__',
    '.remember', '.vitepress', 'rascunhos',
    'templates', 'test', 'fixtures', // templates/test: MAP.md would interfere with readdir-based tests and squad file counts
  ])
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

/**
 * Generate MAP.md files for the ENTIRE project tree.
 * Covers root, src/, test/, docs/, templates/, scripts/, action/, .claude/, .buildpact/.
 * Skips node_modules, dist, coverage, .git, and other build artifacts.
 */
export async function refreshAllProjectMaps(projectDir: string): Promise<string[]> {
  return generateMapsRecursive(projectDir, projectDir)
}
