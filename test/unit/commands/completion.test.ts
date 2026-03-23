import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts (not used by completion but imported transitively)
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  isCancel: vi.fn(() => false),
}))

// Mock AuditLogger
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Generator tests
// ---------------------------------------------------------------------------

describe('generateBash', () => {
  it('generates a valid bash completion script', async () => {
    const { generateBash } = await import('../../../src/commands/completion/handler.js')
    const { COMMAND_FLAGS } = await import('../../../src/commands/completion/flags.js')
    const script = generateBash(['specify', 'plan', 'execute'], COMMAND_FLAGS)

    expect(script).toContain('_bp_completions')
    expect(script).toContain('complete -F _bp_completions bp')
    expect(script).toContain('specify')
    expect(script).toContain('plan')
    expect(script).toContain('execute')
    expect(script).toContain('# Add to ~/.bashrc')
  })

  it('includes per-command flags', async () => {
    const { generateBash } = await import('../../../src/commands/completion/handler.js')
    const flags = {
      plan: [{ name: '--research', description: 'Research phase', takesValue: false }],
    }
    const script = generateBash(['plan'], flags)
    expect(script).toContain('--research')
  })
})

describe('generateZsh', () => {
  it('generates a valid zsh completion script', async () => {
    const { generateZsh } = await import('../../../src/commands/completion/handler.js')
    const { COMMAND_FLAGS } = await import('../../../src/commands/completion/flags.js')
    const script = generateZsh(['specify', 'plan'], COMMAND_FLAGS)

    expect(script).toContain('#compdef bp buildpact')
    expect(script).toContain('compdef _bp bp buildpact')
    expect(script).toContain('specify')
    expect(script).toContain('plan')
  })
})

describe('generateFish', () => {
  it('generates a valid fish completion script', async () => {
    const { generateFish } = await import('../../../src/commands/completion/handler.js')
    const { COMMAND_FLAGS } = await import('../../../src/commands/completion/flags.js')
    const script = generateFish(['specify', 'plan'], COMMAND_FLAGS)

    expect(script).toContain('complete -c bp')
    expect(script).toContain('specify')
    expect(script).toContain('plan')
    expect(script).toContain('__fish_use_subcommand')
  })
})

// ---------------------------------------------------------------------------
// Shell detection and install helpers
// ---------------------------------------------------------------------------

describe('detectShell', () => {
  const origEnv = process.env.SHELL

  afterEach(() => {
    process.env.SHELL = origEnv
  })

  it('detects zsh', async () => {
    process.env.SHELL = '/bin/zsh'
    const { detectShell } = await import('../../../src/commands/completion/handler.js')
    expect(detectShell()).toBe('zsh')
  })

  it('detects bash', async () => {
    process.env.SHELL = '/bin/bash'
    const { detectShell } = await import('../../../src/commands/completion/handler.js')
    expect(detectShell()).toBe('bash')
  })

  it('detects fish', async () => {
    process.env.SHELL = '/usr/bin/fish'
    const { detectShell } = await import('../../../src/commands/completion/handler.js')
    expect(detectShell()).toBe('fish')
  })
})

describe('getProfilePath', () => {
  it('returns .bashrc for bash', async () => {
    const { getProfilePath } = await import('../../../src/commands/completion/handler.js')
    expect(getProfilePath('bash')).toContain('.bashrc')
  })

  it('returns .zshrc for zsh', async () => {
    const { getProfilePath } = await import('../../../src/commands/completion/handler.js')
    expect(getProfilePath('zsh')).toContain('.zshrc')
  })

  it('returns config.fish for fish', async () => {
    const { getProfilePath } = await import('../../../src/commands/completion/handler.js')
    expect(getProfilePath('fish')).toContain('config.fish')
  })
})

describe('getEvalLine', () => {
  it('returns bash eval line', async () => {
    const { getEvalLine } = await import('../../../src/commands/completion/handler.js')
    expect(getEvalLine('bash')).toContain('buildpact completion bash')
  })

  it('returns fish source line', async () => {
    const { getEvalLine } = await import('../../../src/commands/completion/handler.js')
    expect(getEvalLine('fish')).toContain('buildpact completion fish | source')
  })
})

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe('completion handler', () => {
  let stdoutWrite: ReturnType<typeof vi.fn>

  beforeEach(() => {
    stdoutWrite = vi.fn()
    vi.spyOn(process.stdout, 'write').mockImplementation(stdoutWrite)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs bash completion script to stdout', async () => {
    const { handler } = await import('../../../src/commands/completion/index.js')
    const result = await handler.run(['bash'])
    expect(result.ok).toBe(true)
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('_bp_completions'))
  })

  it('outputs zsh completion script to stdout', async () => {
    const { handler } = await import('../../../src/commands/completion/index.js')
    const result = await handler.run(['zsh'])
    expect(result.ok).toBe(true)
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('#compdef'))
  })

  it('outputs fish completion script to stdout', async () => {
    const { handler } = await import('../../../src/commands/completion/index.js')
    const result = await handler.run(['fish'])
    expect(result.ok).toBe(true)
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('complete -c bp'))
  })

  it('returns error for invalid shell', async () => {
    const { handler } = await import('../../../src/commands/completion/index.js')
    const result = await handler.run(['powershell'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.i18nKey).toBe('cli.completion.invalid_shell')
    }
  })

  it('returns error when no shell specified', async () => {
    const { handler } = await import('../../../src/commands/completion/index.js')
    const result = await handler.run([])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_SHELL')
    }
  })

  it('includes all registered commands in bash output', async () => {
    const { handler } = await import('../../../src/commands/completion/index.js')
    await handler.run(['bash'])
    const output = stdoutWrite.mock.calls[0]?.[0] as string
    expect(output).toContain('specify')
    expect(output).toContain('plan')
    expect(output).toContain('execute')
    expect(output).toContain('verify')
    expect(output).toContain('quick')
    expect(output).toContain('doctor')
    expect(output).toContain('memory')
    expect(output).toContain('status')
    expect(output).toContain('diff')
    expect(output).toContain('completion')
  })

  it('includes --json flag for memory in bash output', async () => {
    const { handler } = await import('../../../src/commands/completion/index.js')
    await handler.run(['bash'])
    const output = stdoutWrite.mock.calls[0]?.[0] as string
    expect(output).toContain('--json')
  })
})
