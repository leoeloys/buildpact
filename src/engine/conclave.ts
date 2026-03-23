// Conclave — Critical Decision Deliberation
// 3-role structured reasoning for high-stakes architectural decisions
// Clean-room implementation inspired by multi-agent deliberation patterns
// NOT derived from Mega Brain code (no license) — independent design

export type ConclaveRole = 'critic' | 'advocate' | 'synthesizer'

export interface ConclaveInput {
  /** The decision being deliberated */
  decision: string
  /** Context and alternatives already considered */
  context: string
  /** Options presented to the conclave */
  options: string[]
  /** ADR ID this conclave is for */
  adrId?: string
}

export interface ConclaveRoleOutput {
  role: ConclaveRole
  score?: number        // critic only (0–100)
  findings: string[]
  recommendation: 'approve' | 'revise' | 'reject' | 'synthesize'
}

export interface ConclaveResult {
  input: ConclaveInput
  criticOutput: ConclaveRoleOutput
  advocateOutput: ConclaveRoleOutput
  synthesizerOutput: ConclaveRoleOutput
  /** Final decision recommendation */
  finalDecision: string
  /** 0–100 confidence score */
  confidence: number
  /** HUMAN_REQUIRED when confidence < 50 */
  requiresHumanDecision: boolean
  /** Formatted prompt to run with LLM */
  prompt: string
}

/** Constitutional principles applied at the start of every conclave */
export const CONCLAVE_PRINCIPLES = [
  '**Empirismo**: Decisions must be grounded in DATA and evidence, not opinions.',
  '**Pareto 80/20**: Which 20% of the options delivers 80% of the value?',
  '**Inversão**: Before asking "what to do", ask "what would make this fail?"',
  '**Antifragilidade**: Which option *benefits* from uncertainty and change?',
] as const

/**
 * Build the Conclave prompt for a high-stakes architectural decision.
 * This prompt is sent to the LLM to get structured deliberation output.
 */
export function buildConclavePrompt(input: ConclaveInput): string {
  const { decision, context, options, adrId } = input
  const adrRef = adrId ? ` [${adrId}]` : ''

  return `# Conclave Deliberation${adrRef}

## Constitutional Principles (apply to every role)
${CONCLAVE_PRINCIPLES.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Decision Under Deliberation
${decision}

## Context
${context}

## Options
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

---

## Role 1: CRITIC (Methodological)
Evaluate the quality of how this decision is being made — NOT the merit of the options.
Score 0–100 across these dimensions:
- Premises clearly declared? (0–20 pts)
- Evidence traceable? (0–20 pts)
- Logic internally consistent? (0–20 pts)
- Alternative scenarios considered? (0–20 pts)
- Conflicts or dependencies resolved? (0–20 pts)

Output: score, critical gaps found, recommendation (approve/revise/reject)

---

## Role 2: DEVIL'S ADVOCATE
Assume the most popular option is WRONG. Find its vulnerabilities.
Answer these 4 mandatory questions:
1. Which premise, if false, collapses the entire recommendation?
2. What risk did nobody mention?
3. If we regret this decision in 12 months, what happened?
4. What alternative was ignored or dismissed too quickly?

Output: list of findings, recommendation (approve/revise/reject)

---

## Role 3: SYNTHESIZER
Integrate all inputs: original context + Critic score + Advocate findings.
Produce:
- **Final Decision**: clear, actionable choice
- **Modifications**: changes from original options based on feedback
- **Confidence**: 0–100%
- **Residual Risks**: risks that remain despite the decision
- **Reversal Criteria**: what would cause us to reverse this decision?
- **Next Steps**: concrete actions, owner, deadline

**Confidence Thresholds:**
- ≥ 70%: Emit final decision. End process.
- 50–69%: Emit with MEDIUM_CONFIDENCE caveat.
- < 50%: HUMAN_REQUIRED — present options A/B/C with trade-offs.

---

Respond with structured JSON:
\`\`\`json
{
  "critic": { "score": 0-100, "gaps": [...], "recommendation": "approve|revise|reject" },
  "advocate": { "findings": [...], "recommendation": "approve|revise|reject" },
  "synthesizer": {
    "decision": "...",
    "confidence": 0-100,
    "modifications": [...],
    "residual_risks": [...],
    "reversal_criteria": "...",
    "next_steps": [{ "action": "...", "owner": "...", "deadline": "..." }],
    "human_required": true/false,
    "human_options": []  // populated when human_required: true
  }
}
\`\`\`
`
}

/**
 * Parse conclave JSON response from LLM into typed result.
 */
export function parseConclaveResponse(
  input: ConclaveInput,
  rawJson: string
): ConclaveResult {
  let parsed: Record<string, unknown>
  try {
    // Extract JSON from potential markdown code block
    const match = rawJson.match(/```json\s*([\s\S]*?)\s*```/) || rawJson.match(/(\{[\s\S]*\})/)
    parsed = JSON.parse(match ? match[1]! : rawJson) as Record<string, unknown>
  } catch {
    // Fallback: return low-confidence result requiring human decision
    return buildFallbackResult(input)
  }

  const synth = parsed.synthesizer as Record<string, unknown> | undefined
  const critic = parsed.critic as Record<string, unknown> | undefined
  const advocate = parsed.advocate as Record<string, unknown> | undefined

  const confidence = typeof synth?.confidence === 'number' ? synth.confidence : 0
  const criticOutput: ConclaveRoleOutput = {
    role: 'critic',
    score: typeof critic?.score === 'number' ? critic.score : 0,
    findings: Array.isArray(critic?.gaps) ? critic.gaps as string[] : [],
    recommendation: (critic?.recommendation as ConclaveRoleOutput['recommendation']) ?? 'revise'
  }
  const advocateOutput: ConclaveRoleOutput = {
    role: 'advocate',
    findings: Array.isArray(advocate?.findings) ? advocate.findings as string[] : [],
    recommendation: (advocate?.recommendation as ConclaveRoleOutput['recommendation']) ?? 'revise'
  }
  const synthesizerOutput: ConclaveRoleOutput = {
    role: 'synthesizer',
    findings: Array.isArray(synth?.modifications) ? synth.modifications as string[] : [],
    recommendation: 'synthesize'
  }

  return {
    input,
    criticOutput,
    advocateOutput,
    synthesizerOutput,
    finalDecision: typeof synth?.decision === 'string' ? synth.decision : 'Unable to determine',
    confidence,
    requiresHumanDecision: confidence < 50 || (synth?.human_required === true),
    prompt: buildConclavePrompt(input)
  }
}

function buildFallbackResult(input: ConclaveInput): ConclaveResult {
  const fallback: ConclaveRoleOutput = { role: 'synthesizer', findings: [], recommendation: 'revise' }
  return {
    input,
    criticOutput: { role: 'critic', score: 0, findings: ['Parse error — response malformed'], recommendation: 'revise' },
    advocateOutput: { role: 'advocate', findings: ['Parse error — response malformed'], recommendation: 'revise' },
    synthesizerOutput: fallback,
    finalDecision: 'Unable to parse conclave response',
    confidence: 0,
    requiresHumanDecision: true,
    prompt: buildConclavePrompt(input)
  }
}

/**
 * Format conclave result for display.
 */
export function formatConclaveResult(result: ConclaveResult): string {
  const lines = [
    `## Conclave Result${result.input.adrId ? ` — ${result.input.adrId}` : ''}`,
    '',
    `**Confidence:** ${result.confidence}%`,
    result.requiresHumanDecision ? '> ⚠️ **HUMAN DECISION REQUIRED** — Confidence below threshold' : '',
    '',
    `### Decision`,
    result.finalDecision,
    '',
    `### Critic Score: ${result.criticOutput.score}/100`,
    ...result.criticOutput.findings.map(f => `- ${f}`),
    '',
    `### Advocate Findings`,
    ...result.advocateOutput.findings.map(f => `- ${f}`),
  ]

  return lines.filter(l => l !== undefined).join('\n')
}
