/**
 * @module commands/docs
 * @see Story 15.4 — CLI Docs Command (Lira)
 *
 * Project documentation organizer: scan, detect misplacements,
 * check staleness, and generate PROJECT-INDEX.md.
 */

import * as clack from '@clack/prompts'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { ok } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import { AuditLogger } from '../../foundation/audit.js'
import {
  scanProjectTree,
  detectMisplacements,
  checkStaleness,
  detectOrphans,
  detectBrownfield,
  generateProjectIndex,
  checkExpectedFiles,
  DEFAULT_EXPECTED_FILES,
} from './scanner.js'

export const handler: CommandHandler = {
  async run(args: string[]) {
    const projectDir = process.cwd()
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))

    // Parse --expect flag (comma-separated list of expected files)
    let expectedFiles = DEFAULT_EXPECTED_FILES
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--expect' && args[i + 1]) {
        expectedFiles = args[i + 1]!.split(',').map((f) => f.trim())
        i++
      }
    }

    clack.intro('Lira — Documentation Organizer')

    // Step 1: Full project tree scan
    const s = clack.spinner()
    s.start('Scanning entire project tree...')

    const files = await scanProjectTree(projectDir)
    const typeCounts = new Map<string, number>()
    for (const f of files) {
      typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1)
    }

    s.stop(`Scanned ${files.length} files`)

    clack.log.info(
      'File types: ' +
        Array.from(typeCounts.entries())
          .map(([t, c]) => `${t}: ${c}`)
          .join(', '),
    )

    // Step 2: Expected files check
    const missingExpected = checkExpectedFiles(files, expectedFiles)
    if (missingExpected.length > 0) {
      clack.log.warn(`${missingExpected.length} expected file(s) missing:`)
      for (const f of missingExpected) {
        clack.log.info(`  Missing: ${f}`)
      }
    } else {
      clack.log.success('All expected files present')
    }

    // Step 3: Misplacement detection
    const misplacements = detectMisplacements(files)
    if (misplacements.length > 0) {
      clack.log.warn(`${misplacements.length} misplacement suggestion(s) found:`)
      for (const m of misplacements) {
        clack.log.info(`  Move ${m.file} -> ${m.destination}`)
        clack.log.info(`    Reason: ${m.reason}`)
      }
    } else {
      clack.log.success('No misplaced files detected')
    }

    // Step 4: Staleness and orphan check
    const stale = checkStaleness(files)
    const orphans = detectOrphans(files)

    if (stale.length > 0) {
      clack.log.warn(`${stale.length} stale document(s) found (>30 days without updates):`)
      for (const st of stale) {
        clack.log.info(`  ${st.file} (${st.age} days old) — ${st.suggestedAction}`)
      }
    }

    if (orphans.length > 0) {
      clack.log.warn(`${orphans.length} orphaned artifact(s) found:`)
      for (const o of orphans) {
        clack.log.info(`  ${o.file}: ${o.kind} — ${o.suggestedAction}`)
      }
    }

    if (stale.length === 0 && orphans.length === 0) {
      clack.log.success('All documentation is healthy and organized')
    }

    // Step 5: Generate PROJECT-INDEX.md
    const indexContent = generateProjectIndex(files)
    const indexPath = join(projectDir, '.buildpact', 'PROJECT-INDEX.md')

    try {
      await mkdir(join(projectDir, '.buildpact'), { recursive: true })
      await writeFile(indexPath, indexContent, 'utf-8')
      clack.log.success(`Project index saved to .buildpact/PROJECT-INDEX.md (${files.length} entries)`)
    } catch {
      clack.log.warn('Could not write PROJECT-INDEX.md')
    }

    // Step 6: Brownfield/greenfield detection
    const isBrownfield = detectBrownfield(files)
    if (isBrownfield) {
      clack.log.info('Brownfield project detected — existing code predates BuildPact')
    } else {
      clack.log.info('Greenfield project — pipeline artifacts are the primary content')
    }

    // Step 7: Summary
    clack.log.info([
      'Documentation Health Report:',
      `  Files scanned: ${files.length}`,
      `  Files indexed: ${files.length}`,
      `  Expected files missing: ${missingExpected.length}`,
      `  Suggestions made: ${misplacements.length}`,
      `  Stale documents: ${stale.length}`,
      `  Orphaned artifacts: ${orphans.length}`,
    ].join('\n'))

    // Audit log entry
    await audit.log({
      action: 'docs.organize',
      agent: 'docs',
      files: [indexPath],
      outcome: 'success',
    })

    clack.outro('Documentation audit complete')
    return ok(undefined)
  },
}
