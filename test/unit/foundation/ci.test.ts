import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('CI mode utilities', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.BP_CI
    delete process.env.BP_CI
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BP_CI = originalEnv
    } else {
      delete process.env.BP_CI
    }
  })

  describe('isCiMode', () => {
    it('returns true when --ci is in args', async () => {
      const { isCiMode } = await import('../../../src/foundation/ci.js')
      expect(isCiMode(['--ci'])).toBe(true)
    })

    it('returns true when BP_CI=true is set', async () => {
      process.env.BP_CI = 'true'
      const { isCiMode } = await import('../../../src/foundation/ci.js')
      expect(isCiMode([])).toBe(true)
    })

    it('returns true when BP_CI=true is set even with empty args', async () => {
      process.env.BP_CI = 'true'
      const { isCiMode } = await import('../../../src/foundation/ci.js')
      expect(isCiMode(['plan'])).toBe(true)
    })

    it('returns false when neither --ci nor BP_CI is set', async () => {
      const { isCiMode } = await import('../../../src/foundation/ci.js')
      expect(isCiMode(['plan'])).toBe(false)
    })

    it('returns false when BP_CI is set to something other than true', async () => {
      process.env.BP_CI = 'false'
      const { isCiMode } = await import('../../../src/foundation/ci.js')
      expect(isCiMode([])).toBe(false)
    })

    it('returns true when --ci is among other args', async () => {
      const { isCiMode } = await import('../../../src/foundation/ci.js')
      expect(isCiMode(['plan', '--ci', '--description', 'foo'])).toBe(true)
    })
  })

  describe('stripCiFlag', () => {
    it('removes --ci from args array', async () => {
      const { stripCiFlag } = await import('../../../src/foundation/ci.js')
      expect(stripCiFlag(['plan', '--ci', '--description', 'foo'])).toEqual([
        'plan',
        '--description',
        'foo',
      ])
    })

    it('returns unchanged array when --ci is not present', async () => {
      const { stripCiFlag } = await import('../../../src/foundation/ci.js')
      expect(stripCiFlag(['plan', '--description', 'foo'])).toEqual([
        'plan',
        '--description',
        'foo',
      ])
    })

    it('removes multiple --ci flags', async () => {
      const { stripCiFlag } = await import('../../../src/foundation/ci.js')
      expect(stripCiFlag(['--ci', 'plan', '--ci'])).toEqual(['plan'])
    })

    it('handles empty array', async () => {
      const { stripCiFlag } = await import('../../../src/foundation/ci.js')
      expect(stripCiFlag([])).toEqual([])
    })
  })

  describe('ciLog', () => {
    it('logs step without detail', async () => {
      const { ciLog } = await import('../../../src/foundation/ci.js')
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      ciLog('auto-skipped')
      expect(spy).toHaveBeenCalledWith('[ci] auto-skipped')
      spy.mockRestore()
    })

    it('logs step with detail', async () => {
      const { ciLog } = await import('../../../src/foundation/ci.js')
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      ciLog('auto-selected', 'expert mode')
      expect(spy).toHaveBeenCalledWith('[ci] auto-selected: expert mode')
      spy.mockRestore()
    })
  })
})
