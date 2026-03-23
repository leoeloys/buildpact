// Output Versioning — auto-increment v1/, v2/, v3/ on review cycles
// Inspired by OpenSquad's output versioning pattern

import { existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Determine the next version directory for a spec's output.
 * Scans existing v{N}/ directories and returns the next one.
 */
export function getNextVersionDir(outputDir: string): { version: number; path: string } {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
    return { version: 1, path: join(outputDir, 'v1') }
  }

  const existing = readdirSync(outputDir)
    .filter(d => /^v\d+$/.test(d))
    .map(d => parseInt(d.slice(1), 10))
    .sort((a, b) => a - b)

  const nextVersion = existing.length > 0 ? existing[existing.length - 1]! + 1 : 1
  return { version: nextVersion, path: join(outputDir, `v${nextVersion}`) }
}

/**
 * Get the latest version directory for a spec's output.
 * Returns undefined if no versions exist.
 */
export function getLatestVersionDir(outputDir: string): { version: number; path: string } | undefined {
  if (!existsSync(outputDir)) return undefined

  const existing = readdirSync(outputDir)
    .filter(d => /^v\d+$/.test(d))
    .map(d => parseInt(d.slice(1), 10))
    .sort((a, b) => a - b)

  if (existing.length === 0) return undefined

  const latest = existing[existing.length - 1]!
  return { version: latest, path: join(outputDir, `v${latest}`) }
}

/**
 * Format version info for display.
 */
export function formatVersionInfo(version: number, totalVersions: number): string {
  if (totalVersions <= 1) return `v${version}`
  return `v${version} (${totalVersions} revision${totalVersions > 1 ? 's' : ''} total)`
}

/**
 * Count total versions in an output directory.
 */
export function countVersions(outputDir: string): number {
  if (!existsSync(outputDir)) return 0
  return readdirSync(outputDir).filter(d => /^v\d+$/.test(d)).length
}
