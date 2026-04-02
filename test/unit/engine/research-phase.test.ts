import { describe, it, expect } from 'vitest'
import {
  createResearchPhase,
  addUnknown,
  addFinding,
  getBlockingUnresolved,
  canProceedToPlan,
  completeResearch,
} from '../../../src/engine/research-phase.js'

describe('createResearchPhase', () => {
  it('creates empty research phase', () => {
    const phase = createResearchPhase()
    expect(phase.unknowns).toEqual([])
    expect(phase.findings).toEqual([])
    expect(phase.status).toBe('pending')
  })
})

describe('addUnknown', () => {
  it('adds unknown with generated id', () => {
    const phase = addUnknown(createResearchPhase(), 'How does auth work?', 'spec.md', 'blocking')
    expect(phase.unknowns).toHaveLength(1)
    expect(phase.unknowns[0]!.id).toMatch(/^UNK-/)
    expect(phase.unknowns[0]!.status).toBe('unresolved')
    expect(phase.unknowns[0]!.priority).toBe('blocking')
  })

  it('accumulates multiple unknowns', () => {
    let phase = createResearchPhase()
    phase = addUnknown(phase, 'Q1', 'src', 'blocking')
    phase = addUnknown(phase, 'Q2', 'src', 'informational')
    expect(phase.unknowns).toHaveLength(2)
  })
})

describe('addFinding', () => {
  it('adds finding and auto-resolves the unknown', () => {
    let phase = addUnknown(createResearchPhase(), 'How does X work?', 'spec', 'blocking')
    const unknownId = phase.unknowns[0]!.id
    phase = addFinding(phase, unknownId, 'X uses OAuth2', ['docs.example.com'], 'Use OAuth2 client', 'high')
    expect(phase.findings).toHaveLength(1)
    expect(phase.unknowns[0]!.status).toBe('resolved')
  })
})

describe('getBlockingUnresolved', () => {
  it('returns only blocking unresolved unknowns', () => {
    let phase = createResearchPhase()
    phase = addUnknown(phase, 'Blocking Q', 'spec', 'blocking')
    phase = addUnknown(phase, 'Info Q', 'spec', 'informational')
    const blocking = getBlockingUnresolved(phase)
    expect(blocking).toHaveLength(1)
    expect(blocking[0]!.priority).toBe('blocking')
  })
})

describe('canProceedToPlan', () => {
  it('blocks when blocking unknowns remain unresolved', () => {
    const phase = addUnknown(createResearchPhase(), 'Critical Q', 'spec', 'blocking')
    const result = canProceedToPlan(phase)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RESEARCH_BLOCKING_UNRESOLVED')
  })

  it('allows when all blocking unknowns resolved', () => {
    let phase = addUnknown(createResearchPhase(), 'Q', 'spec', 'blocking')
    const id = phase.unknowns[0]!.id
    phase = addFinding(phase, id, 'Answer', ['src'], 'Recommendation', 'high')
    const result = canProceedToPlan(phase)
    expect(result.ok).toBe(true)
  })

  it('allows when only informational unknowns remain', () => {
    const phase = addUnknown(createResearchPhase(), 'Info only', 'spec', 'informational')
    const result = canProceedToPlan(phase)
    expect(result.ok).toBe(true)
  })
})

describe('completeResearch', () => {
  it('sets status to complete', () => {
    const phase = completeResearch(createResearchPhase())
    expect(phase.status).toBe('complete')
  })
})
