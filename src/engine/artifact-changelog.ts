/**
 * Artifact Changelog — automatic change tracking for official project documents.
 * Every Write/Edit to a spec, plan, PRD, architecture, or constitution is recorded
 * with what changed, why, and which task caused it.
 * @module engine/artifact-changelog
 * @see Original BuildPact concept 16.5
 */

import { readFile, mkdir, appendFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { ArtifactChangeEntry, ArtifactType } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Official artifact detection
// ---------------------------------------------------------------------------

/** Patterns that identify official project artifacts */
const ARTIFACT_PATTERNS: Array<{ pattern: RegExp; type: ArtifactType }> = [
  { pattern: /prd\.md$/i, type: 'prd' },
  { pattern: /spec\.md$/i, type: 'spec' },
  { pattern: /plan\.md$/i, type: 'plan' },
  { pattern: /architecture\.md$/i, type: 'architecture' },
  { pattern: /constitution\.md$/i, type: 'constitution' },
  { pattern: /epics\.md$/i, type: 'epics' },
  { pattern: /stories\.md$/i, type: 'stories' },
]

/**
 * Check if a file path corresponds to an official project artifact.
 * Returns the artifact type if matched, undefined otherwise.
 */
export function detectArtifactType(filePath: string): ArtifactType | undefined {
  const name = basename(filePath).toLowerCase()
  for (const { pattern, type } of ARTIFACT_PATTERNS) {
    if (pattern.test(name)) return type
  }
  return undefined
}

/**
 * Check if a path is an official artifact.
 */
export function isOfficialArtifact(filePath: string): boolean {
  return detectArtifactType(filePath) !== undefined
}

// ---------------------------------------------------------------------------
// Change entry counter
// ---------------------------------------------------------------------------

let changeCounter = 0

/** Reset counter (for testing) */
export function resetChangeCounter(): void {
  changeCounter = 0
}

// ---------------------------------------------------------------------------
// Change entry creation and validation
// ---------------------------------------------------------------------------

/**
 * Create a changelog entry for an artifact change.
 * Pure factory — call validateChangeEntry to check required fields.
 */
export function createChangeEntry(
  artifactPath: string,
  changeType: ArtifactChangeEntry['changeType'],
  summary: string,
  reason: string,
  causedBy: string,
  diff?: string,
  impact?: string[],
): ArtifactChangeEntry {
  changeCounter++
  const id = `ACH-${String(changeCounter).padStart(3, '0')}`
  const artifactType = detectArtifactType(artifactPath) ?? 'spec'

  return {
    id,
    artifactPath,
    artifactType,
    timestamp: new Date().toISOString(),
    changeType,
    summary,
    reason,
    causedBy,
    diff: diff ?? '',
    impact: impact ?? [],
  }
}

/**
 * Validate that a change entry has required fields.
 * Rejects entries without reason or causal task.
 */
export function validateChangeEntry(entry: ArtifactChangeEntry): Result<void> {
  if (!entry.reason || entry.reason.trim() === '') {
    return err({
      code: ERROR_CODES.ARTIFACT_CHANGE_NO_REASON,
      i18nKey: 'error.artifact_changelog.no_reason',
      params: { artifact: entry.artifactPath, change: entry.summary },
    })
  }

  if (!entry.causedBy || entry.causedBy.trim() === '') {
    return err({
      code: ERROR_CODES.ARTIFACT_CHANGE_NO_CAUSAL_TASK,
      i18nKey: 'error.artifact_changelog.no_causal_task',
      params: { artifact: entry.artifactPath },
    })
  }

  return ok(undefined)
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Append a change entry to the appropriate changelog file.
 * Changelogs are stored per artifact type: `.buildpact/changelogs/{type}.md`
 */
export async function appendToChangelog(
  projectDir: string,
  entry: ArtifactChangeEntry,
): Promise<Result<void>> {
  const validation = validateChangeEntry(entry)
  if (!validation.ok) return validation

  const changelogDir = join(projectDir, '.buildpact', 'changelogs')
  await mkdir(changelogDir, { recursive: true })

  const changelogPath = join(changelogDir, `${entry.artifactType}.md`)

  const formatted = [
    '',
    `### ${entry.timestamp} — ${entry.changeType.toUpperCase()} [${entry.id}]`,
    `**Artifact:** ${entry.artifactPath}`,
    `**Summary:** ${entry.summary}`,
    `**Reason:** ${entry.reason}`,
    `**Caused by:** ${entry.causedBy}`,
    entry.diff ? `**Diff:** ${entry.diff}` : '',
    entry.impact.length > 0 ? `**Impact:** ${entry.impact.join(', ')}` : '',
    '',
  ].filter(Boolean).join('\n')

  try {
    await appendFile(changelogPath, formatted, 'utf-8')
    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path: changelogPath },
    })
  }
}

/**
 * Format a change entry for display.
 */
export function formatChangeEntry(entry: ArtifactChangeEntry): string {
  return `[${entry.id}] ${entry.artifactType}:${entry.changeType} — ${entry.summary} (reason: ${entry.reason}, caused by: ${entry.causedBy})`
}
