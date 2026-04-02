// Execution Lock — Atomic Checkout for Wave Execution
// Prevents concurrent execution sessions on the same spec
// Inspired by Paperclip's atomic checkout with 409 Conflict pattern

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

/** Max age in ms before a lock is considered stale (30 minutes) */
const STALE_LOCK_AGE_MS = 30 * 60 * 1000

export interface LockFile {
  pid: number
  started: string   // ISO timestamp
  spec: string
  sessionId: string
}

export type LockAcquireResult =
  | { acquired: true; lockPath: string }
  | { acquired: false; reason: 'active' | 'stale_removed'; existing?: LockFile }

/**
 * Attempt to acquire execution lock for a spec.
 * Returns acquired:true if lock was obtained, acquired:false if another session holds it.
 */
export function acquireExecutionLock(
  projectDir: string,
  specSlug: string,
  sessionId: string
): LockAcquireResult {
  const lockPath = join(projectDir, '.buildpact', 'plans', specSlug, '.execution-lock')

  if (existsSync(lockPath)) {
    let existing: LockFile | undefined
    try {
      existing = JSON.parse(readFileSync(lockPath, 'utf8')) as LockFile
    } catch {
      // Malformed lock file — treat as stale
    }

    const age = existing ? Date.now() - new Date(existing.started).getTime() : Infinity

    if (age < STALE_LOCK_AGE_MS && existing) {
      // Active lock — another session is running
      return { acquired: false, reason: 'active', existing }
    }

    // Stale lock — remove, acquire, and continue
    try { unlinkSync(lockPath) } catch { /* ignore */ }
    writeLockFile(lockPath, specSlug, sessionId)
    return { acquired: true, lockPath }
  }

  writeLockFile(lockPath, specSlug, sessionId)
  return { acquired: true, lockPath }
}

/**
 * Release the execution lock. Always call on exit (success or failure).
 */
export function releaseExecutionLock(projectDir: string, specSlug: string): void {
  const lockPath = join(projectDir, '.buildpact', 'plans', specSlug, '.execution-lock')
  if (existsSync(lockPath)) {
    try { unlinkSync(lockPath) } catch { /* ignore */ }
  }
}

/**
 * Format a human-readable conflict message.
 */
export function formatLockConflict(existing: LockFile): string {
  const age = Math.round((Date.now() - new Date(existing.started).getTime()) / 1000 / 60)
  return [
    `⚠️  Execution lock held by another session (${age} min ago)`,
    `   PID: ${existing.pid} | Started: ${existing.started}`,
    `   Spec: ${existing.spec}`,
    ``,
    `To force unlock: rm .buildpact/plans/${existing.spec}/.execution-lock`,
  ].join('\n')
}

function writeLockFile(lockPath: string, spec: string, sessionId: string): void {
  const lock: LockFile = {
    pid: process.pid,
    started: new Date().toISOString(),
    spec,
    sessionId
  }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf8')
}
