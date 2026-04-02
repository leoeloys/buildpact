/**
 * Micro-File Architecture — step-based template decomposition.
 * Large templates are split into numbered step files; this engine parses
 * references, loads steps, and tracks completion via frontmatter.
 * @module engine/micro-file-architecture
 * @see BuildPact concept 10.7
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Step reference parsing
// ---------------------------------------------------------------------------

/** Pattern for step file references: {{step:N}} or {{step:NN}} */
const STEP_REF_PATTERN = /\{\{step:(\d+)\}\}/g

/**
 * Parse step file references from template content.
 * Returns an array of step reference strings (e.g. ["step:1", "step:2"]).
 */
export function parseStepReference(templateContent: string): string[] {
  const refs: string[] = []
  // Reset lastIndex to avoid stale state from previous calls (global regex)
  STEP_REF_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null = STEP_REF_PATTERN.exec(templateContent)
  while (match !== null) {
    refs.push(`step:${match[1]}`)
    match = STEP_REF_PATTERN.exec(templateContent)
  }
  return refs
}

// ---------------------------------------------------------------------------
// Step loading
// ---------------------------------------------------------------------------

/**
 * Load a step file from the steps directory.
 * Step files are named `step-{N}.md` (zero-padded to 2 digits).
 */
export async function loadStep(stepsDir: string, stepNumber: number): Promise<Result<string>> {
  const padded = String(stepNumber).padStart(2, '0')
  const stepPath = join(stepsDir, `step-${padded}.md`)

  try {
    const content = await readFile(stepPath, 'utf-8')
    return ok(content)
  } catch {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.file.read_failed',
      params: { path: stepPath },
    })
  }
}

// ---------------------------------------------------------------------------
// Step completion tracking
// ---------------------------------------------------------------------------

/** Pattern for completed steps in frontmatter: completed_steps: [1, 2, 3] */
const COMPLETED_PATTERN = /completed_steps:\s*\[([^\]]*)\]/

/**
 * Check if a step is marked as completed in frontmatter.
 * Looks for `completed_steps: [1, 2, 3]` in YAML frontmatter.
 */
export function isStepCompleted(frontmatter: string, stepNumber: number): boolean {
  const match = COMPLETED_PATTERN.exec(frontmatter)
  if (!match?.[1]) return false

  const completed = match[1]
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(Number)

  return completed.includes(stepNumber)
}

// ---------------------------------------------------------------------------
// Step file creation
// ---------------------------------------------------------------------------

/**
 * Create a new step file in the steps directory.
 */
export async function createStepFile(
  stepsDir: string,
  stepNumber: number,
  goal: string,
  rules: string[],
  content: string,
): Promise<Result<void>> {
  const padded = String(stepNumber).padStart(2, '0')
  const stepPath = join(stepsDir, `step-${padded}.md`)

  const rulesBlock = rules.map(r => `- ${r}`).join('\n')
  const fileContent = [
    '---',
    `step: ${stepNumber}`,
    `goal: "${goal}"`,
    'status: pending',
    '---',
    '',
    `# Step ${stepNumber}: ${goal}`,
    '',
    '## Rules',
    rulesBlock,
    '',
    '## Content',
    content,
    '',
  ].join('\n')

  try {
    await mkdir(stepsDir, { recursive: true })
    await writeFile(stepPath, fileContent, 'utf-8')
    return ok(undefined)
  } catch {
    return err({
      code: ERROR_CODES.FILE_WRITE_FAILED,
      i18nKey: 'error.file.write_failed',
      params: { path: stepPath },
    })
  }
}
