/**
 * Dispatch Pipeline — integrated entry point for safe agent dispatch.
 * Wires together all Fase 0 modules in a single pipeline:
 *   1. Role boundary check (can this agent perform this action?)
 *   2. Handoff packet creation + validation
 *   3. Orchestrator cycle (state read → decide → outcome)
 *   4. Ledger event registration
 *   5. Artifact changelog (if artifacts were modified)
 *
 * Callers use `dispatchWithSafetyChecks` instead of calling modules directly.
 * @module engine/dispatch-pipeline
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { GoalAncestry, HandoffPacket } from '../contracts/task.js'
import { checkRoleBoundary, getBoundaryForRole } from './role-boundary.js'
import type { AgentAction } from './role-boundary.js'
import { createHandoffPacket, requireValidHandoff, formatHandoffBriefing } from './handoff-protocol.js'
import type { CreateHandoffOptions } from './handoff-protocol.js'
import { registerEvent } from './project-ledger.js'
import { detectArtifactType, createChangeEntry, appendToChangelog } from './artifact-changelog.js'
import {
  enforceOrchestrationRules,
  checkR4ArtifactAccountability,
  formatRuleViolations,
} from './orchestration-rules.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What the caller wants to dispatch */
export interface DispatchRequest {
  /** Agent role performing the dispatch (e.g. "orchestrator") */
  fromRole: string
  /** Agent name performing the dispatch */
  fromAgent: string
  /** Target agent to receive the task */
  toAgent: string
  /** Task identifier */
  taskId: string
  /** Handoff options (briefing, expected output, etc.) */
  handoff: CreateHandoffOptions
  /** Project directory for state/ledger operations */
  projectDir: string
  /** Current pipeline phase (needed for R3 goal ancestry check) */
  phase?: string
  /** Goal ancestry for R3 enforcement */
  goalAncestry?: GoalAncestry
}

/** Result of a successful dispatch */
export interface DispatchResult {
  /** The validated handoff packet */
  packet: HandoffPacket
  /** Formatted briefing string ready for prompt injection */
  briefing: string
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Dispatch an agent task with all Fase 0 safety checks.
 *
 * Pipeline:
 * 1. Verify the dispatching agent's role allows Agent dispatch
 * 2. Create and validate the handoff packet
 * 3. Register the handoff event in the project ledger
 * 4. Return the validated packet + formatted briefing
 *
 * Pure pipeline — does NOT actually call Task(). The caller is responsible
 * for using the returned briefing to invoke the subagent.
 */
export async function dispatchWithSafetyChecks(
  request: DispatchRequest,
): Promise<Result<DispatchResult>> {
  // 1. Create handoff packet (needed for rule checks)
  const packet = createHandoffPacket(
    request.fromAgent,
    request.toAgent,
    request.taskId,
    request.handoff,
  )

  // 2. Format briefing (needed for R5 size check)
  const briefing = formatHandoffBriefing(packet)

  // 3. Run all orchestration rules (R1–R6)
  const ruleCheck = enforceOrchestrationRules({
    fromRole: request.fromRole,
    fromAgent: request.fromAgent,
    toAgent: request.toAgent,
    phase: request.phase ?? 'specify',
    goalAncestry: request.goalAncestry ?? request.handoff.goalAncestry,
    packet,
    briefingContent: briefing,
  })

  if (!ruleCheck.passed) {
    return err({
      code: ERROR_CODES.ROLE_BOUNDARY_VIOLATION,
      i18nKey: 'error.orchestration_rules.blocked',
      params: {
        violations: formatRuleViolations(ruleCheck.violations),
        count: String(ruleCheck.violations.length),
      },
    })
  }

  // 4. Validate handoff packet (structural — complements R2)
  const validationResult = requireValidHandoff(packet)
  if (!validationResult.ok) {
    return validationResult as Result<never>
  }

  // 5. Register in ledger
  await registerEvent(
    request.projectDir,
    'HANDOFF',
    packet.id,
    `${packet.fromAgent} → ${packet.toAgent} (${packet.taskId})`,
    `.buildpact/handoffs/${packet.id}.json`,
  )

  return ok({ packet, briefing })
}

// ---------------------------------------------------------------------------
// Artifact change helper
// ---------------------------------------------------------------------------

/**
 * Record an artifact change if the path is an official artifact.
 * No-op for non-artifact paths — safe to call on every file write.
 */
export async function recordArtifactChange(
  projectDir: string,
  filePath: string,
  changeType: 'added' | 'removed' | 'modified',
  summary: string,
  reason: string,
  causedBy: string,
): Promise<Result<void>> {
  const artifactType = detectArtifactType(filePath)
  if (!artifactType) return ok(undefined) // Not an official artifact — skip

  // R4: Artifact accountability — reason + cause required
  const r4 = checkR4ArtifactAccountability(reason, causedBy)
  if (r4) {
    return err({
      code: ERROR_CODES.ARTIFACT_CHANGE_NO_REASON,
      i18nKey: 'error.orchestration_rules.artifact_accountability',
      params: { rule: r4.ruleId, message: r4.message },
    })
  }

  const entry = createChangeEntry(filePath, changeType, summary, reason, causedBy)

  // Append to type-specific changelog
  const changeResult = await appendToChangelog(projectDir, entry)
  if (!changeResult.ok) return changeResult

  // Register in ledger
  await registerEvent(
    projectDir,
    'ARTIFACT_CHANGE',
    entry.id,
    `${entry.artifactType}:${entry.changeType} — ${entry.summary}`,
    `.buildpact/changelogs/${entry.artifactType}.md`,
  )

  return ok(undefined)
}
