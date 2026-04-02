import { describe, it, expect } from 'vitest'
import {
  createGotcha,
  matchGotchas,
  formatGotchaWarning,
  formatGotchasForContext,
} from '../../../src/engine/gotcha-registry.js'
import type { Gotcha } from '../../../src/contracts/task.js'

describe('createGotcha', () => {
  it('creates a gotcha with auto-generated ID starting with GOT-', () => {
    const g = createGotcha('trigger', 'consequence', 'workaround', 'task-1', ['src/a.ts'], 'critical')
    expect(g.id).toMatch(/^GOT-/)
    expect(g.trigger).toBe('trigger')
    expect(g.consequence).toBe('consequence')
    expect(g.workaround).toBe('workaround')
    expect(g.discoveredIn).toBe('task-1')
    expect(g.affectedFiles).toEqual(['src/a.ts'])
    expect(g.severity).toBe('critical')
  })

  it('generates unique IDs for different calls', () => {
    const a = createGotcha('a', 'a', 'a', 'task-1', [], 'annoying')
    const b = createGotcha('b', 'b', 'b', 'task-2', [], 'annoying')
    expect(a.id).not.toBe(b.id)
  })
})

describe('matchGotchas', () => {
  const gotchas: Gotcha[] = [
    createGotcha('t1', 'c1', 'w1', 'd1', ['src/engine/foo.ts'], 'critical'),
    createGotcha('t2', 'c2', 'w2', 'd2', ['src/data/bar.ts'], 'annoying'),
    createGotcha('t3', 'c3', 'w3', 'd3', ['src/engine/baz.ts', 'src/util.ts'], 'critical'),
  ]

  it('finds gotchas where affected file is substring of filePath', () => {
    const matches = matchGotchas(gotchas, 'src/engine/foo.ts')
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches.some(g => g.trigger === 't1')).toBe(true)
  })

  it('returns empty for unrelated path', () => {
    expect(matchGotchas(gotchas, 'unrelated/path.ts')).toHaveLength(0)
  })

  it('matches when filePath is substring of affectedFile', () => {
    const matches = matchGotchas(gotchas, 'src/engine')
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
})

describe('formatGotchaWarning', () => {
  it('uses CRITICAL for critical severity', () => {
    const g = createGotcha('bad import', 'crash', 'fix it', 'task-1', ['a.ts'], 'critical')
    const output = formatGotchaWarning(g)
    expect(output).toContain('[CRITICAL]')
    expect(output).toContain('bad import')
    expect(output).toContain('Consequence: crash')
    expect(output).toContain('Workaround: fix it')
  })

  it('uses WARNING for annoying severity', () => {
    const g = createGotcha('slow', 'lag', 'cache', 'task-1', ['b.ts'], 'annoying')
    const output = formatGotchaWarning(g)
    expect(output).toContain('[WARNING]')
  })
})

describe('formatGotchasForContext', () => {
  it('returns empty string for no gotchas', () => {
    expect(formatGotchasForContext([])).toBe('')
  })

  it('includes header with count', () => {
    const gotchas = [createGotcha('t', 'c', 'w', 'd', ['a.ts'], 'critical')]
    const output = formatGotchasForContext(gotchas)
    expect(output).toContain('## Known Gotchas (1)')
  })

  it('includes all gotcha warnings', () => {
    const gotchas = [
      createGotcha('t1', 'c1', 'w1', 'd1', ['a.ts'], 'critical'),
      createGotcha('t2', 'c2', 'w2', 'd2', ['b.ts'], 'annoying'),
    ]
    const output = formatGotchasForContext(gotchas)
    expect(output).toContain('t1')
    expect(output).toContain('t2')
  })
})
