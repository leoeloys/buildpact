/**
 * Company Portability — export/import BuildPact project configuration.
 * Enables teams to replicate project setups across repositories.
 * @module engine/company-portability
 * @see BuildPact concept 14.5
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Portable project snapshot */
export interface ProjectExport {
  config: string | null
  constitution: string | null
  squads: string | null
  policies: string | null
}

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

const EXPORT_FILES: Array<{ key: keyof ProjectExport; path: string }> = [
  { key: 'config', path: '.buildpact/config.yml' },
  { key: 'constitution', path: '.buildpact/constitution.md' },
  { key: 'squads', path: '.buildpact/squads.yml' },
  { key: 'policies', path: '.buildpact/policies.json' },
]

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export key BuildPact project files into a portable snapshot.
 * Missing files are exported as null (non-blocking).
 */
export async function exportProject(projectDir: string): Promise<Result<ProjectExport>> {
  const exported: ProjectExport = {
    config: null,
    constitution: null,
    squads: null,
    policies: null,
  }

  try {
    for (const { key, path } of EXPORT_FILES) {
      try {
        exported[key] = await readFile(join(projectDir, path), 'utf-8')
      } catch {
        // File doesn't exist — leave as null
      }
    }

    return ok(exported)
  } catch {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.portability.export_failed',
      params: { dir: projectDir },
    })
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Import a portable project snapshot into a target directory.
 * Only writes files that are non-null in the export.
 */
export async function importProject(
  projectDir: string,
  exported: ProjectExport,
): Promise<Result<void>> {
  try {
    const buildpactDir = join(projectDir, '.buildpact')
    await mkdir(buildpactDir, { recursive: true })

    for (const { key, path } of EXPORT_FILES) {
      const content = exported[key]
      if (content !== null) {
        await writeFile(join(projectDir, path), content, 'utf-8')
      }
    }

    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.portability.import_failed',
      params: { dir: projectDir },
    })
  }
}
