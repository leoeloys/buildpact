/**
 * IDE command refresher — updates slash commands for Claude Code and other IDEs.
 * Called during `buildpact upgrade` to ensure all commands are up to date.
 * @module foundation/ide-refresher
 */

import { readdir, copyFile, access, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolve the templates/commands directory from the CLI installation.
 */
function resolveCommandTemplatesDir(): string | null {
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 5; i++) {
      const candidate = join(dir, 'templates', 'commands')
      try {
        // Sync check — we'll handle the error in the async caller
        return candidate
      } catch { /* keep looking */ }
      dir = join(dir, '..')
    }
  } catch { /* can't resolve */ }
  return null
}

/**
 * Refresh Claude Code slash commands in .claude/commands/bp/.
 * Copies all .md files from templates/commands/ to the project.
 * Also updates CLAUDE.md with the full command list.
 *
 * @returns Number of commands updated, or 0 if no Claude Code integration found.
 */
export async function refreshIdeCommands(projectDir: string): Promise<number> {
  const claudeCommandsDir = join(projectDir, '.claude', 'commands', 'bp')

  // Check if Claude Code integration exists
  try {
    await access(claudeCommandsDir)
  } catch {
    return 0 // No Claude Code integration
  }

  // Find templates
  let templatesDir: string | null = null
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 5; i++) {
      const candidate = join(dir, 'templates', 'commands')
      try {
        await access(candidate)
        templatesDir = candidate
        break
      } catch { /* keep looking */ }
      dir = join(dir, '..')
    }
  } catch { /* can't resolve */ }

  if (!templatesDir) return 0

  // Copy all command templates
  let count = 0
  try {
    const entries = await readdir(templatesDir)
    const mdFiles = entries.filter(f => f.endsWith('.md'))
    for (const file of mdFiles) {
      await copyFile(join(templatesDir, file), join(claudeCommandsDir, file))
      count++
    }
  } catch {
    return 0
  }

  // Update CLAUDE.md
  try {
    const claudeMdPath = join(projectDir, 'CLAUDE.md')
    const commands = [
      '/bp:specify', '/bp:plan', '/bp:execute', '/bp:verify', '/bp:quick',
      '/bp:constitution', '/bp:squad', '/bp:optimize', '/bp:doctor',
      '/bp:help', '/bp:docs', '/bp:investigate', '/bp:orchestrate',
      '/bp:export-web', '/bp:memory', '/bp:quality',
    ].join(', ')

    await writeFile(
      claudeMdPath,
      `# CLAUDE.md — BuildPact Project\n\nSee .buildpact/constitution.md for project rules.\n\nBuildPact v2.0 slash commands: ${commands}.\n`,
      'utf-8',
    )
  } catch { /* non-critical */ }

  return count
}
