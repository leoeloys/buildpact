import { describe, it, expect } from 'vitest'
import {
  mapAcsToWave,
  verifyWaveAcs,
  formatWaveVerificationReport,
  buildWaveFixPlan,
} from '../../../src/engine/wave-verifier.js'
import type { WaveExecutionResult } from '../../../src/engine/wave-executor.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const specWithAcs = (acs: string[]): string =>
  ['# Spec', '', '## Acceptance Criteria', '', ...acs.map(ac => `- ${ac}`)].join('\n')

const makeWaveResult = (
  tasks: Array<{ title: string; success: boolean }>,
  waveNumber = 0,
): WaveExecutionResult => ({
  waveNumber,
  allSucceeded: tasks.every(t => t.success),
  tasks: tasks.map((t, i) => ({
    taskId: `task-${i}`,
    title: t.title,
    waveNumber,
    success: t.success,
    artifacts: [],
    ...(t.success ? {} : { error: 'stub failure' }),
  })),
})

// ---------------------------------------------------------------------------
// mapAcsToWave
// ---------------------------------------------------------------------------

describe('mapAcsToWave', () => {
  it('returns ACs whose keywords overlap with task titles', () => {
    const spec = specWithAcs([
      'User authentication system must work',
      'Database migrations run correctly',
    ])
    const taskTitles = ['Implement authentication module']
    const result = mapAcsToWave(spec, taskTitles)
    // 'authentication' overlaps
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('authentication')
  })

  it('returns empty array when no ACs match task titles', () => {
    const spec = specWithAcs(['Database migrations run correctly'])
    const taskTitles = ['Build authentication service']
    // 'database', 'migrations', 'correctly' — none overlap with 'build', 'authentication', 'service'
    const result = mapAcsToWave(spec, taskTitles)
    expect(result).toHaveLength(0)
  })

  it('returns empty array when spec has no AC section', () => {
    const spec = '# Spec\n\nNo acceptance criteria here.'
    const result = mapAcsToWave(spec, ['Implement something'])
    expect(result).toHaveLength(0)
  })

  it('returns empty array when task titles list is empty', () => {
    const spec = specWithAcs(['User authentication system must work'])
    const result = mapAcsToWave(spec, [])
    expect(result).toHaveLength(0)
  })

  it('maps multiple ACs when multiple keywords overlap', () => {
    const spec = specWithAcs([
      'Authentication tokens expire after timeout',
      'Database connection pooling works correctly',
      'Payment gateway integration passes validation',
    ])
    const taskTitles = ['Implement authentication tokens', 'Configure database connection']
    const result = mapAcsToWave(spec, taskTitles)
    expect(result).toHaveLength(2)
    expect(result.some(ac => ac.includes('authentication'))).toBe(true)
    expect(result.some(ac => ac.includes('database'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// verifyWaveAcs
// ---------------------------------------------------------------------------

describe('verifyWaveAcs', () => {
  it('passes all ACs when all covering tasks succeeded', () => {
    const spec = specWithAcs(['Implement authentication system'])
    const waveResult = makeWaveResult([{ title: 'Implement authentication module', success: true }])
    const report = verifyWaveAcs(spec, waveResult)
    expect(report.allPassed).toBe(true)
    expect(report.passCount).toBe(1)
    expect(report.failCount).toBe(0)
  })

  it('fails ACs when covering tasks failed', () => {
    const spec = specWithAcs(['Implement authentication system'])
    const waveResult = makeWaveResult([{ title: 'Implement authentication module', success: false }])
    const report = verifyWaveAcs(spec, waveResult)
    expect(report.allPassed).toBe(false)
    expect(report.failCount).toBe(1)
    expect(report.acResults[0]!.passed).toBe(false)
    expect(report.acResults[0]!.coveringTasks).toContain('Implement authentication module')
  })

  it('reports allPassed=true when no ACs are relevant to the wave', () => {
    const spec = specWithAcs(['Database migrations run correctly'])
    // No overlap with 'authentication'
    const waveResult = makeWaveResult([{ title: 'Build authentication service', success: true }])
    const report = verifyWaveAcs(spec, waveResult)
    expect(report.allPassed).toBe(true)
    expect(report.acResults).toHaveLength(0)
  })

  it('preserves wave number from waveResult', () => {
    const spec = specWithAcs(['Implement something useful here'])
    const waveResult = makeWaveResult([{ title: 'Implement feature', success: true }], 3)
    const report = verifyWaveAcs(spec, waveResult)
    expect(report.waveNumber).toBe(3)
  })

  it('passes AC if at least one covering task succeeded even if another failed', () => {
    const spec = specWithAcs(['Implement authentication system'])
    const waveResult = makeWaveResult([
      { title: 'Implement authentication core', success: true },
      { title: 'Implement authentication tests', success: false },
    ])
    const report = verifyWaveAcs(spec, waveResult)
    // AC covered by both tasks — passes because at least one succeeded
    expect(report.allPassed).toBe(true)
    expect(report.passCount).toBe(1)
  })

  it('tracks covering tasks for each AC result', () => {
    const spec = specWithAcs(['Payment gateway integration validation'])
    const waveResult = makeWaveResult([
      { title: 'Setup payment gateway service', success: false },
    ])
    const report = verifyWaveAcs(spec, waveResult)
    expect(report.acResults[0]!.coveringTasks).toContain('Setup payment gateway service')
  })
})

// ---------------------------------------------------------------------------
// formatWaveVerificationReport
// ---------------------------------------------------------------------------

describe('formatWaveVerificationReport', () => {
  it('includes wave number in heading', () => {
    const report = verifyWaveAcs(
      specWithAcs(['Implement authentication system']),
      makeWaveResult([{ title: 'Implement authentication', success: true }], 1),
    )
    const text = formatWaveVerificationReport(report)
    expect(text).toContain('Wave 2 Goal-Backward Verification')
  })

  it('shows passed/failed counts summary', () => {
    const report = verifyWaveAcs(
      specWithAcs(['Implement authentication system']),
      makeWaveResult([{ title: 'Implement authentication', success: true }]),
    )
    const text = formatWaveVerificationReport(report)
    expect(text).toContain('1 AC(s) passed')
    expect(text).toContain('0 AC(s) failed')
  })

  it('uses check mark for passed ACs and cross for failed ACs', () => {
    const spec = specWithAcs([
      'Implement authentication system',
      'Database connection pooling works',
    ])
    const waveResult = makeWaveResult([
      { title: 'Implement authentication service', success: true },
      { title: 'Database connection setup failed', success: false },
    ])
    const report = verifyWaveAcs(spec, waveResult)
    const text = formatWaveVerificationReport(report)
    expect(text).toContain('✓')
    expect(text).toContain('✗')
  })

  it('shows "No acceptance criteria" message when no ACs mapped', () => {
    const report = verifyWaveAcs(
      specWithAcs(['Database migrations run correctly']),
      makeWaveResult([{ title: 'Build authentication service', success: true }]),
    )
    const text = formatWaveVerificationReport(report)
    expect(text).toContain('No acceptance criteria mapped to this wave')
  })
})

// ---------------------------------------------------------------------------
// buildWaveFixPlan
// ---------------------------------------------------------------------------

describe('buildWaveFixPlan', () => {
  it('generates fix plan with AGENT task for each failed AC', () => {
    const failedAcs = ['implement authentication system', 'database connection pooling']
    const result = buildWaveFixPlan(failedAcs, 0, 'my-feature')
    expect(result).toContain('[AGENT] Fix: implement authentication system')
    expect(result).toContain('[AGENT] Fix: database connection pooling')
  })

  it('includes phase slug and wave number in heading', () => {
    const result = buildWaveFixPlan(['some failed ac test'], 1, 'auth-service')
    expect(result).toContain('auth-service')
    expect(result).toContain('Wave 2')
  })

  it('truncates long AC text to 80 characters', () => {
    const longAc = 'a'.repeat(100)
    const result = buildWaveFixPlan([longAc], 0, 'slug')
    const taskLine = result.split('\n').find(l => l.includes('[AGENT] Fix:'))
    const acPart = taskLine?.replace('- [ ] [AGENT] Fix: ', '') ?? ''
    expect(acPart.length).toBeLessThanOrEqual(80)
  })

  it('includes Key References section', () => {
    const result = buildWaveFixPlan(['fix something important'], 0, 'my-slug')
    expect(result).toContain('## Key References')
    expect(result).toContain('Phase: my-slug')
    expect(result).toContain('Wave: 1')
  })

  it('generates valid wave plan file header', () => {
    const result = buildWaveFixPlan(['fix something'], 0, 'my-feature')
    expect(result).toContain('# Fix Plan')
    expect(result).toContain('## Tasks')
  })
})
