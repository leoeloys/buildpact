/**
 * Squad Certification Program — validates squads against quality criteria
 * before they can be listed as "certified" in the marketplace.
 * @see Epic 24.4: Squad Certification Program
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CertificationCheck {
  name: string
  passed: boolean
  detail: string
}

export interface CertificationResult {
  squadName: string
  passed: boolean
  checks: CertificationCheck[]
  certifiedAt?: string | undefined
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_LAYERS = [
  'persona',
  'expertise',
  'boundaries',
  'communication',
  'quality-standards',
  'autonomy-level',
]

const VOICE_DNA_SECTIONS = [
  'Personality Anchors',
  'Opinion Stance',
  'Anti-Patterns',
  'Signature Phrases',
  'Tone Calibration',
]

const MIN_EXAMPLES_PER_AGENT = 3
const MIN_QUALITY_SCORE = 90

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Run the full certification suite on a squad directory.
 */
export async function runCertification(
  squadDir: string,
  squadName: string,
): Promise<Result<CertificationResult>> {
  const checks: CertificationCheck[] = []

  try {
    // Check 1: squad.yaml exists
    checks.push(await checkSquadYaml(squadDir))

    // Check 2: All 6 layers present in agent files
    checks.push(await checkAgentLayers(squadDir))

    // Check 3: Voice DNA complete
    checks.push(await checkVoiceDna(squadDir))

    // Check 4: Minimum examples per agent
    checks.push(await checkExamplesPerAgent(squadDir))

    // Check 5: README exists
    checks.push(await checkReadmeExists(squadDir))

    // Check 6: Quality score >= 90
    checks.push(await checkQualityScore(squadDir))

    const passed = checks.every(c => c.passed)

    const result: CertificationResult = {
      squadName,
      passed,
      checks,
    }
    if (passed) {
      result.certifiedAt = new Date().toISOString()
    }

    return ok(result)
  } catch (e) {
    return err({
      code: ERROR_CODES.CERTIFICATION_FAILED,
      i18nKey: 'error.certification.failed',
      params: { squadName },
      cause: e,
    })
  }
}

/**
 * Format a certification result as a markdown report.
 */
export function formatCertificationReport(result: CertificationResult): string {
  const statusIcon = (passed: boolean): string => passed ? 'PASS' : 'FAIL'
  const lines: string[] = [
    `# Certification Report: ${result.squadName}`,
    '',
    `**Overall:** ${result.passed ? 'CERTIFIED' : 'NOT CERTIFIED'}`,
  ]

  if (result.certifiedAt) {
    lines.push(`**Certified at:** ${result.certifiedAt}`)
  }

  lines.push('', '## Checks', '')

  for (const check of result.checks) {
    lines.push(`- [${statusIcon(check.passed)}] **${check.name}** — ${check.detail}`)
  }

  const passCount = result.checks.filter(c => c.passed).length
  const totalCount = result.checks.length
  lines.push('', `**Score:** ${passCount}/${totalCount} checks passed`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

async function checkSquadYaml(squadDir: string): Promise<CertificationCheck> {
  try {
    await stat(join(squadDir, 'squad.yaml'))
    return { name: 'squad.yaml exists', passed: true, detail: 'Found squad.yaml' }
  } catch {
    return { name: 'squad.yaml exists', passed: false, detail: 'Missing squad.yaml' }
  }
}

async function checkAgentLayers(squadDir: string): Promise<CertificationCheck> {
  const agentsDir = join(squadDir, 'agents')
  let agentFiles: string[]

  try {
    agentFiles = (await readdir(agentsDir)).filter(f => f.endsWith('.md'))
  } catch {
    return { name: 'All 6 layers present', passed: false, detail: 'No agents/ directory found' }
  }

  if (agentFiles.length === 0) {
    return { name: 'All 6 layers present', passed: false, detail: 'No agent files found' }
  }

  const missingLayers: string[] = []

  for (const file of agentFiles) {
    const content = await readFile(join(agentsDir, file), 'utf-8')
    const contentLower = content.toLowerCase()
    for (const layer of REQUIRED_LAYERS) {
      if (!contentLower.includes(layer)) {
        missingLayers.push(`${file}: ${layer}`)
      }
    }
  }

  if (missingLayers.length > 0) {
    return {
      name: 'All 6 layers present',
      passed: false,
      detail: `Missing layers: ${missingLayers.slice(0, 3).join(', ')}${missingLayers.length > 3 ? ` (+${missingLayers.length - 3} more)` : ''}`,
    }
  }

  return { name: 'All 6 layers present', passed: true, detail: `All ${agentFiles.length} agents have 6 layers` }
}

async function checkVoiceDna(squadDir: string): Promise<CertificationCheck> {
  const agentsDir = join(squadDir, 'agents')
  let agentFiles: string[]

  try {
    agentFiles = (await readdir(agentsDir)).filter(f => f.endsWith('.md'))
  } catch {
    return { name: 'Voice DNA complete', passed: false, detail: 'No agents/ directory found' }
  }

  const missingSections: string[] = []

  for (const file of agentFiles) {
    const content = await readFile(join(agentsDir, file), 'utf-8')
    for (const section of VOICE_DNA_SECTIONS) {
      if (!content.includes(section)) {
        missingSections.push(`${file}: ${section}`)
      }
    }
  }

  if (missingSections.length > 0) {
    return {
      name: 'Voice DNA complete',
      passed: false,
      detail: `Missing Voice DNA sections: ${missingSections.slice(0, 3).join(', ')}${missingSections.length > 3 ? ` (+${missingSections.length - 3} more)` : ''}`,
    }
  }

  return { name: 'Voice DNA complete', passed: true, detail: 'All Voice DNA sections present' }
}

async function checkExamplesPerAgent(squadDir: string): Promise<CertificationCheck> {
  const agentsDir = join(squadDir, 'agents')
  let agentFiles: string[]

  try {
    agentFiles = (await readdir(agentsDir)).filter(f => f.endsWith('.md'))
  } catch {
    return { name: `>= ${MIN_EXAMPLES_PER_AGENT} examples per agent`, passed: false, detail: 'No agents/ directory found' }
  }

  const insufficient: string[] = []

  for (const file of agentFiles) {
    const content = await readFile(join(agentsDir, file), 'utf-8')
    // Count example blocks — fenced code blocks or lines starting with "Example:"
    const exampleMatches = content.match(/```[\s\S]*?```|example\s*:/gi)
    const count = exampleMatches?.length ?? 0
    if (count < MIN_EXAMPLES_PER_AGENT) {
      insufficient.push(`${file} (${count})`)
    }
  }

  if (insufficient.length > 0) {
    return {
      name: `>= ${MIN_EXAMPLES_PER_AGENT} examples per agent`,
      passed: false,
      detail: `Insufficient examples: ${insufficient.join(', ')}`,
    }
  }

  return {
    name: `>= ${MIN_EXAMPLES_PER_AGENT} examples per agent`,
    passed: true,
    detail: `All agents have >= ${MIN_EXAMPLES_PER_AGENT} examples`,
  }
}

async function checkReadmeExists(squadDir: string): Promise<CertificationCheck> {
  const candidates = ['README.md', 'readme.md', 'Readme.md']

  for (const name of candidates) {
    try {
      await stat(join(squadDir, name))
      return { name: 'README exists', passed: true, detail: `Found ${name}` }
    } catch {
      // try next
    }
  }

  return { name: 'README exists', passed: false, detail: 'No README.md found' }
}

async function checkQualityScore(squadDir: string): Promise<CertificationCheck> {
  // Quality score is derived from the presence and completeness of agent files.
  // In a full implementation this would run the quality scanner.
  // For certification, we compute a heuristic score.
  const agentsDir = join(squadDir, 'agents')
  let agentFiles: string[]

  try {
    agentFiles = (await readdir(agentsDir)).filter(f => f.endsWith('.md'))
  } catch {
    return { name: `Quality score >= ${MIN_QUALITY_SCORE}`, passed: false, detail: 'Cannot read agents directory' }
  }

  if (agentFiles.length === 0) {
    return { name: `Quality score >= ${MIN_QUALITY_SCORE}`, passed: false, detail: 'No agent files to score' }
  }

  let totalScore = 0

  for (const file of agentFiles) {
    const content = await readFile(join(agentsDir, file), 'utf-8')
    let score = 0
    const contentLower = content.toLowerCase()

    // 6 layers: ~10 points each = 60 max
    for (const layer of REQUIRED_LAYERS) {
      if (contentLower.includes(layer)) score += 10
    }

    // Voice DNA: 5 sections × 4 = 20 max
    for (const section of VOICE_DNA_SECTIONS) {
      if (content.includes(section)) score += 4
    }

    // Examples: up to 20 points (capped at 5 examples)
    const exampleMatches = content.match(/```[\s\S]*?```|example\s*:/gi)
    const exampleCount = Math.min(exampleMatches?.length ?? 0, 5)
    score += exampleCount * 4

    totalScore += score
  }

  const avgScore = Math.round(totalScore / agentFiles.length)

  if (avgScore >= MIN_QUALITY_SCORE) {
    return {
      name: `Quality score >= ${MIN_QUALITY_SCORE}`,
      passed: true,
      detail: `Average quality score: ${avgScore}`,
    }
  }

  return {
    name: `Quality score >= ${MIN_QUALITY_SCORE}`,
    passed: false,
    detail: `Average quality score: ${avgScore} (need >= ${MIN_QUALITY_SCORE})`,
  }
}
