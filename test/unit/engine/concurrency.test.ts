import { describe, it, expect } from 'vitest'
import { createLimiter, withTimeout } from '../../../src/engine/concurrency.js'

// ---------------------------------------------------------------------------
// createLimiter
// ---------------------------------------------------------------------------

describe('createLimiter', () => {
  it('runs all tasks immediately when max is 0 (unlimited)', async () => {
    const limiter = createLimiter(0)
    const order: number[] = []
    const tasks = [1, 2, 3].map(n =>
      limiter(async () => {
        order.push(n)
        return n
      }),
    )
    const results = await Promise.all(tasks)
    expect(results).toEqual([1, 2, 3])
    expect(order).toEqual([1, 2, 3])
  })

  it('limits concurrency to max value', async () => {
    const limiter = createLimiter(2)
    let running = 0
    let maxRunning = 0

    const createTask = (n: number) =>
      limiter(async () => {
        running++
        maxRunning = Math.max(maxRunning, running)
        // Yield to allow other tasks to start if they can
        await new Promise(r => setTimeout(r, 10))
        running--
        return n
      })

    const results = await Promise.all([
      createTask(1),
      createTask(2),
      createTask(3),
      createTask(4),
      createTask(5),
    ])

    expect(results).toEqual([1, 2, 3, 4, 5])
    expect(maxRunning).toBeLessThanOrEqual(2)
  })

  it('queues excess tasks and runs them as slots free up', async () => {
    const limiter = createLimiter(1)
    const order: string[] = []

    const task = (label: string) =>
      limiter(async () => {
        order.push(`start:${label}`)
        await new Promise(r => setTimeout(r, 5))
        order.push(`end:${label}`)
        return label
      })

    await Promise.all([task('a'), task('b'), task('c')])

    // With concurrency 1, tasks must run sequentially
    expect(order).toEqual([
      'start:a', 'end:a',
      'start:b', 'end:b',
      'start:c', 'end:c',
    ])
  })

  it('propagates rejections from queued tasks', async () => {
    const limiter = createLimiter(1)

    const p1 = limiter(async () => 'ok')
    const p2 = limiter(async () => {
      throw new Error('task failed')
    })

    await expect(p1).resolves.toBe('ok')
    await expect(p2).rejects.toThrow('task failed')
  })

  it('continues processing queue after a rejection', async () => {
    const limiter = createLimiter(1)

    const p1 = limiter(async () => 'first')
    const p2 = limiter(async () => {
      throw new Error('boom')
    })
    const p3 = limiter(async () => 'third')

    await expect(p1).resolves.toBe('first')
    await expect(p2).rejects.toThrow('boom')
    await expect(p3).resolves.toBe('third')
  })

  it('cancel() rejects new tasks submitted after cancellation', async () => {
    const limiter = createLimiter(1)

    const p1 = limiter(async () => 'first')
    await p1 // let first task complete

    limiter.cancel()

    // New tasks after cancel should reject immediately
    await expect(
      limiter(async () => 'should not run'),
    ).rejects.toThrow('cancelled')
  })

  it('cancelled property reflects cancel state', () => {
    const limiter = createLimiter(2)
    expect(limiter.cancelled).toBe(false)
    limiter.cancel()
    expect(limiter.cancelled).toBe(true)
  })

  it('cancel() works on unlimited limiter', async () => {
    const limiter = createLimiter(0)
    limiter.cancel()
    const p = limiter(async () => 'should not run')
    await expect(p).rejects.toThrow('cancelled')
  })
})

// ---------------------------------------------------------------------------
// withTimeout
// ---------------------------------------------------------------------------

describe('withTimeout', () => {
  it('resolves when promise finishes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('done'), 1000, 'test')
    expect(result).toBe('done')
  })

  it('rejects with timeout error when promise exceeds timeout', async () => {
    const slow = new Promise(r => setTimeout(r, 500))
    await expect(
      withTimeout(slow, 10, 'slow-task'),
    ).rejects.toThrow('Task "slow-task" timed out after 10ms')
  })

  it('returns promise directly when timeout is 0 (disabled)', async () => {
    const result = await withTimeout(Promise.resolve('fast'), 0, 'test')
    expect(result).toBe('fast')
  })

  it('propagates original rejection when promise rejects before timeout', async () => {
    const failing = Promise.reject(new Error('original error'))
    await expect(
      withTimeout(failing, 1000, 'test'),
    ).rejects.toThrow('original error')
  })
})
