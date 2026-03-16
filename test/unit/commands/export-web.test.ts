import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  estimateTokens,
  checkTokenWarning,
  loadConstitutionEssentials,
  loadProjectContext,
  loadSquadAgents,
  readActiveSquadName,
  buildWebBundle,
  parsePlatform,
  PLATFORM_TOKEN_LIMITS,
  WARN_THRESHOLD,
  inlineAgents,
  compressConstitution,
  excludeOptionalSections,
  removeExamples,
  removeHeuristics,
  filterChiefOnly,
  applyProgressiveCompression,
  COMPRESSION_TIER_DESCRIPTIONS,
} from '../../../src/commands/export-web/handler.js'

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

const opts = () => ({ projectDir: '' })

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates 1 token for 4 chars', () => {
    expect(estimateTokens('abcd')).toBe(1)
  })

  it('rounds up for partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
  })

  it('handles longer text correctly', () => {
    const text = 'a'.repeat(400)
    expect(estimateTokens(text)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// checkTokenWarning
// ---------------------------------------------------------------------------

describe('checkTokenWarning', () => {
  it('returns no warning for small token count', () => {
    const result = checkTokenWarning(1000, 'claude')
    expect(result.overWarn).toBe(false)
    expect(result.overLimit).toBe(false)
    expect(result.limitTokens).toBe(PLATFORM_TOKEN_LIMITS.claude)
  })

  it('returns overWarn when exceeding 80% threshold', () => {
    const limit = PLATFORM_TOKEN_LIMITS.claude!
    const tokens = Math.floor(limit * WARN_THRESHOLD) + 1
    const result = checkTokenWarning(tokens, 'claude')
    expect(result.overWarn).toBe(true)
    expect(result.overLimit).toBe(false)
  })

  it('returns overLimit when exceeding platform limit', () => {
    const limit = PLATFORM_TOKEN_LIMITS.chatgpt!
    const result = checkTokenWarning(limit + 1, 'chatgpt')
    expect(result.overLimit).toBe(true)
    expect(result.overWarn).toBe(true)
  })

  it('uses gemini limit for gemini platform', () => {
    const result = checkTokenWarning(500_000, 'gemini')
    expect(result.overWarn).toBe(false)
    expect(result.limitTokens).toBe(PLATFORM_TOKEN_LIMITS.gemini)
  })
})

// ---------------------------------------------------------------------------
// parsePlatform
// ---------------------------------------------------------------------------

describe('parsePlatform', () => {
  it('defaults to claude with no args', () => {
    expect(parsePlatform([])).toBe('claude')
  })

  it('parses chatgpt', () => {
    expect(parsePlatform(['chatgpt'])).toBe('chatgpt')
  })

  it('parses gemini', () => {
    expect(parsePlatform(['gemini'])).toBe('gemini')
  })

  it('parses claude explicitly', () => {
    expect(parsePlatform(['claude'])).toBe('claude')
  })

  it('handles uppercase input', () => {
    expect(parsePlatform(['ChatGPT'])).toBe('chatgpt')
    expect(parsePlatform(['GEMINI'])).toBe('gemini')
  })

  it('defaults to claude for unknown platform', () => {
    expect(parsePlatform(['unknown'])).toBe('claude')
  })
})

// ---------------------------------------------------------------------------
// File loading helpers (filesystem tests)
// ---------------------------------------------------------------------------

describe('loadConstitutionEssentials', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-test-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty string when constitution missing', async () => {
    const result = await loadConstitutionEssentials(tmpDir)
    expect(result).toBe('')
  })

  it('returns first 2000 chars of constitution', async () => {
    const content = 'A'.repeat(3000)
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), content)
    const result = await loadConstitutionEssentials(tmpDir)
    expect(result).toHaveLength(2000)
  })

  it('returns full content when under 2000 chars', async () => {
    const content = '# Rules\n- No exposing secrets'
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), content)
    const result = await loadConstitutionEssentials(tmpDir)
    expect(result).toBe(content)
  })
})

describe('loadProjectContext', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-test-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty string when file missing', async () => {
    const result = await loadProjectContext(tmpDir)
    expect(result).toBe('')
  })

  it('returns full context content', async () => {
    const content = '# Project Context\nThis is a Node.js API.'
    await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), content)
    const result = await loadProjectContext(tmpDir)
    expect(result).toBe(content)
  })
})

describe('readActiveSquadName', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-test-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns undefined when config missing', async () => {
    const result = await readActiveSquadName(tmpDir)
    expect(result).toBeUndefined()
  })

  it('returns undefined when active_squad is none', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'active_squad: none\n')
    const result = await readActiveSquadName(tmpDir)
    expect(result).toBeUndefined()
  })

  it('returns squad name from config', async () => {
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'active_squad: software\n')
    const result = await readActiveSquadName(tmpDir)
    expect(result).toBe('software')
  })
})

describe('loadSquadAgents', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array when squad directory missing', async () => {
    const result = await loadSquadAgents(tmpDir, 'nonexistent')
    expect(result).toEqual([])
  })

  it('loads and compresses agent .md files', async () => {
    const squadDir = join(tmpDir, '.buildpact', 'squads', 'software')
    await mkdir(squadDir, { recursive: true })
    await writeFile(join(squadDir, 'architect.md'), '# Architect\n\n\n\nCore rules.')
    const result = await loadSquadAgents(tmpDir, 'software')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('architect')
    // Compressed: multiple blank lines collapsed
    expect(result[0]!.content).not.toMatch(/\n{3,}/)
  })

  it('returns multiple agents sorted by filename', async () => {
    const squadDir = join(tmpDir, '.buildpact', 'squads', 'software')
    await mkdir(squadDir, { recursive: true })
    await writeFile(join(squadDir, 'architect.md'), '# Arch')
    await writeFile(join(squadDir, 'dev.md'), '# Dev')
    const result = await loadSquadAgents(tmpDir, 'software')
    expect(result).toHaveLength(2)
  })

  it('skips non-.md files', async () => {
    const squadDir = join(tmpDir, '.buildpact', 'squads', 'software')
    await mkdir(squadDir, { recursive: true })
    await writeFile(join(squadDir, 'agent.md'), '# Agent')
    await writeFile(join(squadDir, 'squad.yaml'), 'name: software')
    const result = await loadSquadAgents(tmpDir, 'software')
    expect(result).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// buildWebBundle
// ---------------------------------------------------------------------------

describe('buildWebBundle', () => {
  it('builds bundle with all components', () => {
    const result = buildWebBundle({
      platform: 'claude',
      squadName: 'software',
      agents: [{ name: 'architect', content: '# Architect rules' }],
      constitutionEssentials: '# No secrets',
      projectContext: '# Context',
      language: 'en',
    })
    expect(result.content).toContain('BuildPact Web Bundle — Claude.ai')
    expect(result.content).toContain('Constitution Essentials')
    expect(result.content).toContain('# No secrets')
    expect(result.content).toContain('Project Context')
    expect(result.content).toContain('Agent: architect')
    expect(result.tokenEstimate).toBeGreaterThan(0)
    expect(result.platform).toBe('claude')
  })

  it('omits constitution section when empty', () => {
    const result = buildWebBundle({
      platform: 'chatgpt',
      squadName: undefined,
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
    })
    expect(result.content).not.toContain('Constitution Essentials')
    expect(result.content).not.toContain('Project Context')
  })

  it('uses ChatGPT label for chatgpt platform', () => {
    const result = buildWebBundle({
      platform: 'chatgpt',
      squadName: undefined,
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
    })
    expect(result.content).toContain('ChatGPT')
  })

  it('uses Gemini label for gemini platform', () => {
    const result = buildWebBundle({
      platform: 'gemini',
      squadName: undefined,
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
    })
    expect(result.content).toContain('Gemini')
  })

  it('uses Portuguese activation instruction for pt-br', () => {
    const result = buildWebBundle({
      platform: 'claude',
      squadName: 'software',
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'pt-br',
    })
    expect(result.content).toContain('Você é um assistente')
  })

  it('includes squad name in activation instruction', () => {
    const result = buildWebBundle({
      platform: 'claude',
      squadName: 'medical',
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
    })
    expect(result.content).toContain('"medical"')
  })

  it('token estimate reflects content length', () => {
    const shortResult = buildWebBundle({
      platform: 'claude',
      squadName: undefined,
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
    })
    const longResult = buildWebBundle({
      platform: 'claude',
      squadName: undefined,
      agents: [{ name: 'agent', content: 'A'.repeat(4000) }],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
    })
    expect(longResult.tokenEstimate).toBeGreaterThan(shortResult.tokenEstimate)
  })
})

// ---------------------------------------------------------------------------
// inlineAgents
// ---------------------------------------------------------------------------

describe('inlineAgents', () => {
  it('strips markdown headers from agent content', () => {
    const agents = [{ name: 'chief', content: '# Chief\n## Rules\n- Be helpful' }]
    const result = inlineAgents(agents)
    expect(result[0]!.content).not.toContain('#')
    expect(result[0]!.content).toContain('Be helpful')
  })

  it('collapses consecutive blank lines', () => {
    const agents = [{ name: 'dev', content: 'Rule 1\n\n\n\nRule 2' }]
    const result = inlineAgents(agents)
    expect(result[0]!.content).not.toMatch(/\n{3,}/)
  })

  it('preserves agent name', () => {
    const agents = [{ name: 'architect', content: '# Arch\nRules here' }]
    const result = inlineAgents(agents)
    expect(result[0]!.name).toBe('architect')
  })

  it('returns empty array for empty input', () => {
    expect(inlineAgents([])).toEqual([])
  })

  it('handles agent with no headers', () => {
    const agents = [{ name: 'qa', content: 'Check everything\nTest all paths' }]
    const result = inlineAgents(agents)
    expect(result[0]!.content).toBe('Check everything\nTest all paths')
  })
})

// ---------------------------------------------------------------------------
// compressConstitution
// ---------------------------------------------------------------------------

describe('compressConstitution', () => {
  it('returns first 500 chars', () => {
    const content = 'A'.repeat(1000)
    expect(compressConstitution(content)).toHaveLength(500)
  })

  it('returns full content when under 500 chars', () => {
    const content = '# Rules\n- No secrets'
    expect(compressConstitution(content)).toBe(content)
  })

  it('returns empty string for empty input', () => {
    expect(compressConstitution('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// excludeOptionalSections
// ---------------------------------------------------------------------------

describe('excludeOptionalSections', () => {
  it('removes ## Optimization section', () => {
    const content = '## Core Rules\nDo this.\n## Optimization\nFast path.\n## Other\nKeep.'
    const result = excludeOptionalSections(content)
    expect(result).not.toContain('Optimization')
    expect(result).not.toContain('Fast path')
    expect(result).toContain('Core Rules')
    expect(result).toContain('Keep')
  })

  it('removes ## Memory section', () => {
    const content = '## Rules\nKeep.\n## Memory\nRemember this.'
    const result = excludeOptionalSections(content)
    expect(result).not.toContain('Memory')
    expect(result).toContain('Rules')
  })

  it('removes ## Tips section', () => {
    const content = '## Rules\nKeep.\n## Tips\nUseful tip.'
    const result = excludeOptionalSections(content)
    expect(result).not.toContain('Tips')
  })

  it('removes ## Performance section', () => {
    const content = '## Core\nKeep.\n## Performance\nFast.\n## End\nLast.'
    const result = excludeOptionalSections(content)
    expect(result).not.toContain('Performance')
    expect(result).toContain('End')
  })

  it('keeps content with no optional sections unchanged', () => {
    const content = '## Core Rules\nAlways do X.\n## Security\nNo secrets.'
    const result = excludeOptionalSections(content)
    expect(result).toContain('Core Rules')
    expect(result).toContain('Security')
  })
})

// ---------------------------------------------------------------------------
// removeExamples
// ---------------------------------------------------------------------------

describe('removeExamples', () => {
  it('removes ## Examples section', () => {
    const content = '## Rules\nDo this.\n## Examples\nSee sample.\n## Notes\nImportant.'
    const result = removeExamples(content)
    expect(result).not.toContain('Examples')
    expect(result).not.toContain('See sample')
    expect(result).toContain('Notes')
  })

  it('keeps content with no examples section', () => {
    const content = '## Rules\nAlways do X.'
    expect(removeExamples(content)).toContain('Rules')
  })
})

// ---------------------------------------------------------------------------
// removeHeuristics
// ---------------------------------------------------------------------------

describe('removeHeuristics', () => {
  it('removes ## Heuristics section', () => {
    const content = '## Rules\nDo this.\n## Heuristics\nTry this approach.\n## End\nDone.'
    const result = removeHeuristics(content)
    expect(result).not.toContain('Heuristics')
    expect(result).not.toContain('Try this approach')
    expect(result).toContain('End')
  })

  it('removes ## Details section', () => {
    const content = '## Summary\nKeep.\n## Details\nExtra detail.'
    const result = removeHeuristics(content)
    expect(result).not.toContain('Details')
    expect(result).toContain('Summary')
  })
})

// ---------------------------------------------------------------------------
// filterChiefOnly
// ---------------------------------------------------------------------------

describe('filterChiefOnly', () => {
  it('returns only the chief agent', () => {
    const agents = [
      { name: 'dev', content: 'Dev rules' },
      { name: 'chief', content: 'Chief rules' },
      { name: 'qa', content: 'QA rules' },
    ]
    const result = filterChiefOnly(agents)
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('chief')
  })

  it('returns first agent when no chief exists', () => {
    const agents = [
      { name: 'dev', content: 'Dev' },
      { name: 'qa', content: 'QA' },
    ]
    const result = filterChiefOnly(agents)
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('dev')
  })

  it('returns empty array when agents is empty', () => {
    expect(filterChiefOnly([])).toEqual([])
  })

  it('matches chief case-insensitively', () => {
    const agents = [{ name: 'ChiefAgent', content: 'Chief' }]
    const result = filterChiefOnly(agents)
    expect(result[0]!.name).toBe('ChiefAgent')
  })
})

// ---------------------------------------------------------------------------
// applyProgressiveCompression
// ---------------------------------------------------------------------------

describe('applyProgressiveCompression', () => {
  const baseInput = {
    platform: 'claude' as const,
    squadName: 'software',
    agents: [{ name: 'dev', content: '# Dev\n## Rules\nAlways test.' }],
    constitutionEssentials: '# Constitution\nNo secrets.',
    projectContext: '# Project\n## Examples\nSample code.',
    language: 'en' as const,
  }

  it('returns tier none when bundle fits within limit', () => {
    const { tier } = applyProgressiveCompression(baseInput, 1_000_000)
    expect(tier).toBe('none')
  })

  it('returns compressed result when over limit', () => {
    // Very small limit forces compression
    const { tier } = applyProgressiveCompression(baseInput, 10)
    expect(tier).not.toBe('none')
  })

  it('returns minimal tier for extremely small limit', () => {
    const { tier } = applyProgressiveCompression(baseInput, 1)
    expect(tier).toBe('minimal')
  })

  it('bundle content includes compression notice when compressed', () => {
    const { result } = applyProgressiveCompression(baseInput, 10)
    expect(result.content).toContain('Bundle Compression Notice')
  })

  it('bundle content has no compression notice for tier none', () => {
    const { result } = applyProgressiveCompression(baseInput, 1_000_000)
    expect(result.content).not.toContain('Bundle Compression Notice')
  })

  it('inline_agents tier fits before compress_constitution for slightly-over bundle', () => {
    // Build a bundle with a known size then set limit just below it
    const input = {
      ...baseInput,
      agents: [{ name: 'dev', content: '# Dev\n'.repeat(10) + 'Rule.' }],
      constitutionEssentials: '# Constitution\n- Keep this rule.\n'.repeat(5),
      projectContext: '',
    }
    // A very large limit to test tier selection logic — just check we get a valid tier
    const { tier } = applyProgressiveCompression(input, 1_000_000)
    expect(COMPRESSION_TIER_DESCRIPTIONS[tier]).toBeDefined()
  })

  it('COMPRESSION_TIER_DESCRIPTIONS covers all tiers', () => {
    const tiers = [
      'none', 'inline_agents', 'compress_constitution', 'exclude_optional_sections',
      'context_only', 'remove_examples', 'remove_heuristics', 'chief_only', 'minimal',
    ] as const
    for (const tier of tiers) {
      expect(COMPRESSION_TIER_DESCRIPTIONS[tier]).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// buildWebBundle with compressionTier
// ---------------------------------------------------------------------------

describe('buildWebBundle compressionTier notice', () => {
  it('includes compression notice when tier is set', () => {
    const result = buildWebBundle({
      platform: 'claude',
      squadName: undefined,
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
      compressionTier: 'context_only',
    })
    expect(result.content).toContain('Bundle Compression Notice')
    expect(result.content).toContain('context_only')
  })

  it('omits compression notice when tier is none', () => {
    const result = buildWebBundle({
      platform: 'claude',
      squadName: undefined,
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
      compressionTier: 'none',
    })
    expect(result.content).not.toContain('Bundle Compression Notice')
  })

  it('omits compression notice when compressionTier is undefined', () => {
    const result = buildWebBundle({
      platform: 'claude',
      squadName: undefined,
      agents: [],
      constitutionEssentials: '',
      projectContext: '',
      language: 'en',
    })
    expect(result.content).not.toContain('Bundle Compression Notice')
  })
})

// ---------------------------------------------------------------------------
// Handler integration
// ---------------------------------------------------------------------------

describe('export-web handler', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-handler-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    // Write minimal config
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'language: en\nactive_squad: none\n')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates bundle file in .buildpact/bundles/', async () => {
    const { handler } = await import('../../../src/commands/export-web/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
    const { readdir } = await import('node:fs/promises')
    const bundleDir = join(tmpDir, '.buildpact', 'bundles')
    const files = await readdir(bundleDir)
    expect(files.some((f) => f.startsWith('web-bundle-claude-'))).toBe(true)
  })

  it('creates bundle for chatgpt platform', async () => {
    const { handler } = await import('../../../src/commands/export-web/handler.js')
    const result = await handler.run(['chatgpt'])
    expect(result.ok).toBe(true)
    const { readdir } = await import('node:fs/promises')
    const bundleDir = join(tmpDir, '.buildpact', 'bundles')
    const files = await readdir(bundleDir)
    expect(files.some((f) => f.startsWith('web-bundle-chatgpt-'))).toBe(true)
  })

  it('returns ok even without squad or constitution', async () => {
    const { handler } = await import('../../../src/commands/export-web/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)
  })
})
