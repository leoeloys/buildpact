/**
 * Conclave Roles — formalized review perspectives for multi-agent review.
 * Each role brings a distinct perspective and voting weight to reviews.
 * @module engine/conclave-roles
 * @see BuildPact concept 20.7
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A formalized review role in the conclave */
export interface ConclaveRole {
  id: string
  name: string
  perspective: string
  votingWeight: number
}

/** A single vote from a conclave role */
export interface ConclaveVote {
  role: ConclaveRole
  vote: 'approve' | 'reject' | 'abstain'
  reasoning: string
}

// ---------------------------------------------------------------------------
// Formalized roles
// ---------------------------------------------------------------------------

export const FORMALIZED_ROLES: readonly ConclaveRole[] = [
  {
    id: 'architect',
    name: 'Architect',
    perspective: 'System design, modularity, separation of concerns, scalability, and long-term maintainability.',
    votingWeight: 1.5,
  },
  {
    id: 'developer',
    name: 'Developer',
    perspective: 'Implementation correctness, code quality, readability, DRY principles, and developer experience.',
    votingWeight: 1.0,
  },
  {
    id: 'security',
    name: 'Security Analyst',
    perspective: 'Vulnerability surface, input validation, authentication/authorization, data protection, and threat modeling.',
    votingWeight: 1.5,
  },
  {
    id: 'performance',
    name: 'Performance Engineer',
    perspective: 'Runtime efficiency, memory usage, algorithmic complexity, caching opportunities, and scalability bottlenecks.',
    votingWeight: 1.0,
  },
  {
    id: 'ux',
    name: 'UX Advocate',
    perspective: 'User-facing behavior, error messages, accessibility, consistency, and overall user experience.',
    votingWeight: 0.8,
  },
  {
    id: 'testing',
    name: 'QA Engineer',
    perspective: 'Test coverage, edge cases, regression risk, test quality, and verification completeness.',
    votingWeight: 1.2,
  },
] as const

// ---------------------------------------------------------------------------
// Content-type to role mapping
// ---------------------------------------------------------------------------

/** Which roles are relevant for each content type */
const CONTENT_ROLE_MAP: Record<string, string[]> = {
  code: ['developer', 'security', 'performance', 'testing'],
  spec: ['architect', 'developer', 'ux'],
  plan: ['architect', 'developer', 'performance'],
  architecture: ['architect', 'security', 'performance'],
  diff: ['developer', 'security', 'testing'],
  ui: ['ux', 'developer', 'testing'],
  api: ['architect', 'security', 'developer', 'performance'],
}

// ---------------------------------------------------------------------------
// Role selection
// ---------------------------------------------------------------------------

/**
 * Select relevant conclave roles for a given content type.
 * Falls back to all roles if content type is not recognized.
 */
export function selectRolesForReview(contentType: string): ConclaveRole[] {
  const roleIds = CONTENT_ROLE_MAP[contentType]

  if (!roleIds) {
    // Unknown content type — use all roles
    return [...FORMALIZED_ROLES]
  }

  return FORMALIZED_ROLES.filter(r => roleIds.includes(r.id))
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a conclave vote for display.
 */
export function formatConclaveVote(
  role: ConclaveRole,
  vote: ConclaveVote['vote'],
  reasoning: string,
): string {
  const icon = vote === 'approve' ? 'APPROVE' : vote === 'reject' ? 'REJECT' : 'ABSTAIN'
  return [
    `### ${role.name} [${icon}] (weight: ${role.votingWeight})`,
    `**Perspective:** ${role.perspective}`,
    `**Reasoning:** ${reasoning}`,
  ].join('\n')
}
