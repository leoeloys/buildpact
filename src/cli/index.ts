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
import type { SupportedLanguage } from '../contracts/i18n.js'
import type { IdeId } from '../foundation/installer.js'

const VERSION = '0.1.0-alpha.3'

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv

  // Handle pipeline commands: buildpact <command> [args]
  if (command && command !== 'init') {
    const { resolveCommand } = await import('../commands/registry.js')
    const audit = new AuditLogger(join(process.cwd(), '.buildpact', 'audit', 'cli.jsonl'))
    await audit.log({ action: 'cli.command.start', agent: 'cli', files: [], outcome: 'success' })
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
  // Audit logger for install flow — writes to CWD until projectDir is known
  const auditPath = projectNameArg
    ? join(resolve(process.cwd(), projectNameArg), '.buildpact', 'audit', 'cli.jsonl')
    : join(process.cwd(), '.buildpact', 'audit', 'cli.jsonl')
  const audit = new AuditLogger(auditPath)

  await audit.log({ action: 'cli.install.flow_start', agent: 'cli', files: [], outcome: 'success' })
  clack.intro(`BuildPact v${VERSION}`)

  // Step 1: Language selection (first prompt — no default)
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
  await audit.log({ action: 'cli.install.language_selected', agent: 'cli', files: [], outcome: 'success' })
  const i18n = createI18n(lang)

  // Step 2: Project name (if not provided as CLI arg)
  let projectName = projectNameArg
  if (!projectName) {
    const nameInput = await clack.text({
      message: lang === 'en' ? 'Project name:' : 'Nome do projeto:',
      placeholder: 'my-project',
      validate(value) {
        if (!value || value.trim().length === 0) {
          return lang === 'en' ? 'Project name is required' : 'Nome do projeto é obrigatório'
        }
        if (!/^[a-z0-9-_]+$/i.test(value.trim())) {
          return lang === 'en'
            ? 'Use only letters, numbers, hyphens, and underscores'
            : 'Use apenas letras, números, hífens e underscores'
        }
      },
    })
    if (clack.isCancel(nameInput)) {
      clack.cancel('Installation cancelled.')
      process.exit(0)
    }
    projectName = (nameInput as string).trim()
  }

  await audit.log({ action: 'cli.install.project_named', agent: 'cli', files: [], outcome: 'success' })

  // Step 3: Domain selection
  const domain = await clack.select({
    message: i18n.t('cli.install.select_domain'),
    options: [
      { value: 'software', label: i18n.t('domain.software') },
      { value: 'marketing', label: i18n.t('domain.marketing') },
      { value: 'health', label: i18n.t('domain.health') },
      { value: 'research', label: i18n.t('domain.research') },
      { value: 'management', label: i18n.t('domain.management') },
      { value: 'custom', label: i18n.t('domain.custom') },
    ],
  })

  if (clack.isCancel(domain)) {
    clack.cancel('Installation cancelled.')
    process.exit(0)
  }

  await audit.log({ action: 'cli.install.domain_selected', agent: 'cli', files: [], outcome: 'success' })

  // Step 4: IDE multi-select
  const ideChoices = await clack.multiselect({
    message: i18n.t('cli.install.select_ides'),
    options: [
      { value: 'claude-code', label: 'Claude Code', hint: 'Anthropic' },
      { value: 'cursor', label: 'Cursor', hint: 'AI-first editor' },
      { value: 'gemini', label: 'Gemini CLI', hint: 'Google' },
      { value: 'codex', label: 'Codex', hint: 'OpenAI' },
    ],
    required: true,
  })

  if (clack.isCancel(ideChoices)) {
    clack.cancel('Installation cancelled.')
    process.exit(0)
  }

  await audit.log({ action: 'cli.install.ides_selected', agent: 'cli', files: [], outcome: 'success' })

  // Step 5: Experience level
  const experience = await clack.select({
    message: i18n.t('cli.install.select_experience'),
    options: [
      { value: 'beginner', label: i18n.t('experience.beginner') },
      { value: 'intermediate', label: i18n.t('experience.intermediate') },
      { value: 'expert', label: i18n.t('experience.expert') },
    ],
  })

  if (clack.isCancel(experience)) {
    clack.cancel('Installation cancelled.')
    process.exit(0)
  }

  await audit.log({ action: 'cli.install.experience_selected', agent: 'cli', files: [], outcome: 'success' })

  // Step 6: Optional Squad installation
  const installSquad = await clack.confirm({
    message: i18n.t('cli.install.install_squad'),
    initialValue: true,
  })

  if (clack.isCancel(installSquad)) {
    clack.cancel('Installation cancelled.')
    process.exit(0)
  }

  await audit.log({ action: 'cli.install.squad_decided', agent: 'cli', files: [], outcome: 'success' })

  // Run installation
  const spinner = clack.spinner()
  spinner.start(lang === 'en' ? 'Installing BuildPact...' : 'Instalando BuildPact...')

  const projectDir = resolve(process.cwd(), projectName)
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
    spinner.stop(lang === 'en' ? 'Installation failed.' : 'Instalação falhou.')
    await audit.log({ action: 'cli.install.flow_complete', agent: 'cli', files: [], outcome: 'failure', error: result.error.code })
    console.error(`Error: ${result.error.code}`)
    process.exit(1)
  }

  await audit.log({ action: 'cli.install.flow_complete', agent: 'cli', files: [], outcome: 'success' })
  spinner.stop(i18n.t('cli.install.success', { project_name: projectName }))

  // Report bundled resources
  if (result.value.bundledResources.length > 0) {
    clack.note(
      i18n.t('cli.install.fallback_squad'),
      lang === 'en' ? 'Offline mode' : 'Modo offline',
    )
  }

  clack.outro(
    lang === 'en'
      ? `Done! Run: cd ${projectName} && buildpact specify`
      : `Pronto! Execute: cd ${projectName} && buildpact specify`,
  )
}

main().catch((error: unknown) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
