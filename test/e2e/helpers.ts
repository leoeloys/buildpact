/**
 * E2E test infrastructure — shared helpers for full pipeline tests.
 * Creates isolated temporary projects with BuildPact initialized and Software Squad installed.
 */
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Result } from '../../src/contracts/errors.js'

// ---------------------------------------------------------------------------
// Temp project creation
// ---------------------------------------------------------------------------

/** Options for creating a temp project */
export interface TempProjectOptions {
  /** Squad to install — defaults to 'software' */
  squad?: string
  /** Language — defaults to 'en' */
  lang?: 'en' | 'pt-br'
  /** Experience level — defaults to 'intermediate' */
  experienceLevel?: 'beginner' | 'intermediate' | 'expert'
}

/** Created temp project info */
export interface TempProject {
  dir: string
  cleanup: () => Promise<void>
}

/**
 * Create a temporary project directory with .buildpact/ initialized.
 * Includes config.yaml, constitution.md, and Software Squad structure.
 */
export async function createTempProject(opts: TempProjectOptions = {}): Promise<TempProject> {
  const { squad = 'software', lang = 'en', experienceLevel = 'intermediate' } = opts
  const dir = await mkdtemp(join(tmpdir(), 'buildpact-e2e-'))

  // Create .buildpact/ structure
  await mkdir(join(dir, '.buildpact', 'audit'), { recursive: true })
  await mkdir(join(dir, '.buildpact', 'specs'), { recursive: true })
  await mkdir(join(dir, '.buildpact', 'plans'), { recursive: true })
  await mkdir(join(dir, '.buildpact', 'squads', squad), { recursive: true })
  await mkdir(join(dir, '.buildpact', 'memory', 'feedback'), { recursive: true })
  await mkdir(join(dir, '.buildpact', 'memory', 'lessons'), { recursive: true })

  // Write config.yaml
  await writeFile(
    join(dir, '.buildpact', 'config.yaml'),
    [
      `project_name: "e2e-test"`,
      `language: "${lang}"`,
      `experience_level: "${experienceLevel}"`,
      `active_squad: "${squad}"`,
      `active_model_profile: "balanced"`,
      `created_at: "${new Date().toISOString().slice(0, 10)}"`,
    ].join('\n'),
    'utf-8',
  )

  // Write constitution.md
  await writeFile(
    join(dir, '.buildpact', 'constitution.md'),
    [
      '# Project Constitution — E2E Test',
      '',
      '## Immutable Principles',
      '',
      '### Coding Standards',
      '- Use TypeScript strict mode',
      '- ESM modules only',
      '',
      '### Compliance Requirements',
      'None',
      '',
      '### Architectural Constraints',
      '- Layered architecture',
      '',
      '### Quality Gates',
      '- All tests must pass',
      '',
      '## Domain-Specific Rules',
      'N/A',
      '',
      '## Version History',
      '| Date | Change | Reason |',
      '|------|--------|--------|',
      `| ${new Date().toISOString().slice(0, 10)} | Initial creation | E2E test |`,
    ].join('\n'),
    'utf-8',
  )

  // Write squad.yaml
  await writeFile(
    join(dir, '.buildpact', 'squads', squad, 'squad.yaml'),
    [
      `name: "${squad}"`,
      `version: "1.0.0"`,
      `domain: "software"`,
      `description: "E2E test squad"`,
      `initial_level: "L2"`,
    ].join('\n'),
    'utf-8',
  )

  return {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  }
}

// ---------------------------------------------------------------------------
// Command invocation helper
// ---------------------------------------------------------------------------

/**
 * Invoke a BuildPact command handler programmatically.
 * Sets process.cwd() to the project directory and imports the handler.
 * Returns the Result from the handler.
 */
export async function runBpCommand(
  dir: string,
  command: string,
  args: string[] = [],
): Promise<Result<unknown>> {
  const originalCwd = process.cwd()
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
  try {
    let handler: { run: (args: string[]) => Promise<Result<unknown>> }

    switch (command) {
      case 'specify': {
        const mod = await import('../../src/commands/specify/handler.js')
        handler = mod.handler
        break
      }
      case 'plan': {
        const mod = await import('../../src/commands/plan/handler.js')
        handler = mod.handler
        break
      }
      case 'execute': {
        const mod = await import('../../src/commands/execute/handler.js')
        handler = mod.handler
        break
      }
      case 'verify': {
        const mod = await import('../../src/commands/verify/handler.js')
        handler = mod.handler
        break
      }
      case 'quick': {
        const mod = await import('../../src/commands/quick/index.js')
        handler = mod.handler
        break
      }
      default:
        throw new Error(`Unknown command: ${command}`)
    }

    return await handler.run(args)
  } finally {
    cwdSpy.mockRestore()
  }
}

// ---------------------------------------------------------------------------
// Structural snapshot comparison
// ---------------------------------------------------------------------------

/** Structure extracted from a markdown file for snapshot comparison */
export interface MarkdownStructure {
  headings: string[]
  sections: string[]
  bulletCount: number
  hasCodeBlocks: boolean
}

/** Extract structural elements from markdown content */
export function extractMarkdownStructure(content: string): MarkdownStructure {
  const lines = content.split('\n')
  const headings: string[] = []
  const sections: string[] = []
  let bulletCount = 0
  let hasCodeBlocks = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^#{1,6}\s/.test(trimmed)) {
      headings.push(trimmed)
      // Section name is the heading text without #
      sections.push(trimmed.replace(/^#+\s*/, ''))
    }
    if (/^[-*]\s/.test(trimmed)) {
      bulletCount++
    }
    if (trimmed.startsWith('```')) {
      hasCodeBlocks = true
    }
  }

  return { headings, sections, bulletCount, hasCodeBlocks }
}

/**
 * Compare two markdown structures for snapshot validation.
 * Returns an array of differences (empty = match).
 */
export function compareStructures(
  actual: MarkdownStructure,
  expected: MarkdownStructure,
): string[] {
  const diffs: string[] = []

  // Check required sections are present
  for (const section of expected.sections) {
    if (!actual.sections.includes(section)) {
      diffs.push(`Missing section: "${section}"`)
    }
  }

  // Check heading count
  if (actual.headings.length < expected.headings.length) {
    diffs.push(
      `Expected at least ${expected.headings.length} headings, got ${actual.headings.length}`,
    )
  }

  return diffs
}

// ---------------------------------------------------------------------------
// File assertion helpers
// ---------------------------------------------------------------------------

/** Check if a file exists */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** Read file content or return undefined if not found */
export async function readFileOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return undefined
  }
}

/** List files in directory or return empty array if not found */
export async function listDirOrEmpty(path: string): Promise<string[]> {
  try {
    return await readdir(path)
  } catch {
    return []
  }
}

// vi is available globally in vitest
import { vi } from 'vitest'
