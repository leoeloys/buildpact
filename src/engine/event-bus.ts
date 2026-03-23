/**
 * Event bus — in-process pub/sub for inter-agent communication.
 * @module engine/event-bus
 * @see Epic 22.3a — Basic Pub/Sub
 */

import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Typed message schema for all events flowing through the bus */
export interface BusMessage {
  id: string
  from: string
  type: string
  topic: string
  payload: unknown
  timestamp: string
}

/** Handler function invoked when a message arrives on a subscribed topic */
export type MessageHandler = (message: BusMessage) => void

/** Unsubscribe function returned by subscribe() */
export type Unsubscribe = () => void

/** Direct message handler registered for a named agent */
export type DirectHandler = (message: BusMessage) => void

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

/**
 * In-process EventEmitter-based bus for typed message passing.
 * Supports topic-based pub/sub, direct messaging, and broadcast.
 */
export class EventBus {
  private topicHandlers = new Map<string, Set<MessageHandler>>()
  private directHandlers = new Map<string, DirectHandler>()

  /**
   * Publish a message to a topic — fan-out to all subscribers.
   */
  publish(topic: string, message: Omit<BusMessage, 'id' | 'timestamp' | 'topic'>): void {
    const fullMessage: BusMessage = {
      ...message,
      id: randomUUID(),
      topic,
      timestamp: new Date().toISOString(),
    }

    const handlers = this.topicHandlers.get(topic)
    if (handlers) {
      for (const handler of handlers) {
        handler(fullMessage)
      }
    }
  }

  /**
   * Subscribe to a topic. Returns an unsubscribe function.
   */
  subscribe(topic: string, handler: MessageHandler): Unsubscribe {
    let handlers = this.topicHandlers.get(topic)
    if (!handlers) {
      handlers = new Set()
      this.topicHandlers.set(topic, handlers)
    }
    handlers.add(handler)

    return () => {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.topicHandlers.delete(topic)
      }
    }
  }

  /**
   * Register a named agent to receive direct messages.
   */
  registerAgent(name: string, handler: DirectHandler): void {
    this.directHandlers.set(name, handler)
  }

  /**
   * Unregister a named agent from direct messaging.
   */
  unregisterAgent(name: string): void {
    this.directHandlers.delete(name)
  }

  /**
   * Send a direct message to a named agent.
   */
  send(to: string, message: Omit<BusMessage, 'id' | 'timestamp' | 'topic'>): void {
    const fullMessage: BusMessage = {
      ...message,
      id: randomUUID(),
      topic: `direct:${to}`,
      timestamp: new Date().toISOString(),
    }

    const handler = this.directHandlers.get(to)
    if (handler) {
      handler(fullMessage)
    }
  }

  /**
   * Broadcast a message to all registered agents (to: '*').
   */
  broadcast(message: Omit<BusMessage, 'id' | 'timestamp' | 'topic'>): void {
    const fullMessage: BusMessage = {
      ...message,
      id: randomUUID(),
      topic: 'broadcast',
      timestamp: new Date().toISOString(),
    }

    for (const handler of this.directHandlers.values()) {
      handler(fullMessage)
    }
  }

  /**
   * Get a list of all registered agent names.
   */
  getRegisteredAgents(): string[] {
    return [...this.directHandlers.keys()]
  }

  /**
   * Get a list of all active topic subscriptions.
   */
  getActiveTopics(): string[] {
    return [...this.topicHandlers.keys()]
  }
}
