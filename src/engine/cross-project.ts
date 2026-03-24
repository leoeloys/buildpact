/**
 * Cross-project learning — fingerprint projects, compute similarity,
 * and suggest patterns from other (anonymized) projects.
 * @module engine/cross-project
 * @see Epic 25.1 — Cross-Project Learning
 */

import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectFingerprint {
  id: string
  domain: string
  techStack: string[]
  complexity: 'low' | 'medium' | 'high'
  scale: number
  successfulPatterns: string[]
  timestamp: string
}

export interface PatternSuggestion {
  patternId: string
  description: string
  sourceFingerprint: string
  similarity: number
}

// ---------------------------------------------------------------------------
// Hashing helpers
// ---------------------------------------------------------------------------

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Create a fingerprint for a project. The id is a SHA-256 hash of
 * the project directory + domain + tech stack, so no raw paths leak.
 */
export function generateFingerprint(
  projectDir: string,
  domain: string,
  techStack: string[],
): ProjectFingerprint {
  const raw = `${projectDir}:${domain}:${techStack.sort().join(',')}`
  const id = hashString(raw)

  // Rough complexity heuristic based on stack breadth
  const complexity: ProjectFingerprint['complexity'] =
    techStack.length <= 2 ? 'low' : techStack.length <= 5 ? 'medium' : 'high'

  return {
    id,
    domain,
    techStack: [...techStack],
    complexity,
    scale: 0,
    successfulPatterns: [],
    timestamp: new Date().toISOString(),
  }
}

/**
 * Compute Jaccard similarity on techStack with a domain-match bonus.
 * Returns a value between 0 and 1.
 */
export function computeSimilarity(
  a: ProjectFingerprint,
  b: ProjectFingerprint,
): number {
  const setA = new Set(a.techStack)
  const setB = new Set(b.techStack)

  const intersection = [...setA].filter((x) => setB.has(x)).length
  const union = new Set([...setA, ...setB]).size

  const jaccard = union === 0 ? 0 : intersection / union
  const domainBonus = a.domain === b.domain ? 0.15 : 0

  return Math.min(1, jaccard + domainBonus)
}

/**
 * Return pattern suggestions from fingerprints whose similarity to
 * `current` exceeds the given threshold (default 0.7).
 */
export function suggestPatterns(
  current: ProjectFingerprint,
  fingerprints: ProjectFingerprint[],
  threshold = 0.7,
): PatternSuggestion[] {
  const suggestions: PatternSuggestion[] = []

  for (const fp of fingerprints) {
    if (fp.id === current.id) continue
    const similarity = computeSimilarity(current, fp)
    if (similarity < threshold) continue

    for (const pattern of fp.successfulPatterns) {
      suggestions.push({
        patternId: pattern,
        description: `Pattern from ${fp.domain} project`,
        sourceFingerprint: hashString(fp.id),
        similarity,
      })
    }
  }

  return suggestions.sort((a, b) => b.similarity - a.similarity)
}

/**
 * Apply differential privacy (Laplace noise) to numeric fields and
 * hash all identifiers so the fingerprint is safe for sharing.
 */
export function applyDifferentialPrivacy(
  fingerprint: ProjectFingerprint,
  epsilon = 1.0,
): ProjectFingerprint {
  // Laplace noise: sample = -b * sign(u) * ln(1 - 2|u|) where b = 1/epsilon
  const b = 1 / epsilon
  // Cryptographically secure uniform [0,1) random
  const buf = randomBytes(4)
  const u = buf.readUInt32BE(0) / 0x100000000 - 0.5
  const noise = -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))

  return {
    id: hashString(fingerprint.id + randomBytes(8).toString('hex')),
    domain: fingerprint.domain,
    techStack: fingerprint.techStack.map((t) => hashString(t)),
    complexity: fingerprint.complexity,
    scale: Math.max(0, Math.round(fingerprint.scale + noise)),
    successfulPatterns: fingerprint.successfulPatterns.map((p) => hashString(p)),
    timestamp: fingerprint.timestamp,
  }
}

/**
 * Check whether cross-project learning is enabled.
 * Reads .buildpact/config.yaml (simple check) — defaults to true.
 */
export async function isLearningEnabled(projectDir: string): Promise<boolean> {
  try {
    const configPath = join(projectDir, '.buildpact', 'config.yaml')
    const content = await readFile(configPath, 'utf-8')
    // Simple YAML key check — avoids pulling in a parser dependency
    const match = /crossProject\s*:\s*\n\s*enabled\s*:\s*(true|false)/.exec(content)
    if (match) return match[1] === 'true'
    // Also check flat key form
    const flat = /crossProject\.enabled\s*:\s*(true|false)/.exec(content)
    if (flat) return flat[1] === 'true'
    return true
  } catch {
    // No config file — default enabled
    return true
  }
}
