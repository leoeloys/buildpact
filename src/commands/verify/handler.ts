/**
 * Verify command handler.
 * Guided Acceptance Test (UAT): walks the developer through each AC from the spec,
 * one at a time, prompting PASS/FAIL and generating a structured verification report.
 * @see FR-800 — Guided Acceptance Test
 */

import * as clack from '@clack/prompts'
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage, I18nResolver } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a single acceptance criterion after verification */
export type AcStatus = 'pass' | 'fail' | 'skip'

/** Verification result for a single acceptance criterion */
export interface AcVerificationEntry {
  index: number
  ac: string
  status: AcStatus
  note?: string
}

/** Full UAT session report */
export interface UatReport {
  slug: string
  specPath: string
  verifiedAt: string
  acResults: AcVerificationEntry[]
  passCount: number
  failCount: number
  skipCount: number
  allPassed: boolean
}

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Extract acceptance criteria from spec.md content.
 * Parses bullets under ## Acceptance Criteria section.
 */
export function extractAcsFromSpec(specContent: string): string[] {
  const lines = specContent.split('\n')
  const acs: string[] = []
  let inAcSection = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+Acceptance Criteria\b/i.test(trimmed)) {
      inAcSection = true
      continue
    }
    if (inAcSection && /^##\s/.test(trimmed)) {
      inAcSection = false
      continue
    }
    if (inAcSection && /^[-*]\s/.test(trimmed)) {
      const acText = trimmed.replace(/^[-*]\s*(\[[ x]\]\s*)?/, '').trim()
      if (acText) acs.push(acText)
    }
  }

  return acs
}

/**
 * Format a UAT report as markdown.
 * Includes pass/fail/skip per AC and summary counts.
 */
export function formatUatReport(report: UatReport): string {
  const statusIcon = (s: AcStatus) => s === 'pass' ? '✅ PASS' : s === 'fail' ? '❌ FAIL' : '⏭️ SKIP'

  const rows = report.acResults
    .map(r => {
      const note = r.note ? ` — _${r.note}_` : ''
      return `| ${r.index + 1} | ${r.ac} | ${statusIcon(r.status)}${note} |`
    })
    .join('\n')

  const total = report.acResults.length
  const pct = total > 0 ? Math.round((report.passCount / total) * 100) : 0
  const overall = report.allPassed ? '✅ VERIFIED' : '❌ NOT VERIFIED'

  return [
    `# UAT Verification Report — ${report.slug}`,
    '',
    `> Verified: ${report.verifiedAt}`,
    `> Spec: \`${report.specPath}\``,
    `> Result: **${overall}**`,
    '',
    '## Acceptance Criteria Results',
    '',
    '| # | Criterion | Status |',
    '|---|-----------|--------|',
    rows,
    '',
    '## Summary',
    '',
    `- **Total**: ${total}`,
    `- **Passed**: ${report.passCount} (${pct}%)`,
    `- **Failed**: ${report.failCount}`,
    `- **Skipped**: ${report.skipCount}`,
    `- **Overall**: ${overall}`,
    '',
  ].join('\n')
}

/**
 * Build guidance text for a specific AC.
 * Provides structured hints for what to check and the expected outcome.
 */
export function buildAcGuidance(ac: string): string {
  const lower = ac.toLowerCase()

  if (lower.includes('test') || lower.includes('spec')) {
    return 'Run the relevant tests and confirm they all pass.'
  }
  if (lower.includes('typecheck') || lower.includes('type check')) {
    return 'Run `npm run typecheck` (or equivalent) and confirm zero errors.'
  }
  if (lower.includes('lint')) {
    return 'Run `npm run lint` and confirm zero lint errors.'
  }
  if (lower.includes('file') || lower.includes('creat') || lower.includes('generat')) {
    return 'Verify the expected file(s) exist at the correct path(s) with the correct content.'
  }
  if (lower.includes('command') || lower.includes('cli')) {
    return 'Run the command and verify it produces the expected output or behavior.'
  }
  if (lower.includes('error') || lower.includes('fail')) {
    return 'Trigger the error scenario and verify the correct error message/behavior is shown.'
  }
  if (lower.includes('log') || lower.includes('audit')) {
    return 'Check the audit log file and verify the expected entry was appended.'
  }

  return 'Manually verify that the stated outcome is achieved as described.'
}

/**
 * Find the most recent spec directory slug in .buildpact/specs/.
 */
export async function findLatestSpecSlug(projectDir: string): Promise<string | undefined> {
  try {
    const specsDir = join(projectDir, '.buildpact', 'specs')
    const entries = await readdir(specsDir)
    if (entries.length === 0) return undefined
    return entries[entries.length - 1]
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(args: string[]) {
    const projectDir = process.cwd()
    const configPath = join(projectDir, '.buildpact', 'config.yaml')

    let lang: SupportedLanguage = 'en'
    try {
      const configContent = await readFile(configPath, 'utf-8')
      const langMatch = /^language:\s*(.+)$/m.exec(configContent)
      if (langMatch) lang = (langMatch[1]?.trim() ?? 'en') as SupportedLanguage
    } catch {
      // default to 'en'
    }

    const i18n: I18nResolver = createI18n(lang)
    const auditPath = join(projectDir, '.buildpact', 'audit', 'verify.log')
    const audit = new AuditLogger(auditPath)

    clack.intro(i18n.t('cli.verify.welcome'))

    // Resolve spec path — CLI arg or latest in .buildpact/specs/
    let specPath: string
    let slug: string

    if (args[0]) {
      specPath = args[0]
      const parts = specPath.split('/')
      slug = parts[parts.length - 2] ?? parts[parts.length - 1] ?? 'unknown'
    } else {
      const latestSlug = await findLatestSpecSlug(projectDir)
      if (!latestSlug) {
        clack.outro(i18n.t('cli.verify.no_spec_found'))
        return err({ code: ERROR_CODES.SPEC_NOT_FOUND, i18nKey: 'cli.verify.no_spec_found' })
      }
      slug = latestSlug
      specPath = join(projectDir, '.buildpact', 'specs', slug, 'spec.md')
    }

    // Load spec
    let specContent: string
    try {
      specContent = await readFile(specPath, 'utf-8')
    } catch {
      const msg = i18n.t('cli.verify.spec_not_found', { path: specPath })
      clack.outro(msg)
      return err({ code: ERROR_CODES.SPEC_NOT_FOUND, i18nKey: 'cli.verify.spec_not_found', params: { path: specPath } })
    }

    const acs = extractAcsFromSpec(specContent)

    if (acs.length === 0) {
      clack.outro(i18n.t('cli.verify.no_acs_found'))
      return err({ code: ERROR_CODES.SPEC_NOT_FOUND, i18nKey: 'cli.verify.no_acs_found' })
    }

    clack.log.info(i18n.t('cli.verify.ac_count', { count: String(acs.length), slug }))

    await audit.log({
      action: 'verify.start',
      agent: 'verify-handler',
      files: [specPath],
      outcome: 'success',
    })

    // Walk through each AC
    const acResults: AcVerificationEntry[] = []

    for (let i = 0; i < acs.length; i++) {
      const ac = acs[i] ?? ''
      const guidance = buildAcGuidance(ac)

      clack.log.step(i18n.t('cli.verify.ac_header', { index: String(i + 1), total: String(acs.length) }))
      clack.log.message(i18n.t('cli.verify.ac_criterion', { ac }))
      clack.log.message(i18n.t('cli.verify.ac_guidance', { guidance }))

      const verdict = await clack.select({
        message: i18n.t('cli.verify.ac_prompt'),
        options: [
          { value: 'pass', label: i18n.t('cli.verify.verdict_pass') },
          { value: 'fail', label: i18n.t('cli.verify.verdict_fail') },
          { value: 'skip', label: i18n.t('cli.verify.verdict_skip') },
        ],
      })

      if (clack.isCancel(verdict)) {
        clack.cancel(i18n.t('cli.verify.cancelled'))
        return ok(undefined)
      }

      let note: string | undefined
      if (verdict === 'fail') {
        const noteInput = await clack.text({
          message: i18n.t('cli.verify.fail_note_prompt'),
          placeholder: i18n.t('cli.verify.fail_note_placeholder'),
        })
        if (!clack.isCancel(noteInput) && noteInput) {
          note = noteInput
        }
      }

      acResults.push({ index: i, ac, status: verdict as AcStatus, ...(note !== undefined && { note }) })
    }

    // Build report
    const passCount = acResults.filter(r => r.status === 'pass').length
    const failCount = acResults.filter(r => r.status === 'fail').length
    const skipCount = acResults.filter(r => r.status === 'skip').length
    const allPassed = failCount === 0 && passCount > 0

    const report: UatReport = {
      slug,
      specPath,
      verifiedAt: new Date().toISOString(),
      acResults,
      passCount,
      failCount,
      skipCount,
      allPassed,
    }

    const reportContent = formatUatReport(report)

    // Write verification report
    const reportDir = join(projectDir, '.buildpact', 'specs', slug)
    const reportPath = join(reportDir, 'verification-report.md')

    await mkdir(reportDir, { recursive: true })
    await writeFile(reportPath, reportContent, 'utf-8')

    // Mark spec as verified by appending a marker comment
    const verifiedMarker = `\n<!-- verified: ${report.verifiedAt} | pass:${passCount} fail:${failCount} skip:${skipCount} -->\n`
    await writeFile(specPath, specContent + verifiedMarker, 'utf-8')

    await audit.log({
      action: 'verify.complete',
      agent: 'verify-handler',
      files: [specPath, reportPath],
      outcome: allPassed ? 'success' : 'failure',
    })

    // Show summary
    if (allPassed) {
      clack.log.success(i18n.t('cli.verify.all_passed', { count: String(passCount) }))
    } else {
      clack.log.warn(i18n.t('cli.verify.has_failures', { fail: String(failCount), pass: String(passCount) }))
    }

    clack.outro(i18n.t('cli.verify.report_saved', { path: reportPath }))

    return ok(undefined)
  },
}
