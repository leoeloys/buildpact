/**
 * @module commands/investigate
 * @see Story 15.5 — CLI Investigate Command
 *
 * Domain, codebase, and technology investigation from the CLI.
 */

import * as clack from '@clack/prompts'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { ok } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import { AuditLogger } from '../../foundation/audit.js'
import {
  detectScope,
  runInvestigation,
  formatInvestigationReport,
  formatCodebaseBrief,
  formatDomainBrief,
  formatTechBrief,
  type InvestigationType,
} from './engine.js'

export const handler: CommandHandler = {
  async run(args: string[]) {
    const projectDir = process.cwd()
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))

    clack.intro('BuildPact Investigate — Domain & Codebase Research')

    // Parse args
    let explicitType: InvestigationType | undefined
    const queryParts: string[] = []

    for (const arg of args) {
      if (arg === '--codebase') { explicitType = 'codebase'; continue }
      if (arg === '--technology' || arg === '--tech') { explicitType = 'technology'; continue }
      if (arg === '--domain') { explicitType = 'domain'; continue }
      queryParts.push(arg)
    }

    const query = queryParts.join(' ').trim() || (explicitType === 'codebase' ? 'Analyze codebase' : 'General investigation')

    // Step 1: Scope detection
    const type = detectScope(query, explicitType)
    clack.log.info(`Investigation type: ${type}`)

    // Step 2-4: Run investigation
    const s = clack.spinner()
    s.start('Investigating...')

    const result = await runInvestigation(type, query, projectDir)
    if (!result.ok) {
      s.stop('Investigation failed')
      clack.log.error(result.error.i18nKey)
      return result
    }

    const report = result.value
    s.stop(`Investigation complete — ${report.findings.length} finding(s)`)

    // Display findings
    if (report.findings.length > 0) {
      clack.log.info('Key Findings:')
      for (const f of report.findings) {
        clack.log.info(`  - ${f}`)
      }
    }

    if (report.recommendations.length > 0) {
      clack.log.info('Recommendations:')
      for (const r of report.recommendations) {
        clack.log.info(`  - ${r}`)
      }
    }

    // Step 5: Write report
    const slugDir = join(projectDir, '.buildpact', 'investigations', report.slug)
    await mkdir(slugDir, { recursive: true })

    // Write type-specific brief
    let briefPath: string
    let briefContent: string
    if (type === 'codebase' && report.techStack) {
      briefPath = join(slugDir, 'codebase-brief.md')
      briefContent = formatCodebaseBrief(report.techStack)
    } else if (type === 'technology') {
      briefPath = join(slugDir, 'tech-brief.md')
      briefContent = formatTechBrief(query)
    } else {
      briefPath = join(slugDir, 'domain-brief.md')
      briefContent = formatDomainBrief(query)
    }

    try {
      await writeFile(briefPath, briefContent, 'utf-8')
      clack.log.success(`Brief saved to ${briefPath}`)
    } catch {
      clack.log.warn('Could not write investigation brief')
    }

    // Write full report
    const reportPath = join(slugDir, 'report.md')
    try {
      await writeFile(reportPath, formatInvestigationReport(report), 'utf-8')
      clack.log.success(`Investigation report saved to ${reportPath}`)
    } catch {
      clack.log.warn('Could not write investigation report')
    }

    // Audit log entry
    await audit.log({
      action: 'investigate.report',
      agent: 'investigate',
      files: [briefPath, reportPath],
      outcome: 'success',
    })

    clack.outro('Investigation complete')
    return ok(undefined)
  },
}
