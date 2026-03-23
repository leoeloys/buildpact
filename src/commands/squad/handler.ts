/**
 * Squad command handler.
 * Implements `buildpact squad create <name>` and `buildpact squad add <name>`.
 * @see US-032 (Epic 8.1: Squad Scaffolding & Installation)
 */

import * as clack from '@clack/prompts'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
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
  validateHandoffGraph,
  installSquad,
} from '../../engine/squad-scaffolder.js'
import { isRegistryName, downloadSquadFromHub } from '../../engine/community-hub.js'
import {
  readApprovalStore,
  scanAgentSuggestions,
  applyLevelChange,
} from '../../squads/leveling.js'
import { runSmokeTests } from '../../engine/squad-smoke-test.js'
import { calculateQualityScore, scoreToBadge } from '../../engine/hub-search.js'
import { validateSquad, toJsonOutput } from '../../squads/validator.js'

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
 * Accepts either a squad name (downloads from community hub) or a local path.
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

  // Detect whether input is a registry name or a local path
  let sourceDir: string
  let tempDir: string | undefined

  if (isRegistryName(rawName)) {
    // Download from community hub
    const spinner = clack.spinner()
    spinner.start(i18n.t('cli.squad.hub_downloading', { name: rawName }))
    tempDir = await mkdtemp(join(tmpdir(), 'bp-hub-'))
    const downloadResult = await downloadSquadFromHub(rawName, tempDir)
    if (!downloadResult.ok) {
      spinner.stop(i18n.t('cli.squad.hub_download_failed', { name: rawName }))
      await rm(tempDir, { recursive: true, force: true })
      clack.outro(i18n.t('cli.squad.add_cancelled'))
      return err(downloadResult.error)
    }
    spinner.stop(i18n.t('cli.squad.hub_downloaded', { name: rawName }))

    // Warn if squad has not been reviewed by a BuildPact maintainer
    if (!downloadResult.value.manifest.reviewed) {
      clack.log.warn(i18n.t('cli.squad.hub.unreviewed_warning', { name: rawName }))
    }

    sourceDir = tempDir
  } else {
    // Treat as local path
    sourceDir = resolve(rawName)
  }

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
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
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
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
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
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
    clack.outro(i18n.t('cli.squad.add_blocked'))
    return err({
      code: ERROR_CODES.SQUAD_VALIDATION_FAILED,
      i18nKey: 'error.squad.validation_failed',
      params: { count: String(securityResult.value.errors.length) },
    })
  }
  spinner.stop(i18n.t('cli.squad.add_security_ok'))

  // Quality score check — warn if below 50
  const smokeResult = await runSmokeTests(sourceDir, rawName)
  if (smokeResult.ok) {
    const { readdir, access } = await import('node:fs/promises')
    let agentCount = 0
    let testFixtureCount = 0
    let hasReadme = false
    let hasChangelog = false
    let hasExamples = false

    try {
      const agentFiles = await readdir(join(sourceDir, 'agents'))
      agentCount = agentFiles.filter(f => f.endsWith('.md')).length
    } catch { /* no agents dir */ }

    try { await access(join(sourceDir, 'README.md')); hasReadme = true } catch { /* no readme */ }
    try { await access(join(sourceDir, 'CHANGELOG.md')); hasChangelog = true } catch { /* no changelog */ }
    try {
      const entries = await readdir(sourceDir)
      hasExamples = entries.some(e => e === 'examples' || e === 'fixtures')
      testFixtureCount = entries.filter(e => e.endsWith('.test.yaml') || e.endsWith('.fixture.yaml')).length
      if (hasExamples) {
        try {
          const exampleFiles = await readdir(join(sourceDir, 'examples'))
          testFixtureCount += exampleFiles.length
        } catch { /* empty examples */ }
      }
    } catch { /* can't read dir */ }

    const quality = calculateQualityScore(smokeResult.value, {
      hasReadme, hasChangelog, hasExamples, testFixtureCount, agentCount,
    })
    const badge = scoreToBadge(quality.total)

    clack.log.info(`Quality: ${quality.total}/100 (${badge})`)

    if (quality.total < 50) {
      const proceed = await clack.confirm({
        message: i18n.t('cli.hub.quality_low_warning', { score: String(quality.total) }),
        initialValue: false,
      })
      if (clack.isCancel(proceed) || !proceed) {
        if (tempDir) await rm(tempDir, { recursive: true, force: true })
        clack.outro(i18n.t('cli.squad.add_cancelled'))
        return ok(undefined)
      }
    }
  }

  // Install
  spinner.start(i18n.t('cli.squad.add_installing'))
  const installResult = await installSquad(sourceDir, projectDir)
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
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
// Sub-command: validate
// ---------------------------------------------------------------------------

/**
 * Handle `buildpact squad validate <path> [--community]`.
 * Runs comprehensive structural and security validation with a detailed PASS/FAIL report.
 */
export async function runValidate(args: string[], projectDir: string): Promise<Result<undefined>> {
  const lang = await readLanguage(projectDir)
  const i18n = createI18n(lang)
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'squad.jsonl'))

  const isCommunity = args.includes('--community')
  const isJson = args.includes('--json')
  const pathArgs = args.filter(a => !a.startsWith('--'))

  // --json path: machine-readable output, no clack, for CI/CD consumption
  if (isJson) {
    const rawPath = pathArgs[0]
    if (!rawPath || rawPath.trim().length === 0) {
      process.stdout.write(JSON.stringify([{
        check: 'system', passed: false, message: 'Missing squad path argument', suggestedFix: 'Usage: buildpact squad validate <path> [--community] [--json]',
      }]) + '\n')
      return err({
        code: ERROR_CODES.SQUAD_NOT_FOUND,
        i18nKey: 'error.squad.not_found',
        params: { name: '(none)' },
      })
    }
    const squadDir = resolve(rawPath)
    const validateResult = await validateSquad(squadDir, { community: isCommunity })
    if (!validateResult.ok) {
      process.stdout.write(JSON.stringify([{
        check: 'system', passed: false, message: validateResult.error.code, suggestedFix: 'Ensure the squad directory exists and is readable',
      }]) + '\n')
      return err(validateResult.error)
    }
    const items = toJsonOutput(validateResult.value)
    process.stdout.write(JSON.stringify(items) + '\n')
    await audit.log({
      action: 'squad.validate.json',
      agent: 'squad-command',
      files: [squadDir],
      outcome: validateResult.value.passed ? 'success' : 'failure',
    })
    if (!validateResult.value.passed) {
      return err({
        code: ERROR_CODES.SQUAD_VALIDATION_FAILED,
        i18nKey: 'error.squad.validation_failed',
        params: { count: String(validateResult.value.totalErrors) },
      })
    }
    return ok(undefined)
  }

  clack.intro(i18n.t('cli.squad.validate_welcome'))

  const rawPath = pathArgs[0]
  if (!rawPath || rawPath.trim().length === 0) {
    clack.log.error(i18n.t('cli.squad.validate_missing_path'))
    clack.outro(i18n.t('cli.squad.validate_cancelled'))
    return err({
      code: ERROR_CODES.SQUAD_NOT_FOUND,
      i18nKey: 'error.squad.not_found',
      params: { name: rawPath ?? '(none)' },
    })
  }

  const squadDir = resolve(rawPath)

  await audit.log({
    action: 'squad.validate.start',
    agent: 'squad-command',
    files: [squadDir],
    outcome: 'success',
  })

  const spinner = clack.spinner()

  // --- Structural validation ---
  spinner.start(i18n.t('cli.squad.validate_checking_structure'))
  const structureResult = await validateSquadStructure(squadDir)
  if (!structureResult.ok) {
    spinner.stop(i18n.t('cli.squad.validate_check_failed'))
    clack.outro(i18n.t('cli.squad.validate_cancelled'))
    return err(structureResult.error)
  }
  spinner.stop(i18n.t('cli.squad.validate_structure_done'))

  const structErrors = structureResult.value.errors
  if (structErrors.length === 0) {
    clack.log.success(i18n.t('cli.squad.validate_structure_pass'))
  } else {
    clack.log.error(i18n.t('cli.squad.validate_structure_fail', { count: String(structErrors.length) }))
    for (const e of structErrors) {
      clack.log.error(`  ✗ ${e}`)
    }
  }

  // --- Handoff graph validation ---
  spinner.start(i18n.t('cli.squad.validate_checking_handoffs'))
  const handoffResult = await validateHandoffGraph(squadDir)
  if (handoffResult.ok) {
    spinner.stop(i18n.t('cli.squad.validate_handoffs_done'))
    const handoffErrors = handoffResult.value.errors
    if (handoffErrors.length === 0) {
      clack.log.success(i18n.t('cli.squad.validate_handoffs_pass'))
    } else {
      clack.log.warn(i18n.t('cli.squad.validate_handoffs_fail', { count: String(handoffErrors.length) }))
      for (const e of handoffErrors) {
        clack.log.warn(`  ⚠ ${e}`)
      }
    }
  } else {
    spinner.stop(i18n.t('cli.squad.validate_check_failed'))
  }

  const handoffErrors = handoffResult.ok ? handoffResult.value.errors : []

  // --- Security validation (community squads only) ---
  let securityErrors: string[] = []
  if (isCommunity) {
    spinner.start(i18n.t('cli.squad.validate_checking_security'))
    const securityResult = await validateSquadSecurity(squadDir)
    if (securityResult.ok) {
      spinner.stop(i18n.t('cli.squad.validate_security_done'))
      securityErrors = securityResult.value.errors
      if (securityErrors.length === 0) {
        clack.log.success(i18n.t('cli.squad.validate_security_pass'))
      } else {
        clack.log.error(i18n.t('cli.squad.validate_security_fail', { count: String(securityErrors.length) }))
        for (const e of securityErrors) {
          clack.log.error(`  ✗ ${e}`)
        }
      }
    } else {
      spinner.stop(i18n.t('cli.squad.validate_check_failed'))
    }
  }

  // --- Final summary ---
  const totalErrors = structErrors.length + handoffErrors.length + securityErrors.length

  if (totalErrors === 0) {
    await audit.log({
      action: 'squad.validate.complete',
      agent: 'squad-command',
      files: [squadDir],
      outcome: 'success',
    })
    clack.outro(i18n.t('cli.squad.validate_pass'))
    return ok(undefined)
  }

  // Community squads blocked if security issues exist
  if (isCommunity && securityErrors.length > 0) {
    await audit.log({
      action: 'squad.validate.blocked',
      agent: 'squad-command',
      files: [],
      outcome: 'failure',
      error: `${securityErrors.length} security issue(s)`,
    })
    clack.outro(i18n.t('cli.squad.validate_blocked'))
    return err({
      code: ERROR_CODES.SQUAD_VALIDATION_FAILED,
      i18nKey: 'error.squad.validation_failed',
      params: { count: String(securityErrors.length) },
    })
  }

  await audit.log({
    action: 'squad.validate.failed',
    agent: 'squad-command',
    files: [],
    outcome: 'failure',
    error: `${totalErrors} error(s)`,
  })
  clack.outro(i18n.t('cli.squad.validate_fail', { count: String(totalErrors) }))
  return err({
    code: ERROR_CODES.SQUAD_VALIDATION_FAILED,
    i18nKey: 'error.squad.validation_failed',
    params: { count: String(totalErrors) },
  })
}

// ---------------------------------------------------------------------------
// Sub-command: level check
// ---------------------------------------------------------------------------

/**
 * Handle `buildpact squad level check`.
 * Scans the approval store and suggests promotions/demotions with user confirmation.
 */
export async function runLevelCheck(args: string[], projectDir: string): Promise<Result<undefined>> {
  const lang = await readLanguage(projectDir)
  const i18n = createI18n(lang)

  clack.intro(i18n.t('cli.autonomy.check_welcome'))

  const store = await readApprovalStore(projectDir)
  const suggestions = scanAgentSuggestions(store)

  if (suggestions.length === 0) {
    clack.outro(i18n.t('cli.autonomy.no_suggestions'))
    return ok(undefined)
  }

  for (const suggestion of suggestions) {
    const i18nKey = suggestion.direction === 'promotion'
      ? 'cli.autonomy.promote_suggest'
      : 'cli.autonomy.demote_suggest'

    const confirmed = await clack.confirm({
      message: i18n.t(i18nKey, {
        agent: suggestion.agentId,
        rate: Math.round(suggestion.rate * 100).toString(),
        from: suggestion.currentLevel,
        to: suggestion.suggestedLevel,
      }),
    })

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.log.info(i18n.t('cli.autonomy.level_unchanged', { agent: suggestion.agentId }))
      continue
    }

    const applyResult = await applyLevelChange(suggestion, projectDir)
    if (!applyResult.ok) {
      clack.log.error(i18n.t('error.autonomy.store_failed'))
      return err(applyResult.error)
    }

    clack.log.success(i18n.t('cli.autonomy.level_changed', {
      agent: suggestion.agentId,
      from: suggestion.currentLevel,
      to: suggestion.suggestedLevel,
    }))
  }

  clack.outro(i18n.t('cli.autonomy.check_welcome'))
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

    if (subcommand === 'validate') {
      return runValidate(subArgs, projectDir)
    }

    if (subcommand === 'level' && subArgs[0] === 'check') {
      return runLevelCheck(subArgs.slice(1), projectDir)
    }

    // Unknown subcommand — show usage hint
    const lang = await readLanguage(projectDir)
    const i18n = createI18n(lang)
    clack.log.warn(i18n.t('cli.squad.unknown_subcommand', { subcommand: subcommand ?? '(none)' }))
    clack.log.info(i18n.t('cli.squad.usage_hint'))
    return ok(undefined)
  },
}
