import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SCRIPT = join(process.cwd(), 'action/setup-budget.sh')

async function runScript(budget: string, cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('bash', [SCRIPT, budget], { cwd })
    return { stdout, stderr, code: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number }
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', code: e.code ?? 1 }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'bp-budget-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('setup-budget.sh — new config file', () => {
  it('creates .buildpact/config.yaml with budget block', async () => {
    const { code, stdout } = await runScript('2.50', tmpDir)
    expect(code).toBe(0)
    expect(stdout).toContain('2.50')

    const configPath = join(tmpDir, '.buildpact', 'config.yaml')
    const content = await readFile(configPath, 'utf8')
    expect(content).toContain('budget:')
    expect(content).toContain('per_session_usd: 2.50')
  })

  it('creates the .buildpact directory when it does not exist', async () => {
    const { code } = await runScript('0.75', tmpDir)
    expect(code).toBe(0)

    const configPath = join(tmpDir, '.buildpact', 'config.yaml')
    const content = await readFile(configPath, 'utf8')
    expect(content.trim().length).toBeGreaterThan(0)
  })
})

describe('setup-budget.sh — merge with existing config', () => {
  it('appends budget block to existing config without duplicating', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    const configPath = join(tmpDir, '.buildpact', 'config.yaml')
    await writeFile(configPath, 'squad: software\nmodel: claude-opus-4\n', 'utf8')

    const { code } = await runScript('1.00', tmpDir)
    expect(code).toBe(0)

    const content = await readFile(configPath, 'utf8')
    expect(content).toContain('squad: software')
    expect(content).toContain('per_session_usd: 1.00')
    // Should not contain budget key more than once.
    const budgetOccurrences = (content.match(/^budget:/gm) ?? []).length
    expect(budgetOccurrences).toBe(1)
  })

  it('replaces existing budget block when re-running', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    const configPath = join(tmpDir, '.buildpact', 'config.yaml')
    await writeFile(
      configPath,
      'squad: software\nbudget:\n  per_session_usd: 0.50\n',
      'utf8',
    )

    const { code } = await runScript('3.00', tmpDir)
    expect(code).toBe(0)

    const content = await readFile(configPath, 'utf8')
    expect(content).not.toContain('per_session_usd: 0.50')
    expect(content).toContain('per_session_usd: 3.00')
    const budgetOccurrences = (content.match(/^budget:/gm) ?? []).length
    expect(budgetOccurrences).toBe(1)
  })
})

describe('setup-budget.sh — skip conditions', () => {
  it('skips when budget is "0"', async () => {
    const { code, stdout } = await runScript('0', tmpDir)
    expect(code).toBe(0)
    expect(stdout).toContain('skipping')

    // Config should not have been created.
    const configPath = join(tmpDir, '.buildpact', 'config.yaml')
    await expect(readFile(configPath, 'utf8')).rejects.toThrow()
  })

  it('skips when budget is "0.00"', async () => {
    const { code, stdout } = await runScript('0.00', tmpDir)
    expect(code).toBe(0)
    expect(stdout).toContain('skipping')
  })

  it('skips when budget is empty string', async () => {
    const { code, stdout } = await runScript('', tmpDir)
    expect(code).toBe(0)
    expect(stdout).toContain('skipping')
  })
})
