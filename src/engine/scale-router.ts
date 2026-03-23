// Scale Router — FR-XXX
// Determines task complexity level (L0–L4) before pipeline entry
// Inspired by BMAD Method v6 scale-adaptive routing

export type ScaleLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

export interface ScaleAssessment {
  level: ScaleLevel
  score: number
  label: string
  description: string
  recommendation: 'quick' | 'specify' | 'full-pipeline'
  signals: string[]  // what contributed to the score
}

export interface ScaleRouterConfig {
  /** Override automatic routing (from constitution or config) */
  forceLevel?: ScaleLevel
}

// Keyword sets for scoring
const ARCHITECTURAL_KEYWORDS = [
  'auth', 'authentication', 'authorization', 'database', 'migration', 'schema',
  'api', 'service', 'microservice', 'infrastructure', 'deploy', 'security',
  'oauth', 'jwt', 'session', 'permission', 'role', 'middleware'
]

const MULTI_FEATURE_KEYWORDS = [
  'and also', 'additionally', 'plus', 'as well as', 'furthermore',
  'multiple', 'several', 'various'
]

const INTEGRATION_KEYWORDS = [
  'webhook', 'third-party', 'payment', 'stripe', 'sendgrid', 'twilio',
  'external api', 'integration', 'sync', 'import', 'export'
]

/**
 * Compute a complexity score from task description.
 * Score range: 0–10
 */
export function computeComplexityScore(description: string): { score: number; signals: string[] } {
  const lower = description.toLowerCase()
  const words = lower.split(/\s+/)
  const signals: string[] = []
  let score = 0

  // Word count
  if (words.length > 80) { score += 2; signals.push(`Long description (${words.length} words)`) }
  else if (words.length > 40) { score += 1; signals.push(`Medium description (${words.length} words)`) }

  // Architectural keywords
  const archMatches = ARCHITECTURAL_KEYWORDS.filter(k => lower.includes(k))
  if (archMatches.length >= 2) { score += 3; signals.push(`Architectural keywords: ${archMatches.slice(0, 3).join(', ')}`) }
  else if (archMatches.length === 1) { score += 1; signals.push(`Architectural keyword: ${archMatches[0]}`) }

  // Multiple features
  const multiMatches = MULTI_FEATURE_KEYWORDS.filter(k => lower.includes(k))
  if (multiMatches.length > 0) { score += 2; signals.push(`Multiple features detected`) }

  // Multiple files/systems mentioned
  const fileRefs = (description.match(/\b\w+\.(ts|js|py|go|java|sql|yaml|json)\b/g) || []).length
  if (fileRefs >= 3) { score += 2; signals.push(`${fileRefs} file references`) }
  else if (fileRefs >= 1) { score += 1; signals.push(`${fileRefs} file reference`) }

  // Integration keywords
  const intMatches = INTEGRATION_KEYWORDS.filter(k => lower.includes(k))
  if (intMatches.length > 0) { score += 1; signals.push(`Integration: ${intMatches[0]}`) }

  return { score: Math.min(score, 10), signals }
}

const SCALE_MAP: Record<number, { level: ScaleLevel; label: string; description: string; recommendation: ScaleAssessment['recommendation'] }> = {
  0: { level: 'L0', label: 'Atomic Change', description: 'Single, self-contained change', recommendation: 'quick' },
  1: { level: 'L0', label: 'Atomic Change', description: 'Single, self-contained change', recommendation: 'quick' },
  2: { level: 'L1', label: 'Small Feature', description: 'Small, well-understood feature (< 8h)', recommendation: 'quick' },
  3: { level: 'L1', label: 'Small Feature', description: 'Small, well-understood feature (< 8h)', recommendation: 'quick' },
  4: { level: 'L1', label: 'Small Feature', description: 'Small, well-understood feature (< 8h)', recommendation: 'quick' },
  5: { level: 'L2', label: 'Feature Set', description: 'Feature set requiring planning (1–2 days)', recommendation: 'specify' },
  6: { level: 'L2', label: 'Feature Set', description: 'Feature set requiring planning (1–2 days)', recommendation: 'specify' },
  7: { level: 'L2', label: 'Feature Set', description: 'Feature set requiring planning (1–2 days)', recommendation: 'specify' },
  8: { level: 'L3', label: 'Project Scope', description: 'Multi-feature project (1–2 weeks)', recommendation: 'full-pipeline' },
  9: { level: 'L3', label: 'Project Scope', description: 'Multi-feature project (1–2 weeks)', recommendation: 'full-pipeline' },
  10: { level: 'L4', label: 'Enterprise', description: 'Large-scale project requiring full architecture', recommendation: 'full-pipeline' },
}

/**
 * Assess the scale of a task description and return routing recommendation.
 */
export function assessScale(description: string, config?: ScaleRouterConfig): ScaleAssessment {
  if (config?.forceLevel) {
    return {
      level: config.forceLevel,
      score: -1,
      label: `${config.forceLevel} (forced)`,
      description: 'Scale override from configuration',
      recommendation: config.forceLevel === 'L0' || config.forceLevel === 'L1' ? 'quick' :
                      config.forceLevel === 'L2' ? 'specify' : 'full-pipeline',
      signals: ['Forced by config/constitution']
    }
  }

  const { score, signals } = computeComplexityScore(description)
  const entry = SCALE_MAP[score]!

  return {
    level: entry.level,
    score,
    label: entry.label,
    description: entry.description,
    recommendation: entry.recommendation,
    signals
  }
}

/**
 * Format scale assessment for display to user.
 */
export function formatScaleAssessment(assessment: ScaleAssessment): string {
  const icon = assessment.level === 'L0' ? '⚡' :
               assessment.level === 'L1' ? '🔧' :
               assessment.level === 'L2' ? '📋' :
               assessment.level === 'L3' ? '🏗️' : '🏢'

  const lines = [
    `${icon} Scale: ${assessment.level} — ${assessment.label}`,
    `   ${assessment.description}`,
    `   Signals: ${assessment.signals.join(' · ') || 'none'}`,
  ]

  if (assessment.recommendation === 'specify') {
    lines.push(`   → Recommended: /bp:specify for better planning`)
  } else if (assessment.recommendation === 'full-pipeline') {
    lines.push(`   → Required: /bp:specify + /bp:plan + /bp:execute`)
  }

  return lines.join('\n')
}
