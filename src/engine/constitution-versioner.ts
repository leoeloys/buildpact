/**
 * Constitution versioning — diff constitution changes and generate update checklists.
 * Tracks what changed, stated reason, and downstream artifacts needing review.
 * @module engine/constitution-versioner
 * @see FR-209 — Constitution Versioning & Change Tracking (US-009)
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { ok, err, ERROR_CODES, type Result } from '../contracts/errors.js'
import { extractPrinciples } from './constitution-enforcer.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A change detected in a single constitution principle (section) */
export interface PrincipleChange {
  /** Section name, e.g. "Coding Standards" */
  name: string
  /** How this section changed between old and new versions */
  type: 'added' | 'removed' | 'modified'
  /** Rules from the old version (undefined for 'added') */
  oldRules?: string[]
  /** Rules from the new version (undefined for 'removed') */
  newRules?: string[]
}

/** A downstream artifact (spec or plan) that references a changed principle */
export interface DownstreamArtifact {
  /** Path relative to projectDir */
  path: string
  /** Which changed principle names appear in this file */
  referencedPrinciples: string[]
  /** Human-readable recommended action */
  recommendedAction: string
}

/** Data model for the update checklist */
export interface UpdateChecklist {
  /** ISO timestamp of generation */
  generatedAt: string
  /** All detected principle changes */
  changes: PrincipleChange[]
  /** User-stated reason for the change */
  reason: string
  /** Downstream artifacts that reference changed principles */
  artifacts: DownstreamArtifact[]
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/**
 * Diff two constitution markdown versions and return the list of changed principles.
 * Uses extractPrinciples to parse both versions, then compares rule sets.
 */
export function diffConstitutionPrinciples(
  oldContent: string,
  newContent: string,
): PrincipleChange[] {
  const oldPrinciples = extractPrinciples(oldContent)
  const newPrinciples = extractPrinciples(newContent)

  const oldMap = new Map(oldPrinciples.map((p) => [p.name, p.rules]))
  const newMap = new Map(newPrinciples.map((p) => [p.name, p.rules]))

  const changes: PrincipleChange[] = []

  // Detect modified or removed
  for (const [name, oldRules] of oldMap) {
    const newRules = newMap.get(name)
    if (newRules === undefined) {
      changes.push({ name, type: 'removed', oldRules })
    } else if (JSON.stringify(oldRules) !== JSON.stringify(newRules)) {
      changes.push({ name, type: 'modified', oldRules, newRules })
    }
  }

  // Detect added
  for (const [name, newRules] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({ name, type: 'added', newRules })
    }
  }

  return changes
}

// ---------------------------------------------------------------------------
// Downstream artifact scanner
// ---------------------------------------------------------------------------

/**
 * Scan .buildpact/specs/ and .buildpact/plans/ for markdown files that
 * reference any of the given changed principle names (case-insensitive).
 */
export async function scanDownstreamArtifacts(
  projectDir: string,
  changedPrincipleNames: string[],
): Promise<DownstreamArtifact[]> {
  if (changedPrincipleNames.length === 0) return []

  const dirsToScan = [
    join(projectDir, '.buildpact', 'specs'),
    join(projectDir, '.buildpact', 'plans'),
  ]

  const artifacts: DownstreamArtifact[] = []

  for (const dir of dirsToScan) {
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      continue // Directory doesn't exist — skip silently
    }

    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const filePath = join(dir, file)
      let content: string
      try {
        content = await readFile(filePath, 'utf-8')
      } catch {
        continue
      }

      const lowerContent = content.toLowerCase()
      const referenced = changedPrincipleNames.filter((name) =>
        lowerContent.includes(name.toLowerCase()),
      )

      if (referenced.length > 0) {
        artifacts.push({
          path: relative(projectDir, filePath),
          referencedPrinciples: referenced,
          recommendedAction: 'Review for compliance with updated Constitution rules',
        })
      }
    }
  }

  return artifacts
}

// ---------------------------------------------------------------------------
// Checklist builder
// ---------------------------------------------------------------------------

/**
 * Build the markdown content for the constitution update checklist.
 */
export function buildChecklistContent(checklist: UpdateChecklist): string {
  const lines: string[] = [
    '# Constitution Update Checklist',
    '',
    `Generated: ${checklist.generatedAt}`,
    '',
  ]

  // --- What Changed ---
  lines.push('## What Changed', '')

  if (checklist.changes.length === 0) {
    lines.push('_No principle changes detected._', '')
  } else {
    for (const change of checklist.changes) {
      if (change.type === 'added') {
        lines.push(`### ${change.name} _(added)_`, '')
        for (const rule of change.newRules ?? []) {
          lines.push(`+ ${rule}`)
        }
        lines.push('')
      } else if (change.type === 'removed') {
        lines.push(`### ${change.name} _(removed)_`, '')
        for (const rule of change.oldRules ?? []) {
          lines.push(`- ~~${rule}~~`)
        }
        lines.push('')
      } else {
        // modified
        lines.push(`### ${change.name} _(modified)_`, '')
        const newSet = new Set(change.newRules ?? [])
        const oldSet = new Set(change.oldRules ?? [])
        for (const rule of change.oldRules ?? []) {
          if (!newSet.has(rule)) lines.push(`- ~~${rule}~~`)
        }
        for (const rule of change.newRules ?? []) {
          if (!oldSet.has(rule)) lines.push(`+ ${rule}`)
          else lines.push(`  ${rule}`)
        }
        lines.push('')
      }
    }
  }

  // --- Reason ---
  lines.push('## Reason for Change', '')
  lines.push(checklist.reason || '_No reason provided._', '')

  // --- Downstream Artifacts ---
  lines.push('## Downstream Artifacts Requiring Review', '')

  if (checklist.artifacts.length === 0) {
    lines.push('_No existing specs or plans reference the changed principles._', '')
  } else {
    for (const artifact of checklist.artifacts) {
      lines.push(`### \`${artifact.path}\``, '')
      lines.push(`- **References**: ${artifact.referencedPrinciples.join(', ')}`)
      lines.push(`- **Action**: ${artifact.recommendedAction}`)
      lines.push('')
    }
  }

  lines.push(
    '---',
    '*Review each artifact above against the updated Constitution rules before proceeding.*',
    '',
  )

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// File writer
// ---------------------------------------------------------------------------

/**
 * Write the update checklist to .buildpact/constitution_update_checklist.md.
 * Returns the absolute path to the written file on success.
 */
export async function writeUpdateChecklist(
  projectDir: string,
  checklist: UpdateChecklist,
): Promise<Result<string>> {
  const content = buildChecklistContent(checklist)
  const filePath = join(projectDir, '.buildpact', 'constitution_update_checklist.md')
  try {
    await mkdir(join(projectDir, '.buildpact'), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
    return ok(filePath)
  } catch (cause) {
    return err({ code: ERROR_CODES.FILE_WRITE_FAILED, i18nKey: 'error.file.write_failed', cause })
  }
}
