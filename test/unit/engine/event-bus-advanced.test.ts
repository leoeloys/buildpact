import { describe, it, expect } from 'vitest'
import {
  PriorityQueue,
  AdvancedEventBus,
  type AdvancedMessage,
  type MessagePriority,
} from '../../../src/engine/event-bus-advanced.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let msgCounter = 0

function makeMessage(overrides: Partial<AdvancedMessage> = {}): AdvancedMessage {
  msgCounter++
  return {
    id: `msg-${msgCounter}`,
    from: 'test-agent',
    type: 'test',
    topic: 'default',
    payload: null,
    timestamp: new Date().toISOString(),
    priority: 'normal',
    ...overrides,
  }
}

function makeExpiredMessage(overrides: Partial<AdvancedMessage> = {}): AdvancedMessage {
  return makeMessage({
    timestamp: new Date(Date.now() - 10_000).toISOString(),
    ttl: 1, // 1ms TTL, created 10s ago — definitely expired
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// PriorityQueue
// ---------------------------------------------------------------------------

describe('PriorityQueue', () => {
  it('dequeues critical before low', () => {
    const q = new PriorityQueue()

    q.enqueue(makeMessage({ id: 'low', priority: 'low' }))
    q.enqueue(makeMessage({ id: 'critical', priority: 'critical' }))
    q.enqueue(makeMessage({ id: 'normal', priority: 'normal' }))

    expect(q.dequeue()?.id).toBe('critical')
    expect(q.dequeue()?.id).toBe('normal')
    expect(q.dequeue()?.id).toBe('low')
  })

  it('preserves FIFO within same priority', () => {
    const q = new PriorityQueue()

    q.enqueue(makeMessage({ id: 'a', priority: 'high' }))
    q.enqueue(makeMessage({ id: 'b', priority: 'high' }))
    q.enqueue(makeMessage({ id: 'c', priority: 'high' }))

    expect(q.dequeue()?.id).toBe('a')
    expect(q.dequeue()?.id).toBe('b')
    expect(q.dequeue()?.id).toBe('c')
  })

  it('skips expired messages on dequeue', () => {
    const q = new PriorityQueue()
    const expired: AdvancedMessage[] = []

    q.enqueue(makeExpiredMessage({ id: 'expired-1', priority: 'critical' }))
    q.enqueue(makeMessage({ id: 'valid', priority: 'low' }))
    q.enqueue(makeExpiredMessage({ id: 'expired-2', priority: 'high' }))

    const result = q.dequeue(msg => expired.push(msg))
    expect(result?.id).toBe('valid')
    expect(expired).toHaveLength(2)
    expect(expired[0]?.id).toBe('expired-1')
    expect(expired[1]?.id).toBe('expired-2')
  })

  it('returns undefined when all messages are expired', () => {
    const q = new PriorityQueue()

    q.enqueue(makeExpiredMessage({ id: 'e1' }))
    q.enqueue(makeExpiredMessage({ id: 'e2' }))

    expect(q.dequeue(() => {})).toBeUndefined()
    expect(q.size).toBe(0)
  })

  it('returns undefined when empty', () => {
    const q = new PriorityQueue()
    expect(q.dequeue()).toBeUndefined()
  })

  it('messages without TTL never expire', () => {
    const q = new PriorityQueue()
    // Timestamp far in the past, but no TTL
    q.enqueue(makeMessage({
      id: 'no-ttl',
      timestamp: new Date(Date.now() - 999_999_999).toISOString(),
    }))

    expect(q.dequeue()?.id).toBe('no-ttl')
  })

  it('mixed priorities dequeue correctly', () => {
    const q = new PriorityQueue()
    const priorities: MessagePriority[] = ['low', 'high', 'normal', 'critical', 'low', 'high']
    for (const [i, p] of priorities.entries()) {
      q.enqueue(makeMessage({ id: `m${i}`, priority: p }))
    }

    const order: string[] = []
    let msg: AdvancedMessage | undefined
    while ((msg = q.dequeue())) {
      order.push(msg.id)
    }

    // critical, high, high, normal, low, low
    expect(order).toEqual(['m3', 'm1', 'm5', 'm2', 'm0', 'm4'])
  })
})

// ---------------------------------------------------------------------------
// AdvancedEventBus
// ---------------------------------------------------------------------------

describe('AdvancedEventBus', () => {
  it('delivers topic messages to subscribers', () => {
    const bus = new AdvancedEventBus()
    const received: AdvancedMessage[] = []

    bus.subscribe('build', msg => received.push(msg))
    bus.publish(makeMessage({ topic: 'build' }))
    bus.flush()

    expect(received).toHaveLength(1)
    expect(received[0]?.topic).toBe('build')
  })

  it('delivers direct messages to registered agent', () => {
    const bus = new AdvancedEventBus()
    const received: AdvancedMessage[] = []

    bus.registerAgent('architect', msg => received.push(msg))
    bus.publish(makeMessage({ to: 'architect' }))
    bus.flush()

    expect(received).toHaveLength(1)
  })

  it('delivers broadcast messages to all broadcast handlers', () => {
    const bus = new AdvancedEventBus()
    const received: string[] = []

    bus.onBroadcast(msg => received.push(`a:${msg.id}`))
    bus.onBroadcast(msg => received.push(`b:${msg.id}`))
    bus.publish(makeMessage({ id: 'bc1', to: '*' }))
    bus.flush()

    expect(received).toHaveLength(2)
  })

  it('processes messages in priority order', () => {
    const bus = new AdvancedEventBus()
    const order: string[] = []

    bus.subscribe('work', msg => order.push(msg.id))

    bus.publish(makeMessage({ id: 'low', topic: 'work', priority: 'low' }))
    bus.publish(makeMessage({ id: 'critical', topic: 'work', priority: 'critical' }))
    bus.publish(makeMessage({ id: 'normal', topic: 'work', priority: 'normal' }))

    bus.flush()

    expect(order).toEqual(['critical', 'normal', 'low'])
  })

  it('discards expired messages during flush', () => {
    const bus = new AdvancedEventBus()
    const received: AdvancedMessage[] = []

    bus.subscribe('work', msg => received.push(msg))

    bus.publish(makeExpiredMessage({ topic: 'work', priority: 'critical' }))
    bus.publish(makeMessage({ id: 'valid', topic: 'work', priority: 'low' }))

    bus.flush()

    expect(received).toHaveLength(1)
    expect(received[0]?.id).toBe('valid')

    const expired = bus.drainExpired()
    expect(expired).toHaveLength(1)
  })

  it('passes through correlationId for request-response patterns', () => {
    const bus = new AdvancedEventBus()
    const received: AdvancedMessage[] = []

    bus.registerAgent('responder', msg => received.push(msg))

    const corrId = 'req-123'
    bus.publish(makeMessage({ to: 'responder', correlationId: corrId }))
    bus.flush()

    expect(received[0]?.correlationId).toBe(corrId)
  })

  it('unsubscribe removes handler', () => {
    const bus = new AdvancedEventBus()
    const received: AdvancedMessage[] = []

    const unsub = bus.subscribe('topic', msg => received.push(msg))
    bus.publish(makeMessage({ topic: 'topic' }))
    bus.flush()
    expect(received).toHaveLength(1)

    unsub()
    bus.publish(makeMessage({ topic: 'topic' }))
    bus.flush()
    expect(received).toHaveLength(1)  // no new messages
  })

  it('reset clears all state', () => {
    const bus = new AdvancedEventBus()
    bus.subscribe('x', () => {})
    bus.publish(makeMessage({ topic: 'x' }))
    expect(bus.pendingCount).toBe(1)

    bus.reset()
    expect(bus.pendingCount).toBe(0)
    expect(bus.flush()).toBe(0)
  })
})
