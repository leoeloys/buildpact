/**
 * @module foundation/constitution
 * @see FR-201, FR-202
 *
 * Read/write the project constitution file at .buildpact/constitution.md.
 * Pure module: no business logic beyond validation.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONSTITUTION_FILE = join('.buildpact', 'constitution.md')

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Reads .buildpact/constitution.md and returns its content.
 * Returns CONSTITUTION_NOT_FOUND if file doesn't exist.
 */
export async function loadConstitution(projectDir: string): Promise<Result<string>> {
  const path = join(projectDir, CONSTITUTION_FILE)
  try {
    const content = await readFile(path, 'utf-8')
    return ok(content)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return err({ code: ERROR_CODES.CONSTITUTION_NOT_FOUND, i18nKey: 'error.constitution.not_found' })
    }
    return err({ code: ERROR_CODES.FILE_READ_FAILED, i18nKey: 'error.file.read_failed', cause })
  }
}

/**
 * Writes content to .buildpact/constitution.md.
 * Returns CONSTITUTION_EMPTY if content is blank.
 * Returns FILE_WRITE_FAILED on I/O errors.
 */
export async function saveConstitution(projectDir: string, content: string): Promise<Result<void>> {
  if (content.trim() === '') {
    return err({ code: ERROR_CODES.CONSTITUTION_EMPTY, i18nKey: 'error.constitution.empty' })
  }
  const path = join(projectDir, CONSTITUTION_FILE)
  try {
    await writeFile(path, content, 'utf-8')
    return ok(undefined)
  } catch (cause) {
    return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.file.write_failed', cause })
  }
}

/**
 * Returns true if .buildpact/constitution.md exists.
 * Used by the command handler to determine create vs edit mode.
 */
export async function constitutionExists(projectDir: string): Promise<boolean> {
  const path = join(projectDir, CONSTITUTION_FILE)
  try {
    await readFile(path, 'utf-8')
    return true
  } catch {
    return false
  }
}
