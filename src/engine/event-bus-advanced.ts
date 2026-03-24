/**
 * Event Bus — Advanced Routing with priority queue and TTL support.
 * Extends basic pub/sub with priority-ordered processing, message expiry,
 * and correlation ID passthrough for request-response patterns.
 * @module engine/event-bus-advanced
 * @see Epic 22 — Story 22.3b
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical'

export interface AdvancedMessage {
  id: string
  from: string
  to?: string | undefined  // '*' for broadcast, agent name for direct, undefined for topic
  type: string
  topic: string
  payload: unknown
  timestamp: string
  priority: MessagePriority
  ttl?: number | undefined  // milliseconds, undefined = no expiry
  correlationId?: string | undefined  // for request-response matching
}

export type MessageHandler = (message: AdvancedMessage) => void

// ---------------------------------------------------------------------------
// Priority mapping
// ---------------------------------------------------------------------------

const PRIORITY_RANK: Record<MessagePriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
}

// ---------------------------------------------------------------------------
// PriorityQueue
// ---------------------------------------------------------------------------

/**
 * Priority queue for messages — higher priority messages dequeue first.
 * Within the same priority, FIFO ordering is preserved.
 */
export class PriorityQueue {
  private items: AdvancedMessage[] = []

  /** Number of messages currently in the queue (including potentially expired). */
  get size(): number {
    return this.items.length
  }

  /**
   * Insert a message into the queue sorted by priority (critical first).
   * Messages with equal priority maintain insertion order (stable).
   */
  // O(n) insertion — acceptable for agent message volumes, use heap if scaling needed
  enqueue(message: AdvancedMessage): void {
    const rank = PRIORITY_RANK[message.priority]
    // Find the first item with lower priority and insert before it
    let insertIdx = this.items.length
    for (let i = 0; i < this.items.length; i++) {
      if (PRIORITY_RANK[this.items[i]!.priority] < rank) {
        insertIdx = i
        break
      }
    }
    this.items.splice(insertIdx, 0, message)
  }

  /**
   * Remove and return the highest-priority non-expired message.
   * Expired messages (past TTL) are discarded and logged via the callback.
   * Returns undefined when no valid messages remain.
   */
  dequeue(onExpired?: (msg: AdvancedMessage) => void): AdvancedMessage | undefined {
    const now = Date.now()

    while (this.items.length > 0) {
      const msg = this.items.shift()!
      if (isExpired(msg, now)) {
        onExpired?.(msg)
        continue
      }
      return msg
    }
    return undefined
  }

  /** Peek at the next message without removing it. */
  peek(): AdvancedMessage | undefined {
    return this.items[0]
  }

  /** Remove all messages from the queue. */
  clear(): void {
    this.items = []
  }
}

// ---------------------------------------------------------------------------
// AdvancedEventBus
// ---------------------------------------------------------------------------

/**
 * Event bus with priority-ordered message processing, TTL enforcement,
 * and correlation ID passthrough.
 */
export class AdvancedEventBus {
  private topicHandlers = new Map<string, Set<MessageHandler>>()
  private directHandlers = new Map<string, Set<MessageHandler>>()
  private broadcastHandlers = new Set<MessageHandler>()
  private queue = new PriorityQueue()
  private expiredMessages: AdvancedMessage[] = []

  /** Subscribe to a topic. Returns an unsubscribe function. */
  subscribe(topic: string, handler: MessageHandler): () => void {
    let handlers = this.topicHandlers.get(topic)
    if (!handlers) {
      handlers = new Set()
      this.topicHandlers.set(topic, handlers)
    }
    handlers.add(handler)
    return () => { handlers.delete(handler) }
  }

  /** Register a handler for direct messages to a specific agent. */
  registerAgent(agentName: string, handler: MessageHandler): () => void {
    let handlers = this.directHandlers.get(agentName)
    if (!handlers) {
      handlers = new Set()
      this.directHandlers.set(agentName, handlers)
    }
    handlers.add(handler)
    return () => { handlers.delete(handler) }
  }

  /** Register a handler for broadcast messages. */
  onBroadcast(handler: MessageHandler): () => void {
    this.broadcastHandlers.add(handler)
    return () => { this.broadcastHandlers.delete(handler) }
  }

  /** Publish a message to the bus — enqueued by priority. */
  publish(message: AdvancedMessage): void {
    this.queue.enqueue(message)
  }

  /**
   * Process all queued messages in priority order.
   * Expired messages are discarded (recorded in expiredMessages).
   * Returns the number of messages dispatched.
   */
  flush(): number {
    let dispatched = 0
    let msg: AdvancedMessage | undefined

    while ((msg = this.queue.dequeue(expired => this.expiredMessages.push(expired)))) {
      this.dispatch(msg)
      dispatched++
    }

    return dispatched
  }

  /** Get messages that were discarded due to TTL expiry since last drain. */
  drainExpired(): AdvancedMessage[] {
    const expired = [...this.expiredMessages]
    this.expiredMessages = []
    return expired
  }

  /** Number of messages waiting in the queue. */
  get pendingCount(): number {
    return this.queue.size
  }

  /** Clear all handlers and queued messages. */
  reset(): void {
    this.topicHandlers.clear()
    this.directHandlers.clear()
    this.broadcastHandlers.clear()
    this.queue.clear()
    this.expiredMessages = []
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private dispatch(msg: AdvancedMessage): void {
    // Broadcast
    if (msg.to === '*') {
      for (const handler of this.broadcastHandlers) handler(msg)
      return
    }

    // Direct message to agent
    if (msg.to !== undefined) {
      const handlers = this.directHandlers.get(msg.to)
      if (handlers) {
        for (const handler of handlers) handler(msg)
      }
      return
    }

    // Topic-based
    const handlers = this.topicHandlers.get(msg.topic)
    if (handlers) {
      for (const handler of handlers) handler(msg)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExpired(msg: AdvancedMessage, now: number): boolean {
  if (msg.ttl === undefined) return false
  const created = new Date(msg.timestamp).getTime()
  return now - created > msg.ttl
}
