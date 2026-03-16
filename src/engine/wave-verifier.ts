/**
 * Wave Verifier — Goal-Backward AC verification after each wave.
 * Checks wave output against relevant spec acceptance criteria before next wave begins.
 * @module engine/wave-verifier
 * @see FR-751 — Goal-Backward Wave Verification (Epic 6.4)
 */

import { extractSpecAcs } from './plan-validator.js'
import type { WaveExecutionResult } from './wave-executor.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Verification result for a single acceptance criterion */
export interface AcVerificationResult {
  /** The acceptance criteria text (lowercased) */
  ac: string
  /** Whether this AC was satisfied by the wave */
  passed: boolean
  /** Task titles in the wave that cover this AC (share keywords) */
  coveringTasks: string[]
}

/** Aggregated verification report for a single wave */
export interface WaveVerificationReport {
  waveNumber: number
  acResults: AcVerificationResult[]
  allPassed: boolean
  passCount: number
  failCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract significant keywords (>4 chars) from text */
function keywordsFrom(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 4)
}

// ---------------------------------------------------------------------------
// Pure functions — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Map spec ACs to those relevant to a given wave.
 * An AC is relevant if any of its keywords appear in any task title in the wave.
 * Pure function — no side effects.
 */
export function mapAcsToWave(specContent: string, taskTitles: string[]): string[] {
  const acs = extractSpecAcs(specContent)
  const taskKeywords = new Set(taskTitles.flatMap(t => keywordsFrom(t)))
  return acs.filter(ac => keywordsFrom(ac).some(kw => taskKeywords.has(kw)))
}

/**
 * Verify each AC relevant to this wave against execution results.
 * An AC passes if at least one task covering it succeeded.
 * Pure function — no side effects.
 */
export function verifyWaveAcs(
  specContent: string,
  waveResult: WaveExecutionResult,
): WaveVerificationReport {
  const taskTitles = waveResult.tasks.map(t => t.title)
  const relevantAcs = mapAcsToWave(specContent, taskTitles)

  const acResults: AcVerificationResult[] = relevantAcs.map(ac => {
    const acKeywords = keywordsFrom(ac)
    const coveringTasks = waveResult.tasks
      .filter(task => acKeywords.some(kw => keywordsFrom(task.title).includes(kw)))
      .map(t => t.title)

    const passed = waveResult.tasks.some(
      task => coveringTasks.includes(task.title) && task.success,
    )

    return { ac, passed, coveringTasks }
  })

  const passCount = acResults.filter(r => r.passed).length
  const failCount = acResults.filter(r => !r.passed).length

  return {
    waveNumber: waveResult.waveNumber,
    acResults,
    allPassed: failCount === 0,
    passCount,
    failCount,
  }
}

/**
 * Format a wave verification report as a markdown string.
 * Pure function — no side effects.
 */
export function formatWaveVerificationReport(report: WaveVerificationReport): string {
  const lines: string[] = [
    `## Wave ${report.waveNumber + 1} Goal-Backward Verification`,
    '',
    `${report.passCount} AC(s) passed | ${report.failCount} AC(s) failed`,
    '',
  ]

  if (report.acResults.length === 0) {
    lines.push('No acceptance criteria mapped to this wave.')
    lines.push('')
    return lines.join('\n')
  }

  for (const result of report.acResults) {
    const icon = result.passed ? '✓' : '✗'
    lines.push(`- ${icon} ${result.ac.slice(0, 100)}`)
    if (!result.passed && result.coveringTasks.length > 0) {
      lines.push(`  - Failed task(s): ${result.coveringTasks.join(', ')}`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * Build a targeted fix plan for failed acceptance criteria.
 * Generates wave plan file content executable via /bp:execute.
 * Pure function — no side effects.
 */
export function buildWaveFixPlan(
  failedAcs: string[],
  waveNumber: number,
  phaseSlug: string,
): string {
  const lines: string[] = [
    `# Fix Plan — ${phaseSlug} — Wave ${waveNumber + 1} Failed Criteria`,
    '',
    '## Tasks',
    '',
  ]

  for (const ac of failedAcs) {
    lines.push(`- [ ] [AGENT] Fix: ${ac.slice(0, 80)}`)
  }

  lines.push('')
  lines.push('## Key References')
  lines.push('')
  lines.push(`- Phase: ${phaseSlug}`)
  lines.push(`- Wave: ${waveNumber + 1}`)
  lines.push(`- Generated: ${new Date().toISOString()}`)
  lines.push('')

  return lines.join('\n')
}
