import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifyFile,
  detectTags,
  scanProjectTree,
  detectMisplacements,
  checkStaleness,
  detectOrphans,
  detectBrownfield,
  generateProjectIndex,
  type FileEntry,
} from '../../../src/commands/docs/scanner.js'

// ---------------------------------------------------------------------------
// classifyFile
// ---------------------------------------------------------------------------

describe('classifyFile', () => {
  it('classifies spec files', () => {
    expect(classifyFile('/proj/.buildpact/specs/my-feature/spec.md', '/proj')).toBe('spec')
  })

  it('classifies plan files', () => {
    expect(classifyFile('/proj/.buildpact/plans/my-feature/plan.md', '/proj')).toBe('plan')
  })

  it('classifies test files', () => {
    expect(classifyFile('/proj/test/unit/my.test.ts', '/proj')).toBe('test')
  })

  it('classifies TypeScript code', () => {
    expect(classifyFile('/proj/src/engine/module.ts', '/proj')).toBe('code')
  })

  it('classifies config files', () => {
    expect(classifyFile('/proj/package.json', '/proj')).toBe('config')
    expect(classifyFile('/proj/tsconfig.json', '/proj')).toBe('config')
    expect(classifyFile('/proj/.buildpact/config.yaml', '/proj')).toBe('config')
  })

  it('classifies doc files', () => {
    expect(classifyFile('/proj/README.md', '/proj')).toBe('doc')
    expect(classifyFile('/proj/docs/guide.md', '/proj')).toBe('doc')
  })

  it('classifies template files', () => {
    expect(classifyFile('/proj/templates/commands/quality.md', '/proj')).toBe('template')
  })

  it('classifies asset files', () => {
    expect(classifyFile('/proj/logo.png', '/proj')).toBe('asset')
    expect(classifyFile('/proj/font.woff2', '/proj')).toBe('asset')
  })

  it('classifies unknown files', () => {
    expect(classifyFile('/proj/data.bin', '/proj')).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// detectTags
// ---------------------------------------------------------------------------

describe('detectTags', () => {
  it('detects tags from path', () => {
    const tags = detectTags('src/foundation/constitution.ts')
    expect(tags).toContain('constitution')
  })

  it('returns empty array when no tags match', () => {
    const tags = detectTags('README.md')
    expect(tags).toEqual([])
  })

  it('detects multiple tags', () => {
    const tags = detectTags('.buildpact/specs/squad-config/spec.md')
    expect(tags).toContain('spec')
    expect(tags).toContain('squad')
    expect(tags).toContain('config')
  })
})

// ---------------------------------------------------------------------------
// scanProjectTree
// ---------------------------------------------------------------------------

describe('scanProjectTree', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-docs-scan-'))
    await mkdir(join(tmpDir, 'src'), { recursive: true })
    await mkdir(join(tmpDir, 'test'), { recursive: true })
    await writeFile(join(tmpDir, 'src', 'index.ts'), '// code', 'utf-8')
    await writeFile(join(tmpDir, 'test', 'test.test.ts'), '// test', 'utf-8')
    await writeFile(join(tmpDir, 'README.md'), '# Project', 'utf-8')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('scans files recursively', async () => {
    const files = await scanProjectTree(tmpDir)
    expect(files.length).toBeGreaterThanOrEqual(3)
  })

  it('excludes node_modules', async () => {
    await mkdir(join(tmpDir, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(join(tmpDir, 'node_modules', 'pkg', 'index.js'), '// lib', 'utf-8')
    const files = await scanProjectTree(tmpDir)
    const nmFiles = files.filter((f) => f.path.includes('node_modules'))
    expect(nmFiles).toHaveLength(0)
  })

  it('includes file type and tags', async () => {
    const files = await scanProjectTree(tmpDir)
    for (const f of files) {
      expect(f.type).toBeTruthy()
      expect(Array.isArray(f.tags)).toBe(true)
    }
  })

  it('extracts titles from markdown files', async () => {
    const files = await scanProjectTree(tmpDir)
    const readme = files.find((f) => f.path === 'README.md')
    expect(readme?.title).toBe('Project')
  })
})

// ---------------------------------------------------------------------------
// detectMisplacements
// ---------------------------------------------------------------------------

describe('detectMisplacements', () => {
  it('detects spec files outside .buildpact/specs/', () => {
    const files: FileEntry[] = [
      { path: 'docs/feature-spec.md', type: 'spec', title: 'Feature Spec', lastModified: new Date(), sizeLines: 10, tags: [] },
    ]
    const suggestions = detectMisplacements(files)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]!.reason).toContain('.buildpact/specs')
  })

  it('does not flag spec files inside .buildpact/specs/', () => {
    const files: FileEntry[] = [
      { path: '.buildpact/specs/my-feature/spec.md', type: 'spec', title: 'Spec', lastModified: new Date(), sizeLines: 10, tags: [] },
    ]
    const suggestions = detectMisplacements(files)
    expect(suggestions).toHaveLength(0)
  })

  it('detects temp files as deletion candidates', () => {
    const files: FileEntry[] = [
      { path: 'src/old.bak', type: 'unknown', title: 'old.bak', lastModified: new Date(), sizeLines: 5, tags: [] },
    ]
    const suggestions = detectMisplacements(files)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]!.destination).toBe('(delete)')
  })
})

// ---------------------------------------------------------------------------
// checkStaleness
// ---------------------------------------------------------------------------

describe('checkStaleness', () => {
  it('detects specs older than 30 days', () => {
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
    const files: FileEntry[] = [
      { path: '.buildpact/specs/old/spec.md', type: 'spec', title: 'Old Spec', lastModified: oldDate, sizeLines: 10, tags: [] },
    ]
    const stale = checkStaleness(files)
    expect(stale).toHaveLength(1)
    expect(stale[0]!.age).toBeGreaterThanOrEqual(45)
  })

  it('does not flag recent specs', () => {
    const files: FileEntry[] = [
      { path: '.buildpact/specs/new/spec.md', type: 'spec', title: 'New Spec', lastModified: new Date(), sizeLines: 10, tags: [] },
    ]
    const stale = checkStaleness(files)
    expect(stale).toHaveLength(0)
  })

  it('ignores non-spec/plan files', () => {
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
    const files: FileEntry[] = [
      { path: 'src/old-code.ts', type: 'code', title: 'Old Code', lastModified: oldDate, sizeLines: 100, tags: [] },
    ]
    const stale = checkStaleness(files)
    expect(stale).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// detectOrphans
// ---------------------------------------------------------------------------

describe('detectOrphans', () => {
  it('detects specs without plans', () => {
    const files: FileEntry[] = [
      { path: '.buildpact/specs/lonely/spec.md', type: 'spec', title: 'Lonely', lastModified: new Date(), sizeLines: 10, tags: [] },
    ]
    const orphans = detectOrphans(files)
    expect(orphans.length).toBeGreaterThan(0)
    expect(orphans[0]!.kind).toBe('Spec without plan')
  })

  it('does not flag specs with matching plans', () => {
    const files: FileEntry[] = [
      { path: '.buildpact/specs/feature/spec.md', type: 'spec', title: 'Spec', lastModified: new Date(), sizeLines: 10, tags: [] },
      { path: '.buildpact/plans/feature/plan.md', type: 'plan', title: 'Plan', lastModified: new Date(), sizeLines: 20, tags: [] },
    ]
    const orphans = detectOrphans(files)
    expect(orphans).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// detectBrownfield
// ---------------------------------------------------------------------------

describe('detectBrownfield', () => {
  it('detects brownfield when code is older than .buildpact', () => {
    const oldCode = new Date('2020-01-01')
    const newBP = new Date('2026-01-01')
    const files: FileEntry[] = [
      { path: 'src/index.ts', type: 'code', title: 'Index', lastModified: oldCode, sizeLines: 100, tags: [] },
      { path: '.buildpact/config.yaml', type: 'config', title: 'Config', lastModified: newBP, sizeLines: 10, tags: [] },
    ]
    expect(detectBrownfield(files)).toBe(true)
  })

  it('returns false for greenfield projects', () => {
    const now = new Date()
    const files: FileEntry[] = [
      { path: 'src/index.ts', type: 'code', title: 'Index', lastModified: now, sizeLines: 100, tags: [] },
      { path: '.buildpact/config.yaml', type: 'config', title: 'Config', lastModified: new Date(now.getTime() - 1000), sizeLines: 10, tags: [] },
    ]
    expect(detectBrownfield(files)).toBe(false)
  })

  it('returns false when no code files exist', () => {
    const files: FileEntry[] = [
      { path: '.buildpact/config.yaml', type: 'config', title: 'Config', lastModified: new Date(), sizeLines: 10, tags: [] },
    ]
    expect(detectBrownfield(files)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateProjectIndex
// ---------------------------------------------------------------------------

describe('generateProjectIndex', () => {
  it('generates valid markdown index', () => {
    const files: FileEntry[] = [
      { path: 'src/index.ts', type: 'code', title: 'Entry Point', lastModified: new Date(), sizeLines: 50, tags: [] },
      { path: 'README.md', type: 'doc', title: 'Project', lastModified: new Date(), sizeLines: 100, tags: [] },
    ]
    const index = generateProjectIndex(files)
    expect(index).toContain('# Project File Index')
    expect(index).toContain('Total files: 2')
    expect(index).toContain('### By Type')
    expect(index).toContain('### All Files (Searchable)')
  })

  it('includes all file entries in the table', () => {
    const files: FileEntry[] = [
      { path: 'a.ts', type: 'code', title: 'A', lastModified: new Date(), sizeLines: 10, tags: ['config'] },
      { path: 'b.ts', type: 'code', title: 'B', lastModified: new Date(), sizeLines: 20, tags: [] },
    ]
    const index = generateProjectIndex(files)
    expect(index).toContain('a.ts')
    expect(index).toContain('b.ts')
  })
})
