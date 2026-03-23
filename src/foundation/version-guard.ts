/**
 * Version guard — schema compatibility checking between CLI and project.
 * Reads buildpact_schema from config.yaml and compares with CLI expectations.
 * @module foundation/version-guard
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The schema version this CLI version writes when creating new projects. */
export const CURRENT_SCHEMA_VERSION = 2

/** Oldest schema this CLI can still read without requiring upgrade first. */
export const MIN_READABLE_SCHEMA = 0

/** Newest schema this CLI understands. */
export const MAX_READABLE_SCHEMA = 2

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VersionCheckResult =
  | { status: 'compatible' }
  | { status: 'upgrade_available'; projectSchema: number; cliSchema: number }
  | { status: 'upgrade_required'; projectSchema: number; cliSchema: number }
  | { status: 'cli_too_old'; projectSchema: number; cliSchema: number }
  | { status: 'no_schema' }
  | { status: 'no_project' }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read buildpact_schema from .buildpact/config.yaml.
 * Returns null if the file doesn't exist or the key is absent.
 */
export async function readProjectSchema(projectDir: string): Promise<number | null> {
  try {
    const content = await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    for (const raw of content.split('\n')) {
      const line = raw.trim()
      if (line.startsWith('buildpact_schema:')) {
        const value = line.slice('buildpact_schema:'.length).trim().replace(/^["']|["']$/g, '')
        const n = parseInt(value, 10)
        if (!isNaN(n)) return n
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Check whether the CLI is compatible with the project's schema version.
 * Called before every command (except init, adopt, doctor).
 */
export async function checkProjectVersion(projectDir: string): Promise<VersionCheckResult> {
  // Check if .buildpact/config.yaml exists at all
  let configExists = false
  try {
    await readFile(join(projectDir, '.buildpact', 'config.yaml'), 'utf-8')
    configExists = true
  } catch {
    return { status: 'no_project' }
  }

  if (!configExists) return { status: 'no_project' }

  const schema = await readProjectSchema(projectDir)

  // Legacy project (no schema key in config.yaml)
  if (schema === null) {
    return { status: 'no_schema' }
  }

  // Project from a NEWER CLI that this one doesn't understand
  if (schema > MAX_READABLE_SCHEMA) {
    return { status: 'cli_too_old', projectSchema: schema, cliSchema: CURRENT_SCHEMA_VERSION }
  }

  // Project needs mandatory migration (below min readable)
  if (schema < MIN_READABLE_SCHEMA) {
    return { status: 'upgrade_required', projectSchema: schema, cliSchema: CURRENT_SCHEMA_VERSION }
  }

  // Project works but could be upgraded
  if (schema < CURRENT_SCHEMA_VERSION) {
    return { status: 'upgrade_available', projectSchema: schema, cliSchema: CURRENT_SCHEMA_VERSION }
  }

  return { status: 'compatible' }
}
