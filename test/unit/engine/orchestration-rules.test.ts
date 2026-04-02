import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkR1RoleBoundary,
  checkR2HandoffCompleteness,
  checkR3GoalAncestry,
  checkR4ArtifactAccountability,
  checkR5ContextPollution,
  checkR6NoSelfDispatch,
  enforceOrchestrationRules,
  formatRuleViolations,
  MAX_STATE_LINES,
  MAX_BRIEFING_BYTES,
} from '../../../src/engine/orchestration-rules.js'
import { resetHandoffCounter } from '../../../src/engine/handoff-protocol.js'
import { createHandoffPacket } from '../../../src/engine/handoff-protocol.js'
import type { GoalAncestry, HandoffPacket } from '../../../src/contracts/task.js'

const GOAL: GoalAncestry = {
  mission: 'Build the best CLI',
  projectGoal: 'Ship v1.0',
  phaseGoal: 'Core pipeline',
  taskObjective: 'Implement handoff',
}

function makePacket(overrides?: Partial<Parameters<typeof createHandoffPacket>[3]>): HandoffPacket {
  return createHandoffPacket('orchestrator', 'developer', 'T-001', {
    briefing: 'Do the thing',
    expectedOutput: {
      type: 'code',
      artifacts: ['src/foo.ts'],
      acceptanceCriteria: ['Tests pass'],
    },
    ...overrides,
  })
}

describe('R1 — Role Boundary', () => {
  it('passes for orchestrator dispatching Agent', () => {
    expect(checkR1RoleBoundary('orchestrator', { toolName: 'Agent' })).toBeUndefined()
  })

  it('blocks developer dispatching Agent', () => {
    const v = checkR1RoleBoundary('developer', { toolName: 'Agent' })
    expect(v).toBeDefined()
    expect(v!.ruleId).toBe('R1_ROLE_BOUNDARY')
  })

  it('blocks reviewer dispatching Agent', () => {
    const v = checkR1RoleBoundary('reviewer', { toolName: 'Agent' })
    expect(v).toBeDefined()
  })

  it('blocks orchestrator writing files', () => {
    const v = checkR1RoleBoundary('orchestrator', { toolName: 'Write' })
    expect(v).toBeDefined()
    expect(v!.ruleId).toBe('R1_ROLE_BOUNDARY')
  })

  it('passes for unknown role (no built-in rules)', () => {
    expect(checkR1RoleBoundary('wizard', { toolName: 'Agent' })).toBeUndefined()
  })
})

describe('R2 — Handoff Completeness', () => {
  beforeEach(() => resetHandoffCounter())

  it('passes for complete packet', () => {
    expect(checkR2HandoffCompleteness(makePacket())).toBeUndefined()
  })

  it('blocks empty toAgent', () => {
    const packet = { ...makePacket(), toAgent: '' }
    const v = checkR2HandoffCompleteness(packet)
    expect(v).toBeDefined()
    expect(v!.ruleId).toBe('R2_HANDOFF_COMPLETENESS')
    expect(v!.message).toContain('toAgent')
  })

  it('blocks empty briefing', () => {
    const packet = { ...makePacket(), briefing: '' }
    const v = checkR2HandoffCompleteness(packet)
    expect(v).toBeDefined()
    expect(v!.message).toContain('briefing')
  })

  it('blocks empty acceptance criteria', () => {
    const packet = {
      ...makePacket(),
      expectedOutput: { type: 'code', artifacts: ['f.ts'], acceptanceCriteria: [] },
    }
    const v = checkR2HandoffCompleteness(packet)
    expect(v).toBeDefined()
    expect(v!.message).toContain('acceptanceCriteria')
  })

  it('blocks empty artifacts', () => {
    const packet = {
      ...makePacket(),
      expectedOutput: { type: 'code', artifacts: [], acceptanceCriteria: ['done'] },
    }
    const v = checkR2HandoffCompleteness(packet)
    expect(v).toBeDefined()
    expect(v!.message).toContain('artifacts')
  })
})

describe('R3 — Goal Ancestry', () => {
  it('passes for non-execute phases', () => {
    expect(checkR3GoalAncestry('specify', undefined)).toBeUndefined()
    expect(checkR3GoalAncestry('plan', undefined)).toBeUndefined()
    expect(checkR3GoalAncestry('verify', undefined)).toBeUndefined()
  })

  it('blocks execute phase without goal ancestry', () => {
    const v = checkR3GoalAncestry('execute', undefined)
    expect(v).toBeDefined()
    expect(v!.ruleId).toBe('R3_GOAL_ANCESTRY')
  })

  it('blocks execute phase with empty mission', () => {
    const v = checkR3GoalAncestry('execute', { ...GOAL, mission: '' })
    expect(v).toBeDefined()
    expect(v!.message).toContain('mission')
  })

  it('blocks execute phase with empty taskObjective', () => {
    const v = checkR3GoalAncestry('execute', { ...GOAL, taskObjective: '  ' })
    expect(v).toBeDefined()
    expect(v!.message).toContain('taskObjective')
  })

  it('passes for execute phase with full goal ancestry', () => {
    expect(checkR3GoalAncestry('execute', GOAL)).toBeUndefined()
  })
})

describe('R4 — Artifact Accountability', () => {
  it('passes with reason and causedBy', () => {
    expect(checkR4ArtifactAccountability('scope change', 'T-001')).toBeUndefined()
  })

  it('blocks empty reason', () => {
    const v = checkR4ArtifactAccountability('', 'T-001')
    expect(v).toBeDefined()
    expect(v!.ruleId).toBe('R4_ARTIFACT_ACCOUNTABILITY')
    expect(v!.message).toContain('reason')
  })

  it('blocks empty causedBy', () => {
    const v = checkR4ArtifactAccountability('reason', '')
    expect(v).toBeDefined()
    expect(v!.message).toContain('causedBy')
  })

  it('blocks both empty', () => {
    const v = checkR4ArtifactAccountability('', '')
    expect(v).toBeDefined()
    expect(v!.message).toContain('reason')
    expect(v!.message).toContain('causedBy')
  })
})

describe('R5 — Context Pollution', () => {
  it('passes for small state', () => {
    const content = Array(30).fill('line').join('\n')
    expect(checkR5ContextPollution(content, 'state')).toBeUndefined()
  })

  it('blocks bloated state', () => {
    const content = Array(MAX_STATE_LINES + 10).fill('line').join('\n')
    const v = checkR5ContextPollution(content, 'state')
    expect(v).toBeDefined()
    expect(v!.ruleId).toBe('R5_CONTEXT_POLLUTION')
    expect(v!.message).toContain('lines')
  })

  it('passes for small briefing', () => {
    expect(checkR5ContextPollution('short briefing', 'briefing')).toBeUndefined()
  })

  it('blocks oversized briefing', () => {
    const content = 'x'.repeat(MAX_BRIEFING_BYTES + 100)
    const v = checkR5ContextPollution(content, 'briefing')
    expect(v).toBeDefined()
    expect(v!.message).toContain('bytes')
  })
})

describe('R6 — No Self-Dispatch', () => {
  it('passes for different agents', () => {
    expect(checkR6NoSelfDispatch('orchestrator', 'developer')).toBeUndefined()
  })

  it('blocks self-dispatch', () => {
    const v = checkR6NoSelfDispatch('agent-1', 'agent-1')
    expect(v).toBeDefined()
    expect(v!.ruleId).toBe('R6_NO_SELF_DISPATCH')
    expect(v!.message).toContain('agent-1')
  })

  it('blocks self-dispatch with case differences (DES-008)', () => {
    const v = checkR6NoSelfDispatch('Orchestrator', 'orchestrator')
    expect(v).toBeDefined()
    expect(v!.ruleId).toBe('R6_NO_SELF_DISPATCH')
  })

  it('blocks self-dispatch with whitespace differences', () => {
    const v = checkR6NoSelfDispatch('agent-1 ', ' agent-1')
    expect(v).toBeDefined()
  })

  it('passes for empty agents (edge case)', () => {
    expect(checkR6NoSelfDispatch('', '')).toBeUndefined()
  })
})

describe('enforceOrchestrationRules', () => {
  beforeEach(() => resetHandoffCounter())

  it('passes when all rules are satisfied', () => {
    const result = enforceOrchestrationRules({
      fromRole: 'orchestrator',
      fromAgent: 'Taiichi',
      toAgent: 'developer-1',
      phase: 'specify',
      packet: makePacket(),
    })
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('collects multiple violations', () => {
    const packet = { ...makePacket(), toAgent: '', briefing: '' }
    const result = enforceOrchestrationRules({
      fromRole: 'developer', // R1: can't dispatch
      fromAgent: 'dev-1',
      toAgent: '',            // part of R2 + R6 won't trigger (empty)
      phase: 'execute',       // R3: no goal ancestry
      packet,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.length).toBeGreaterThanOrEqual(2)
    const ruleIds = result.violations.map(v => v.ruleId)
    expect(ruleIds).toContain('R1_ROLE_BOUNDARY')
    expect(ruleIds).toContain('R2_HANDOFF_COMPLETENESS')
  })

  it('detects self-dispatch', () => {
    const result = enforceOrchestrationRules({
      fromRole: 'orchestrator',
      fromAgent: 'Taiichi',
      toAgent: 'Taiichi',
      phase: 'specify',
      packet: { ...makePacket(), toAgent: 'Taiichi' },
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some(v => v.ruleId === 'R6_NO_SELF_DISPATCH')).toBe(true)
  })

  it('enforces R3 only in execute phase', () => {
    const result = enforceOrchestrationRules({
      fromRole: 'orchestrator',
      fromAgent: 'A',
      toAgent: 'B',
      phase: 'plan',
      packet: makePacket(),
      // No goalAncestry — should be fine in plan phase
    })
    expect(result.passed).toBe(true)
  })

  it('checks briefing size with R5', () => {
    const result = enforceOrchestrationRules({
      fromRole: 'orchestrator',
      fromAgent: 'A',
      toAgent: 'B',
      phase: 'specify',
      packet: makePacket(),
      briefingContent: 'x'.repeat(MAX_BRIEFING_BYTES + 100),
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some(v => v.ruleId === 'R5_CONTEXT_POLLUTION')).toBe(true)
  })
})

describe('formatRuleViolations', () => {
  it('formats violations with BLOCKED prefix', () => {
    const output = formatRuleViolations([
      { ruleId: 'R1_ROLE_BOUNDARY', message: 'Cannot dispatch', evidence: 'Agent' },
      { ruleId: 'R6_NO_SELF_DISPATCH', message: 'Self-dispatch', evidence: 'a→a' },
    ])
    expect(output).toContain('BLOCKED [R1_ROLE_BOUNDARY]')
    expect(output).toContain('BLOCKED [R6_NO_SELF_DISPATCH]')
  })

  it('returns empty string for no violations', () => {
    expect(formatRuleViolations([])).toBe('')
  })
})
