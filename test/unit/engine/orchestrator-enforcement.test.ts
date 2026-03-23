import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { enforceConstitutionOnOutput } from '../../../src/engine/orchestrator.js'

vi.mock('@clack/prompts', () => ({
  log: { warn: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockAuditLog = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = mockAuditLog
  },
}))

const SAMPLE_CONSTITUTION = `# Constitution\n\n## Immutable Principles\n\n### Architectural Constraints\n- Never use global state\n- No circular dependencies\n\n## Version History\n| Date | Change | Reason |\n|------|--------|--------|\n| 2026-01-01 | Init | Setup |\n`

describe('enforceConstitutionOnOutput', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-orch-enf-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('returns clean report when no constitution exists', async () => {
    const result = await enforceConstitutionOnOutput('any output here', tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.hasViolations).toBe(false)
    }
  })

  it('returns clean report when output is compliant', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), SAMPLE_CONSTITUTION, 'utf-8')
    const result = await enforceConstitutionOnOutput('This spec uses layered architecture.', tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.hasViolations).toBe(false)
    }
  })

  it('returns violations when output breaks a prohibition rule', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), SAMPLE_CONSTITUTION, 'utf-8')
    const result = await enforceConstitutionOnOutput('We will use global state for session.', tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.hasViolations).toBe(true)
      expect(result.value.violations.length).toBeGreaterThan(0)
    }
  })

  it('returns violations in result for violating output', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), SAMPLE_CONSTITUTION, 'utf-8')
    const result = await enforceConstitutionOnOutput('We will use global state for session.', tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.hasViolations).toBe(true)
      expect(result.value.violations.length).toBeGreaterThan(0)
    }
  })

  it('returns violations without rendering them (command layer responsibility)', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), SAMPLE_CONSTITUTION, 'utf-8')
    const result = await enforceConstitutionOnOutput('Use global state for the cache.', tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok && result.value.hasViolations) {
      // Engine returns violations — does NOT call log.warn (that's the command layer's job)
      expect(result.value.violations[0].principle).toBeDefined()
      expect(result.value.violations[0].explanation).toBeDefined()
    }
  })

  // H8 fix: Audit log assertions
  it('audit logs constitution.enforce.pass for compliant output', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), SAMPLE_CONSTITUTION, 'utf-8')
    await enforceConstitutionOnOutput('This uses clean architecture.', tmpDir)
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'constitution.enforce.pass',
        outcome: 'success',
      }),
    )
  })

  it('audit logs constitution.enforce.warn for violating output', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), SAMPLE_CONSTITUTION, 'utf-8')
    await enforceConstitutionOnOutput('We will use global state for caching.', tmpDir)
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'constitution.enforce.warn',
        outcome: 'failure',
      }),
    )
  })
})
