/**
 * Pure functions for the --discuss quick flow.
 * Generates clarifying questions and builds refined specs from answers.
 * No side effects — fully unit-testable.
 * @see FR-402
 */

/** A single clarifying question with selectable options */
export type QuickQuestion = {
  text: string
  options: string[]
}

/** A collected answer from the discuss flow */
export type QuickAnswer = {
  questionIndex: number
  selectedOption: string
  freeText?: string
}

/** Technical keywords that indicate a concrete description (triggers question reduction) */
const TECHNICAL_TERMS = new Set([
  'api', 'database', 'schema', 'migration', 'endpoint', 'query', 'index',
  'table', 'column', 'cache', 'redis', 'queue', 'webhook', 'socket',
  'auth', 'jwt', 'oauth', 'cors', 'middleware', 'route', 'controller',
  'component', 'hook', 'state', 'reducer', 'context', 'provider',
  'docker', 'kubernetes', 'ci', 'pipeline', 'deploy', 'nginx',
  'test', 'mock', 'stub', 'fixture', 'coverage', 'e2e', 'integration',
  'typescript', 'eslint', 'prettier', 'webpack', 'vite', 'rollup',
  'postgres', 'mysql', 'mongodb', 'sqlite', 'prisma', 'drizzle',
  'rest', 'graphql', 'grpc', 'websocket', 'sse', 'polling',
  'rollback', 'soft-delete', 'foreign-key', 'constraint', 'trigger',
])

/**
 * Count distinct technical terms in a description.
 * Used to determine if the description is already specific enough
 * to reduce the question count.
 */
function countTechnicalTerms(description: string): number {
  const words = description.toLowerCase().split(/[\s\-_/]+/)
  const found = new Set<string>()
  for (const word of words) {
    const clean = word.replace(/[^a-z0-9-]/g, '')
    if (TECHNICAL_TERMS.has(clean)) {
      found.add(clean)
    }
  }
  return found.size
}

/** The 5 default question templates for discuss mode */
const QUESTION_TEMPLATES: Array<{
  dimension: string
  text: string
  options: string[]
}> = [
  {
    dimension: 'scope',
    text: 'What is the target scope of this change?',
    options: [
      'This module only',
      'Entire system',
      'Specific endpoints',
    ],
  },
  {
    dimension: 'approach',
    text: 'What approach should be used?',
    options: [
      'Minimal change',
      'Best practices',
      'Match existing pattern',
    ],
  },
  {
    dimension: 'constraints',
    text: 'Any constraints to keep in mind?',
    options: [
      'No breaking changes',
      'Backward compatible',
      'No new dependencies',
    ],
  },
  {
    dimension: 'expected',
    text: 'What is the expected behavior on success?',
    options: [
      'Silent / no output',
      'Log message',
      'User notification',
    ],
  },
  {
    dimension: 'edges',
    text: 'How should edge cases be handled?',
    options: [
      'None — happy path only',
      'Standard error handling',
      'Full defensive coding',
    ],
  },
]

/** The label used for the "Other (free text)" option — last in every question */
const OTHER_OPTION = 'Other (free text)'

/**
 * Generate 3–5 clarifying questions based on the task description.
 *
 * - Returns 5 questions by default (scope, approach, constraints, expected, edges).
 * - Reduces to 3 questions (scope, approach, constraints) when the description
 *   already contains ≥ 3 distinct technical terms.
 * - Every question's `options` array ends with "Other (free text)".
 */
export function generateDiscussQuestions(description: string): QuickQuestion[] {
  const techTermCount = countTechnicalTerms(description)
  const questionCount = techTermCount >= 3 ? 3 : 5
  const templates = QUESTION_TEMPLATES.slice(0, questionCount)

  return templates.map((t) => ({
    text: t.text,
    options: [...t.options, OTHER_OPTION],
  }))
}

/**
 * Build a refined spec string incorporating answers from the discuss flow.
 *
 * - Format: `## Quick Spec\n- bullet\n...`
 * - Each bullet reflects a specific answer, not generic assumptions.
 * - If answers is empty, falls back to description-only bullets.
 */
export function buildRefinedSpec(description: string, answers: QuickAnswer[]): string {
  const lines: string[] = ['## Quick Spec', '']

  if (answers.length === 0) {
    lines.push(`- Implement: ${description}`)
    lines.push('- Follow existing patterns and conventions')
    lines.push('- Ensure all tests pass after the change')
    return lines.join('\n')
  }

  lines.push(`- **Goal**: ${description}`)

  const dimensions = ['scope', 'approach', 'constraints', 'expected', 'edges']
  for (const answer of answers) {
    const dimension = dimensions[answer.questionIndex] ?? `question-${answer.questionIndex}`
    const value = answer.freeText ?? answer.selectedOption
    lines.push(`- **${capitalize(dimension)}**: ${value}`)
  }

  return lines.join('\n')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
