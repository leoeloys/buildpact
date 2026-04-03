/**
 * Upgrade command handler — checks GitHub for CLI updates, then migrates project schema.
 *
 * Flow:
 * 1. Check GitHub for newer CLI version → pull + rebuild if found
 * 2. Migrate project schema to current CLI version
 *
 * @module commands/upgrade
 */

import * as clack from '@clack/prompts'
import { join } from 'node:path'
import { createI18n } from '../../foundation/i18n.js'
import { readProjectSchema } from '../../foundation/version-guard.js'
import { CURRENT_SCHEMA_VERSION } from '../../foundation/version-guard.js'
import { listPendingMigrations, runMigrations } from '../../foundation/migrator.js'
import {
  findRepoRoot,
  readCurrentVersion,
  checkRemoteForUpdates,
  pullAndRebuild,
} from '../../foundation/self-updater.js'
import { reinstall } from '../../foundation/reinstaller.js'
import { clearUpdateCache } from '../../foundation/update-notifier.js'
import { AuditLogger } from '../../foundation/audit.js'
import { ok, err } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'

export async function runUpgrade(args: string[]): Promise<Result<void>> {
  const projectDir = process.cwd()
  const dryRun = args.includes('--dry-run')
  const skipSelfUpdate = args.includes('--skip-self-update')
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'upgrade.jsonl'))

  clack.intro('BuildPact — Upgrade')

  // Detect language from existing config
  let lang: SupportedLanguage = 'en'
  try {
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    const match = content.match(/^language:\s*["']?([a-z-]+)["']?/m)
    if (match?.[1] === 'pt-br') lang = 'pt-br'
  } catch { /* use default */ }

  const i18n = createI18n(lang)

  // ─── Step 1: Self-update CLI from GitHub ───────────────────────────
  if (!skipSelfUpdate) {
    const repoRoot = findRepoRoot()

    if (repoRoot) {
      const currentVersion = readCurrentVersion(repoRoot)
      clack.log.info(i18n.t('cli.upgrade.current_cli_version', { version: currentVersion }))

      const spinner = clack.spinner()
      spinner.start(i18n.t('cli.upgrade.checking_remote'))

      const remoteCheck = checkRemoteForUpdates(repoRoot)

      if (!remoteCheck.ok) {
        spinner.stop(i18n.t('cli.upgrade.remote_check_failed'))
        clack.log.warn(i18n.t('cli.upgrade.remote_offline'))
      } else if (remoteCheck.value.behind === 0) {
        spinner.stop(i18n.t('cli.upgrade.cli_up_to_date'))
        clearUpdateCache()
      } else {
        spinner.stop(i18n.t('cli.upgrade.cli_update_available', {
          count: String(remoteCheck.value.behind),
        }))

        if (dryRun) {
          clack.log.info(i18n.t('cli.upgrade.dry_run_notice'))
        } else {
          const confirmUpdate = await clack.confirm({
            message: i18n.t('cli.upgrade.confirm_cli_update'),
          })

          if (!clack.isCancel(confirmUpdate) && confirmUpdate) {
            const updateSpinner = clack.spinner()
            updateSpinner.start(i18n.t('cli.upgrade.pulling'))

            const updateResult = pullAndRebuild(repoRoot)

            if (updateResult.ok) {
              updateSpinner.stop(i18n.t('cli.upgrade.cli_updated', {
                from: updateResult.value.previousVersion,
                to: updateResult.value.newVersion,
              }))
              clearUpdateCache()
            } else {
              updateSpinner.stop(i18n.t('cli.upgrade.pull_failed'))
              clack.log.warn(updateResult.error.params?.reason ?? 'Pull failed')
            }
          }
        }
      }
    } else {
      clack.log.info(i18n.t('cli.upgrade.not_in_repo'))
    }
  }

  // ─── Step 2: Migrate project schema ────────────────────────────────
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
      clack.log.warn(i18n.t('cli.upgrade.no_schema'))
    } catch {
      clack.log.error(i18n.t('cli.upgrade.no_project'))
      return err({
        code: 'CONFIG_INVALID',
        i18nKey: 'error.upgrade.no_project',
      })
    }
  }

  // Check if already current schema
  if (effectiveSchema >= CURRENT_SCHEMA_VERSION) {
    clack.log.success(i18n.t('cli.upgrade.already_current', { version: String(CURRENT_SCHEMA_VERSION) }))
  }

  // ─── Step 3: Run schema migrations if needed ───────────────────────
  const pending = listPendingMigrations(effectiveSchema, CURRENT_SCHEMA_VERSION)

  if (pending.length > 0) {
    clack.log.info(i18n.t('cli.upgrade.migrations_planned'))
    for (const m of pending) {
      clack.log.step(`  v${m.fromSchema} → v${m.toSchema}: ${m.description}`)
    }

    if (dryRun) {
      clack.log.info(i18n.t('cli.upgrade.dry_run_notice'))
      clack.outro('')
      return ok(undefined)
    }

    spinner.start(i18n.t('cli.upgrade.running'))
    const migrationResult = await runMigrations(projectDir, effectiveSchema, CURRENT_SCHEMA_VERSION)
    if (!migrationResult.ok) {
      spinner.stop(i18n.t('cli.upgrade.migration_failed'))
      return migrationResult as Result<void>
    }
    spinner.stop(i18n.t('cli.upgrade.success', {
      from: String(migrationResult.value.fromSchema),
      to: String(migrationResult.value.toSchema),
    }))
  }

  // ─── Step 4: Reinstall all components (always) ─────────────────────
  if (dryRun) {
    clack.log.info(i18n.t('cli.upgrade.dry_run_notice'))
    clack.outro('')
    return ok(undefined)
  }

  spinner.start(i18n.t('cli.upgrade.reinstalling'))
  const reinstallResult = await reinstall(projectDir)

  if (!reinstallResult.ok) {
    spinner.stop(i18n.t('cli.upgrade.reinstall_failed'))
    clack.log.warn(reinstallResult.error.code)
  } else {
    const r = reinstallResult.value
    spinner.stop(i18n.t('cli.upgrade.reinstall_done', { version: r.cliVersion }))
    if (r.commandsUpdated > 0) {
      clack.log.success(i18n.t('cli.upgrade.commands_refreshed', { count: String(r.commandsUpdated) }))
    }
    if (r.squadUpdated) {
      clack.log.success(i18n.t('cli.upgrade.squad_updated'))
    }
    if (r.filesModified.length > 0) {
      clack.log.info(`${r.filesModified.length} file(s) updated`)
    }
  }

  await audit.log({
    action: 'upgrade.flow_complete',
    agent: 'cli',
    files: [],
    outcome: 'success',
  })

  clack.outro(i18n.t('cli.upgrade.all_done'))
  return ok(undefined)
}
