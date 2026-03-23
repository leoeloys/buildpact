import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  readAuditEntries,
  filterEntries,
  formatJson,
  formatCsv,
  handleAuditExport,
} from '../../../src/commands/audit/handler.js'
import type { AuditEntry } from '../../../src/foundation/audit.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ENTRIES: AuditEntry[] = [
  {
    ts: '2026-01-15T10:00:00.000Z',
    action: 'plan.start',
    agent: 'plan',
    files: ['spec.md'],
    outcome: 'success',
  },
  {
    ts: '2026-02-10T14:30:00.000Z',
    action: 'execute.wave',
    agent: 'execute',
    files: ['task-1.ts', 'task-2.ts'],
    outcome: 'success',
    cost_usd: 0.05,
    tokens: 1500,
  },
  {
    ts: '2026-03-01T09:00:00.000Z',
    action: 'verify.start',
    agent: 'verify',
    files: [],
    outcome: 'failure',
    error: 'AC-1 failed',
  },
  {
    ts: '2026-03-15T16:00:00.000Z',
    action: 'plan.research',
    agent: 'plan',
    files: ['research.md'],
    outcome: 'success',
  },
]

function toJsonl(entries: AuditEntry[]): string {
  return entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('readAuditEntries', () => {
  let tmpDir: string
  let auditDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-audit-'))
    auditDir = join(tmpDir, '.buildpact', 'audit')
    await mkdir(auditDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('reads entries from a single JSONL file', async () => {
    await writeFile(join(auditDir, 'cli.jsonl'), toJsonl(SAMPLE_ENTRIES), 'utf-8')
    const result = await readAuditEntries(auditDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(4)
  })

  it('reads entries from multiple JSONL files', async () => {
    await writeFile(join(auditDir, 'cli.jsonl'), toJsonl(SAMPLE_ENTRIES.slice(0, 2)), 'utf-8')
    await writeFile(join(auditDir, 'guard.jsonl'), toJsonl(SAMPLE_ENTRIES.slice(2)), 'utf-8')
    const result = await readAuditEntries(auditDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(4)
  })

  it('returns empty array when audit dir does not exist', async () => {
    const result = await readAuditEntries(join(tmpDir, 'nonexistent'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual([])
  })

  it('skips malformed JSON lines', async () => {
    const content = '{"ts":"2026-01-01","action":"test","agent":"a","files":[],"outcome":"success"}\nnot-json\n'
    await writeFile(join(auditDir, 'cli.jsonl'), content, 'utf-8')
    const result = await readAuditEntries(auditDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(1)
  })

  it('ignores non-jsonl files', async () => {
    await writeFile(join(auditDir, 'cli.jsonl'), toJsonl(SAMPLE_ENTRIES.slice(0, 1)), 'utf-8')
    await writeFile(join(auditDir, 'readme.txt'), 'not audit data', 'utf-8')
    const result = await readAuditEntries(auditDir)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(1)
  })
})

describe('filterEntries', () => {
  it('filters by date range (from)', () => {
    const filtered = filterEntries(SAMPLE_ENTRIES, { from: '2026-03-01' })
    expect(filtered).toHaveLength(2) // March 1st and March 15th
  })

  it('filters by date range (to)', () => {
    const filtered = filterEntries(SAMPLE_ENTRIES, { to: '2026-02-10' })
    expect(filtered).toHaveLength(2) // Jan 15th and Feb 10th
  })

  it('filters by date range (from + to)', () => {
    const filtered = filterEntries(SAMPLE_ENTRIES, { from: '2026-02-01', to: '2026-03-01' })
    expect(filtered).toHaveLength(2) // Feb 10th and March 1st
  })

  it('filters by command type', () => {
    const filtered = filterEntries(SAMPLE_ENTRIES, { command: 'plan' })
    expect(filtered).toHaveLength(2) // plan.start and plan.research
  })

  it('command filter is case-insensitive', () => {
    const filtered = filterEntries(SAMPLE_ENTRIES, { command: 'PLAN' })
    expect(filtered).toHaveLength(2)
  })

  it('returns empty array when no entries match', () => {
    const filtered = filterEntries(SAMPLE_ENTRIES, { command: 'nonexistent' })
    expect(filtered).toHaveLength(0)
  })

  it('returns all entries when no filters are provided', () => {
    const filtered = filterEntries(SAMPLE_ENTRIES, {})
    expect(filtered).toHaveLength(4)
  })

  it('combines date and command filters', () => {
    const filtered = filterEntries(SAMPLE_ENTRIES, { from: '2026-03-01', command: 'plan' })
    expect(filtered).toHaveLength(1) // Only plan.research on March 15th
  })
})

describe('formatJson', () => {
  it('produces valid JSON array', () => {
    const output = formatJson(SAMPLE_ENTRIES)
    const parsed = JSON.parse(output)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(4)
  })

  it('produces empty JSON array for empty input', () => {
    const output = formatJson([])
    expect(JSON.parse(output)).toEqual([])
  })

  it('preserves all entry fields', () => {
    const output = formatJson([SAMPLE_ENTRIES[1]!])
    const parsed = JSON.parse(output)
    expect(parsed[0].cost_usd).toBe(0.05)
    expect(parsed[0].tokens).toBe(1500)
  })
})

describe('formatCsv', () => {
  it('produces CSV with header row', () => {
    const output = formatCsv(SAMPLE_ENTRIES)
    const lines = output.split('\n')
    expect(lines[0]).toBe('ts,action,agent,files,outcome,error,cost_usd,tokens')
  })

  it('has correct number of rows (header + data)', () => {
    const output = formatCsv(SAMPLE_ENTRIES)
    const lines = output.split('\n')
    expect(lines).toHaveLength(5) // 1 header + 4 data
  })

  it('produces CSV with headers only for empty input', () => {
    const output = formatCsv([])
    const lines = output.split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('ts')
  })

  it('handles files with semicolons', () => {
    const output = formatCsv([SAMPLE_ENTRIES[1]!])
    // files: ['task-1.ts', 'task-2.ts'] → joined with semicolons
    expect(output).toContain('task-1.ts;task-2.ts')
  })

  it('escapes fields containing commas', () => {
    const entry: AuditEntry = {
      ts: '2026-01-01T00:00:00.000Z',
      action: 'test',
      agent: 'agent, name',
      files: [],
      outcome: 'success',
    }
    const output = formatCsv([entry])
    expect(output).toContain('"agent, name"')
  })
})

describe('handleAuditExport', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-audit-handler-'))
    const auditDir = join(tmpDir, '.buildpact', 'audit')
    await mkdir(auditDir, { recursive: true })
    await writeFile(join(auditDir, 'cli.jsonl'), toJsonl(SAMPLE_ENTRIES), 'utf-8')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('exports all entries as JSON by default', async () => {
    const result = await handleAuditExport({ format: 'json', projectDir: tmpDir })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = JSON.parse(result.value)
    expect(parsed).toHaveLength(4)
  })

  it('exports all entries as CSV', async () => {
    const result = await handleAuditExport({ format: 'csv', projectDir: tmpDir })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const lines = result.value.split('\n')
    expect(lines).toHaveLength(5) // header + 4 data
  })

  it('applies date filter', async () => {
    const result = await handleAuditExport({
      format: 'json',
      from: '2026-03-01',
      projectDir: tmpDir,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = JSON.parse(result.value)
    expect(parsed).toHaveLength(2)
  })

  it('applies command filter', async () => {
    const result = await handleAuditExport({
      format: 'json',
      command: 'verify',
      projectDir: tmpDir,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = JSON.parse(result.value)
    expect(parsed).toHaveLength(1)
  })

  it('writes to output file when specified', async () => {
    const outputPath = join(tmpDir, 'export.json')
    const result = await handleAuditExport({
      format: 'json',
      output: outputPath,
      projectDir: tmpDir,
    })
    expect(result.ok).toBe(true)
    // File should exist — read it back
    const { readFile: rf } = await import('node:fs/promises')
    const content = await rf(outputPath, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed).toHaveLength(4)
  })

  it('returns empty array when no entries match filters', async () => {
    const result = await handleAuditExport({
      format: 'json',
      command: 'nonexistent',
      projectDir: tmpDir,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.parse(result.value)).toEqual([])
  })
})
