import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendDecision, type DecisionEntry } from '../../../src/foundation/decisions.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEntry = (overrides: Partial<DecisionEntry> = {}): DecisionEntry => ({
  date: '2026-03-15',
  decision: 'Use TypeScript strict mode',
  rationale: 'Prevents runtime errors and improves maintainability.',
  affected: ['tsconfig.json'],
  ...overrides,
})

// ---------------------------------------------------------------------------
// appendDecision
// ---------------------------------------------------------------------------

describe('appendDecision', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-decisions-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates DECISIONS.md when file does not exist', async () => {
    const result = await appendDecision(tmpDir, makeEntry())
    expect(result.ok).toBe(true)
    const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('appends entry to existing DECISIONS.md preserving prior content', async () => {
    const existing = '# DECISIONS.md\n\n---\n'
    await writeFile(join(tmpDir, 'DECISIONS.md'), existing, 'utf-8')

    const result = await appendDecision(tmpDir, makeEntry())
    expect(result.ok).toBe(true)

    const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
    // Original content intact
    expect(content).toContain('# DECISIONS.md')
    // New entry appended
    expect(content).toContain('Use TypeScript strict mode')
  })

  it('appended entry includes the date', async () => {
    const result = await appendDecision(tmpDir, makeEntry({ date: '2026-01-01' }))
    expect(result.ok).toBe(true)
    const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
    expect(content).toContain('2026-01-01')
  })

  it('appended entry includes the decision text', async () => {
    const result = await appendDecision(tmpDir, makeEntry({ decision: 'Adopt ESM modules' }))
    expect(result.ok).toBe(true)
    const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
    expect(content).toContain('Adopt ESM modules')
  })

  it('appended entry includes the rationale', async () => {
    const result = await appendDecision(tmpDir, makeEntry({ rationale: 'Better tree-shaking and future-proof.' }))
    expect(result.ok).toBe(true)
    const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
    expect(content).toContain('Better tree-shaking and future-proof.')
  })

  it('appended entry includes all affected artifacts', async () => {
    const result = await appendDecision(tmpDir, makeEntry({ affected: ['src/index.ts', 'package.json'] }))
    expect(result.ok).toBe(true)
    const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
    expect(content).toContain('src/index.ts')
    expect(content).toContain('package.json')
  })

  it('handles empty affected array gracefully', async () => {
    const result = await appendDecision(tmpDir, makeEntry({ affected: [] }))
    expect(result.ok).toBe(true)
    const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
    expect(content).toContain('Use TypeScript strict mode')
  })

  it('calling appendDecision twice preserves first entry (append-only)', async () => {
    const entry1 = makeEntry({ decision: 'First decision', date: '2026-01-01' })
    const entry2 = makeEntry({ decision: 'Second decision', date: '2026-01-02' })

    const r1 = await appendDecision(tmpDir, entry1)
    const r2 = await appendDecision(tmpDir, entry2)
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)

    const content = await readFile(join(tmpDir, 'DECISIONS.md'), 'utf-8')
    expect(content).toContain('First decision')
    expect(content).toContain('Second decision')
    // First entry was not truncated
    expect(content.indexOf('First decision')).toBeLessThan(content.indexOf('Second decision'))
  })

  it('returns FILE_WRITE_FAILED when DECISIONS.md exists but is unreadable (non-ENOENT)', async () => {
    // Create DECISIONS.md as a directory — readFile will throw EISDIR, not ENOENT
    const { mkdir: mkdirFs } = await import('node:fs/promises')
    await mkdirFs(join(tmpDir, 'DECISIONS.md'), { recursive: true })

    const result = await appendDecision(tmpDir, makeEntry())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_WRITE_FAILED')
    }
  })

  it('returns FILE_WRITE_FAILED when projectDir is not a directory', async () => {
    // Create a file at tmpDir/blocker, then use it as projectDir
    // so join(projectDir, 'DECISIONS.md') → blocker/DECISIONS.md → ENOTDIR
    const blockerFile = join(tmpDir, 'blocker')
    await writeFile(blockerFile, 'i am not a directory')

    const result = await appendDecision(blockerFile, makeEntry())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_WRITE_FAILED')
    }
  })
})
