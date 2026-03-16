import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  inferAgentTier,
  formatRoleName,
  formatAgentIndex,
  createAgentSession,
  getLoadedAgentIds,
  releaseAgent,
  formatLoadedAgentForContext,
  buildAgentIndex,
  loadChiefAgent,
  loadSpecialistAgent,
  loadAndRegisterAgent,
  listAvailableAgents,
  MAX_INDEX_BYTES,
} from '../../../src/engine/lazy-agent-loader.js'
import type { AgentIndex, LoadedAgent } from '../../../src/engine/lazy-agent-loader.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string | undefined

async function createTmp(): Promise<string> {
  tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-lazy-loader-test-'))
  return tmpDir
}

async function createSquadDir(dir: string, overrides: { yaml?: string; agentFiles?: Record<string, string> } = {}): Promise<string> {
  const agentsDir = join(dir, 'agents')
  await mkdir(agentsDir, { recursive: true })

  const yaml = overrides.yaml ?? [
    'name: test-squad',
    'version: "0.1.0"',
    'domain: software',
    'description: "Test Squad"',
    'initial_level: L2',
    '',
    'agents:',
    '  chief:',
    '    file: agents/chief.md',
    '  specialist:',
    '    file: agents/specialist.md',
    '  support:',
    '    file: agents/support.md',
    '  reviewer:',
    '    file: agents/reviewer.md',
  ].join('\n') + '\n'

  await writeFile(join(dir, 'squad.yaml'), yaml, 'utf-8')

  const defaultFiles: Record<string, string> = {
    'chief.md': '# Chief Agent\n\n## Role\nOrchestrates the Squad workflow.',
    'specialist.md': '# Specialist Agent\n\n## Role\nCore domain expert.',
    'support.md': '# Support Agent\n\n## Role\nAssists specialists.',
    'reviewer.md': '# Reviewer Agent\n\n## Role\nValidates output quality.',
  }

  const agentFiles = { ...defaultFiles, ...overrides.agentFiles }
  for (const [name, content] of Object.entries(agentFiles)) {
    await writeFile(join(agentsDir, name), content, 'utf-8')
  }

  return dir
}

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true })
    tmpDir = undefined
  }
})

const NOW = 1_700_000_000_000

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('inferAgentTier', () => {
  it('maps chief → T1', () => {
    expect(inferAgentTier('chief')).toBe('T1')
  })

  it('maps specialist → T2', () => {
    expect(inferAgentTier('specialist')).toBe('T2')
  })

  it('maps support → T3', () => {
    expect(inferAgentTier('support')).toBe('T3')
  })

  it('maps reviewer → T4', () => {
    expect(inferAgentTier('reviewer')).toBe('T4')
  })

  it('returns T? for unknown roles', () => {
    expect(inferAgentTier('analyst')).toBe('T?')
  })

  it('is case-insensitive', () => {
    expect(inferAgentTier('CHIEF')).toBe('T1')
  })
})

describe('formatRoleName', () => {
  it('capitalizes first letter', () => {
    expect(formatRoleName('chief')).toBe('Chief')
  })

  it('lowercases rest', () => {
    expect(formatRoleName('SPECIALIST')).toBe('Specialist')
  })

  it('returns empty string for empty input', () => {
    expect(formatRoleName('')).toBe('')
  })
})

describe('formatAgentIndex', () => {
  it('includes squad name and domain', () => {
    const index: AgentIndex = {
      squadName: 'test-squad',
      domain: 'software',
      chiefFile: 'agents/chief.md',
      agents: [{ id: 'chief', tier: 'T1', role: 'Chief', file: 'agents/chief.md' }],
    }
    const text = formatAgentIndex(index)
    expect(text).toContain('test-squad')
    expect(text).toContain('software')
  })

  it('lists each agent with tier and file', () => {
    const index: AgentIndex = {
      squadName: 'my-squad',
      domain: 'custom',
      chiefFile: 'agents/chief.md',
      agents: [
        { id: 'chief', tier: 'T1', role: 'Chief', file: 'agents/chief.md' },
        { id: 'specialist', tier: 'T2', role: 'Specialist', file: 'agents/specialist.md' },
      ],
    }
    const text = formatAgentIndex(index)
    expect(text).toContain('T1')
    expect(text).toContain('T2')
    expect(text).toContain('agents/chief.md')
    expect(text).toContain('agents/specialist.md')
  })

  it('produces output within MAX_INDEX_BYTES', () => {
    const agents = Array.from({ length: 10 }, (_, i) => ({
      id: `agent-${i}`,
      tier: 'T2',
      role: `Agent${i}`,
      file: `agents/agent-${i}.md`,
    }))
    const index: AgentIndex = { squadName: 'big-squad', domain: 'custom', chiefFile: 'agents/chief.md', agents }
    const text = formatAgentIndex(index)
    expect(Buffer.byteLength(text, 'utf-8')).toBeLessThanOrEqual(MAX_INDEX_BYTES)
  })
})

// ---------------------------------------------------------------------------
// Session management (pure)
// ---------------------------------------------------------------------------

describe('createAgentSession', () => {
  it('creates session with empty loadedAgents map', () => {
    const index: AgentIndex = { squadName: 'sq', domain: 'd', chiefFile: 'agents/chief.md', agents: [] }
    const session = createAgentSession(index)
    expect(session.loadedAgents.size).toBe(0)
    expect(session.index).toBe(index)
  })
})

describe('getLoadedAgentIds', () => {
  it('returns empty array for empty session', () => {
    const index: AgentIndex = { squadName: 'sq', domain: 'd', chiefFile: 'agents/chief.md', agents: [] }
    const session = createAgentSession(index)
    expect(getLoadedAgentIds(session)).toEqual([])
  })

  it('returns ids of all loaded agents', () => {
    const index: AgentIndex = { squadName: 'sq', domain: 'd', chiefFile: 'agents/chief.md', agents: [] }
    const session = createAgentSession(index)
    const agent: LoadedAgent = { id: 'specialist', content: '# S', loadedAt: NOW }
    session.loadedAgents.set('specialist', agent)
    expect(getLoadedAgentIds(session)).toContain('specialist')
  })
})

describe('releaseAgent', () => {
  it('removes agent from session', () => {
    const index: AgentIndex = { squadName: 'sq', domain: 'd', chiefFile: 'agents/chief.md', agents: [] }
    const session = createAgentSession(index)
    session.loadedAgents.set('specialist', { id: 'specialist', content: '# S', loadedAt: NOW })
    releaseAgent(session, 'specialist')
    expect(session.loadedAgents.has('specialist')).toBe(false)
  })

  it('is a no-op for an agent not in session', () => {
    const index: AgentIndex = { squadName: 'sq', domain: 'd', chiefFile: 'agents/chief.md', agents: [] }
    const session = createAgentSession(index)
    expect(() => releaseAgent(session, 'nonexistent')).not.toThrow()
    expect(session.loadedAgents.size).toBe(0)
  })
})

describe('formatLoadedAgentForContext', () => {
  it('includes agent id and ISO timestamp in comment', () => {
    const agent: LoadedAgent = { id: 'specialist', content: '# Spec', loadedAt: NOW }
    const text = formatLoadedAgentForContext(agent)
    expect(text).toContain('agent:specialist')
    expect(text).toContain(new Date(NOW).toISOString())
  })

  it('includes agent content after header comment', () => {
    const agent: LoadedAgent = { id: 'chief', content: '## Role\nOrchestrates.', loadedAt: NOW }
    const text = formatLoadedAgentForContext(agent)
    expect(text).toContain('## Role\nOrchestrates.')
  })
})

// ---------------------------------------------------------------------------
// I/O: buildAgentIndex
// ---------------------------------------------------------------------------

describe('buildAgentIndex', () => {
  it('parses squad.yaml and returns correct index', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const result = await buildAgentIndex(dir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.squadName).toBe('test-squad')
    expect(result.value.domain).toBe('software')
    expect(result.value.agents).toHaveLength(4)
  })

  it('sets chiefFile to agents/chief.md', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const result = await buildAgentIndex(dir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.chiefFile).toBe('agents/chief.md')
  })

  it('infers tiers from standard role names', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const result = await buildAgentIndex(dir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const chief = result.value.agents.find(a => a.id === 'chief')
    const specialist = result.value.agents.find(a => a.id === 'specialist')
    expect(chief?.tier).toBe('T1')
    expect(specialist?.tier).toBe('T2')
  })

  it('returns error when squad.yaml is missing', async () => {
    const dir = await createTmp()
    await mkdir(join(dir, 'agents'), { recursive: true })
    // No squad.yaml written
    const result = await buildAgentIndex(dir)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AGENT_LOAD_FAILED')
  })

  it('uses basename as squadName fallback when name field missing', async () => {
    const dir = await createTmp()
    const yaml = 'domain: software\nagents:\n  chief:\n    file: agents/chief.md\n'
    await createSquadDir(dir, { yaml })
    const result = await buildAgentIndex(dir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // basename of tmpDir used as fallback
    expect(result.value.squadName.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// I/O: loadChiefAgent
// ---------------------------------------------------------------------------

describe('loadChiefAgent', () => {
  it('loads chief agent content', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const indexResult = await buildAgentIndex(dir)
    expect(indexResult.ok).toBe(true)
    if (!indexResult.ok) return

    const result = await loadChiefAgent(dir, indexResult.value, NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).toBe('chief')
    expect(result.value.content).toContain('Chief Agent')
    expect(result.value.loadedAt).toBe(NOW)
  })

  it('returns error when chief file is missing', async () => {
    const dir = await createTmp()
    await createSquadDir(dir, { agentFiles: {} })
    // Remove chief.md by not providing it and using empty agentFiles
    // Manually delete chief.md after creation
    await rm(join(dir, 'agents', 'chief.md'), { force: true })
    const indexResult = await buildAgentIndex(dir)
    expect(indexResult.ok).toBe(true)
    if (!indexResult.ok) return

    const result = await loadChiefAgent(dir, indexResult.value, NOW)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AGENT_LOAD_FAILED')
  })
})

// ---------------------------------------------------------------------------
// I/O: loadSpecialistAgent
// ---------------------------------------------------------------------------

describe('loadSpecialistAgent', () => {
  it('loads specialist agent on-demand', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const indexResult = await buildAgentIndex(dir)
    expect(indexResult.ok).toBe(true)
    if (!indexResult.ok) return

    const result = await loadSpecialistAgent(dir, indexResult.value, 'specialist', NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).toBe('specialist')
    expect(result.value.content).toContain('Specialist Agent')
    expect(result.value.loadedAt).toBe(NOW)
  })

  it('returns error when agentId not in index', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const indexResult = await buildAgentIndex(dir)
    expect(indexResult.ok).toBe(true)
    if (!indexResult.ok) return

    const result = await loadSpecialistAgent(dir, indexResult.value, 'nonexistent', NOW)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AGENT_LOAD_FAILED')
    expect(result.error.i18nKey).toBe('error.agent.not_in_index')
  })

  it('returns error when agent file is missing from disk', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    await rm(join(dir, 'agents', 'specialist.md'), { force: true })
    const indexResult = await buildAgentIndex(dir)
    expect(indexResult.ok).toBe(true)
    if (!indexResult.ok) return

    const result = await loadSpecialistAgent(dir, indexResult.value, 'specialist', NOW)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AGENT_LOAD_FAILED')
  })
})

// ---------------------------------------------------------------------------
// I/O: loadAndRegisterAgent
// ---------------------------------------------------------------------------

describe('loadAndRegisterAgent', () => {
  it('loads agent and adds it to session', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const indexResult = await buildAgentIndex(dir)
    expect(indexResult.ok).toBe(true)
    if (!indexResult.ok) return

    const session = createAgentSession(indexResult.value)
    const result = await loadAndRegisterAgent(dir, session, 'specialist', NOW)
    expect(result.ok).toBe(true)
    expect(session.loadedAgents.has('specialist')).toBe(true)
  })

  it('propagates error when agent not found', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const indexResult = await buildAgentIndex(dir)
    expect(indexResult.ok).toBe(true)
    if (!indexResult.ok) return

    const session = createAgentSession(indexResult.value)
    const result = await loadAndRegisterAgent(dir, session, 'ghost', NOW)
    expect(result.ok).toBe(false)
    expect(session.loadedAgents.has('ghost')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// I/O: listAvailableAgents
// ---------------------------------------------------------------------------

describe('listAvailableAgents', () => {
  it('returns sorted list of .md files in agents/', async () => {
    const dir = await createTmp()
    await createSquadDir(dir)
    const result = await listAvailableAgents(dir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual(['chief.md', 'reviewer.md', 'specialist.md', 'support.md'])
  })

  it('returns error when agents/ directory is missing', async () => {
    const dir = await createTmp()
    // No agents dir
    const result = await listAvailableAgents(dir)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('AGENT_LOAD_FAILED')
  })
})
