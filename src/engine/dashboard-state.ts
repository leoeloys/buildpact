// Dashboard State — write state.json for external dashboard consumption
// Foundation for future visual dashboard (Pixi.js, React, or terminal UI)
// Inspired by OpenSquad's state.json -> WebSocket -> dashboard pattern

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type AgentStatus = 'idle' | 'active' | 'complete' | 'error' | 'waiting'
export type PipelinePhase = 'specify' | 'plan' | 'execute' | 'verify' | 'quick' | 'quality' | 'docs' | 'investigate'

export interface AgentState {
  id: string
  displayName: string
  role: string
  status: AgentStatus
  currentTask?: string
  lastAction?: string
  lastActionAt?: string
}

export interface PipelineState {
  phase: PipelinePhase | 'idle'
  specSlug?: string
  waveNumber?: number
  totalWaves?: number
  taskIndex?: number
  totalTasks?: number
  startedAt?: string
}

export interface DashboardState {
  version: '1.0'
  projectName: string
  updatedAt: string
  pipeline: PipelineState
  agents: AgentState[]
  /** Performance mode: quality, balanced, or speed */
  performanceMode: string
  /** Active squad name */
  activeSquad?: string
  /** Budget usage summary */
  budget?: {
    sessionSpent: number
    dailySpent: number
    dailyLimit: number
  }
}

const STATE_FILE = '.buildpact/state.json'

/**
 * Write dashboard state to disk.
 * External dashboards can watch this file for changes.
 */
export function writeDashboardState(projectDir: string, state: DashboardState): void {
  const statePath = join(projectDir, STATE_FILE)
  const dir = join(projectDir, '.buildpact')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  state.updatedAt = new Date().toISOString()
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8')
}

/**
 * Read current dashboard state from disk.
 */
export function readDashboardState(projectDir: string): DashboardState | undefined {
  const statePath = join(projectDir, STATE_FILE)
  if (!existsSync(statePath)) return undefined
  try {
    return JSON.parse(readFileSync(statePath, 'utf8')) as DashboardState
  } catch {
    return undefined
  }
}

/**
 * Update a single agent's status in the dashboard state.
 */
export function updateAgentStatus(
  projectDir: string,
  agentId: string,
  status: AgentStatus,
  currentTask?: string,
): void {
  const state = readDashboardState(projectDir)
  if (!state) return

  const agent = state.agents.find(a => a.id === agentId)
  if (agent) {
    agent.status = status
    agent.currentTask = currentTask
    agent.lastAction = status === 'active' ? `Working on: ${currentTask}` : status
    agent.lastActionAt = new Date().toISOString()
  }

  writeDashboardState(projectDir, state)
}

/**
 * Update pipeline phase in dashboard state.
 */
export function updatePipelinePhase(
  projectDir: string,
  phase: PipelinePhase | 'idle',
  details?: Partial<PipelineState>,
): void {
  const state = readDashboardState(projectDir)
  if (!state) return

  state.pipeline = { ...state.pipeline, phase, ...details }
  writeDashboardState(projectDir, state)
}

/**
 * Initialize dashboard state for a project.
 */
export function initDashboardState(
  projectDir: string,
  projectName: string,
  squad?: { name: string; agents: Array<{ id: string; displayName: string; role: string }> },
  performanceMode?: string,
): DashboardState {
  const state: DashboardState = {
    version: '1.0',
    projectName,
    updatedAt: new Date().toISOString(),
    pipeline: { phase: 'idle' },
    agents: squad?.agents.map(a => ({
      ...a,
      status: 'idle' as AgentStatus,
    })) ?? [],
    performanceMode: performanceMode ?? 'balanced',
    activeSquad: squad?.name,
  }

  writeDashboardState(projectDir, state)
  return state
}
