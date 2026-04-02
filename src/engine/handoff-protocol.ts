/**
 * Handoff Protocol — formal transition between agents.
 * Ensures every agent dispatch has a validated packet with briefing,
 * expected output, and acceptance criteria. No implicit context inheritance.
 * @module engine/handoff-protocol
 * @see Original BuildPact concept 16.2
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { HandoffPacket, HandoffValidation, GoalAncestry } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// ID generation (collision-safe across parallel agents)
// ---------------------------------------------------------------------------

/** Generate a unique handoff ID using timestamp + random suffix */
function generateHandoffId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `HOF-${ts}-${rand}`
}

/** Reset (no-op — kept for backward compatibility with tests) */
export function resetHandoffCounter(): void {
  // No-op: IDs are now timestamp-based, not counter-based
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateHandoffOptions {
  briefing: string
  goalAncestry?: GoalAncestry
  expectedOutput: HandoffPacket['expectedOutput']
  contextFiles?: string[]
  priorDecisions?: string[]
  constraints?: string[]
}

/**
 * Create a new handoff packet with auto-generated ID and timestamp.
 * Pure factory — does not validate; call validateHandoffPacket separately.
 */
export function createHandoffPacket(
  fromAgent: string,
  toAgent: string,
  taskId: string,
  opts: CreateHandoffOptions,
): HandoffPacket {
  const id = generateHandoffId()

  return {
    id,
    fromAgent,
    toAgent,
    taskId,
    briefing: opts.briefing,
    goalAncestry: opts.goalAncestry ?? undefined,
    expectedOutput: opts.expectedOutput,
    contextFiles: opts.contextFiles ?? [],
    priorDecisions: opts.priorDecisions ?? [],
    constraints: opts.constraints ?? [],
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a handoff packet before dispatch.
 * Checks required fields: toAgent, briefing, expectedOutput with artifacts and ACs.
 * Pure function — no side effects.
 */
export function validateHandoffPacket(packet: HandoffPacket): HandoffValidation {
  const missingFields: string[] = []
  const warnings: string[] = []

  if (!packet.toAgent || packet.toAgent.trim() === '') {
    missingFields.push('toAgent')
  }

  if (!packet.briefing || packet.briefing.trim() === '') {
    missingFields.push('briefing')
  }

  if (!packet.expectedOutput) {
    missingFields.push('expectedOutput')
  } else {
    if (!packet.expectedOutput.artifacts || packet.expectedOutput.artifacts.length === 0) {
      missingFields.push('expectedOutput.artifacts')
    }
    if (!packet.expectedOutput.acceptanceCriteria || packet.expectedOutput.acceptanceCriteria.length === 0) {
      missingFields.push('expectedOutput.acceptanceCriteria')
    }
  }

  if (!packet.fromAgent || packet.fromAgent.trim() === '') {
    warnings.push('fromAgent is empty — handoff origin will be unknown')
  }

  if (packet.contextFiles.length === 0) {
    warnings.push('No context files specified — receiver starts with no file context')
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
  }
}

/**
 * Validate and return Result — for use in dispatch pipelines.
 */
export function requireValidHandoff(packet: HandoffPacket): Result<HandoffPacket> {
  const validation = validateHandoffPacket(packet)

  if (!validation.valid) {
    if (validation.missingFields.includes('toAgent')) {
      return err({
        code: ERROR_CODES.HANDOFF_NO_TARGET_AGENT,
        i18nKey: 'error.handoff.no_target_agent',
        params: { from: packet.fromAgent, taskId: packet.taskId },
      })
    }
    if (validation.missingFields.includes('expectedOutput.acceptanceCriteria')) {
      return err({
        code: ERROR_CODES.HANDOFF_MISSING_ACCEPTANCE_CRITERIA,
        i18nKey: 'error.handoff.missing_acceptance_criteria',
        params: { taskId: packet.taskId },
      })
    }
    return err({
      code: ERROR_CODES.HANDOFF_PACKET_INVALID,
      i18nKey: 'error.handoff.packet_invalid',
      params: { missing: validation.missingFields.join(', ') },
    })
  }

  return ok(packet)
}

// ---------------------------------------------------------------------------
// Briefing formatter
// ---------------------------------------------------------------------------

/**
 * Format a handoff packet into a compact briefing string for prompt injection.
 * The receiver agent gets this as context at the start of its session.
 */
export function formatHandoffBriefing(packet: HandoffPacket): string {
  const lines: string[] = [
    `## Handoff Briefing [${packet.id}]`,
    '',
    `**From:** ${packet.fromAgent} → **To:** ${packet.toAgent}`,
    `**Task:** ${packet.taskId}`,
    '',
  ]

  if (packet.goalAncestry) {
    lines.push('**Goal Chain:**')
    lines.push(`- Mission: ${packet.goalAncestry.mission}`)
    lines.push(`- Project: ${packet.goalAncestry.projectGoal}`)
    lines.push(`- Phase: ${packet.goalAncestry.phaseGoal}`)
    lines.push(`- Task: ${packet.goalAncestry.taskObjective}`)
    lines.push('')
  }

  lines.push('**Briefing:**', packet.briefing, '')

  lines.push('**Expected Output:**')
  lines.push(`- Type: ${packet.expectedOutput.type}`)
  lines.push(`- Artifacts: ${packet.expectedOutput.artifacts.join(', ')}`)
  lines.push('- Acceptance Criteria:')
  for (const ac of packet.expectedOutput.acceptanceCriteria) {
    lines.push(`  - ${ac}`)
  }
  lines.push('')

  if (packet.contextFiles.length > 0) {
    lines.push(`**Read these files:** ${packet.contextFiles.join(', ')}`)
    lines.push('')
  }

  if (packet.priorDecisions.length > 0) {
    lines.push('**Prior Decisions:**')
    for (const d of packet.priorDecisions) {
      lines.push(`- ${d}`)
    }
    lines.push('')
  }

  if (packet.constraints.length > 0) {
    lines.push('**Constraints:**')
    for (const c of packet.constraints) {
      lines.push(`- ${c}`)
    }
  }

  return lines.join('\n')
}
