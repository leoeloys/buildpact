import { describe, it, expect } from 'vitest'
import {
  createExperimentLoop,
  setBaseline,
  requireBaseline,
  recordExperiment,
  shouldKeep,
  bestExperiment,
  experimentCount,
  detectPlateau,
} from '../../../src/engine/experiment-loop.js'
import type { ExperimentResult } from '../../../src/contracts/task.js'

function makeExperiment(status: ExperimentResult['status'] = 'keep', metric = 0.9): ExperimentResult {
  return { commitHash: 'abc123', metric, status, description: 'test', timestamp: new Date().toISOString() }
}

describe('createExperimentLoop', () => {
  it('creates loop with null baseline and empty experiments', () => {
    const loop = createExperimentLoop('perf', 'feat/perf')
    expect(loop.tag).toBe('perf')
    expect(loop.branch).toBe('feat/perf')
    expect(loop.baseline).toBeNull()
    expect(loop.experiments).toEqual([])
    expect(loop.stopCondition).toBe('manual')
  })

  it('accepts custom stop condition', () => {
    const loop = createExperimentLoop('perf', 'main', 'plateau')
    expect(loop.stopCondition).toBe('plateau')
  })
})

describe('setBaseline', () => {
  it('sets baseline value', () => {
    const loop = createExperimentLoop('perf', 'main')
    const updated = setBaseline(loop, 42.5)
    expect(updated.baseline).toBe(42.5)
  })
})

describe('requireBaseline', () => {
  it('fails when baseline is null', () => {
    const loop = createExperimentLoop('perf', 'main')
    const result = requireBaseline(loop)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EXPERIMENT_BASELINE_MISSING')
  })

  it('succeeds when baseline is set', () => {
    const loop = setBaseline(createExperimentLoop('perf', 'main'), 10)
    const result = requireBaseline(loop)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(10)
  })
})

describe('recordExperiment', () => {
  it('appends experiment to state', () => {
    const loop = createExperimentLoop('perf', 'main')
    const updated = recordExperiment(loop, makeExperiment())
    expect(updated.experiments).toHaveLength(1)
  })
})

describe('shouldKeep', () => {
  it('keeps when maximize and measured > baseline', () => {
    expect(shouldKeep({ metric: 'score', direction: 'maximize', evaluationCommand: '', extractPattern: '', baseline: null }, 10, 15)).toBe(true)
  })

  it('discards when maximize and measured <= baseline', () => {
    expect(shouldKeep({ metric: 'score', direction: 'maximize', evaluationCommand: '', extractPattern: '', baseline: null }, 10, 5)).toBe(false)
  })

  it('keeps when minimize and measured < baseline', () => {
    expect(shouldKeep({ metric: 'size', direction: 'minimize', evaluationCommand: '', extractPattern: '', baseline: null }, 100, 50)).toBe(true)
  })

  it('discards when minimize and measured >= baseline', () => {
    expect(shouldKeep({ metric: 'size', direction: 'minimize', evaluationCommand: '', extractPattern: '', baseline: null }, 100, 200)).toBe(false)
  })
})

describe('bestExperiment', () => {
  it('returns undefined when no kept experiments', () => {
    const loop = createExperimentLoop('perf', 'main')
    expect(bestExperiment(loop)).toBeUndefined()
  })

  it('returns last kept experiment', () => {
    let loop = createExperimentLoop('perf', 'main')
    loop = recordExperiment(loop, makeExperiment('discard'))
    loop = recordExperiment(loop, makeExperiment('keep', 0.95))
    const best = bestExperiment(loop)
    expect(best).toBeDefined()
    expect(best!.metric).toBe(0.95)
  })
})

describe('experimentCount', () => {
  it('counts by status', () => {
    let loop = createExperimentLoop('perf', 'main')
    loop = recordExperiment(loop, makeExperiment('keep'))
    loop = recordExperiment(loop, makeExperiment('discard'))
    loop = recordExperiment(loop, makeExperiment('crash'))
    const counts = experimentCount(loop)
    expect(counts.total).toBe(3)
    expect(counts.kept).toBe(1)
    expect(counts.discarded).toBe(1)
    expect(counts.crashed).toBe(1)
  })
})

describe('detectPlateau', () => {
  it('returns false when not enough experiments', () => {
    const loop = createExperimentLoop('perf', 'main')
    expect(detectPlateau(loop)).toBe(false)
  })

  it('detects plateau when last N are all discarded', () => {
    let loop = createExperimentLoop('perf', 'main')
    for (let i = 0; i < 5; i++) loop = recordExperiment(loop, makeExperiment('discard'))
    expect(detectPlateau(loop, 5)).toBe(true)
  })

  it('no plateau when some are kept', () => {
    let loop = createExperimentLoop('perf', 'main')
    for (let i = 0; i < 4; i++) loop = recordExperiment(loop, makeExperiment('discard'))
    loop = recordExperiment(loop, makeExperiment('keep'))
    expect(detectPlateau(loop, 5)).toBe(false)
  })
})
