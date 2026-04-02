/**
 * Role Boundary Engine — whitelist/blacklist enforcement per agent role.
 * Prevents role bleeding: orchestrators cannot write code, developers cannot dispatch agents.
 * @module engine/role-boundary
 * @see Original BuildPact concept 16.1
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { RoleBoundary, ActionPattern, RoleBoundaryViolation } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Built-in role boundaries
// ---------------------------------------------------------------------------

/** Orchestrator: coordinate only — no code writing, no command execution */
export const ORCHESTRATOR_BOUNDARY: RoleBoundary = {
  agentRole: 'orchestrator',
  allowedActions: [
    { type: 'tool_call', pattern: '^(Agent|TaskCreate|TaskUpdate|Read|Grep|Glob|LS)$', description: 'Dispatch, track, read' },
    { type: 'output_pattern', pattern: 'HandoffPacket|DispatchAction|STATE\\.md', description: 'Coordination artifacts' },
  ],
  blockedActions: [
    { type: 'tool_call', pattern: '^(Write|Edit)$', description: 'Cannot write/edit files' },
    { type: 'tool_call', pattern: '^Bash$', description: 'Cannot run shell commands' },
    { type: 'file_operation', pattern: 'src/.*\\.(ts|js|py|java|go|rs)$', description: 'Cannot modify source files' },
    { type: 'output_pattern', pattern: '```(typescript|javascript|python|java|go|rust)', description: 'Cannot generate implementation code blocks' },
  ],
}

/** Developer: full implementation access — no agent dispatch, no constitution changes */
export const DEVELOPER_BOUNDARY: RoleBoundary = {
  agentRole: 'developer',
  allowedActions: [
    { type: 'tool_call', pattern: '^(Write|Edit|Bash|Read|Grep|Glob|LS)$', description: 'Full implementation access' },
  ],
  blockedActions: [
    { type: 'tool_call', pattern: '^Agent$', description: 'Cannot dispatch other agents' },
    { type: 'file_operation', pattern: 'constitution\\.md$', description: 'Cannot modify constitution' },
  ],
}

/** Reviewer: read-only analysis — no file modifications */
export const REVIEWER_BOUNDARY: RoleBoundary = {
  agentRole: 'reviewer',
  allowedActions: [
    { type: 'tool_call', pattern: '^(Read|Grep|Glob|LS|Bash)$', description: 'Read and analyze' },
  ],
  blockedActions: [
    { type: 'tool_call', pattern: '^(Write|Edit)$', description: 'Cannot modify files' },
    { type: 'tool_call', pattern: '^Agent$', description: 'Cannot dispatch agents' },
  ],
}

/** Registry of built-in role boundaries */
export const BUILT_IN_BOUNDARIES: Record<string, RoleBoundary> = {
  orchestrator: ORCHESTRATOR_BOUNDARY,
  developer: DEVELOPER_BOUNDARY,
  reviewer: REVIEWER_BOUNDARY,
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

/** Cached compiled regexes to avoid recompilation on every check */
const regexCache = new Map<string, RegExp>()

/** Maximum cache entries to prevent unbounded memory growth */
const MAX_REGEX_CACHE_SIZE = 200

/** Maximum pattern length to prevent excessive compilation cost */
const MAX_PATTERN_LENGTH = 500

/**
 * Dangerous regex constructs that can cause catastrophic backtracking (ReDoS).
 * Rejects patterns with nested quantifiers like (a+)+, (a*)*b, etc.
 */
const REDOS_DANGER_PATTERN = /(\([^)]*[+*][^)]*\))[+*]|\(\?[^)]*[+*][^)]*\)[+*]/

/**
 * Validate and compile a regex pattern safely.
 * Rejects patterns that are too long or contain known ReDoS constructs.
 */
export function safeCompileRegex(pattern: string): RegExp | null {
  if (pattern.length > MAX_PATTERN_LENGTH) return null

  const cached = regexCache.get(pattern)
  if (cached) return cached

  // Reject known ReDoS patterns (nested quantifiers)
  if (REDOS_DANGER_PATTERN.test(pattern)) return null

  try {
    const regex = new RegExp(pattern)
    if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
      // Evict oldest entry
      const firstKey = regexCache.keys().next().value
      if (firstKey !== undefined) regexCache.delete(firstKey)
    }
    regexCache.set(pattern, regex)
    return regex
  } catch {
    return null
  }
}

/**
 * Check if an action matches a pattern.
 * Uses safe regex compilation with ReDoS protection and caching.
 */
export function matchesPattern(
  patternType: ActionPattern['type'],
  value: string,
  pattern: string,
): boolean {
  const regex = safeCompileRegex(pattern)
  if (!regex) return false
  return regex.test(value)
}

// ---------------------------------------------------------------------------
// Boundary check
// ---------------------------------------------------------------------------

/** What the agent is trying to do */
export interface AgentAction {
  /** Tool being called (Write, Edit, Bash, Agent, etc.) */
  toolName?: string
  /** File path being operated on */
  filePath?: string
  /** Output content being generated */
  outputContent?: string
}

/**
 * Check if an action is permitted for a given role.
 * Returns ok(void) if allowed, err with violation details if blocked.
 * Pure function — no side effects.
 */
export function checkRoleBoundary(
  boundary: RoleBoundary,
  action: AgentAction,
): Result<void> {
  // Check blocked actions first (blacklist takes priority)
  for (const blocked of boundary.blockedActions) {
    const value = actionValueForType(blocked.type, action)
    if (value !== undefined && matchesPattern(blocked.type, value, blocked.pattern)) {
      return err({
        code: ERROR_CODES.ROLE_BOUNDARY_VIOLATION,
        i18nKey: 'error.role_boundary.violation',
        params: {
          role: boundary.agentRole,
          action: value,
          reason: blocked.description,
        },
      })
    }
  }

  // If allowed list is non-empty and action is a tool call, verify it's in the whitelist
  if (boundary.allowedActions.length > 0 && action.toolName) {
    const isAllowed = boundary.allowedActions.some(allowed => {
      const value = actionValueForType(allowed.type, action)
      return value !== undefined && matchesPattern(allowed.type, value, allowed.pattern)
    })
    if (!isAllowed) {
      return err({
        code: ERROR_CODES.ROLE_BLOCKED_TOOL_CALL,
        i18nKey: 'error.role_boundary.blocked_tool',
        params: {
          role: boundary.agentRole,
          tool: action.toolName,
        },
      })
    }
  }

  return ok(undefined)
}

/**
 * Look up the boundary for a role name.
 * Returns the built-in boundary or undefined if not found.
 */
export function getBoundaryForRole(role: string): RoleBoundary | undefined {
  return BUILT_IN_BOUNDARIES[role]
}

/**
 * Create a violation record for audit logging.
 */
export function createViolationRecord(
  boundary: RoleBoundary,
  action: AgentAction,
  matchedPattern: ActionPattern,
): RoleBoundaryViolation {
  return {
    agentRole: boundary.agentRole,
    attemptedAction: action.toolName ?? action.filePath ?? 'unknown',
    matchedPattern,
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionValueForType(
  type: ActionPattern['type'],
  action: AgentAction,
): string | undefined {
  switch (type) {
    case 'tool_call': return action.toolName
    case 'file_operation': return action.filePath
    case 'output_pattern': return action.outputContent
  }
}
