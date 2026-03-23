/**
 * Benchmark Sets — task definitions for evaluating agent variants.
 * Provides built-in software benchmarks and custom YAML loading.
 * @module engine/benchmark-sets
 * @see Epic 23.2: Benchmark Sets
 */

import { readFile } from 'node:fs/promises'
import { ok, err, ERROR_CODES } from '../contracts/errors.js'
import type { Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkTask {
  id: string
  name: string
  domain: string
  input: string
  expectedPatterns: string[] // regex patterns the output should match
  qualityRubric: { maxScore: number; criteria: string[] }
  maxCostUsd: number
}

export interface BenchmarkSet {
  name: string
  domain: string
  tasks: BenchmarkTask[]
}

// ---------------------------------------------------------------------------
// Built-in benchmarks
// ---------------------------------------------------------------------------

const SOFTWARE_BENCHMARKS: BenchmarkTask[] = [
  {
    id: 'sw-codegen-01',
    name: 'Code Generation',
    domain: 'software',
    input: 'Generate a TypeScript function that validates email addresses',
    expectedPatterns: [
      'function',
      'email',
      '@',
      'return',
    ],
    qualityRubric: {
      maxScore: 10,
      criteria: [
        'Correct regex or validation logic',
        'Handles edge cases',
        'TypeScript types used',
        'JSDoc present',
      ],
    },
    maxCostUsd: 0.05,
  },
  {
    id: 'sw-bugfix-01',
    name: 'Bug Fix',
    domain: 'software',
    input: 'Fix the off-by-one error in the array iteration loop',
    expectedPatterns: [
      'for',
      'length',
      'fix',
    ],
    qualityRubric: {
      maxScore: 10,
      criteria: [
        'Correctly identifies the bug',
        'Provides working fix',
        'Explains the root cause',
      ],
    },
    maxCostUsd: 0.03,
  },
  {
    id: 'sw-test-01',
    name: 'Test Writing',
    domain: 'software',
    input: 'Write unit tests for a user authentication service',
    expectedPatterns: [
      'describe|it|test',
      'expect',
      'auth',
    ],
    qualityRubric: {
      maxScore: 10,
      criteria: [
        'Covers happy path',
        'Covers error cases',
        'Uses proper assertions',
        'Mocks external dependencies',
      ],
    },
    maxCostUsd: 0.04,
  },
  {
    id: 'sw-docs-01',
    name: 'Documentation',
    domain: 'software',
    input: 'Document the REST API endpoints for a todo application',
    expectedPatterns: [
      'GET|POST|PUT|DELETE',
      'endpoint',
      'response',
    ],
    qualityRubric: {
      maxScore: 10,
      criteria: [
        'All CRUD endpoints documented',
        'Request/response examples',
        'Error codes listed',
      ],
    },
    maxCostUsd: 0.03,
  },
  {
    id: 'sw-refactor-01',
    name: 'Refactoring',
    domain: 'software',
    input: 'Refactor a 200-line function into smaller, testable units',
    expectedPatterns: [
      'function',
      'export',
      'extract',
    ],
    qualityRubric: {
      maxScore: 10,
      criteria: [
        'Single responsibility per function',
        'No behavior changes',
        'Improved readability',
        'Functions are testable',
      ],
    },
    maxCostUsd: 0.05,
  },
]

const BUILTIN_DOMAINS: Record<string, BenchmarkSet> = {
  software: {
    name: 'Software Engineering Benchmarks',
    domain: 'software',
    tasks: SOFTWARE_BENCHMARKS,
  },
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Return built-in benchmarks for the given domain.
 * Currently supports 'software' with 5 tasks.
 */
export function loadBuiltInBenchmark(domain: string): BenchmarkSet {
  const set = BUILTIN_DOMAINS[domain]
  if (set) return set

  return {
    name: `Empty benchmark set for ${domain}`,
    domain,
    tasks: [],
  }
}

/**
 * Load a custom benchmark set from a YAML file.
 * Expected path: `.buildpact/benchmarks/<name>.yaml`
 *
 * Accepts a simplified JSON/YAML-like format. For Alpha, we parse a
 * JSON file (YAML support deferred to Beta).
 */
export async function loadCustomBenchmark(
  path: string,
): Promise<Result<BenchmarkSet>> {
  try {
    const content = await readFile(path, 'utf-8')
    const parsed: unknown = JSON.parse(content)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('name' in parsed) ||
      !('domain' in parsed) ||
      !('tasks' in parsed)
    ) {
      return err({
        code: ERROR_CODES.CONFIG_INVALID,
        i18nKey: 'error.benchmark.invalid_format',
        params: { path },
      })
    }

    const obj = parsed as Record<string, unknown>
    const tasks = obj['tasks']
    if (!Array.isArray(tasks)) {
      return err({
        code: ERROR_CODES.CONFIG_INVALID,
        i18nKey: 'error.benchmark.invalid_format',
        params: { path },
      })
    }

    return ok({
      name: String(obj['name']),
      domain: String(obj['domain']),
      tasks: tasks as BenchmarkTask[],
    })
  } catch (cause) {
    return err({
      code: ERROR_CODES.FILE_READ_FAILED,
      i18nKey: 'error.benchmark.load_failed',
      params: { path },
      cause,
    })
  }
}

/**
 * Score an output string against a benchmark task.
 * Returns a score from 0 to maxScore based on pattern matching.
 * Each matching expectedPattern contributes an equal share of the max score.
 */
export function scoreOutput(output: string, task: BenchmarkTask): number {
  if (task.expectedPatterns.length === 0) return 0

  const perPattern = task.qualityRubric.maxScore / task.expectedPatterns.length
  let total = 0

  for (const pattern of task.expectedPatterns) {
    try {
      const re = new RegExp(pattern, 'i')
      if (re.test(output)) {
        total += perPattern
      }
    } catch {
      // Invalid regex pattern — skip silently
    }
  }

  return Math.min(total, task.qualityRubric.maxScore)
}
