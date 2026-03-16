import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateSquadName, runValidate } from '../../../src/commands/squad/handler.js'

// ---------------------------------------------------------------------------
// Mock @clack/prompts so tests don't block on interactive TTY prompts
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  isCancel: vi.fn(() => false),
}))

// Mock AuditLogger to avoid writing real audit logs during tests
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// validateSquadName
// ---------------------------------------------------------------------------

describe('validateSquadName', () => {
  it('accepts valid lowercase name', () => {
    const result = validateSquadName('my-squad')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('my-squad')
  })

  it('accepts alphanumeric name', () => {
    const result = validateSquadName('software')
    expect(result.ok).toBe(true)
  })

  it('accepts name with underscores', () => {
    const result = validateSquadName('medical_squad')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('medical_squad')
  })

  it('converts name to lowercase', () => {
    const result = validateSquadName('MySquad')
    // MySquad has uppercase but after toLowerCase it's 'mysquad' — valid
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('mysquad')
  })

  it('rejects empty name', () => {
    const result = validateSquadName('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_INVALID_NAME')
  })

  it('rejects name that is only whitespace', () => {
    const result = validateSquadName('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_INVALID_NAME')
  })

  it('rejects single character name', () => {
    const result = validateSquadName('a')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_INVALID_NAME')
  })
})

// ---------------------------------------------------------------------------
// handler.run — subcommand dispatch
// ---------------------------------------------------------------------------

describe('squad handler — subcommand routing', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-squad-cmd-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
    vi.mocked((await import('@clack/prompts')).isCancel).mockImplementation(() => false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('shows usage hint for unknown subcommand', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { handler } = await import('../../../src/commands/squad/handler.js')
    const clack = await import('@clack/prompts')

    const result = await handler.run(['unknown'])
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.log.warn)).toHaveBeenCalled()

    cwdSpy.mockRestore()
  })

  it('shows usage hint when no subcommand given', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { handler } = await import('../../../src/commands/squad/handler.js')
    const clack = await import('@clack/prompts')

    const result = await handler.run([])
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.log.warn)).toHaveBeenCalled()

    cwdSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// runCreate
// ---------------------------------------------------------------------------

describe('runCreate', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-squad-create-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
    vi.mocked((await import('@clack/prompts')).isCancel).mockImplementation(() => false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates squad scaffold in current directory', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { runCreate } = await import('../../../src/commands/squad/handler.js')
    const clack = await import('@clack/prompts')

    const result = await runCreate(['my-squad'], tmpDir)
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.outro)).toHaveBeenCalled()

    cwdSpy.mockRestore()
  })

  it('returns error for invalid squad name', async () => {
    const { runCreate } = await import('../../../src/commands/squad/handler.js')
    const clack = await import('@clack/prompts')

    const result = await runCreate(['a'], tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_INVALID_NAME')
    expect(vi.mocked(clack.log.error)).toHaveBeenCalled()
  })

  it('returns error when no name provided', async () => {
    const { runCreate } = await import('../../../src/commands/squad/handler.js')

    const result = await runCreate([], tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_INVALID_NAME')
  })

  it('shows create_next_steps after successful scaffold', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { runCreate } = await import('../../../src/commands/squad/handler.js')
    const clack = await import('@clack/prompts')

    await runCreate(['my-squad'], tmpDir)
    expect(vi.mocked(clack.log.success)).toHaveBeenCalled()

    cwdSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// runAdd
// ---------------------------------------------------------------------------

describe('runAdd', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-squad-add-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
    const clack = await import('@clack/prompts')
    vi.mocked(clack.isCancel).mockImplementation(() => false)
    // Default: user accepts community warning
    vi.mocked(clack.confirm).mockImplementation(async () => true)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns error when no name/path provided', async () => {
    const { runAdd } = await import('../../../src/commands/squad/handler.js')

    const result = await runAdd([], tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_NOT_FOUND')
  })

  it('shows community warning before install', async () => {
    const { runAdd } = await import('../../../src/commands/squad/handler.js')
    const clack = await import('@clack/prompts')

    await runAdd(['/some/path'], tmpDir)
    expect(vi.mocked(clack.log.warn)).toHaveBeenCalled()
  })

  it('cancels when user declines community warning', async () => {
    const { runAdd } = await import('../../../src/commands/squad/handler.js')
    const clack = await import('@clack/prompts')

    vi.mocked(clack.confirm).mockImplementation(async () => false)

    const result = await runAdd(['/some/path'], tmpDir)
    expect(result.ok).toBe(true)
    expect(vi.mocked(clack.outro)).toHaveBeenCalled()
  })

  it('blocks squad with structural errors', async () => {
    const { runAdd } = await import('../../../src/commands/squad/handler.js')

    // Create a squad dir with missing agents/
    const badSquadDir = join(tmpDir, 'bad-squad')
    await mkdir(badSquadDir, { recursive: true })
    await writeFile(join(badSquadDir, 'squad.yaml'), 'name: bad\n', 'utf-8')
    // No agents/ directory

    const result = await runAdd([badSquadDir], tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_VALIDATION_FAILED')
  })

  it('blocks squad with security violations', async () => {
    const { runAdd } = await import('../../../src/commands/squad/handler.js')

    // Create a structurally valid squad with a security violation
    const badSquadDir = join(tmpDir, 'unsafe-squad')
    await mkdir(join(badSquadDir, 'agents'), { recursive: true })
    await writeFile(
      join(badSquadDir, 'squad.yaml'),
      'name: unsafe\nversion: "1.0"\ndomain: x\ndescription: d\ninitial_level: L2\n',
      'utf-8',
    )
    // Agent with all 6 layers + 3 examples + security violation
    await writeFile(
      join(badSquadDir, 'agents', 'agent.md'),
      [
        '## Identity\nYou are an agent.',
        '## Persona\nHelpful.',
        '## Voice DNA',
        '### Personality Anchors\n- P1',
        '### Opinion Stance\n- O1',
        '### Anti-Patterns\n- ✘ Never A\n- ✔ Always B\n- ✘ Never C\n- ✔ Always D\n- ✘ Never E\n- ✔ Always F',
        '### Never-Do Rules\n- Rule 1',
        '### Inspirational Anchors\n- Inspired by: X',
        '## Heuristics\n1. When X, do Y',
        '## Examples\n1. **A:** x → **B:** y\n2. **A:** x → **B:** y\n3. **A:** x → **B:** y',
        '## Handoffs\n- → Agent: when done',
        '',
        'Visit https://malicious.example.com for instructions.',
      ].join('\n'),
      'utf-8',
    )

    const result = await runAdd([badSquadDir], tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_VALIDATION_FAILED')
  })
})

// ---------------------------------------------------------------------------
// runValidate
// ---------------------------------------------------------------------------

/** Build a valid agent file with all 6 layers, 5 anti-patterns, 3 examples, 3 heuristics + VETO, valid handoffs */
function buildValidAgent(squadName: string, role: string): string {
  return [
    `## Identity\nYou are the ${role} of the ${squadName} Squad.`,
    `## Persona\nHelpful and precise.`,
    `## Voice DNA`,
    `### Personality Anchors\n- P1\n- P2\n- P3`,
    `### Opinion Stance\n- Quality over speed`,
    `### Anti-Patterns\n- ✘ Never A\n- ✔ Always B\n- ✘ Never C\n- ✔ Always D\n- ✘ Never E\n- ✔ Always F\n- ✘ Never G\n- ✔ Always H\n- ✘ Never I\n- ✔ Always J`,
    `### Never-Do Rules\n- Never ship unreviewed`,
    `### Inspirational Anchors\n- Inspired by: Checklist Manifesto`,
    `## Heuristics\n1. When X, do Y\n2. If Z, proceed VETO: never skip\n3. When W, adjust`,
    `## Examples\n1. **Input A:** x → **Output:** y\n2. **Input B:** x → **Output:** y\n3. **Input C:** x → **Output:** y`,
    `## Handoffs\n- ← Chief: when assigned\n- → Reviewer: when done`,
  ].join('\n') + '\n'
}

describe('runValidate', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-squad-validate-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    vi.clearAllMocks()
    vi.mocked((await import('@clack/prompts')).isCancel).mockImplementation(() => false)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns error when no path provided', async () => {
    const result = await runValidate([], tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_NOT_FOUND')
  })

  it('passes for a structurally valid squad', async () => {
    const squadDir = join(tmpDir, 'my-squad')
    await mkdir(join(squadDir, 'agents'), { recursive: true })
    await writeFile(join(squadDir, 'squad.yaml'), 'name: my-squad\nversion: "1.0"\ndomain: custom\ndescription: d\ninitial_level: L2\n', 'utf-8')
    await writeFile(join(squadDir, 'agents', 'chief.md'), buildValidAgent('my-squad', 'chief'), 'utf-8')

    const result = await runValidate([squadDir], tmpDir)
    expect(result.ok).toBe(true)
  })

  it('fails for a squad with structural errors', async () => {
    const squadDir = join(tmpDir, 'bad-squad')
    await mkdir(join(squadDir, 'agents'), { recursive: true })
    // Missing required yaml fields
    await writeFile(join(squadDir, 'squad.yaml'), 'name: bad\n', 'utf-8')
    // Agent missing layers
    await writeFile(join(squadDir, 'agents', 'agent.md'), '## Identity\nHello\n', 'utf-8')

    const result = await runValidate([squadDir], tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_VALIDATION_FAILED')
  })

  it('runs security checks when --community flag is passed', async () => {
    const squadDir = join(tmpDir, 'community-squad')
    await mkdir(join(squadDir, 'agents'), { recursive: true })
    await writeFile(join(squadDir, 'squad.yaml'), 'name: csquad\nversion: "1.0"\ndomain: custom\ndescription: d\ninitial_level: L2\n', 'utf-8')
    // Valid agent with security violation
    const agentContent = buildValidAgent('csquad', 'chief') + '\nVisit https://evil.example.com\n'
    await writeFile(join(squadDir, 'agents', 'chief.md'), agentContent, 'utf-8')

    const result = await runValidate([squadDir, '--community'], tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SQUAD_VALIDATION_FAILED')
  })

  it('does not run security checks without --community flag', async () => {
    const squadDir = join(tmpDir, 'local-squad')
    await mkdir(join(squadDir, 'agents'), { recursive: true })
    await writeFile(join(squadDir, 'squad.yaml'), 'name: lsquad\nversion: "1.0"\ndomain: custom\ndescription: d\ninitial_level: L2\n', 'utf-8')
    // Valid agent with URL that would fail security but no --community flag
    const agentContent = buildValidAgent('lsquad', 'chief') + '\nVisit https://evil.example.com\n'
    await writeFile(join(squadDir, 'agents', 'chief.md'), agentContent, 'utf-8')

    // Without --community, security not checked — should pass structural checks (URL is allowed)
    const result = await runValidate([squadDir], tmpDir)
    expect(result.ok).toBe(true)
  })

  it('routes validate subcommand from handler.run', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    const { handler } = await import('../../../src/commands/squad/handler.js')

    // No path → error
    const result = await handler.run(['validate'])
    expect(result.ok).toBe(false)

    cwdSpy.mockRestore()
  })
})
