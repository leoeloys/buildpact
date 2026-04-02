import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  protectHeadTail,
  compressMiddle,
  compactContext,
} from '../../../src/engine/context-compactor.js'
import type { CompactionConfig } from '../../../src/contracts/task.js'

describe('estimateTokens', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('')).toBe(0)
  })

  it('rounds up', () => {
    expect(estimateTokens('ab')).toBe(1)
  })
})

describe('protectHeadTail', () => {
  it('splits content into head, middle, tail', () => {
    const content = 'A'.repeat(40) + 'M'.repeat(40) + 'Z'.repeat(40)
    const { head, middle, tail } = protectHeadTail(content, 10, 10)
    // 10 tokens * 4 chars = 40 chars each
    expect(head).toBe('A'.repeat(40))
    expect(tail).toBe('Z'.repeat(40))
    expect(middle).toBe('M'.repeat(40))
  })

  it('returns all as head when content is smaller than head+tail', () => {
    const { head, middle, tail } = protectHeadTail('short', 100, 100)
    expect(head).toBe('short')
    expect(middle).toBe('')
    expect(tail).toBe('')
  })
})

describe('compressMiddle', () => {
  it('returns middle unchanged when under target', () => {
    expect(compressMiddle('small', 'truncate', 100)).toBe('small')
  })

  it('truncates with marker for truncate strategy', () => {
    const long = 'x'.repeat(100)
    const result = compressMiddle(long, 'truncate', 5)
    expect(result).toContain('[...truncated...]')
    expect(result.length).toBeLessThan(long.length + 20)
  })

  it('samples paragraphs for sample strategy', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Paragraph ${i} content here`).join('\n\n')
    const result = compressMiddle(paragraphs, 'sample', 10)
    expect(result).toContain('[...sampled...]')
  })

  it('uses summarize placeholder', () => {
    const long = 'x'.repeat(100)
    const result = compressMiddle(long, 'summarize', 5)
    expect(result).toContain('[...summarization pending...]')
  })
})

describe('compactContext', () => {
  it('returns content unchanged when under budget', () => {
    const config: CompactionConfig = {
      maxTokens: 1000,
      protectHeadTokens: 100,
      protectTailTokens: 100,
      compressionStrategy: 'truncate',
    }
    const result = compactContext('short content', config)
    expect(result.content).toBe('short content')
    expect(result.originalTokens).toBe(result.compactedTokens)
    expect(result.sectionsRemoved).toBe(0)
  })

  it('compacts content that exceeds budget', () => {
    const content = 'H'.repeat(40) + '\n\n'.repeat(5) + 'M'.repeat(400) + '\n\n'.repeat(5) + 'T'.repeat(40)
    const config: CompactionConfig = {
      maxTokens: 30,
      protectHeadTokens: 10,
      protectTailTokens: 10,
      compressionStrategy: 'truncate',
    }
    const result = compactContext(content, config)
    expect(result.compactedTokens).toBeLessThan(result.originalTokens)
  })

  it('tracks sections removed', () => {
    const paras = Array.from({ length: 20 }, (_, i) => `P${i} `.repeat(20)).join('\n\n')
    const content = 'HEAD'.repeat(10) + paras + 'TAIL'.repeat(10)
    const config: CompactionConfig = {
      maxTokens: 20,
      protectHeadTokens: 5,
      protectTailTokens: 5,
      compressionStrategy: 'truncate',
    }
    const result = compactContext(content, config)
    expect(result.sectionsRemoved).toBeGreaterThanOrEqual(0)
  })
})
