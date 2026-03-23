import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  PLATFORM_LIMITS,
  checkTokenBudget,
  assembleBundle,
  compressConstitution,
  filterActiveAgents,
  applyStandardCompression,
  computeBundleHash,
} from '../../../src/foundation/bundle.js'
import type { BundlePart, AgentFile, BundlePartMap, BundleMetadata } from '../../../src/foundation/bundle.js'

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates 1 token for exactly 4 chars', () => {
    expect(estimateTokens('abcd')).toBe(1)
  })

  it('rounds up for partial token', () => {
    expect(estimateTokens('abc')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
  })

  it('handles longer text correctly', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100)
  })

  it('handles a single character', () => {
    expect(estimateTokens('x')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// PLATFORM_LIMITS
// ---------------------------------------------------------------------------

describe('PLATFORM_LIMITS', () => {
  it('defines claude.ai limit as 180000', () => {
    expect(PLATFORM_LIMITS['claude.ai']).toBe(180_000)
  })

  it('defines chatgpt limit as 128000', () => {
    expect(PLATFORM_LIMITS['chatgpt']).toBe(128_000)
  })

  it('defines gemini limit as 1000000', () => {
    expect(PLATFORM_LIMITS['gemini']).toBe(1_000_000)
  })

  it('has all three platform keys', () => {
    const keys = Object.keys(PLATFORM_LIMITS)
    expect(keys).toContain('claude.ai')
    expect(keys).toContain('chatgpt')
    expect(keys).toContain('gemini')
    expect(keys).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// checkTokenBudget
// ---------------------------------------------------------------------------

describe('checkTokenBudget', () => {
  it('returns withinLimit=true and warning=false for a small count', () => {
    const result = checkTokenBudget(1_000, 'claude.ai')
    expect(result.withinLimit).toBe(true)
    expect(result.warning).toBe(false)
    expect(result.utilizationPct).toBeCloseTo(1_000 / 180_000)
  })

  it('returns warning=true when token count >= 80% of limit', () => {
    const limit = PLATFORM_LIMITS['claude.ai']!
    const at80 = Math.floor(limit * 0.80)
    const resultAt80 = checkTokenBudget(at80, 'claude.ai')
    expect(resultAt80.warning).toBe(true)
    expect(resultAt80.withinLimit).toBe(true)
  })

  it('returns warning=false when token count is just below 80%', () => {
    const limit = PLATFORM_LIMITS['claude.ai']!
    const just_below = Math.floor(limit * 0.80) - 1
    const result = checkTokenBudget(just_below, 'claude.ai')
    expect(result.warning).toBe(false)
  })

  it('returns withinLimit=false when token count exceeds limit', () => {
    const limit = PLATFORM_LIMITS['chatgpt']!
    const result = checkTokenBudget(limit + 1, 'chatgpt')
    expect(result.withinLimit).toBe(false)
    expect(result.warning).toBe(true)
  })

  it('uses chatgpt limit correctly', () => {
    const result = checkTokenBudget(128_001, 'chatgpt')
    expect(result.withinLimit).toBe(false)
    expect(result.utilizationPct).toBeGreaterThan(1)
  })

  it('uses gemini limit correctly', () => {
    const result = checkTokenBudget(500_000, 'gemini')
    expect(result.withinLimit).toBe(true)
    expect(result.warning).toBe(false)
    expect(result.utilizationPct).toBeCloseTo(500_000 / 1_000_000)
  })

  it('defaults to 180000 for unknown platform', () => {
    const result = checkTokenBudget(1_000, 'unknown-platform')
    expect(result.withinLimit).toBe(true)
    expect(result.utilizationPct).toBeCloseTo(1_000 / 180_000)
  })

  it('returns utilizationPct exactly 1 at the limit', () => {
    const limit = PLATFORM_LIMITS['claude.ai']!
    const result = checkTokenBudget(limit, 'claude.ai')
    expect(result.withinLimit).toBe(true)
    expect(result.utilizationPct).toBeCloseTo(1.0)
  })
})

// ---------------------------------------------------------------------------
// assembleBundle
// ---------------------------------------------------------------------------

describe('assembleBundle', () => {
  it('assembles parts with === HEADER === delimiters', () => {
    const parts: BundlePart[] = [
      { header: 'SECTION ONE', content: 'Content A' },
      { header: 'SECTION TWO', content: 'Content B' },
    ]
    const result = assembleBundle(parts)
    expect(result).toContain('=== SECTION ONE ===')
    expect(result).toContain('Content A')
    expect(result).toContain('=== SECTION TWO ===')
    expect(result).toContain('Content B')
  })

  it('skips parts with empty content', () => {
    const parts: BundlePart[] = [
      { header: 'PRESENT', content: 'Has content' },
      { header: 'EMPTY', content: '' },
      { header: 'WHITESPACE', content: '   ' },
    ]
    const result = assembleBundle(parts)
    expect(result).toContain('=== PRESENT ===')
    expect(result).not.toContain('=== EMPTY ===')
    expect(result).not.toContain('=== WHITESPACE ===')
  })

  it('returns empty string when all parts are empty', () => {
    const parts: BundlePart[] = [
      { header: 'A', content: '' },
      { header: 'B', content: '  ' },
    ]
    expect(assembleBundle(parts)).toBe('')
  })

  it('returns empty string for empty array', () => {
    expect(assembleBundle([])).toBe('')
  })

  it('trims content whitespace in output', () => {
    const parts: BundlePart[] = [
      { header: 'H', content: '  trimmed content  ' },
    ]
    const result = assembleBundle(parts)
    expect(result).toContain('trimmed content')
    expect(result).not.toMatch(/^\s+/)
  })

  it('joins multiple parts with double newline separator', () => {
    const parts: BundlePart[] = [
      { header: 'A', content: 'alpha' },
      { header: 'B', content: 'beta' },
    ]
    const result = assembleBundle(parts)
    expect(result).toMatch(/=== A ===\nalpha\n\n=== B ===\nbeta/)
  })

  it('handles a single part', () => {
    const parts: BundlePart[] = [
      { header: 'ONLY', content: 'Solo content' },
    ]
    const result = assembleBundle(parts)
    expect(result).toBe('=== ONLY ===\nSolo content')
  })

  it('preserves multiline content', () => {
    const parts: BundlePart[] = [
      { header: 'RULES', content: 'Rule 1\nRule 2\nRule 3' },
    ]
    const result = assembleBundle(parts)
    expect(result).toContain('Rule 1\nRule 2\nRule 3')
  })
})

// ---------------------------------------------------------------------------
// compressConstitution (Story 10.2 — Task 1.2)
// ---------------------------------------------------------------------------

describe('compressConstitution', () => {
  it('keeps bullet rules starting with - ', () => {
    const raw = '- Always write tests\n- Never expose secrets'
    const result = compressConstitution(raw)
    expect(result).toContain('- Always write tests')
    expect(result).toContain('- Never expose secrets')
  })

  it('keeps bullet rules starting with * ', () => {
    const raw = '* Rule one\n* Rule two'
    const result = compressConstitution(raw)
    expect(result).toContain('* Rule one')
    expect(result).toContain('* Rule two')
  })

  it('keeps numbered list items', () => {
    const raw = '1. First rule\n2. Second rule\n3. Third rule'
    const result = compressConstitution(raw)
    expect(result).toContain('1. First rule')
    expect(result).toContain('2. Second rule')
    expect(result).toContain('3. Third rule')
  })

  it('keeps headings', () => {
    const raw = '# Constitution\n## Core Rules\n- Follow them'
    const result = compressConstitution(raw)
    expect(result).toContain('# Constitution')
    expect(result).toContain('## Core Rules')
  })

  it('strips HTML-style markdown comments', () => {
    const raw = '<!-- This is a comment -->\n- Keep this rule'
    const result = compressConstitution(raw)
    expect(result).not.toContain('This is a comment')
    expect(result).toContain('- Keep this rule')
  })

  it('strips plain text rationale paragraphs', () => {
    const raw = [
      '# Rules',
      'This is a rationale paragraph that explains why the rule exists.',
      '- The actual rule',
      'More rationale here.',
    ].join('\n')
    const result = compressConstitution(raw)
    expect(result).not.toContain('This is a rationale paragraph')
    expect(result).not.toContain('More rationale here')
    expect(result).toContain('- The actual rule')
  })

  it('strips fenced code blocks (inline examples)', () => {
    const raw = '- Rule one\n```\nconst x = 1\n```\n- Rule two'
    const result = compressConstitution(raw)
    expect(result).not.toContain('const x = 1')
    expect(result).toContain('- Rule one')
    expect(result).toContain('- Rule two')
  })

  it('strips indented code blocks', () => {
    const raw = '- Rule\n    someCodeExample()'
    const result = compressConstitution(raw)
    expect(result).not.toContain('someCodeExample')
    expect(result).toContain('- Rule')
  })

  it('returns empty string for empty input', () => {
    expect(compressConstitution('')).toBe('')
  })

  it('produces same output for same input (deterministic)', () => {
    const raw = '# Constitution\n<!-- comment -->\n- Rule one\nRationale.\n- Rule two'
    const r1 = compressConstitution(raw)
    const r2 = compressConstitution(raw)
    expect(r1).toBe(r2)
  })

  it('does not produce consecutive blank lines', () => {
    const raw = '- Rule\n\n\n\n- Another rule'
    const result = compressConstitution(raw)
    expect(result).not.toMatch(/\n{3,}/)
  })
})

// ---------------------------------------------------------------------------
// filterActiveAgents (Story 10.2 — Task 1.3)
// ---------------------------------------------------------------------------

describe('filterActiveAgents', () => {
  it('returns all agents when none have squad set', () => {
    const agents: AgentFile[] = [
      { name: 'chief', content: 'Chief rules' },
      { name: 'dev', content: 'Dev rules' },
    ]
    const result = filterActiveAgents(agents, 'software')
    expect(result).toHaveLength(2)
  })

  it('returns only agents matching the active squad', () => {
    const agents: AgentFile[] = [
      { name: 'chief', content: 'Chief', squad: 'software' },
      { name: 'dev', content: 'Dev', squad: 'software' },
      { name: 'doctor', content: 'Doctor', squad: 'medical' },
    ]
    const result = filterActiveAgents(agents, 'software')
    expect(result).toHaveLength(2)
    expect(result.map((a) => a.name)).toContain('chief')
    expect(result.map((a) => a.name)).toContain('dev')
    expect(result.map((a) => a.name)).not.toContain('doctor')
  })

  it('excludes agents from other squads', () => {
    const agents: AgentFile[] = [
      { name: 'chief', content: 'Chief', squad: 'medical' },
    ]
    const result = filterActiveAgents(agents, 'software')
    expect(result).toHaveLength(0)
  })

  it('passes through agents with squad field matching active squad', () => {
    const agents: AgentFile[] = [
      { name: 'dev', content: 'Dev', squad: 'software' },
    ]
    const result = filterActiveAgents(agents, 'software')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('dev')
  })

  it('returns empty array for empty input', () => {
    expect(filterActiveAgents([], 'software')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// applyStandardCompression (Story 10.2 — Task 1.4)
// ---------------------------------------------------------------------------

describe('applyStandardCompression', () => {
  const smallParts: BundlePartMap = {
    agents: [{ name: 'chief', content: '- Rule one\n- Rule two', squad: 'software' }],
    activeSquad: 'software',
    constitution: '# Rules\n- Keep it simple',
    projectContext: '# My Project',
    platform: 'claude.ai',
  }

  it('returns compressionLevel 0 when bundle fits within token limit', () => {
    // Small content always fits within 180K token limit
    const result = applyStandardCompression(smallParts)
    expect(result.compressionLevel).toBe(0)
    expect(result.sectionsRemoved).toEqual([])
  })

  it('includes SQUAD AGENTS section in output', () => {
    const result = applyStandardCompression(smallParts)
    expect(result.content).toContain('SQUAD AGENTS')
    expect(result.content).toContain('chief')
  })

  it('includes CONSTITUTION RULES section in output', () => {
    const result = applyStandardCompression(smallParts)
    expect(result.content).toContain('CONSTITUTION RULES')
    expect(result.content).toContain('Keep it simple')
  })

  it('includes PROJECT CONTEXT section in output', () => {
    const result = applyStandardCompression(smallParts)
    expect(result.content).toContain('PROJECT CONTEXT')
    expect(result.content).toContain('My Project')
  })

  it('tokenCount equals estimateTokens(content)', () => {
    const result = applyStandardCompression(smallParts)
    expect(result.tokenCount).toBe(Math.ceil(result.content.length / 4))
  })

  it('returns compressionLevel 1 when bundle exceeds token limit', () => {
    // Use a very low token limit platform to force compression
    const largeParts: BundlePartMap = {
      ...smallParts,
      constitution: 'This is a rationale paragraph.\n'.repeat(50) + '- Keep rule',
      platform: 'chatgpt',
    }
    // Override PLATFORM_LIMITS via a tiny-limit platform scenario:
    // Use a real platform but with oversized content
    const hugeParts: BundlePartMap = {
      agents: [{ name: 'a', content: 'x'.repeat(600_000), squad: 'software' }],
      activeSquad: 'software',
      constitution: '# C\n' + 'rationale para\n'.repeat(1000) + '- rule',
      projectContext: '# P\n' + 'context\n'.repeat(500),
      platform: 'chatgpt', // 128K limit
    }
    const result = applyStandardCompression(hugeParts)
    // With 600K chars of agent content alone, raw tokens >> 128K limit
    expect(result.compressionLevel).toBe(1)
    expect(result.sectionsRemoved.length).toBeGreaterThan(0)
  })

  it('step 1: filters inactive squad agents', () => {
    const multiSquadParts: BundlePartMap = {
      agents: [
        { name: 'chief', content: 'Chief rules', squad: 'software' },
        { name: 'doctor', content: 'Medical rules', squad: 'medical' },
      ],
      activeSquad: 'software',
      constitution: '',
      projectContext: '',
      platform: 'claude.ai',
    }
    const result = applyStandardCompression(multiSquadParts)
    expect(result.content).toContain('chief')
    expect(result.content).not.toContain('Medical rules')
  })

  it('applies all 4 steps in deterministic order (same input → same output)', () => {
    const r1 = applyStandardCompression(smallParts)
    const r2 = applyStandardCompression(smallParts)
    expect(r1.content).toBe(r2.content)
    expect(r1.compressionLevel).toBe(r2.compressionLevel)
  })
})

// ---------------------------------------------------------------------------
// computeBundleHash (Story 10.4 — Task 1.1)
// ---------------------------------------------------------------------------

describe('computeBundleHash', () => {
  it('returns a 16-char lowercase hex string', () => {
    const hash = computeBundleHash(['content1', 'content2'])
    expect(hash).toHaveLength(16)
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('same inputs produce same hash (deterministic)', () => {
    const h1 = computeBundleHash(['file1 contents', 'file2 contents'])
    const h2 = computeBundleHash(['file1 contents', 'file2 contents'])
    expect(h1).toBe(h2)
  })

  it('different inputs produce different hash', () => {
    const h1 = computeBundleHash(['file content A'])
    const h2 = computeBundleHash(['file content B'])
    expect(h1).not.toBe(h2)
  })

  it('empty array produces consistent 16-char hash', () => {
    const h1 = computeBundleHash([])
    const h2 = computeBundleHash([])
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(16)
  })

  it('order matters — different order produces different hash', () => {
    const h1 = computeBundleHash(['aaa', 'bbb'])
    const h2 = computeBundleHash(['bbb', 'aaa'])
    expect(h1).not.toBe(h2)
  })

  it('single file content hashes correctly', () => {
    const hash = computeBundleHash(['only content'])
    expect(hash).toHaveLength(16)
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })
})

// ---------------------------------------------------------------------------
// assembleBundle with BundleMetadata (Story 10.4 — Task 1.3)
// ---------------------------------------------------------------------------

describe('assembleBundle with BundleMetadata', () => {
  const metadata: BundleMetadata = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    platform: 'claude.ai',
    bundleHash: 'abc123def456abcd',
    sourceFiles: ['constitution.md', 'squads/sw/agents/chief.md'],
    stalenessThresholdDays: 7,
  }

  it('includes bundle hash in BUILDPACT WEB BUNDLE section', () => {
    const parts: BundlePart[] = [
      { header: 'BUILDPACT WEB BUNDLE', content: 'Platform: claude.ai\nGenerated: 2026-01-01T00:00:00.000Z' },
    ]
    const result = assembleBundle(parts, metadata)
    expect(result).toContain('Bundle hash: abc123def456abcd')
  })

  it('includes source files in BUILDPACT WEB BUNDLE section', () => {
    const parts: BundlePart[] = [
      { header: 'BUILDPACT WEB BUNDLE', content: 'Platform: claude.ai' },
    ]
    const result = assembleBundle(parts, metadata)
    expect(result).toContain('Source files: constitution.md, squads/sw/agents/chief.md')
  })

  it('includes staleness threshold in BUILDPACT WEB BUNDLE section', () => {
    const parts: BundlePart[] = [
      { header: 'BUILDPACT WEB BUNDLE', content: 'Platform: claude.ai' },
    ]
    const result = assembleBundle(parts, metadata)
    expect(result).toContain('Staleness threshold: 7 days')
  })

  it('includes expires date (7 days after generatedAt) in BUILDPACT WEB BUNDLE section', () => {
    const parts: BundlePart[] = [
      { header: 'BUILDPACT WEB BUNDLE', content: 'Platform: claude.ai' },
    ]
    const result = assembleBundle(parts, metadata)
    // 2026-01-01 + 7 days = 2026-01-08
    expect(result).toContain('Expires: 2026-01-08T00:00:00.000Z')
  })

  it('does not inject metadata fields into non-BUILDPACT WEB BUNDLE parts', () => {
    const parts: BundlePart[] = [
      { header: 'BUILDPACT WEB BUNDLE', content: 'Platform: claude.ai' },
      { header: 'ACTIVATION INSTRUCTIONS', content: 'Instructions here' },
    ]
    const result = assembleBundle(parts, metadata)
    // Find position of ACTIVATION INSTRUCTIONS section
    const activationIdx = result.indexOf('=== ACTIVATION INSTRUCTIONS ===')
    // Bundle hash should not appear after ACTIVATION INSTRUCTIONS
    const hashAfterActivation = result.indexOf('Bundle hash:', activationIdx)
    expect(hashAfterActivation).toBe(-1)
  })

  it('works without metadata — backward compatible', () => {
    const parts: BundlePart[] = [
      { header: 'BUILDPACT WEB BUNDLE', content: 'Platform: claude.ai' },
    ]
    const result = assembleBundle(parts)
    expect(result).not.toContain('Bundle hash:')
    expect(result).toContain('Platform: claude.ai')
  })

  it('preserves original content and appends metadata fields', () => {
    const parts: BundlePart[] = [
      { header: 'BUILDPACT WEB BUNDLE', content: 'Platform: claude.ai\nGenerated: 2026-01-01T00:00:00.000Z' },
    ]
    const result = assembleBundle(parts, metadata)
    expect(result).toContain('Platform: claude.ai')
    expect(result).toContain('Generated: 2026-01-01T00:00:00.000Z')
    expect(result).toContain('Bundle hash: abc123def456abcd')
  })
})
