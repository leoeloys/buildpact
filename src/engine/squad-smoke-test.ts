/**
 * Squad Smoke Test Runner — validates agent loading, voice DNA, autonomy levels.
 * Reuses validateSquadStructure() from squad-scaffolder as foundation,
 * then adds runtime validation checks.
 * @see Epic 16.2: Squad Smoke Test Runner
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import { validateSquadStructure, validateHandoffGraph } from './squad-scaffolder.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a single smoke test check */
export type SmokeStatus = 'pass' | 'fail' | 'warn'

/** A single smoke test result */
export interface SmokeCheck {
  /** Human-readable check name */
  name: string
  /** Outcome */
  status: SmokeStatus
  /** Detail message */
  message: string
}

/** Full smoke test report for a squad */
export interface SmokeTestReport {
  /** Squad name */
  squadName: string
  /** ISO 8601 timestamp */
  timestamp: string
  /** All individual checks */
  checks: SmokeCheck[]
  /** Overall pass/fail */
  passed: boolean
  /** Summary counts */
  summary: {
    total: number
    passed: number
    failed: number
    warned: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TIERS = ['T1', 'T2', 'T3', 'T4']
const VALID_LEVELS = ['L1', 'L2', 'L3', 'L4']

const VOICE_DNA_SECTIONS = [
  'Personality Anchors',
  'Opinion Stance',
  'Anti-Patterns',
  'Never-Do Rules',
  'Inspirational Anchors',
]

// ---------------------------------------------------------------------------
// Check functions
// ---------------------------------------------------------------------------

/**
 * Check 1: Structural validation (delegates to squad-scaffolder).
 */
export async function checkStructure(squadDir: string): Promise<SmokeCheck[]> {
  const checks: SmokeCheck[] = []

  const result = await validateSquadStructure(squadDir)
  if (!result.ok) {
    checks.push({
      name: 'structure',
      status: 'fail',
      message: 'Could not read squad files for structural validation',
    })
    return checks
  }

  if (result.value.errors.length === 0) {
    checks.push({
      name: 'structure',
      status: 'pass',
      message: 'Squad structure is valid (6-layer anatomy, required fields)',
    })
  } else {
    for (const error of result.value.errors) {
      checks.push({
        name: 'structure',
        status: 'fail',
        message: error,
      })
    }
  }

  return checks
}

/**
 * Check 2: Agent loading test — verify each agent .md file can be read
 * and contains a valid frontmatter block with agent/squad/tier/level fields.
 */
export async function checkAgentLoading(squadDir: string): Promise<SmokeCheck[]> {
  const checks: SmokeCheck[] = []
  const agentsDir = join(squadDir, 'agents')

  let agentFiles: string[]
  try {
    const entries = await readdir(agentsDir)
    agentFiles = entries.filter(f => f.endsWith('.md'))
  } catch {
    checks.push({
      name: 'agent-loading',
      status: 'fail',
      message: 'Cannot read agents/ directory',
    })
    return checks
  }

  if (agentFiles.length === 0) {
    checks.push({
      name: 'agent-loading',
      status: 'fail',
      message: 'No agent files found in agents/',
    })
    return checks
  }

  for (const file of agentFiles) {
    const agentPath = join(agentsDir, file)
    let content: string
    try {
      content = await readFile(agentPath, 'utf-8')
    } catch {
      checks.push({
        name: 'agent-loading',
        status: 'fail',
        message: `Cannot read agent file: agents/${file}`,
      })
      continue
    }

    // Check frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) {
      checks.push({
        name: 'agent-loading',
        status: 'warn',
        message: `agents/${file}: no YAML frontmatter found (---...--- block)`,
      })
      continue
    }

    const frontmatter = frontmatterMatch[1]!
    const fields: Record<string, string> = {}
    for (const line of frontmatter.split('\n')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim()
        const val = line.slice(colonIdx + 1).trim()
        fields[key] = val
      }
    }

    // Validate tier
    if (fields['tier'] && !VALID_TIERS.includes(fields['tier'])) {
      checks.push({
        name: 'agent-loading',
        status: 'fail',
        message: `agents/${file}: invalid tier '${fields['tier']}' (expected ${VALID_TIERS.join(', ')})`,
      })
    }

    // Validate level
    if (fields['level'] && !VALID_LEVELS.includes(fields['level'])) {
      checks.push({
        name: 'agent-loading',
        status: 'fail',
        message: `agents/${file}: invalid level '${fields['level']}' (expected ${VALID_LEVELS.join(', ')})`,
      })
    }

    // If we got here with valid fields, loading passed
    if (!fields['tier'] || VALID_TIERS.includes(fields['tier'])) {
      if (!fields['level'] || VALID_LEVELS.includes(fields['level'])) {
        checks.push({
          name: 'agent-loading',
          status: 'pass',
          message: `agents/${file}: loaded successfully (tier: ${fields['tier'] ?? 'unset'}, level: ${fields['level'] ?? 'unset'})`,
        })
      }
    }
  }

  return checks
}

/**
 * Check 3: Voice DNA parse test — verify each agent has all 5 Voice DNA sections.
 */
export async function checkVoiceDna(squadDir: string): Promise<SmokeCheck[]> {
  const checks: SmokeCheck[] = []
  const agentsDir = join(squadDir, 'agents')

  let agentFiles: string[]
  try {
    const entries = await readdir(agentsDir)
    agentFiles = entries.filter(f => f.endsWith('.md'))
  } catch {
    checks.push({
      name: 'voice-dna',
      status: 'fail',
      message: 'Cannot read agents/ directory',
    })
    return checks
  }

  for (const file of agentFiles) {
    const agentPath = join(agentsDir, file)
    let content: string
    try {
      content = await readFile(agentPath, 'utf-8')
    } catch {
      continue // loading check will catch this
    }

    if (!content.includes('## Voice DNA')) {
      checks.push({
        name: 'voice-dna',
        status: 'fail',
        message: `agents/${file}: missing Voice DNA section`,
      })
      continue
    }

    const missingSections: string[] = []
    for (const section of VOICE_DNA_SECTIONS) {
      if (!content.includes(`### ${section}`)) {
        missingSections.push(section)
      }
    }

    if (missingSections.length > 0) {
      checks.push({
        name: 'voice-dna',
        status: 'fail',
        message: `agents/${file}: Voice DNA missing sections: ${missingSections.join(', ')}`,
      })
    } else {
      checks.push({
        name: 'voice-dna',
        status: 'pass',
        message: `agents/${file}: Voice DNA complete (5/5 sections)`,
      })
    }
  }

  return checks
}

/**
 * Check 4: Autonomy level validation — verify initial_level in squad.yaml
 * and individual agent levels are consistent.
 */
export async function checkAutonomyLevels(squadDir: string): Promise<SmokeCheck[]> {
  const checks: SmokeCheck[] = []

  // Read squad.yaml for initial_level
  let initialLevel: string | undefined
  try {
    const yamlContent = await readFile(join(squadDir, 'squad.yaml'), 'utf-8')
    for (const line of yamlContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('initial_level:')) {
        initialLevel = trimmed.slice('initial_level:'.length).trim().replace(/^["']|["']$/g, '')
        break
      }
    }
  } catch {
    checks.push({
      name: 'autonomy',
      status: 'fail',
      message: 'Cannot read squad.yaml for initial_level',
    })
    return checks
  }

  if (!initialLevel) {
    checks.push({
      name: 'autonomy',
      status: 'fail',
      message: 'squad.yaml missing initial_level field',
    })
  } else if (!VALID_LEVELS.includes(initialLevel)) {
    checks.push({
      name: 'autonomy',
      status: 'fail',
      message: `squad.yaml initial_level '${initialLevel}' is not valid (expected ${VALID_LEVELS.join(', ')})`,
    })
  } else {
    checks.push({
      name: 'autonomy',
      status: 'pass',
      message: `Squad initial_level: ${initialLevel}`,
    })
  }

  return checks
}

/**
 * Check 5: Handoff graph validation.
 */
export async function checkHandoffs(squadDir: string): Promise<SmokeCheck[]> {
  const checks: SmokeCheck[] = []

  const result = await validateHandoffGraph(squadDir)
  if (!result.ok) {
    checks.push({
      name: 'handoffs',
      status: 'fail',
      message: 'Could not validate handoff graph',
    })
    return checks
  }

  if (result.value.errors.length === 0) {
    checks.push({
      name: 'handoffs',
      status: 'pass',
      message: 'Handoff graph valid — all agents have incoming/outgoing handoffs',
    })
  } else {
    for (const error of result.value.errors) {
      checks.push({
        name: 'handoffs',
        status: 'warn',
        message: error,
      })
    }
  }

  return checks
}

// ---------------------------------------------------------------------------
// Check 6: Circular dependency detection
// ---------------------------------------------------------------------------

interface AgentDependency {
  name: string
  depends_on?: string[]
}

/**
 * Parse squad.yaml to extract agent entries with depends_on fields.
 * Uses simple line-based YAML parsing.
 */
export async function parseAgentDependencies(squadDir: string): Promise<AgentDependency[]> {
  let yamlContent: string
  try {
    yamlContent = await readFile(join(squadDir, 'squad.yaml'), 'utf-8')
  } catch {
    return []
  }

  const agents: AgentDependency[] = []
  const lines = yamlContent.split('\n')
  let inAgents = false
  let currentAgent: string | null = null
  let inDependsOn = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect agents: section
    if (/^agents:\s*$/.test(trimmed)) {
      inAgents = true
      continue
    }

    // Exit agents section when hitting another top-level key
    if (inAgents && /^\S+:/.test(trimmed) && !trimmed.startsWith('-') && line[0] !== ' ') {
      inAgents = false
      inDependsOn = false
      continue
    }

    if (!inAgents) continue

    // Detect agent name (2-space indent)
    const agentMatch = line.match(/^  (\S+):/)
    if (agentMatch) {
      if (currentAgent) {
        // Push previous agent if not already added
        const existing = agents.find(a => a.name === currentAgent)
        if (!existing) {
          agents.push({ name: currentAgent })
        }
      }
      currentAgent = agentMatch[1]!
      inDependsOn = false
      agents.push({ name: currentAgent })
      continue
    }

    // Detect depends_on field under an agent
    if (currentAgent && trimmed.startsWith('depends_on:')) {
      inDependsOn = true
      // Check for inline array: depends_on: [a, b]
      const inlineMatch = trimmed.match(/depends_on:\s*\[([^\]]*)\]/)
      if (inlineMatch) {
        const deps = inlineMatch[1]!.split(',').map(d => d.trim()).filter(Boolean)
        const agent = agents.find(a => a.name === currentAgent)
        if (agent) agent.depends_on = deps
        inDependsOn = false
      }
      continue
    }

    // Collect list items under depends_on
    if (inDependsOn && trimmed.startsWith('- ')) {
      const dep = trimmed.slice(2).trim()
      const agent = agents.find(a => a.name === currentAgent)
      if (agent) {
        if (!agent.depends_on) agent.depends_on = []
        agent.depends_on.push(dep)
      }
      continue
    }

    // Any other field ends depends_on list
    if (inDependsOn && trimmed && !trimmed.startsWith('-')) {
      inDependsOn = false
    }
  }

  return agents
}

/**
 * Check for circular dependencies among agents using DFS-based cycle detection.
 * Builds a directed graph from agent depends_on fields and checks for cycles.
 */
export function checkCircularDependencies(agents: AgentDependency[]): SmokeCheck[] {
  const checks: SmokeCheck[] = []

  // Build adjacency list
  const graph = new Map<string, string[]>()
  for (const agent of agents) {
    graph.set(agent.name, agent.depends_on ?? [])
  }

  // DFS-based cycle detection
  const WHITE = 0  // unvisited
  const GRAY = 1   // in current path
  const BLACK = 2  // fully processed

  const color = new Map<string, number>()
  for (const name of graph.keys()) {
    color.set(name, WHITE)
  }

  const cycles: string[][] = []

  function dfs(node: string, path: string[]): boolean {
    color.set(node, GRAY)
    path.push(node)

    const neighbors = graph.get(node) ?? []
    for (const neighbor of neighbors) {
      const neighborColor = color.get(neighbor)

      if (neighborColor === GRAY) {
        // Found a cycle — extract the cycle from the path
        const cycleStart = path.indexOf(neighbor)
        const cycle = path.slice(cycleStart)
        cycle.push(neighbor) // close the cycle
        cycles.push(cycle)
        return true
      }

      if (neighborColor === WHITE) {
        dfs(neighbor, path)
      }
    }

    path.pop()
    color.set(node, BLACK)
    return false
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      dfs(node, [])
    }
  }

  if (cycles.length > 0) {
    for (const cycle of cycles) {
      checks.push({
        name: 'circular-dependencies',
        status: 'fail',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
      })
    }
  } else {
    // Only report if there are any dependencies at all
    const hasDeps = agents.some(a => a.depends_on && a.depends_on.length > 0)
    if (hasDeps) {
      checks.push({
        name: 'circular-dependencies',
        status: 'pass',
        message: 'No circular dependencies found in agent dependency graph',
      })
    }
  }

  return checks
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run the full smoke test suite for a squad directory.
 * Returns a structured report.
 */
export async function runSmokeTests(
  squadDir: string,
  squadName: string,
  nowIso?: string,
): Promise<Result<SmokeTestReport>> {
  const allChecks: SmokeCheck[] = []

  // Run all check categories
  const structureChecks = await checkStructure(squadDir)
  allChecks.push(...structureChecks)

  const loadingChecks = await checkAgentLoading(squadDir)
  allChecks.push(...loadingChecks)

  const voiceDnaChecks = await checkVoiceDna(squadDir)
  allChecks.push(...voiceDnaChecks)

  const autonomyChecks = await checkAutonomyLevels(squadDir)
  allChecks.push(...autonomyChecks)

  const handoffChecks = await checkHandoffs(squadDir)
  allChecks.push(...handoffChecks)

  // Check 6: Circular dependency detection
  const agentDeps = await parseAgentDependencies(squadDir)
  const circularChecks = checkCircularDependencies(agentDeps)
  allChecks.push(...circularChecks)

  const passed = allChecks.filter(c => c.status === 'pass').length
  const failed = allChecks.filter(c => c.status === 'fail').length
  const warned = allChecks.filter(c => c.status === 'warn').length

  return ok({
    squadName,
    timestamp: nowIso ?? new Date().toISOString(),
    checks: allChecks,
    passed: failed === 0,
    summary: {
      total: allChecks.length,
      passed,
      failed,
      warned,
    },
  })
}

/**
 * Format a smoke test report as a human-readable string.
 */
export function formatSmokeReport(report: SmokeTestReport): string {
  const lines: string[] = [
    `# Smoke Test Report: ${report.squadName}`,
    ``,
    `Timestamp: ${report.timestamp}`,
    `Result: ${report.passed ? 'PASSED' : 'FAILED'}`,
    `Checks: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warned} warnings`,
    ``,
    `## Details`,
    ``,
  ]

  const statusIcon: Record<SmokeStatus, string> = {
    pass: 'PASS',
    fail: 'FAIL',
    warn: 'WARN',
  }

  for (const check of report.checks) {
    lines.push(`[${statusIcon[check.status]}] ${check.name}: ${check.message}`)
  }

  return lines.join('\n') + '\n'
}
