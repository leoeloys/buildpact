/**
 * Medical Marketing Squad Tests (US-039)
 *
 * Validates that templates/squads/medical-marketing/ passes all structural
 * validation checks and that all 4 agents enforce CFM/ANVISA compliance context.
 */

import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { validateSquadStructure, validateHandoffGraph } from '../../../src/engine/squad-scaffolder.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MEDICAL_SQUAD_DIR = join(__dirname, '..', '..', '..', 'templates', 'squads', 'medical-marketing')

// ---------------------------------------------------------------------------
// Squad YAML
// ---------------------------------------------------------------------------

describe('Medical Marketing Squad — squad.yaml', () => {
  it('has all required YAML fields', async () => {
    const yaml = await readFile(join(MEDICAL_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    const requiredFields = ['name:', 'version:', 'domain:', 'description:', 'initial_level:']
    for (const field of requiredFields) {
      expect(yaml, `Missing field: ${field}`).toContain(field)
    }
  })

  it('has phases mapping for pipeline phases', async () => {
    const yaml = await readFile(join(MEDICAL_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('phases:')
    expect(yaml).toContain('specify:')
    expect(yaml).toContain('plan:')
    expect(yaml).toContain('execute:')
    expect(yaml).toContain('verify:')
  })

  it('lists all 4 agents in agents block', async () => {
    const yaml = await readFile(join(MEDICAL_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('strategist:')
    expect(yaml).toContain('copywriter:')
    expect(yaml).toContain('designer:')
    expect(yaml).toContain('analytics:')
  })

  it('references CFM/ANVISA compliance regulation', async () => {
    const yaml = await readFile(join(MEDICAL_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('CFM')
    expect(yaml).toContain('ANVISA')
  })
})

// ---------------------------------------------------------------------------
// Agent files
// ---------------------------------------------------------------------------

describe('Medical Marketing Squad — agent files', () => {
  it('has exactly 4 agent files', async () => {
    const agentsDir = join(MEDICAL_SQUAD_DIR, 'agents')
    const files = await readdir(agentsDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    expect(mdFiles).toHaveLength(4)
    expect(mdFiles).toContain('strategist.md')
    expect(mdFiles).toContain('copywriter.md')
    expect(mdFiles).toContain('designer.md')
    expect(mdFiles).toContain('analytics.md')
  })

  const agents = ['strategist.md', 'copywriter.md', 'designer.md', 'analytics.md']

  for (const agentFile of agents) {
    describe(`agents/${agentFile}`, () => {
      it('has all 6 required layers', async () => {
        const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const layers = ['## Identity', '## Persona', '## Voice DNA', '## Heuristics', '## Examples', '## Handoffs']
        for (const layer of layers) {
          expect(content, `Missing ${layer} in ${agentFile}`).toContain(layer)
        }
      })

      it('has all 5 Voice DNA sections', async () => {
        const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', agentFile), 'utf-8')
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
        const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const antiPatternsStart = content.indexOf('### Anti-Patterns')
        expect(antiPatternsStart).toBeGreaterThan(-1)
        const afterAntiPatterns = content.slice(antiPatternsStart + '### Anti-Patterns'.length)
        const nextSubsectionIdx = afterAntiPatterns.search(/^###\s/m)
        const antiPatternsContent = nextSubsectionIdx === -1 ? afterAntiPatterns : afterAntiPatterns.slice(0, nextSubsectionIdx)
        const prohibitedCount = (antiPatternsContent.match(/✘/g) ?? []).length
        expect(prohibitedCount, `Expected ≥5 ✘ in Anti-Patterns of ${agentFile}, found ${prohibitedCount}`).toBeGreaterThanOrEqual(5)
      })

      it('has minimum 3 IF/THEN heuristic rules', async () => {
        const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        expect(heuristicsStart).toBeGreaterThan(-1)
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        const rules = heuristicsContent.match(/^\d+\.\s+(When|If)\b/gm) ?? []
        expect(rules.length, `Expected ≥3 IF/THEN rules in ${agentFile}, found ${rules.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one VETO condition in Heuristics', async () => {
        const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        expect(heuristicsContent, `Missing VETO: in ${agentFile}`).toContain('VETO:')
      })

      it('has minimum 3 Examples', async () => {
        const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const exampleMatches = content.match(/^\d+\.\s+\*\*/gm) ?? []
        expect(exampleMatches.length, `Expected ≥3 examples in ${agentFile}, found ${exampleMatches.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one Handoff entry', async () => {
        const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        expect(content, `Missing handoff arrow in ${agentFile}`).toMatch(/^-\s+[←→]/m)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// CFM/ANVISA compliance references in Copywriter
// ---------------------------------------------------------------------------

describe('Medical Marketing Squad — Copywriter CFM compliance', () => {
  it('copywriter Voice DNA references CFM nº 1.974/2011', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', 'copywriter.md'), 'utf-8')
    expect(content).toContain('CFM')
    expect(content).toContain('1.974/2011')
  })

  it('copywriter anti-patterns reference specific CFM article numbers', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', 'copywriter.md'), 'utf-8')
    expect(content).toMatch(/Art\.\s*\d+/)
  })

  it('copywriter VETO references CFM rule', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', 'copywriter.md'), 'utf-8')
    expect(content).toMatch(/VETO:.*CFM/i)
  })

  it('copywriter references ANVISA RDC', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'agents', 'copywriter.md'), 'utf-8')
    expect(content).toContain('ANVISA')
  })
})

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

describe('Medical Marketing Squad — built-in templates', () => {
  it('has CFM checklist template', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'templates', 'cfm-checklist.md'), 'utf-8')
    expect(content).toContain('CFM')
    expect(content).toContain('1.974/2011')
    expect(content).toContain('ANVISA')
  })

  it('CFM checklist covers all major articles', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'templates', 'cfm-checklist.md'), 'utf-8')
    expect(content).toContain('Art. 6')
    expect(content).toContain('Art. 7')
    expect(content).toContain('Art. 9')
    expect(content).toContain('Art. 14')
  })

  it('has WhatsApp CTA template', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'templates', 'whatsapp-cta.md'), 'utf-8')
    expect(content).toContain('WhatsApp')
    expect(content).toContain('agendar')
  })

  it('WhatsApp CTA template has at least 3 approved templates', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'templates', 'whatsapp-cta.md'), 'utf-8')
    const templateMatches = content.match(/^## Template \d+/gm) ?? []
    expect(templateMatches.length).toBeGreaterThanOrEqual(3)
  })

  it('has Schema JSON-LD template', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'templates', 'schema-jsonld.json'), 'utf-8')
    const parsed = JSON.parse(content) as Record<string, unknown>
    expect(parsed).toHaveProperty('MedicalOrganization')
    expect(parsed).toHaveProperty('Physician')
  })

  it('Schema JSON-LD includes MedicalOrganization type', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'templates', 'schema-jsonld.json'), 'utf-8')
    expect(content).toContain('MedicalOrganization')
    expect(content).toContain('schema.org')
  })

  it('Schema JSON-LD includes Physician with CFM credential', async () => {
    const content = await readFile(join(MEDICAL_SQUAD_DIR, 'templates', 'schema-jsonld.json'), 'utf-8')
    expect(content).toContain('CRM')
    expect(content).toContain('Conselho Federal de Medicina')
  })
})

// ---------------------------------------------------------------------------
// validateSquadStructure — full validation pass
// ---------------------------------------------------------------------------

describe('Medical Marketing Squad — validateSquadStructure', () => {
  it('passes structural validation with zero errors', async () => {
    const result = await validateSquadStructure(MEDICAL_SQUAD_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})

// ---------------------------------------------------------------------------
// validateHandoffGraph — handoff graph validity
// ---------------------------------------------------------------------------

describe('Medical Marketing Squad — validateHandoffGraph', () => {
  it('passes handoff graph validation with zero errors', async () => {
    const result = await validateHandoffGraph(MEDICAL_SQUAD_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})
