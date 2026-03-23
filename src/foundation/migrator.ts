/**
 * Migration runner — sequential schema migrations for .buildpact/ projects.
 * Each migration transforms the project from one schema version to the next.
 * @module foundation/migrator
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import { AuditLogger } from './audit.js'
import { CURRENT_SCHEMA_VERSION } from './version-guard.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Migration {
  fromSchema: number
  toSchema: number
  description: string
  up(projectDir: string): Promise<MigrationResult>
}

export interface MigrationResult {
  filesCreated: string[]
  filesModified: string[]
  filesDeleted: string[]
  warnings: string[]
}

export interface MigrationSummary {
  migrationsRun: number
  fromSchema: number
  toSchema: number
  results: MigrationResult[]
}

// ---------------------------------------------------------------------------
// CLI version — read from package.json at runtime
// ---------------------------------------------------------------------------

/** Read CLI version from package.json (walks up from this file to find it) */
function getCliVersion(): string {
  try {
    const { readFileSync } = require('node:fs')
    const { resolve, dirname } = require('node:path')
    // Walk up from dist or src to find package.json
    let dir = __dirname ?? dirname(new URL(import.meta.url).pathname)
    for (let i = 0; i < 5; i++) {
      try {
        const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'))
        if (pkg.name === 'buildpact') return pkg.version ?? '2.0.0'
      } catch { /* keep walking up */ }
      dir = resolve(dir, '..')
    }
  } catch { /* fallback */ }
  return '2.0.0'
}

// ---------------------------------------------------------------------------
// Migration registry
// ---------------------------------------------------------------------------

/** All migrations, ordered by fromSchema. */
export const MIGRATIONS: Migration[] = [
  {
    fromSchema: 0,
    toSchema: 1,
    description: 'Add schema versioning to config.yaml',
    async up(projectDir) {
      const configPath = join(projectDir, '.buildpact', 'config.yaml')
      let content: string
      try {
        content = await readFile(configPath, 'utf-8')
      } catch {
        return { filesCreated: [], filesModified: [], filesDeleted: [], warnings: ['config.yaml not found — skipped'] }
      }

      const cliVersion = getCliVersion()
      const lines = content.split('\n')
      const insertIdx = lines.findIndex(l => !l.startsWith('#') && l.trim().length > 0)
      const schemaLines = [
        `buildpact_schema: 1`,
        `created_by_cli: "${cliVersion}"`,
        `last_upgraded_by_cli: "${cliVersion}"`,
        '',
      ]

      if (insertIdx >= 0) {
        lines.splice(insertIdx, 0, ...schemaLines)
      } else {
        lines.unshift(...schemaLines)
      }

      await writeFile(configPath, lines.join('\n'), 'utf-8')
      return { filesCreated: [], filesModified: ['.buildpact/config.yaml'], filesDeleted: [], warnings: [] }
    },
  },
  {
    fromSchema: 1,
    toSchema: 2,
    description: 'v2.0 — Agent Mode, RBAC, expansion packs support',
    async up(projectDir) {
      const configPath = join(projectDir, '.buildpact', 'config.yaml')
      let content: string
      try {
        content = await readFile(configPath, 'utf-8')
      } catch {
        return { filesCreated: [], filesModified: [], filesDeleted: [], warnings: ['config.yaml not found — skipped'] }
      }

      const cliVersion = getCliVersion()

      // Update schema version
      content = content.replace(/buildpact_schema:\s*\d+/, `buildpact_schema: 2`)
      content = content.replace(/last_upgraded_by_cli:\s*"[^"]*"/, `last_upgraded_by_cli: "${cliVersion}"`)

      // Add v2.0 config sections if not present
      if (!content.includes('agent_mode:')) {
        content += [
          '',
          '# v2.0 — Agent Mode (disabled by default)',
          'agent_mode: false',
          '',
          '# v2.0 — Cross-project learning (opt-in)',
          'cross_project:',
          '  enabled: false',
          '',
        ].join('\n')
      }

      await writeFile(configPath, content, 'utf-8')
      return { filesCreated: [], filesModified: ['.buildpact/config.yaml'], filesDeleted: [], warnings: [] }
    },
  },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all necessary migrations from currentSchema to targetSchema.
 * Migrations run sequentially: 0→1→2→3. Never skip.
 * Each migration is atomic — if one fails, previous ones are preserved.
 */
export async function runMigrations(
  projectDir: string,
  currentSchema: number,
  targetSchema: number = CURRENT_SCHEMA_VERSION,
): Promise<Result<MigrationSummary>> {
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'upgrade.jsonl'))

  if (currentSchema >= targetSchema) {
    return ok({ migrationsRun: 0, fromSchema: currentSchema, toSchema: currentSchema, results: [] })
  }

  const results: MigrationResult[] = []
  let schema = currentSchema

  for (const migration of MIGRATIONS) {
    if (migration.fromSchema < schema) continue
    if (migration.fromSchema > schema) break
    if (migration.toSchema > targetSchema) break

    await audit.log({
      action: `upgrade.migration.start`,
      agent: 'migrator',
      files: [],
      outcome: 'success',
    })

    try {
      const result = await migration.up(projectDir)
      results.push(result)
      schema = migration.toSchema

      await audit.log({
        action: `upgrade.migration.complete`,
        agent: 'migrator',
        files: [...result.filesCreated, ...result.filesModified],
        outcome: 'success',
      })
    } catch (cause) {
      await audit.log({
        action: `upgrade.migration.failed`,
        agent: 'migrator',
        files: [],
        outcome: 'failure',
        error: String(cause),
      }).catch(() => undefined)

      return err({
        code: 'MIGRATION_FAILED',
        i18nKey: 'error.upgrade.migration_failed',
        params: { from: String(migration.fromSchema), to: String(migration.toSchema) },
        cause,
      })
    }
  }

  return ok({ migrationsRun: results.length, fromSchema: currentSchema, toSchema: schema, results })
}

/**
 * List migrations that would run for a given schema range.
 * Used by --dry-run and the upgrade command's preview step.
 */
export function listPendingMigrations(currentSchema: number, targetSchema: number = CURRENT_SCHEMA_VERSION): Migration[] {
  return MIGRATIONS.filter(m => m.fromSchema >= currentSchema && m.toSchema <= targetSchema)
}
