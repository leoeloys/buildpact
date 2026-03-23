import { describe, it, expect, vi } from 'vitest'

// Mock subagent to capture payloads without side effects
vi.mock('../../../src/engine/subagent.js', () => ({
  buildTaskPayload: vi.fn(),
}))

describe('researchTechStack', () => {
  it('returns tech-stack domain with findings', async () => {
    const { researchTechStack } = await import('../../../src/commands/plan/researcher.js')
    const result = await researchTechStack('# Add dark mode\n\nUser wants dark mode toggle')

    expect(result.domain).toBe('tech-stack')
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings[0]).toContain('Add dark mode')
    expect(result.relevantPatterns).toContain('TypeScript')
  })

  it('handles empty spec gracefully', async () => {
    const { researchTechStack } = await import('../../../src/commands/plan/researcher.js')
    const result = await researchTechStack('')

    expect(result.domain).toBe('tech-stack')
    expect(result.findings[0]).toContain('Unknown feature')
  })

  it('builds isolated task payload via subagent', async () => {
    const { buildTaskPayload } = await import('../../../src/engine/subagent.js')
    const { researchTechStack } = await import('../../../src/commands/plan/researcher.js')

    await researchTechStack('some spec content')

    expect(buildTaskPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'plan',
        content: expect.stringContaining('tech-stack'),
      }),
    )
  })
})

describe('researchCodebase', () => {
  it('returns codebase domain with architecture findings', async () => {
    const { researchCodebase } = await import('../../../src/commands/plan/researcher.js')
    const result = await researchCodebase('# New API endpoint')

    expect(result.domain).toBe('codebase')
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.relevantPatterns).toContain('Result')
    expect(result.relevantPatterns).toContain('AuditLogger')
  })

  it('includes layer structure in findings', async () => {
    const { researchCodebase } = await import('../../../src/commands/plan/researcher.js')
    const result = await researchCodebase('anything')

    const layerFinding = result.findings.find(f => f.includes('contracts'))
    expect(layerFinding).toBeDefined()
  })
})

describe('researchSquadConstraints', () => {
  it('returns squad-constraints domain', async () => {
    const { researchSquadConstraints } = await import('../../../src/commands/plan/researcher.js')
    const result = await researchSquadConstraints('# Spec', 'Squad: software\nRoles: PM, Dev')

    expect(result.domain).toBe('squad-constraints')
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings.some(f => f.includes('Squad context'))).toBe(true)
  })

  it('handles empty squad context', async () => {
    const { researchSquadConstraints } = await import('../../../src/commands/plan/researcher.js')
    const result = await researchSquadConstraints('# Spec', '')

    expect(result.domain).toBe('squad-constraints')
    expect(result.findings.some(f => f.includes('No active squad'))).toBe(true)
  })

  it('passes squad context conditionally to payload', async () => {
    const { buildTaskPayload } = await import('../../../src/engine/subagent.js')
    const { researchSquadConstraints } = await import('../../../src/commands/plan/researcher.js')

    // With context
    await researchSquadConstraints('spec', 'squad context here')
    expect(buildTaskPayload).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'squad context here' }),
    )

    vi.mocked(buildTaskPayload).mockClear()

    // Without context — should NOT include context key
    await researchSquadConstraints('spec', '')
    expect(buildTaskPayload).toHaveBeenCalledWith(
      expect.not.objectContaining({ context: expect.anything() }),
    )
  })
})

describe('consolidateResearch', () => {
  it('consolidates all 3 domains into summary', async () => {
    const { consolidateResearch } = await import('../../../src/commands/plan/researcher.js')

    const results = [
      { domain: 'tech-stack' as const, findings: ['TypeScript'], relevantPatterns: ['TS'] },
      { domain: 'codebase' as const, findings: ['Layered'], relevantPatterns: ['contracts'] },
      { domain: 'squad-constraints' as const, findings: ['No squad'], relevantPatterns: [] },
    ]

    const summary = consolidateResearch(results, 'my-feature')

    expect(summary.specSlug).toBe('my-feature')
    expect(summary.timestamp).toBeTruthy()
    expect(summary.techStack.domain).toBe('tech-stack')
    expect(summary.codebase.domain).toBe('codebase')
    expect(summary.squadConstraints.domain).toBe('squad-constraints')
  })

  it('fills missing domains with empty defaults', async () => {
    const { consolidateResearch } = await import('../../../src/commands/plan/researcher.js')

    const results = [
      { domain: 'tech-stack' as const, findings: ['found'], relevantPatterns: [] },
    ]

    const summary = consolidateResearch(results)

    expect(summary.techStack.findings).toEqual(['found'])
    expect(summary.codebase.findings).toEqual([])
    expect(summary.squadConstraints.findings).toEqual([])
  })

  it('defaults specSlug to empty string', async () => {
    const { consolidateResearch } = await import('../../../src/commands/plan/researcher.js')
    const summary = consolidateResearch([])
    expect(summary.specSlug).toBe('')
  })
})

describe('spawnResearchAgents', () => {
  it('runs all 3 research agents in parallel and returns summary', async () => {
    const { spawnResearchAgents } = await import('../../../src/commands/plan/researcher.js')
    const summary = await spawnResearchAgents('# My spec', 'squad context', 'my-slug')

    expect(summary.specSlug).toBe('my-slug')
    expect(summary.techStack.domain).toBe('tech-stack')
    expect(summary.codebase.domain).toBe('codebase')
    expect(summary.squadConstraints.domain).toBe('squad-constraints')
    expect(summary.techStack.findings.length).toBeGreaterThan(0)
    expect(summary.codebase.findings.length).toBeGreaterThan(0)
    expect(summary.squadConstraints.findings.length).toBeGreaterThan(0)
  })

  it('works with empty squad context', async () => {
    const { spawnResearchAgents } = await import('../../../src/commands/plan/researcher.js')
    const summary = await spawnResearchAgents('# Spec', '')

    expect(summary.squadConstraints.findings.some(f => f.includes('No active squad'))).toBe(true)
  })
})
