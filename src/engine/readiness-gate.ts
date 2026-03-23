// Readiness Gate — FR-XXX
// Validates that all required artifacts are present before execution begins
// Inspired by BMAD Method v6 Implementation Readiness Gate

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export type ReadinessDecision = 'PASS' | 'CONCERNS' | 'FAIL'

export interface ReadinessCheck {
  id: string
  label: string
  required: boolean  // false = warning only
  pass: boolean
  detail?: string
}

export interface ReadinessGateResult {
  decision: ReadinessDecision
  checks: ReadinessCheck[]
  passCount: number
  failCount: number
  warningCount: number
  /** Formatted markdown report */
  report: string
}

/**
 * Run all readiness checks for a spec before execution begins.
 */
export function runReadinessGate(projectDir: string, specSlug: string): ReadinessGateResult {
  const specsDir = join(projectDir, '.buildpact', 'specs', specSlug)
  const plansDir = join(projectDir, '.buildpact', 'plans', specSlug)
  const snapshotsDir = join(projectDir, '.buildpact', 'snapshots', specSlug)

  const checks: ReadinessCheck[] = [
    {
      id: 'spec_exists',
      label: 'Spec file present',
      required: true,
      pass: existsSync(join(specsDir, 'spec.md')),
      detail: `Expected: .buildpact/specs/${specSlug}/spec.md`
    },
    {
      id: 'plan_exists',
      label: 'At least one plan file present',
      required: true,
      pass: existsSync(plansDir) && existsSync(join(plansDir, 'wave-1-plan-1.md')),
      detail: `Expected: .buildpact/plans/${specSlug}/wave-1-plan-1.md`
    },
    {
      id: 'no_clarification_markers',
      label: 'No [NEEDS_CLARIFICATION] markers in spec',
      required: true,
      pass: checkNoClarificationMarkers(join(specsDir, 'spec.md')),
      detail: 'Spec must not contain unresolved [NEEDS_CLARIFICATION] blocks'
    },
    {
      id: 'nyquist_passed',
      label: 'Nyquist validation report present and passed',
      required: true,
      pass: existsSync(join(snapshotsDir, 'nyquist-report.md')) &&
            checkNyquistPassed(join(snapshotsDir, 'nyquist-report.md')),
      detail: `Expected: .buildpact/snapshots/${specSlug}/nyquist-report.md (status: PASS)`
    },
    {
      id: 'constitution_exists',
      label: 'Constitution file present',
      required: false,
      pass: existsSync(join(projectDir, '.buildpact', 'constitution.md')),
      detail: 'Constitution enforces quality rules during execution'
    },
    {
      id: 'research_summary',
      label: 'Research summary available',
      required: false,
      pass: existsSync(join(snapshotsDir, 'research-summary.md')),
      detail: 'Research summary enriches subagent context'
    },
    {
      id: 'adrs_written',
      label: 'ADRs written for architectural decisions',
      required: false,
      pass: checkAdrsPresent(join(plansDir, 'adrs')),
      detail: 'ADRs prevent agent conflicts on architectural choices'
    },
  ]

  const failRequired = checks.filter(c => c.required && !c.pass)
  const failOptional = checks.filter(c => !c.required && !c.pass)
  const passCount = checks.filter(c => c.pass).length

  let decision: ReadinessDecision
  if (failRequired.length === 0 && failOptional.length === 0) {
    decision = 'PASS'
  } else if (failRequired.length === 0) {
    decision = 'CONCERNS'
  } else if (failRequired.length >= 3) {
    decision = 'FAIL'
  } else {
    decision = 'CONCERNS'
  }

  return {
    decision,
    checks,
    passCount,
    failCount: failRequired.length,
    warningCount: failOptional.length,
    report: formatReadinessReport(decision, checks, specSlug)
  }
}

function checkNoClarificationMarkers(specPath: string): boolean {
  if (!existsSync(specPath)) return false
  const content = readFileSync(specPath, 'utf8')
  return !content.includes('[NEEDS_CLARIFICATION')
}

function checkNyquistPassed(reportPath: string): boolean {
  if (!existsSync(reportPath)) return false
  const content = readFileSync(reportPath, 'utf8')
  return content.includes('status: pass') || content.includes('**PASS**') || content.includes('✓ PASS')
}

function checkAdrsPresent(adrsDir: string): boolean {
  if (!existsSync(adrsDir)) return false
  try {
    return readdirSync(adrsDir).filter((f: string) => f.endsWith('.md')).length > 0
  } catch {
    return false
  }
}

function formatReadinessReport(decision: ReadinessDecision, checks: ReadinessCheck[], specSlug: string): string {
  const icon = decision === 'PASS' ? '✅' : decision === 'CONCERNS' ? '⚠️' : '❌'
  const lines = [
    `# Readiness Gate Report — ${specSlug}`,
    `**Decision: ${icon} ${decision}**`,
    '',
    '| Check | Required | Status |',
    '|-------|----------|--------|',
  ]

  for (const check of checks) {
    const status = check.pass ? '✓ Pass' : (check.required ? '✗ Fail' : '⚠ Warning')
    const req = check.required ? 'Required' : 'Optional'
    lines.push(`| ${check.label} | ${req} | ${status} |`)
    if (!check.pass && check.detail) {
      lines.push(`| ↳ *${check.detail}* | | |`)
    }
  }

  if (decision === 'FAIL') {
    lines.push('', '> ❌ **Execution blocked.** Fix required checks before proceeding.')
  } else if (decision === 'CONCERNS') {
    lines.push('', '> ⚠️ **Concerns found.** Review warnings before proceeding, or override to continue.')
  } else {
    lines.push('', '> ✅ **Ready to execute.** All checks passed.')
  }

  return lines.join('\n')
}
