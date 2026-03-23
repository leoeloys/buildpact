/**
 * Cross-Squad Collaboration Protocol — contract definitions.
 * Defines CrossSquadMessage, routing rules, and shared context boundaries.
 * @see Epic 16.3: Cross-Squad Collaboration Protocol
 */

// ---------------------------------------------------------------------------
// Core message types
// ---------------------------------------------------------------------------

/** Priority levels for cross-squad messages */
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical'

/** Message delivery status */
export type DeliveryStatus = 'pending' | 'delivered' | 'accepted' | 'rejected' | 'expired'

/** Direction of a cross-squad handoff */
export type HandoffDirection = 'request' | 'response'

/**
 * A cross-squad message — the atomic unit of inter-squad communication.
 * Squads communicate exclusively through this contract.
 */
export interface CrossSquadMessage {
  /** Unique message ID (UUID v4 format) */
  id: string
  /** ISO 8601 timestamp of message creation */
  timestamp: string
  /** Source squad name */
  fromSquad: string
  /** Source agent role within the squad */
  fromAgent: string
  /** Target squad name */
  toSquad: string
  /** Target agent role (optional — squad router decides if omitted) */
  toAgent?: string
  /** Handoff direction */
  direction: HandoffDirection
  /** Message priority */
  priority: MessagePriority
  /** The task or request being handed off */
  payload: HandoffPayload
  /** Context boundary — what the target squad may access */
  contextBoundary: ContextBoundary
  /** Optional correlation ID linking request/response pairs */
  correlationId?: string
  /** TTL in seconds — message expires after this duration */
  ttlSeconds?: number
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

/** The actual content being handed off between squads */
export interface HandoffPayload {
  /** Short description of the task */
  title: string
  /** Detailed task description */
  description: string
  /** Domain of the task (e.g., 'software', 'marketing') */
  domain: string
  /** Expected deliverable format */
  expectedOutput: string
  /** Acceptance criteria for the handoff */
  acceptanceCriteria: string[]
  /** Optional structured data */
  metadata?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Context boundary
// ---------------------------------------------------------------------------

/** Visibility level for shared context */
export type ContextVisibility = 'full' | 'summary' | 'metadata_only' | 'none'

/**
 * Defines what context the target squad may access from the source.
 * Enforces information boundaries between squads.
 */
export interface ContextBoundary {
  /** What the target can see of the source squad's constitution */
  constitutionVisibility: ContextVisibility
  /** What the target can see of the source's project context */
  projectContextVisibility: ContextVisibility
  /** Specific files the target is allowed to read (glob patterns) */
  allowedFilePaths: string[]
  /** Specific files explicitly denied (overrides allowed) */
  deniedFilePaths: string[]
  /** Whether the target may modify shared files */
  writeAccess: boolean
}

// ---------------------------------------------------------------------------
// Routing rules
// ---------------------------------------------------------------------------

/** How a message should be routed to the target squad */
export type RoutingStrategy = 'direct' | 'chief_first' | 'broadcast'

/**
 * A routing rule — determines how messages flow between squads.
 */
export interface RoutingRule {
  /** Source squad pattern (exact name or '*' for any) */
  fromSquad: string
  /** Target squad pattern (exact name or '*' for any) */
  toSquad: string
  /** Routing strategy */
  strategy: RoutingStrategy
  /** Whether this route requires approval before delivery */
  requiresApproval: boolean
  /** Maximum messages per hour on this route (rate limit) */
  maxMessagesPerHour?: number
  /** Allowed domains — empty means all */
  allowedDomains?: string[]
}

/**
 * Protocol configuration for cross-squad collaboration.
 */
export interface CollaborationProtocol {
  /** Protocol version */
  version: '1.0'
  /** Global default routing strategy */
  defaultStrategy: RoutingStrategy
  /** Global default context boundary */
  defaultBoundary: ContextBoundary
  /** Specific routing rules (evaluated in order, first match wins) */
  routes: RoutingRule[]
  /** Maximum concurrent cross-squad handoffs */
  maxConcurrentHandoffs: number
  /** Default TTL for messages in seconds (24 hours) */
  defaultTtlSeconds: number
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** Create a default context boundary (restrictive by default) */
export function defaultContextBoundary(): ContextBoundary {
  return {
    constitutionVisibility: 'summary',
    projectContextVisibility: 'metadata_only',
    allowedFilePaths: [],
    deniedFilePaths: ['**/.env', '**/*.key', '**/credentials*'],
    writeAccess: false,
  }
}

/** Create a default collaboration protocol */
export function defaultProtocol(): CollaborationProtocol {
  return {
    version: '1.0',
    defaultStrategy: 'chief_first',
    defaultBoundary: defaultContextBoundary(),
    routes: [],
    maxConcurrentHandoffs: 3,
    defaultTtlSeconds: 86400, // 24 hours
  }
}

/**
 * Create a CrossSquadMessage with sensible defaults.
 * Caller provides the required fields; defaults fill the rest.
 */
export function createMessage(params: {
  id: string
  fromSquad: string
  fromAgent: string
  toSquad: string
  payload: HandoffPayload
  toAgent?: string
  direction?: HandoffDirection
  priority?: MessagePriority
  contextBoundary?: ContextBoundary
  correlationId?: string
  ttlSeconds?: number
  timestamp?: string
}): CrossSquadMessage {
  return {
    id: params.id,
    timestamp: params.timestamp ?? new Date().toISOString(),
    fromSquad: params.fromSquad,
    fromAgent: params.fromAgent,
    toSquad: params.toSquad,
    toAgent: params.toAgent,
    direction: params.direction ?? 'request',
    priority: params.priority ?? 'normal',
    payload: params.payload,
    contextBoundary: params.contextBoundary ?? defaultContextBoundary(),
    correlationId: params.correlationId,
    ttlSeconds: params.ttlSeconds,
  }
}

// ---------------------------------------------------------------------------
// Routing logic
// ---------------------------------------------------------------------------

/**
 * Find the first matching routing rule for a message.
 * Returns undefined if no specific rule matches (use default strategy).
 */
export function findRoute(
  protocol: CollaborationProtocol,
  message: CrossSquadMessage,
): RoutingRule | undefined {
  for (const rule of protocol.routes) {
    const fromMatch = rule.fromSquad === '*' || rule.fromSquad === message.fromSquad
    const toMatch = rule.toSquad === '*' || rule.toSquad === message.toSquad
    if (fromMatch && toMatch) {
      // Check domain filter
      if (rule.allowedDomains && rule.allowedDomains.length > 0) {
        if (!rule.allowedDomains.includes(message.payload.domain)) {
          continue
        }
      }
      return rule
    }
  }
  return undefined
}

/**
 * Determine the routing strategy for a message.
 * Uses specific rule if found, otherwise falls back to protocol default.
 */
export function resolveStrategy(
  protocol: CollaborationProtocol,
  message: CrossSquadMessage,
): RoutingStrategy {
  const rule = findRoute(protocol, message)
  return rule?.strategy ?? protocol.defaultStrategy
}

/**
 * Validate a CrossSquadMessage for completeness.
 * Returns list of validation errors (empty = valid).
 */
export function validateMessage(message: CrossSquadMessage): string[] {
  const errors: string[] = []

  if (!message.id) errors.push('Message id is required')
  if (!message.fromSquad) errors.push('fromSquad is required')
  if (!message.fromAgent) errors.push('fromAgent is required')
  if (!message.toSquad) errors.push('toSquad is required')
  if (!message.payload) errors.push('payload is required')
  if (message.payload) {
    if (!message.payload.title) errors.push('payload.title is required')
    if (!message.payload.description) errors.push('payload.description is required')
  }
  if (message.fromSquad === message.toSquad) {
    errors.push('fromSquad and toSquad must be different (use intra-squad handoffs for same-squad communication)')
  }

  return errors
}
