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
