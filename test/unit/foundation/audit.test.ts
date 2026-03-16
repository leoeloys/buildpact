import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AuditLogger, type AuditEntry } from '../../../src/foundation/audit.js'

describe('AuditLogger', () => {
  let tmpDir: string
  let logPath: string
  let logger: AuditLogger

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-test-'))
    logPath = join(tmpDir, 'audit.jsonl')
    logger = new AuditLogger(logPath)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('writes a valid JSON Lines entry to the log file', async () => {
    await logger.log({
      action: 'install.start',
      agent: 'installer',
      files: [],
      outcome: 'success',
    })

    const content = await readFile(logPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(1)

    const entry = JSON.parse(lines[0]!) as AuditEntry
    expect(entry.action).toBe('install.start')
    expect(entry.agent).toBe('installer')
    expect(entry.files).toEqual([])
    expect(entry.outcome).toBe('success')
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('appends multiple entries without overwriting', async () => {
    await logger.log({ action: 'install.start', agent: 'installer', files: [], outcome: 'success' })
    await logger.log({ action: 'install.ide_config', agent: 'installer', files: ['.claude/commands/'], outcome: 'success' })

    const content = await readFile(logPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)
  })

  it('includes optional fields when provided', async () => {
    await logger.log({
      action: 'install.squad_fetch',
      agent: 'installer',
      files: [],
      outcome: 'failure',
      error: 'Network unavailable',
      cost_usd: 0,
    })

    const content = await readFile(logPath, 'utf-8')
    const entry = JSON.parse(content.trim()) as AuditEntry
    expect(entry.error).toBe('Network unavailable')
    expect(entry.cost_usd).toBe(0)
  })

  it('creates parent directories if they do not exist', async () => {
    const nestedLogPath = join(tmpDir, 'audit', 'nested', 'audit.jsonl')
    const nestedLogger = new AuditLogger(nestedLogPath)
    await expect(nestedLogger.log({ action: 'test', agent: 'test', files: [], outcome: 'success' })).resolves.not.toThrow()
    const content = await readFile(nestedLogPath, 'utf-8')
    expect(content.trim()).toBeTruthy()
  })

  it('each entry is a single valid JSON line', async () => {
    await logger.log({ action: 'a', agent: 'b', files: ['file1.md'], outcome: 'success' })
    const content = await readFile(logPath, 'utf-8')
    expect(content).not.toContain('\n\n')
    expect(() => JSON.parse(content.trim())).not.toThrow()
  })
})
