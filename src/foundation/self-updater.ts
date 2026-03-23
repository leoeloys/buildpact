/**
 * Self-updater — checks GitHub for newer BuildPact versions and updates.
 * Reads the current version from package.json, compares with the latest
 * release/tag on GitHub, and pulls + rebuilds if a newer version exists.
 * @module foundation/self-updater
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ok, err } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  repoDir: string | null
}

export interface UpdateResult {
  previousVersion: string
  newVersion: string
  filesChanged: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the BuildPact repo root by walking up from the CLI binary location.
 * Uses import.meta.url to find where this file lives, then walks up to find
 * package.json with name=buildpact that is also a git repo.
 * Returns null if not running from a git repo (e.g. installed via npm global).
 */
export function findRepoRoot(): string | null {
  try {
    // Walk up from this file's location to find the BuildPact package root
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 10; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'))
        if (pkg.name === 'buildpact') {
          // Verify it's a git repo
          execSync('git rev-parse --show-toplevel', {
            cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
          })
          return dir
        }
      } catch { /* keep walking */ }
      const parent = dirname(dir)
      if (parent === dir) break // reached filesystem root
      dir = parent
    }
  } catch { /* can't resolve */ }
  return null
}

/**
 * Read the current CLI version from package.json in the repo root.
 */
export function readCurrentVersion(repoDir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(repoDir, 'package.json'), 'utf-8'))
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Check if there are newer commits on the remote (origin/main or origin/ralph/buildpact-alpha).
 * Uses `git fetch --dry-run` to avoid downloading anything.
 */
export function checkRemoteForUpdates(repoDir: string): Result<{ behind: number; branch: string }> {
  try {
    // Get current branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    // Fetch latest from remote (lightweight)
    execSync('git fetch origin --quiet', {
      cwd: repoDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15_000,
    })

    // Count commits behind
    const behindOutput = execSync(`git rev-list HEAD..origin/${branch} --count`, {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    const behind = parseInt(behindOutput, 10) || 0
    return ok({ behind, branch })
  } catch (cause) {
    return err({
      code: 'REMOTE_FETCH_FAILED',
      i18nKey: 'error.network.remote_fetch_failed',
      params: { url: 'origin', reason: cause instanceof Error ? cause.message : String(cause) },
      cause,
    })
  }
}

/**
 * Pull latest changes from remote and rebuild.
 */
export function pullAndRebuild(repoDir: string): Result<UpdateResult> {
  const previousVersion = readCurrentVersion(repoDir)

  try {
    // Pull latest
    const pullOutput = execSync('git pull --ff-only', {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
    })

    // Count files changed from pull output
    const filesMatch = pullOutput.match(/(\d+) files? changed/)
    const filesChanged = filesMatch ? parseInt(filesMatch[1]!, 10) : 0

    // Install deps if package-lock changed
    if (pullOutput.includes('package-lock.json') || pullOutput.includes('package.json')) {
      execSync('npm install --no-audit --no-fund', {
        cwd: repoDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60_000,
      })
    }

    // Rebuild
    execSync('npm run build', {
      cwd: repoDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60_000,
    })

    const newVersion = readCurrentVersion(repoDir)

    return ok({ previousVersion, newVersion, filesChanged })
  } catch (cause) {
    return err({
      code: 'GIT_COMMAND_FAILED',
      i18nKey: 'error.upgrade.pull_failed',
      params: { reason: cause instanceof Error ? cause.message : String(cause) },
      cause,
    })
  }
}

/**
 * Full self-update flow: check remote → pull → rebuild.
 * Returns null if already up to date.
 */
export function checkAndUpdate(repoDir: string): Result<UpdateResult | null> {
  const remoteCheck = checkRemoteForUpdates(repoDir)
  if (!remoteCheck.ok) return remoteCheck as Result<null>

  if (remoteCheck.value.behind === 0) {
    return ok(null) // already up to date
  }

  return pullAndRebuild(repoDir)
}
