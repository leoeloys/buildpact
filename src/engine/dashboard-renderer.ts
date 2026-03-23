/**
 * Dashboard Renderer — terminal-friendly and JSON dashboard output.
 * Renders real-time execution state for TTY and non-TTY environments.
 * @module engine/dashboard-renderer
 * @see Epic 22 — Story 22.4
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardState {
  agents: Array<{ name: string; currentTask: string; status: 'active' | 'idle' | 'error' }>
  waveProgress: { current: number; total: number; completedTasks: number; totalTasks: number }
  costAccumulator: { sessionUsd: number; limitUsd: number }
  elapsedMs: number
  startedAt: string
}

// ---------------------------------------------------------------------------
// Elapsed time formatting
// ---------------------------------------------------------------------------

/**
 * Format milliseconds as human-readable "Xh Xm Xs".
 * Omits zero-value higher units (e.g., "5m 3s" not "0h 5m 3s").
 */
export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)

  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Status icons
// ---------------------------------------------------------------------------

const STATUS_ICON: Record<string, string> = {
  active: '>>',
  idle: '--',
  error: '!!',
}

// ---------------------------------------------------------------------------
// Terminal renderer
// ---------------------------------------------------------------------------

/**
 * Render a terminal-friendly dashboard string showing agents, wave progress,
 * cost, and elapsed time.
 */
export function renderDashboard(state: DashboardState): string {
  const lines: string[] = []

  // Header
  lines.push('=== BuildPact Dashboard ===')
  lines.push('')

  // Elapsed
  lines.push(`Elapsed: ${formatElapsed(state.elapsedMs)}  |  Started: ${state.startedAt}`)
  lines.push('')

  // Wave progress
  const wp = state.waveProgress
  const pct = wp.totalTasks > 0 ? Math.round((wp.completedTasks / wp.totalTasks) * 100) : 0
  lines.push(`Wave: ${wp.current}/${wp.total}  |  Tasks: ${wp.completedTasks}/${wp.totalTasks} (${pct}%)`)
  lines.push('')

  // Cost
  const cost = state.costAccumulator
  const costPct = cost.limitUsd > 0 ? Math.round((cost.sessionUsd / cost.limitUsd) * 100) : 0
  lines.push(`Cost: $${cost.sessionUsd.toFixed(4)} / $${cost.limitUsd.toFixed(2)} (${costPct}%)`)
  lines.push('')

  // Agents
  lines.push('Agents:')
  if (state.agents.length === 0) {
    lines.push('  (none)')
  } else {
    for (const agent of state.agents) {
      const icon = STATUS_ICON[agent.status] ?? '--'
      const task = agent.status === 'active' ? `: ${agent.currentTask}` : ''
      lines.push(`  [${icon}] ${agent.name} (${agent.status})${task}`)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// JSON renderer
// ---------------------------------------------------------------------------

/**
 * Render dashboard state as JSON string for non-TTY environments.
 */
export function renderDashboardJson(state: DashboardState): string {
  return JSON.stringify(state, null, 2)
}
