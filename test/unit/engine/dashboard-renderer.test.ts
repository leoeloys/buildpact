import { describe, it, expect } from 'vitest'
import {
  renderDashboard,
  renderDashboardJson,
  formatElapsed,
  type DashboardState,
} from '../../../src/engine/dashboard-renderer.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDashboardState(overrides: Partial<DashboardState> = {}): DashboardState {
  return {
    agents: [
      { name: 'architect', currentTask: 'Design API', status: 'active' },
      { name: 'developer', currentTask: '', status: 'idle' },
    ],
    waveProgress: { current: 2, total: 5, completedTasks: 7, totalTasks: 20 },
    costAccumulator: { sessionUsd: 0.1234, limitUsd: 5.00 },
    elapsedMs: 125_000,
    startedAt: '2026-03-23T10:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// formatElapsed
// ---------------------------------------------------------------------------

describe('formatElapsed', () => {
  it('formats seconds only', () => {
    expect(formatElapsed(5_000)).toBe('5s')
  })

  it('formats minutes and seconds', () => {
    expect(formatElapsed(125_000)).toBe('2m 5s')
  })

  it('formats hours, minutes, and seconds', () => {
    expect(formatElapsed(3_661_000)).toBe('1h 1m 1s')
  })

  it('formats zero', () => {
    expect(formatElapsed(0)).toBe('0s')
  })

  it('handles negative values gracefully', () => {
    expect(formatElapsed(-100)).toBe('0s')
  })

  it('formats exact hours', () => {
    expect(formatElapsed(7_200_000)).toBe('2h 0m 0s')
  })
})

// ---------------------------------------------------------------------------
// renderDashboard
// ---------------------------------------------------------------------------

describe('renderDashboard', () => {
  it('renders the header', () => {
    const output = renderDashboard(makeDashboardState())
    expect(output).toContain('=== BuildPact Dashboard ===')
  })

  it('renders agent list with status icons', () => {
    const output = renderDashboard(makeDashboardState())
    expect(output).toContain('[>>] architect (active): Design API')
    expect(output).toContain('[--] developer (idle)')
  })

  it('renders agent with error status', () => {
    const state = makeDashboardState({
      agents: [{ name: 'qa', currentTask: '', status: 'error' }],
    })
    const output = renderDashboard(state)
    expect(output).toContain('[!!] qa (error)')
  })

  it('shows wave progress', () => {
    const output = renderDashboard(makeDashboardState())
    expect(output).toContain('Wave: 2/5')
    expect(output).toContain('Tasks: 7/20 (35%)')
  })

  it('shows cost info with percentage', () => {
    const output = renderDashboard(makeDashboardState())
    expect(output).toContain('Cost: $0.1234 / $5.00 (2%)')
  })

  it('shows elapsed time', () => {
    const output = renderDashboard(makeDashboardState())
    expect(output).toContain('Elapsed: 2m 5s')
  })

  it('shows startedAt', () => {
    const output = renderDashboard(makeDashboardState())
    expect(output).toContain('Started: 2026-03-23T10:00:00.000Z')
  })

  it('handles empty agents list', () => {
    const state = makeDashboardState({ agents: [] })
    const output = renderDashboard(state)
    expect(output).toContain('(none)')
  })
})

// ---------------------------------------------------------------------------
// renderDashboardJson
// ---------------------------------------------------------------------------

describe('renderDashboardJson', () => {
  it('outputs valid JSON', () => {
    const state = makeDashboardState()
    const json = renderDashboardJson(state)
    const parsed = JSON.parse(json)
    expect(parsed).toBeDefined()
  })

  it('preserves all fields', () => {
    const state = makeDashboardState()
    const parsed = JSON.parse(renderDashboardJson(state)) as DashboardState

    expect(parsed.agents).toHaveLength(2)
    expect(parsed.waveProgress.current).toBe(2)
    expect(parsed.costAccumulator.sessionUsd).toBe(0.1234)
    expect(parsed.elapsedMs).toBe(125_000)
    expect(parsed.startedAt).toBe('2026-03-23T10:00:00.000Z')
  })
})
