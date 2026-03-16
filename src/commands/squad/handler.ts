/**
 * Squad command handler.
 * Implements `buildpact squad create <name>` and `buildpact squad add <name>`.
 * @see US-032 (Epic 8.1: Squad Scaffolding & Installation)
 */

import * as clack from '@clack/prompts'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import {
  scaffoldSquad,
  validateSquadStructure,
  validateSquadSecurity,
  installSquad,
} from '../../engine/squad-scaffolder.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read language from .buildpact/config.yaml, fallback to 'en' */
async function readLanguage(projectDir: string): Promise<SupportedLanguage> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('language:')) {
        const value = trimmed.slice('language:'.length).trim().replace(/^["']|["']$/g, '')
        if (value === 'pt-br' || value === 'en') return value
      }
    }
  } catch {
    // Config missing or unreadable — fall back to English
  }
  return 'en'
}

/** Validate squad name: alphanumeric, hyphens, underscores, 2-50 chars */
export function validateSquadName(name: string): Result<string> {
  if (!name || name.trim().length === 0) {
    return err({
      code: ERROR_CODES.SQUAD_INVALID_NAME,
      i18nKey: 'error.squad.invalid_name',
      params: { name: name ?? '' },
    })
  }
  const cleaned = name.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9_-]{1,48}[a-z0-9]$/.test(cleaned) && !/^[a-z0-9]{2,50}$/.test(cleaned)) {
    return err({
      code: ERROR_CODES.SQUAD_INVALID_NAME,
      i18nKey: 'error.squad.invalid_name',
      params: { name },
    })
  }
  return ok(cleaned)
}

// ---------------------------------------------------------------------------
// Sub-command: create
// ---------------------------------------------------------------------------

/**
 * Handle `buildpact squad create <name>`.
 * Scaffolds a new Squad in the current directory.
 */
export async function runCreate(args: string[], projectDir: string): Promise<Result<undefined>> {
  const lang = await readLanguage(projectDir)
  const i18n = createI18n(lang)
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'squad.jsonl'))

  clack.intro(i18n.t('cli.squad.create_welcome'))

  const rawName = args[0]
  const nameResult = validateSquadName(rawName ?? '')
  if (!nameResult.ok) {
    clack.log.error(i18n.t('cli.squad.invalid_name', { name: rawName ?? '(empty)' }))
    clack.outro(i18n.t('cli.squad.create_cancelled'))
    return err(nameResult.error)
  }
  const name = nameResult.value

  // Log intent
  await audit.log({
    action: 'squad.create.start',
    agent: 'squad-command',
    files: [],
    outcome: 'success',
  })

  const spinner = clack.spinner()
  spinner.start(i18n.t('cli.squad.create_scaffolding', { name }))

  const scaffoldResult = await scaffoldSquad(name, process.cwd())
  if (!scaffoldResult.ok) {
    spinner.stop(i18n.t('cli.squad.create_failed', { name }))
    await audit.log({
      action: 'squad.create.failed',
      agent: 'squad-command',
      files: [],
      outcome: 'failure',
      error: scaffoldResult.error.code,
    })
    clack.outro(i18n.t('cli.squad.create_cancelled'))
    return err(scaffoldResult.error)
  }

  const { squadDir, filesCreated } = scaffoldResult.value
  spinner.stop(i18n.t('cli.squad.create_done', { name, path: squadDir }))

  await audit.log({
    action: 'squad.create.complete',
    agent: 'squad-command',
    files: filesCreated,
    outcome: 'success',
  })

  clack.log.success(i18n.t('cli.squad.create_next_steps', { name }))
  clack.outro(i18n.t('cli.squad.create_outro', { name }))

  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Sub-command: add
// ---------------------------------------------------------------------------

/**
 * Handle `buildpact squad add <name>`.
 * In Alpha: expects a local path. Downloads from registry in v1.0.
 * Validates structure + security, then installs to .buildpact/squads/.
 */
export async function runAdd(args: string[], projectDir: string): Promise<Result<undefined>> {
  const lang = await readLanguage(projectDir)
  const i18n = createI18n(lang)
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'squad.jsonl'))

  clack.intro(i18n.t('cli.squad.add_welcome'))

  const rawName = args[0]
  if (!rawName || rawName.trim().length === 0) {
    clack.log.error(i18n.t('cli.squad.add_missing_name'))
    clack.outro(i18n.t('cli.squad.add_cancelled'))
    return err({
      code: ERROR_CODES.SQUAD_NOT_FOUND,
      i18nKey: 'error.squad.not_found',
      params: { name: rawName ?? '(empty)' },
    })
  }

  // Warn about unreviewed community Squads
  clack.log.warn(i18n.t('cli.squad.community_warning'))

  const shouldProceed = await clack.confirm({
    message: i18n.t('cli.squad.community_confirm'),
  })

  if (clack.isCancel(shouldProceed) || !shouldProceed) {
    clack.outro(i18n.t('cli.squad.add_cancelled'))
    return ok(undefined)
  }

  // In Alpha: treat rawName as a local directory path
  const sourceDir = resolve(rawName)

  await audit.log({
    action: 'squad.add.start',
    agent: 'squad-command',
    files: [sourceDir],
    outcome: 'success',
  })

  const spinner = clack.spinner()

  // Structural validation
  spinner.start(i18n.t('cli.squad.add_validating_structure'))
  const structureResult = await validateSquadStructure(sourceDir)
  if (!structureResult.ok) {
    spinner.stop(i18n.t('cli.squad.add_validation_failed'))
    await audit.log({ action: 'squad.add.structure_error', agent: 'squad-command', files: [], outcome: 'failure' })
    clack.outro(i18n.t('cli.squad.add_cancelled'))
    return err(structureResult.error)
  }

  if (structureResult.value.errors.length > 0) {
    spinner.stop(i18n.t('cli.squad.add_structure_errors', { count: String(structureResult.value.errors.length) }))
    for (const e of structureResult.value.errors) {
      clack.log.error(`  • ${e}`)
    }
    await audit.log({
      action: 'squad.add.structure_failed',
      agent: 'squad-command',
      files: [],
      outcome: 'failure',
      error: `${structureResult.value.errors.length} structural error(s)`,
    })
    clack.outro(i18n.t('cli.squad.add_cancelled'))
    return err({
      code: ERROR_CODES.SQUAD_VALIDATION_FAILED,
      i18nKey: 'error.squad.validation_failed',
      params: { count: String(structureResult.value.errors.length) },
    })
  }
  spinner.stop(i18n.t('cli.squad.add_structure_ok'))

  // Security validation
  spinner.start(i18n.t('cli.squad.add_validating_security'))
  const securityResult = await validateSquadSecurity(sourceDir)
  if (!securityResult.ok) {
    spinner.stop(i18n.t('cli.squad.add_validation_failed'))
    await audit.log({ action: 'squad.add.security_error', agent: 'squad-command', files: [], outcome: 'failure' })
    clack.outro(i18n.t('cli.squad.add_cancelled'))
    return err(securityResult.error)
  }

  if (securityResult.value.errors.length > 0) {
    spinner.stop(i18n.t('cli.squad.add_security_errors', { count: String(securityResult.value.errors.length) }))
    for (const e of securityResult.value.errors) {
      clack.log.error(`  • ${e}`)
    }
    await audit.log({
      action: 'squad.add.security_failed',
      agent: 'squad-command',
      files: [],
      outcome: 'failure',
      error: `${securityResult.value.errors.length} security issue(s)`,
    })
    clack.outro(i18n.t('cli.squad.add_blocked'))
    return err({
      code: ERROR_CODES.SQUAD_VALIDATION_FAILED,
      i18nKey: 'error.squad.validation_failed',
      params: { count: String(securityResult.value.errors.length) },
    })
  }
  spinner.stop(i18n.t('cli.squad.add_security_ok'))

  // Install
  spinner.start(i18n.t('cli.squad.add_installing'))
  const installResult = await installSquad(sourceDir, projectDir)
  if (!installResult.ok) {
    spinner.stop(i18n.t('cli.squad.add_install_failed'))
    await audit.log({
      action: 'squad.add.install_failed',
      agent: 'squad-command',
      files: [],
      outcome: 'failure',
      error: installResult.error.code,
    })
    clack.outro(i18n.t('cli.squad.add_cancelled'))
    return err(installResult.error)
  }

  spinner.stop(i18n.t('cli.squad.add_done', { path: installResult.value }))

  await audit.log({
    action: 'squad.add.complete',
    agent: 'squad-command',
    files: [installResult.value],
    outcome: 'success',
  })

  clack.outro(i18n.t('cli.squad.add_outro', { name: rawName }))
  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(args: string[]) {
    const projectDir = process.cwd()
    const subcommand = args[0]
    const subArgs = args.slice(1)

    if (subcommand === 'create') {
      return runCreate(subArgs, projectDir)
    }

    if (subcommand === 'add') {
      return runAdd(subArgs, projectDir)
    }

    // Unknown subcommand — show usage hint
    const lang = await readLanguage(projectDir)
    const i18n = createI18n(lang)
    clack.log.warn(i18n.t('cli.squad.unknown_subcommand', { subcommand: subcommand ?? '(none)' }))
    clack.log.info(i18n.t('cli.squad.usage_hint'))
    return ok(undefined)
  },
}
