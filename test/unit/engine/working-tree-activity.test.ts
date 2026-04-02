import { describe, it, expect } from 'vitest'
import { shouldExtendTimeout } from '../../../src/engine/working-tree-activity.js'
import type { ActivityDetectionResult } from '../../../src/contracts/task.js'

describe('shouldExtendTimeout', () => {
  it('returns true when there are uncommitted changes', () => {
    const activity: ActivityDetectionResult = {
      hasUncommittedChanges: true,
      modifiedFiles: 3,
      untrackedFiles: 1,
      isActive: true,
    }
    expect(shouldExtendTimeout(activity)).toBe(true)
  })

  it('returns false when there are no uncommitted changes', () => {
    const activity: ActivityDetectionResult = {
      hasUncommittedChanges: false,
      modifiedFiles: 0,
      untrackedFiles: 0,
      isActive: false,
    }
    expect(shouldExtendTimeout(activity)).toBe(false)
  })

  it('returns true even with only untracked files', () => {
    const activity: ActivityDetectionResult = {
      hasUncommittedChanges: true,
      modifiedFiles: 0,
      untrackedFiles: 5,
      isActive: true,
    }
    expect(shouldExtendTimeout(activity)).toBe(true)
  })

  it('returns true with only modified files', () => {
    const activity: ActivityDetectionResult = {
      hasUncommittedChanges: true,
      modifiedFiles: 2,
      untrackedFiles: 0,
      isActive: true,
    }
    expect(shouldExtendTimeout(activity)).toBe(true)
  })
})
