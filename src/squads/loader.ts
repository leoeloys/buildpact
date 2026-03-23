/**
 * Loader — Squad manifest reader and lazy agent loading facade.
 * Parses squad.yaml file references (NOT full AgentDefinition hydration).
 * Provides the ≤1KB agent index infrastructure for Agent Mode (v2.0) lazy loading.
 * @module squads
 * @see FR-906 Lazy loading cap at ≤1KB agent index
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { AutomationLevel } from '../contracts/squad.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** File reference stored in squad.yaml under the agents: block. */
export interface AgentFileRef {
  file: string
}

/**
 * Parsed representation of squad.yaml.
 * Uses AgentFileRef instead of AgentDefinition — squad.yaml stores file paths,
 * not inline layer content. Agent definitions are loaded on-demand.
 */
export interface SquadFileManifest {
  name: string
  version: string
  domain: string
  description: string
  initial_level: AutomationLevel
  agents: Record<string, AgentFileRef>
}

/** Lightweight entry in the agent index (contributes ~60–80 bytes to JSON). */
export interface AgentIndexEntry {
  id: string
  file: string
  level: AutomationLevel
}

/**
 * Agent index — Chief + Specialists, NO full definitions (lazy loading).
 * Total serialized size MUST be ≤1KB (FR-906).
 */
export interface AgentIndex {
  squad_name: string
  squad_version: string
  chief: AgentIndexEntry
  specialists: AgentIndexEntry[]
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const LEVEL_VALUES = new Set<string>(['L1', 'L2', 'L3', 'L4'])

function isAutomationLevel(value: string): value is AutomationLevel {
  return LEVEL_VALUES.has(value)
}

/**
 * Parse scalar fields and agent file refs from squad.yaml content.
 * Uses line-based regex — no external YAML library required.
 * Returns null if any required field is missing.
 */
function parseSquadYaml(content: string): SquadFileManifest | null {
  const nameMatch = content.match(/^name:\s*(.+)$/m)
  const versionMatch = content.match(/^version:\s*["']?([^"'\n]+)["']?/m)
  const domainMatch = content.match(/^domain:\s*(.+)$/m)
  const descriptionMatch = content.match(/^description:\s*["']?([^"'\n]+)["']?/m)
  const levelMatch = content.match(/^initial_level:\s*(L[1-4])/m)

  const name = nameMatch?.[1]?.trim()
  const version = versionMatch?.[1]?.trim()
  const domain = domainMatch?.[1]?.trim()
  const description = descriptionMatch?.[1]?.trim()
  const levelRaw = levelMatch?.[1]?.trim()

  if (!name || !version || !domain || !description || !levelRaw) return null
  if (!isAutomationLevel(levelRaw)) return null

  // Parse agent block: each entry is "  agentId:\n    file: path"
  const agents: Record<string, AgentFileRef> = {}
  const agentRegex = /^  (\w+):\n\s+file:\s*(.+)$/gm
  let match: RegExpExecArray | null

  while ((match = agentRegex.exec(content)) !== null) {
    const agentId = match[1]?.trim()
    const file = match[2]?.trim()
    if (agentId && file) agents[agentId] = { file }
  }

  return { name, version, domain, description, initial_level: levelRaw, agents }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read and parse squad.yaml from a squad directory.
 * Returns a SquadFileManifest with scalar fields and agent file references.
 * Does NOT load agent markdown content — use loadAgentDefinition for on-demand loading.
 */
export async function readSquadManifest(squadDir: string): Promise<Result<SquadFileManifest>> {
  const yamlPath = join(squadDir, 'squad.yaml')
  let content: string

  try {
    content = await readFile(yamlPath, 'utf-8')
  } catch {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.squad.manifest_not_found',
      params: { path: yamlPath },
    })
  }

  const manifest = parseSquadYaml(content)
  if (!manifest) {
    return err({
      code: ERROR_CODES.SQUAD_VALIDATION_FAILED,
      i18nKey: 'error.squad.manifest_invalid',
      params: { path: yamlPath },
    })
  }

  return ok(manifest)
}

/**
 * Build a lightweight agent index from a parsed SquadFileManifest.
 * Total serialized size is ≤1KB (FR-906).
 * The agent named 'chief' becomes index.chief; all others go to index.specialists.
 */
export function buildAgentIndex(manifest: SquadFileManifest): AgentIndex {
  const level = manifest.initial_level

  const entries: AgentIndexEntry[] = Object.entries(manifest.agents).map(([id, ref]) => ({
    id,
    file: ref.file,
    level,
  }))

  const chiefEntry = entries.find(e => e.id === 'chief') ?? entries[0]
  if (!chiefEntry) {
    return { squad_name: manifest.name, squad_version: manifest.version, chief: { id: 'chief', file: '', level: manifest.initial_level }, specialists: [] }
  }
  const specialists = entries.filter(e => e.id !== chiefEntry.id)

  return {
    squad_name: manifest.name,
    squad_version: manifest.version,
    chief: chiefEntry,
    specialists,
  }
}

/**
 * Load a specific agent's markdown definition on-demand.
 * This is the lazy loading entry point — called only when a Specialist is needed.
 * Returns the raw markdown content string.
 */
export async function loadAgentDefinition(
  squadDir: string,
  entry: AgentIndexEntry
): Promise<Result<string>> {
  const agentPath = join(squadDir, entry.file)

  try {
    const content = await readFile(agentPath, 'utf-8')
    return ok(content)
  } catch {
    return err({
      code: ERROR_CODES.AGENT_LOAD_FAILED,
      i18nKey: 'error.squad.agent_not_found',
      params: { agentId: entry.id, path: agentPath },
    })
  }
}
