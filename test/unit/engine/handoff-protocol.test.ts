import { describe, it, expect, beforeEach } from 'vitest'
import {
  createHandoffPacket,
  validateHandoffPacket,
  requireValidHandoff,
  formatHandoffBriefing,
  resetHandoffCounter,
} from '../../../src/engine/handoff-protocol.js'
import type { HandoffPacket, GoalAncestry } from '../../../src/contracts/task.js'

const GOAL: GoalAncestry = {
  mission: 'Build the best CLI',
  projectGoal: 'Ship v1.0',
  phaseGoal: 'Core pipeline',
  taskObjective: 'Implement handoff protocol',
}

const validOpts = {
  briefing: 'Implement the handoff validation logic',
  goalAncestry: GOAL,
  expectedOutput: {
    type: 'code',
    artifacts: ['src/engine/handoff-protocol.ts'],
    acceptanceCriteria: ['All validation checks pass', 'No missing fields'],
  },
  contextFiles: ['src/contracts/task.ts'],
  priorDecisions: ['Use Result<T> pattern'],
  constraints: ['Budget: $0.50'],
}

describe('createHandoffPacket', () => {
  beforeEach(() => resetHandoffCounter())

  it('creates a packet with auto-generated ID', () => {
    const packet = createHandoffPacket('orchestrator', 'developer', 'T-001', validOpts)
    expect(packet.id).toBe('HOF-001')
    expect(packet.fromAgent).toBe('orchestrator')
    expect(packet.toAgent).toBe('developer')
    expect(packet.taskId).toBe('T-001')
    expect(packet.briefing).toBe(validOpts.briefing)
    expect(packet.goalAncestry).toEqual(GOAL)
    expect(packet.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('increments ID on each call', () => {
    const p1 = createHandoffPacket('a', 'b', 'T-1', validOpts)
    const p2 = createHandoffPacket('a', 'b', 'T-2', validOpts)
    expect(p1.id).toBe('HOF-001')
    expect(p2.id).toBe('HOF-002')
  })

  it('defaults contextFiles and priorDecisions to empty arrays', () => {
    const packet = createHandoffPacket('a', 'b', 'T-1', {
      briefing: 'test',
      expectedOutput: { type: 'code', artifacts: ['f.ts'], acceptanceCriteria: ['done'] },
    })
    expect(packet.contextFiles).toEqual([])
    expect(packet.priorDecisions).toEqual([])
    expect(packet.constraints).toEqual([])
  })
})

describe('validateHandoffPacket', () => {
  beforeEach(() => resetHandoffCounter())

  it('validates a complete packet', () => {
    const packet = createHandoffPacket('orchestrator', 'developer', 'T-001', validOpts)
    const result = validateHandoffPacket(packet)
    expect(result.valid).toBe(true)
    expect(result.missingFields).toEqual([])
  })

  it('flags missing toAgent', () => {
    const packet = createHandoffPacket('orchestrator', '', 'T-001', validOpts)
    const result = validateHandoffPacket(packet)
    expect(result.valid).toBe(false)
    expect(result.missingFields).toContain('toAgent')
  })

  it('flags missing briefing', () => {
    const packet = createHandoffPacket('orchestrator', 'developer', 'T-001', {
      ...validOpts,
      briefing: '',
    })
    const result = validateHandoffPacket(packet)
    expect(result.valid).toBe(false)
    expect(result.missingFields).toContain('briefing')
  })

  it('flags missing acceptance criteria', () => {
    const packet = createHandoffPacket('orchestrator', 'developer', 'T-001', {
      ...validOpts,
      expectedOutput: { type: 'code', artifacts: ['f.ts'], acceptanceCriteria: [] },
    })
    const result = validateHandoffPacket(packet)
    expect(result.valid).toBe(false)
    expect(result.missingFields).toContain('expectedOutput.acceptanceCriteria')
  })

  it('warns when fromAgent is empty', () => {
    const packet = createHandoffPacket('', 'developer', 'T-001', validOpts)
    const result = validateHandoffPacket(packet)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('fromAgent')
  })

  it('warns when no context files', () => {
    const packet = createHandoffPacket('orchestrator', 'developer', 'T-001', {
      ...validOpts,
      contextFiles: [],
    })
    const result = validateHandoffPacket(packet)
    expect(result.warnings).toContainEqual(expect.stringContaining('context files'))
  })
})

describe('requireValidHandoff', () => {
  beforeEach(() => resetHandoffCounter())

  it('returns ok for valid packet', () => {
    const packet = createHandoffPacket('orchestrator', 'developer', 'T-001', validOpts)
    const result = requireValidHandoff(packet)
    expect(result.ok).toBe(true)
  })

  it('returns HANDOFF_NO_TARGET_AGENT for empty toAgent', () => {
    const packet = createHandoffPacket('orchestrator', '', 'T-001', validOpts)
    const result = requireValidHandoff(packet)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('HANDOFF_NO_TARGET_AGENT')
  })

  it('returns HANDOFF_MISSING_ACCEPTANCE_CRITERIA when ACs empty', () => {
    const packet = createHandoffPacket('orchestrator', 'developer', 'T-001', {
      ...validOpts,
      expectedOutput: { type: 'code', artifacts: ['f.ts'], acceptanceCriteria: [] },
    })
    const result = requireValidHandoff(packet)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('HANDOFF_MISSING_ACCEPTANCE_CRITERIA')
  })
})

describe('formatHandoffBriefing', () => {
  beforeEach(() => resetHandoffCounter())

  it('includes all sections in the briefing', () => {
    const packet = createHandoffPacket('orchestrator', 'developer', 'T-001', validOpts)
    const briefing = formatHandoffBriefing(packet)

    expect(briefing).toContain('Handoff Briefing [HOF-001]')
    expect(briefing).toContain('orchestrator')
    expect(briefing).toContain('developer')
    expect(briefing).toContain('Goal Chain')
    expect(briefing).toContain(GOAL.mission)
    expect(briefing).toContain('Acceptance Criteria')
    expect(briefing).toContain('Read these files')
    expect(briefing).toContain('Prior Decisions')
    expect(briefing).toContain('Constraints')
  })

  it('omits goal chain when not provided', () => {
    const packet = createHandoffPacket('a', 'b', 'T-1', {
      briefing: 'test',
      expectedOutput: { type: 'code', artifacts: ['f.ts'], acceptanceCriteria: ['done'] },
    })
    const briefing = formatHandoffBriefing(packet)
    expect(briefing).not.toContain('Goal Chain')
  })
})
