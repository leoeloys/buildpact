import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  estimateTokens,
  extractHeadings,
  extractNamedEntities,
  applyRule,
  applyCompressionRules,
  validateRoundTrip,
  distill,
} from '../../../src/engine/distillator.js'
import { STRIP_RULES, TRANSFORM_RULES, DEFAULT_RULES } from '../../../src/data/compression-rules.js'
import type { CompressionRule } from '../../../src/contracts/task.js'

describe('estimateTokens', () => {
  it('estimates roughly 1 token per 4 chars', () => {
    expect(estimateTokens('hello world!')).toBe(3) // 12 chars / 4
  })

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
})

describe('extractHeadings', () => {
  it('extracts ## and ### headings', () => {
    const content = '# Title\n## Section A\nsome text\n### Subsection B\nmore text\n## Section C'
    const headings = extractHeadings(content)
    expect(headings).toEqual(['Section A', 'Subsection B', 'Section C'])
  })

  it('returns empty for no headings', () => {
    expect(extractHeadings('just plain text')).toEqual([])
  })
})

describe('extractNamedEntities', () => {
  it('extracts PascalCase terms', () => {
    const entities = extractNamedEntities('Use TypeScript with BuildPact')
    expect(entities).toContain('TypeScript')
    expect(entities).toContain('BuildPact')
  })

  it('extracts version numbers', () => {
    const entities = extractNamedEntities('Version v2.3.1 and 1.0.0-alpha')
    expect(entities.some(e => e.includes('2.3.1'))).toBe(true)
    expect(entities.some(e => e.includes('1.0.0'))).toBe(true)
  })

  it('extracts identifiers like FR-201', () => {
    const entities = extractNamedEntities('See FR-201 and US-056 for details')
    expect(entities).toContain('FR-201')
    expect(entities).toContain('US-056')
  })
})

describe('applyRule', () => {
  it('strips matching content', () => {
    const rule: CompressionRule = { id: 'test', action: 'strip', pattern: 'filler', description: 'test' }
    expect(applyRule('some filler text', rule)).toBe('some  text')
  })

  it('transforms matching content', () => {
    const rule: CompressionRule = { id: 'test', action: 'transform', pattern: 'old', description: 'test', replacement: 'new' }
    expect(applyRule('this is old', rule)).toBe('this is new')
  })

  it('preserve is a no-op', () => {
    const rule: CompressionRule = { id: 'test', action: 'preserve', pattern: 'keep', description: 'test' }
    expect(applyRule('keep this', rule)).toBe('keep this')
  })

  it('handles invalid regex gracefully', () => {
    const rule: CompressionRule = { id: 'test', action: 'strip', pattern: '[[bad', description: 'test' }
    expect(applyRule('some text', rule)).toBe('some text')
  })
})

describe('applyCompressionRules', () => {
  it('strips filler and collapses blank lines', () => {
    const content = 'As mentioned earlier, this is important.\n\n\n\nThe next point.'
    const result = applyCompressionRules(content, STRIP_RULES)
    expect(result).not.toContain('As mentioned earlier,')
    expect(result).not.toContain('\n\n\n')
  })

  it('applies transform rules', () => {
    const content = 'It is critical to fix this bug'
    const result = applyCompressionRules(content, TRANSFORM_RULES)
    expect(result).toContain('MUST')
  })
})

describe('validateRoundTrip', () => {
  it('passes when all headings and entities survive', () => {
    const result = validateRoundTrip(
      ['Section A', 'Section B'],
      ['TypeScript', 'FR-201'],
      '## Section A\nUse TypeScript\n## Section B\nSee FR-201',
    )
    expect(result.ok).toBe(true)
  })

  it('fails when heading is missing', () => {
    const result = validateRoundTrip(
      ['Section A', 'Section B'],
      [],
      '## Section A\nSome content',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DISTILLATE_ROUND_TRIP_FAILED')
  })

  it('fails when entity is missing', () => {
    const result = validateRoundTrip(
      [],
      ['TypeScript', 'FR-201'],
      'Use JavaScript and see FR-201',
    )
    expect(result.ok).toBe(false)
  })
})

describe('distill', () => {
  let tempDir: string
  afterEach(async () => { if (tempDir) await rm(tempDir, { recursive: true }) })

  it('compresses source documents', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-distill-'))
    const source = join(tempDir, 'spec.md')
    await writeFile(source, [
      '## Requirements',
      '',
      'As mentioned earlier, the system must handle user auth.',
      'It is critical to support OAuth2.',
      'We believe this is the right approach.',
      '',
      '## Architecture',
      '',
      'Use TypeScript with BuildPact v2.0.',
      'See FR-201 for details.',
    ].join('\n'))

    const result = await distill({ sourcePaths: [source] }, DEFAULT_RULES)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.compressionRatio).toBeLessThan(1)
      expect(result.value.sourceHeadings).toContain('Requirements')
      expect(result.value.sourceHeadings).toContain('Architecture')
      expect(result.value.content).toContain('TypeScript')
    }
  })

  it('returns error for empty sources', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-distill-'))
    const result = await distill({ sourcePaths: [join(tempDir, 'nonexistent.md')] }, [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DISTILLATE_ZERO_CONTENT')
  })

  it('adds downstream consumer header when specified', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bp-distill-'))
    const source = join(tempDir, 'doc.md')
    await writeFile(source, '## Content\nSome text here.')

    const result = await distill({ sourcePaths: [source], downstreamConsumer: 'plan creation' }, [])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.content).toContain('Distilled for: plan creation')
    }
  })
})
