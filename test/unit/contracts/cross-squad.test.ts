import { describe, it, expect } from 'vitest'
import {
  defaultContextBoundary,
  defaultProtocol,
  createMessage,
  findRoute,
  resolveStrategy,
  validateMessage,
} from '../../../src/contracts/cross-squad.js'
import type {
  CrossSquadMessage,
  CollaborationProtocol,
  RoutingRule,
  HandoffPayload,
  ContextBoundary,
} from '../../../src/contracts/cross-squad.js'

// ---------------------------------------------------------------------------
// defaultContextBoundary
// ---------------------------------------------------------------------------

describe('defaultContextBoundary', () => {
  it('returns a restrictive boundary', () => {
    const boundary = defaultContextBoundary()
    expect(boundary.constitutionVisibility).toBe('summary')
    expect(boundary.projectContextVisibility).toBe('metadata_only')
    expect(boundary.writeAccess).toBe(false)
    expect(boundary.allowedFilePaths).toHaveLength(0)
    expect(boundary.deniedFilePaths.length).toBeGreaterThan(0)
  })

  it('denies sensitive file patterns', () => {
    const boundary = defaultContextBoundary()
    expect(boundary.deniedFilePaths).toContain('**/.env')
    expect(boundary.deniedFilePaths).toContain('**/*.key')
  })
})

// ---------------------------------------------------------------------------
// defaultProtocol
// ---------------------------------------------------------------------------

describe('defaultProtocol', () => {
  it('returns protocol with chief_first default strategy', () => {
    const protocol = defaultProtocol()
    expect(protocol.version).toBe('1.0')
    expect(protocol.defaultStrategy).toBe('chief_first')
    expect(protocol.routes).toHaveLength(0)
    expect(protocol.maxConcurrentHandoffs).toBe(3)
    expect(protocol.defaultTtlSeconds).toBe(86400)
  })
})

// ---------------------------------------------------------------------------
// createMessage
// ---------------------------------------------------------------------------

describe('createMessage', () => {
  const payload: HandoffPayload = {
    title: 'Design landing page',
    description: 'Create the landing page design for the product launch',
    domain: 'marketing',
    expectedOutput: 'Figma file with design',
    acceptanceCriteria: ['Responsive design', 'Brand-consistent colors'],
  }

  it('creates a message with all required fields', () => {
    const msg = createMessage({
      id: 'msg-001',
      fromSquad: 'software',
      fromAgent: 'chief',
      toSquad: 'marketing',
      payload,
    })

    expect(msg.id).toBe('msg-001')
    expect(msg.fromSquad).toBe('software')
    expect(msg.fromAgent).toBe('chief')
    expect(msg.toSquad).toBe('marketing')
    expect(msg.direction).toBe('request')
    expect(msg.priority).toBe('normal')
    expect(msg.payload.title).toBe('Design landing page')
  })

  it('applies default context boundary', () => {
    const msg = createMessage({
      id: 'msg-002',
      fromSquad: 'software',
      fromAgent: 'chief',
      toSquad: 'marketing',
      payload,
    })

    expect(msg.contextBoundary.writeAccess).toBe(false)
    expect(msg.contextBoundary.constitutionVisibility).toBe('summary')
  })

  it('allows overriding defaults', () => {
    const msg = createMessage({
      id: 'msg-003',
      fromSquad: 'software',
      fromAgent: 'specialist',
      toSquad: 'marketing',
      payload,
      direction: 'response',
      priority: 'high',
      correlationId: 'corr-001',
      ttlSeconds: 3600,
    })

    expect(msg.direction).toBe('response')
    expect(msg.priority).toBe('high')
    expect(msg.correlationId).toBe('corr-001')
    expect(msg.ttlSeconds).toBe(3600)
  })

  it('allows custom context boundary', () => {
    const customBoundary: ContextBoundary = {
      constitutionVisibility: 'full',
      projectContextVisibility: 'full',
      allowedFilePaths: ['src/**'],
      deniedFilePaths: [],
      writeAccess: true,
    }

    const msg = createMessage({
      id: 'msg-004',
      fromSquad: 'software',
      fromAgent: 'chief',
      toSquad: 'marketing',
      payload,
      contextBoundary: customBoundary,
    })

    expect(msg.contextBoundary.writeAccess).toBe(true)
    expect(msg.contextBoundary.constitutionVisibility).toBe('full')
  })

  it('accepts optional toAgent', () => {
    const msg = createMessage({
      id: 'msg-005',
      fromSquad: 'software',
      fromAgent: 'chief',
      toSquad: 'marketing',
      toAgent: 'specialist',
      payload,
    })
    expect(msg.toAgent).toBe('specialist')
  })
})

// ---------------------------------------------------------------------------
// findRoute / resolveStrategy
// ---------------------------------------------------------------------------

describe('findRoute', () => {
  const makeMsg = (from: string, to: string, domain = 'software'): CrossSquadMessage =>
    createMessage({
      id: 'test',
      fromSquad: from,
      fromAgent: 'chief',
      toSquad: to,
      payload: {
        title: 'test',
        description: 'test',
        domain,
        expectedOutput: 'test',
        acceptanceCriteria: [],
      },
    })

  it('returns undefined when no routes defined', () => {
    const protocol = defaultProtocol()
    const msg = makeMsg('software', 'marketing')
    expect(findRoute(protocol, msg)).toBeUndefined()
  })

  it('matches exact squad names', () => {
    const protocol = defaultProtocol()
    const rule: RoutingRule = {
      fromSquad: 'software',
      toSquad: 'marketing',
      strategy: 'direct',
      requiresApproval: false,
    }
    protocol.routes.push(rule)

    const msg = makeMsg('software', 'marketing')
    expect(findRoute(protocol, msg)).toBe(rule)
  })

  it('matches wildcard fromSquad', () => {
    const protocol = defaultProtocol()
    const rule: RoutingRule = {
      fromSquad: '*',
      toSquad: 'marketing',
      strategy: 'broadcast',
      requiresApproval: true,
    }
    protocol.routes.push(rule)

    const msg = makeMsg('research', 'marketing')
    expect(findRoute(protocol, msg)).toBe(rule)
  })

  it('filters by allowed domains', () => {
    const protocol = defaultProtocol()
    const rule: RoutingRule = {
      fromSquad: '*',
      toSquad: '*',
      strategy: 'direct',
      requiresApproval: false,
      allowedDomains: ['marketing'],
    }
    protocol.routes.push(rule)

    // Software domain should not match
    const msg1 = makeMsg('software', 'marketing', 'software')
    expect(findRoute(protocol, msg1)).toBeUndefined()

    // Marketing domain should match
    const msg2 = makeMsg('software', 'marketing', 'marketing')
    expect(findRoute(protocol, msg2)).toBe(rule)
  })

  it('returns first matching rule', () => {
    const protocol = defaultProtocol()
    const rule1: RoutingRule = {
      fromSquad: 'software',
      toSquad: 'marketing',
      strategy: 'direct',
      requiresApproval: false,
    }
    const rule2: RoutingRule = {
      fromSquad: '*',
      toSquad: '*',
      strategy: 'broadcast',
      requiresApproval: true,
    }
    protocol.routes.push(rule1, rule2)

    const msg = makeMsg('software', 'marketing')
    expect(findRoute(protocol, msg)).toBe(rule1)
  })
})

describe('resolveStrategy', () => {
  it('returns protocol default when no route matches', () => {
    const protocol = defaultProtocol()
    const msg = createMessage({
      id: 'test',
      fromSquad: 'a',
      fromAgent: 'chief',
      toSquad: 'b',
      payload: {
        title: 'test',
        description: 'test',
        domain: 'software',
        expectedOutput: 'test',
        acceptanceCriteria: [],
      },
    })
    expect(resolveStrategy(protocol, msg)).toBe('chief_first')
  })

  it('returns matched route strategy', () => {
    const protocol = defaultProtocol()
    protocol.routes.push({
      fromSquad: '*',
      toSquad: '*',
      strategy: 'broadcast',
      requiresApproval: false,
    })

    const msg = createMessage({
      id: 'test',
      fromSquad: 'a',
      fromAgent: 'chief',
      toSquad: 'b',
      payload: {
        title: 'test',
        description: 'test',
        domain: 'software',
        expectedOutput: 'test',
        acceptanceCriteria: [],
      },
    })
    expect(resolveStrategy(protocol, msg)).toBe('broadcast')
  })
})

// ---------------------------------------------------------------------------
// validateMessage
// ---------------------------------------------------------------------------

describe('validateMessage', () => {
  it('returns no errors for a valid message', () => {
    const msg = createMessage({
      id: 'msg-001',
      fromSquad: 'software',
      fromAgent: 'chief',
      toSquad: 'marketing',
      payload: {
        title: 'Task title',
        description: 'Task description',
        domain: 'software',
        expectedOutput: 'deliverable',
        acceptanceCriteria: ['criterion 1'],
      },
    })

    const errors = validateMessage(msg)
    expect(errors).toHaveLength(0)
  })

  it('detects missing required fields', () => {
    const msg = {
      id: '',
      timestamp: '2026-03-22T00:00:00Z',
      fromSquad: '',
      fromAgent: '',
      toSquad: '',
      direction: 'request' as const,
      priority: 'normal' as const,
      payload: {
        title: '',
        description: '',
        domain: 'test',
        expectedOutput: 'test',
        acceptanceCriteria: [],
      },
      contextBoundary: defaultContextBoundary(),
    }

    const errors = validateMessage(msg)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors).toContain('Message id is required')
    expect(errors).toContain('fromSquad is required')
    expect(errors).toContain('fromAgent is required')
    expect(errors).toContain('toSquad is required')
  })

  it('rejects same-squad messages', () => {
    const msg = createMessage({
      id: 'msg-001',
      fromSquad: 'software',
      fromAgent: 'chief',
      toSquad: 'software',
      payload: {
        title: 'Task',
        description: 'Desc',
        domain: 'software',
        expectedOutput: 'out',
        acceptanceCriteria: [],
      },
    })

    const errors = validateMessage(msg)
    expect(errors.some(e => e.includes('must be different'))).toBe(true)
  })

  it('detects missing payload fields', () => {
    const msg = createMessage({
      id: 'msg-001',
      fromSquad: 'software',
      fromAgent: 'chief',
      toSquad: 'marketing',
      payload: {
        title: '',
        description: '',
        domain: 'software',
        expectedOutput: 'test',
        acceptanceCriteria: [],
      },
    })

    const errors = validateMessage(msg)
    expect(errors).toContain('payload.title is required')
    expect(errors).toContain('payload.description is required')
  })
})
