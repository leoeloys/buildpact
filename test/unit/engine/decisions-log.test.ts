import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  slugifyTitle,
  buildDecisionEntry,
  formatDecisionsForContext,
  writeDecisionFile,
  loadAllDecisions,
  captureDecision,
} from '../../../src/engine/decisions-log.js'
import type { DecisionEntry, DecisionInput } from '../../../src/engine/decisions-log.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeInput = (overrides: Partial<DecisionInput> = {}): DecisionInput => ({
  title: 'Use TypeScript strict mode',
  decision: 'Enable strict mode in tsconfig.json',
  rationale: 'Catches type errors at compile time before they reach production',
  alternatives: ['Use loose mode', 'Use no type checking'],
  ...overrides,
})

let tmpDir: string | undefined

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true })
    tmpDir = undefined
  }
})

async function makeTmpDir(): Promise<string> {
  tmpDir = await mkdtemp(join(tmpdir(), 'decisions-log-test-'))
  return tmpDir
}

// ---------------------------------------------------------------------------
// slugifyTitle
// ---------------------------------------------------------------------------

describe('slugifyTitle', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugifyTitle('Use TypeScript')).toBe('use-typescript')
  })

  it('removes leading and trailing hyphens', () => {
    expect(slugifyTitle('!Use TypeScript!')).toBe('use-typescript')
  })

  it('collapses multiple non-alphanumeric chars into one hyphen', () => {
    expect(slugifyTitle('Use  TypeScript (strict mode)')).toBe('use-typescript-strict-mode')
  })

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(80)
    expect(slugifyTitle(long)).toHaveLength(60)
  })

  it('handles empty string', () => {
    expect(slugifyTitle('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// buildDecisionEntry
// ---------------------------------------------------------------------------

describe('buildDecisionEntry', () => {
  it('creates entry with expected fields', () => {
    const input = makeInput()
    const entry = buildDecisionEntry(input)

    expect(entry.id).toBe('use-typescript-strict-mode')
    expect(entry.title).toBe(input.title)
    expect(entry.decision).toBe(input.decision)
    expect(entry.rationale).toBe(input.rationale)
    expect(entry.alternatives).toEqual(input.alternatives)
  })

  it('sets date to today (YYYY-MM-DD)', () => {
    const entry = buildDecisionEntry(makeInput())
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('id matches slugified title', () => {
    const input = makeInput({ title: 'Choose PostgreSQL over MongoDB' })
    const entry = buildDecisionEntry(input)
    expect(entry.id).toBe('choose-postgresql-over-mongodb')
  })

  it('handles empty alternatives', () => {
    const input = makeInput({ alternatives: [] })
    const entry = buildDecisionEntry(input)
    expect(entry.alternatives).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// formatDecisionsForContext
// ---------------------------------------------------------------------------

describe('formatDecisionsForContext', () => {
  it('returns empty string for empty list', () => {
    expect(formatDecisionsForContext([])).toBe('')
  })

  it('includes Tier 3 header', () => {
    const entry = buildDecisionEntry(makeInput())
    const output = formatDecisionsForContext([entry])
    expect(output).toContain('## Decisions Log Memory (Tier 3)')
  })

  it('includes decision title', () => {
    const entry = buildDecisionEntry(makeInput())
    const output = formatDecisionsForContext([entry])
    expect(output).toContain('### Decision: Use TypeScript strict mode')
  })

  it('includes decision, rationale, and date', () => {
    const entry = buildDecisionEntry(makeInput())
    const output = formatDecisionsForContext([entry])
    expect(output).toContain('Enable strict mode in tsconfig.json')
    expect(output).toContain('Catches type errors at compile time')
    expect(output).toContain('**Date**:')
  })

  it('includes alternatives when present', () => {
    const entry = buildDecisionEntry(makeInput())
    const output = formatDecisionsForContext([entry])
    expect(output).toContain('**Alternatives considered**:')
    expect(output).toContain('Use loose mode')
  })

  it('omits alternatives line when empty', () => {
    const entry = buildDecisionEntry(makeInput({ alternatives: [] }))
    const output = formatDecisionsForContext([entry])
    expect(output).not.toContain('**Alternatives considered**:')
  })

  it('renders multiple decisions', () => {
    const entry1 = buildDecisionEntry(makeInput({ title: 'First decision' }))
    const entry2 = buildDecisionEntry(makeInput({ title: 'Second decision' }))
    const output = formatDecisionsForContext([entry1, entry2])
    expect(output).toContain('### Decision: First decision')
    expect(output).toContain('### Decision: Second decision')
  })
})

// ---------------------------------------------------------------------------
// writeDecisionFile / loadAllDecisions
// ---------------------------------------------------------------------------

describe('writeDecisionFile', () => {
  it('writes a JSON file and returns ok(path)', async () => {
    const dir = await makeTmpDir()
    const entry = buildDecisionEntry(makeInput())
    const result = await writeDecisionFile(dir, entry)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('use-typescript-strict-mode.json')
    }
  })

  it('creates directory if it does not exist', async () => {
    const baseDir = await makeTmpDir()
    const nested = join(baseDir, 'a', 'b', 'decisions')
    const entry = buildDecisionEntry(makeInput())
    const result = await writeDecisionFile(nested, entry)
    expect(result.ok).toBe(true)
  })
})

describe('loadAllDecisions', () => {
  it('returns empty array for missing directory', async () => {
    const result = await loadAllDecisions('/nonexistent/decisions/path')
    expect(result).toEqual([])
  })

  it('returns empty array for empty directory', async () => {
    const dir = await makeTmpDir()
    const result = await loadAllDecisions(dir)
    expect(result).toEqual([])
  })

  it('loads written decisions', async () => {
    const dir = await makeTmpDir()
    const entry = buildDecisionEntry(makeInput())
    await writeDecisionFile(dir, entry)

    const loaded = await loadAllDecisions(dir)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.id).toBe('use-typescript-strict-mode')
    expect(loaded[0]!.title).toBe('Use TypeScript strict mode')
  })

  it('loads multiple decisions sorted by date', async () => {
    const dir = await makeTmpDir()
    const entry1 = buildDecisionEntry(makeInput({ title: 'First decision' }))
    const entry2 = buildDecisionEntry(makeInput({ title: 'Second decision' }))
    // Override dates to test sorting
    entry1.date = '2026-01-01'
    entry2.date = '2026-01-02'

    await writeDecisionFile(dir, entry1)
    await writeDecisionFile(dir, entry2)

    const loaded = await loadAllDecisions(dir)
    expect(loaded).toHaveLength(2)
    expect(loaded[0]!.date).toBe('2026-01-01')
    expect(loaded[1]!.date).toBe('2026-01-02')
  })
})

// ---------------------------------------------------------------------------
// captureDecision
// ---------------------------------------------------------------------------

describe('captureDecision', () => {
  it('persists a decision to projectDir/.buildpact/memory/decisions/', async () => {
    const projectDir = await makeTmpDir()
    const input = makeInput()
    const result = await captureDecision(projectDir, input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain(join('.buildpact', 'memory', 'decisions'))
    }
  })

  it('written decision can be loaded back', async () => {
    const projectDir = await makeTmpDir()
    const input = makeInput()
    await captureDecision(projectDir, input)

    const decisionsDir = join(projectDir, '.buildpact', 'memory', 'decisions')
    const loaded = await loadAllDecisions(decisionsDir)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.decision).toBe(input.decision)
    expect(loaded[0]!.rationale).toBe(input.rationale)
    expect(loaded[0]!.alternatives).toEqual(input.alternatives)
  })
})
