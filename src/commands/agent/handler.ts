/**
 * Agent command handler.
 * Subcommands: start, stop, status.
 * @see Epic 22.1 — Agent Mode TypeScript CLI
 */

import * as clack from '@clack/prompts'
import { join } from 'node:path'
import { ok, err } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import { createI18n } from '../../foundation/i18n.js'
import { readLanguage } from '../../foundation/config-reader.js'
import { AuditLogger } from '../../foundation/audit.js'
import { AgentSupervisor } from '../../engine/agent-supervisor.js'

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(args: string[]): Promise<Result<void>> {
    const projectDir = process.cwd()
    const lang = readLanguage(projectDir)
    const i18n = createI18n(lang)
    const audit = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'cli.jsonl'))
    const supervisor = new AgentSupervisor(projectDir)

    const subcommand = args[0]

    if (!subcommand || subcommand === '--help') {
      clack.log.info(i18n.t('cli.agent.welcome'))
      clack.log.info(i18n.t('cli.agent.usage'))
      return ok(undefined)
    }

    if (subcommand === 'start') {
      clack.log.info(i18n.t('cli.agent.starting'))
      const result = supervisor.start()

      if (!result.ok) {
        await audit.log({ action: 'agent.start', agent: 'agent', files: [], outcome: 'failure', error: result.error.code })
        if (result.error.code === 'AGENT_ALREADY_RUNNING') {
          clack.log.warn(i18n.t('cli.agent.already_running', result.error.params ?? {}))
        }
        return result as Result<void>
      }

      if (result.value.staleDetected) {
        clack.log.warn(i18n.t('cli.agent.stale_pid'))
      }

      await audit.log({ action: 'agent.start', agent: 'agent', files: [], outcome: 'success' })
      clack.log.success(i18n.t('cli.agent.started', { pid: String(result.value.pid) }))
      return ok(undefined)
    }

    if (subcommand === 'stop') {
      clack.log.info(i18n.t('cli.agent.stopping'))
      const result = supervisor.stop()

      if (!result.ok) {
        await audit.log({ action: 'agent.stop', agent: 'agent', files: [], outcome: 'failure', error: result.error.code })
        clack.log.warn(i18n.t('cli.agent.not_running'))
        return result
      }

      await audit.log({ action: 'agent.stop', agent: 'agent', files: [], outcome: 'success' })
      clack.log.success(i18n.t('cli.agent.stopped'))
      return ok(undefined)
    }

    if (subcommand === 'status') {
      const status = supervisor.status()

      if (!status.running) {
        clack.log.info(i18n.t('cli.agent.not_running'))
        return ok(undefined)
      }

      clack.log.info(i18n.t('cli.agent.status_title'))
      clack.log.info([
        `  PID:              ${status.pid ?? 'N/A'}`,
        `  Uptime:           ${status.uptime ?? 'N/A'}`,
        `  Active agents:    ${status.activeAgents}`,
        `  Tasks processed:  ${status.tasksProcessed}`,
        `  Memory usage:     ${status.memoryUsageMb} MB`,
      ].join('\n'))

      await audit.log({ action: 'agent.status', agent: 'agent', files: [], outcome: 'success' })
      return ok(undefined)
    }

    // Unknown subcommand
    clack.log.info(i18n.t('cli.agent.welcome'))
    clack.log.info('Usage: buildpact agent <start|stop|status>')
    return ok(undefined)
  },
}
