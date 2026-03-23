/**
 * @module commands/quality/scanner
 * @see Story 15.3 — CLI Quality Command (Crivo)
 *
 * Scan .buildpact/ artifacts and audit logs for quality metrics.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { AuditEntry } from '../../foundation/audit.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArtifactInventory {
  specs: string[]
  plans: string[]
  executions: string[]
  verifications: string[]
}

export interface PipelineChain {
  specSlug: string
  hasSpec: boolean
  hasPlan: boolean
  hasExecution: boolean
  hasVerification: boolean
  complete: boolean
}

export type ComplianceGate = 'constitution' | 'readiness' | 'budget' | 'adversarial'

export interface ComplianceResult {
  gate: ComplianceGate
  total: number
  passed: number
  percentage: number
}

export type NonConformanceSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR'

export interface NonConformance {
  severity: NonConformanceSeverity
  issue: string
  rootCause: string
  action: string
}

export interface QualityMetrics {
  firstPassYield: number
  traceabilityCoverage: number
  processCompliance: number
  adversarialDensity: number
  /** Composite quality score (0-100) */
  score: number
}

export interface QualityReport {
  inventory: ArtifactInventory
  chains: PipelineChain[]
  compliance: ComplianceResult[]
  metrics: QualityMetrics
  nonConformances: NonConformance[]
  recommendations: string[]
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

/** List subdirectories in a directory, returning empty array if not found */
async function listSubdirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

/** List files in a directory, returning empty array if not found */
async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir)
    return entries
  } catch {
    return []
  }
}

/**
 * Scan .buildpact/ for artifact inventory.
 */
export async function scanArtifactInventory(projectDir: string): Promise<ArtifactInventory> {
  const bpDir = join(projectDir, '.buildpact')

  const specs = await listSubdirs(join(bpDir, 'specs'))
  const plans = await listSubdirs(join(bpDir, 'plans'))

  // Executions are stored under plans as execution outputs
  const executions: string[] = []
  for (const plan of plans) {
    const execDir = join(bpDir, 'plans', plan, 'executions')
    const execFiles = await listFiles(execDir)
    if (execFiles.length > 0) executions.push(plan)
  }

  // Verifications — check for verify reports
  const reportsDir = join(bpDir, 'reports')
  const reportFiles = await listFiles(reportsDir)
  const verifications = reportFiles.filter(
    (f) => f.includes('verification') || f.includes('verify'),
  )

  return { specs, plans, executions, verifications }
}

/**
 * Build pipeline chains from inventory.
 */
export function buildPipelineChains(inventory: ArtifactInventory): PipelineChain[] {
  const allSlugs = new Set([...inventory.specs, ...inventory.plans])
  const chains: PipelineChain[] = []

  for (const slug of allSlugs) {
    const hasSpec = inventory.specs.includes(slug)
    const hasPlan = inventory.plans.includes(slug)
    const hasExecution = inventory.executions.includes(slug)
    const hasVerification = inventory.verifications.some((v) => v.includes(slug))

    chains.push({
      specSlug: slug,
      hasSpec,
      hasPlan,
      hasExecution,
      hasVerification,
      complete: hasSpec && hasPlan && hasExecution && hasVerification,
    })
  }

  return chains
}

// ---------------------------------------------------------------------------
// Compliance checking
// ---------------------------------------------------------------------------

/**
 * Check process compliance from audit log entries.
 */
export function checkProcessCompliance(entries: AuditEntry[]): ComplianceResult[] {
  const constitutionEvents = entries.filter((e) => e.action.includes('constitution'))
  const readinessEvents = entries.filter((e) => e.action.includes('readiness'))
  const budgetEvents = entries.filter((e) => e.action.includes('budget'))
  const adversarialEvents = entries.filter(
    (e) => e.action.includes('verify') || e.action.includes('adversarial'),
  )

  // Count pipeline runs (rough: count unique execute.wave actions)
  const pipelineRuns = Math.max(
    1,
    entries.filter((e) => e.action.includes('execute')).length,
  )

  const gates: ComplianceResult[] = [
    {
      gate: 'constitution',
      total: pipelineRuns,
      passed: Math.min(constitutionEvents.length, pipelineRuns),
      percentage: Math.round((Math.min(constitutionEvents.length, pipelineRuns) / pipelineRuns) * 100),
    },
    {
      gate: 'readiness',
      total: pipelineRuns,
      passed: Math.min(readinessEvents.length, pipelineRuns),
      percentage: Math.round((Math.min(readinessEvents.length, pipelineRuns) / pipelineRuns) * 100),
    },
    {
      gate: 'budget',
      total: pipelineRuns,
      passed: Math.min(budgetEvents.length, pipelineRuns),
      percentage: Math.round((Math.min(budgetEvents.length, pipelineRuns) / pipelineRuns) * 100),
    },
    {
      gate: 'adversarial',
      total: pipelineRuns,
      passed: Math.min(adversarialEvents.length, pipelineRuns),
      percentage: Math.round((Math.min(adversarialEvents.length, pipelineRuns) / pipelineRuns) * 100),
    },
  ]

  return gates
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * Calculate quality metrics from chains and compliance results.
 */
export function calculateMetrics(
  chains: PipelineChain[],
  compliance: ComplianceResult[],
  auditEntries: AuditEntry[],
): QualityMetrics {
  // First-pass yield: % of verifications that passed on first attempt
  const verifyEntries = auditEntries.filter((e) => e.action.includes('verify'))
  const passedFirst = verifyEntries.filter((e) => e.outcome === 'success').length
  const firstPassYield = verifyEntries.length > 0
    ? Math.round((passedFirst / verifyEntries.length) * 100)
    : 100

  // Traceability coverage: % of specs with full chain
  const specsWithChains = chains.filter((c) => c.hasSpec)
  const traceabilityCoverage = specsWithChains.length > 0
    ? Math.round((chains.filter((c) => c.complete).length / specsWithChains.length) * 100)
    : 100

  // Process compliance: average of gate percentages
  const processCompliance = compliance.length > 0
    ? Math.round(compliance.reduce((sum, c) => sum + c.percentage, 0) / compliance.length)
    : 100

  // Adversarial density: verification findings per spec
  const adversarialFindings = auditEntries.filter(
    (e) => e.action.includes('verify') && e.outcome === 'failure',
  ).length
  const specCount = Math.max(1, chains.filter((c) => c.hasSpec).length)
  const adversarialDensity = Math.round((adversarialFindings / specCount) * 10) / 10

  // Composite score: weighted average of key metrics
  const score = Math.round(
    (firstPassYield * 0.3) +
    (traceabilityCoverage * 0.2) +
    (processCompliance * 0.3) +
    (Math.min(adversarialDensity / 3, 1) * 100 * 0.2)
  )

  return {
    firstPassYield,
    traceabilityCoverage,
    processCompliance,
    adversarialDensity,
    score,
  }
}

// ---------------------------------------------------------------------------
// Non-conformance detection
// ---------------------------------------------------------------------------

/**
 * Detect non-conformances from chains, compliance, and metrics.
 */
export function detectNonConformances(
  chains: PipelineChain[],
  compliance: ComplianceResult[],
  metrics: QualityMetrics,
): NonConformance[] {
  const issues: NonConformance[] = []

  // Check for incomplete chains
  const incomplete = chains.filter((c) => c.hasSpec && !c.complete)
  if (incomplete.length > 0) {
    for (const chain of incomplete) {
      const missing: string[] = []
      if (!chain.hasPlan) missing.push('plan')
      if (!chain.hasExecution) missing.push('execution')
      if (!chain.hasVerification) missing.push('verification')

      issues.push({
        severity: missing.includes('plan') ? 'MAJOR' : 'MINOR',
        issue: `Spec "${chain.specSlug}" has incomplete pipeline chain (missing: ${missing.join(', ')})`,
        rootCause: 'Pipeline not run to completion',
        action: `Run the missing pipeline phases for spec "${chain.specSlug}"`,
      })
    }
  }

  // Check compliance gates
  for (const gate of compliance) {
    if (gate.percentage < 50) {
      issues.push({
        severity: 'CRITICAL',
        issue: `${gate.gate} gate compliance is only ${gate.percentage}%`,
        rootCause: `${gate.gate} check not being performed in pipeline runs`,
        action: `Ensure ${gate.gate} gate is active for all pipeline runs`,
      })
    } else if (gate.percentage < 90) {
      issues.push({
        severity: 'MAJOR',
        issue: `${gate.gate} gate compliance is ${gate.percentage}% (target: >=90%)`,
        rootCause: `Some pipeline runs skipping ${gate.gate} check`,
        action: `Review runs that skipped ${gate.gate} gate`,
      })
    }
  }

  // Check metrics thresholds
  if (metrics.firstPassYield < 80) {
    issues.push({
      severity: 'MAJOR',
      issue: `First-pass yield is ${metrics.firstPassYield}% (target: >=80%)`,
      rootCause: 'Too many verification failures on first attempt',
      action: 'Improve spec clarity and planning thoroughness',
    })
  }

  if (metrics.traceabilityCoverage < 100) {
    issues.push({
      severity: 'MINOR',
      issue: `Traceability coverage is ${metrics.traceabilityCoverage}% (target: 100%)`,
      rootCause: 'Some specs lack full pipeline coverage',
      action: 'Complete pipeline for all existing specs',
    })
  }

  return issues
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

/**
 * Generate improvement recommendations based on quality analysis.
 */
export function generateRecommendations(
  nonConformances: NonConformance[],
  metrics: QualityMetrics,
): string[] {
  const recs: string[] = []

  const criticalCount = nonConformances.filter((n) => n.severity === 'CRITICAL').length
  const majorCount = nonConformances.filter((n) => n.severity === 'MAJOR').length

  if (criticalCount > 0) {
    recs.push(`Address ${criticalCount} critical non-conformance(s) immediately`)
  }
  if (majorCount > 0) {
    recs.push(`Review and resolve ${majorCount} major non-conformance(s) within the next sprint`)
  }
  if (metrics.firstPassYield < 80) {
    recs.push('Improve specification clarity to increase first-pass yield above 80%')
  }
  if (metrics.adversarialDensity < 3) {
    recs.push('Increase adversarial review depth — target at least 3 findings per spec')
  }
  if (nonConformances.length === 0) {
    recs.push('Process is healthy — continue periodic quality reviews')
  }

  return recs
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

/**
 * Format quality report as markdown.
 */
export function formatQualityReportMarkdown(report: QualityReport): string {
  const lines: string[] = [
    '# Quality Management Report (ISO 9001-Inspired)',
    `> Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Artifact Inventory',
    '',
    `| Type | Count |`,
    `|------|-------|`,
    `| Specs | ${report.inventory.specs.length} |`,
    `| Plans | ${report.inventory.plans.length} |`,
    `| Executions | ${report.inventory.executions.length} |`,
    `| Verifications | ${report.inventory.verifications.length} |`,
    '',
  ]

  if (report.chains.length > 0) {
    lines.push('### Pipeline Chains', '')
    lines.push('| Spec | Plan | Execution | Verification | Status |')
    lines.push('|------|------|-----------|--------------|--------|')
    for (const c of report.chains) {
      lines.push(
        `| ${c.specSlug} | ${c.hasPlan ? 'Y' : 'N'} | ${c.hasExecution ? 'Y' : 'N'} | ${c.hasVerification ? 'Y' : 'N'} | ${c.complete ? 'Complete' : 'Incomplete'} |`,
      )
    }
    lines.push('')
  }

  lines.push('## 2. Process Compliance', '')
  lines.push('| Gate | Passed | Total | Compliance |')
  lines.push('|------|--------|-------|------------|')
  for (const c of report.compliance) {
    lines.push(`| ${c.gate} | ${c.passed} | ${c.total} | ${c.percentage}% |`)
  }
  lines.push('')

  lines.push('## 3. Quality Metrics', '')
  lines.push('| Metric | Value | Target |')
  lines.push('|--------|-------|--------|')
  lines.push(`| First-pass yield | ${report.metrics.firstPassYield}% | >=80% |`)
  lines.push(`| Traceability coverage | ${report.metrics.traceabilityCoverage}% | 100% |`)
  lines.push(`| Process compliance | ${report.metrics.processCompliance}% | >=90% |`)
  lines.push(`| Adversarial density | ${report.metrics.adversarialDensity} | >=3 |`)
  lines.push(`| **Quality score** | **${report.metrics.score}** | **>=80** |`)
  lines.push('')

  if (report.nonConformances.length > 0) {
    lines.push('## 4. Non-Conformance Report', '')
    for (const nc of report.nonConformances) {
      lines.push(`- **[${nc.severity}]** ${nc.issue}`)
      lines.push(`  - Root cause: ${nc.rootCause}`)
      lines.push(`  - Action: ${nc.action}`)
    }
    lines.push('')
  } else {
    lines.push('## 4. Non-Conformance Report', '')
    lines.push('No non-conformances detected.', '')
  }

  lines.push('## 5. Recommendations', '')
  for (const rec of report.recommendations) {
    lines.push(`- ${rec}`)
  }
  lines.push('')

  return lines.join('\n')
}
