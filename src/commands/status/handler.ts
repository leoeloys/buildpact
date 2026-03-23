/**
 * Status command handler.
 * Renders a color-coded pipeline progress dashboard.
 * Read-only — no mutations to state files.
 * Flags: --json
 * @see Story 14.3 — Status Pipeline Dashboard
 */

import * as clack from '@clack/prompts'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ok, err } from '../../contracts/errors.js'
import type { Result } from '../../contracts/errors.js'
import type { CommandHandler } from '../registry.js'
import type { SupportedLanguage } from '../../contracts/i18n.js'
import { createI18n } from '../../foundation/i18n.js'
import { AuditLogger } from '../../foundation/audit.js'

// Simple ANSI color helpers (avoid adding picocolors as direct dependency)
const pc = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
}

// ---------------------------------------------------------------------------
// Inline types for dashboard state (avoids depending on dashboard-state.ts)
// ---------------------------------------------------------------------------

/** Pipeline phase type */
export type PipelinePhase = 'specify' | 'plan' | 'execute' | 'verify'

/** Pipeline state from state.json */
interface PipelineState {
  phase: PipelinePhase | 'idle' | string
  waveNumber?: number
  totalWaves?: number
  taskIndex?: number
  totalTasks?: number
  startedAt?: string
}

/** Dashboard state from state.json */
interface DashboardState {
  pipeline: PipelineState
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read language from .buildpact/config.yaml, fallback to 'en' */
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
    // Config missing or unreadable
  }
  return 'en'
}

/** Read dashboard state from .buildpact/state.json */
function loadState(projectDir: string): DashboardState | undefined {
  const statePath = join(projectDir, '.buildpact', 'state.json')
  if (!existsSync(statePath)) return undefined
  try {
    return JSON.parse(readFileSync(statePath, 'utf-8')) as DashboardState
  } catch {
    return undefined
  }
}

/** Count files in a directory matching a filter, return 0 if dir doesn't exist */
export function countFiles(dir: string, filter: (name: string) => boolean = () => true): number {
  try {
    return readdirSync(dir).filter(filter).length
  } catch {
    return 0
  }
}

/** Format elapsed time from ISO timestamp to now as "Xm Ys" */
export function formatElapsed(startedAt: string): string {
  const startMs = new Date(startedAt).getTime()
  const nowMs = Date.now()
  const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000))
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60
  return `${minutes}m ${seconds}s`
}

/** Render a phase status indicator */
export function phaseIndicator(phase: string, activePhase: string | undefined): string {
  const pipelinePhases: PipelinePhase[] = ['specify', 'plan', 'execute', 'verify']
  const phaseIdx = pipelinePhases.indexOf(phase as PipelinePhase)
  const activeIdx = activePhase ? pipelinePhases.indexOf(activePhase as PipelinePhase) : -1

  if (activePhase === phase) {
    return pc.yellow('● ' + phase)
  }
  if (activeIdx >= 0 && phaseIdx < activeIdx) {
    return pc.green('✓ ' + phase)
  }
  return pc.dim('- ' + phase)
}

/** Count feedback entries from .buildpact/memory/feedback/ */
export function countFeedbackEntries(feedbackDir: string): number {
  try {
    const files = readdirSync(feedbackDir).filter(f => f.endsWith('.json'))
    let total = 0
    for (const file of files) {
      try {
        const raw = readFileSync(join(feedbackDir, file), 'utf-8')
        const parsed = JSON.parse(raw) as { entries?: unknown[] }
        total += parsed.entries?.length ?? 0
      } catch {
        // Skip
      }
    }
    return total
  } catch {
    return 0
  }
}

/** Parse --json flag from args */
export function parseStatusFlags(args: string[]): { json: boolean } {
  return { json: args.includes('--json') }
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export const handler: CommandHandler = {
  async run(args: string[]): Promise<Result<void>> {
    const projectDir = process.cwd()
    const buildpactDir = join(projectDir, '.buildpact')
    const { json } = parseStatusFlags(args)

    if (!existsSync(buildpactDir)) {
      if (json) {
        process.stdout.write(JSON.stringify({ error: 'No .buildpact directory found' }, null, 2) + '\n')
      }
      return err({
        code: 'NO_PROJECT',
        i18nKey: 'cli.status.no_project',
      })
    }

    const lang = readLanguage(projectDir)
    const i18n = createI18n(lang)
    const audit = new AuditLogger(join(buildpactDir, 'audit', 'cli.jsonl'))
    await audit.log({ action: 'status.view', agent: 'status', files: [], outcome: 'success' })

    // Load pipeline state
    const state = loadState(projectDir)
    const activePhase = state?.pipeline.phase === 'idle' ? undefined : state?.pipeline.phase

    // Artifact counts
    const specCount = countFiles(join(buildpactDir, 'specs'), f => f.endsWith('.md'))
    const planCount = countFiles(join(buildpactDir, 'plans'), f => f.endsWith('.md') || f.endsWith('.yaml'))
    const verifyCount = countFiles(join(buildpactDir, 'verify'), f => f.endsWith('.json'))

    // Task counts from state
    const totalTasks = state?.pipeline.totalTasks ?? 0
    const taskIndex = state?.pipeline.taskIndex ?? 0

    // Memory summary
    const memoryDir = join(buildpactDir, 'memory')
    const feedbackCount = countFeedbackEntries(join(memoryDir, 'feedback'))
    const lessonsCount = countFiles(join(memoryDir, 'lessons'), f => f.endsWith('.json'))
    const decisionsCount = countFiles(join(memoryDir, 'decisions'), f => f.endsWith('.json'))

    // Execution progress
    const wave = state?.pipeline.waveNumber ?? 0
    const totalWaves = state?.pipeline.totalWaves ?? 0
    const elapsed = state?.pipeline.startedAt ? formatElapsed(state.pipeline.startedAt) : undefined

    if (json) {
      const data = {
        phase: activePhase ?? 'idle',
        artifacts: { specs: specCount, plans: planCount, verifications: verifyCount },
        tasks: { completed: taskIndex, total: totalTasks },
        waves: { current: wave, total: totalWaves },
        elapsed: elapsed ?? null,
        memory: { feedback: feedbackCount, lessons: lessonsCount, decisions: decisionsCount },
      }
      process.stdout.write(JSON.stringify(data, null, 2) + '\n')
      return ok(undefined)
    }

    clack.log.info(i18n.t('cli.status.header'))

    // Render pipeline phases
    const phases: PipelinePhase[] = ['specify', 'plan', 'execute', 'verify']
    const phaseLines = phases.map(p => phaseIndicator(p, activePhase)).join('  ')
    clack.log.info(phaseLines)

    clack.log.info(
      `Specs: ${specCount}  Plans: ${planCount}  Tasks: ${pc.dim(String(taskIndex))}/${pc.dim(String(totalTasks))}  Verifications: ${verifyCount}`,
    )

    if (state?.pipeline.phase === 'execute' || (state?.pipeline.waveNumber && state.pipeline.totalWaves)) {
      clack.log.info(`Wave ${wave}/${totalWaves}  Elapsed: ${elapsed ?? '-'}`)
    }

    clack.log.info(
      i18n.t('cli.status.memory_summary', {
        feedback: String(feedbackCount),
        lessons: String(lessonsCount),
        decisions: String(decisionsCount),
      }),
    )

    return ok(undefined)
  },
}
