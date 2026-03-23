/**
 * Diagnose command handler — deep analysis of brownfield project state.
 * Standalone command (not tied to adopt). Run anytime to understand the project.
 *
 * Outputs: .buildpact/diagnostic-report.md
 * Contains: discovered docs, sprint progress, code metrics, quality signals, recommendations.
 *
 * @module commands/diagnose
 */

import * as clack from '@clack/prompts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { createI18n } from '../../foundation/i18n.js'
import { scanProject } from '../../foundation/scanner.js'
import { diagnoseProject, formatDiagnosticReport } from '../../foundation/diagnostician.js'
import { AuditLogger } from '../../foundation/audit.js'
import { ok } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'

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
  } catch { /* default */ }
  return 'en'
}

export async function runDiagnose(_args: string[]): Promise<Result<void>> {
  const projectDir = process.cwd()
  const lang = readLanguage(projectDir)
  const i18n = createI18n(lang)
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))

  clack.intro(i18n.t('cli.diagnose.welcome'))

  const spinner = clack.spinner()

  // Step 1: Scan project
  spinner.start(i18n.t('cli.diagnose.scanning'))
  const scan = await scanProject(projectDir)
  spinner.stop(i18n.t('cli.diagnose.scan_done'))

  // Step 2: Deep diagnostic
  spinner.start(i18n.t('cli.diagnose.analyzing'))
  const diagnostic = await diagnoseProject(projectDir, scan)
  const reportContent = formatDiagnosticReport(diagnostic, lang)
  spinner.stop(i18n.t('cli.diagnose.analysis_done'))

  // Step 3: Write report
  const reportPath = join(projectDir, '.buildpact', 'diagnostic-report.md')
  await writeFile(reportPath, reportContent, 'utf-8')

  // Step 4: Show summary
  const docsFound = diagnostic.documents.length
  const phasesComplete = diagnostic.phases.filter(p => p.status === 'complete').length
  const phasesTotal = diagnostic.phases.length
  const reqsFound = diagnostic.requirements.length
  const { totalFiles, totalLines, testFiles } = diagnostic.metrics

  const summaryLines = [
    `${i18n.t('cli.diagnose.docs_found', { count: String(docsFound) })}`,
    ...(phasesTotal > 0 ? [`${i18n.t('cli.diagnose.phases', { done: String(phasesComplete), total: String(phasesTotal) })}`] : []),
    ...(reqsFound > 0 ? [`${i18n.t('cli.diagnose.requirements', { count: String(reqsFound) })}`] : []),
    `${totalFiles} ${i18n.t('cli.diagnose.source_files')}, ${totalLines.toLocaleString()} LOC, ${testFiles} ${i18n.t('cli.diagnose.test_files')}`,
  ]
  clack.note(summaryLines.join('\n'), i18n.t('cli.diagnose.summary_title'))

  // Step 5: Show top recommendations
  if (diagnostic.recommendations.length > 0) {
    const topRecs = diagnostic.recommendations.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n')
    clack.note(topRecs, i18n.t('cli.diagnose.recommendations_title'))
  }

  // Step 6: Quality signals
  if (diagnostic.qualitySignals.length > 0) {
    const signals = diagnostic.qualitySignals
      .map(s => `${s.status === 'good' ? '+' : s.status === 'warning' ? '!' : '-'} ${s.name}: ${s.detail}`)
      .join('\n')
    clack.note(signals, i18n.t('cli.diagnose.quality_title'))
  }

  clack.log.success(i18n.t('cli.diagnose.report_saved', { path: '.buildpact/diagnostic-report.md' }))

  // Suggest next step based on diagnosis
  if (docsFound === 0) {
    clack.log.info(i18n.t('cli.diagnose.next_specify'))
  } else if (phasesTotal > 0 && phasesComplete < phasesTotal) {
    clack.log.info(i18n.t('cli.diagnose.next_continue'))
  } else {
    clack.log.info(i18n.t('cli.diagnose.next_plan'))
  }

  clack.outro(i18n.t('cli.diagnose.outro'))

  await audit.log({ action: 'diagnose.complete', agent: 'cli', files: [reportPath], outcome: 'success' })
  return ok(undefined)
}
