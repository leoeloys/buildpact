#!/usr/bin/env node
/**
 * BuildPact CLI Entry Point
 * Handles `npx buildpact init <project-name>` and all `/bp:` pipeline commands.
 *
 * ARCHITECTURE RULE: Zero business logic here.
 * This file instantiates @clack/prompts and delegates to command handlers or the installer.
 */
import * as clack from '@clack/prompts'
import { resolve, join } from 'node:path'
import { createI18n } from '../foundation/i18n.js'
import { install } from '../foundation/installer.js'
import { AuditLogger } from '../foundation/audit.js'
import { checkProjectVersion } from '../foundation/version-guard.js'
import type { SupportedLanguage } from '../contracts/i18n.js'
import type { IdeId } from '../foundation/installer.js'

const VERSION = '2.0.0'

/** Minimum Node.js major version required by BuildPact */
const MIN_NODE_MAJOR = 20

/**
 * Check Node.js version at startup.
 * Prints a warning if below minimum but does not crash.
 */
function checkNodeVersion(): void {
  const major = parseInt(process.version.slice(1).split('.')[0]!, 10)
  if (major < MIN_NODE_MAJOR) {
    console.warn(
      `Warning: BuildPact requires Node.js >= ${MIN_NODE_MAJOR}. ` +
      `You are running ${process.version}. Some features may not work correctly.`,
    )
  }
}

async function main(): Promise<void> {
  // Check Node.js version early — warn but don't crash
  checkNodeVersion()

  // Detect --ci flag: may appear before or after the command name
  const rawArgs = process.argv.slice(2)
  const ciActive = rawArgs.includes('--ci') || process.env.BP_CI === 'true'
  // Strip --ci from position 0 to prevent it from being interpreted as the command name
  const cleanedArgs = rawArgs[0] === '--ci' ? rawArgs.slice(1) : rawArgs
  const [command, ...args] = cleanedArgs

  if (ciActive) {
    console.log('[ci] non-interactive mode enabled')
  }

  // Handle pipeline commands: buildpact <command> [args]
  if (command && command !== 'init') {
    const { resolveCommand } = await import('../commands/registry.js')
    const audit = new AuditLogger(join(process.cwd(), '.buildpact', 'audit', 'cli.jsonl'))
    await audit.log({ action: 'cli.command.start', agent: 'cli', files: [], outcome: 'success' })

    // Version guard: check project schema compatibility before running commands
    // Skip for commands that don't require an existing project
    const SKIP_VERSION_GUARD = ['doctor', 'adopt', 'help', 'completion', 'hub', 'learn', 'agent']
    if (!SKIP_VERSION_GUARD.includes(command)) {
      const versionCheck = await checkProjectVersion(process.cwd())
      if (versionCheck.status === 'cli_too_old') {
        console.error(
          `Error: Project uses schema v${versionCheck.projectSchema} but this CLI ` +
          `supports up to v${versionCheck.cliSchema}. Run: npm update -g buildpact`,
        )
        process.exit(1)
      }
      if (versionCheck.status === 'upgrade_required') {
        console.error(
          `Error: Project schema v${versionCheck.projectSchema} is incompatible ` +
          `with this CLI (v${versionCheck.cliSchema}). Run: buildpact upgrade`,
        )
        process.exit(1)
      }
      if (versionCheck.status === 'upgrade_available') {
        console.warn(
          `Notice: Project schema v${versionCheck.projectSchema} can be upgraded ` +
          `to v${versionCheck.cliSchema}. Run 'buildpact upgrade' when convenient.`,
        )
      }
    }

    // Readonly mode guard
    const { checkReadonly } = await import('../foundation/readonly-guard.js')
    const readonlyCheck = checkReadonly(process.cwd(), command)
    if (!readonlyCheck.ok) {
      console.error(`Error: ${readonlyCheck.error.code} — ${readonlyCheck.error.i18nKey}`)
      process.exit(1)
    }

    const result = await resolveCommand(command)
    if (!result.ok) {
      const { listCommands } = await import('../commands/registry.js')
      await audit.log({ action: 'cli.command.resolve', agent: 'cli', files: [], outcome: 'failure', error: `Unknown command: ${command}` })
      console.error(`Unknown command: ${command}`)
      console.error(`Available commands: init, ${listCommands().join(', ')}`)
      process.exit(1)
    }
    const cmdResult = await result.value.run(args)
    if (!cmdResult.ok) {
      await audit.log({ action: `cli.command.${command}`, agent: 'cli', files: [], outcome: 'failure', error: cmdResult.error.code })
      console.error(`Error: ${cmdResult.error.code}`)
      if (cmdResult.error.phase) {
        console.error(`This feature is available in ${cmdResult.error.phase}`)
      }
      process.exit(1)
    }
    await audit.log({ action: `cli.command.${command}`, agent: 'cli', files: [], outcome: 'success' })
    return
  }

  // Handle: buildpact init <project-name>
  await runInstallFlow(args[0])
}

async function runInstallFlow(projectNameArg?: string): Promise<void> {
  const auditPath = join(process.cwd(), '.buildpact', 'audit', 'cli.jsonl')
  const audit = new AuditLogger(auditPath)

  await audit.log({ action: 'cli.install.flow_start', agent: 'cli', files: [], outcome: 'success' })
  clack.intro(`BuildPact v${VERSION}`)

  // Step 1: Language selection
  const langChoice = await clack.select({
    message: 'Select your language / Selecione seu idioma',
    options: [
      { value: 'en', label: 'English' },
      { value: 'pt-br', label: 'Português (Brasil)' },
    ],
  })

  if (clack.isCancel(langChoice)) {
    clack.cancel('Installation cancelled.')
    process.exit(0)
  }

  const lang = langChoice as SupportedLanguage
  const i18n = createI18n(lang)

  // Intro note — explain what will be set up
  clack.note(i18n.t('cli.install.intro_note'), i18n.t('cli.install.intro_title'))

  await audit.log({ action: 'cli.install.language_selected', agent: 'cli', files: [], outcome: 'success' })

  // Step 2: Initialize here or create new folder?
  let projectName: string
  let projectDir: string

  if (!projectNameArg) {
    const locationChoice = await clack.select({
      message: i18n.t('cli.install.location_question'),
      options: [
        {
          value: 'here',
          label: i18n.t('cli.install.location_here'),
          hint: i18n.t('cli.install.location_here_hint'),
        },
        {
          value: 'new',
          label: i18n.t('cli.install.location_new'),
          hint: i18n.t('cli.install.location_new_hint'),
        },
      ],
    })

    if (clack.isCancel(locationChoice)) {
      clack.cancel(i18n.t('cli.install.cancelled'))
      process.exit(0)
    }

    if (locationChoice === 'here') {
      projectDir = resolve(process.cwd())
      projectName = projectDir.split('/').pop() ?? 'my-project'
    } else {
      const nameInput = await clack.text({
        message: i18n.t('cli.install.project_name_prompt'),
        placeholder: 'my-project',
        validate(value) {
          if (!value || value.trim().length === 0) return i18n.t('cli.install.project_name_required')
          if (!/^[a-z0-9-_]+$/i.test(value.trim())) return i18n.t('cli.install.project_name_invalid')
        },
      })
      if (clack.isCancel(nameInput)) {
        clack.cancel(i18n.t('cli.install.cancelled'))
        process.exit(0)
      }
      projectName = (nameInput as string).trim()
      projectDir = resolve(process.cwd(), projectName)
    }
  } else {
    projectName = projectNameArg
    projectDir = resolve(process.cwd(), projectName)
  }

  await audit.log({ action: 'cli.install.project_named', agent: 'cli', files: [], outcome: 'success' })

  // Step 3: Domain selection
  const domain = await clack.select({
    message: i18n.t('cli.install.select_domain'),
    options: [
      { value: 'software', label: i18n.t('domain.software'), hint: i18n.t('domain.software_hint') },
      { value: 'marketing', label: i18n.t('domain.marketing'), hint: i18n.t('domain.marketing_hint') },
      { value: 'health', label: i18n.t('domain.health'), hint: i18n.t('domain.health_hint') },
      { value: 'research', label: i18n.t('domain.research'), hint: i18n.t('domain.research_hint') },
      { value: 'management', label: i18n.t('domain.management'), hint: i18n.t('domain.management_hint') },
      { value: 'custom', label: i18n.t('domain.custom'), hint: i18n.t('domain.custom_hint') },
    ],
  })

  if (clack.isCancel(domain)) {
    clack.cancel(i18n.t('cli.install.cancelled'))
    process.exit(0)
  }

  await audit.log({ action: 'cli.install.domain_selected', agent: 'cli', files: [], outcome: 'success' })

  // Step 4: IDE multi-select
  const ideChoices = await clack.multiselect({
    message: i18n.t('cli.install.select_ides'),
    options: [
      { value: 'claude-code', label: 'Claude Code', hint: i18n.t('ide.claude_code_hint') },
      { value: 'cursor', label: 'Cursor', hint: i18n.t('ide.cursor_hint') },
      { value: 'gemini', label: 'Gemini CLI', hint: i18n.t('ide.gemini_hint') },
      { value: 'codex', label: 'Codex CLI', hint: i18n.t('ide.codex_hint') },
    ],
    required: true,
  })

  if (clack.isCancel(ideChoices)) {
    clack.cancel(i18n.t('cli.install.cancelled'))
    process.exit(0)
  }

  await audit.log({ action: 'cli.install.ides_selected', agent: 'cli', files: [], outcome: 'success' })

  // Step 5: Experience level
  const experience = await clack.select({
    message: i18n.t('cli.install.select_experience'),
    options: [
      { value: 'beginner', label: i18n.t('experience.beginner'), hint: i18n.t('experience.beginner_hint') },
      { value: 'intermediate', label: i18n.t('experience.intermediate'), hint: i18n.t('experience.intermediate_hint') },
      { value: 'expert', label: i18n.t('experience.expert'), hint: i18n.t('experience.expert_hint') },
    ],
  })

  if (clack.isCancel(experience)) {
    clack.cancel(i18n.t('cli.install.cancelled'))
    process.exit(0)
  }

  await audit.log({ action: 'cli.install.experience_selected', agent: 'cli', files: [], outcome: 'success' })

  // Step 6: Squad installation
  const installSquad = await clack.confirm({
    message: i18n.t('cli.install.install_squad'),
    initialValue: true,
  })

  if (clack.isCancel(installSquad)) {
    clack.cancel(i18n.t('cli.install.cancelled'))
    process.exit(0)
  }

  await audit.log({ action: 'cli.install.squad_decided', agent: 'cli', files: [], outcome: 'success' })

  // Run installation
  const spinner = clack.spinner()
  spinner.start(i18n.t('cli.install.installing'))

  const result = await install({
    projectName,
    language: lang,
    domain: domain as string,
    ides: ideChoices as IdeId[],
    experienceLevel: experience as 'beginner' | 'intermediate' | 'expert',
    installSquad: installSquad as boolean,
    projectDir,
  })

  if (!result.ok) {
    spinner.stop(i18n.t('cli.install.failed'))
    await audit.log({ action: 'cli.install.flow_complete', agent: 'cli', files: [], outcome: 'failure', error: result.error.code })
    console.error(`Error: ${result.error.code}`)
    if (result.error.cause) console.error(`Cause: ${result.error.cause}`)
    process.exit(1)
  }

  await audit.log({ action: 'cli.install.flow_complete', agent: 'cli', files: [], outcome: 'success' })
  spinner.stop(i18n.t('cli.install.success', { project_name: projectName }))

  if (result.value.bundledResources.length > 0) {
    clack.note(i18n.t('cli.install.fallback_squad'), i18n.t('cli.install.offline_mode'))
  }

  // Next steps note
  const isHere = projectDir === resolve(process.cwd())
  clack.note(
    i18n.t('cli.install.next_steps', { cd_cmd: isHere ? '' : `cd ${projectName}\n` }),
    i18n.t('cli.install.next_steps_title'),
  )

  clack.outro(i18n.t('cli.install.outro'))
}

main().catch((error: unknown) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
