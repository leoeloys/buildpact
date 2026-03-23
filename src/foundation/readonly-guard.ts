/**
 * Readonly mode guard — blocks state-modifying commands when readonly: true.
 * Reads readonly flag from .buildpact/config.yaml.
 * @see Epic 21.3: v1.0 Release Checklist
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { err, ok, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

/** Commands that are blocked in readonly mode */
export const READONLY_BLOCKED_COMMANDS = [
  'execute',
  'specify',
  'plan',
  'quick',
  'constitution',
] as const

/**
 * Check if the project is in readonly mode.
 * Returns true if .buildpact/config.yaml has `readonly: true`.
 */
export function isReadonlyMode(projectDir: string): boolean {
  try {
    const content = readFileSync(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === 'readonly: true' || trimmed === "readonly: 'true'") {
        return true
      }
    }
  } catch {
    // No config — not readonly
  }
  return false
}

/**
 * Check if a command is allowed in the current project mode.
 * Returns err with READONLY_MODE if the command is blocked.
 */
export function checkReadonly(projectDir: string, command: string): Result<void> {
  if (!isReadonlyMode(projectDir)) {
    return ok(undefined)
  }

  if ((READONLY_BLOCKED_COMMANDS as readonly string[]).includes(command)) {
    return err({
      code: ERROR_CODES.READONLY_MODE,
      i18nKey: 'error.readonly.blocked',
    })
  }

  return ok(undefined)
}
