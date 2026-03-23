import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rmSync } from 'node:fs'
import { AutoAdvanceExecutor } from '../../../src/engine/auto-advance.js'

/** Helper to create a plan file with wave headings and tasks */
function createPlanFile(dir: string, content: string): string {
  const planPath = join(dir, 'plan.md')
  writeFileSync(planPath, content, 'utf-8')
  return planPath
}

describe('AutoAdvanceExecutor', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'bp-autoadvance-test-'))
    mkdirSync(join(tempDir, '.buildpact'), { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Cleanup best-effort
    }
  })

  describe('sequential wave processing', () => {
    it('processes all waves when tasks succeed', async () => {
      const planContent = [
        '## Wave 1',
        '- [ ] [AGENT] Create database schema',
        '- [ ] [AGENT] Set up migrations',
        '',
        '## Wave 2',
        '- [ ] [AGENT] Add API endpoints',
      ].join('\n')

      const planPath = createPlanFile(tempDir, planContent)
      const executor = new AutoAdvanceExecutor(tempDir)
      const result = await executor.execute(planPath)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.wavesCompleted).toBe(2)
        expect(result.value.totalTasks).toBe(3)
        expect(result.value.paused).toBe(false)
        expect(result.value.pauseReason).toBeUndefined()
      }
    })

    it('handles a plan with no wave headings as a single wave', async () => {
      const planContent = [
        '- [ ] [AGENT] Create database schema',
        '- [ ] [AGENT] Set up migrations',
      ].join('\n')

      const planPath = createPlanFile(tempDir, planContent)
      const executor = new AutoAdvanceExecutor(tempDir)
      const result = await executor.execute(planPath)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.wavesCompleted).toBe(1)
        expect(result.value.totalTasks).toBe(2)
        expect(result.value.paused).toBe(false)
      }
    })

    it('returns zero waves for empty plan', async () => {
      const planPath = createPlanFile(tempDir, '')
      const executor = new AutoAdvanceExecutor(tempDir)
      const result = await executor.execute(planPath)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.wavesCompleted).toBe(0)
        expect(result.value.totalTasks).toBe(0)
      }
    })
  })

  describe('pause on failure', () => {
    it('returns error when plan file does not exist', async () => {
      const executor = new AutoAdvanceExecutor(tempDir)
      const result = await executor.execute(join(tempDir, 'nonexistent.md'))

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('FILE_READ_FAILED')
      }
    })

    it('writes pause file when budget limit exceeded', async () => {
      // Create config with a very small budget
      const configDir = join(tempDir, '.buildpact')
      mkdirSync(configDir, { recursive: true })
      writeFileSync(
        join(configDir, 'config.yaml'),
        'budget:\n  per_session_usd: 0.0000001\n',
        'utf-8',
      )

      const planContent = [
        '## Wave 1',
        '- [ ] [AGENT] Create database schema',
      ].join('\n')

      const planPath = createPlanFile(tempDir, planContent)
      const executor = new AutoAdvanceExecutor(tempDir)
      const result = await executor.execute(planPath)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.paused).toBe(true)
        expect(result.value.pauseReason).toBe('Budget limit reached')
      }

      // Verify pause file was written
      const pausePath = join(tempDir, '.buildpact', 'agent-paused.json')
      expect(existsSync(pausePath)).toBe(true)
    })
  })

  describe('resume from paused state', () => {
    it('resumes execution from paused wave', async () => {
      const planContent = [
        '## Wave 1',
        '- [ ] [AGENT] Create database schema',
        '',
        '## Wave 2',
        '- [ ] [AGENT] Add API endpoints',
      ].join('\n')

      const planPath = createPlanFile(tempDir, planContent)
      const executor = new AutoAdvanceExecutor(tempDir)

      // Manually write a pause file indicating pause at wave 1
      const pauseInfo = {
        pausedAt: new Date().toISOString(),
        waveNumber: 1,
        reason: 'Task execution failed',
        failedTaskId: 'abc-123',
        failedTaskTitle: 'Add API endpoints',
      }
      writeFileSync(
        join(tempDir, '.buildpact', 'agent-paused.json'),
        JSON.stringify(pauseInfo, null, 2),
        'utf-8',
      )

      expect(executor.isPaused()).toBe(true)

      const result = await executor.resume(planPath)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.wavesCompleted).toBe(2)
        expect(result.value.totalTasks).toBe(1) // Only wave 2 tasks
        expect(result.value.paused).toBe(false)
      }

      // Pause file should be removed
      expect(executor.isPaused()).toBe(false)
    })

    it('returns error when not paused', async () => {
      const planPath = createPlanFile(tempDir, '## Wave 1\n- [ ] [AGENT] Task')
      const executor = new AutoAdvanceExecutor(tempDir)

      const result = await executor.resume(planPath)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_RUNNING')
      }
    })
  })
})
