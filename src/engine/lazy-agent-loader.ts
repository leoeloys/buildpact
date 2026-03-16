/**
 * Lazy Agent Loader — on-demand agent loading for Agent Mode.
 * Implements FR-806: only Chief + lightweight index loaded initially;
 * specialists loaded on-demand and released after completion.
 * @see US-037 (Epic 8.6: Lazy Agent Loading v2.0)
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lightweight entry in the agent index — one line per agent */
export interface AgentIndexEntry {
  /** Agent role ID: 'chief', 'specialist', 'support', 'reviewer', or custom */
  id: string
  /** Tier label: 'T1' | 'T2' | 'T3' | 'T4' */
  tier: string
  /** Human-readable role name */
  role: string
  /** Relative path to agent file from squadDir */
  file: string
}

/** Lightweight agent index — total text ≤1KB when formatted */
export interface AgentIndex {
  squadName: string
  domain: string
  /** Chief agent file path (quick reference for initial load) */
  chiefFile: string
  agents: AgentIndexEntry[]
}

/** A fully loaded agent with content in memory */
export interface LoadedAgent {
  id: string
  content: string
  /** Unix timestamp ms — for testability via nowMs parameter */
  loadedAt: number
}

/** Session tracking which agents are currently loaded */
export interface AgentSession {
  index: AgentIndex
  /** Map of agentId → LoadedAgent for currently loaded agents */
  loadedAgents: Map<string, LoadedAgent>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard role-to-tier mapping for default 4-tier squads */
const ROLE_TIER_MAP: Record<string, string> = {
  chief: 'T1',
  specialist: 'T2',
  support: 'T3',
  reviewer: 'T4',
}

/** Maximum byte length of formatted index (enforced in formatAgentIndex) */
export const MAX_INDEX_BYTES = 1024

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Parse a simple YAML scalar line: `key: value` → value string */
function parseYamlScalar(content: string, key: string): string {
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith(`${key}:`)) {
      return trimmed.slice(`${key}:`.length).trim().replace(/^["']|["']$/g, '')
    }
  }
  return ''
}

/**
 * Parse the `agents:` block from squad.yaml content.
 * Returns a map of agentId → file path.
 */
function parseAgentsBlock(content: string): Map<string, string> {
  const result = new Map<string, string>()
  const lines = content.split('\n')
  let inAgentsBlock = false
  let currentAgentId = ''

  for (const line of lines) {
    if (line.trim() === 'agents:') {
      inAgentsBlock = true
      continue
    }

    if (inAgentsBlock) {
      // Detect end of agents block (unindented non-empty line that's not a comment)
      if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && !line.trim().startsWith('#')) {
        inAgentsBlock = false
        continue
      }

      // 2-space indented agent id line
      const agentIdMatch = /^  ([a-z0-9_-]+):/.exec(line)
      if (agentIdMatch) {
        currentAgentId = agentIdMatch[1]!
        continue
      }

      // 4-space indented file line
      const fileMatch = /^    file:\s*(.+)$/.exec(line)
      if (fileMatch && currentAgentId) {
        result.set(currentAgentId, fileMatch[1]!.trim().replace(/^["']|["']$/g, ''))
      }
    }
  }

  return result
}

/**
 * Infer agent tier from role id using standard mapping.
 * Falls back to 'T?' for unknown roles.
 */
export function inferAgentTier(roleId: string): string {
  return ROLE_TIER_MAP[roleId.toLowerCase()] ?? 'T?'
}

/**
 * Capitalize first letter of a role name for display.
 */
export function formatRoleName(roleId: string): string {
  if (!roleId) return ''
  return roleId.charAt(0).toUpperCase() + roleId.slice(1).toLowerCase()
}

/**
 * Format the agent index as compact text ≤1KB.
 * Format: one line per agent → `T1 chief  agents/chief.md`
 */
export function formatAgentIndex(index: AgentIndex): string {
  const header = `Squad: ${index.squadName} | Domain: ${index.domain}\nAgents (${index.agents.length}):\n`
  const rows = index.agents.map(a => `  ${a.tier} ${a.role.padEnd(12)} ${a.file}`).join('\n')
  const text = header + rows + '\n'

  // Truncate to MAX_INDEX_BYTES if somehow oversized
  if (Buffer.byteLength(text, 'utf-8') > MAX_INDEX_BYTES) {
    return text.slice(0, MAX_INDEX_BYTES - 3) + '...'
  }
  return text
}

// ---------------------------------------------------------------------------
// Session management (pure)
// ---------------------------------------------------------------------------

/** Create a new empty AgentSession for the given index */
export function createAgentSession(index: AgentIndex): AgentSession {
  return { index, loadedAgents: new Map() }
}

/** Return IDs of all currently loaded agents in a session */
export function getLoadedAgentIds(session: AgentSession): string[] {
  return Array.from(session.loadedAgents.keys())
}

/**
 * Release (unload) an agent from the session.
 * Returns updated session (mutates the Map in-place — callers share reference).
 */
export function releaseAgent(session: AgentSession, agentId: string): AgentSession {
  session.loadedAgents.delete(agentId)
  return session
}

/** Format a loaded agent's content for subagent context injection */
export function formatLoadedAgentForContext(agent: LoadedAgent): string {
  return `<!-- agent:${agent.id} loaded:${new Date(agent.loadedAt).toISOString()} -->\n${agent.content}`
}

// ---------------------------------------------------------------------------
// I/O functions
// ---------------------------------------------------------------------------

/**
 * Build the lightweight agent index from a squad directory.
 * Reads squad.yaml; does NOT read any agent file contents.
 */
export async function buildAgentIndex(squadDir: string): Promise<Result<AgentIndex>> {
  const yamlPath = join(squadDir, 'squad.yaml')
  let yamlContent = ''

  try {
    yamlContent = await readFile(yamlPath, 'utf-8')
  } catch (cause) {
    return err({
      code: ERROR_CODES.AGENT_LOAD_FAILED,
      i18nKey: 'error.agent.load_failed',
      params: { path: yamlPath, reason: String(cause) },
      cause,
    })
  }

  const squadName = parseYamlScalar(yamlContent, 'name') || basename(squadDir)
  const domain = parseYamlScalar(yamlContent, 'domain') || 'custom'
  const agentsMap = parseAgentsBlock(yamlContent)

  const agents: AgentIndexEntry[] = []
  let chiefFile = ''

  for (const [id, file] of agentsMap) {
    const tier = inferAgentTier(id)
    const role = formatRoleName(id)
    agents.push({ id, tier, role, file })
    if (id === 'chief') {
      chiefFile = file
    }
  }

  // If no chief found, fall back to first agent or empty
  if (!chiefFile && agents.length > 0) {
    chiefFile = agents[0]!.file
  }

  return ok({ squadName, domain, chiefFile, agents })
}

/**
 * Load only the Chief agent from a squad directory.
 * Used for initial Agent Mode startup — keeps context window small.
 */
export async function loadChiefAgent(
  squadDir: string,
  index: AgentIndex,
  nowMs: number = Date.now(),
): Promise<Result<LoadedAgent>> {
  const agentPath = join(squadDir, index.chiefFile)

  try {
    const content = await readFile(agentPath, 'utf-8')
    return ok({ id: 'chief', content, loadedAt: nowMs })
  } catch (cause) {
    return err({
      code: ERROR_CODES.AGENT_LOAD_FAILED,
      i18nKey: 'error.agent.load_failed',
      params: { path: agentPath, reason: String(cause) },
      cause,
    })
  }
}

/**
 * Load a specialist agent on-demand during a handoff.
 * Finds the agent file from the index and reads its content.
 */
export async function loadSpecialistAgent(
  squadDir: string,
  index: AgentIndex,
  agentId: string,
  nowMs: number = Date.now(),
): Promise<Result<LoadedAgent>> {
  const entry = index.agents.find(a => a.id === agentId)
  if (!entry) {
    return err({
      code: ERROR_CODES.AGENT_LOAD_FAILED,
      i18nKey: 'error.agent.not_in_index',
      params: { agentId, squad: index.squadName },
    })
  }

  const agentPath = join(squadDir, entry.file)

  try {
    const content = await readFile(agentPath, 'utf-8')
    return ok({ id: agentId, content, loadedAt: nowMs })
  } catch (cause) {
    return err({
      code: ERROR_CODES.AGENT_LOAD_FAILED,
      i18nKey: 'error.agent.load_failed',
      params: { path: agentPath, reason: String(cause) },
      cause,
    })
  }
}

/**
 * Load an agent and register it in the session.
 * Mutates session.loadedAgents in-place (callers share reference).
 */
export async function loadAndRegisterAgent(
  squadDir: string,
  session: AgentSession,
  agentId: string,
  nowMs: number = Date.now(),
): Promise<Result<LoadedAgent>> {
  const loadResult = await loadSpecialistAgent(squadDir, session.index, agentId, nowMs)
  if (!loadResult.ok) return loadResult

  session.loadedAgents.set(agentId, loadResult.value)
  return loadResult
}

/**
 * Scan the agents/ directory to list all agent filenames.
 * Returns only .md files, sorted alphabetically.
 */
export async function listAvailableAgents(squadDir: string): Promise<Result<string[]>> {
  const agentsDir = join(squadDir, 'agents')
  try {
    const files = await readdir(agentsDir)
    const mdFiles = files.filter(f => f.endsWith('.md')).sort()
    return ok(mdFiles)
  } catch (cause) {
    return err({
      code: ERROR_CODES.AGENT_LOAD_FAILED,
      i18nKey: 'error.agent.load_failed',
      params: { path: agentsDir, reason: String(cause) },
      cause,
    })
  }
}
