/**
 * RBAC Middleware & Role Resolution — role-based access control for BuildPact commands.
 * When `.buildpact/rbac.yaml` exists, every command invocation is gated by role permissions.
 * Without the file, all users are treated as admin (backward compatible).
 * @see Epic 24.1a: RBAC Middleware & Role Resolution
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RbacRole = 'admin' | 'lead' | 'member' | 'viewer'

export interface RbacPermission {
  resource: string // e.g. 'squad.execute', 'config.write', 'audit.read'
  allowed: boolean
}

export interface RbacConfig {
  roles: Record<RbacRole, string[]> // role -> permission strings
  users: Record<string, RbacRole> // username -> role
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default role → permissions mapping */
export const DEFAULT_ROLE_PERMISSIONS: Record<RbacRole, string[]> = {
  admin: ['*'],
  lead: ['squad.execute', 'squad.install', 'config.write', 'audit.read', 'budget.set'],
  member: ['squad.execute', 'squad.install', 'audit.read'],
  viewer: ['audit.read'],
}

const RBAC_CONFIG_FILE = 'rbac.yaml'
const BUILDPACT_DIR = '.buildpact'

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Load RBAC configuration from `.buildpact/rbac.yaml`.
 * Returns null if the file does not exist (backward compatible: no restrictions).
 */
export async function loadRbacConfig(projectDir: string): Promise<Result<RbacConfig | null>> {
  const configPath = join(projectDir, BUILDPACT_DIR, RBAC_CONFIG_FILE)

  let raw: string
  try {
    raw = await readFile(configPath, 'utf-8')
  } catch {
    // File not found — backward compatible, no restrictions
    return ok(null)
  }

  try {
    const config = parseRbacYaml(raw)
    return ok(config)
  } catch (e) {
    return err({
      code: ERROR_CODES.RBAC_CONFIG_INVALID,
      i18nKey: 'error.rbac.config_invalid',
      params: { path: configPath },
      cause: e,
    })
  }
}

/**
 * Parse a simple RBAC YAML string into RbacConfig.
 * Expects structure:
 * ```yaml
 * roles:
 *   admin: ["*"]
 *   lead: [squad.execute, ...]
 * users:
 *   alice: admin
 *   bob: member
 * ```
 */
export function parseRbacYaml(raw: string): RbacConfig {
  const roles: Record<string, string[]> = {}
  const users: Record<string, string> = {}

  let section: 'none' | 'roles' | 'users' = 'none'
  let currentRole: string | null = null

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (trimmed === 'roles:') {
      section = 'roles'
      currentRole = null
      continue
    }
    if (trimmed === 'users:') {
      section = 'users'
      currentRole = null
      continue
    }

    if (section === 'roles') {
      // Role definition line: "  admin:" or "  admin: [...]"
      const roleMatch = trimmed.match(/^(\w+):\s*(.*)$/)
      if (roleMatch) {
        const [, roleName, rest] = roleMatch
        if (!roleName) continue
        currentRole = roleName
        // Inline array: admin: ["*"]
        const inlineArray = rest?.match(/^\[(.+)]$/)
        if (inlineArray && inlineArray[1]) {
          roles[currentRole] = inlineArray[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
        } else if (!rest || rest === '') {
          roles[currentRole] = []
        }
        continue
      }
      // List item under current role: "  - squad.execute"
      const listMatch = trimmed.match(/^-\s+(.+)$/)
      if (listMatch && listMatch[1] && currentRole) {
        if (!roles[currentRole]) roles[currentRole] = []
        roles[currentRole]!.push(listMatch[1].replace(/^["']|["']$/g, ''))
        continue
      }
    }

    if (section === 'users') {
      const userMatch = trimmed.match(/^(\S+):\s*(\S+)$/)
      if (userMatch && userMatch[1] && userMatch[2]) {
        users[userMatch[1]] = userMatch[2]
      }
    }
  }

  // Apply defaults for any missing roles
  const allRoles: RbacRole[] = ['admin', 'lead', 'member', 'viewer']
  for (const r of allRoles) {
    if (!roles[r]) {
      roles[r] = DEFAULT_ROLE_PERMISSIONS[r]
    }
  }

  return {
    roles: roles as Record<RbacRole, string[]>,
    users: users as Record<string, RbacRole>,
  }
}

/**
 * Resolve the role for a user. Returns 'viewer' (least privilege) if user
 * is not listed — when RBAC is enabled, unknown users should be restricted.
 */
export function resolveUserRole(config: RbacConfig, user: string): RbacRole {
  return config.users[user] ?? 'viewer'
}

/**
 * Check if a role has a specific permission.
 * Supports wildcard '*' for admin-level access.
 */
export function checkPermission(config: RbacConfig, role: RbacRole, permission: string): boolean {
  const perms = config.roles[role]
  if (!perms) return false
  if (perms.includes('*')) return true
  return perms.includes(permission)
}

/**
 * Resolve the current user from BP_USER env var or git config user.name.
 */
export function resolveCurrentUser(): string {
  const envUser = process.env['BP_USER']
  if (envUser) return envUser

  try {
    const gitUser = execSync('git config user.name', {
      encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    if (gitUser) return gitUser
  } catch {
    // git not available or no user.name configured
  }

  return 'unknown'
}
