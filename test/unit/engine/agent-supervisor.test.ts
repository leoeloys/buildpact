import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rmSync } from 'node:fs'
import { AgentSupervisor } from '../../../src/engine/agent-supervisor.js'

describe('AgentSupervisor', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'bp-agent-test-'))
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Cleanup best-effort
    }
  })

  describe('start', () => {
    it('writes PID file on start', () => {
      const supervisor = new AgentSupervisor(tempDir)
      const result = supervisor.start()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.pid).toBe(process.pid)
        expect(result.value.staleDetected).toBe(false)
      }

      const pidPath = join(tempDir, '.buildpact', 'agent.pid')
      expect(existsSync(pidPath)).toBe(true)
      expect(readFileSync(pidPath, 'utf-8').trim()).toBe(String(process.pid))
    })

    it('writes to agent.log on start', () => {
      const supervisor = new AgentSupervisor(tempDir)
      supervisor.start()

      const logPath = join(tempDir, '.buildpact', 'agent.log')
      expect(existsSync(logPath)).toBe(true)
      const logContent = readFileSync(logPath, 'utf-8')
      expect(logContent).toContain('Agent supervisor started')
    })

    it('returns error when already running', () => {
      const supervisor = new AgentSupervisor(tempDir)
      supervisor.start()

      const result = supervisor.start()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_ALREADY_RUNNING')
      }
    })
  })

  describe('status', () => {
    it('returns correct shape when running', () => {
      const supervisor = new AgentSupervisor(tempDir)
      supervisor.start()

      const status = supervisor.status()
      expect(status.running).toBe(true)
      expect(status.pid).toBe(process.pid)
      expect(typeof status.uptime).toBe('string')
      expect(typeof status.activeAgents).toBe('number')
      expect(typeof status.tasksProcessed).toBe('number')
      expect(typeof status.memoryUsageMb).toBe('number')
      expect(status.memoryUsageMb).toBeGreaterThan(0)
    })

    it('returns not-running shape when supervisor is not started', () => {
      const supervisor = new AgentSupervisor(tempDir)
      const status = supervisor.status()

      expect(status.running).toBe(false)
      expect(status.pid).toBeUndefined()
      expect(status.uptime).toBeUndefined()
      expect(status.activeAgents).toBe(0)
      expect(status.tasksProcessed).toBe(0)
    })
  })

  describe('stop', () => {
    it('removes PID file on stop', () => {
      const supervisor = new AgentSupervisor(tempDir)
      supervisor.start()

      const pidPath = join(tempDir, '.buildpact', 'agent.pid')
      expect(existsSync(pidPath)).toBe(true)

      const result = supervisor.stop()
      expect(result.ok).toBe(true)
      expect(existsSync(pidPath)).toBe(false)
    })

    it('returns error when not running', () => {
      const supervisor = new AgentSupervisor(tempDir)
      const result = supervisor.stop()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_RUNNING')
      }
    })
  })

  describe('stale PID detection', () => {
    it('detects stale PID and starts fresh', () => {
      // Write a PID that does not belong to any running process
      const buildpactDir = join(tempDir, '.buildpact')
      mkdirSync(buildpactDir, { recursive: true })
      const pidPath = join(buildpactDir, 'agent.pid')

      // Use a very high PID that is almost certainly not running
      writeFileSync(pidPath, '999999999', 'utf-8')

      const supervisor = new AgentSupervisor(tempDir)
      const result = supervisor.start()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.staleDetected).toBe(true)
        expect(result.value.pid).toBe(process.pid)
      }
    })
  })
})
