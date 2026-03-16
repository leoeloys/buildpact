import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  nextLevel,
  prevLevel,
  filterToWindow,
  calculateApprovalRate,
  calculateRejectionRate,
  getAgentLevel,
  setAgentLevel,
  requiresWriteConfirmation,
  checkPromotion,
  checkDemotion,
  scanAgentSuggestions,
  readApprovalStore,
  writeApprovalStore,
  recordApproval,
  applyLevelChange,
  PROMOTION_APPROVAL_THRESHOLD,
  DEMOTION_REJECTION_THRESHOLD,
  LEVEL_WINDOW_DAYS,
  MIN_RECORDS_FOR_PROMOTION,
} from '../../../src/engine/autonomy-manager.js'
import type { AgentApprovalStore } from '../../../src/engine/autonomy-manager.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string | undefined

async function createTmp(): Promise<string> {
  tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-autonomy-test-'))
  await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
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
// nextLevel / prevLevel
// ---------------------------------------------------------------------------

describe('nextLevel', () => {
  it('L1 -> L2', () => expect(nextLevel('L1')).toBe('L2'))
  it('L2 -> L3', () => expect(nextLevel('L2')).toBe('L3'))
  it('L3 -> L4', () => expect(nextLevel('L3')).toBe('L4'))
  it('L4 returns undefined (already max)', () => expect(nextLevel('L4')).toBeUndefined())
})

describe('prevLevel', () => {
  it('L4 -> L3', () => expect(prevLevel('L4')).toBe('L3'))
  it('L3 -> L2', () => expect(prevLevel('L3')).toBe('L2'))
  it('L2 -> L1', () => expect(prevLevel('L2')).toBe('L1'))
  it('L1 returns undefined (already min)', () => expect(prevLevel('L1')).toBeUndefined())
})

// ---------------------------------------------------------------------------
// filterToWindow
// ---------------------------------------------------------------------------

describe('filterToWindow', () => {
  it('returns only records within the window for the given agent', () => {
    const records = [
      { agentId: 'a', timestamp: NOW - 5 * DAY_MS, approved: true },
      { agentId: 'a', timestamp: NOW - 8 * DAY_MS, approved: true }, // outside 7-day window
      { agentId: 'b', timestamp: NOW - 1 * DAY_MS, approved: false }, // different agent
    ]
    const result = filterToWindow(records, 'a', LEVEL_WINDOW_DAYS, NOW)
    expect(result).toHaveLength(1)
    expect(result[0]?.timestamp).toBe(NOW - 5 * DAY_MS)
  })

  it('returns empty array when no records match', () => {
    const result = filterToWindow([], 'a', LEVEL_WINDOW_DAYS, NOW)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// calculateApprovalRate
// ---------------------------------------------------------------------------

describe('calculateApprovalRate', () => {
  it('returns 0 for empty records', () => {
    expect(calculateApprovalRate([], 'a', LEVEL_WINDOW_DAYS, NOW)).toBe(0)
  })

  it('returns 1.0 when all records in window are approvals', () => {
    const records = [
      { agentId: 'a', timestamp: NOW - 1 * DAY_MS, approved: true },
      { agentId: 'a', timestamp: NOW - 2 * DAY_MS, approved: true },
    ]
    expect(calculateApprovalRate(records, 'a', LEVEL_WINDOW_DAYS, NOW)).toBe(1)
  })

  it('returns correct fraction for mixed records', () => {
    const records = [
      { agentId: 'a', timestamp: NOW - 1 * DAY_MS, approved: true },
      { agentId: 'a', timestamp: NOW - 2 * DAY_MS, approved: true },
      { agentId: 'a', timestamp: NOW - 3 * DAY_MS, approved: false },
      { agentId: 'a', timestamp: NOW - 4 * DAY_MS, approved: false },
    ]
    expect(calculateApprovalRate(records, 'a', LEVEL_WINDOW_DAYS, NOW)).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// calculateRejectionRate
// ---------------------------------------------------------------------------

describe('calculateRejectionRate', () => {
  it('returns 0 for empty records', () => {
    expect(calculateRejectionRate([], 'a', LEVEL_WINDOW_DAYS, NOW)).toBe(0)
  })

  it('returns correct rejection rate', () => {
    const records = [
      { agentId: 'a', timestamp: NOW - 1 * DAY_MS, approved: false },
      { agentId: 'a', timestamp: NOW - 2 * DAY_MS, approved: true },
      { agentId: 'a', timestamp: NOW - 3 * DAY_MS, approved: true },
      { agentId: 'a', timestamp: NOW - 4 * DAY_MS, approved: true },
    ]
    expect(calculateRejectionRate(records, 'a', LEVEL_WINDOW_DAYS, NOW)).toBe(0.25)
  })
})

// ---------------------------------------------------------------------------
// getAgentLevel / setAgentLevel
// ---------------------------------------------------------------------------

describe('getAgentLevel', () => {
  it('returns L2 by default when agent not in store', () => {
    expect(getAgentLevel('unknown', buildStore())).toBe('L2')
  })

  it('returns stored level when present', () => {
    const store = buildStore({ levels: [{ agentId: 'a', level: 'L3', updatedAt: NOW }] })
    expect(getAgentLevel('a', store)).toBe('L3')
  })

  it('respects custom default level', () => {
    expect(getAgentLevel('unknown', buildStore(), 'L1')).toBe('L1')
  })
})

describe('setAgentLevel', () => {
  it('adds new level state when agent not present', () => {
    const updated = setAgentLevel('a', 'L3', buildStore(), NOW)
    expect(updated.levels).toHaveLength(1)
    expect(updated.levels[0]?.level).toBe('L3')
  })

  it('updates existing level state', () => {
    const store = buildStore({ levels: [{ agentId: 'a', level: 'L1', updatedAt: 0 }] })
    const updated = setAgentLevel('a', 'L2', store, NOW)
    expect(updated.levels).toHaveLength(1)
    expect(updated.levels[0]?.level).toBe('L2')
  })

  it('does not mutate original store', () => {
    const store = buildStore({ levels: [{ agentId: 'a', level: 'L1', updatedAt: 0 }] })
    setAgentLevel('a', 'L2', store, NOW)
    expect(store.levels[0]?.level).toBe('L1')
  })
})

// ---------------------------------------------------------------------------
// requiresWriteConfirmation
// ---------------------------------------------------------------------------

describe('requiresWriteConfirmation', () => {
  it('returns true for L1', () => expect(requiresWriteConfirmation('L1')).toBe(true))
  it('returns false for L2', () => expect(requiresWriteConfirmation('L2')).toBe(false))
  it('returns false for L3', () => expect(requiresWriteConfirmation('L3')).toBe(false))
  it('returns false for L4', () => expect(requiresWriteConfirmation('L4')).toBe(false))
})

// ---------------------------------------------------------------------------
// checkPromotion
// ---------------------------------------------------------------------------

describe('checkPromotion', () => {
  it('suggests promotion when approval rate > threshold and enough records', () => {
    // 6 approvals in last 7 days → 100% approval
    const records = Array.from({ length: 6 }, (_, i) => ({
      agentId: 'a',
      timestamp: NOW - (i + 1) * DAY_MS,
      approved: true,
    }))
    const store = buildStore({ records })
    const suggestion = checkPromotion('a', store, NOW)
    expect(suggestion).toBeDefined()
    expect(suggestion?.direction).toBe('promotion')
    expect(suggestion?.currentLevel).toBe('L2')
    expect(suggestion?.suggestedLevel).toBe('L3')
    expect(suggestion?.rate).toBeGreaterThan(PROMOTION_APPROVAL_THRESHOLD)
  })

  it('returns undefined when approval rate <= threshold', () => {
    const records = Array.from({ length: 6 }, (_, i) => ({
      agentId: 'a',
      timestamp: NOW - (i + 1) * DAY_MS,
      approved: i < 3, // 50% approval — below 85%
    }))
    const store = buildStore({ records })
    expect(checkPromotion('a', store, NOW)).toBeUndefined()
  })

  it('returns undefined when fewer than MIN_RECORDS_FOR_PROMOTION records', () => {
    const records = [{ agentId: 'a', timestamp: NOW - DAY_MS, approved: true }]
    const store = buildStore({ records })
    expect(checkPromotion('a', store, NOW)).toBeUndefined()
  })

  it('returns undefined when agent is already at L4', () => {
    const records = Array.from({ length: 6 }, (_, i) => ({
      agentId: 'a',
      timestamp: NOW - (i + 1) * DAY_MS,
      approved: true,
    }))
    const store = buildStore({
      records,
      levels: [{ agentId: 'a', level: 'L4', updatedAt: NOW }],
    })
    expect(checkPromotion('a', store, NOW)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// checkDemotion
// ---------------------------------------------------------------------------

describe('checkDemotion', () => {
  it('suggests demotion when rejection rate > threshold', () => {
    // 4 rejections out of 10 = 40% rejection → above 30% threshold
    const records = Array.from({ length: 10 }, (_, i) => ({
      agentId: 'a',
      timestamp: NOW - (i + 1) * DAY_MS,
      approved: i >= 4, // 4 rejections
    }))
    const store = buildStore({ records, levels: [{ agentId: 'a', level: 'L3', updatedAt: NOW }] })
    const suggestion = checkDemotion('a', store, NOW)
    expect(suggestion).toBeDefined()
    expect(suggestion?.direction).toBe('demotion')
    expect(suggestion?.currentLevel).toBe('L3')
    expect(suggestion?.suggestedLevel).toBe('L2')
    expect(suggestion?.rate).toBeGreaterThan(DEMOTION_REJECTION_THRESHOLD)
  })

  it('returns undefined when rejection rate <= threshold', () => {
    // 2 rejections out of 10 = 20% → below 30%
    const records = Array.from({ length: 10 }, (_, i) => ({
      agentId: 'a',
      timestamp: NOW - (i + 1) * DAY_MS,
      approved: i >= 2,
    }))
    const store = buildStore({ records })
    expect(checkDemotion('a', store, NOW)).toBeUndefined()
  })

  it('returns undefined when agent is at L1 (cannot demote further)', () => {
    const records = [{ agentId: 'a', timestamp: NOW - DAY_MS, approved: false }]
    const store = buildStore({
      records,
      levels: [{ agentId: 'a', level: 'L1', updatedAt: NOW }],
    })
    expect(checkDemotion('a', store, NOW)).toBeUndefined()
  })

  it('returns undefined when no records in window', () => {
    const store = buildStore()
    expect(checkDemotion('a', store, NOW)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// scanAgentSuggestions
// ---------------------------------------------------------------------------

describe('scanAgentSuggestions', () => {
  it('returns empty array for empty store', () => {
    expect(scanAgentSuggestions(buildStore(), NOW)).toHaveLength(0)
  })

  it('surfaces promotion suggestion for qualifying agent', () => {
    const records = Array.from({ length: 6 }, (_, i) => ({
      agentId: 'a',
      timestamp: NOW - (i + 1) * DAY_MS,
      approved: true,
    }))
    const store = buildStore({ records })
    const suggestions = scanAgentSuggestions(store, NOW)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.direction).toBe('promotion')
  })

  it('prefers promotion over demotion for same agent (high approval and high rejection — edge case)', () => {
    // An agent with exactly 6 approvals out of 6 cannot also have high rejection
    // This verifies the check-promotion-first logic with a normal promotion scenario
    const records = Array.from({ length: 6 }, (_, i) => ({
      agentId: 'a',
      timestamp: NOW - (i + 1) * DAY_MS,
      approved: true,
    }))
    const store = buildStore({ records })
    const suggestions = scanAgentSuggestions(store, NOW)
    const dirs = suggestions.map(s => s.direction)
    expect(dirs).not.toContain('demotion')
  })
})

// ---------------------------------------------------------------------------
// readApprovalStore / writeApprovalStore (I/O)
// ---------------------------------------------------------------------------

describe('readApprovalStore', () => {
  it('returns empty store when file does not exist', async () => {
    const dir = await createTmp()
    const store = await readApprovalStore(dir)
    expect(store.records).toHaveLength(0)
    expect(store.levels).toHaveLength(0)
  })

  it('reads existing store from disk', async () => {
    const dir = await createTmp()
    const data: AgentApprovalStore = {
      records: [{ agentId: 'a', timestamp: NOW, approved: true }],
      levels: [{ agentId: 'a', level: 'L2', updatedAt: NOW }],
    }
    await writeFile(join(dir, '.buildpact', 'agent-levels.json'), JSON.stringify(data), 'utf-8')
    const store = await readApprovalStore(dir)
    expect(store.records).toHaveLength(1)
    expect(store.levels).toHaveLength(1)
  })
})

describe('writeApprovalStore', () => {
  it('persists store to disk and can be read back', async () => {
    const dir = await createTmp()
    const store = buildStore({
      records: [{ agentId: 'b', timestamp: NOW, approved: false }],
      levels: [{ agentId: 'b', level: 'L1', updatedAt: NOW }],
    })
    const result = await writeApprovalStore(store, dir)
    expect(result.ok).toBe(true)
    const readBack = await readApprovalStore(dir)
    expect(readBack.records[0]?.agentId).toBe('b')
    expect(readBack.levels[0]?.level).toBe('L1')
  })
})

// ---------------------------------------------------------------------------
// recordApproval
// ---------------------------------------------------------------------------

describe('recordApproval', () => {
  it('appends an approval record to the store', async () => {
    const dir = await createTmp()
    const result = await recordApproval('a', true, dir, NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.records).toHaveLength(1)
    expect(result.value.records[0]?.approved).toBe(true)
  })

  it('appends a rejection record to the store', async () => {
    const dir = await createTmp()
    const result = await recordApproval('a', false, dir, NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.records[0]?.approved).toBe(false)
  })

  it('accumulates multiple records across calls', async () => {
    const dir = await createTmp()
    await recordApproval('a', true, dir, NOW)
    const result = await recordApproval('a', false, dir, NOW + 1000)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.records).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// applyLevelChange
// ---------------------------------------------------------------------------

describe('applyLevelChange', () => {
  it('updates agent level in store and persists to disk', async () => {
    const dir = await createTmp()
    const suggestion = {
      agentId: 'a',
      currentLevel: 'L2' as const,
      suggestedLevel: 'L3' as const,
      direction: 'promotion' as const,
      rate: 0.9,
    }
    const result = await applyLevelChange(suggestion, dir, NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const level = getAgentLevel('a', result.value)
    expect(level).toBe('L3')
  })
})
