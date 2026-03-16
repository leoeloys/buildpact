import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as clack from '@clack/prompts'
import {
  validateBuildpactFiles,
  buildAgentModeConfig,
  buildCompatibilityReport,
  handler,
} from '../../../src/commands/migrate-to-agent/handler.js'

// ---------------------------------------------------------------------------
// Mock @clack/prompts
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

// Mock AuditLogger
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a temp dir with minimal .buildpact/ structure */
async function makeTempProject(opts: {
  withConfig?: boolean
  withConstitution?: boolean
  withContext?: boolean
  squadName?: string
} = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'migrate-test-'))
  await mkdir(join(dir, '.buildpact'), { recursive: true })

  if (opts.withConfig) {
    const squad = opts.squadName ? `active_squad: ${opts.squadName}` : 'active_squad: none'
    await writeFile(
      join(dir, '.buildpact', 'config.yaml'),
      `language: en\n${squad}\n`,
      'utf-8',
    )
  }
  if (opts.withConstitution) {
    await writeFile(join(dir, '.buildpact', 'constitution.md'), '# Constitution\n\nNo secrets.', 'utf-8')
  }
  if (opts.withContext) {
    await writeFile(join(dir, '.buildpact', 'project-context.md'), '# Context\n\nSoftware project.', 'utf-8')
  }
  return dir
}

// ---------------------------------------------------------------------------
// validateBuildpactFiles
// ---------------------------------------------------------------------------

describe('validateBuildpactFiles', () => {
  let dir: string

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns allPresent=true when all three files exist', async () => {
    dir = await makeTempProject({ withConfig: true, withConstitution: true, withContext: true })
    const result = await validateBuildpactFiles(dir)
    expect(result.allPresent).toBe(true)
    expect(result.issues).toHaveLength(3)
    expect(result.issues.every((i) => i.status === 'present')).toBe(true)
  })

  it('returns allPresent=false and missing entries when files absent', async () => {
    dir = await makeTempProject() // no files
    const result = await validateBuildpactFiles(dir)
    expect(result.allPresent).toBe(false)
    expect(result.issues.filter((i) => i.status === 'missing')).toHaveLength(3)
  })

  it('marks only missing files when config exists but others do not', async () => {
    dir = await makeTempProject({ withConfig: true })
    const result = await validateBuildpactFiles(dir)
    const presentFiles = result.issues.filter((i) => i.status === 'present').map((i) => i.file)
    expect(presentFiles).toContain('.buildpact/config.yaml')
    expect(result.issues.filter((i) => i.status === 'missing')).toHaveLength(2)
  })

  it('includes remediation steps for missing files in EN', async () => {
    dir = await makeTempProject()
    const result = await validateBuildpactFiles(dir, 'en')
    const missing = result.issues.filter((i) => i.status === 'missing')
    for (const issue of missing) {
      expect(issue.remediation).toBeDefined()
      expect(issue.remediation!.length).toBeGreaterThan(0)
    }
  })

  it('includes remediation steps in PT-BR when lang is pt-br', async () => {
    dir = await makeTempProject()
    const result = await validateBuildpactFiles(dir, 'pt-br')
    const missing = result.issues.filter((i) => i.status === 'missing')
    // PT-BR remediations reference npx buildpact
    for (const issue of missing) {
      expect(issue.remediation).toBeDefined()
    }
  })

  it('returns no remediation for present files', async () => {
    dir = await makeTempProject({ withConfig: true, withConstitution: true, withContext: true })
    const result = await validateBuildpactFiles(dir)
    for (const issue of result.issues) {
      expect(issue.remediation).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// buildAgentModeConfig
// ---------------------------------------------------------------------------

describe('buildAgentModeConfig', () => {
  const NOW = 1_700_000_000_000

  it('contains mode: prompt (not agent) by default', () => {
    const content = buildAgentModeConfig(undefined, NOW)
    expect(content).toContain('mode: prompt')
    expect(content).not.toContain('mode: agent')
  })

  it('includes generated timestamp', () => {
    const content = buildAgentModeConfig(undefined, NOW)
    expect(content).toContain(new Date(NOW).toISOString())
  })

  it('includes squad name when provided', () => {
    const content = buildAgentModeConfig('my-squad', NOW)
    expect(content).toContain('squad: my-squad')
  })

  it('includes placeholder comment when no squad', () => {
    const content = buildAgentModeConfig(undefined, NOW)
    expect(content).toContain('squad: ~')
  })

  it('contains agent_capabilities block', () => {
    const content = buildAgentModeConfig(undefined, NOW)
    expect(content).toContain('agent_capabilities:')
    expect(content).toContain('autonomous_execution: true')
  })

  it('instructs user how to activate Agent Mode', () => {
    const content = buildAgentModeConfig(undefined, NOW)
    expect(content).toContain('prompt')
    expect(content).toContain('agent')
  })
})

// ---------------------------------------------------------------------------
// buildCompatibilityReport
// ---------------------------------------------------------------------------

describe('buildCompatibilityReport', () => {
  const NOW = 1_700_000_000_000

  const allPresent = [
    { file: '.buildpact/config.yaml', status: 'present' as const },
    { file: '.buildpact/constitution.md', status: 'present' as const },
    { file: '.buildpact/project-context.md', status: 'present' as const },
  ]

  const withMissing = [
    { file: '.buildpact/config.yaml', status: 'missing' as const, remediation: 'Run init.' },
    { file: '.buildpact/constitution.md', status: 'present' as const },
    { file: '.buildpact/project-context.md', status: 'missing' as const, remediation: 'Create context.' },
  ]

  it('produces EN report by default', () => {
    const report = buildCompatibilityReport(allPresent, 'en', NOW)
    expect(report).toContain('BuildPact Agent Mode Compatibility Report')
    expect(report).toContain('File Validation')
    expect(report).toContain('Next Steps')
  })

  it('produces PT-BR report when lang is pt-br', () => {
    const report = buildCompatibilityReport(allPresent, 'pt-br', NOW)
    expect(report).toContain('Modo Agente BuildPact')
    expect(report).toContain('Validação de Arquivos')
    expect(report).toContain('Próximos Passos')
  })

  it('includes all file paths in report', () => {
    const report = buildCompatibilityReport(allPresent, 'en', NOW)
    for (const issue of allPresent) {
      expect(report).toContain(issue.file)
    }
  })

  it('includes remediation steps for missing files', () => {
    const report = buildCompatibilityReport(withMissing, 'en', NOW)
    expect(report).toContain('Run init.')
    expect(report).toContain('Create context.')
  })

  it('includes timestamp in report', () => {
    const report = buildCompatibilityReport(allPresent, 'en', NOW)
    expect(report).toContain(new Date(NOW).toISOString())
  })

  it('shows count of present vs missing files', () => {
    const report = buildCompatibilityReport(withMissing, 'en', NOW)
    expect(report).toContain('Present: 1')
    expect(report).toContain('Missing: 2')
  })

  it('mentions Prompt Mode preservation in next steps', () => {
    const report = buildCompatibilityReport(allPresent, 'en', NOW)
    expect(report).toContain('Prompt Mode')
  })
})

// ---------------------------------------------------------------------------
// handler integration
// ---------------------------------------------------------------------------

describe('migrate-to-agent handler', () => {
  let dir: string
  let origCwd: () => string

  beforeEach(() => {
    vi.clearAllMocks()
    origCwd = process.cwd.bind(process)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('succeeds and writes agent-mode.yaml + report when all files present', async () => {
    dir = await makeTempProject({ withConfig: true, withConstitution: true, withContext: true })
    vi.spyOn(process, 'cwd').mockReturnValue(dir)

    const result = await handler.run([])
    expect(result.ok).toBe(true)

    // agent-mode.yaml written
    const configContent = await readFile(join(dir, '.buildpact', 'agent-mode.yaml'), 'utf-8')
    expect(configContent).toContain('mode: prompt')

    // compatibility report written
    const reportContent = await readFile(
      join(dir, '.buildpact', 'agent-mode-compatibility.md'),
      'utf-8',
    )
    expect(reportContent).toContain('BuildPact Agent Mode Compatibility Report')
  })

  it('succeeds even when files are missing (report warns user)', async () => {
    dir = await makeTempProject() // empty project
    vi.spyOn(process, 'cwd').mockReturnValue(dir)

    const result = await handler.run([])
    expect(result.ok).toBe(true)

    // config still written
    const configContent = await readFile(join(dir, '.buildpact', 'agent-mode.yaml'), 'utf-8')
    expect(configContent).toContain('mode: prompt')

    // warn shown
    expect(vi.mocked(clack.log.warn)).toHaveBeenCalled()
  })

  it('embeds active squad in agent-mode.yaml when squad configured', async () => {
    dir = await makeTempProject({
      withConfig: true,
      withConstitution: true,
      withContext: true,
      squadName: 'software-squad',
    })
    vi.spyOn(process, 'cwd').mockReturnValue(dir)

    await handler.run([])

    const configContent = await readFile(join(dir, '.buildpact', 'agent-mode.yaml'), 'utf-8')
    expect(configContent).toContain('squad: software-squad')
  })

  it('shows intro and outro via clack', async () => {
    dir = await makeTempProject({ withConfig: true, withConstitution: true, withContext: true })
    vi.spyOn(process, 'cwd').mockReturnValue(dir)

    await handler.run([])

    expect(vi.mocked(clack.intro)).toHaveBeenCalled()
    expect(vi.mocked(clack.outro)).toHaveBeenCalled()
  })
})
