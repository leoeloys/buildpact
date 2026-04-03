/**
 * Map command handler — generate per-directory MAP.md indexes across the project.
 * Agents read the local MAP.md for instant orientation instead of scanning trees.
 * Saves tokens and provides auditable directory structure.
 *
 * @module commands/map
 * @see Continuous audit: MAP.md per directory
 */

import * as clack from '@clack/prompts'
import { join } from 'node:path'
import { ok } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import { AuditLogger } from '../../foundation/audit.js'
import { refreshAllProjectMaps, refreshBuildpactMaps } from '../../engine/directory-map.js'
import { registerEvent } from '../../engine/project-ledger.js'
import { createI18n } from '../../foundation/i18n.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'

export const handler: CommandHandler = {
  async run(args: string[]) {
    const projectDir = process.cwd()
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))

    // Detect language
    let lang: SupportedLanguage = 'en'
    try {
      const { readFile } = await import('node:fs/promises')
      const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
      const match = content.match(/^language:\s*["']?([a-z-]+)["']?/m)
      if (match?.[1] === 'pt-br') lang = 'pt-br'
    } catch { /* default en */ }

    const i18n = createI18n(lang)
    const buildpactOnly = args.includes('--buildpact')

    clack.intro(lang === 'pt-br' ? 'BuildPact — Mapeamento de Diretórios' : 'BuildPact — Directory Mapping')

    const spinner = clack.spinner()
    spinner.start(lang === 'pt-br' ? 'Gerando MAP.md em todas as pastas...' : 'Generating MAP.md in all directories...')

    let maps: string[]
    if (buildpactOnly) {
      maps = await refreshBuildpactMaps(projectDir)
    } else {
      maps = await refreshAllProjectMaps(projectDir)
    }

    spinner.stop(
      lang === 'pt-br'
        ? `${maps.length} MAP.md gerados`
        : `${maps.length} MAP.md files generated`,
    )

    // Show summary by top-level directory
    const topLevelCounts = new Map<string, number>()
    for (const m of maps) {
      const topDir = m.split('/')[0] ?? '.'
      topLevelCounts.set(topDir, (topLevelCounts.get(topDir) ?? 0) + 1)
    }

    for (const [dir, count] of topLevelCounts) {
      clack.log.info(`  ${dir}: ${count} MAP.md`)
    }

    // Audit + ledger
    await audit.log({
      action: 'map.generate',
      agent: 'map',
      files: maps,
      outcome: 'success',
    })

    await registerEvent(
      projectDir, 'ARTIFACT_CHANGE', `map-${Date.now().toString(36)}`,
      `${maps.length} MAP.md files generated across project`,
      'MAP.md',
    ).catch(() => {})

    clack.outro(
      lang === 'pt-br'
        ? `${maps.length} índices atualizados — agentes podem navegar sem escanear`
        : `${maps.length} indexes updated — agents can navigate without scanning`,
    )

    return ok(undefined)
  },
}
