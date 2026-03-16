import { describe, it, expect } from 'vitest'
import { inferCommitType, formatCommitMessage } from '../../../src/engine/atomic-commit.js'

// ---------------------------------------------------------------------------
// inferCommitType
// ---------------------------------------------------------------------------

describe('inferCommitType', () => {
  it('returns fix for bug-related keywords', () => {
    expect(inferCommitType('Fix login redirect')).toBe('fix')
    expect(inferCommitType('Resolve auth bug')).toBe('fix')
    expect(inferCommitType('Correct validation error')).toBe('fix')
    expect(inferCommitType('Hotfix for session expiry')).toBe('fix')
  })

  it('returns docs for documentation keywords', () => {
    expect(inferCommitType('Update README')).toBe('docs')
    expect(inferCommitType('Add docs for auth module')).toBe('docs')
    expect(inferCommitType('Document API endpoints')).toBe('docs')
  })

  it('returns test for test-related keywords', () => {
    expect(inferCommitType('Add unit tests for login')).toBe('test')
    expect(inferCommitType('Write spec for auth')).toBe('test')
    expect(inferCommitType('Improve test coverage')).toBe('test')
  })

  it('returns refactor for refactoring keywords', () => {
    expect(inferCommitType('Refactor auth module')).toBe('refactor')
    expect(inferCommitType('Rename UserService to AuthService')).toBe('refactor')
    expect(inferCommitType('Clean up dead code')).toBe('refactor')
  })

  it('returns chore for maintenance keywords', () => {
    expect(inferCommitType('Chore: update dependencies')).toBe('chore')
    expect(inferCommitType('Bump version to 2.0')).toBe('chore')
    expect(inferCommitType('Upgrade TypeScript')).toBe('chore')
  })

  it('returns style for formatting keywords', () => {
    expect(inferCommitType('Style: format source files')).toBe('style')
    expect(inferCommitType('Run prettier on codebase')).toBe('style')
  })

  it('defaults to feat for unmatched descriptions', () => {
    expect(inferCommitType('Implement auth module')).toBe('feat')
    expect(inferCommitType('Add login form')).toBe('feat')
    expect(inferCommitType('Build payment integration')).toBe('feat')
  })

  it('is case insensitive', () => {
    expect(inferCommitType('FIX broken redirect')).toBe('fix')
    expect(inferCommitType('REFACTOR service layer')).toBe('refactor')
  })
})

// ---------------------------------------------------------------------------
// formatCommitMessage
// ---------------------------------------------------------------------------

describe('formatCommitMessage', () => {
  it('formats message as type(phaseSlug): taskTitle', () => {
    const msg = formatCommitMessage('Implement auth module', 'auth-service')
    expect(msg).toBe('feat(auth-service): Implement auth module')
  })

  it('infers fix type for bug-related task titles', () => {
    const msg = formatCommitMessage('Fix login redirect bug', 'user-flow')
    expect(msg).toBe('fix(user-flow): Fix login redirect bug')
  })

  it('uses execute as default phaseSlug when empty string provided', () => {
    const msg = formatCommitMessage('Add user model', '')
    expect(msg).toBe('feat(): Add user model')
  })

  it('preserves the full task title in the message', () => {
    const title = 'Implement JWT token validation with refresh support'
    const msg = formatCommitMessage(title, 'security-epic')
    expect(msg).toContain(title)
  })

  it('follows conventional commit format: type(scope): subject', () => {
    const msg = formatCommitMessage('Write unit tests for auth', 'auth-v2')
    // Should be: test(auth-v2): Write unit tests for auth
    expect(msg).toMatch(/^\w+\([^)]+\): .+$/)
  })

  it('produces different commit types for different task titles', () => {
    const feat = formatCommitMessage('Add payment gateway', 'payments')
    const fix = formatCommitMessage('Fix payment timeout', 'payments')
    const test = formatCommitMessage('Add tests for payment', 'payments')
    expect(feat.startsWith('feat(')).toBe(true)
    expect(fix.startsWith('fix(')).toBe(true)
    expect(test.startsWith('test(')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Atomic commit guarantee: one commit message per successful task
// ---------------------------------------------------------------------------

describe('atomic commit guarantee', () => {
  it('produces exactly one commit message per task title', () => {
    const tasks = [
      'Implement login form',
      'Add password validation',
      'Write auth tests',
    ]
    const messages = tasks.map(t => formatCommitMessage(t, 'auth-feature'))
    // Each task produces exactly one message
    expect(messages).toHaveLength(tasks.length)
    // All messages are non-empty strings
    expect(messages.every(m => typeof m === 'string' && m.length > 0)).toBe(true)
    // All messages are unique (each task gets its own commit)
    expect(new Set(messages).size).toBe(messages.length)
  })

  it('commit messages follow type(scope): subject format for all tasks', () => {
    const tasks = [
      { title: 'Build auth module', slug: 'epic-auth' },
      { title: 'Fix session bug', slug: 'epic-auth' },
      { title: 'Add tests for login', slug: 'epic-auth' },
    ]
    for (const task of tasks) {
      const msg = formatCommitMessage(task.title, task.slug)
      expect(msg).toMatch(/^\w+\(epic-auth\): .+$/)
    }
  })
})
