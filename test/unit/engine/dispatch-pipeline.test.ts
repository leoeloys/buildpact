import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  dispatchWithSafetyChecks,
  recordArtifactChange,
} from '../../../src/engine/dispatch-pipeline.js'
import { resetHandoffCounter } from '../../../src/engine/handoff-protocol.js'
import { resetChangeCounter } from '../../../src/engine/artifact-changelog.js'
import type { DispatchRequest } from '../../../src/engine/dispatch-pipeline.js'

const makeRequest = (tempDir: string, overrides?: Partial<DispatchRequest>): DispatchRequest => ({
  fromRole: 'orchestrator',
  fromAgent: 'Taiichi',
  toAgent: 'developer-1',
  taskId: 'T-001',
  handoff: {
    briefing: 'Implement the data model',
    expectedOutput: {
      type: 'code',
      artifacts: ['src/models/user.ts'],
      acceptanceCriteria: ['User model with validation', 'Exports from index'],
    },
    contextFiles: ['src/contracts/task.ts'],
    priorDecisions: ['Use Zod for validation'],
  },
  projectDir: tempDir,
  ...overrides,
})

describe('dispatchWithSafetyChecks', () => {
  let tempDir: string
  beforeEach(() => { resetHandoffCounter(); resetChangeCounter() })
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('dispatches successfully for orchestrator role', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    const result = await dispatchWithSafetyChecks(makeRequest(tempDir))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.packet.id).toBe('HOF-001')
      expect(result.value.packet.fromAgent).toBe('Taiichi')
      expect(result.value.packet.toAgent).toBe('developer-1')
      expect(result.value.briefing).toContain('Handoff Briefing')
      expect(result.value.briefing).toContain('Implement the data model')
    }
  })

  it('registers handoff in ledger', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    await dispatchWithSafetyChecks(makeRequest(tempDir))

    const ledger = await readFile(join(tempDir, '.buildpact', 'LEDGER.md'), 'utf-8')
    expect(ledger).toContain('HANDOFF [HOF-001]')
    expect(ledger).toContain('Taiichi → developer-1')
  })

  it('blocks developer role from dispatching (Agent blocked)', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    const result = await dispatchWithSafetyChecks(makeRequest(tempDir, { fromRole: 'developer' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('ROLE_BOUNDARY_VIOLATION')
  })

  it('blocks reviewer role from dispatching', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    const result = await dispatchWithSafetyChecks(makeRequest(tempDir, { fromRole: 'reviewer' }))
    expect(result.ok).toBe(false)
  })

  it('allows unknown role (no boundary defined)', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    const result = await dispatchWithSafetyChecks(makeRequest(tempDir, { fromRole: 'custom-role' }))
    expect(result.ok).toBe(true)
  })

  it('rejects invalid handoff (missing toAgent) via orchestration rules', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    const result = await dispatchWithSafetyChecks(makeRequest(tempDir, { toAgent: '' }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // R2 catches incomplete handoff before requireValidHandoff runs
      expect(result.error.code).toBe('ROLE_BOUNDARY_VIOLATION')
      expect(result.error.params?.violations).toContain('R2_HANDOFF_COMPLETENESS')
    }
  })

  it('rejects handoff with empty acceptance criteria via orchestration rules', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    const result = await dispatchWithSafetyChecks(makeRequest(tempDir, {
      handoff: {
        briefing: 'test',
        expectedOutput: { type: 'code', artifacts: ['f.ts'], acceptanceCriteria: [] },
      },
    }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ROLE_BOUNDARY_VIOLATION')
      expect(result.error.params?.violations).toContain('R2_HANDOFF_COMPLETENESS')
    }
  })
})

describe('recordArtifactChange', () => {
  let tempDir: string
  beforeEach(() => { resetHandoffCounter(); resetChangeCounter() })
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('records change for official artifact', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    const result = await recordArtifactChange(
      tempDir, 'spec.md', 'modified', 'Added section 3', 'New requirement from client', 'T-001',
    )
    expect(result.ok).toBe(true)

    // Changelog written
    const changelog = await readFile(join(tempDir, '.buildpact', 'changelogs', 'spec.md'), 'utf-8')
    expect(changelog).toContain('Added section 3')

    // Ledger entry written
    const ledger = await readFile(join(tempDir, '.buildpact', 'LEDGER.md'), 'utf-8')
    expect(ledger).toContain('ARTIFACT_CHANGE')
    expect(ledger).toContain('spec:modified')
  })

  it('is a no-op for non-artifact files', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-dispatch-'))
    const result = await recordArtifactChange(
      tempDir, 'src/engine/foo.ts', 'modified', 'refactor', 'cleanup', 'T-002',
    )
    expect(result.ok).toBe(true)
    // No files created
    const { existsSync } = await import('node:fs')
    expect(existsSync(join(tempDir, '.buildpact', 'changelogs'))).toBe(false)
  })
})
