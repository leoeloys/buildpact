import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateFingerprint,
  computeSimilarity,
  suggestPatterns,
  applyDifferentialPrivacy,
  isLearningEnabled,
} from '../../../src/engine/cross-project.js'
import type { ProjectFingerprint } from '../../../src/engine/cross-project.js'

// ---------------------------------------------------------------------------
// generateFingerprint
// ---------------------------------------------------------------------------

describe('generateFingerprint', () => {
  it('creates a fingerprint with hashed id', () => {
    const fp = generateFingerprint('/tmp/project', 'web', ['typescript', 'react'])
    expect(fp.id).toMatch(/^[a-f0-9]{16}$/)
    expect(fp.domain).toBe('web')
    expect(fp.techStack).toEqual(expect.arrayContaining(['typescript', 'react']))
    expect(fp.timestamp).toBeTruthy()
  })

  it('assigns complexity based on tech stack size', () => {
    const low = generateFingerprint('/a', 'web', ['ts'])
    const med = generateFingerprint('/b', 'web', ['ts', 'react', 'node'])
    const high = generateFingerprint('/c', 'web', ['ts', 'react', 'node', 'pg', 'redis', 'docker'])

    expect(low.complexity).toBe('low')
    expect(med.complexity).toBe('medium')
    expect(high.complexity).toBe('high')
  })

  it('produces deterministic ids for same inputs', () => {
    const a = generateFingerprint('/p', 'backend', ['go', 'postgres'])
    const b = generateFingerprint('/p', 'backend', ['postgres', 'go'])
    expect(a.id).toBe(b.id)
  })
})

// ---------------------------------------------------------------------------
// computeSimilarity
// ---------------------------------------------------------------------------

describe('computeSimilarity', () => {
  const base: ProjectFingerprint = {
    id: 'a',
    domain: 'web',
    techStack: ['typescript', 'react', 'node'],
    complexity: 'medium',
    scale: 10000,
    successfulPatterns: [],
    timestamp: '',
  }

  it('returns 1 for identical fingerprints (same domain + stack)', () => {
    const sim = computeSimilarity(base, { ...base, id: 'b' })
    expect(sim).toBe(1) // 1.0 jaccard + 0.15 domain bonus = 1.15 → clamped to 1
  })

  it('returns domain bonus for same domain with different stacks', () => {
    const other: ProjectFingerprint = {
      ...base,
      id: 'c',
      techStack: ['python', 'django'],
    }
    const sim = computeSimilarity(base, other)
    // Jaccard = 0/5 = 0, domain bonus = 0.15
    expect(sim).toBeCloseTo(0.15, 2)
  })

  it('returns 0 for completely different fingerprints', () => {
    const other: ProjectFingerprint = {
      ...base,
      id: 'd',
      domain: 'mobile',
      techStack: ['swift', 'uikit'],
    }
    const sim = computeSimilarity(base, other)
    expect(sim).toBe(0)
  })

  it('handles empty tech stacks', () => {
    const empty: ProjectFingerprint = { ...base, techStack: [] }
    const sim = computeSimilarity(empty, { ...empty, id: 'e' })
    // Jaccard = 0/0 = 0, domain bonus = 0.15
    expect(sim).toBeCloseTo(0.15, 2)
  })
})

// ---------------------------------------------------------------------------
// suggestPatterns
// ---------------------------------------------------------------------------

describe('suggestPatterns', () => {
  const current: ProjectFingerprint = {
    id: 'cur',
    domain: 'web',
    techStack: ['typescript', 'react', 'node'],
    complexity: 'medium',
    scale: 5000,
    successfulPatterns: [],
    timestamp: '',
  }

  const similar: ProjectFingerprint = {
    id: 'sim',
    domain: 'web',
    techStack: ['typescript', 'react', 'express'],
    complexity: 'medium',
    scale: 8000,
    successfulPatterns: ['pattern-a', 'pattern-b'],
    timestamp: '',
  }

  const dissimilar: ProjectFingerprint = {
    id: 'dis',
    domain: 'mobile',
    techStack: ['kotlin', 'android'],
    complexity: 'low',
    scale: 2000,
    successfulPatterns: ['pattern-c'],
    timestamp: '',
  }

  it('returns patterns from similar projects above threshold', () => {
    const suggestions = suggestPatterns(current, [similar, dissimilar], 0.5)
    expect(suggestions.length).toBe(2)
    expect(suggestions[0]!.patternId).toBe('pattern-a')
  })

  it('excludes dissimilar projects below threshold', () => {
    const suggestions = suggestPatterns(current, [dissimilar], 0.5)
    expect(suggestions).toHaveLength(0)
  })

  it('does not suggest from self', () => {
    const self = { ...current, successfulPatterns: ['self-pattern'] }
    const suggestions = suggestPatterns(current, [self], 0)
    expect(suggestions).toHaveLength(0)
  })

  it('sorts by similarity descending', () => {
    const medium: ProjectFingerprint = {
      id: 'med',
      domain: 'web',
      techStack: ['typescript'],
      complexity: 'low',
      scale: 1000,
      successfulPatterns: ['pattern-d'],
      timestamp: '',
    }
    const suggestions = suggestPatterns(current, [similar, medium], 0.1)
    expect(suggestions[0]!.similarity).toBeGreaterThanOrEqual(
      suggestions[suggestions.length - 1]!.similarity,
    )
  })
})

// ---------------------------------------------------------------------------
// applyDifferentialPrivacy
// ---------------------------------------------------------------------------

describe('applyDifferentialPrivacy', () => {
  it('hashes the id so it differs from the original', () => {
    const fp = generateFingerprint('/proj', 'web', ['ts'])
    const privateFp = applyDifferentialPrivacy(fp)
    expect(privateFp.id).not.toBe(fp.id)
  })

  it('hashes tech stack entries', () => {
    const fp = generateFingerprint('/proj', 'web', ['typescript'])
    const privateFp = applyDifferentialPrivacy(fp)
    expect(privateFp.techStack[0]).not.toBe('typescript')
    expect(privateFp.techStack[0]).toMatch(/^[a-f0-9]+$/)
  })

  it('preserves domain and complexity', () => {
    const fp = generateFingerprint('/proj', 'web', ['ts'])
    const privateFp = applyDifferentialPrivacy(fp)
    expect(privateFp.domain).toBe('web')
    expect(privateFp.complexity).toBe(fp.complexity)
  })

  it('ensures scale is non-negative', () => {
    const fp = generateFingerprint('/proj', 'web', ['ts'])
    fp.scale = 0
    const privateFp = applyDifferentialPrivacy(fp, 0.1)
    expect(privateFp.scale).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// isLearningEnabled
// ---------------------------------------------------------------------------

describe('isLearningEnabled', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-cross-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  it('returns true when no config exists', async () => {
    expect(await isLearningEnabled(tmpDir)).toBe(true)
  })

  it('returns false when config disables cross-project learning', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'crossProject:\n  enabled: false\n',
    )
    expect(await isLearningEnabled(tmpDir)).toBe(false)
  })

  it('returns true when config enables cross-project learning', async () => {
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(
      join(tmpDir, '.buildpact', 'config.yaml'),
      'crossProject:\n  enabled: true\n',
    )
    expect(await isLearningEnabled(tmpDir)).toBe(true)
  })
})
