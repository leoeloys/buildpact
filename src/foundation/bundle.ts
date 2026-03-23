/**
 * Bundle — token budget, platform limits, and bundle assembly for web exports.
 * Foundation-layer module; no @clack/prompts imports allowed here.
 * @module foundation/bundle
 * @see FR-105a Token estimation
 * @see FR-105b Platform token limits
 * @see FR-105c Token budget check
 */

import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Estimate token count for a string.
 * Uses the 4-chars-per-token heuristic widely used for LLM estimates.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ---------------------------------------------------------------------------
// Platform limits
// ---------------------------------------------------------------------------

/**
 * Context window token limits per supported web platform.
 * Keys match the platform argument accepted by /bp:export-web.
 */
export const PLATFORM_LIMITS: Record<string, number> = {
  'claude.ai': 180_000,
  'chatgpt': 128_000,
  'gemini': 1_000_000,
}

// ---------------------------------------------------------------------------
// Token budget check
// ---------------------------------------------------------------------------

/** Result of a token budget check */
export interface TokenBudgetResult {
  withinLimit: boolean
  utilizationPct: number
  /** true when utilizationPct >= 0.80 */
  warning: boolean
}

/**
 * Check whether a token count fits within the platform's limit and whether
 * the 80% warning threshold has been reached.
 *
 * @param tokenCount  - estimated token count of the assembled bundle
 * @param platform    - one of the keys in PLATFORM_LIMITS (e.g. 'claude.ai')
 */
export function checkTokenBudget(tokenCount: number, platform: string): TokenBudgetResult {
  const limit = PLATFORM_LIMITS[platform] ?? 180_000
  const utilizationPct = tokenCount / limit
  return {
    withinLimit: tokenCount <= limit,
    utilizationPct,
    warning: utilizationPct >= 0.80,
  }
}

// ---------------------------------------------------------------------------
// Story 10.4: Bundle versioning metadata
// ---------------------------------------------------------------------------

/**
 * Metadata embedded in a web bundle for versioning and staleness detection.
 * @see AC-1 — Bundle includes generation timestamp and source file hash
 * @see AC-2 — Staleness warning when bundle is older than 7 days
 */
export interface BundleMetadata {
  /** ISO 8601 timestamp of when this bundle was generated */
  generatedAt: string
  /** Target platform key (e.g. 'claude.ai') */
  platform: string
  /** First 16 hex chars of SHA-256 hash over concatenated source file contents */
  bundleHash: string
  /** Relative paths (relative to .buildpact/) of source files included in hash */
  sourceFiles: string[]
  /** Days after generatedAt before the bundle is considered stale */
  stalenessThresholdDays: number
}

/**
 * Compute a SHA-256 hash over the contents of source files.
 * Concatenates all file contents (joined by newline) and returns the first
 * 16 hex chars of the SHA-256 digest. Same inputs always produce the same hash.
 *
 * @param sourceFiles - Array of file contents (not paths) to hash
 * @see AC-1 — Bundle includes SHA-256 hash of source files
 */
export function computeBundleHash(sourceFiles: string[]): string {
  const content = sourceFiles.join('\n')
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

// ---------------------------------------------------------------------------
// Bundle assembly
// ---------------------------------------------------------------------------

/** A single named section of a bundle */
export interface BundlePart {
  /** Section header text (shown as `=== HEADER ===`) */
  header: string
  /** Section body content */
  content: string
}

/**
 * Assemble bundle parts into a single string using `=== HEADER ===` delimiters.
 * Empty-content parts are omitted automatically.
 *
 * When `metadata` is provided, the `BUILDPACT WEB BUNDLE` header section is
 * augmented with versioning fields: Expires, Bundle hash, Source files,
 * Staleness threshold.
 *
 * @param parts    - Ordered list of bundle sections
 * @param metadata - Optional versioning metadata to inject into the bundle header
 */
export function assembleBundle(parts: BundlePart[], metadata?: BundleMetadata): string {
  let processedParts = parts

  if (metadata) {
    const expiresAt = new Date(
      new Date(metadata.generatedAt).getTime() + metadata.stalenessThresholdDays * 24 * 60 * 60 * 1000,
    ).toISOString()

    processedParts = parts.map((p) => {
      if (p.header === 'BUILDPACT WEB BUNDLE') {
        const additionalLines = [
          `Expires: ${expiresAt}`,
          `Bundle hash: ${metadata.bundleHash}`,
          `Source files: ${metadata.sourceFiles.join(', ')}`,
          `Staleness threshold: ${metadata.stalenessThresholdDays} days`,
        ].join('\n')
        return { ...p, content: `${p.content}\n${additionalLines}` }
      }
      return p
    })
  }

  return processedParts
    .filter((p) => p.content.trim().length > 0)
    .map((p) => `=== ${p.header} ===\n${p.content.trim()}`)
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Story 10.2: Progressive bundle compression types and functions
// ---------------------------------------------------------------------------

/** A single agent file loaded from a squad directory */
export interface AgentFile {
  /** Agent file name (without .md extension) */
  name: string
  /** Raw agent file content */
  content: string
  /** Optional squad identifier — used by filterActiveAgents to exclude inactive squad agents */
  squad?: string
}

/**
 * Map of raw bundle parts passed to applyStandardCompression.
 * Contains ALL compressible sections of the bundle.
 */
export interface BundlePartMap {
  /** All available agent files across squads */
  agents: AgentFile[]
  /** Name of the active squad — used to filter agents in step 1 */
  activeSquad: string
  /** Raw constitution markdown */
  constitution: string
  /** Current project context (historical entries must NOT be included) */
  projectContext: string
  /** Target platform key (e.g. 'claude.ai') — used for token budget check */
  platform: string
}

/**
 * Result of applying standard or degradation compression to a bundle.
 * compressionLevel values:
 *   0 = no compression needed (raw bundle within token limit)
 *   1 = standard 4-step compression applied
 *   2 = degradation tier 1 applied (REMOVE_EXAMPLES)
 *   3 = degradation tier 2 applied (REMOVE_HEURISTICS)
 *   4 = degradation tier 3+ applied (CHIEF_ONLY / QUICK_SESSION)
 */
export interface CompressedBundle {
  /** Assembled bundle content ready to be written to disk */
  content: string
  /** Compression level applied (0 = none, 1 = standard, 2–4 = degradation tiers) */
  compressionLevel: 0 | 1 | 2 | 3 | 4
  /** Human-readable list of sections/content that were removed */
  sectionsRemoved: string[]
  /** Estimated token count of the assembled content */
  tokenCount: number
}

// ---------------------------------------------------------------------------
// compressConstitution (Step 2 of standard compression)
// ---------------------------------------------------------------------------

/**
 * Compress a constitution document to essential rules only.
 *
 * Strips:
 *   - HTML-style markdown comments (`<!-- ... -->`)
 *   - Rationale paragraphs (plain text lines, not lists or headings)
 *   - Inline examples (fenced code blocks, indented blocks)
 *
 * Keeps:
 *   - Headings (`#`, `##`, etc.)
 *   - Bullet rules (`- ` or `* `)
 *   - Numbered list items (`1. `, `2. `, etc.)
 *
 * Same input always produces same output (deterministic).
 */
export function compressConstitution(raw: string): string {
  // Step 1: remove HTML-style comments
  let text = raw.replace(/<!--[\s\S]*?-->/g, '')

  // Step 2: remove fenced code blocks (examples)
  text = text.replace(/```[\s\S]*?```/g, '')

  // Step 3: keep only headings, bullet rules, and numbered items
  const lines = text.split('\n')
  const kept: string[] = []
  let inIndentedBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Blank line: emit at most one blank
    if (trimmed === '') {
      inIndentedBlock = false
      if (kept.length > 0 && kept[kept.length - 1] !== '') {
        kept.push('')
      }
      continue
    }

    // Skip indented code blocks (4+ leading spaces)
    if (line.startsWith('    ')) {
      inIndentedBlock = true
      continue
    }
    inIndentedBlock = false

    // Keep headings
    if (trimmed.startsWith('#')) {
      kept.push(line)
      continue
    }

    // Keep bullet rules: - or *
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      kept.push(line)
      continue
    }

    // Keep numbered list items: 1. 2) etc.
    if (/^\d+[.)]\s/.test(trimmed)) {
      kept.push(line)
      continue
    }

    // Skip plain text (rationale paragraphs, inline examples)
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ---------------------------------------------------------------------------
// filterActiveAgents (Step 1 of standard compression)
// ---------------------------------------------------------------------------

/**
 * Return only agents belonging to the active squad.
 *
 * If an agent has no `squad` field set, it passes through (treated as belonging
 * to the active squad). Agents with a `squad` field that does NOT match
 * `activeSquad` are excluded.
 */
export function filterActiveAgents(agentFiles: AgentFile[], activeSquad: string): AgentFile[] {
  return agentFiles.filter((a) => !a.squad || a.squad === activeSquad)
}

// ---------------------------------------------------------------------------
// applyStandardCompression (AC-1: steps 1–4 in exact order)
// ---------------------------------------------------------------------------

/**
 * Apply the 4-step deterministic standard compression to a bundle.
 *
 * Steps (always executed in this order):
 *   1. Inline only active Squad agents (exclude unused agents)
 *   2. Compress Constitution to essential rules only (strip comments, rationale, examples)
 *   3. Exclude optimization history and memory lessons (caller must NOT pass these in)
 *   4. Include only current project context — no historical entries (caller responsibility)
 *
 * Returns compressionLevel 0 when raw bundle fits within the platform token limit.
 * Returns compressionLevel 1 when compression was applied.
 *
 * @see AC-1 — Deterministic compression sequence
 */
export function applyStandardCompression(parts: BundlePartMap): CompressedBundle {
  const sectionsRemoved: string[] = []

  // Step 1: Active agents only — exclude agents not in the active squad
  const filteredAgents = filterActiveAgents(parts.agents, parts.activeSquad)
  if (filteredAgents.length < parts.agents.length) {
    sectionsRemoved.push('inactive-agents')
  }

  // Assemble raw (uncompressed) bundle to check if compression is needed
  const rawAgentContent = filteredAgents
    .map((a) => `--- ${a.name} ---\n${a.content.trim()}`)
    .join('\n\n')

  const rawParts: BundlePart[] = [
    { header: 'CONSTITUTION RULES', content: parts.constitution },
    { header: 'SQUAD AGENTS', content: rawAgentContent },
    { header: 'PROJECT CONTEXT', content: parts.projectContext },
  ]
  const rawContent = assembleBundle(rawParts)
  const rawTokens = estimateTokens(rawContent)
  const { withinLimit } = checkTokenBudget(rawTokens, parts.platform)

  if (withinLimit) {
    // compressionLevel 0: no compression needed
    return {
      content: rawContent,
      compressionLevel: 0,
      sectionsRemoved: [],
      tokenCount: rawTokens,
    }
  }

  // Step 2: Compress Constitution — strip comments, rationale, keep rules only
  const compressedConstitution = compressConstitution(parts.constitution)
  if (compressedConstitution !== parts.constitution) {
    sectionsRemoved.push('constitution-comments-and-rationale')
  }

  // Steps 3 & 4: memory/history excluded by caller (not passed in BundlePartMap);
  // projectContext is the current snapshot only.

  const compressedParts: BundlePart[] = [
    { header: 'CONSTITUTION RULES', content: compressedConstitution },
    { header: 'SQUAD AGENTS', content: rawAgentContent },
    { header: 'PROJECT CONTEXT', content: parts.projectContext },
  ]
  const compressedContent = assembleBundle(compressedParts)
  const compressedTokens = estimateTokens(compressedContent)

  // compressionLevel 1: standard compression applied
  return {
    content: compressedContent,
    compressionLevel: 1,
    sectionsRemoved,
    tokenCount: compressedTokens,
  }
}
