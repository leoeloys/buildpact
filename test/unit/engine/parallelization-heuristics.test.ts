import { describe, it, expect } from 'vitest'
import {
  findSharedOutputFiles,
  findSequentialDeps,
  canRunInParallel,
  analyzeParallelization,
} from '../../../src/engine/parallelization-heuristics.js'
import type { ParallelizableTask } from '../../../src/engine/parallelization-heuristics.js'

const taskA: ParallelizableTask = {
  id: 'A', outputFiles: ['out/a.ts'], dependencies: [], subsystem: 'auth',
}
const taskB: ParallelizableTask = {
  id: 'B', outputFiles: ['out/b.ts'], dependencies: [], subsystem: 'billing',
}
const taskC: ParallelizableTask = {
  id: 'C', outputFiles: ['out/a.ts'], dependencies: ['A'], subsystem: 'auth',
}

describe('findSharedOutputFiles', () => {
  it('returns empty when no shared files', () => {
    expect(findSharedOutputFiles([taskA, taskB])).toEqual([])
  })

  it('detects shared output files', () => {
    expect(findSharedOutputFiles([taskA, taskC])).toEqual(['out/a.ts'])
  })

  it('handles empty task list', () => {
    expect(findSharedOutputFiles([])).toEqual([])
  })
})

describe('findSequentialDeps', () => {
  it('returns empty when no dependencies', () => {
    expect(findSequentialDeps([taskA, taskB])).toEqual([])
  })

  it('detects sequential dependencies', () => {
    expect(findSequentialDeps([taskA, taskC])).toEqual(['A'])
  })

  it('does not duplicate entries', () => {
    const d: ParallelizableTask = { id: 'D', outputFiles: [], dependencies: ['A'], subsystem: 'x' }
    expect(findSequentialDeps([taskA, taskC, d])).toEqual(['A'])
  })
})

describe('canRunInParallel', () => {
  it('returns true for independent tasks', () => {
    expect(canRunInParallel(taskA, taskB)).toBe(true)
  })

  it('returns false when one depends on the other', () => {
    expect(canRunInParallel(taskA, taskC)).toBe(false)
  })

  it('returns false for shared output files', () => {
    const b2: ParallelizableTask = { id: 'B2', outputFiles: ['out/a.ts'], dependencies: [], subsystem: 'other' }
    expect(canRunInParallel(taskA, b2)).toBe(false)
  })

  it('returns false for same subsystem', () => {
    const a2: ParallelizableTask = { id: 'A2', outputFiles: ['out/x.ts'], dependencies: [], subsystem: 'auth' }
    expect(canRunInParallel(taskA, a2)).toBe(false)
  })

  it('allows same empty subsystem', () => {
    const x: ParallelizableTask = { id: 'X', outputFiles: ['x.ts'], dependencies: [], subsystem: '' }
    const y: ParallelizableTask = { id: 'Y', outputFiles: ['y.ts'], dependencies: [], subsystem: '' }
    expect(canRunInParallel(x, y)).toBe(true)
  })
})

describe('analyzeParallelization', () => {
  it('returns canParallelize=false for single task', () => {
    const result = analyzeParallelization([taskA])
    expect(result.canParallelize).toBe(false)
    expect(result.reasons[0]).toContain('Single task')
  })

  it('returns canParallelize=true for independent tasks', () => {
    const result = analyzeParallelization([taskA, taskB])
    expect(result.canParallelize).toBe(true)
  })

  it('returns canParallelize=false for dependent tasks', () => {
    const result = analyzeParallelization([taskA, taskC])
    expect(result.canParallelize).toBe(false)
    expect(result.sharedFiles).toContain('out/a.ts')
    expect(result.sequentialDeps).toContain('A')
  })

  it('returns empty list', () => {
    const result = analyzeParallelization([])
    expect(result.canParallelize).toBe(false)
  })
})
