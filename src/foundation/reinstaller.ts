/**
 * Reinstaller — updates all BuildPact components to the current CLI version.
 * Preserves user-customized files (config.yaml, constitution.md, memory/).
 * Updates: IDE configs, slash commands, templates, squad, schema version.
 *
 * Called by `buildpact upgrade` after pulling CLI updates from GitHub.
 * @module foundation/reinstaller
 */

import { readFile, writeFile, readdir, copyFile, mkdir, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ok, err } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import { AuditLogger } from './audit.js'
import { CURRENT_SCHEMA_VERSION } from './version-guard.js'
import type { SupportedLanguage } from '../contracts/i18n.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReinstallResult {
  commandsUpdated: number
  configUpdated: boolean
  squadUpdated: boolean
  filesModified: string[]
  cliVersion: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve templates directory from CLI installation */
function resolveTemplatesDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'templates')
    try {
      // We'll verify async in the caller
      return candidate
    } catch { /* keep searching */ }
    dir = join(dir, '..')
  }
  return join(dir, 'templates')
}

/** Read CLI version from package.json */
function readCliVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 5; i++) {
      try {
        const { readFileSync } = require('node:fs')
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'))
        if (pkg.name === 'buildpact') return pkg.version
      } catch { /* keep walking */ }
      dir = join(dir, '..')
    }
  } catch { /* fallback */ }
  return '2.0.0'
}

/** Copy directory contents recursively */
async function copyDir(src: string, dest: string): Promise<number> {
  await mkdir(dest, { recursive: true })
  let count = 0
  const entries = await readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      count += await copyDir(srcPath, destPath)
    } else {
      await copyFile(srcPath, destPath)
      count++
    }
  }
  return count
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reinstall all BuildPact components to the current CLI version.
 * Preserves user data (config.yaml values, constitution.md, memory/).
 *
 * Updates:
 * 1. Schema version + cli version in config.yaml
 * 2. IDE slash commands (.claude/commands/bp/, .cursor/rules/, etc.)
 * 3. CLAUDE.md / .cursorrules
 * 4. Bundled squad templates (if squad is installed)
 * 5. v2.0 config sections (agent_mode, cross_project)
 */
export async function reinstall(projectDir: string): Promise<Result<ReinstallResult>> {
  const buildpactDir = join(projectDir, '.buildpact')
  const audit = new AuditLogger(join(buildpactDir, 'audit', 'upgrade.jsonl'))
  const cliVersion = readCliVersion()
  const filesModified: string[] = []

  // ─── 1. Update config.yaml (preserve user values, update schema + cli version) ───
  let configUpdated = false
  const configPath = join(buildpactDir, 'config.yaml')
  try {
    let content = await readFile(configPath, 'utf-8')

    // Update schema version
    if (content.includes('buildpact_schema:')) {
      content = content.replace(/buildpact_schema:\s*\d+/, `buildpact_schema: ${CURRENT_SCHEMA_VERSION}`)
    } else {
      content = `buildpact_schema: ${CURRENT_SCHEMA_VERSION}\n` + content
    }

    // Update CLI version
    if (content.includes('last_upgraded_by_cli:')) {
      content = content.replace(/last_upgraded_by_cli:\s*"[^"]*"/, `last_upgraded_by_cli: "${cliVersion}"`)
    } else {
      content += `\nlast_upgraded_by_cli: "${cliVersion}"\n`
    }

    // Add v2.0 sections if missing
    if (!content.includes('agent_mode:')) {
      content += '\n# v2.0 — Agent Mode (disabled by default)\nagent_mode: false\n'
    }
    if (!content.includes('cross_project:')) {
      content += '\n# v2.0 — Cross-project learning (opt-in)\ncross_project:\n  enabled: false\n'
    }

    await writeFile(configPath, content, 'utf-8')
    configUpdated = true
    filesModified.push('.buildpact/config.yaml')
  } catch {
    // config.yaml doesn't exist — skip
  }

  // ─── 2. Update all IDE integrations ─────────────────────────────
  let commandsUpdated = 0
  let templatesDir: string | null = null

  // Find templates dir
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 5; i++) {
      const candidate = join(dir, 'templates')
      try { await access(join(candidate, 'commands')); templatesDir = candidate; break } catch { /* nope */ }
      dir = join(dir, '..')
    }
  } catch { /* can't find templates */ }

  const bpCommands = [
    '/bp:specify', '/bp:plan', '/bp:execute', '/bp:verify', '/bp:quick',
    '/bp:constitution', '/bp:squad', '/bp:optimize', '/bp:doctor',
    '/bp:help', '/bp:docs', '/bp:investigate', '/bp:orchestrate',
    '/bp:export-web', '/bp:memory', '/bp:quality', '/bp:upgrade',
  ].join(', ')

  if (templatesDir) {
    const cmdTemplatesDir = join(templatesDir, 'commands')

    // ── Claude Code: .claude/commands/bp/ + CLAUDE.md ──
    try {
      const claudeDir = join(projectDir, '.claude', 'commands', 'bp')
      await access(claudeDir)
      const entries = await readdir(cmdTemplatesDir)
      for (const file of entries.filter(f => f.endsWith('.md'))) {
        await copyFile(join(cmdTemplatesDir, file), join(claudeDir, file))
        commandsUpdated++
      }
      filesModified.push('.claude/commands/bp/')

      await writeFile(
        join(projectDir, 'CLAUDE.md'),
        `# CLAUDE.md — BuildPact Project\n\nSee .buildpact/constitution.md for project rules.\n\nBuildPact v${cliVersion} slash commands: ${bpCommands}.\n`,
        'utf-8',
      )
      filesModified.push('CLAUDE.md')
    } catch { /* no Claude Code integration */ }

    // ── Cursor: .cursor/rules/ + .cursorrules ──
    try {
      const cursorRulesDir = join(projectDir, '.cursor', 'rules')
      await access(cursorRulesDir)
      // Copy command templates as cursor rules
      const entries = await readdir(cmdTemplatesDir)
      for (const file of entries.filter(f => f.endsWith('.md'))) {
        await copyFile(join(cmdTemplatesDir, file), join(cursorRulesDir, file))
        commandsUpdated++
      }
      filesModified.push('.cursor/rules/')

      await writeFile(
        join(projectDir, '.cursorrules'),
        `# BuildPact v${cliVersion} — Cursor Rules\n\nSee .buildpact/constitution.md for project rules.\nBuildPact commands: ${bpCommands}.\n`,
        'utf-8',
      )
      filesModified.push('.cursorrules')
    } catch { /* no Cursor integration */ }

    // ── Gemini CLI: .gemini/ ──
    try {
      const geminiDir = join(projectDir, '.gemini')
      await access(geminiDir)
      // Write a Gemini-compatible instructions file
      await writeFile(
        join(geminiDir, 'buildpact-commands.md'),
        `# BuildPact v${cliVersion} Commands\n\nSee .buildpact/constitution.md for project rules.\n\nAvailable commands (run via CLI):\n${bpCommands.split(', ').map(c => `- ${c}`).join('\n')}\n\nRun: buildpact <command> to execute.\n`,
        'utf-8',
      )
      filesModified.push('.gemini/buildpact-commands.md')
    } catch { /* no Gemini integration */ }

    // ── Codex CLI: .codex/ ──
    try {
      const codexDir = join(projectDir, '.codex')
      await access(codexDir)
      await writeFile(
        join(codexDir, 'buildpact-commands.md'),
        `# BuildPact v${cliVersion} Commands\n\nSee .buildpact/constitution.md for project rules.\n\nAvailable commands (run via CLI):\n${bpCommands.split(', ').map(c => `- ${c}`).join('\n')}\n\nRun: buildpact <command> to execute.\n`,
        'utf-8',
      )
      filesModified.push('.codex/buildpact-commands.md')
    } catch { /* no Codex integration */ }
  }

  // ─── 3. Update bundled squad (if installed) ───────────────────────
  let squadUpdated = false
  const squadsDir = join(buildpactDir, 'squads')
  try {
    await access(squadsDir)
    if (templatesDir) {
      const bundledSquadDir = join(templatesDir, 'squads', 'software')
      try {
        await access(bundledSquadDir)
        const targetDir = join(squadsDir, 'software')
        await copyDir(bundledSquadDir, targetDir)
        squadUpdated = true
        filesModified.push('.buildpact/squads/software/')
      } catch { /* no bundled squad template */ }
    }
  } catch { /* no squads dir — skip */ }

  await audit.log({
    action: 'upgrade.reinstall',
    agent: 'reinstaller',
    files: filesModified,
    outcome: 'success',
  })

  return ok({
    commandsUpdated,
    configUpdated,
    squadUpdated,
    filesModified,
    cliVersion,
  })
}
