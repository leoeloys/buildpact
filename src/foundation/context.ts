/**
 * @module foundation/context
 * Read project-context.md frontmatter fields.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const CONTEXT_FILE = join('.buildpact', 'project-context.md')

/**
 * Read the experience_level field from .buildpact/project-context.md frontmatter.
 * Returns 'intermediate' as default when the file is absent or the field is missing.
 */
export async function readExperienceLevel(projectDir: string): Promise<string> {
  const path = join(projectDir, CONTEXT_FILE)
  try {
    const content = await readFile(path, 'utf-8')
    const match = content.match(/^experience_level:\s*["']?(\w+)["']?\s*$/m)
    return match?.[1] ?? 'intermediate'
  } catch (error) {
    // File not found is expected — return default. Other errors (permissions, etc.) propagate.
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'intermediate'
    }
    return 'intermediate' // Graceful degradation — never block pipeline on context read
  }
}
