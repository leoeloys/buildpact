/**
 * Update notifier — lightweight background check for newer CLI versions.
 * Runs at CLI startup, caches result to avoid hitting GitHub every invocation.
 * Shows a notice after command completes if an update is available.
 *
 * Cache: .buildpact/.update-check.json (checked at most once per hour)
 * @module foundation/update-notifier
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpdateCache {
  checkedAt: number       // epoch ms
  behind: number          // commits behind remote
  branch: string
  remoteVersion: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum interval between remote checks (1 hour) */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Cache file path relative to home dir */
const CACHE_FILE = '.buildpact/.update-check.json'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCachePath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp'
  return join(home, CACHE_FILE)
}

function readCache(): UpdateCache | null {
  try {
    const content = readFileSync(getCachePath(), 'utf-8')
    return JSON.parse(content) as UpdateCache
  } catch {
    return null
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    const path = getCachePath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(cache), 'utf-8')
  } catch { /* non-critical */ }
}

function findRepoRoot(): string | null {
  try {
    // Walk up from this file's location to find the BuildPact repo
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 10; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'))
        if (pkg.name === 'buildpact') {
          execSync('git rev-parse --show-toplevel', {
            cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
          })
          return dir
        }
      } catch { /* keep walking */ }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch { /* can't resolve */ }
  return null
}

function getCurrentVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 5; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'))
        if (pkg.name === 'buildpact') return pkg.version
      } catch { /* keep walking */ }
      dir = join(dir, '..')
    }
  } catch { /* fallback */ }
  return '0.0.0'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check for updates in the background.
 * Returns immediately — the actual check happens only if cache is stale.
 * Call `getUpdateNotice()` later to get the message to show.
 */
export function checkForUpdates(): void {
  const cache = readCache()
  const now = Date.now()

  // Skip if checked recently
  if (cache && (now - cache.checkedAt) < CHECK_INTERVAL_MS) {
    return
  }

  // Run check synchronously but silently (fast — just git fetch + rev-list)
  const repoRoot = findRepoRoot()
  if (!repoRoot) return

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    execSync('git fetch origin --quiet', {
      cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'], timeout: 10_000,
    })

    const behind = parseInt(
      execSync(`git rev-list HEAD..origin/${branch} --count`, {
        cwd: repoRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      }).trim(),
      10,
    ) || 0

    // Try to read remote version from package.json on origin
    let remoteVersion: string | null = null
    if (behind > 0) {
      try {
        const remotePkg = execSync(`git show origin/${branch}:package.json`, {
          cwd: repoRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
        })
        const parsed = JSON.parse(remotePkg) as { version?: string }
        remoteVersion = parsed.version ?? null
      } catch { /* can't read remote pkg */ }
    }

    writeCache({ checkedAt: now, behind, branch, remoteVersion })
  } catch {
    // Network error or git issue — write cache to avoid retrying immediately
    writeCache({ checkedAt: now, behind: 0, branch: '', remoteVersion: null })
  }
}

/**
 * Get the update notice message, or null if no update available.
 * Call this after command execution to show the notice.
 */
export function getUpdateNotice(): string | null {
  const cache = readCache()
  if (!cache || cache.behind === 0) return null

  const current = getCurrentVersion()
  const remote = cache.remoteVersion

  if (remote && remote !== current) {
    return `\n  Update available: ${current} → ${remote} (${cache.behind} commit(s))\n  Run: buildpact upgrade\n`
  }

  if (cache.behind > 0) {
    return `\n  Update available: ${cache.behind} new commit(s)\n  Run: buildpact upgrade\n`
  }

  return null
}
