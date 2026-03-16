import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildIsolatedBranchName,
  formatRatchetCommitMessage,
  shouldCommit,
  decideRatchet,
  buildReviewInstructions,
  createIsolatedBranch,
  getRatchetCommitRef,
  runRatchetCommit,
  runRatchetRevert,
} from '../../../src/optimize/ratchet.js'

// ---------------------------------------------------------------------------
// buildIsolatedBranchName
// ---------------------------------------------------------------------------

describe('buildIsolatedBranchName', () => {
  it('builds branch with expected format', () => {
    const branch = buildIsolatedBranchName('code', 'my-session', '2026-03-16T00-00-00')
    expect(branch).toBe('optimize/code/my-session/2026-03-16t00-00-00')
  })

  it('sanitises spaces to hyphens', () => {
    const branch = buildIsolatedBranchName('code review', 'my session', '2026')
    expect(branch).toBe('optimize/code-review/my-session/2026')
  })

  it('collapses multiple hyphens', () => {
    const branch = buildIsolatedBranchName('code', 'a--b', '2026')
    expect(branch).toBe('optimize/code/a-b/2026')
  })

  it('strips leading and trailing hyphens from components', () => {
    const branch = buildIsolatedBranchName('-code-', '-session-', '-ts-')
    expect(branch).toBe('optimize/code/session/ts')
  })

  it('converts to lowercase', () => {
    const branch = buildIsolatedBranchName('CODE', 'SESSION', 'TS')
    expect(branch).toBe('optimize/code/session/ts')
  })

  it('replaces special characters with hyphens', () => {
    const branch = buildIsolatedBranchName('code/type', 'sess@ion', '2026:01')
    expect(branch).toBe('optimize/code-type/sess-ion/2026-01')
  })
})

// ---------------------------------------------------------------------------
// formatRatchetCommitMessage
// ---------------------------------------------------------------------------

describe('formatRatchetCommitMessage', () => {
  it('formats commit message correctly', () => {
    const msg = formatRatchetCommitMessage(3, 'extracted helper', {
      name: 'test pass rate',
      before: 0.92,
      after: 0.97,
    })
    expect(msg).toBe('optimize(3): extracted helper | test pass rate: 0.92 → 0.97')
  })

  it('formats integer values with two decimal places', () => {
    const msg = formatRatchetCommitMessage(1, 'reduced bundle', {
      name: 'bundle size',
      before: 100,
      after: 85,
    })
    expect(msg).toBe('optimize(1): reduced bundle | bundle size: 100.00 → 85.00')
  })

  it('formats experiment number correctly', () => {
    const msg = formatRatchetCommitMessage(10, 'fix', { name: 'score', before: 1, after: 2 })
    expect(msg).toContain('optimize(10):')
  })

  it('rounds values to 2 decimal places', () => {
    const msg = formatRatchetCommitMessage(1, 'x', { name: 'score', before: 0.1234, after: 0.9876 })
    expect(msg).toContain('0.12 → 0.99')
  })
})

// ---------------------------------------------------------------------------
// shouldCommit
// ---------------------------------------------------------------------------

describe('shouldCommit', () => {
  it('returns true when after is strictly greater', () => {
    expect(shouldCommit(0.9, 0.95)).toBe(true)
  })

  it('returns false when equal', () => {
    expect(shouldCommit(0.9, 0.9)).toBe(false)
  })

  it('returns false when after is less than before', () => {
    expect(shouldCommit(0.9, 0.8)).toBe(false)
  })

  it('returns true for integer improvement', () => {
    expect(shouldCommit(10, 11)).toBe(true)
  })

  it('handles zero baseline', () => {
    expect(shouldCommit(0, 0.01)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// decideRatchet
// ---------------------------------------------------------------------------

describe('decideRatchet', () => {
  it('returns commit with message when metric improves', () => {
    const result = decideRatchet(0.85, 0.90, 2, 'extracted helper', 'test pass rate')
    expect(result.decision).toBe('commit')
    expect(result.commitMessage).toBe(
      'optimize(2): extracted helper | test pass rate: 0.85 → 0.90',
    )
  })

  it('returns revert when metric stays the same', () => {
    const result = decideRatchet(0.85, 0.85, 1, 'no change', 'coverage')
    expect(result.decision).toBe('revert')
    expect(result.commitMessage).toBeUndefined()
  })

  it('returns revert when metric worsens', () => {
    const result = decideRatchet(0.85, 0.80, 1, 'regression', 'score')
    expect(result.decision).toBe('revert')
    expect(result.commitMessage).toBeUndefined()
  })

  it('includes experiment number in commit message', () => {
    const result = decideRatchet(1, 2, 5, 'improved', 'score')
    expect(result.commitMessage).toContain('optimize(5):')
  })

  it('includes metric name in commit message', () => {
    const result = decideRatchet(1, 2, 1, 'improved', 'bundle size')
    expect(result.commitMessage).toContain('bundle size')
  })
})

// ---------------------------------------------------------------------------
// buildReviewInstructions
// ---------------------------------------------------------------------------

describe('buildReviewInstructions', () => {
  it('contains branch name', () => {
    const instructions = buildReviewInstructions('optimize/code/session/2026')
    expect(instructions).toContain('optimize/code/session/2026')
  })

  it('defaults to main branch', () => {
    const instructions = buildReviewInstructions('optimize/code/session/2026')
    expect(instructions).toContain('`main`')
  })

  it('uses provided main branch', () => {
    const instructions = buildReviewInstructions('optimize/code/session/2026', 'develop')
    expect(instructions).toContain('`develop`')
  })

  it('contains human review warning', () => {
    const instructions = buildReviewInstructions('optimize/code/session/2026')
    expect(instructions).toContain('Human review is required')
  })

  it('contains no auto-merge instruction', () => {
    const instructions = buildReviewInstructions('optimize/code/session/2026')
    expect(instructions).toContain('do not auto-merge')
  })

  it('starts with h1 heading', () => {
    const instructions = buildReviewInstructions('optimize/code/session/2026')
    expect(instructions).toMatch(/^# AutoResearch Merge Review/)
  })
})

// ---------------------------------------------------------------------------
// createIsolatedBranch
// ---------------------------------------------------------------------------

describe('createIsolatedBranch', () => {
  it('returns ok with branch name on success', () => {
    const execFn = vi.fn().mockReturnValue('')
    const result = createIsolatedBranch('optimize/code/sess/2026', '/project', execFn)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('optimize/code/sess/2026')
  })

  it('calls git checkout -b with branch name', () => {
    const execFn = vi.fn().mockReturnValue('')
    createIsolatedBranch('optimize/code/sess/2026', '/project', execFn)
    expect(execFn).toHaveBeenCalledWith(
      expect.stringContaining('git checkout -b'),
      expect.objectContaining({ cwd: '/project' }),
    )
  })

  it('returns err on git failure', () => {
    const execFn = vi.fn().mockImplementation(() => {
      throw new Error('branch already exists')
    })
    const result = createIsolatedBranch('optimize/code/sess/2026', '/project', execFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RATCHET_BRANCH_FAILED')
  })

  it('includes branch name in error params', () => {
    const execFn = vi.fn().mockImplementation(() => {
      throw new Error('failure')
    })
    const result = createIsolatedBranch('optimize/code/sess/2026', '/project', execFn)
    if (!result.ok) expect(result.error.params?.['branch']).toBe('optimize/code/sess/2026')
  })
})

// ---------------------------------------------------------------------------
// getRatchetCommitRef
// ---------------------------------------------------------------------------

describe('getRatchetCommitRef', () => {
  it('returns trimmed HEAD ref on success', () => {
    const execFn = vi.fn().mockReturnValue('abc123\n')
    const result = getRatchetCommitRef('/project', execFn)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('abc123')
  })

  it('calls git rev-parse HEAD', () => {
    const execFn = vi.fn().mockReturnValue('abc123\n')
    getRatchetCommitRef('/project', execFn)
    expect(execFn).toHaveBeenCalledWith(
      'git rev-parse HEAD',
      expect.objectContaining({ cwd: '/project' }),
    )
  })

  it('returns err on git failure', () => {
    const execFn = vi.fn().mockImplementation(() => {
      throw new Error('not a git repo')
    })
    const result = getRatchetCommitRef('/project', execFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RATCHET_COMMIT_FAILED')
  })
})

// ---------------------------------------------------------------------------
// runRatchetCommit
// ---------------------------------------------------------------------------

describe('runRatchetCommit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns new HEAD ref on success', () => {
    const execFn = vi
      .fn()
      .mockReturnValueOnce('') // git add -A
      .mockReturnValueOnce('') // git commit
      .mockReturnValueOnce('deadbeef\n') // git rev-parse HEAD
    const result = runRatchetCommit('optimize(1): improved | score: 0.85 → 0.90', '/project', execFn)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('deadbeef')
  })

  it('runs git add -A before commit', () => {
    const execFn = vi
      .fn()
      .mockReturnValueOnce('')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('abc\n')
    runRatchetCommit('msg', '/project', execFn)
    expect(execFn).toHaveBeenNthCalledWith(
      1,
      'git add -A',
      expect.objectContaining({ cwd: '/project' }),
    )
  })

  it('passes commit message to git commit', () => {
    const execFn = vi
      .fn()
      .mockReturnValueOnce('')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('abc\n')
    runRatchetCommit('optimize(1): test', '/project', execFn)
    expect(execFn).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('optimize(1): test'),
      expect.objectContaining({ cwd: '/project' }),
    )
  })

  it('returns err on git add failure', () => {
    const execFn = vi.fn().mockImplementation(() => {
      throw new Error('staging failed')
    })
    const result = runRatchetCommit('msg', '/project', execFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RATCHET_COMMIT_FAILED')
  })

  it('returns err on git commit failure', () => {
    const execFn = vi
      .fn()
      .mockReturnValueOnce('') // git add succeeds
      .mockImplementationOnce(() => { throw new Error('commit failed') })
    const result = runRatchetCommit('msg', '/project', execFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RATCHET_COMMIT_FAILED')
  })
})

// ---------------------------------------------------------------------------
// runRatchetRevert
// ---------------------------------------------------------------------------

describe('runRatchetRevert', () => {
  it('returns ok with commitRef on success', () => {
    const execFn = vi.fn().mockReturnValue('')
    const result = runRatchetRevert('abc123', '/project', execFn)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('abc123')
  })

  it('calls git reset --hard with commit ref', () => {
    const execFn = vi.fn().mockReturnValue('')
    runRatchetRevert('abc123', '/project', execFn)
    expect(execFn).toHaveBeenCalledWith(
      expect.stringContaining('git reset --hard'),
      expect.objectContaining({ cwd: '/project' }),
    )
  })

  it('includes commit ref in git command', () => {
    const execFn = vi.fn().mockReturnValue('')
    runRatchetRevert('deadbeef', '/project', execFn)
    expect(execFn).toHaveBeenCalledWith(
      expect.stringContaining('deadbeef'),
      expect.any(Object),
    )
  })

  it('returns err on git failure', () => {
    const execFn = vi.fn().mockImplementation(() => {
      throw new Error('reset failed')
    })
    const result = runRatchetRevert('abc123', '/project', execFn)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('RATCHET_REVERT_FAILED')
  })

  it('includes commitRef in error params', () => {
    const execFn = vi.fn().mockImplementation(() => {
      throw new Error('failure')
    })
    const result = runRatchetRevert('abc123', '/project', execFn)
    if (!result.ok) expect(result.error.params?.['ref']).toBe('abc123')
  })
})
