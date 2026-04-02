import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  formatLedgerEntry,
  parseLedgerEntries,
  appendToLedger,
  readLedger,
  initializeLedger,
  registerEvent,
  generateMapContent,
} from '../../../src/engine/project-ledger.js'
import type { LedgerEntry } from '../../../src/contracts/task.js'

const makeEntry = (overrides?: Partial<LedgerEntry>): LedgerEntry => ({
  timestamp: '2026-04-01T14:30:00.000Z',
  category: 'DECISION',
  id: 'DEC-001',
  summary: 'Chose Result<T> over exceptions',
  detailsPath: '.buildpact/memory/decisions/result-pattern.md',
  ...overrides,
})

describe('formatLedgerEntry', () => {
  it('formats with date, time, category, id, summary and details pointer', () => {
    const formatted = formatLedgerEntry(makeEntry())
    expect(formatted).toContain('### 2026-04-01 14:30 — DECISION [DEC-001]')
    expect(formatted).toContain('Chose Result<T> over exceptions')
    expect(formatted).toContain('→ Details: .buildpact/memory/decisions/result-pattern.md')
  })
})

describe('parseLedgerEntries', () => {
  it('parses entries from ledger content', () => {
    const content = [
      '# Project Ledger',
      '',
      '> Unified temporal index.',
      '',
      '### 2026-04-01 14:30 — DECISION [DEC-001]',
      'Chose Result<T> over exceptions',
      '→ Details: .buildpact/memory/decisions/result-pattern.md',
      '',
      '### 2026-04-01 13:00 — HANDOFF [HOF-001]',
      'orchestrator → developer (T-001)',
      '→ Details: .buildpact/handoffs/HOF-001.json',
    ].join('\n')

    const entries = parseLedgerEntries(content)
    expect(entries).toHaveLength(2)
    expect(entries[0]!.category).toBe('DECISION')
    expect(entries[0]!.id).toBe('DEC-001')
    expect(entries[0]!.summary).toBe('Chose Result<T> over exceptions')
    expect(entries[1]!.category).toBe('HANDOFF')
    expect(entries[1]!.id).toBe('HOF-001')
  })

  it('handles multiple dates', () => {
    const content = [
      '# Project Ledger',
      '',
      '### 2026-04-02 09:00 — TASK_COMPLETE [T-002]',
      'Finished handoff module',
      '→ Details: .buildpact/tasks/T-002.json',
      '',
      '### 2026-04-01 14:30 — DECISION [DEC-001]',
      'Chose Result<T>',
      '→ Details: .buildpact/memory/decisions/result-pattern.md',
    ].join('\n')

    const entries = parseLedgerEntries(content)
    expect(entries).toHaveLength(2)
    expect(entries[0]!.timestamp).toContain('2026-04-02')
    expect(entries[1]!.timestamp).toContain('2026-04-01')
  })

  it('returns empty for empty content', () => {
    expect(parseLedgerEntries('')).toEqual([])
  })
})

describe('appendToLedger', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('creates LEDGER.md on first append', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-ledger-'))
    const result = await appendToLedger(tempDir, makeEntry())
    expect(result.ok).toBe(true)

    const content = await readFile(join(tempDir, '.buildpact', 'LEDGER.md'), 'utf-8')
    expect(content).toContain('# Project Ledger')
    expect(content).toContain('DECISION [DEC-001]')
  })

  it('appends multiple entries atomically', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-ledger-'))
    await appendToLedger(tempDir, makeEntry())
    await appendToLedger(tempDir, makeEntry({ id: 'DEC-002', summary: 'Second decision' }))

    const content = await readFile(join(tempDir, '.buildpact', 'LEDGER.md'), 'utf-8')
    expect(content).toContain('DEC-001')
    expect(content).toContain('DEC-002')
  })
})

describe('readLedger', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('returns empty array when no ledger exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-ledger-'))
    const result = await readLedger(tempDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual([])
  })

  it('reads and filters by category', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-ledger-'))
    await appendToLedger(tempDir, makeEntry())
    await appendToLedger(tempDir, makeEntry({ category: 'HANDOFF', id: 'HOF-001', summary: 'handoff' }))

    const result = await readLedger(tempDir, { category: 'DECISION' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0]!.category).toBe('DECISION')
    }
  })

  it('respects limit filter', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-ledger-'))
    await appendToLedger(tempDir, makeEntry({ id: 'A' }))
    await appendToLedger(tempDir, makeEntry({ id: 'B' }))
    await appendToLedger(tempDir, makeEntry({ id: 'C' }))

    const result = await readLedger(tempDir, { limit: 2 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(2)
  })
})

describe('initializeLedger', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('creates LEDGER.md and MAP.md', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-ledger-'))
    const result = await initializeLedger(tempDir)
    expect(result.ok).toBe(true)

    expect(existsSync(join(tempDir, '.buildpact', 'LEDGER.md'))).toBe(true)
    expect(existsSync(join(tempDir, '.buildpact', 'MAP.md'))).toBe(true)
  })

  it('does not overwrite existing LEDGER.md', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-ledger-'))
    await appendToLedger(tempDir, makeEntry())
    await initializeLedger(tempDir)

    const content = await readFile(join(tempDir, '.buildpact', 'LEDGER.md'), 'utf-8')
    expect(content).toContain('DEC-001')
  })
})

describe('registerEvent', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('creates and appends in one call', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-ledger-'))
    const result = await registerEvent(tempDir, 'HANDOFF', 'HOF-001', 'dispatched task', '.buildpact/handoffs/HOF-001.json')
    expect(result.ok).toBe(true)

    const content = await readFile(join(tempDir, '.buildpact', 'LEDGER.md'), 'utf-8')
    expect(content).toContain('HANDOFF [HOF-001]')
    expect(content).toContain('dispatched task')
  })
})

describe('generateMapContent', () => {
  it('contains all expected sections', () => {
    const map = generateMapContent()
    expect(map).toContain('Ledger')
    expect(map).toContain('Decisions')
    expect(map).toContain('Handoffs')
    expect(map).toContain('Constitution')
    expect(map).toContain('Changelogs')
  })
})
