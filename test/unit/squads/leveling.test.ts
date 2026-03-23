import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultLevelForTier,
  getAgentLevel,
  requiresWriteConfirmation,
  scanAgentSuggestions,
  readApprovalStore,
} from '../../../src/squads/leveling.js'
import type { AgentApprovalStore } from '../../../src/squads/leveling.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string | undefined

async function createTmp(): Promise<string> {
  tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-leveling-test-'))
  return tmpDir
}

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true })
    tmpDir = undefined
  }
})

const NOW = 1_700_000_000_000 // fixed epoch for deterministic tests
const DAY_MS = 24 * 60 * 60 * 1000

function buildStore(overrides: Partial<AgentApprovalStore> = {}): AgentApprovalStore {
  return { records: [], levels: [], ...overrides }
}

// ---------------------------------------------------------------------------
// 5.1 defaultLevelForTier — T3 returns L1
// ---------------------------------------------------------------------------

describe('defaultLevelForTier', () => {
  it('returns L1 for T3 (Observer / Support)', () => {
    expect(defaultLevelForTier('T3')).toBe('L1')
  })

  // 5.2 T1, T2, T4 all return L2
  it('returns L2 for T1 (Chief)', () => {
    expect(defaultLevelForTier('T1')).toBe('L2')
  })

  it('returns L2 for T2 (Specialist)', () => {
    expect(defaultLevelForTier('T2')).toBe('L2')
  })

  it('returns L2 for T4 (Reviewer)', () => {
    expect(defaultLevelForTier('T4')).toBe('L2')
  })
})

// ---------------------------------------------------------------------------
// 5.3 Re-exported getAgentLevel + requiresWriteConfirmation via leveling module
// ---------------------------------------------------------------------------

describe('getAgentLevel (re-export via leveling)', () => {
  it('returns default L2 when agent not in store', () => {
    const store = buildStore()
    expect(getAgentLevel('my-squad/pm', store)).toBe('L2')
  })

  it('returns stored level when agent is present', () => {
    const store = buildStore({
      levels: [{ agentId: 'my-squad/support', level: 'L1', updatedAt: NOW }],
    })
    expect(getAgentLevel('my-squad/support', store)).toBe('L1')
  })

  it('respects explicit defaultLevel override', () => {
    const store = buildStore()
    expect(getAgentLevel('unknown-agent', store, 'L3')).toBe('L3')
  })
})

describe('requiresWriteConfirmation (re-export via leveling)', () => {
  it('returns true for L1', () => {
    expect(requiresWriteConfirmation('L1')).toBe(true)
  })

  it('returns false for L2', () => {
    expect(requiresWriteConfirmation('L2')).toBe(false)
  })

  it('returns false for L3', () => {
    expect(requiresWriteConfirmation('L3')).toBe(false)
  })

  it('returns false for L4', () => {
    expect(requiresWriteConfirmation('L4')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5.4 Re-exported scanAgentSuggestions returns promotion/demotion suggestions
// ---------------------------------------------------------------------------

describe('scanAgentSuggestions (re-export via leveling)', () => {
  it('returns empty array when store has no records', () => {
    const store = buildStore()
    expect(scanAgentSuggestions(store, NOW)).toEqual([])
  })

  it('suggests promotion when agent has >85% approval with ≥5 records in 7-day window', () => {
    // 6 approvals out of 6 = 100% approval rate
    const records = Array.from({ length: 6 }, (_, i) => ({
      agentId: 'my-squad/pm',
      timestamp: NOW - i * DAY_MS, // within 7-day window
      approved: true,
    }))
    const store = buildStore({ records })
    const suggestions = scanAgentSuggestions(store, NOW)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].direction).toBe('promotion')
    expect(suggestions[0].agentId).toBe('my-squad/pm')
    expect(suggestions[0].currentLevel).toBe('L2')
    expect(suggestions[0].suggestedLevel).toBe('L3')
  })

  it('suggests demotion when agent has >30% rejection in 7-day window', () => {
    // 4 rejections + 2 approvals = 66.7% rejection rate — well above 30%
    const records = [
      ...Array.from({ length: 4 }, (_, i) => ({
        agentId: 'my-squad/pm',
        timestamp: NOW - i * DAY_MS,
        approved: false,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        agentId: 'my-squad/pm',
        timestamp: NOW - (i + 4) * DAY_MS,
        approved: true,
      })),
    ]
    const store = buildStore({
      records,
      levels: [{ agentId: 'my-squad/pm', level: 'L3', updatedAt: NOW - 10 * DAY_MS }],
    })
    const suggestions = scanAgentSuggestions(store, NOW)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].direction).toBe('demotion')
    expect(suggestions[0].agentId).toBe('my-squad/pm')
    expect(suggestions[0].currentLevel).toBe('L3')
    expect(suggestions[0].suggestedLevel).toBe('L2')
  })
})

// ---------------------------------------------------------------------------
// 5.5 Re-exported readApprovalStore returns empty store when file absent
// ---------------------------------------------------------------------------

describe('readApprovalStore (re-export via leveling)', () => {
  it('returns empty store when .buildpact/agent-levels.json does not exist', async () => {
    const dir = await createTmp()
    const store = await readApprovalStore(dir)
    expect(store).toEqual({ records: [], levels: [] })
  })

  it('returns empty store for a directory with no .buildpact folder', async () => {
    const dir = await createTmp()
    const store = await readApprovalStore(dir)
    expect(store.records).toEqual([])
    expect(store.levels).toEqual([])
  })
})
