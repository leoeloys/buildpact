/**
 * Compression Rules — reusable Strip/Preserve/Transform patterns.
 * Extracted from the distillator so they can be applied anywhere
 * context window is tight.
 *
 * @module data/compression-rules
 * @see Concept 10.6 (BMAD compression rules)
 */

import type { CompressionRule } from '../contracts/task.js'

// ---------------------------------------------------------------------------
// STRIP rules — remove filler, hedging, transitions, self-reference
// ---------------------------------------------------------------------------

export const STRIP_RULES: CompressionRule[] = [
  {
    id: 'S01',
    action: 'strip',
    pattern: '\\b(As mentioned (earlier|above|previously|before)),?\\s*',
    description: 'Remove backward references',
  },
  {
    id: 'S02',
    action: 'strip',
    pattern: "\\b(It'?s worth noting that|It should be noted that|Note that)\\s*",
    description: 'Remove noting phrases',
  },
  {
    id: 'S03',
    action: 'strip',
    pattern: '\\b(We believe|We think|We feel|In our opinion),?\\s*',
    description: 'Remove hedging attributions',
  },
  {
    id: 'S04',
    action: 'strip',
    pattern: '\\b(In order to)\\b',
    description: 'Remove verbose "in order to" → implicit "to"',
    replacement: 'To',
  },
  {
    id: 'S05',
    action: 'strip',
    pattern: '\\b(The fact that)\\s*',
    description: 'Remove "the fact that" filler',
  },
  {
    id: 'S06',
    action: 'strip',
    pattern: '\\b(This (document|section|spec|plan) (describes|outlines|details|covers|provides))\\s*',
    description: 'Remove self-referential preamble',
  },
  {
    id: 'S07',
    action: 'strip',
    pattern: '\\b(Basically|Essentially|Fundamentally|Obviously|Clearly),?\\s*',
    description: 'Remove filler adverbs',
  },
  {
    id: 'S08',
    action: 'strip',
    pattern: '\\b(In this (section|document|chapter)),?\\s*',
    description: 'Remove in-this-section phrases',
  },
  {
    id: 'S09',
    action: 'strip',
    pattern: '\\b(For the purposes of this (document|spec|plan)),?\\s*',
    description: 'Remove scope-of-document phrases',
  },
  {
    id: 'S10',
    action: 'strip',
    pattern: '\\b(At the end of the day|When all is said and done|All things considered),?\\s*',
    description: 'Remove cliché transitions',
  },
  {
    id: 'S11',
    action: 'strip',
    pattern: '\\b(Perhaps|Maybe|Possibly|Presumably),?\\s*',
    description: 'Remove uncertainty hedges',
  },
]

// ---------------------------------------------------------------------------
// PRESERVE rules — markers for content that must never be stripped
// ---------------------------------------------------------------------------

export const PRESERVE_RULES: CompressionRule[] = [
  {
    id: 'P01',
    action: 'preserve',
    pattern: '\\bv?\\d+\\.\\d+(\\.\\d+)?\\b',
    description: 'Preserve version numbers (v2.3.1, 1.0.0)',
  },
  {
    id: 'P02',
    action: 'preserve',
    pattern: '\\$\\d+[.,]?\\d*|\\d+%|\\d+ (USD|EUR|GBP)',
    description: 'Preserve monetary values and percentages',
  },
  {
    id: 'P03',
    action: 'preserve',
    pattern: '\\d{4}-\\d{2}-\\d{2}',
    description: 'Preserve ISO dates',
  },
  {
    id: 'P04',
    action: 'preserve',
    pattern: '\\b[A-Z]{2,}-\\d+\\b',
    description: 'Preserve identifiers (FR-201, CLR-001, US-056)',
  },
  {
    id: 'P05',
    action: 'preserve',
    pattern: '\\b(MUST|MUST NOT|SHALL|SHALL NOT|REQUIRED|SHOULD NOT)\\b',
    description: 'Preserve RFC 2119 keywords',
  },
  {
    id: 'P06',
    action: 'preserve',
    pattern: '\\b(Decision|Rationale|Constraint|Non-negotiable|Blocker|Risk):\\s',
    description: 'Preserve decision/constraint markers',
  },
  {
    id: 'P07',
    action: 'preserve',
    pattern: '\\b(In scope|Out of scope|Deferred|Blocked by)\\b',
    description: 'Preserve scope boundaries',
  },
  {
    id: 'P08',
    action: 'preserve',
    pattern: '\\?\\s*$',
    description: 'Preserve open questions (lines ending with ?)',
  },
]

// ---------------------------------------------------------------------------
// TRANSFORM rules — change verbose form to compressed form
// ---------------------------------------------------------------------------

export const TRANSFORM_RULES: CompressionRule[] = [
  {
    id: 'T01',
    action: 'transform',
    pattern: '\\bWe decided to use (\\w+) because (.+?)\\.',
    description: 'Compress decision statements',
    replacement: '$1 (rationale: $2)',
  },
  {
    id: 'T02',
    action: 'transform',
    pattern: '\\bRisk: (.+?)\\. Severity: (high|medium|low)',
    description: 'Compress risk statements',
    replacement: '$2 RISK: $1',
  },
  {
    id: 'T03',
    action: 'transform',
    pattern: '\\bThe following (items|requirements|features|tasks) are (required|needed|necessary):',
    description: 'Compress list introductions',
    replacement: 'Required:',
  },
  {
    id: 'T04',
    action: 'transform',
    pattern: '\\bIn addition to the above,?\\s*',
    description: 'Remove additive transitions',
    replacement: '',
  },
  {
    id: 'T05',
    action: 'transform',
    pattern: '\\bIt is (important|critical|essential|necessary) (to|that)\\s*',
    description: 'Compress importance declarations',
    replacement: 'MUST ',
  },
]

// ---------------------------------------------------------------------------
// Combined rules in evaluation order
// ---------------------------------------------------------------------------

/** All compression rules in recommended evaluation order: strip → transform (preserve is passive) */
export const DEFAULT_RULES: CompressionRule[] = [
  ...STRIP_RULES,
  ...TRANSFORM_RULES,
  ...PRESERVE_RULES,
]

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Check if a rule's pattern matches the content.
 */
export function matchRule(content: string, rule: CompressionRule): boolean {
  try {
    return new RegExp(rule.pattern, 'gi').test(content)
  } catch {
    return false
  }
}
