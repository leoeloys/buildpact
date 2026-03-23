/**
 * Domain expansion packs — install pre-built domain configurations
 * (squads + constitution rules) into existing BuildPact projects.
 * @module engine/expansion-packs
 * @see Epic 25.3 — Domain Expansion Packs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ok, err, type Result } from '../contracts/errors.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpansionPack {
  name: string
  domain: string
  description: string
  squadName: string
  constitutionRules: string[]
  exampleSpecs: string[]
}

// ---------------------------------------------------------------------------
// Built-in packs
// ---------------------------------------------------------------------------

const BUILTIN_PACKS: ExpansionPack[] = [
  {
    name: 'healthcare',
    domain: 'healthcare',
    description: 'HIPAA-aware healthcare squad with patient data safeguards',
    squadName: 'healthcare',
    constitutionRules: [
      'All patient data must be anonymized before processing',
      'HIPAA compliance must be verified for every output',
      'No PHI may appear in logs, specs, or generated code',
    ],
    exampleSpecs: [
      'Patient intake form with consent tracking',
      'Appointment scheduling with provider availability',
    ],
  },
  {
    name: 'legal',
    domain: 'legal',
    description: 'Legal document processing squad with privilege safeguards',
    squadName: 'legal',
    constitutionRules: [
      'Attorney-client privilege must be preserved in all outputs',
      'Legal citations must reference verified sources only',
      'Disclaimers must be included on all generated legal content',
    ],
    exampleSpecs: [
      'Contract review with clause extraction',
      'Legal brief summarization with citation tracking',
    ],
  },
  {
    name: 'education',
    domain: 'education',
    description: 'Education-focused squad with accessibility and pedagogy rules',
    squadName: 'education',
    constitutionRules: [
      'All content must meet WCAG 2.1 AA accessibility standards',
      'Learning objectives must be explicitly stated for each module',
      'Age-appropriate language must be used based on target audience',
    ],
    exampleSpecs: [
      'Interactive quiz module with adaptive difficulty',
      'Student progress dashboard with learning analytics',
    ],
  },
  {
    name: 'fintech',
    domain: 'fintech',
    description: 'Financial technology squad with regulatory compliance rules',
    squadName: 'fintech',
    constitutionRules: [
      'All monetary calculations must use fixed-point arithmetic',
      'PCI-DSS compliance must be verified for payment processing',
      'Audit trails must be maintained for all financial transactions',
    ],
    exampleSpecs: [
      'Payment processing with PCI-DSS compliance',
      'Transaction reconciliation dashboard',
    ],
  },
]

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Return the list of built-in expansion packs.
 */
export function listAvailablePacks(): ExpansionPack[] {
  return [...BUILTIN_PACKS]
}

/**
 * Merge new rules into an existing constitution string.
 * Appends under a "## Domain Rules" section without overwriting existing content.
 */
export function mergeConstitutionRules(
  existing: string,
  newRules: string[],
): string {
  if (newRules.length === 0) return existing

  const rulesSection = `\n\n## Domain Rules\n\n${newRules.map((r) => `- ${r}`).join('\n')}\n`

  // If there's already a "## Domain Rules" section, append to it
  const domainRulesIndex = existing.indexOf('## Domain Rules')
  if (domainRulesIndex !== -1) {
    // Find the next section header or end of file
    const nextSection = existing.indexOf('\n## ', domainRulesIndex + 1)
    const insertPoint = nextSection === -1 ? existing.length : nextSection
    const formattedRules = newRules.map((r) => `- ${r}`).join('\n')
    return (
      existing.slice(0, insertPoint).trimEnd() +
      '\n' +
      formattedRules +
      '\n' +
      (nextSection === -1 ? '' : existing.slice(nextSection))
    )
  }

  return existing.trimEnd() + rulesSection
}

/**
 * Install an expansion pack into a project:
 * 1. Merge constitution rules into the existing constitution
 * 2. Create the squad directory with a basic squad.yaml
 */
export async function installPack(
  pack: ExpansionPack,
  projectDir: string,
): Promise<Result<{ constitutionMerged: boolean; squadInstalled: boolean }>> {
  let constitutionMerged = false
  let squadInstalled = false

  // 1. Merge constitution rules
  try {
    const constitutionPath = join(projectDir, '.buildpact', 'constitution.md')
    let existing = ''
    try {
      existing = await readFile(constitutionPath, 'utf-8')
    } catch {
      // No existing constitution — create from scratch
    }

    const merged = mergeConstitutionRules(existing, pack.constitutionRules)
    await mkdir(join(projectDir, '.buildpact'), { recursive: true })
    await writeFile(constitutionPath, merged, 'utf-8')
    constitutionMerged = true
  } catch (e) {
    return err({
      code: 'FILE_WRITE_FAILED',
      i18nKey: 'error.expansion.constitution_merge_failed',
      cause: e,
    })
  }

  // 2. Install squad
  try {
    const squadDir = join(projectDir, '.buildpact', 'squads', pack.squadName)
    await mkdir(squadDir, { recursive: true })

    const squadYaml = [
      `name: ${pack.squadName}`,
      `domain: ${pack.domain}`,
      `description: ${pack.description}`,
      `agents: []`,
    ].join('\n')

    await writeFile(join(squadDir, 'squad.yaml'), squadYaml, 'utf-8')
    squadInstalled = true
  } catch (e) {
    return err({
      code: 'FILE_WRITE_FAILED',
      i18nKey: 'error.expansion.squad_install_failed',
      cause: e,
    })
  }

  return ok({ constitutionMerged, squadInstalled })
}
