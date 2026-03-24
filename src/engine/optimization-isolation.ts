/**
 * Optimization Isolation — workspace management for safe variant testing.
 * Creates temporary directories, applies variant content, and commits winners.
 * @module engine/optimization-isolation
 * @see Epic 23.3: Optimization Isolation
 */

import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Isolated workspace
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory with a full copy of the squad directory.
 * Returns the path to the temporary workspace.
 */
export async function createIsolatedWorkspace(
  squadDir: string,
): Promise<Result<string>> {
  try {
    const workspace = await mkdtemp(join(tmpdir(), 'bp-optimize-'))
    await cp(squadDir, workspace, { recursive: true })
    return ok(workspace)
  } catch (cause) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.optimize.workspace_create_failed',
      params: { squadDir },
      cause,
    })
  }
}

// ---------------------------------------------------------------------------
// Variant application
// ---------------------------------------------------------------------------

/**
 * Write variant content to the specified agent file within the workspace.
 */
export async function applyVariant(
  workspace: string,
  agentFile: string,
  content: string,
): Promise<Result<void>> {
  try {
    const targetPath = resolve(workspace, agentFile)
    // Prevent path traversal outside workspace
    if (!targetPath.startsWith(resolve(workspace))) {
      return err({
        code: ERROR_CODES.FILE_WRITE_FAILED,
        i18nKey: 'error.optimize.variant_apply_failed',
        params: { agentFile },
      })
    }
    await writeFile(targetPath, content, 'utf-8')
    return ok(undefined)
  } catch (cause) {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.optimize.variant_apply_failed',
      params: { agentFile },
      cause,
    })
  }
}

// ---------------------------------------------------------------------------
// Winner commit
// ---------------------------------------------------------------------------

/**
 * Generate a git commit message for the winning variant.
 * Does not actually execute git — returns the formatted message string.
 * Format: `optimize(agent): improve metric X.X → Y.Y`
 */
export function commitWinner(
  _squadDir: string,
  agentFile: string,
  _content: string,
  metricBefore: number,
  metricAfter: number,
): string {
  const agentName = agentFile.replace(/\.[^.]+$/, '').replace(/.*\//, '')
  return `optimize(${agentName}): improve metric ${metricBefore.toFixed(1)} → ${metricAfter.toFixed(1)}`
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Remove the temporary workspace directory.
 */
export async function cleanupWorkspace(workspace: string): Promise<void> {
  await rm(workspace, { recursive: true, force: true })
}
