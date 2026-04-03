import { execFileSync } from 'node:child_process'
import { access, readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { I18nResolver } from '../../contracts/i18n.js'
import type { CheckResult } from './types.js'
import { loadConstitution } from '../../foundation/constitution.js'
import { detectConflicts, formatConflictReportMarkdown } from '../../engine/constitution-conflict-detector.js'

const VALID_AUTOMATION_LEVELS = ['L1', 'L2', 'L3', 'L4']

/** Check Node.js version meets minimum ≥20.x */
export function checkNodeVersion(i18n: I18nResolver): CheckResult {
  const version = process.version
  const major = parseInt(version.slice(1).split('.')[0]!, 10)

  if (major >= 22) {
    return { status: 'pass', message: i18n.t('cli.doctor.node_pass', { version }) }
  }
  if (major >= 20) {
    return {
      status: 'warn',
      message: i18n.t('cli.doctor.node_warn', { version }),
      remediation: i18n.t('cli.doctor.node_fix'),
    }
  }
  return {
    status: 'fail',
    message: i18n.t('cli.doctor.node_fail', { version }),
    remediation: i18n.t('cli.doctor.node_fix'),
  }
}

/** Check Git is available on the system */
export function checkGitAvailable(i18n: I18nResolver): CheckResult {
  try {
    const output = execFileSync('git', ['--version'], { encoding: 'utf-8' }).trim()
    const version = output.replace(/^git version\s*/i, '')
    return { status: 'pass', message: i18n.t('cli.doctor.git_pass', { version }) }
  } catch {
    return {
      status: 'fail',
      message: i18n.t('cli.doctor.git_fail'),
      remediation: i18n.t('cli.doctor.git_fix'),
    }
  }
}

/** Check .buildpact/ directory has required files */
export async function checkBuildpactDir(projectDir: string, i18n: I18nResolver): Promise<CheckResult> {
  const bpDir = join(projectDir, '.buildpact')
  const required = ['constitution.md', 'config.yaml', 'project-context.md']
  const requiredDirs = ['audit']
  const missing: string[] = []

  for (const file of required) {
    try {
      await access(join(bpDir, file))
    } catch {
      missing.push(file)
    }
  }

  for (const dir of requiredDirs) {
    try {
      await access(join(bpDir, dir))
    } catch {
      missing.push(`${dir}/`)
    }
  }

  if (missing.length === 0) {
    return { status: 'pass', message: i18n.t('cli.doctor.dir_pass') }
  }

  return {
    status: 'fail',
    message: i18n.t('cli.doctor.dir_fail', { files: missing.join(', ') }),
    remediation: i18n.t('cli.doctor.dir_fix'),
  }
}

/** Known IDE configuration directories */
const IDE_PATHS: Record<string, string[]> = {
  'claude-code': ['.claude/commands', 'CLAUDE.md'],
  'cursor': ['.cursor/rules', '.cursorrules'],
  'gemini': ['.gemini'],
  'codex': ['.codex'],
}

/** Check IDE configuration directories exist */
export async function checkIdeConfigs(projectDir: string, i18n: I18nResolver): Promise<CheckResult> {
  const found: string[] = []
  const missing: string[] = []

  for (const [ide, paths] of Object.entries(IDE_PATHS)) {
    let ideFound = false
    for (const p of paths) {
      try {
        await access(join(projectDir, p))
        ideFound = true
        break
      } catch {
        // continue checking other paths for this IDE
      }
    }
    if (ideFound) {
      found.push(ide)
    } else {
      missing.push(ide)
    }
  }

  if (found.length === 0) {
    return {
      status: 'warn',
      message: i18n.t('cli.doctor.ide_warn', { ides: Object.keys(IDE_PATHS).join(', ') }),
      remediation: i18n.t('cli.doctor.ide_fix'),
    }
  }

  return { status: 'pass', message: i18n.t('cli.doctor.ide_pass', { ides: found.join(', ') }) }
}

/** Minimal YAML parser for squad.yaml (same approach as i18n) */
function parseSimpleYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')
  const stack: string[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line || line.startsWith('#')) continue

    const indent = line.length - line.trimStart().length
    const level = Math.floor(indent / 2)
    stack.splice(level)

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(indent, colonIdx).trim()
    const valueRaw = line.slice(colonIdx + 1).trim()

    if (valueRaw === '' || valueRaw.startsWith('#')) {
      stack[level] = key
    } else {
      const value = valueRaw.replace(/^["']|["']$/g, '')
      const fullKey = [...stack.slice(0, level), key].join('.')
      result[fullKey] = value
    }
  }
  return result
}

/** Check Squad structural integrity */
export async function checkSquadIntegrity(projectDir: string, i18n: I18nResolver): Promise<CheckResult> {
  const squadsDir = join(projectDir, '.buildpact', 'squads')

  let entries: string[]
  try {
    entries = await readdir(squadsDir)
  } catch {
    return {
      status: 'warn',
      message: i18n.t('cli.doctor.squad_warn'),
    }
  }

  // Filter out non-directory files (e.g., MAP.md)
  entries = entries.filter(e => !e.includes('.'))

  if (entries.length === 0) {
    return { status: 'warn', message: i18n.t('cli.doctor.squad_warn') }
  }

  const errors: string[] = []

  for (const entry of entries) {
    const squadYamlPath = join(squadsDir, entry, 'squad.yaml')
    let content: string
    try {
      content = await readFile(squadYamlPath, 'utf-8')
    } catch {
      errors.push(`${entry}: squad.yaml not found`)
      continue
    }

    const parsed = parseSimpleYaml(content)
    const requiredFields = ['name', 'version', 'domain', 'description', 'initial_level']
    for (const field of requiredFields) {
      if (!parsed[field]) {
        errors.push(`${entry}: missing required field '${field}'`)
      }
    }

    if (parsed['initial_level'] && !VALID_AUTOMATION_LEVELS.includes(parsed['initial_level'])) {
      errors.push(`${entry}: invalid initial_level '${parsed['initial_level']}' (expected L1-L4)`)
    }

    // Check agent files exist — file paths are relative to the squad directory
    const squadEntryDir = join(squadsDir, entry)
    const agentEntries = Object.entries(parsed)
      .filter(([k]) => k.startsWith('agents.') && k.endsWith('.file'))
      .map(([, v]) => v)

    for (const agentFile of agentEntries) {
      try {
        await access(join(squadEntryDir, agentFile))
      } catch {
        errors.push(`${entry}: agent file '${agentFile}' not found`)
      }
    }
  }

  if (errors.length > 0) {
    return {
      status: 'fail',
      message: i18n.t('cli.doctor.squad_fail', { errors: errors.join('; ') }),
      remediation: i18n.t('cli.doctor.squad_fix'),
    }
  }

  // Report first valid squad
  const firstSquadPath = join(squadsDir, entries[0]!, 'squad.yaml')
  try {
    const firstContent = await readFile(firstSquadPath, 'utf-8')
    const firstParsed = parseSimpleYaml(firstContent)
    return {
      status: 'pass',
      message: i18n.t('cli.doctor.squad_pass', {
        name: firstParsed['name'] ?? entries[0]!,
        version: firstParsed['version'] ?? 'unknown',
      }),
    }
  } catch {
    return { status: 'pass', message: i18n.t('cli.doctor.squad_pass', { name: entries[0]!, version: 'unknown' }) }
  }
}

/** Check constitution for internal conflicts */
export async function checkConstitutionConflicts(projectDir: string, i18n: I18nResolver): Promise<CheckResult> {
  const loadResult = await loadConstitution(projectDir)
  if (!loadResult.ok) {
    return {
      status: 'warn',
      message: i18n.t('cli.doctor.constitution_not_found'),
    }
  }

  const conflictsResult = detectConflicts(loadResult.value)
  if (!conflictsResult.ok) {
    return {
      status: 'fail',
      message: i18n.t('cli.doctor.constitution_check_failed'),
    }
  }

  const conflicts = conflictsResult.value
  if (conflicts.length === 0) {
    return {
      status: 'pass',
      message: i18n.t('cli.doctor.constitution_clean'),
    }
  }

  // Write report to .buildpact/reports/
  const reportsDir = join(projectDir, '.buildpact', 'reports')
  const reportPath = join(reportsDir, 'constitution-conflicts.md')
  try {
    await mkdir(reportsDir, { recursive: true })
    await writeFile(reportPath, formatConflictReportMarkdown(conflicts), 'utf-8')
  } catch {
    // Non-fatal — report display still works
  }

  const errors = conflicts.filter((c) => c.severity === 'error').length
  const warnings = conflicts.filter((c) => c.severity === 'warning').length

  return {
    status: errors > 0 ? 'fail' : 'warn',
    message: i18n.t('cli.doctor.constitution_conflicts', {
      errors: String(errors),
      warnings: String(warnings),
    }),
    remediation: i18n.t('cli.doctor.constitution_conflicts_fix', { path: reportPath }),
  }
}
