import { describe, it, expect } from 'vitest'
import { readExecutionConfig } from '../../../src/engine/execution-config.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReader(content: string) {
  return async (_path: string, _enc: BufferEncoding) => content
}

function failReader() {
  return async (_path: string, _enc: BufferEncoding): Promise<string> => {
    throw new Error('ENOENT')
  }
}

// ---------------------------------------------------------------------------
// readExecutionConfig
// ---------------------------------------------------------------------------

describe('readExecutionConfig', () => {
  it('returns defaults when config file does not exist', async () => {
    const config = await readExecutionConfig('/fake', failReader())
    expect(config.maxParallelTasks).toBe(0)
    expect(config.taskTimeoutMs).toBe(120_000)
  })

  it('returns defaults when config has no execution section', async () => {
    const yaml = `project_name: "test"\nlanguage: "en"\n`
    const config = await readExecutionConfig('/fake', mockReader(yaml))
    expect(config.maxParallelTasks).toBe(0)
    expect(config.taskTimeoutMs).toBe(120_000)
  })

  it('reads max_parallel_tasks from execution section', async () => {
    const yaml = [
      'project_name: "test"',
      'execution:',
      '  max_parallel_tasks: 5',
    ].join('\n')
    const config = await readExecutionConfig('/fake', mockReader(yaml))
    expect(config.maxParallelTasks).toBe(5)
  })

  it('reads task_timeout_seconds and converts to ms', async () => {
    const yaml = [
      'execution:',
      '  task_timeout_seconds: 60',
    ].join('\n')
    const config = await readExecutionConfig('/fake', mockReader(yaml))
    expect(config.taskTimeoutMs).toBe(60_000)
  })

  it('reads both values', async () => {
    const yaml = [
      'execution:',
      '  max_parallel_tasks: 3',
      '  task_timeout_seconds: 300',
    ].join('\n')
    const config = await readExecutionConfig('/fake', mockReader(yaml))
    expect(config.maxParallelTasks).toBe(3)
    expect(config.taskTimeoutMs).toBe(300_000)
  })

  it('stops reading execution section at next top-level key', async () => {
    const yaml = [
      'execution:',
      '  max_parallel_tasks: 4',
      'budget:',
      '  per_session_usd: 10.00',
    ].join('\n')
    const config = await readExecutionConfig('/fake', mockReader(yaml))
    expect(config.maxParallelTasks).toBe(4)
  })

  it('ignores invalid values and keeps defaults', async () => {
    const yaml = [
      'execution:',
      '  max_parallel_tasks: abc',
      '  task_timeout_seconds: 0',
    ].join('\n')
    const config = await readExecutionConfig('/fake', mockReader(yaml))
    expect(config.maxParallelTasks).toBe(0)
    expect(config.taskTimeoutMs).toBe(120_000) // 0 seconds keeps default
  })
})
