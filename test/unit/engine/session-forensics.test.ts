import { describe, it, expect } from 'vitest'
import {
  createEmptyTrace,
  addToolCall,
  reconstructTrace,
  generateRecoveryBriefing,
} from '../../../src/engine/session-forensics.js'

describe('createEmptyTrace', () => {
  it('creates empty trace with zero counts', () => {
    const trace = createEmptyTrace()
    expect(trace.toolCalls).toEqual([])
    expect(trace.filesWritten).toEqual([])
    expect(trace.filesRead).toEqual([])
    expect(trace.commandsRun).toEqual([])
    expect(trace.errors).toEqual([])
    expect(trace.toolCallCount).toBe(0)
  })
})

describe('addToolCall', () => {
  it('tracks files written by Write tool', () => {
    const trace = createEmptyTrace()
    const updated = addToolCall(trace, { name: 'Write', input: { file_path: '/tmp/a.ts' }, isError: false })
    expect(updated.filesWritten).toContain('/tmp/a.ts')
    expect(updated.toolCallCount).toBe(1)
  })

  it('tracks files written by Edit tool', () => {
    const trace = createEmptyTrace()
    const updated = addToolCall(trace, { name: 'Edit', input: { file_path: '/tmp/b.ts' }, isError: false })
    expect(updated.filesWritten).toContain('/tmp/b.ts')
  })

  it('tracks files read by Read tool', () => {
    const trace = createEmptyTrace()
    const updated = addToolCall(trace, { name: 'Read', input: { file_path: '/tmp/c.ts' }, isError: false })
    expect(updated.filesRead).toContain('/tmp/c.ts')
  })

  it('tracks commands from Bash tool', () => {
    const trace = createEmptyTrace()
    const updated = addToolCall(trace, { name: 'Bash', input: { command: 'npm test' }, isError: false })
    expect(updated.commandsRun).toContain('npm test')
  })

  it('tracks errors', () => {
    const trace = createEmptyTrace()
    const updated = addToolCall(trace, { name: 'Bash', input: { command: 'fail' }, result: 'exit 1', isError: true })
    expect(updated.errors).toHaveLength(1)
    expect(updated.errors[0]).toContain('Bash')
  })

  it('deduplicates written files', () => {
    let trace = createEmptyTrace()
    trace = addToolCall(trace, { name: 'Write', input: { file_path: '/tmp/a.ts' }, isError: false })
    trace = addToolCall(trace, { name: 'Write', input: { file_path: '/tmp/a.ts' }, isError: false })
    expect(trace.filesWritten).toEqual(['/tmp/a.ts'])
  })
})

describe('reconstructTrace', () => {
  it('returns error on empty audit lines', () => {
    const result = reconstructTrace([])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORENSICS_NO_AUDIT_DATA')
  })

  it('reconstructs trace from valid audit lines', () => {
    const lines = [
      JSON.stringify({ action: 'tool.Write', files: ['src/a.ts'], outcome: 'success' }),
      JSON.stringify({ action: 'tool.Bash', outcome: 'failure', error: 'exit 1' }),
    ]
    const result = reconstructTrace(lines)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.toolCallCount).toBe(2)
      expect(result.value.filesWritten).toContain('src/a.ts')
      expect(result.value.errors).toHaveLength(1)
    }
  })

  it('skips malformed JSON lines', () => {
    const lines = ['not json', JSON.stringify({ action: 'tool.Read', outcome: 'success' })]
    const result = reconstructTrace(lines)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.toolCallCount).toBe(1)
  })
})

describe('generateRecoveryBriefing', () => {
  it('includes errors in prompt', () => {
    let trace = createEmptyTrace()
    trace = addToolCall(trace, { name: 'Bash', input: { command: 'npm test' }, result: 'FAIL', isError: true })
    const briefing = generateRecoveryBriefing('task', 'task-1', trace)
    expect(briefing.prompt).toContain('Errors encountered')
    expect(briefing.prompt).toContain('Bash')
  })

  it('includes files written in prompt', () => {
    let trace = createEmptyTrace()
    trace = addToolCall(trace, { name: 'Write', input: { file_path: '/tmp/out.ts' }, isError: false })
    const briefing = generateRecoveryBriefing('task', 'task-2', trace)
    expect(briefing.prompt).toContain('/tmp/out.ts')
  })

  it('includes commands in prompt', () => {
    let trace = createEmptyTrace()
    trace = addToolCall(trace, { name: 'Bash', input: { command: 'npm run build' }, isError: false })
    const briefing = generateRecoveryBriefing('task', 'task-3', trace)
    expect(briefing.prompt).toContain('npm run build')
  })

  it('sets unitType and unitId on briefing', () => {
    const briefing = generateRecoveryBriefing('wave', 'wave-2', createEmptyTrace())
    expect(briefing.unitType).toBe('wave')
    expect(briefing.unitId).toBe('wave-2')
  })
})
