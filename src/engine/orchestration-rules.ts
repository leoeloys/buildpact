/**
 * Orchestration Rules — programmatic multi-agent constitution enforcement.
 * These are BLOCK-level checks, not warnings. Violations prevent execution.
 *
 * Rules encode governance that cannot be left to prompt pressure:
 *   R1. Role boundary: agents must not exceed their declared role
 *   R2. Handoff completeness: every dispatch needs ACs and briefing
 *   R3. Goal ancestry: execute-phase tasks must carry goal chain
 *   R4. Artifact accountability: official artifact changes need reason + cause
 *   R5. Context pollution: state files must stay under size limits
 *   R6. No self-dispatch: agents cannot dispatch tasks to themselves
 *
 * @module engine/orchestration-rules
 * @see Original BuildPact concept 16.1–16.6
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { GoalAncestry, HandoffPacket } from '../contracts/task.js'
import { checkRoleBoundary, getBoundaryForRole } from './role-boundary.js'
import type { AgentAction } from './role-boundary.js'

// ---------------------------------------------------------------------------
// Rule identifiers
// ---------------------------------------------------------------------------

export type OrchestrationRuleId =
  | 'R1_ROLE_BOUNDARY'
  | 'R2_HANDOFF_COMPLETENESS'
  | 'R3_GOAL_ANCESTRY'
  | 'R4_ARTIFACT_ACCOUNTABILITY'
  | 'R5_CONTEXT_POLLUTION'
  | 'R6_NO_SELF_DISPATCH'

/** A single rule violation */
export interface RuleViolation {
  ruleId: OrchestrationRuleId
  message: string
  /** The value that triggered the violation (for audit) */
  evidence: string
}

/** Result of running all rules against a context */
export interface RuleCheckResult {
  passed: boolean
  violations: RuleViolation[]
}

// ---------------------------------------------------------------------------
// R1 — Role Boundary
// ---------------------------------------------------------------------------

/**
 * R1: Verify an agent action is permitted by its declared role boundary.
 * BLOCKS: orchestrators writing code, developers dispatching agents, etc.
 */
export function checkR1RoleBoundary(
  agentRole: string,
  action: AgentAction,
): RuleViolation | undefined {
  const boundary = getBoundaryForRole(agentRole)
  if (!boundary) return undefined // Unknown role — no built-in rules apply

  const result = checkRoleBoundary(boundary, action)
  if (result.ok) return undefined

  return {
    ruleId: 'R1_ROLE_BOUNDARY',
    message: `Role "${agentRole}" cannot perform this action: ${result.error.params?.reason ?? result.error.params?.tool ?? 'blocked'}`,
    evidence: action.toolName ?? action.filePath ?? action.outputContent ?? 'unknown',
  }
}

// ---------------------------------------------------------------------------
// R2 — Handoff Completeness
// ---------------------------------------------------------------------------

/**
 * R2: Every handoff packet must have: toAgent, briefing, ≥1 artifact, ≥1 AC.
 * BLOCKS: lazy dispatches with "just do it" instructions.
 */
export function checkR2HandoffCompleteness(
  packet: HandoffPacket,
): RuleViolation | undefined {
  const missing: string[] = []

  if (!packet.toAgent || packet.toAgent.trim() === '') missing.push('toAgent')
  if (!packet.briefing || packet.briefing.trim() === '') missing.push('briefing')
  if (!packet.expectedOutput?.artifacts?.length) missing.push('expectedOutput.artifacts')
  if (!packet.expectedOutput?.acceptanceCriteria?.length) missing.push('expectedOutput.acceptanceCriteria')

  if (missing.length === 0) return undefined

  return {
    ruleId: 'R2_HANDOFF_COMPLETENESS',
    message: `Handoff packet is incomplete. Missing: ${missing.join(', ')}`,
    evidence: `taskId=${packet.taskId}, from=${packet.fromAgent}`,
  }
}

// ---------------------------------------------------------------------------
// R3 — Goal Ancestry
// ---------------------------------------------------------------------------

/**
 * R3: Tasks in execute phase must carry goal ancestry so agents know the "why".
 * BLOCKS: goalless execution that leads to paperclip-maximizer drift.
 */
export function checkR3GoalAncestry(
  phase: string,
  goalAncestry: GoalAncestry | undefined,
): RuleViolation | undefined {
  if (phase !== 'execute') return undefined // Only enforced during execution
  if (!goalAncestry) {
    return {
      ruleId: 'R3_GOAL_ANCESTRY',
      message: 'Execute-phase tasks must carry goal ancestry (mission → project → phase → task)',
      evidence: `phase=${phase}, goalAncestry=undefined`,
    }
  }

  const empty: string[] = []
  if (!goalAncestry.mission.trim()) empty.push('mission')
  if (!goalAncestry.projectGoal.trim()) empty.push('projectGoal')
  if (!goalAncestry.phaseGoal.trim()) empty.push('phaseGoal')
  if (!goalAncestry.taskObjective.trim()) empty.push('taskObjective')

  if (empty.length === 0) return undefined

  return {
    ruleId: 'R3_GOAL_ANCESTRY',
    message: `Goal ancestry has empty fields: ${empty.join(', ')}`,
    evidence: `phase=${phase}, empty=[${empty.join(',')}]`,
  }
}

// ---------------------------------------------------------------------------
// R4 — Artifact Accountability
// ---------------------------------------------------------------------------

/**
 * R4: Changes to official artifacts (spec, plan, PRD, constitution, etc.)
 * must have a reason and a causal task. No anonymous edits.
 * BLOCKS: undocumented spec drift.
 */
export function checkR4ArtifactAccountability(
  reason: string,
  causedBy: string,
): RuleViolation | undefined {
  const missing: string[] = []
  if (!reason || reason.trim() === '') missing.push('reason')
  if (!causedBy || causedBy.trim() === '') missing.push('causedBy')

  if (missing.length === 0) return undefined

  return {
    ruleId: 'R4_ARTIFACT_ACCOUNTABILITY',
    message: `Artifact change missing accountability: ${missing.join(', ')}`,
    evidence: `reason="${reason}", causedBy="${causedBy}"`,
  }
}

// ---------------------------------------------------------------------------
// R5 — Context Pollution
// ---------------------------------------------------------------------------

/** Maximum allowed lines for orchestrator state files */
export const MAX_STATE_LINES = 50
/** Maximum allowed bytes for a single handoff briefing */
export const MAX_BRIEFING_BYTES = 4096

/**
 * R5: State and briefing files must stay compact to prevent context pollution.
 * BLOCKS: bloated state that eats into the LLM context window.
 */
export function checkR5ContextPollution(
  content: string,
  contentType: 'state' | 'briefing',
): RuleViolation | undefined {
  if (contentType === 'state') {
    const lines = content.split('\n').length
    if (lines > MAX_STATE_LINES) {
      return {
        ruleId: 'R5_CONTEXT_POLLUTION',
        message: `State file has ${lines} lines (max ${MAX_STATE_LINES})`,
        evidence: `lines=${lines}`,
      }
    }
  }

  if (contentType === 'briefing') {
    const bytes = Buffer.byteLength(content, 'utf-8')
    if (bytes > MAX_BRIEFING_BYTES) {
      return {
        ruleId: 'R5_CONTEXT_POLLUTION',
        message: `Briefing is ${bytes} bytes (max ${MAX_BRIEFING_BYTES})`,
        evidence: `bytes=${bytes}`,
      }
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------
// R6 — No Self-Dispatch
// ---------------------------------------------------------------------------

/**
 * R6: An agent cannot dispatch a task to itself.
 * BLOCKS: infinite recursion loops.
 */
export function checkR6NoSelfDispatch(
  fromAgent: string,
  toAgent: string,
): RuleViolation | undefined {
  if (fromAgent === toAgent && fromAgent.trim() !== '') {
    return {
      ruleId: 'R6_NO_SELF_DISPATCH',
      message: `Agent "${fromAgent}" attempted to dispatch to itself`,
      evidence: `from=${fromAgent}, to=${toAgent}`,
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Composite check — run all applicable rules
// ---------------------------------------------------------------------------

export interface DispatchRuleContext {
  fromRole: string
  fromAgent: string
  toAgent: string
  phase: string
  goalAncestry?: GoalAncestry | undefined
  packet: HandoffPacket
  briefingContent?: string | undefined
}

/**
 * Run all orchestration rules against a dispatch context.
 * Returns BLOCK result with all violations if any rule fails.
 */
export function enforceOrchestrationRules(ctx: DispatchRuleContext): RuleCheckResult {
  const violations: RuleViolation[] = []

  // R1: Role boundary — can this role dispatch?
  const r1 = checkR1RoleBoundary(ctx.fromRole, { toolName: 'Agent' })
  if (r1) violations.push(r1)

  // R2: Handoff completeness
  const r2 = checkR2HandoffCompleteness(ctx.packet)
  if (r2) violations.push(r2)

  // R3: Goal ancestry (execute phase only)
  const r3 = checkR3GoalAncestry(ctx.phase, ctx.goalAncestry)
  if (r3) violations.push(r3)

  // R5: Briefing size
  if (ctx.briefingContent) {
    const r5 = checkR5ContextPollution(ctx.briefingContent, 'briefing')
    if (r5) violations.push(r5)
  }

  // R6: No self-dispatch
  const r6 = checkR6NoSelfDispatch(ctx.fromAgent, ctx.toAgent)
  if (r6) violations.push(r6)

  return {
    passed: violations.length === 0,
    violations,
  }
}

/**
 * Format violations for logging/display.
 */
export function formatRuleViolations(violations: RuleViolation[]): string {
  return violations
    .map(v => `BLOCKED [${v.ruleId}]: ${v.message}`)
    .join('\n')
}
