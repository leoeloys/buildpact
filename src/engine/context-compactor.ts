/**
 * Context Compactor — protect head/tail, compress middle.
 * Preserves system prompt and recent messages while shrinking the middle
 * to fit within token budgets.
 * @module engine/context-compactor
 * @see BuildPact concept 18.1
 */

import type { CompactionConfig, CompactionResult } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Estimate token count from content length (~4 chars per token).
 */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4)
}

// ---------------------------------------------------------------------------
// Head/tail protection
// ---------------------------------------------------------------------------

/**
 * Split content into protected head, compressible middle, and protected tail.
 * Head and tail are preserved verbatim; middle is subject to compression.
 */
export function protectHeadTail(
  content: string,
  headTokens: number,
  tailTokens: number,
): { head: string; middle: string; tail: string } {
  const headChars = headTokens * 4
  const tailChars = tailTokens * 4

  if (content.length <= headChars + tailChars) {
    return { head: content, middle: '', tail: '' }
  }

  const head = content.slice(0, headChars)
  const tail = content.slice(content.length - tailChars)
  const middle = content.slice(headChars, content.length - tailChars)

  return { head, middle, tail }
}

// ---------------------------------------------------------------------------
// Middle compression
// ---------------------------------------------------------------------------

/**
 * Compress the middle section using the specified strategy.
 * - 'truncate': hard-cut to target token count
 * - 'sample': keep every Nth paragraph to fit budget
 * - 'summarize': placeholder — returns truncated with marker
 */
export function compressMiddle(
  middle: string,
  strategy: CompactionConfig['compressionStrategy'],
  targetTokens: number,
): string {
  const targetChars = targetTokens * 4

  if (middle.length <= targetChars) return middle

  switch (strategy) {
    case 'truncate':
      return middle.slice(0, targetChars) + '\n[...truncated...]'

    case 'sample': {
      const paragraphs = middle.split('\n\n').filter(p => p.trim().length > 0)
      if (paragraphs.length === 0) return ''

      const selected: string[] = []
      let charCount = 0
      // Sample evenly across paragraphs
      const step = Math.max(1, Math.floor(paragraphs.length / Math.ceil(targetChars / 200)))

      for (let i = 0; i < paragraphs.length && charCount < targetChars; i += step) {
        const p = paragraphs[i]
        if (p !== undefined) {
          selected.push(p)
          charCount += p.length
        }
      }

      return selected.join('\n\n') + '\n[...sampled...]'
    }

    case 'summarize':
      // Summarization requires LLM — return truncated with marker
      return middle.slice(0, targetChars) + '\n[...summarization pending...]'
  }
}

// ---------------------------------------------------------------------------
// Main compaction
// ---------------------------------------------------------------------------

/**
 * Compact context content to fit within token budget.
 * Protects head and tail, compresses the middle.
 */
export function compactContext(
  content: string,
  config: CompactionConfig,
): CompactionResult {
  const originalTokens = estimateTokens(content)

  if (originalTokens <= config.maxTokens) {
    return {
      content,
      originalTokens,
      compactedTokens: originalTokens,
      sectionsRemoved: 0,
    }
  }

  const { head, middle, tail } = protectHeadTail(
    content,
    config.protectHeadTokens,
    config.protectTailTokens,
  )

  const middleBudget = config.maxTokens - config.protectHeadTokens - config.protectTailTokens
  const compressedMiddle = compressMiddle(middle, config.compressionStrategy, Math.max(0, middleBudget))

  const originalMiddleParagraphs = middle.split('\n\n').filter(p => p.trim().length > 0).length
  const compressedMiddleParagraphs = compressedMiddle.split('\n\n').filter(p => p.trim().length > 0).length
  const sectionsRemoved = Math.max(0, originalMiddleParagraphs - compressedMiddleParagraphs)

  const compacted = head + compressedMiddle + tail
  const compactedTokens = estimateTokens(compacted)

  return {
    content: compacted,
    originalTokens,
    compactedTokens,
    sectionsRemoved,
  }
}
