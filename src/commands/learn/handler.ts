/**
 * Learn command handler — opens the BuildPact getting started tutorial.
 * Locale-aware: opens PT-BR or EN version based on project config.
 * Falls back to printing URL in non-GUI environments (SSH, CI).
 * @see Epic 21.1: Onboarding Learn Command
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ok } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'

const DOCS_BASE = 'https://buildpact.dev'

/** Build the tutorial URL for the given language */
export function buildTutorialUrl(lang: SupportedLanguage): string {
  if (lang === 'pt-br') {
    return `${DOCS_BASE}/pt-br/guide/getting-started`
  }
  return `${DOCS_BASE}/guide/getting-started`
}

/** Read language from config.yaml (sync, with fallback) */
function readLanguage(projectDir: string): SupportedLanguage {
  try {
    const content = readFileSync(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('language:')) {
        const value = trimmed.slice('language:'.length).trim().replace(/^["']|["']$/g, '')
        if (value === 'pt-br' || value === 'en') return value
      }
    }
  } catch { /* no config — default to en */ }
  return 'en'
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

  if (isNonGuiEnvironment()) {
    console.log(i18n.t('cli.learn.url_only', { url }))
    return ok(undefined)
  }

  // Try to open browser
  console.log(i18n.t('cli.learn.opening', { url }))
  try {
    // Use dynamic import for cross-platform open
    const { exec } = await import('node:child_process')
    const platform = process.platform
    const cmd = platform === 'darwin' ? 'open'
      : platform === 'win32' ? 'start'
      : 'xdg-open'
    exec(`${cmd} ${url}`)
  } catch {
    // Browser failed — print URL as fallback
  }
  console.log(i18n.t('cli.learn.fallback', { url }))

  return ok(undefined)
}
