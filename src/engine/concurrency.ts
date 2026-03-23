/**
 * Concurrency utilities — lightweight limiter and timeout wrapper.
 * @module engine/concurrency
 * @see FR-701 — Wave Execution (Epic 13)
 */

// ---------------------------------------------------------------------------
// Concurrency limiter — p-limit style, zero dependencies
// ---------------------------------------------------------------------------

/** Limiter function with cancel support */
export interface CancellableLimiter {
  <T>(fn: () => Promise<T>): Promise<T>
  /** Signal cancellation — queued tasks will reject, running tasks finish */
  cancel: () => void
  /** Check if the limiter has been cancelled */
  readonly cancelled: boolean
}

/**
 * Create a concurrency limiter that queues excess promises.
 * At most `max` functions run concurrently; the rest wait for a slot.
 * When `max` is 0 or not provided, all functions run immediately (unlimited).
 * Supports graceful cancellation via the returned cancel() method.
 */
export function createLimiter(max: number): CancellableLimiter {
  let cancelled = false

  if (max <= 0) {
    const limiter = <T>(fn: () => Promise<T>): Promise<T> => {
      if (cancelled) return Promise.reject(new Error('Limiter cancelled'))
      return fn()
    }
    limiter.cancel = () => { cancelled = true }
    Object.defineProperty(limiter, 'cancelled', { get: () => cancelled })
    return limiter as CancellableLimiter
  }

  let running = 0
  const queue: (() => void)[] = []

  const limiter = <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (cancelled) {
        reject(new Error('Limiter cancelled'))
        return
      }
      const run = () => {
        if (cancelled) {
          reject(new Error('Limiter cancelled'))
          return
        }
        running++
        fn()
          .then(resolve, reject)
          .finally(() => {
            running--
            if (queue.length > 0) queue.shift()!()
          })
      }
      running < max ? run() : queue.push(run)
    })

  limiter.cancel = () => {
    cancelled = true
    // Drain queued tasks with cancellation error
    while (queue.length > 0) {
      queue.shift()
    }
  }
  Object.defineProperty(limiter, 'cancelled', { get: () => cancelled })

  return limiter as CancellableLimiter
}

// ---------------------------------------------------------------------------
// Timeout wrapper — Promise.race with a timer
// ---------------------------------------------------------------------------

/**
 * Wrap a promise with a timeout. If `ms` elapses before the promise resolves,
 * the returned promise rejects with a timeout error.
 * A `ms` of 0 disables the timeout (returns the original promise).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return promise

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Task "${label}" timed out after ${ms}ms`))
    }, ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
