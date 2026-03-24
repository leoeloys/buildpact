/**
 * Learn command handler — opens the BuildPact getting started tutorial.
 * Locale-aware: opens PT-BR or EN version based on project config.
 * Falls back to printing URL in non-GUI environments (SSH, CI).
 * @see Epic 21.1: Onboarding Learn Command
 */

import { ok } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { readLanguage } from '../../foundation/config-reader.js'

const DOCS_BASE = 'https://buildpact.dev'

/** Build the tutorial URL for the given language */
export function buildTutorialUrl(lang: SupportedLanguage): string {
  if (lang === 'pt-br') {
    return `${DOCS_BASE}/pt-br/guide/getting-started`
  }
  return `${DOCS_BASE}/guide/getting-started`
}

/** Detect if we're in a non-GUI environment */
function isNonGuiEnvironment(): boolean {
  return !process.stdout.isTTY ||
    process.env.SSH_CONNECTION !== undefined ||
    process.env.BP_CI === 'true' ||
    process.env.CI === 'true'
}

export async function runLearn(_args: string[]): Promise<Result<void>> {
  const projectDir = process.cwd()
  const lang = readLanguage(projectDir)
  const i18n = createI18n(lang)
  const url = buildTutorialUrl(lang)

  const clack = await import('@clack/prompts')

  if (isNonGuiEnvironment()) {
    clack.log.info(i18n.t('cli.learn.url_only', { url }))
    return ok(undefined)
  }

  // Try to open browser (use execFile to avoid shell injection)
  clack.log.info(i18n.t('cli.learn.opening', { url }))
  try {
    const { execFile } = await import('node:child_process')
    const platform = process.platform
    const cmd = platform === 'darwin' ? 'open'
      : platform === 'win32' ? 'start'
      : 'xdg-open'
    execFile(cmd, [url])
  } catch {
    // Browser failed — print URL as fallback
  }
  clack.log.info(i18n.t('cli.learn.fallback', { url }))

  return ok(undefined)
}
