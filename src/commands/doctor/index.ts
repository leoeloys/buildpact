import * as clack from '@clack/prompts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ok, err } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'
import { checkNodeVersion, checkGitAvailable, checkBuildpactDir, checkIdeConfigs, checkSquadIntegrity } from './checks.js'
import { reportCheck } from './reporter.js'
import type { CheckResult } from './types.js'

/** Parse config.yaml to extract language setting */
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
  } catch {
    // Config missing or unreadable — fall back to English
  }
  return 'en'
}

export const handler: CommandHandler = {
  async run(_args: string[]) {
    const projectDir = process.cwd()
    const lang = readLanguage(projectDir)
    const i18n = createI18n(lang)

    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))
    await audit.log({ action: 'doctor.start', agent: 'doctor', files: [], outcome: 'success' })

    clack.intro(i18n.t('cli.doctor.title'))

    const results: CheckResult[] = []

    // 1. Node.js version
    const nodeResult = checkNodeVersion(i18n)
    reportCheck(nodeResult)
    results.push(nodeResult)

    // 2. Git availability
    const gitResult = checkGitAvailable(i18n)
    reportCheck(gitResult)
    results.push(gitResult)

    // 3. .buildpact/ directory consistency
    const dirResult = await checkBuildpactDir(projectDir, i18n)
    reportCheck(dirResult)
    results.push(dirResult)

    // 4. IDE configuration
    const ideResult = await checkIdeConfigs(projectDir, i18n)
    reportCheck(ideResult)
    results.push(ideResult)

    // 5. Squad integrity
    const squadResult = await checkSquadIntegrity(projectDir, i18n)
    reportCheck(squadResult)
    results.push(squadResult)

    const failCount = results.filter(r => r.status === 'fail').length

    if (failCount > 0) {
      clack.outro(i18n.t('cli.doctor.summary_issues', { fail_count: String(failCount) }))
      await audit.log({ action: 'doctor.complete', agent: 'doctor', files: [], outcome: 'failure', error: `${failCount} check(s) failed` })
      return err({ code: 'DOCTOR_CHECK_FAILED', i18nKey: 'cli.doctor.summary_issues', params: { fail_count: String(failCount) } })
    }

    clack.outro(i18n.t('cli.doctor.summary_healthy'))
    await audit.log({ action: 'doctor.complete', agent: 'doctor', files: [], outcome: 'success' })
    return ok(undefined)
  },
}
