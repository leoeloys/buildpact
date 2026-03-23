import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  scanArtifactInventory,
  buildPipelineChains,
  checkProcessCompliance,
  calculateMetrics,
  detectNonConformances,
  generateRecommendations,
  formatQualityReportMarkdown,
} from '../../../src/commands/quality/scanner.js'
import type { AuditEntry } from '../../../src/foundation/audit.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_AUDIT_ENTRIES: AuditEntry[] = [
  { ts: '2026-01-01T00:00:00Z', action: 'constitution.validate', agent: 'enforce', files: [], outcome: 'success' },
  { ts: '2026-01-01T01:00:00Z', action: 'readiness.check', agent: 'gate', files: [], outcome: 'success' },
  { ts: '2026-01-01T02:00:00Z', action: 'execute.wave', agent: 'execute', files: [], outcome: 'success' },
  { ts: '2026-01-01T03:00:00Z', action: 'verify.ac', agent: 'verify', files: [], outcome: 'success' },
  { ts: '2026-01-02T00:00:00Z', action: 'execute.wave', agent: 'execute', files: [], outcome: 'success' },
  { ts: '2026-01-02T01:00:00Z', action: 'verify.ac', agent: 'verify', files: [], outcome: 'failure', error: 'AC failed' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scanArtifactInventory', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-quality-'))
    const bpDir = join(tmpDir, '.buildpact')
    await mkdir(join(bpDir, 'specs', 'my-feature'), { recursive: true })
    await mkdir(join(bpDir, 'plans', 'my-feature'), { recursive: true })
    await mkdir(join(bpDir, 'reports'), { recursive: true })
    await writeFile(join(bpDir, 'specs', 'my-feature', 'spec.md'), '# Spec', 'utf-8')
    await writeFile(join(bpDir, 'plans', 'my-feature', 'plan.md'), '# Plan', 'utf-8')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('discovers specs and plans', async () => {
    const inventory = await scanArtifactInventory(tmpDir)
    expect(inventory.specs).toContain('my-feature')
    expect(inventory.plans).toContain('my-feature')
  })

  it('returns empty arrays when .buildpact does not exist', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'buildpact-empty-'))
    try {
      const inventory = await scanArtifactInventory(emptyDir)
      expect(inventory.specs).toEqual([])
      expect(inventory.plans).toEqual([])
      expect(inventory.executions).toEqual([])
      expect(inventory.verifications).toEqual([])
    } finally {
      await rm(emptyDir, { recursive: true, force: true })
    }
  })
})

describe('buildPipelineChains', () => {
  it('marks complete chains correctly', () => {
    const chains = buildPipelineChains({
      specs: ['feature-a'],
      plans: ['feature-a'],
      executions: ['feature-a'],
      verifications: ['verification-feature-a.md'],
    })
    expect(chains).toHaveLength(1)
    expect(chains[0]!.complete).toBe(true)
  })

  it('marks incomplete chains', () => {
    const chains = buildPipelineChains({
      specs: ['feature-a'],
      plans: [],
      executions: [],
      verifications: [],
    })
    expect(chains).toHaveLength(1)
    expect(chains[0]!.complete).toBe(false)
    expect(chains[0]!.hasPlan).toBe(false)
  })

  it('includes plans without specs', () => {
    const chains = buildPipelineChains({
      specs: [],
      plans: ['orphan-plan'],
      executions: [],
      verifications: [],
    })
    expect(chains).toHaveLength(1)
    expect(chains[0]!.hasSpec).toBe(false)
  })
})

describe('checkProcessCompliance', () => {
  it('calculates compliance percentages for each gate', () => {
    const results = checkProcessCompliance(SAMPLE_AUDIT_ENTRIES)
    expect(results).toHaveLength(4)
    for (const r of results) {
      expect(r.percentage).toBeGreaterThanOrEqual(0)
      expect(r.percentage).toBeLessThanOrEqual(100)
    }
  })

  it('returns 0% when no relevant events exist', () => {
    const results = checkProcessCompliance([
      { ts: '2026-01-01', action: 'execute.wave', agent: 'e', files: [], outcome: 'success' },
    ])
    const constitution = results.find((r) => r.gate === 'constitution')!
    expect(constitution.percentage).toBe(0)
  })
})

describe('calculateMetrics', () => {
  it('calculates first-pass yield from verification entries', () => {
    const chains = buildPipelineChains({
      specs: ['a'],
      plans: ['a'],
      executions: ['a'],
      verifications: ['verify-a.md'],
    })
    const compliance = checkProcessCompliance(SAMPLE_AUDIT_ENTRIES)
    const metrics = calculateMetrics(chains, compliance, SAMPLE_AUDIT_ENTRIES)
    // 1 passed, 1 failed → 50%
    expect(metrics.firstPassYield).toBe(50)
  })

  it('returns 100% first-pass yield when no verifications exist', () => {
    const metrics = calculateMetrics([], [], [])
    expect(metrics.firstPassYield).toBe(100)
  })

  it('calculates traceability coverage', () => {
    const chains = buildPipelineChains({
      specs: ['a', 'b'],
      plans: ['a'],
      executions: [],
      verifications: [],
    })
    const metrics = calculateMetrics(chains, [], [])
    // 0 complete out of 2 specs = 0%
    expect(metrics.traceabilityCoverage).toBe(0)
  })
})

describe('detectNonConformances', () => {
  it('reports MAJOR for incomplete pipeline chains', () => {
    const chains = buildPipelineChains({
      specs: ['feature-a'],
      plans: [],
      executions: [],
      verifications: [],
    })
    const issues = detectNonConformances(chains, [], { firstPassYield: 100, traceabilityCoverage: 0, processCompliance: 100, adversarialDensity: 3 })
    const chainIssue = issues.find((i) => i.issue.includes('feature-a'))
    expect(chainIssue).toBeDefined()
    expect(chainIssue!.severity).toBe('MAJOR')
  })

  it('reports CRITICAL for low compliance gates', () => {
    const compliance = [
      { gate: 'constitution' as const, total: 10, passed: 2, percentage: 20 },
    ]
    const issues = detectNonConformances([], compliance, { firstPassYield: 100, traceabilityCoverage: 100, processCompliance: 20, adversarialDensity: 3 })
    const critical = issues.find((i) => i.severity === 'CRITICAL')
    expect(critical).toBeDefined()
  })

  it('returns empty array for clean quality data', () => {
    const issues = detectNonConformances([], [], { firstPassYield: 100, traceabilityCoverage: 100, processCompliance: 100, adversarialDensity: 5 })
    expect(issues).toEqual([])
  })
})

describe('generateRecommendations', () => {
  it('recommends addressing critical issues', () => {
    const ncs = [{ severity: 'CRITICAL' as const, issue: 'test', rootCause: 'test', action: 'test' }]
    const recs = generateRecommendations(ncs, { firstPassYield: 100, traceabilityCoverage: 100, processCompliance: 100, adversarialDensity: 5 })
    expect(recs.some((r) => r.includes('critical'))).toBe(true)
  })

  it('returns healthy message when no issues exist', () => {
    const recs = generateRecommendations([], { firstPassYield: 100, traceabilityCoverage: 100, processCompliance: 100, adversarialDensity: 5 })
    expect(recs.some((r) => r.includes('healthy'))).toBe(true)
  })
})

describe('formatQualityReportMarkdown', () => {
  it('produces valid markdown with all sections', () => {
    const report = {
      inventory: { specs: ['a'], plans: ['a'], executions: [], verifications: [] },
      chains: [{ specSlug: 'a', hasSpec: true, hasPlan: true, hasExecution: false, hasVerification: false, complete: false }],
      compliance: [{ gate: 'constitution' as const, total: 1, passed: 1, percentage: 100 }],
      metrics: { firstPassYield: 90, traceabilityCoverage: 100, processCompliance: 100, adversarialDensity: 4 },
      nonConformances: [],
      recommendations: ['Keep it up'],
    }
    const md = formatQualityReportMarkdown(report)
    expect(md).toContain('# Quality Management Report')
    expect(md).toContain('## 1. Artifact Inventory')
    expect(md).toContain('## 2. Process Compliance')
    expect(md).toContain('## 3. Quality Metrics')
    expect(md).toContain('## 4. Non-Conformance Report')
    expect(md).toContain('## 5. Recommendations')
  })
})
