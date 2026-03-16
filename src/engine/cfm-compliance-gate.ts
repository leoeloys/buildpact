/**
 * CFM/ANVISA Compliance Gate — Medical Marketing Squad
 *
 * Detects prohibited claims in marketing copy per:
 * - CFM nº 1.974/2011 — Brazilian Federal Council of Medicine advertising rules
 * - ANVISA RDC nº 96/2008 — Health product advertising rules
 *
 * Returns structured violations with specific rule references.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CfmViolation {
  /** Specific regulation rule reference, e.g. "CFM 1.974/2011 Art. 7 §1" */
  rule: string
  /** Human-readable description of the violation */
  description: string
  /** The matched text that triggered the violation */
  matchedText: string
}

export interface CfmComplianceResult {
  /** true if no violations detected */
  compliant: boolean
  violations: CfmViolation[]
}

// ---------------------------------------------------------------------------
// Rule definitions
// ---------------------------------------------------------------------------

interface CfmRule {
  rule: string
  description: string
  patterns: RegExp[]
}

const CFM_RULES: CfmRule[] = [
  // Art. 7 §1 — Guaranteed outcome claims
  {
    rule: 'CFM 1.974/2011 Art. 7 §1',
    description: 'Prohibited: guaranteed medical outcomes or absolute efficacy claims',
    patterns: [
      /\bcura\s+garantida\b/gi,
      /\bresultado\s+garantido\b/gi,
      /\b100%\s+(eficaz|seguro|efetivo|curado?)\b/gi,
      /\bgarantia\s+de\s+(cura|resultado|tratamento)\b/gi,
      /\bsem\s+risco\s+algum\b/gi,
      /\btratamento\s+infalível\b/gi,
      /\bcure\s+garantida\b/gi,
      /\bsucesso\s+garantido\b/gi,
    ],
  },

  // Art. 6 — Superlatives and superiority claims
  {
    rule: 'CFM 1.974/2011 Art. 6',
    description: 'Prohibited: superlatives about physician skill or claims of superiority over other physicians',
    patterns: [
      /\bmelhor\s+médico\b/gi,
      /\bmelhor\s+(cirurgião|dermatologista|cardiologista|neurologista|ortopedista|ginecologista|pediatra|psiquiatra|urologista|oftalmologista)\b/gi,
      /\bmais\s+experiente\b/gi,
      /único\s+(médico|especialista|tratamento)\b/gi,
      /\bmelhor\s+clínica\b/gi,
      /\bmelhor\s+hospital\b/gi,
      /\bn[oº]1\s+em\s+(medicina|saúde|tratamento)\b/gi,
      /\bnúmero\s+1\s+em\b/gi,
    ],
  },

  // Art. 7 §3 — Patient testimonials
  {
    rule: 'CFM 1.974/2011 Art. 7 §3',
    description: 'Prohibited: patient testimonials in medical advertising',
    patterns: [
      /\bdepoimento\s+de\s+paciente\b/gi,
      /\brelato\s+de\s+paciente\b/gi,
      /\b"(eu|meu|minha)\s+.{0,60}médico\b/gi,
      /\bhistória\s+de\s+sucesso\s+de\s+paciente\b/gi,
      /\btestemunho\s+real\b/gi,
    ],
  },

  // Art. 7 §2 — Before/after photographs
  {
    rule: 'CFM 1.974/2011 Art. 7 §2',
    description: 'Prohibited: before-and-after photographs of medical or surgical procedures',
    patterns: [
      /\bantes\s+e?\s*depois\b/gi,
      /\bbefore\s+and?\s*after\b/gi,
      /\bresultado\s+visual\s+(do\s+)?procedimento\b/gi,
      /\bfoto\s+(do\s+)?(antes|depois|resultado)\b/gi,
      /\btransformação\s+visual\b/gi,
    ],
  },

  // Art. 9 — Pricing/promotional offers
  {
    rule: 'CFM 1.974/2011 Art. 9',
    description: 'Prohibited: promotional pricing, free consultation offers used as bait, discounts',
    patterns: [
      /\bconsulta\s+gratuita\b/gi,
      /\bconsulta\s+grátis\b/gi,
      /\b\d{1,3}%\s+de\s+desconto\b/gi,
      /\bpromoção\s+(de\s+)?(consulta|tratamento|procedimento)\b/gi,
      /\bpreço\s+especial\s+para\s+(tratamento|consulta)\b/gi,
      /\bpacote\s+(com\s+)?desconto\b/gi,
      /\bavaliação\s+gratuita\s+de\s+procedimento\b/gi,
    ],
  },

  // Art. 14 — Comparative advertising
  {
    rule: 'CFM 1.974/2011 Art. 14',
    description: 'Prohibited: comparative advertising against other physicians or clinics',
    patterns: [
      /\bmelhor\s+que\s+(outros|demais)\s+(médicos|clínicas|hospitais)\b/gi,
      /\bdiferente\s+de\s+outros\s+médicos\b/gi,
      /\bsuperior\s+a\s+(outros|demais)\s+(tratamentos|médicos)\b/gi,
      /\bnão\s+(use|confie)\s+(em\s+)?(outros|qualquer)\s+(médico|clínica)\b/gi,
    ],
  },

  // ANVISA RDC 96/2008 — Health product/drug advertising
  {
    rule: 'ANVISA RDC nº 96/2008',
    description: 'Prohibited: absolute efficacy claims for health products without ANVISA registration',
    patterns: [
      /\bperca\s+\d+\s*kg?\s+em\s+\d+\s+dias\b/gi,
      /\bemagreça\s+\d+\s*kg?\b/gi,
      /\belimina?\s+\d+\s*kg?\s+em\b/gi,
      /\bcura\s+(diabetes|câncer|hipertensão|pressão\s+alta|obesidade)\b/gi,
      /\btrata\s+(definitivamente|permanentemente)\s+(diabetes|câncer|obesidade)\b/gi,
      /\bsuplemento\s+que\s+cura\b/gi,
      /\bproduto\s+que\s+(cura|trata|elimina)\s+(doença|mal|problema\s+de\s+saúde)\b/gi,
    ],
  },
]

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Check marketing copy text for CFM/ANVISA compliance violations.
 *
 * @param text - The marketing copy text to validate
 * @returns CfmComplianceResult with compliant flag and list of violations
 */
export function checkCfmCompliance(text: string): CfmComplianceResult {
  const violations: CfmViolation[] = []

  for (const rule of CFM_RULES) {
    for (const pattern of rule.patterns) {
      const matches = text.match(pattern)
      if (matches) {
        for (const match of matches) {
          violations.push({
            rule: rule.rule,
            description: rule.description,
            matchedText: match,
          })
        }
      }
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  }
}

/**
 * Format a compliance result as a human-readable report.
 *
 * @param result - The compliance check result
 * @param language - Output language ('en' | 'pt-br')
 * @returns Formatted markdown string
 */
export function formatComplianceReport(result: CfmComplianceResult, language: 'en' | 'pt-br' = 'pt-br'): string {
  if (result.compliant) {
    return language === 'pt-br'
      ? '✅ Nenhuma violação CFM/ANVISA detectada.'
      : '✅ No CFM/ANVISA violations detected.'
  }

  const header =
    language === 'pt-br'
      ? `⚠️ ${result.violations.length} violação(ões) CFM/ANVISA detectada(s):\n`
      : `⚠️ ${result.violations.length} CFM/ANVISA violation(s) detected:\n`

  const lines = result.violations.map((v, i) => {
    const label = language === 'pt-br' ? 'Texto identificado' : 'Matched text'
    return [
      `${i + 1}. **${v.rule}**`,
      `   ${v.description}`,
      `   ${label}: \`${v.matchedText}\``,
    ].join('\n')
  })

  return header + lines.join('\n\n')
}

/**
 * Returns the list of all CFM/ANVISA rule references tracked by this gate.
 * Useful for documentation and testing.
 */
export function listTrackedRules(): string[] {
  return CFM_RULES.map(r => r.rule)
}
