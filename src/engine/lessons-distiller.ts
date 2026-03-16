/**
 * Lessons Distiller — Memory Layer Tier 2 (Beta).
 * Analyzes recurring feedback patterns and distills them into lesson files
 * stored in .buildpact/memory/lessons/ for systematic reuse across sessions.
 * @see FR-805 — Memory Layer Tier 2 (Lessons & Patterns)
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'
import type { FeedbackFile } from './session-feedback.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of sessions before auto-distillation is triggered */
export const LESSONS_DISTILL_THRESHOLD = 5

/** Minimum times an AC must fail across sessions to become a lesson */
export const LESSONS_MIN_FAIL_COUNT = 2

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A recurring failure pattern found across feedback sessions */
export interface PatternMatch {
  /** The acceptance criterion text that recurs */
  acText: string
  /** Number of sessions where this AC failed */
  failCount: number
  /** Slugs of specs where this AC was observed failing */
  slugs: string[]
  /** Notes collected across sessions for this AC */
  commonNotes: string[]
}

/** A distilled lesson entry derived from recurring patterns */
export interface LessonEntry {
  /** Stable ID derived from AC text */
  id: string
  /** The AC pattern this lesson addresses */
  acPattern: string
  /** Number of failures that triggered this lesson */
  failCount: number
  /** ISO timestamp when this lesson was distilled */
  learnedAt: string
  /** Actionable recommendation to avoid this failure */
  recommendation: string
  /** Slugs of specs where this pattern was observed */
  affectedSlugs: string[]
}

/** Persisted lessons file structure */
export interface LessonsFile {
  /** ISO timestamp of last distillation run */
  distilledAt: string
  /** Total sessions analyzed to produce this lessons set */
  totalSessionsAnalyzed: number
  /** Distilled lesson entries */
  lessons: LessonEntry[]
}

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Determine whether distillation should run based on session count.
 * Returns true when totalSessions reaches the threshold.
 */
export function shouldDistill(totalSessions: number, threshold = LESSONS_DISTILL_THRESHOLD): boolean {
  return totalSessions >= threshold
}

/**
 * Slugify an AC text to a stable identifier string.
 * Lowercased, non-alphanumeric chars replaced with hyphens, trimmed.
 */
export function slugifyAc(acText: string): string {
  return acText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Build a contextual recommendation for a lesson based on its AC pattern.
 * Uses keyword heuristics to produce actionable guidance.
 */
export function buildRecommendation(acText: string, notes: string[]): string {
  const lower = acText.toLowerCase()
  const noteSummary = notes.length > 0 ? ` Common notes: ${notes.slice(0, 2).join('; ')}.` : ''

  if (lower.includes('test') || lower.includes('spec')) {
    return `Ensure tests are written and passing before verification.${noteSummary}`
  }
  if (lower.includes('typecheck') || lower.includes('type check')) {
    return `Run typecheck (tsc --noEmit) before verification and resolve all type errors.${noteSummary}`
  }
  if (lower.includes('lint')) {
    return `Run linter before verification and fix all lint errors.${noteSummary}`
  }
  if (lower.includes('file') || lower.includes('creat') || lower.includes('generat')) {
    return `Verify that expected files are created at the correct paths with the correct content.${noteSummary}`
  }
  if (lower.includes('command') || lower.includes('cli')) {
    return `Run the CLI command manually and confirm expected output before verification.${noteSummary}`
  }
  if (lower.includes('error') || lower.includes('fail')) {
    return `Review error handling paths and test edge cases before verification.${noteSummary}`
  }
  if (lower.includes('log') || lower.includes('audit')) {
    return `Confirm audit log entries are written after each relevant operation.${noteSummary}`
  }

  return `Review this criterion carefully before the next session — it has failed repeatedly.${noteSummary}`
}

/**
 * Analyze feedback files to find recurring failure patterns.
 * Returns PatternMatch[] for ACs that failed in at least minFailCount sessions.
 */
export function analyzePatterns(
  feedbackFiles: FeedbackFile[],
  minFailCount = LESSONS_MIN_FAIL_COUNT,
): PatternMatch[] {
  // Collect fail counts and notes per AC text
  const failMap = new Map<string, { count: number; slugs: string[]; notes: string[] }>()

  for (const file of feedbackFiles) {
    for (const entry of file.entries) {
      for (const ac of entry.failedAcs) {
        const existing = failMap.get(ac)
        const note = entry.notes[ac]
        if (existing) {
          existing.count += 1
          if (!existing.slugs.includes(entry.slug)) {
            existing.slugs.push(entry.slug)
          }
          if (note && !existing.notes.includes(note)) {
            existing.notes.push(note)
          }
        } else {
          failMap.set(ac, {
            count: 1,
            slugs: [entry.slug],
            notes: note ? [note] : [],
          })
        }
      }
    }
  }

  const patterns: PatternMatch[] = []
  for (const [acText, data] of failMap) {
    if (data.count >= minFailCount) {
      patterns.push({
        acText,
        failCount: data.count,
        slugs: data.slugs,
        commonNotes: data.notes,
      })
    }
  }

  // Sort by failCount descending (most problematic first)
  patterns.sort((a, b) => b.failCount - a.failCount)

  return patterns
}

/**
 * Build a LessonEntry from a PatternMatch.
 * Pure function — no side effects.
 */
export function buildLessonEntry(pattern: PatternMatch): LessonEntry {
  return {
    id: slugifyAc(pattern.acText),
    acPattern: pattern.acText,
    failCount: pattern.failCount,
    learnedAt: new Date().toISOString(),
    recommendation: buildRecommendation(pattern.acText, pattern.commonNotes),
    affectedSlugs: pattern.slugs,
  }
}

/**
 * Count total sessions across all feedback files.
 */
export function countTotalSessions(feedbackFiles: FeedbackFile[]): number {
  return feedbackFiles.reduce((sum, file) => sum + file.entries.length, 0)
}

/**
 * Distill lessons from feedback files into a LessonsFile.
 * Pure function — no I/O side effects.
 */
export function distillLessons(feedbackFiles: FeedbackFile[]): LessonsFile {
  const totalSessions = countTotalSessions(feedbackFiles)
  const patterns = analyzePatterns(feedbackFiles)
  const lessons = patterns.map(buildLessonEntry)

  return {
    distilledAt: new Date().toISOString(),
    totalSessionsAnalyzed: totalSessions,
    lessons,
  }
}

/**
 * Format a LessonsFile as a markdown context block for subagent injection.
 * Pure function — no side effects.
 */
export function formatLessonsForContext(file: LessonsFile): string {
  if (file.lessons.length === 0) return ''

  const lines: string[] = [
    '## Lessons & Patterns Memory (Tier 2)',
    '',
    `_Distilled from ${file.totalSessionsAnalyzed} sessions on ${file.distilledAt.slice(0, 10)}._`,
    '',
  ]

  for (const lesson of file.lessons) {
    lines.push(`### Lesson: ${lesson.acPattern}`)
    lines.push(`- **Failures**: ${lesson.failCount} sessions`)
    lines.push(`- **Recommendation**: ${lesson.recommendation}`)
    if (lesson.affectedSlugs.length > 0) {
      lines.push(`- **Seen in**: ${lesson.affectedSlugs.join(', ')}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// I/O functions
// ---------------------------------------------------------------------------

/**
 * Load the lessons file from the lessons directory, or return an empty LessonsFile.
 */
export async function loadLessonsFile(lessonsDir: string): Promise<LessonsFile> {
  try {
    const lessonsPath = join(lessonsDir, 'lessons.json')
    const raw = await readFile(lessonsPath, 'utf-8')
    return JSON.parse(raw) as LessonsFile
  } catch {
    return {
      distilledAt: new Date().toISOString(),
      totalSessionsAnalyzed: 0,
      lessons: [],
    }
  }
}

/**
 * Write a LessonsFile as JSON to the lessons directory.
 */
export async function writeLessonsFile(
  lessonsDir: string,
  file: LessonsFile,
): Promise<Result<string>> {
  try {
    await mkdir(lessonsDir, { recursive: true })
    const lessonsPath = join(lessonsDir, 'lessons.json')
    await writeFile(lessonsPath, JSON.stringify(file, null, 2), 'utf-8')
    return ok(lessonsPath)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.lessons.write_failed',
    })
  }
}

/**
 * End-to-end: distill lessons from provided feedback files and persist them.
 * Only distills when totalSessions >= threshold.
 * Returns ok(LessonsFile) when distillation runs, ok(undefined) when skipped.
 */
export async function captureDistilledLessons(
  projectDir: string,
  feedbackFiles: FeedbackFile[],
  forceDistill = false,
): Promise<Result<LessonsFile | undefined>> {
  const totalSessions = countTotalSessions(feedbackFiles)

  if (!forceDistill && !shouldDistill(totalSessions)) {
    return ok(undefined)
  }

  const lessonsFile = distillLessons(feedbackFiles)
  const lessonsDir = join(projectDir, '.buildpact', 'memory', 'lessons')
  const writeResult = await writeLessonsFile(lessonsDir, lessonsFile)

  if (!writeResult.ok) {
    return err(writeResult.error)
  }

  return ok(lessonsFile)
}
