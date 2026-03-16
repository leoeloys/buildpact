import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SHARD_LINE_THRESHOLD,
  countLines,
  shouldShard,
  slugify,
  splitIntoSections,
  buildShardManifest,
  writeShards,
} from '../../../src/foundation/sharding.js'

// ---------------------------------------------------------------------------
// countLines
// ---------------------------------------------------------------------------

describe('countLines', () => {
  it('returns 1 for empty string', () => {
    expect(countLines('')).toBe(1)
  })

  it('returns 1 for single-line content (no newline)', () => {
    expect(countLines('hello')).toBe(1)
  })

  it('returns 2 for a single newline', () => {
    expect(countLines('\n')).toBe(2)
  })

  it('returns 2 for two words separated by newline', () => {
    expect(countLines('a\nb')).toBe(2)
  })

  it('returns 500 for 499 newlines', () => {
    expect(countLines('\n'.repeat(499))).toBe(500)
  })

  it('returns 501 for 500 newlines', () => {
    expect(countLines('\n'.repeat(500))).toBe(501)
  })
})

// ---------------------------------------------------------------------------
// shouldShard
// ---------------------------------------------------------------------------

describe('shouldShard', () => {
  it('returns false for a single line', () => {
    expect(shouldShard('hello')).toBe(false)
  })

  it('returns false for exactly 500 lines (499 newlines — does NOT exceed threshold)', () => {
    expect(shouldShard('\n'.repeat(499))).toBe(false)
  })

  it('returns true for 501 lines (500 newlines — strictly exceeds threshold)', () => {
    expect(shouldShard('\n'.repeat(500))).toBe(true)
  })

  it('threshold constant is 500', () => {
    expect(SHARD_LINE_THRESHOLD).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('lowercases text', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces non-alphanumeric characters with hyphens', () => {
    expect(slugify('Epic 1: Setup')).toBe('epic-1-setup')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('Section 2 — Core')).toBe('section-2-core')
  })

  it('trims leading and trailing hyphens from result', () => {
    // '  Leading/Trailing  ' → lowercase → spaces+slash become hyphens → trim edges
    expect(slugify('  Leading/Trailing  ')).toBe('leading-trailing')
  })

  it('trims hyphens at start and end (e.g. special-char-only prefix)', () => {
    expect(slugify('---hello---')).toBe('hello')
  })

  it('handles already-clean input', () => {
    expect(slugify('my-section')).toBe('my-section')
  })

  it('returns "section" fallback for purely special-char input', () => {
    expect(slugify('---')).toBe('section')
  })

  it('handles numbers', () => {
    expect(slugify('Epic 12: AutoResearch')).toBe('epic-12-autoresearch')
  })
})

// ---------------------------------------------------------------------------
// splitIntoSections
// ---------------------------------------------------------------------------

describe('splitIntoSections', () => {
  it('returns a single section when no ## headings exist', () => {
    const content = '# Title\n\nSome intro content here.'
    const sections = splitIntoSections(content)
    expect(sections).toHaveLength(1)
    expect(sections[0]!.content).toBe(content)
  })

  it('uses # title as section title when no ## headings', () => {
    const content = '# My Document\n\nContent.'
    const sections = splitIntoSections(content)
    expect(sections[0]!.title).toBe('My Document')
  })

  it('falls back to "section-1" title when no headings at all', () => {
    const content = 'Just plain content without any headings.'
    const sections = splitIntoSections(content)
    expect(sections[0]!.title).toBe('section-1')
  })

  it('returns correct count for 3 ## headings', () => {
    const content = [
      '# Preamble\n',
      '## Section One\nContent 1.',
      '## Section Two\nContent 2.',
      '## Section Three\nContent 3.',
    ].join('\n')
    const sections = splitIntoSections(content)
    expect(sections).toHaveLength(3)
  })

  it('each section content starts with ## heading line', () => {
    const content = '## Alpha\nContent A.\n## Beta\nContent B.'
    const sections = splitIntoSections(content)
    expect(sections[0]!.content).toMatch(/^## Alpha/)
    expect(sections[1]!.content).toMatch(/^## Beta/)
  })

  it('title does NOT include ## prefix', () => {
    const content = '## My Section\nContent.'
    const sections = splitIntoSections(content)
    expect(sections[0]!.title).toBe('My Section')
    expect(sections[0]!.title).not.toContain('##')
  })

  it('slug is URL-safe', () => {
    const content = '## Epic 1: Foundation & Setup\nContent.'
    const sections = splitIntoSections(content)
    expect(sections[0]!.slug).toMatch(/^[a-z0-9-]+$/)
  })
})

// ---------------------------------------------------------------------------
// buildShardManifest
// ---------------------------------------------------------------------------

describe('buildShardManifest', () => {
  const multiSectionContent = [
    '# Epics Document',
    '',
    'Some intro text.',
    '',
    '## Epic 1: Foundation',
    '',
    'Foundation content here.',
    '',
    '## Epic 2: Governance',
    '',
    'Governance content here.',
  ].join('\n')

  it('sets baseName correctly', () => {
    const manifest = buildShardManifest(multiSectionContent, 'epics')
    expect(manifest.baseName).toBe('epics')
  })

  it('preamble contains content before first ## heading', () => {
    const manifest = buildShardManifest(multiSectionContent, 'epics')
    expect(manifest.preamble).toContain('# Epics Document')
    expect(manifest.preamble).toContain('Some intro text.')
    expect(manifest.preamble).not.toContain('## Epic 1')
  })

  it('sections array has correct length', () => {
    const manifest = buildShardManifest(multiSectionContent, 'epics')
    expect(manifest.sections).toHaveLength(2)
  })

  it('indexContent contains each section title', () => {
    const manifest = buildShardManifest(multiSectionContent, 'epics')
    expect(manifest.indexContent).toContain('Epic 1: Foundation')
    expect(manifest.indexContent).toContain('Epic 2: Governance')
  })

  it('indexContent links follow format ./{baseName}/{slug}.md', () => {
    const manifest = buildShardManifest(multiSectionContent, 'epics')
    expect(manifest.indexContent).toContain('./epics/')
    expect(manifest.indexContent).toMatch(/\(\.\/epics\/[a-z0-9-]+\.md\)/)
  })

  it('indexContent contains FR-304 sharding notice', () => {
    const manifest = buildShardManifest(multiSectionContent, 'epics')
    expect(manifest.indexContent).toContain('FR-304')
  })

  it('indexContent uses document # title as header', () => {
    const manifest = buildShardManifest(multiSectionContent, 'epics')
    expect(manifest.indexContent).toMatch(/^# Epics Document/m)
  })

  it('falls back to baseName as index title when no # heading in preamble', () => {
    const content = '## Section One\nContent.'
    const manifest = buildShardManifest(content, 'my-doc')
    expect(manifest.indexContent).toMatch(/^# my-doc/m)
  })
})

// ---------------------------------------------------------------------------
// writeShards (I/O)
// ---------------------------------------------------------------------------

describe('writeShards', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-shard-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  const makeManifest = () =>
    buildShardManifest(
      [
        '# Test Document',
        '',
        'Intro.',
        '',
        '## Section Alpha',
        '',
        'Alpha content.',
        '',
        '## Section Beta',
        '',
        'Beta content.',
      ].join('\n'),
      'test-doc',
    )

  it('writes index.md to outputDir', async () => {
    const manifest = makeManifest()
    const result = await writeShards(manifest, tmpDir)
    expect(result.ok).toBe(true)
    const indexContent = await readFile(join(tmpDir, 'index.md'), 'utf-8')
    expect(indexContent).toContain('FR-304')
  })

  it('writes each shard file to outputDir/{baseName}/{slug}.md', async () => {
    const manifest = makeManifest()
    const result = await writeShards(manifest, tmpDir)
    expect(result.ok).toBe(true)

    for (const section of manifest.sections) {
      const shardPath = join(tmpDir, manifest.baseName, `${section.slug}.md`)
      const content = await readFile(shardPath, 'utf-8')
      expect(content).toContain(section.title)
    }
  })

  it('returns array of written file paths', async () => {
    const manifest = makeManifest()
    const result = await writeShards(manifest, tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      // index.md + 2 shards = 3 files
      expect(result.value).toHaveLength(3)
      expect(result.value.every(p => p.endsWith('.md'))).toBe(true)
    }
  })

  it('deduplicates shard filenames when sections produce identical slugs', async () => {
    const manifest = buildShardManifest(
      ['## Alpha', 'Content A.', '## Alpha', 'Content B.'].join('\n'),
      'dup-test',
    )
    const result = await writeShards(manifest, tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const names = result.value.map(p => p.split('/').at(-1))
      // Should have alpha.md and alpha-2.md, not two alpha.md
      expect(names).toContain('alpha.md')
      expect(names).toContain('alpha-2.md')
    }
  })

  it('returns FILE_WRITE_FAILED when outputDir cannot be created', async () => {
    // Create a file where writeShards will try to create a directory
    const blockerFile = join(tmpDir, 'blocker')
    await writeFile(blockerFile, 'i am a file, not a directory')

    const manifest = makeManifest()
    const result = await writeShards(manifest, join(blockerFile, 'subdir'))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_WRITE_FAILED')
    }
  })
})

// ---------------------------------------------------------------------------
// AC-2: Token savings — each shard ≥ 70% smaller than original
// ---------------------------------------------------------------------------

describe('AC-2: token savings per shard', () => {
  it('each shard has at least 70% fewer lines than the original document', () => {
    // Build a 600-line document: 6 sections of 100 lines each
    const sections = Array.from({ length: 6 }, (_, i) => {
      const lines = [`## Section ${i + 1}`]
      for (let j = 0; j < 99; j++) {
        lines.push(`Line ${j} of section ${i + 1} — content here.`)
      }
      return lines.join('\n')
    })
    const content = sections.join('\n')

    const manifest = buildShardManifest(content, 'test-doc')
    const originalLineCount = countLines(content)

    expect(originalLineCount).toBeGreaterThan(500)
    expect(manifest.sections).toHaveLength(6)

    for (const section of manifest.sections) {
      const shardLineCount = countLines(section.content)
      const savings = 1 - shardLineCount / originalLineCount
      expect(savings).toBeGreaterThanOrEqual(0.70)
    }
  })
})
