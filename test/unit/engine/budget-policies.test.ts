import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createPolicy,
  checkPolicyStatus,
  findApplicablePolicy,
  createIncident,
  resolveIncident,
  loadPolicies,
  savePolicies,
  recordIncident,
  DEFAULT_WARN_PERCENT,
} from '../../../src/engine/budget-policies.js'

describe('createPolicy', () => {
  it('creates policy with defaults', () => {
    const p = createPolicy({
      id: 'POL-001',
      scopeType: 'project',
      scopeId: 'my-project',
      windowKind: 'monthly',
      amountUsd: 50,
    })
    expect(p.id).toBe('POL-001')
    expect(p.scopeType).toBe('project')
    expect(p.windowKind).toBe('monthly')
    expect(p.amountUsd).toBe(50)
    expect(p.warnPercent).toBe(DEFAULT_WARN_PERCENT)
    expect(p.enabled).toBe(true)
  })

  it('accepts custom warn percent', () => {
    const p = createPolicy({
      id: 'POL-002',
      scopeType: 'squad',
      scopeId: 'frontend',
      windowKind: 'lifetime',
      amountUsd: 100,
      warnPercent: 90,
    })
    expect(p.warnPercent).toBe(90)
  })
})

describe('checkPolicyStatus', () => {
  const policy = createPolicy({
    id: 'POL-001',
    scopeType: 'project',
    scopeId: 'proj',
    windowKind: 'monthly',
    amountUsd: 10,
    warnPercent: 80,
  })

  it('returns ok when under warn threshold', () => {
    const status = checkPolicyStatus(policy, 5)
    expect(status.status).toBe('ok')
    expect(status.remainingUsd).toBe(5)
    expect(status.observed).toBe(5)
  })

  it('returns warning at 80%', () => {
    const status = checkPolicyStatus(policy, 8)
    expect(status.status).toBe('warning')
    expect(status.remainingUsd).toBe(2)
  })

  it('returns warning at exactly warn threshold', () => {
    const status = checkPolicyStatus(policy, 8.0) // 80% of 10
    expect(status.status).toBe('warning')
  })

  it('returns hard_stop when over budget', () => {
    const status = checkPolicyStatus(policy, 10)
    expect(status.status).toBe('hard_stop')
    expect(status.remainingUsd).toBe(0)
  })

  it('returns hard_stop when way over budget', () => {
    const status = checkPolicyStatus(policy, 15)
    expect(status.status).toBe('hard_stop')
    expect(status.remainingUsd).toBe(0)
  })

  it('returns ok for disabled policy regardless of spend', () => {
    const disabled = { ...policy, enabled: false }
    const status = checkPolicyStatus(disabled, 100)
    expect(status.status).toBe('ok')
  })
})

describe('findApplicablePolicy', () => {
  const policies = [
    createPolicy({ id: 'P1', scopeType: 'project', scopeId: 'proj-a', windowKind: 'monthly', amountUsd: 10 }),
    createPolicy({ id: 'P2', scopeType: 'squad', scopeId: 'frontend', windowKind: 'lifetime', amountUsd: 50 }),
    { ...createPolicy({ id: 'P3', scopeType: 'agent', scopeId: 'dev-1', windowKind: 'monthly', amountUsd: 5 }), enabled: false },
  ]

  it('finds matching policy', () => {
    const p = findApplicablePolicy(policies, 'project', 'proj-a')
    expect(p).toBeDefined()
    expect(p!.id).toBe('P1')
  })

  it('finds squad policy', () => {
    const p = findApplicablePolicy(policies, 'squad', 'frontend')
    expect(p).toBeDefined()
    expect(p!.id).toBe('P2')
  })

  it('skips disabled policies', () => {
    const p = findApplicablePolicy(policies, 'agent', 'dev-1')
    expect(p).toBeUndefined()
  })

  it('returns undefined for no match', () => {
    expect(findApplicablePolicy(policies, 'project', 'nonexistent')).toBeUndefined()
  })
})

describe('createIncident / resolveIncident', () => {
  it('creates unresolved incident', () => {
    const inc = createIncident('POL-001', 12, 10)
    expect(inc.policyId).toBe('POL-001')
    expect(inc.observedAmount).toBe(12)
    expect(inc.threshold).toBe(10)
    expect(inc.resolution).toBeNull()
    expect(inc.triggeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('resolves incident', () => {
    const inc = createIncident('POL-001', 12, 10)
    const resolved = resolveIncident(inc, 'acknowledged')
    expect(resolved.resolution).toBe('acknowledged')
  })

  it('can resolve as increased', () => {
    const inc = createIncident('POL-001', 12, 10)
    expect(resolveIncident(inc, 'increased').resolution).toBe('increased')
  })

  it('can resolve as paused', () => {
    const inc = createIncident('POL-001', 12, 10)
    expect(resolveIncident(inc, 'paused').resolution).toBe('paused')
  })
})

describe('savePolicies / loadPolicies', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('round-trips policies through disk', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-budget-'))
    const policies = [
      createPolicy({ id: 'P1', scopeType: 'project', scopeId: 'proj', windowKind: 'monthly', amountUsd: 10 }),
      createPolicy({ id: 'P2', scopeType: 'squad', scopeId: 'sq', windowKind: 'lifetime', amountUsd: 50 }),
    ]

    const saveResult = await savePolicies(tempDir, policies)
    expect(saveResult.ok).toBe(true)

    const loadResult = await loadPolicies(tempDir)
    expect(loadResult.ok).toBe(true)
    if (loadResult.ok) {
      expect(loadResult.value).toHaveLength(2)
      expect(loadResult.value[0]!.id).toBe('P1')
      expect(loadResult.value[1]!.amountUsd).toBe(50)
    }
  })

  it('returns empty array when no file exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-budget-'))
    const result = await loadPolicies(tempDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual([])
  })
})

describe('recordIncident', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('persists incident to disk', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-budget-'))
    const inc = createIncident('POL-001', 12, 10)
    const result = await recordIncident(tempDir, inc)
    expect(result.ok).toBe(true)
  })
})
