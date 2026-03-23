/**
 * @module commands/quality
 * @see Story 15.3 — CLI Quality Command (Crivo)
 *
 * ISO 9001-inspired quality report: inventory, compliance, metrics,
 * non-conformances, and recommendations.
 */

import * as clack from '@clack/prompts'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { ok } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import { AuditLogger } from '../../foundation/audit.js'
import { readAuditEntries } from '../audit/handler.js'
import {
  scanArtifactInventory,
  buildPipelineChains,
  checkProcessCompliance,
  calculateMetrics,
  detectNonConformances,
  generateRecommendations,
  formatQualityReportMarkdown,
  type QualityReport,
} from './scanner.js'

export const handler: CommandHandler = {
  async run(args: string[]) {
    const projectDir = process.cwd()
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))

    // Parse --threshold flag (default: 0 = no threshold)
    let threshold = 0
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--threshold' && args[i + 1]) {
        threshold = Number(args[i + 1])
        i++
      }
    }

    clack.intro('Crivo — Quality Report (ISO 9001-Inspired)')

    // Step 1: Artifact Inventory
    const s = clack.spinner()
    s.start('Scanning artifacts for quality metrics...')

    const inventory = await scanArtifactInventory(projectDir)
    const chains = buildPipelineChains(inventory)

    s.stop(`Inventory: ${inventory.specs.length} specs, ${inventory.plans.length} plans, ${inventory.executions.length} executions, ${inventory.verifications.length} verifications`)

    // Step 2: Process Compliance
    const auditDir = join(projectDir, '.buildpact', 'audit')
    const auditResult = await readAuditEntries(auditDir)
    const auditEntries = auditResult.ok ? auditResult.value : []
    const compliance = checkProcessCompliance(auditEntries)

    clack.log.info('Process Compliance:')
    for (const c of compliance) {
      const icon = c.percentage >= 90 ? 'Y' : c.percentage >= 50 ? '~' : 'N'
      clack.log.info(`  [${icon}] ${c.gate}: ${c.percentage}% (${c.passed}/${c.total})`)
    }

    // Step 3: Quality Metrics
    const metrics = calculateMetrics(chains, compliance, auditEntries)
    clack.log.info('Quality Metrics:')
    clack.log.info(`  First-pass yield: ${metrics.firstPassYield}% (target: >=80%)`)
    clack.log.info(`  Traceability coverage: ${metrics.traceabilityCoverage}% (target: 100%)`)
    clack.log.info(`  Process compliance: ${metrics.processCompliance}% (target: >=90%)`)
    clack.log.info(`  Adversarial density: ${metrics.adversarialDensity} (target: >=3)`)
    clack.log.info(`  Quality score: ${metrics.score} (threshold: ${threshold})`)

    // Step 4: Non-Conformances
    const nonConformances = detectNonConformances(chains, compliance, metrics)
    if (nonConformances.length > 0) {
      clack.log.warn(`${nonConformances.length} quality issue(s) found:`)
      for (const nc of nonConformances) {
        if (nc.severity === 'CRITICAL') {
          clack.log.error(`  [${nc.severity}] ${nc.issue}`)
        } else {
          clack.log.warn(`  [${nc.severity}] ${nc.issue}`)
        }
      }
    } else {
      clack.log.success('No quality issues found — process is healthy')
    }

    // Step 5: Recommendations
    const recommendations = generateRecommendations(nonConformances, metrics)
    if (recommendations.length > 0) {
      clack.log.info('Recommendations:')
      for (const rec of recommendations) {
        clack.log.info(`  - ${rec}`)
      }
    }

    // Write report to file
    const report: QualityReport = {
      inventory,
      chains,
      compliance,
      metrics,
      nonConformances,
      recommendations,
    }

    const reportsDir = join(projectDir, '.buildpact', 'reports')
    const reportPath = join(reportsDir, 'quality-report.md')
    try {
      await mkdir(reportsDir, { recursive: true })
      await writeFile(reportPath, formatQualityReportMarkdown(report), 'utf-8')
      clack.log.success(`Quality report saved to ${reportPath}`)
    } catch {
      clack.log.warn('Could not write quality report to file')
    }

    // Audit log entry
    await audit.log({
      action: 'quality.report',
      agent: 'quality',
      files: [reportPath],
      outcome: 'success',
    })

    // Apply exit code threshold
    if (threshold > 0 && metrics.score < threshold) {
      clack.log.error(`Quality score ${metrics.score} is below threshold ${threshold}`)
      process.exitCode = 1
    }

    clack.outro('Quality audit complete')
    return ok(undefined)
  },
}
