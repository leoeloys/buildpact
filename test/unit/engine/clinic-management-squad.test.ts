/**
 * Clinic Management Squad Tests (US-041)
 *
 * Validates that templates/squads/clinic-management/ passes all structural
 * validation checks and that all 4 agents enforce Brazilian healthcare compliance context.
 */

import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { validateSquadStructure, validateHandoffGraph } from '../../../src/engine/squad-scaffolder.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CLINIC_SQUAD_DIR = join(__dirname, '..', '..', '..', 'templates', 'squads', 'clinic-management')

// ---------------------------------------------------------------------------
// Squad YAML
// ---------------------------------------------------------------------------

describe('Clinic Management Squad — squad.yaml', () => {
  it('has all required YAML fields', async () => {
    const yaml = await readFile(join(CLINIC_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    const requiredFields = ['name:', 'version:', 'domain:', 'description:', 'initial_level:']
    for (const field of requiredFields) {
      expect(yaml, `Missing field: ${field}`).toContain(field)
    }
  })

  it('has phases mapping for pipeline phases', async () => {
    const yaml = await readFile(join(CLINIC_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('phases:')
    expect(yaml).toContain('specify:')
    expect(yaml).toContain('plan:')
    expect(yaml).toContain('execute:')
    expect(yaml).toContain('verify:')
  })

  it('lists all 4 agents in agents block', async () => {
    const yaml = await readFile(join(CLINIC_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('operations-manager:')
    expect(yaml).toContain('finance-analyst:')
    expect(yaml).toContain('compliance-checker:')
    expect(yaml).toContain('patient-flow-optimizer:')
  })

  it('references Brazilian healthcare regulations in compliance section', async () => {
    const yaml = await readFile(join(CLINIC_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('ANS')
    expect(yaml).toContain('CFM')
    expect(yaml).toContain('LGPD')
  })

  it('has domain_questions addressing the 4 required clinic topics', async () => {
    const yaml = await readFile(join(CLINIC_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('clinic_specialty')
    expect(yaml).toContain('patient_volume')
    expect(yaml).toContain('health_plan_agreements')
    expect(yaml).toContain('compliance_context')
  })
})

// ---------------------------------------------------------------------------
// Agent files
// ---------------------------------------------------------------------------

describe('Clinic Management Squad — agent files', () => {
  it('has exactly 4 agent files', async () => {
    const agentsDir = join(CLINIC_SQUAD_DIR, 'agents')
    const files = await readdir(agentsDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    expect(mdFiles).toHaveLength(4)
    expect(mdFiles).toContain('operations-manager.md')
    expect(mdFiles).toContain('finance-analyst.md')
    expect(mdFiles).toContain('compliance-checker.md')
    expect(mdFiles).toContain('patient-flow-optimizer.md')
  })

  const agents = [
    'operations-manager.md',
    'finance-analyst.md',
    'compliance-checker.md',
    'patient-flow-optimizer.md',
  ]

  for (const agentFile of agents) {
    describe(`agents/${agentFile}`, () => {
      it('has all 6 required layers', async () => {
        const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const layers = ['## Identity', '## Persona', '## Voice DNA', '## Heuristics', '## Examples', '## Handoffs']
        for (const layer of layers) {
          expect(content, `Missing ${layer} in ${agentFile}`).toContain(layer)
        }
      })

      it('has all 5 Voice DNA sections', async () => {
        const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const sections = [
          '### Personality Anchors',
          '### Opinion Stance',
          '### Anti-Patterns',
          '### Never-Do Rules',
          '### Inspirational Anchors',
        ]
        for (const section of sections) {
          expect(content, `Missing ${section} in ${agentFile}`).toContain(section)
        }
      })

      it('has minimum 5 Anti-Pattern prohibited markers (✘)', async () => {
        const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const antiPatternsStart = content.indexOf('### Anti-Patterns')
        expect(antiPatternsStart).toBeGreaterThan(-1)
        const afterAntiPatterns = content.slice(antiPatternsStart + '### Anti-Patterns'.length)
        const nextSubsectionIdx = afterAntiPatterns.search(/^###\s/m)
        const antiPatternsContent = nextSubsectionIdx === -1 ? afterAntiPatterns : afterAntiPatterns.slice(0, nextSubsectionIdx)
        const prohibitedCount = (antiPatternsContent.match(/✘/g) ?? []).length
        expect(prohibitedCount, `Expected ≥5 ✘ in Anti-Patterns of ${agentFile}, found ${prohibitedCount}`).toBeGreaterThanOrEqual(5)
      })

      it('has minimum 3 IF/THEN heuristic rules', async () => {
        const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        expect(heuristicsStart).toBeGreaterThan(-1)
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        const rules = heuristicsContent.match(/^\d+\.\s+(When|If)\b/gm) ?? []
        expect(rules.length, `Expected ≥3 IF/THEN rules in ${agentFile}, found ${rules.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one VETO condition in Heuristics', async () => {
        const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        expect(heuristicsContent, `Missing VETO: in ${agentFile}`).toContain('VETO:')
      })

      it('has minimum 3 Examples', async () => {
        const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const exampleMatches = content.match(/^\d+\.\s+\*\*/gm) ?? []
        expect(exampleMatches.length, `Expected ≥3 examples in ${agentFile}, found ${exampleMatches.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one Handoff entry', async () => {
        const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        expect(content, `Missing handoff arrow in ${agentFile}`).toMatch(/^-\s+[←→]/m)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Compliance Checker — Brazilian healthcare regulation references
// ---------------------------------------------------------------------------

describe('Clinic Management Squad — Compliance Checker regulatory coverage', () => {
  it('compliance-checker references Lei 8.080/90', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'compliance-checker.md'), 'utf-8')
    expect(content).toContain('8.080/90')
  })

  it('compliance-checker references CFM Código de Ética Médica', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'compliance-checker.md'), 'utf-8')
    expect(content).toContain('CFM')
    expect(content).toMatch(/CEM|Código de Ética/)
  })

  it('compliance-checker references ANS regulations', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'compliance-checker.md'), 'utf-8')
    expect(content).toContain('ANS')
  })

  it('compliance-checker references LGPD patient data protection', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'compliance-checker.md'), 'utf-8')
    expect(content).toContain('LGPD')
    expect(content).toContain('13.709')
  })

  it('compliance-checker references Estatuto do Idoso elderly patient rights', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'compliance-checker.md'), 'utf-8')
    expect(content).toMatch(/Estatuto do Idoso|10\.741/)
  })

  it('compliance-checker VETO references regulatory violation', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'compliance-checker.md'), 'utf-8')
    expect(content).toContain('VETO:')
  })
})

// ---------------------------------------------------------------------------
// Patient Flow Optimizer — Estatuto do Idoso compliance
// ---------------------------------------------------------------------------

describe('Clinic Management Squad — Patient Flow Optimizer elderly rights compliance', () => {
  it('patient-flow-optimizer references Estatuto do Idoso Art. 15 priority scheduling', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'patient-flow-optimizer.md'), 'utf-8')
    expect(content).toMatch(/Estatuto do Idoso|10\.741/)
    expect(content).toMatch(/Art\.\s*15|priority/)
  })

  it('patient-flow-optimizer VETO blocks flow changes that reduce elderly priority slots', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'patient-flow-optimizer.md'), 'utf-8')
    expect(content).toContain('VETO:')
  })
})

// ---------------------------------------------------------------------------
// Finance Analyst — ANS/TISS billing compliance
// ---------------------------------------------------------------------------

describe('Clinic Management Squad — Finance Analyst ANS/TISS billing compliance', () => {
  it('finance-analyst references TISS billing standard', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'finance-analyst.md'), 'utf-8')
    expect(content).toContain('TISS')
  })

  it('finance-analyst references ANS regulations', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'finance-analyst.md'), 'utf-8')
    expect(content).toContain('ANS')
  })

  it('finance-analyst VETO blocks billing without fee table validation', async () => {
    const content = await readFile(join(CLINIC_SQUAD_DIR, 'agents', 'finance-analyst.md'), 'utf-8')
    expect(content).toContain('VETO:')
  })
})

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

describe('Clinic Management Squad — built-in templates', () => {
  it('has Brazilian healthcare compliance checklist template', async () => {
    const content = await readFile(
      join(CLINIC_SQUAD_DIR, 'templates', 'brazil-healthcare-compliance-checklist.md'),
      'utf-8'
    )
    expect(content).toContain('Lei 8.080/90')
    expect(content).toContain('CFM')
    expect(content).toContain('ANS')
    expect(content).toContain('LGPD')
  })

  it('compliance checklist has at least 20 checklist items', async () => {
    const content = await readFile(
      join(CLINIC_SQUAD_DIR, 'templates', 'brazil-healthcare-compliance-checklist.md'),
      'utf-8'
    )
    const items = content.match(/- \[ \]/g) ?? []
    expect(items.length, `Expected ≥20 checklist items, found ${items.length}`).toBeGreaterThanOrEqual(20)
  })

  it('compliance checklist covers patient rights, LGPD, elderly rights, and ANS billing', async () => {
    const content = await readFile(
      join(CLINIC_SQUAD_DIR, 'templates', 'brazil-healthcare-compliance-checklist.md'),
      'utf-8'
    )
    expect(content).toContain('Patient Rights')
    expect(content).toContain('LGPD')
    expect(content).toContain('Estatuto do Idoso')
    expect(content).toContain('Health Plan Billing')
  })

  it('has patient flow dashboard template', async () => {
    const content = await readFile(
      join(CLINIC_SQUAD_DIR, 'templates', 'patient-flow-dashboard.md'),
      'utf-8'
    )
    expect(content).toMatch(/Patient Flow/i)
    expect(content).toContain('No-show rate')
  })

  it('patient flow dashboard includes elderly priority compliance row', async () => {
    const content = await readFile(
      join(CLINIC_SQUAD_DIR, 'templates', 'patient-flow-dashboard.md'),
      'utf-8'
    )
    expect(content).toMatch(/Priority|Idoso|60/)
    expect(content).toContain('Estatuto do Idoso')
  })
})

// ---------------------------------------------------------------------------
// validateSquadStructure — full validation pass
// ---------------------------------------------------------------------------

describe('Clinic Management Squad — validateSquadStructure', () => {
  it('passes structural validation with zero errors', async () => {
    const result = await validateSquadStructure(CLINIC_SQUAD_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})

// ---------------------------------------------------------------------------
// validateHandoffGraph — handoff graph validity
// ---------------------------------------------------------------------------

describe('Clinic Management Squad — validateHandoffGraph', () => {
  it('passes handoff graph validation with zero errors', async () => {
    const result = await validateHandoffGraph(CLINIC_SQUAD_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})
