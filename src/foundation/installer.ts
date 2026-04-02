import { mkdir, copyFile, readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AuditLogger } from './audit.js'
import { CURRENT_SCHEMA_VERSION } from './version-guard.js'
import { ok, err } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { SupportedLanguage } from '../contracts/i18n.js'

/** Resolve the root templates directory.
 *  Works in both compiled dist/ (flat chunks or nested cli/) and Vitest direct-source contexts. */
function resolveTemplatesDir(): string {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    // tsdown may inline into dist/cli/index.mjs (2 levels up) or a flat dist/ chunk (1 level up)
    const oneLevelUp = join(__dirname, '..', 'templates')
    if (existsSync(oneLevelUp)) return oneLevelUp
    return join(__dirname, '..', '..', 'templates')
  } catch {
    // Fallback for environments where import.meta.url is unavailable
    return join(process.cwd(), 'templates')
  }
}

/** Supported IDE identifiers */
export type IdeId = 'claude-code' | 'cursor' | 'gemini' | 'codex'

/** Options passed to the install function */
export interface InstallOptions {
  /** Override the templates directory (used in tests) */
  templatesDir?: string
  projectName: string
  language: SupportedLanguage
  domain: string
  ides: IdeId[]
  experienceLevel: 'beginner' | 'intermediate' | 'expert'
  installSquad: boolean
  /** Absolute path to the project directory to initialize */
  projectDir: string
}

/** Result value from a successful installation */
export interface InstallResult {
  installedResources: string[]
  bundledResources: string[]
}

/** Replace {{variable}} placeholders in a template string */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

/** Copy a directory recursively */
async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  const entries = await readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await copyFile(srcPath, destPath)
    }
  }
}

/** Read a template file and interpolate variables */
async function readTemplate(name: string, vars: Record<string, string>, tplDir: string): Promise<string> {
  const content = await readFile(join(tplDir, name), 'utf-8')
  return interpolate(content, vars)
}

/**
 * Initialize a BuildPact project in the given directory.
 * Creates .buildpact/, IDE configs, and installs the bundled Squad.
 * Logs all operations to the audit log before writing.
 */
export async function install(options: InstallOptions): Promise<Result<InstallResult>> {
  const {
    projectName,
    language,
    domain,
    ides,
    experienceLevel,
    installSquad,
    projectDir,
    templatesDir = resolveTemplatesDir(),
  } = options

  const buildpactDir = join(projectDir, '.buildpact')
  const auditDir = join(buildpactDir, 'audit')
  const auditLogPath = join(auditDir, 'install.jsonl')
  const installedResources: string[] = []
  const bundledResources: string[] = []

  const logger = new AuditLogger(auditLogPath)

  // Read CLI version from package.json
  let cliVersion = '2.0.0'
  try {
    const { readFileSync } = await import('node:fs')
    const { resolve, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 5; i++) {
      try {
        const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'))
        if (pkg.name === 'buildpact') { cliVersion = pkg.version; break }
      } catch { /* keep walking */ }
      dir = resolve(dir, '..')
    }
  } catch { /* fallback */ }

  const vars: Record<string, string> = {
    project_name: projectName,
    language,
    experience_level: experienceLevel,
    active_squad: installSquad ? 'software' : 'none',
    created_at: new Date().toISOString().slice(0, 10),
    cli_version: cliVersion,
    buildpact_schema: String(CURRENT_SCHEMA_VERSION),
  }

  try {
    // 1. Create .buildpact/ directory structure
    await logger.log({ action: 'install.start', agent: 'installer', files: [], outcome: 'success' })
    await mkdir(auditDir, { recursive: true })

    // 2. Write constitution.md
    const constitution = await readTemplate('constitution.md', vars, templatesDir)
    const constitutionPath = join(buildpactDir, 'constitution.md')
    await writeFile(constitutionPath, constitution, 'utf-8')
    installedResources.push('.buildpact/constitution.md')
    await logger.log({ action: 'install.constitution', agent: 'installer', files: ['.buildpact/constitution.md'], outcome: 'success' })

    // 3. Write config.yaml
    const config = await readTemplate('config.yaml', vars, templatesDir)
    const configPath = join(buildpactDir, 'config.yaml')
    await writeFile(configPath, config, 'utf-8')
    installedResources.push('.buildpact/config.yaml')
    await logger.log({ action: 'install.config', agent: 'installer', files: ['.buildpact/config.yaml'], outcome: 'success' })

    // 4. Write project-context.md
    const context = await readTemplate('project-context.md', vars, templatesDir)
    const contextPath = join(buildpactDir, 'project-context.md')
    await writeFile(contextPath, context, 'utf-8')
    installedResources.push('.buildpact/project-context.md')
    await logger.log({ action: 'install.project_context', agent: 'installer', files: ['.buildpact/project-context.md'], outcome: 'success' })

    // 5. Generate IDE configs
    for (const ide of ides) {
      await installIdeConfig(ide, projectDir, templatesDir, installedResources, logger)
    }

    // 6. Install Squad (bundled fallback)
    if (installSquad) {
      const squadSrc = join(templatesDir, 'squads', 'software')
      const squadDest = join(buildpactDir, 'squads', 'software')
      await copyDir(squadSrc, squadDest)
      bundledResources.push('squads/software (bundled)')
      installedResources.push('.buildpact/squads/software')
      await logger.log({
        action: 'install.squad',
        agent: 'installer',
        files: ['.buildpact/squads/software'],
        outcome: 'success',
      })

      // Generate squad lock file for version pinning
      try {
        const { lockSquad } = await import('../engine/squad-lock.js')
        await lockSquad(projectDir, 'software')
        installedResources.push('.buildpact/squad-lock.yaml')
      } catch (lockErr) {
        console.warn('Warning: could not generate squad lock file:', (lockErr as Error).message)
      }
    }

    // 7. Write DECISIONS.md to project root
    const decisions = await readTemplate('DECISIONS.md', vars, templatesDir)
    const decisionsPath = join(projectDir, 'DECISIONS.md')
    await writeFile(decisionsPath, decisions, 'utf-8')
    installedResources.push('DECISIONS.md')
    await logger.log({ action: 'install.decisions_log', agent: 'installer', files: ['DECISIONS.md'], outcome: 'success' })

    // 8. Write STATUS.md to project root
    const status = await readTemplate('STATUS.md', vars, templatesDir)
    const statusPath = join(projectDir, 'STATUS.md')
    await writeFile(statusPath, status, 'utf-8')
    installedResources.push('STATUS.md')
    await logger.log({ action: 'install.status', agent: 'installer', files: ['STATUS.md'], outcome: 'success' })

    await logger.log({
      action: 'install.complete',
      agent: 'installer',
      files: installedResources,
      outcome: 'success',
    })

    return ok({ installedResources, bundledResources })
  } catch (cause) {
    try {
      await logger.log({
        action: 'install.error',
        agent: 'installer',
        files: [],
        outcome: 'failure',
        error: String(cause),
      })
    } catch {
      // Swallow logging error — original error takes priority
    }
    return err({
      code: 'IDE_CONFIG_FAILED',
      i18nKey: 'error.ide.config_failed',
      cause,
    })
  }
}

/** Generate IDE-specific configuration files */
async function installIdeConfig(
  ide: IdeId,
  projectDir: string,
  tplDir: string,
  installedResources: string[],
  logger: AuditLogger,
): Promise<void> {
  switch (ide) {
    case 'claude-code': {
      // Commands go in .claude/commands/bp/ so they appear as /bp:specify etc.
      // This avoids conflicts with Claude Code's native slash commands.
      const commandsDir = join(projectDir, '.claude', 'commands', 'bp')
      await mkdir(commandsDir, { recursive: true })
      await copyDir(join(tplDir, 'commands'), commandsDir)
      installedResources.push('.claude/commands/bp')

      // CLAUDE.md in project root
      const claudeMd = join(projectDir, 'CLAUDE.md')
      await writeFile(
        claudeMd,
        `# CLAUDE.md — BuildPact Project\n\nSee .buildpact/constitution.md for project rules.\n\nBuildPact slash commands are available as /bp:specify, /bp:plan, /bp:execute, /bp:verify, /bp:quick, /bp:constitution, /bp:squad, /bp:optimize, /bp:doctor.\n`,
        'utf-8',
      )
      installedResources.push('CLAUDE.md')
      await logger.log({
        action: 'install.ide_config',
        agent: 'installer',
        files: ['.claude/commands/bp', 'CLAUDE.md'],
        outcome: 'success',
      })
      break
    }
    case 'cursor': {
      const cursorRulesDir = join(projectDir, '.cursor', 'rules')
      await mkdir(cursorRulesDir, { recursive: true })
      installedResources.push('.cursor/rules')

      const cursorRules = join(projectDir, '.cursorrules')
      await writeFile(
        cursorRules,
        `# BuildPact — Cursor Rules\n\nSee .buildpact/constitution.md for project rules.\n`,
        'utf-8',
      )
      installedResources.push('.cursorrules')
      await logger.log({
        action: 'install.ide_config',
        agent: 'installer',
        files: ['.cursor/rules', '.cursorrules'],
        outcome: 'success',
      })
      break
    }
    case 'gemini': {
      const geminiDir = join(projectDir, '.gemini')
      await mkdir(geminiDir, { recursive: true })
      installedResources.push('.gemini')
      await logger.log({ action: 'install.ide_config', agent: 'installer', files: ['.gemini'], outcome: 'success' })
      break
    }
    case 'codex': {
      const codexDir = join(projectDir, '.codex')
      await mkdir(codexDir, { recursive: true })
      installedResources.push('.codex')
      await logger.log({ action: 'install.ide_config', agent: 'installer', files: ['.codex'], outcome: 'success' })
      break
    }
  }
}
