/**
 * Hub command handler — search, filter, and inspect community squads.
 * @see Epic 20.1: Hub Search & Discovery
 */

import * as clack from '@clack/prompts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { ok } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import {
  fetchRegistryIndex,
  fetchSquadDetail,
  searchSquads,
  formatSearchResults,
  formatSquadDetail,
} from '../../engine/hub-search.js'
import type { HubSearchOptions } from '../../engine/hub-search.js'

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

/**
 * Parse CLI args into hub subcommand + search options.
 */
function parseArgs(args: string[]): {
  subcommand: 'search' | 'info'
  query?: string | undefined
  domain?: string | undefined
  sort?: 'relevance' | 'downloads' | 'quality' | 'name' | undefined
  squadName?: string | undefined
} {
  const sub = args[0]

  if (sub === 'info' && args[1]) {
    return { subcommand: 'info', squadName: args[1] }
  }

  // Default to search
  const opts: ReturnType<typeof parseArgs> = { subcommand: 'search' }
  const remaining: string[] = []

  for (let i = sub === 'search' ? 1 : 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--domain' && args[i + 1]) {
      opts.domain = args[++i]
    } else if (arg === '--sort' && args[i + 1]) {
      const s = args[++i] as string
      if (['relevance', 'downloads', 'quality', 'name'].includes(s)) {
        opts.sort = s as typeof opts.sort
      }
    } else if (!arg.startsWith('--')) {
      remaining.push(arg)
    }
  }

  if (remaining.length > 0) {
    opts.query = remaining.join(' ')
  }

  return opts
}

export async function runHub(args: string[]): Promise<Result<void>> {
  const projectDir = process.cwd()
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))
  const lang = readLanguage(projectDir)
  const i18n = createI18n(lang)

  const parsed = parseArgs(args)

  if (parsed.subcommand === 'info') {
    return runHubInfo(parsed.squadName!, i18n, audit)
  }

  return runHubSearch(parsed, i18n, audit)
}

async function runHubSearch(
  opts: { query?: string | undefined; domain?: string | undefined; sort?: HubSearchOptions['sort'] },
  i18n: ReturnType<typeof createI18n>,
  audit: AuditLogger,
): Promise<Result<void>> {
  clack.intro(i18n.t('cli.hub.welcome'))

  const spinner = clack.spinner()
  spinner.start(i18n.t('cli.hub.searching'))

  const indexResult = await fetchRegistryIndex()
  if (!indexResult.ok) {
    spinner.stop(i18n.t('cli.hub.fetch_failed'))
    return indexResult as Result<void>
  }

  const results = searchSquads(indexResult.value, {
    query: opts.query,
    domain: opts.domain,
    sort: opts.sort,
  })

  spinner.stop(i18n.t('cli.hub.search_done', { count: String(results.length) }))

  if (results.length === 0) {
    clack.log.warn(i18n.t('cli.hub.no_results'))
    clack.outro(i18n.t('cli.hub.no_results_hint'))
    return ok(undefined)
  }

  const formatted = formatSearchResults(results)
  clack.note(formatted, i18n.t('cli.hub.results_title', { count: String(results.length) }))

  clack.outro(i18n.t('cli.hub.search_outro'))
  await audit.log({ action: 'hub.search', agent: 'cli', files: [], outcome: 'success' })
  return ok(undefined)
}

async function runHubInfo(
  squadName: string,
  i18n: ReturnType<typeof createI18n>,
  audit: AuditLogger,
): Promise<Result<void>> {
  clack.intro(i18n.t('cli.hub.welcome'))

  const spinner = clack.spinner()
  spinner.start(i18n.t('cli.hub.fetching_info', { name: squadName }))

  const detailResult = await fetchSquadDetail(squadName)
  if (!detailResult.ok) {
    spinner.stop(i18n.t('cli.hub.squad_not_found', { name: squadName }))
    return detailResult as Result<void>
  }

  spinner.stop(i18n.t('cli.hub.info_loaded'))

  const formatted = formatSquadDetail(detailResult.value)
  clack.note(formatted, squadName)

  clack.outro(i18n.t('cli.hub.info_outro'))
  await audit.log({ action: 'hub.info', agent: 'cli', files: [], outcome: 'success' })
  return ok(undefined)
}
