/**
 * Upgrade command handler — migrate project schema to current CLI version.
 * Runs sequential migrations and updates config.yaml with new schema version.
 * @module commands/upgrade
 */

import * as clack from '@clack/prompts'
import { join } from 'node:path'
import { createI18n } from '../../foundation/i18n.js'
import { readProjectSchema } from '../../foundation/version-guard.js'
import { CURRENT_SCHEMA_VERSION } from '../../foundation/version-guard.js'
import { listPendingMigrations, runMigrations } from '../../foundation/migrator.js'
import { AuditLogger } from '../../foundation/audit.js'
import { ok, err } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'

export async function runUpgrade(args: string[]): Promise<Result<void>> {
  const projectDir = process.cwd()
  const dryRun = args.includes('--dry-run')
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'upgrade.jsonl'))

  clack.intro('BuildPact — Project Upgrade')

  // Detect language from existing config (quick read)
  let lang: SupportedLanguage = 'en'
  try {
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    const match = content.match(/^language:\s*["']?([a-z-]+)["']?/m)
    if (match?.[1] === 'pt-br') lang = 'pt-br'
  } catch { /* use default */ }

  const i18n = createI18n(lang)

  // Read current schema
  const spinner = clack.spinner()
  spinner.start(i18n.t('cli.upgrade.reading_schema'))

  const currentSchema = await readProjectSchema(projectDir)
  const effectiveSchema = currentSchema ?? 0

  spinner.stop()

  // Check if project exists
  if (currentSchema === null) {
    try {
      const { access } = await import('node:fs/promises')
      await access(join(projectDir, '.buildpact', 'config.yaml'))
      // File exists but no schema — treat as schema 0
      clack.log.warn(i18n.t('cli.upgrade.no_schema'))
    } catch {
      clack.log.error(i18n.t('cli.upgrade.no_project'))
      return err({
        code: 'CONFIG_INVALID',
        i18nKey: 'error.upgrade.no_project',
      })
    }
  }

  // Check if already current
  if (effectiveSchema >= CURRENT_SCHEMA_VERSION) {
    clack.log.success(i18n.t('cli.upgrade.already_current', { version: String(CURRENT_SCHEMA_VERSION) }))
    clack.outro('')
    return ok(undefined)
  }

  // List pending migrations
  const pending = listPendingMigrations(effectiveSchema, CURRENT_SCHEMA_VERSION)

  if (pending.length === 0) {
    clack.log.success(i18n.t('cli.upgrade.already_current', { version: String(CURRENT_SCHEMA_VERSION) }))
    clack.outro('')
    return ok(undefined)
  }

  clack.log.info(i18n.t('cli.upgrade.migrations_planned'))
  for (const m of pending) {
    clack.log.step(`  v${m.fromSchema} → v${m.toSchema}: ${m.description}`)
  }

  if (dryRun) {
    clack.log.info(i18n.t('cli.upgrade.dry_run_notice'))
    clack.outro('')
    return ok(undefined)
  }

  // Confirm
  const confirmed = await clack.confirm({
    message: i18n.t('cli.upgrade.confirm', { count: String(pending.length) }),
  })

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.cancel(i18n.t('cli.adopt.cancelled'))
    return ok(undefined)
  }

  // Run migrations
  spinner.start(i18n.t('cli.upgrade.running'))

  const result = await runMigrations(projectDir, effectiveSchema, CURRENT_SCHEMA_VERSION)

  if (!result.ok) {
    spinner.stop(i18n.t('cli.upgrade.migration_failed'))
    return result as Result<void>
  }

  spinner.stop(i18n.t('cli.upgrade.success', {
    from: String(result.value.fromSchema),
    to: String(result.value.toSchema),
  }))

  const totalModified = result.value.results.reduce((sum, r) => sum + r.filesModified.length, 0)
  const totalCreated = result.value.results.reduce((sum, r) => sum + r.filesCreated.length, 0)
  if (totalModified > 0) clack.log.info(`${totalModified} file(s) modified`)
  if (totalCreated > 0) clack.log.info(`${totalCreated} file(s) created`)

  await audit.log({
    action: 'upgrade.flow_complete',
    agent: 'cli',
    files: [],
    outcome: 'success',
  })

  clack.outro('')
  return ok(undefined)
}
