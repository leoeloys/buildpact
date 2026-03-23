import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../../src/engine/event-bus.js'
import type { BusMessage } from '../../../src/engine/event-bus.js'

describe('EventBus', () => {
  describe('publish/subscribe fan-out', () => {
    it('delivers message to all subscribers of a topic', () => {
      const bus = new EventBus()
      const received1: BusMessage[] = []
      const received2: BusMessage[] = []

      bus.subscribe('task.completed', (msg) => received1.push(msg))
      bus.subscribe('task.completed', (msg) => received2.push(msg))

      bus.publish('task.completed', {
        from: 'executor',
        type: 'event',
        payload: { taskId: 'abc' },
      })

      expect(received1).toHaveLength(1)
      expect(received2).toHaveLength(1)
      expect(received1[0]!.topic).toBe('task.completed')
      expect(received1[0]!.from).toBe('executor')
      expect(received1[0]!.payload).toEqual({ taskId: 'abc' })
      expect(typeof received1[0]!.id).toBe('string')
      expect(typeof received1[0]!.timestamp).toBe('string')
    })

    it('does not deliver to subscribers of other topics', () => {
      const bus = new EventBus()
      const received: BusMessage[] = []

      bus.subscribe('task.failed', (msg) => received.push(msg))

      bus.publish('task.completed', {
        from: 'executor',
        type: 'event',
        payload: {},
      })

      expect(received).toHaveLength(0)
    })
  })

  describe('direct messaging', () => {
    it('sends a direct message to a named agent', () => {
      const bus = new EventBus()
      const received: BusMessage[] = []

      bus.registerAgent('planner', (msg) => received.push(msg))

      bus.send('planner', {
        from: 'orchestrator',
        type: 'command',
        payload: { action: 'plan' },
      })

      expect(received).toHaveLength(1)
      expect(received[0]!.topic).toBe('direct:planner')
      expect(received[0]!.from).toBe('orchestrator')
    })

    it('does not deliver to unregistered agents', () => {
      const bus = new EventBus()
      const received: BusMessage[] = []

      bus.registerAgent('planner', (msg) => received.push(msg))

      bus.send('executor', {
        from: 'orchestrator',
        type: 'command',
        payload: {},
      })

      expect(received).toHaveLength(0)
    })
  })

  describe('broadcast', () => {
    it('delivers to all registered agents', () => {
      const bus = new EventBus()
      const received1: BusMessage[] = []
      const received2: BusMessage[] = []

      bus.registerAgent('planner', (msg) => received1.push(msg))
      bus.registerAgent('executor', (msg) => received2.push(msg))

      bus.broadcast({
        from: 'supervisor',
        type: 'announcement',
        payload: { message: 'shutdown' },
      })

      expect(received1).toHaveLength(1)
      expect(received2).toHaveLength(1)
      expect(received1[0]!.topic).toBe('broadcast')
      expect(received2[0]!.topic).toBe('broadcast')
    })

    it('does not deliver when no agents are registered', () => {
      const bus = new EventBus()
      // Should not throw
      bus.broadcast({
        from: 'supervisor',
        type: 'announcement',
        payload: {},
      })
      expect(bus.getRegisteredAgents()).toHaveLength(0)
    })
  })

  describe('unsubscribe', () => {
    it('stops delivering after unsubscribe is called', () => {
      const bus = new EventBus()
      const received: BusMessage[] = []

      const unsub = bus.subscribe('task.completed', (msg) => received.push(msg))

      bus.publish('task.completed', {
        from: 'executor',
        type: 'event',
        payload: { n: 1 },
      })

      expect(received).toHaveLength(1)

      unsub()

      bus.publish('task.completed', {
        from: 'executor',
        type: 'event',
        payload: { n: 2 },
      })

      expect(received).toHaveLength(1)
    })

    it('removes the topic when last subscriber unsubscribes', () => {
      const bus = new EventBus()
      const unsub = bus.subscribe('cleanup', () => {})

      expect(bus.getActiveTopics()).toContain('cleanup')

      unsub()

      expect(bus.getActiveTopics()).not.toContain('cleanup')
    })

    it('unregisterAgent stops direct messages', () => {
      const bus = new EventBus()
      const received: BusMessage[] = []

      bus.registerAgent('agent-a', (msg) => received.push(msg))
      bus.send('agent-a', { from: 'test', type: 'ping', payload: {} })
      expect(received).toHaveLength(1)

      bus.unregisterAgent('agent-a')
      bus.send('agent-a', { from: 'test', type: 'ping', payload: {} })
      expect(received).toHaveLength(1)
    })
  })
})
