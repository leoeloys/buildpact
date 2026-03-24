/**
 * RBAC Command Permission Guards — maps CLI commands to required permissions
 * and provides a single `guardCommand()` gate for command handlers.
 * @see Epic 24.1b: RBAC Command Permission Guards
 */

import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import { loadRbacConfig, resolveCurrentUser, resolveUserRole, checkPermission } from './rbac.js'
import type { RbacRole } from './rbac.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandPermissionMap {
  [command: string]: string // command name -> required permission
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the mapping from command name to the permission it requires.
 */
export function getCommandPermissions(): CommandPermissionMap {
  return {
    adopt: 'squad.install',
    execute: 'squad.execute',
    quick: 'squad.execute',
    specify: 'config.write',
    plan: 'config.write',
    audit: 'audit.read',
    constitution: 'config.write',
    squad: 'squad.install',
    verify: 'squad.execute',
    orchestrate: 'squad.execute',
    'export-web': 'audit.read',
    memory: 'audit.read',
    status: 'audit.read',
    diff: 'audit.read',
    docs: 'audit.read',
    quality: 'audit.read',
    investigate: 'audit.read',
  }
}

/**
 * Guard a command invocation by checking RBAC for the current user.
 * Returns ok(undefined) if allowed, or err with code 'RBAC_DENIED' if blocked.
 * If no RBAC config exists, the command is always allowed (backward compatible).
 */
export async function guardCommand(projectDir: string, command: string): Promise<Result<void>> {
  const configResult = await loadRbacConfig(projectDir)
  if (!configResult.ok) return configResult

  const config = configResult.value
  // No RBAC config → everything allowed
  if (!config) return ok(undefined)

  const permissions = getCommandPermissions()
  const requiredPermission = permissions[command]
  // Unknown command → allow (no restriction defined)
  if (!requiredPermission) return ok(undefined)

  const user = resolveCurrentUser()
  const role = resolveUserRole(config, user)
  const allowed = checkPermission(config, role, requiredPermission)

  if (!allowed) {
    return err({
      code: ERROR_CODES.RBAC_DENIED,
      i18nKey: 'error.rbac.denied',
      params: {
        role,
        permission: requiredPermission,
        user,
        command,
        message: formatDeniedMessage(role, requiredPermission),
      },
    })
  }

  return ok(undefined)
}

/**
 * Format a human-readable denial message.
 */
export function formatDeniedMessage(role: RbacRole, permission: string): string {
  return `Permission denied. Role '${role}' lacks '${permission}'. Contact your admin.`
}
