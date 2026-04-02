import { describe, it, expect } from 'vitest'
import {
  validateStoryIndependence,
  detectParallelMarkers,
  hasCyclicDependencies,
} from '../../../src/engine/story-slicing.js'
import type { StorySlice } from '../../../src/engine/story-slicing.js'

describe('validateStoryIndependence', () => {
  it('passes when P1 stories are independent', () => {
    const slices: StorySlice[] = [
      { storyId: 'S1', priority: 1, tasks: ['t1'], isIndependent: true, dependencies: [] },
      { storyId: 'S2', priority: 2, tasks: ['t2'], isIndependent: false, dependencies: ['S1'] },
    ]
    const result = validateStoryIndependence(slices)
    expect(result.ok).toBe(true)
  })

  it('fails when P1 has dependencies', () => {
    const slices: StorySlice[] = [
      { storyId: 'S1', priority: 1, tasks: ['t1'], isIndependent: true, dependencies: ['S0'] },
    ]
    const result = validateStoryIndependence(slices)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('REASSESSMENT_PLAN_INVALIDATED')
  })

  it('fails when P1 is marked not independent', () => {
    const slices: StorySlice[] = [
      { storyId: 'S1', priority: 1, tasks: ['t1'], isIndependent: false, dependencies: [] },
    ]
    const result = validateStoryIndependence(slices)
    expect(result.ok).toBe(false)
  })

  it('passes with empty slices', () => {
    expect(validateStoryIndependence([]).ok).toBe(true)
  })

  it('ignores non-P1 dependency violations', () => {
    const slices: StorySlice[] = [
      { storyId: 'S1', priority: 2, tasks: ['t1'], isIndependent: false, dependencies: ['S0'] },
    ]
    expect(validateStoryIndependence(slices).ok).toBe(true)
  })
})

describe('detectParallelMarkers', () => {
  it('detects [P] markers in plan content', () => {
    const content = '[P] Build auth module\n[P] Build billing module\nRegular task'
    const markers = detectParallelMarkers(content)
    expect(markers).toEqual(['Build auth module', 'Build billing module'])
  })

  it('returns empty for no markers', () => {
    expect(detectParallelMarkers('No markers here.')).toEqual([])
  })

  it('trims whitespace from marker text', () => {
    const markers = detectParallelMarkers('[P]   spaced text  ')
    expect(markers).toEqual(['spaced text'])
  })
})

describe('hasCyclicDependencies', () => {
  it('returns false for acyclic graph', () => {
    const slices: StorySlice[] = [
      { storyId: 'A', priority: 1, tasks: [], isIndependent: true, dependencies: [] },
      { storyId: 'B', priority: 2, tasks: [], isIndependent: false, dependencies: ['A'] },
    ]
    expect(hasCyclicDependencies(slices)).toBe(false)
  })

  it('detects direct cycle', () => {
    const slices: StorySlice[] = [
      { storyId: 'A', priority: 1, tasks: [], isIndependent: true, dependencies: ['B'] },
      { storyId: 'B', priority: 2, tasks: [], isIndependent: false, dependencies: ['A'] },
    ]
    expect(hasCyclicDependencies(slices)).toBe(true)
  })

  it('detects indirect cycle', () => {
    const slices: StorySlice[] = [
      { storyId: 'A', priority: 1, tasks: [], isIndependent: true, dependencies: ['C'] },
      { storyId: 'B', priority: 2, tasks: [], isIndependent: false, dependencies: ['A'] },
      { storyId: 'C', priority: 3, tasks: [], isIndependent: false, dependencies: ['B'] },
    ]
    expect(hasCyclicDependencies(slices)).toBe(true)
  })

  it('returns false for empty slices', () => {
    expect(hasCyclicDependencies([])).toBe(false)
  })

  it('ignores deps on non-existent stories', () => {
    const slices: StorySlice[] = [
      { storyId: 'A', priority: 1, tasks: [], isIndependent: true, dependencies: ['X'] },
    ]
    expect(hasCyclicDependencies(slices)).toBe(false)
  })
})
