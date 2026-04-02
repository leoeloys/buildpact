/**
 * Session Forensics — reconstruct crash traces and generate recovery briefings.
 * When a session crashes, reconstructs what happened from the audit log
 * and injects a briefing into the recovery session.
 *
 * @module engine/session-forensics
 * @see Concept 12.2 (GSD-2 session forensics)
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ExecutionTrace, TracedToolCall, RecoveryBriefing } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Trace reconstruction
// ---------------------------------------------------------------------------

/**
 * Create an empty execution trace.
 */
export function createEmptyTrace(): ExecutionTrace {
  return {
    toolCalls: [],
    filesWritten: [],
    filesRead: [],
    commandsRun: [],
    errors: [],
    lastReasoning: '',
    toolCallCount: 0,
  }
}

/**
 * Add a tool call to the trace.
 */
export function addToolCall(trace: ExecutionTrace, call: TracedToolCall): ExecutionTrace {
  const filesWritten = call.name === 'Write' || call.name === 'Edit'
    ? [...trace.filesWritten, String(call.input.file_path ?? call.input.path ?? '')]
    : trace.filesWritten

  const filesRead = call.name === 'Read'
    ? [...trace.filesRead, String(call.input.file_path ?? '')]
    : trace.filesRead

  const commandsRun = call.name === 'Bash'
    ? [...trace.commandsRun, String(call.input.command ?? '')]
    : trace.commandsRun

  const errors = call.isError
    ? [...trace.errors, `${call.name}: ${call.result ?? 'error'}`]
    : trace.errors

  return {
    ...trace,
    toolCalls: [...trace.toolCalls, call],
    filesWritten: [...new Set(filesWritten)],
    filesRead: [...new Set(filesRead)],
    commandsRun,
    errors,
    toolCallCount: trace.toolCallCount + 1,
  }
}

/**
 * Reconstruct execution trace from audit log lines.
 * Each line is a JSON object with action, files, outcome fields.
 */
export function reconstructTrace(auditLines: string[]): Result<ExecutionTrace> {
  if (auditLines.length === 0) {
    return err({
      code: ERROR_CODES.FORENSICS_NO_AUDIT_DATA,
      i18nKey: 'error.forensics.no_audit_data',
    })
  }

  let trace = createEmptyTrace()

  for (const line of auditLines) {
    try {
      const entry = JSON.parse(line) as {
        action?: string
        files?: string[]
        outcome?: string
        error?: string
      }

      if (entry.action?.startsWith('tool.')) {
        const toolName = entry.action.replace('tool.', '')
        trace = addToolCall(trace, {
          name: toolName,
          input: {},
          result: entry.error,
          isError: entry.outcome === 'failure',
        })
      }

      if (entry.files) {
        for (const f of entry.files) {
          if (!trace.filesWritten.includes(f)) {
            trace = { ...trace, filesWritten: [...trace.filesWritten, f] }
          }
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return ok(trace)
}

// ---------------------------------------------------------------------------
// Recovery briefing
// ---------------------------------------------------------------------------

/**
 * Generate a recovery briefing from an execution trace.
 */
export function generateRecoveryBriefing(
  unitType: string,
  unitId: string,
  trace: ExecutionTrace,
  gitChanges: string | null = null,
): RecoveryBriefing {
  const promptLines: string[] = [
    '## Recovery Briefing — Crashed Session',
    '',
    `**Unit:** ${unitType} / ${unitId}`,
    `**Tool calls made:** ${trace.toolCallCount}`,
    '',
  ]

  if (trace.errors.length > 0) {
    promptLines.push('**Errors encountered:**')
    for (const e of trace.errors.slice(-5)) {
      promptLines.push(`- ${e}`)
    }
    promptLines.push('')
  }

  if (trace.filesWritten.length > 0) {
    promptLines.push(`**Files written:** ${trace.filesWritten.join(', ')}`)
  }

  if (trace.commandsRun.length > 0) {
    promptLines.push('**Commands run:**')
    for (const c of trace.commandsRun.slice(-5)) {
      promptLines.push(`- \`${c}\``)
    }
    promptLines.push('')
  }

  if (gitChanges) {
    promptLines.push('**Git changes since start:**')
    promptLines.push('```')
    promptLines.push(gitChanges)
    promptLines.push('```')
  }

  if (trace.lastReasoning) {
    promptLines.push('**Last reasoning before crash:**')
    promptLines.push(trace.lastReasoning)
  }

  return {
    unitType,
    unitId,
    trace,
    gitChanges,
    prompt: promptLines.join('\n'),
  }
}

/**
 * Load audit log and generate recovery briefing.
 */
export async function buildRecoveryFromAudit(
  projectDir: string,
  unitType: string,
  unitId: string,
): Promise<Result<RecoveryBriefing>> {
  const auditPath = join(projectDir, '.buildpact', 'audit', 'cli.jsonl')
  try {
    const content = await readFile(auditPath, 'utf-8')
    const lines = content.trim().split('\n').filter(l => l.trim() !== '')

    const traceResult = reconstructTrace(lines)
    if (!traceResult.ok) return traceResult as Result<never>

    return ok(generateRecoveryBriefing(unitType, unitId, traceResult.value))
  } catch {
    return err({
      code: ERROR_CODES.FORENSICS_NO_AUDIT_DATA,
      i18nKey: 'error.forensics.no_audit_data',
    })
  }
}
