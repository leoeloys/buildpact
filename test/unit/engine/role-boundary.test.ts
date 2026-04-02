import { describe, it, expect } from 'vitest'
import {
  matchesPattern,
  checkRoleBoundary,
  getBoundaryForRole,
  createViolationRecord,
  ORCHESTRATOR_BOUNDARY,
  DEVELOPER_BOUNDARY,
  REVIEWER_BOUNDARY,
  BUILT_IN_BOUNDARIES,
} from '../../../src/engine/role-boundary.js'
import type { RoleBoundary, ActionPattern } from '../../../src/contracts/task.js'

describe('matchesPattern', () => {
  it('matches a tool_call pattern', () => {
    expect(matchesPattern('tool_call', 'Write', '^(Write|Edit)$')).toBe(true)
  })

  it('rejects non-matching tool_call', () => {
    expect(matchesPattern('tool_call', 'Read', '^(Write|Edit)$')).toBe(false)
  })

  it('matches file_operation pattern', () => {
    expect(matchesPattern('file_operation', 'src/engine/foo.ts', 'src/.*\\.ts$')).toBe(true)
  })

  it('rejects non-matching file path', () => {
    expect(matchesPattern('file_operation', 'docs/README.md', 'src/.*\\.ts$')).toBe(false)
  })

  it('matches output_pattern', () => {
    expect(matchesPattern('output_pattern', '```typescript\nconst x = 1', '```(typescript|javascript)')).toBe(true)
  })

  it('returns false for invalid regex', () => {
    expect(matchesPattern('tool_call', 'Write', '[[invalid')).toBe(false)
  })
})

describe('checkRoleBoundary', () => {
  it('allows orchestrator to use Agent tool', () => {
    const result = checkRoleBoundary(ORCHESTRATOR_BOUNDARY, { toolName: 'Agent' })
    expect(result.ok).toBe(true)
  })

  it('blocks orchestrator from using Write tool', () => {
    const result = checkRoleBoundary(ORCHESTRATOR_BOUNDARY, { toolName: 'Write' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ROLE_BOUNDARY_VIOLATION')
    }
  })

  it('blocks orchestrator from using Bash tool', () => {
    const result = checkRoleBoundary(ORCHESTRATOR_BOUNDARY, { toolName: 'Bash' })
    expect(result.ok).toBe(false)
  })

  it('blocks orchestrator from modifying source files', () => {
    const result = checkRoleBoundary(ORCHESTRATOR_BOUNDARY, { filePath: 'src/engine/foo.ts' })
    expect(result.ok).toBe(false)
  })

  it('blocks orchestrator from generating code blocks', () => {
    const result = checkRoleBoundary(ORCHESTRATOR_BOUNDARY, { outputContent: '```typescript\nconst x = 1' })
    expect(result.ok).toBe(false)
  })

  it('allows developer to use Write tool', () => {
    const result = checkRoleBoundary(DEVELOPER_BOUNDARY, { toolName: 'Write' })
    expect(result.ok).toBe(true)
  })

  it('blocks developer from using Agent tool', () => {
    const result = checkRoleBoundary(DEVELOPER_BOUNDARY, { toolName: 'Agent' })
    expect(result.ok).toBe(false)
  })

  it('blocks developer from modifying constitution', () => {
    const result = checkRoleBoundary(DEVELOPER_BOUNDARY, { filePath: 'constitution.md' })
    expect(result.ok).toBe(false)
  })

  it('allows reviewer to use Read tool', () => {
    const result = checkRoleBoundary(REVIEWER_BOUNDARY, { toolName: 'Read' })
    expect(result.ok).toBe(true)
  })

  it('blocks reviewer from using Write tool', () => {
    const result = checkRoleBoundary(REVIEWER_BOUNDARY, { toolName: 'Write' })
    expect(result.ok).toBe(false)
  })

  it('rejects unlisted tool for role with allowedActions', () => {
    const result = checkRoleBoundary(ORCHESTRATOR_BOUNDARY, { toolName: 'UnknownTool' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ROLE_BLOCKED_TOOL_CALL')
    }
  })
})

describe('getBoundaryForRole', () => {
  it('returns orchestrator boundary', () => {
    expect(getBoundaryForRole('orchestrator')).toBe(ORCHESTRATOR_BOUNDARY)
  })

  it('returns developer boundary', () => {
    expect(getBoundaryForRole('developer')).toBe(DEVELOPER_BOUNDARY)
  })

  it('returns reviewer boundary', () => {
    expect(getBoundaryForRole('reviewer')).toBe(REVIEWER_BOUNDARY)
  })

  it('returns undefined for unknown role', () => {
    expect(getBoundaryForRole('wizard')).toBeUndefined()
  })
})

describe('createViolationRecord', () => {
  it('creates a violation record with timestamp', () => {
    const pattern: ActionPattern = { type: 'tool_call', pattern: '^Write$', description: 'Cannot write' }
    const record = createViolationRecord(
      ORCHESTRATOR_BOUNDARY,
      { toolName: 'Write' },
      pattern,
    )

    expect(record.agentRole).toBe('orchestrator')
    expect(record.attemptedAction).toBe('Write')
    expect(record.matchedPattern).toBe(pattern)
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('uses filePath when toolName is absent', () => {
    const pattern: ActionPattern = { type: 'file_operation', pattern: 'src/', description: 'No source' }
    const record = createViolationRecord(
      ORCHESTRATOR_BOUNDARY,
      { filePath: 'src/foo.ts' },
      pattern,
    )
    expect(record.attemptedAction).toBe('src/foo.ts')
  })
})

describe('BUILT_IN_BOUNDARIES', () => {
  it('has exactly 3 built-in roles', () => {
    expect(Object.keys(BUILT_IN_BOUNDARIES)).toEqual(['orchestrator', 'developer', 'reviewer'])
  })
})
