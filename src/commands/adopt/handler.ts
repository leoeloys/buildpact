/**
 * Adopt command handler — onboard existing (brownfield) projects into BuildPact.
 * Scans the project, generates pre-filled artifacts, and writes them with user confirmation.
 * @module commands/adopt
 */

import * as clack from '@clack/prompts'
import { join } from 'node:path'
import { createI18n } from '../../foundation/i18n.js'
import { scanProject, formatScanSummary } from '../../foundation/scanner.js'
import { adopt } from '../../foundation/adopter.js'
import { diagnoseProject, formatDiagnosticReport } from '../../foundation/diagnostician.js'
import { AuditLogger } from '../../foundation/audit.js'
import { ok, err } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import type { IdeId } from '../../foundation/installer.js'

export async function runAdopt(args: string[]): Promise<Result<void>> {
  const projectDir = process.cwd()
  const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'adopt.jsonl'))

  // Step 1: Language selection
  clack.intro('BuildPact — Adopt Existing Project')

  const langChoice = await clack.select({
    message: 'Select your language / Selecione seu idioma',
    options: [
      { value: 'en', label: 'English' },
      { value: 'pt-br', label: 'Português (Brasil)' },
    ],
  })

  if (clack.isCancel(langChoice)) {
    clack.cancel('Cancelled.')
    return ok(undefined)
  }

  const lang = langChoice as SupportedLanguage
  const i18n = createI18n(lang)

  // Step 2: Scan
  const spinner = clack.spinner()
  spinner.start(i18n.t('cli.adopt.scanning'))

  const scan = await scanProject(projectDir)

  spinner.stop(i18n.t('cli.adopt.scan_complete'))

  // Step 3: Show summary
  const summary = formatScanSummary(scan)
  if (summary) {
    clack.note(summary, i18n.t('cli.adopt.detected_title'))
  } else {
    clack.log.warn(i18n.t('cli.adopt.nothing_detected'))
  }

  // Step 4: Handle existing .buildpact/
  let mergeExisting = false
  if (scan.existingBuildpact) {
    const existingChoice = await clack.select({
      message: i18n.t('cli.adopt.existing_detected'),
      options: [
        { value: 'merge', label: i18n.t('cli.adopt.merge_option') },
        { value: 'overwrite', label: i18n.t('cli.adopt.overwrite_option') },
        { value: 'cancel', label: i18n.t('cli.adopt.cancel_option') },
      ],
    })

    if (clack.isCancel(existingChoice) || existingChoice === 'cancel') {
      clack.cancel(i18n.t('cli.adopt.cancelled'))
      return ok(undefined)
    }

    mergeExisting = existingChoice === 'merge'
  }

  // Step 5: Domain confirmation
  const domain = await clack.select({
    message: i18n.t('cli.install.select_domain'),
    initialValue: scan.inferredDomain,
    options: [
      { value: 'software', label: i18n.t('domain.software'), hint: i18n.t('domain.software_hint') },
      { value: 'marketing', label: i18n.t('domain.marketing'), hint: i18n.t('domain.marketing_hint') },
      { value: 'health', label: i18n.t('domain.health'), hint: i18n.t('domain.health_hint') },
      { value: 'research', label: i18n.t('domain.research'), hint: i18n.t('domain.research_hint') },
      { value: 'management', label: i18n.t('domain.management'), hint: i18n.t('domain.management_hint') },
      { value: 'custom', label: i18n.t('domain.custom'), hint: i18n.t('domain.custom_hint') },
    ],
  })

  if (clack.isCancel(domain)) {
    clack.cancel(i18n.t('cli.adopt.cancelled'))
    return ok(undefined)
  }

  // Step 6: IDE selection (skip already-configured)
  const configuredIdes = new Set(scan.existingAiConfigs.map(c => c.ide))
  const ideOptions = [
    { value: 'claude-code' as const, label: 'Claude Code', hint: configuredIdes.has('claude-code') ? '(already configured)' : i18n.t('ide.claude_code_hint') },
    { value: 'cursor' as const, label: 'Cursor', hint: configuredIdes.has('cursor') ? '(already configured)' : i18n.t('ide.cursor_hint') },
    { value: 'gemini' as const, label: 'Gemini CLI', hint: configuredIdes.has('gemini') ? '(already configured)' : i18n.t('ide.gemini_hint') },
    { value: 'codex' as const, label: 'Codex CLI', hint: configuredIdes.has('codex') ? '(already configured)' : i18n.t('ide.codex_hint') },
  ]

  const ideChoices = await clack.multiselect({
    message: i18n.t('cli.install.select_ides'),
    options: ideOptions,
    required: true,
  })

  if (clack.isCancel(ideChoices)) {
    clack.cancel(i18n.t('cli.adopt.cancelled'))
    return ok(undefined)
  }

  // Step 7: Experience level
  const experience = await clack.select({
    message: i18n.t('cli.install.select_experience'),
    options: [
      { value: 'beginner', label: i18n.t('experience.beginner'), hint: i18n.t('experience.beginner_hint') },
      { value: 'intermediate', label: i18n.t('experience.intermediate'), hint: i18n.t('experience.intermediate_hint') },
      { value: 'expert', label: i18n.t('experience.expert'), hint: i18n.t('experience.expert_hint') },
    ],
  })

  if (clack.isCancel(experience)) {
    clack.cancel(i18n.t('cli.adopt.cancelled'))
    return ok(undefined)
  }

  // Step 8: Squad
  const installSquad = await clack.confirm({
    message: i18n.t('cli.install.install_squad'),
    initialValue: true,
  })

  if (clack.isCancel(installSquad)) {
    clack.cancel(i18n.t('cli.adopt.cancelled'))
    return ok(undefined)
  }

  // Step 9: Confirm and execute
  const confirmAdopt = await clack.confirm({
    message: i18n.t('cli.adopt.confirm'),
  })

  if (clack.isCancel(confirmAdopt) || !confirmAdopt) {
    clack.cancel(i18n.t('cli.adopt.cancelled'))
    return ok(undefined)
  }

  spinner.start(i18n.t('cli.adopt.applying'))

  const result = await adopt({
    projectDir,
    language: lang,
    scan,
    mergeExisting,
    ides: ideChoices as IdeId[],
    experienceLevel: experience as 'beginner' | 'intermediate' | 'expert',
    installSquad: installSquad as boolean,
    domain: domain as string,
  })

  if (!result.ok) {
    spinner.stop(i18n.t('cli.adopt.failed'))
    return result as Result<void>
  }

  spinner.stop(i18n.t('cli.adopt.success'))

  const { created, modified, skipped } = result.value
  if (created.length > 0) clack.log.success(i18n.t('cli.adopt.created_count', { count: String(created.length) }))
  if (modified.length > 0) clack.log.info(i18n.t('cli.adopt.modified_count', { count: String(modified.length) }))
  if (skipped.length > 0) clack.log.info(i18n.t('cli.adopt.skipped_count', { count: String(skipped.length) }))

  // Step 10: Run diagnostic
  const runDiag = await clack.confirm({
    message: i18n.t('cli.adopt.run_diagnostic'),
    initialValue: true,
  })

  if (!clack.isCancel(runDiag) && runDiag) {
    spinner.start(i18n.t('cli.adopt.diagnosing'))

    const diagnostic = await diagnoseProject(projectDir, scan)
    const reportContent = formatDiagnosticReport(diagnostic, lang)

    const { writeFile } = await import('node:fs/promises')
    const reportPath = join(projectDir, '.buildpact', 'diagnostic-report.md')
    await writeFile(reportPath, reportContent, 'utf-8')

    spinner.stop(i18n.t('cli.adopt.diagnostic_done'))

    // Show summary
    const phasesDone = diagnostic.phases.filter(p => p.status === 'complete').length
    const phasesTotal = diagnostic.phases.length
    const reqsFound = diagnostic.requirements.length
    const docsFound = diagnostic.documents.length

    const summaryParts: string[] = []
    if (docsFound > 0) summaryParts.push(i18n.t('cli.adopt.diag_docs', { count: String(docsFound) }))
    if (phasesTotal > 0) summaryParts.push(i18n.t('cli.adopt.diag_phases', { done: String(phasesDone), total: String(phasesTotal) }))
    if (reqsFound > 0) summaryParts.push(i18n.t('cli.adopt.diag_reqs', { count: String(reqsFound) }))
    summaryParts.push(`${diagnostic.metrics.totalFiles} ${i18n.t('cli.adopt.diag_files')}, ${diagnostic.metrics.totalLines.toLocaleString()} LOC`)

    clack.note(summaryParts.join('\n'), i18n.t('cli.adopt.diag_summary_title'))

    // Show top recommendations
    if (diagnostic.recommendations.length > 0) {
      const topRecs = diagnostic.recommendations.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n')
      clack.note(topRecs, i18n.t('cli.adopt.diag_recommendations_title'))
    }

    clack.log.success(i18n.t('cli.adopt.diag_report_saved', { path: '.buildpact/diagnostic-report.md' }))
  }

  clack.outro(i18n.t('cli.adopt.outro'))

  await audit.log({ action: 'adopt.flow_complete', agent: 'cli', files: [...created, ...modified], outcome: 'success' })
  return ok(undefined)
}
