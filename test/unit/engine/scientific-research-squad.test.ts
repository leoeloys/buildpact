/**
 * Scientific Research Squad Tests (US-040)
 *
 * Validates that templates/squads/scientific-research/ passes all structural
 * validation checks and that all 5 agents enforce research rigor context.
 */

import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { validateSquadStructure, validateHandoffGraph } from '../../../src/engine/squad-scaffolder.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const RESEARCH_SQUAD_DIR = join(__dirname, '..', '..', '..', 'templates', 'squads', 'scientific-research')

// ---------------------------------------------------------------------------
// Squad YAML
// ---------------------------------------------------------------------------

describe('Scientific Research Squad — squad.yaml', () => {
  it('has all required YAML fields', async () => {
    const yaml = await readFile(join(RESEARCH_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    const requiredFields = ['name:', 'version:', 'domain:', 'description:', 'initial_level:']
    for (const field of requiredFields) {
      expect(yaml, `Missing field: ${field}`).toContain(field)
    }
  })

  it('has phases mapping for pipeline phases', async () => {
    const yaml = await readFile(join(RESEARCH_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('phases:')
    expect(yaml).toContain('specify:')
    expect(yaml).toContain('plan:')
    expect(yaml).toContain('execute:')
    expect(yaml).toContain('verify:')
  })

  it('lists all 5 agents in agents block', async () => {
    const yaml = await readFile(join(RESEARCH_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('research-lead:')
    expect(yaml).toContain('literature-reviewer:')
    expect(yaml).toContain('data-analyst:')
    expect(yaml).toContain('peer-reviewer:')
    expect(yaml).toContain('latex-writer:')
  })

  it('has domain_questions addressing the 4 required research topics', async () => {
    const yaml = await readFile(join(RESEARCH_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('research_question')
    expect(yaml).toContain('study_design')
    expect(yaml).toContain('inclusion_exclusion')
    expect(yaml).toContain('statistical_approach')
  })
})

// ---------------------------------------------------------------------------
// Agent files
// ---------------------------------------------------------------------------

describe('Scientific Research Squad — agent files', () => {
  it('has exactly 5 agent files', async () => {
    const agentsDir = join(RESEARCH_SQUAD_DIR, 'agents')
    const files = await readdir(agentsDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    expect(mdFiles).toHaveLength(5)
    expect(mdFiles).toContain('research-lead.md')
    expect(mdFiles).toContain('literature-reviewer.md')
    expect(mdFiles).toContain('data-analyst.md')
    expect(mdFiles).toContain('peer-reviewer.md')
    expect(mdFiles).toContain('latex-writer.md')
  })

  const agents = [
    'research-lead.md',
    'literature-reviewer.md',
    'data-analyst.md',
    'peer-reviewer.md',
    'latex-writer.md',
  ]

  for (const agentFile of agents) {
    describe(`agents/${agentFile}`, () => {
      it('has all 6 required layers', async () => {
        const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const layers = ['## Identity', '## Persona', '## Voice DNA', '## Heuristics', '## Examples', '## Handoffs']
        for (const layer of layers) {
          expect(content, `Missing ${layer} in ${agentFile}`).toContain(layer)
        }
      })

      it('has all 5 Voice DNA sections', async () => {
        const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', agentFile), 'utf-8')
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
        const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const antiPatternsStart = content.indexOf('### Anti-Patterns')
        expect(antiPatternsStart).toBeGreaterThan(-1)
        const afterAntiPatterns = content.slice(antiPatternsStart + '### Anti-Patterns'.length)
        const nextSubsectionIdx = afterAntiPatterns.search(/^###\s/m)
        const antiPatternsContent = nextSubsectionIdx === -1 ? afterAntiPatterns : afterAntiPatterns.slice(0, nextSubsectionIdx)
        const prohibitedCount = (antiPatternsContent.match(/✘/g) ?? []).length
        expect(prohibitedCount, `Expected ≥5 ✘ in Anti-Patterns of ${agentFile}, found ${prohibitedCount}`).toBeGreaterThanOrEqual(5)
      })

      it('has minimum 3 IF/THEN heuristic rules', async () => {
        const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        expect(heuristicsStart).toBeGreaterThan(-1)
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        const rules = heuristicsContent.match(/^\d+\.\s+(When|If)\b/gm) ?? []
        expect(rules.length, `Expected ≥3 IF/THEN rules in ${agentFile}, found ${rules.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one VETO condition in Heuristics', async () => {
        const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        expect(heuristicsContent, `Missing VETO: in ${agentFile}`).toContain('VETO:')
      })

      it('has minimum 3 Examples', async () => {
        const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const exampleMatches = content.match(/^\d+\.\s+\*\*/gm) ?? []
        expect(exampleMatches.length, `Expected ≥3 examples in ${agentFile}, found ${exampleMatches.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one Handoff entry', async () => {
        const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        expect(content, `Missing handoff arrow in ${agentFile}`).toMatch(/^-\s+[←→]/m)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Systematic review protocol in Research Lead
// ---------------------------------------------------------------------------

describe('Scientific Research Squad — Research Lead systematic review protocols', () => {
  it('research-lead references PRISMA or CONSORT protocols', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', 'research-lead.md'), 'utf-8')
    expect(content).toMatch(/PRISMA|CONSORT/)
  })

  it('research-lead references PICO framework', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', 'research-lead.md'), 'utf-8')
    expect(content).toContain('PICO')
  })

  it('research-lead has pre-registration requirement in Anti-Patterns', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', 'research-lead.md'), 'utf-8')
    expect(content).toMatch(/pre-regist/i)
  })
})

// ---------------------------------------------------------------------------
// Literature Reviewer PRISMA compliance
// ---------------------------------------------------------------------------

describe('Scientific Research Squad — Literature Reviewer PRISMA compliance', () => {
  it('literature-reviewer references PRISMA', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', 'literature-reviewer.md'), 'utf-8')
    expect(content).toContain('PRISMA')
  })

  it('literature-reviewer mentions minimum 3 databases', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', 'literature-reviewer.md'), 'utf-8')
    // Should mention at least 3 databases (PubMed, Embase, Cochrane)
    const dbMatches = content.match(/PubMed|Embase|Cochrane|MEDLINE|Scopus|Web of Science/gi) ?? []
    expect(dbMatches.length, 'Expected references to ≥3 literature databases').toBeGreaterThanOrEqual(3)
  })

  it('literature-reviewer VETO references systematic review methodology', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', 'literature-reviewer.md'), 'utf-8')
    expect(content).toContain('VETO:')
  })
})

// ---------------------------------------------------------------------------
// Data Analyst statistical rigor
// ---------------------------------------------------------------------------

describe('Scientific Research Squad — Data Analyst statistical rigor', () => {
  it('data-analyst references statistical analysis plan', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', 'data-analyst.md'), 'utf-8')
    expect(content).toMatch(/statistical analysis plan|SAP/i)
  })

  it('data-analyst references effect sizes and confidence intervals', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'agents', 'data-analyst.md'), 'utf-8')
    expect(content).toMatch(/effect size/i)
    expect(content).toMatch(/confidence interval/i)
  })
})

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

describe('Scientific Research Squad — built-in templates', () => {
  it('has PRISMA checklist template', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'templates', 'prisma-checklist.md'), 'utf-8')
    expect(content).toContain('PRISMA')
  })

  it('PRISMA checklist has at least 20 checklist items', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'templates', 'prisma-checklist.md'), 'utf-8')
    const items = content.match(/- \[ \]/g) ?? []
    expect(items.length, `Expected ≥20 checklist items, found ${items.length}`).toBeGreaterThanOrEqual(20)
  })

  it('PRISMA checklist covers title, abstract, methods, results, and discussion', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'templates', 'prisma-checklist.md'), 'utf-8')
    expect(content).toContain('## Title')
    expect(content).toContain('## Abstract')
    expect(content).toContain('## Methods')
    expect(content).toContain('## Results')
    expect(content).toContain('## Discussion')
  })

  it('has statistical analysis plan template', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'templates', 'statistical-analysis-plan.md'), 'utf-8')
    expect(content).toMatch(/statistical analysis plan/i)
  })

  it('SAP template includes sample size and power calculation section', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'templates', 'statistical-analysis-plan.md'), 'utf-8')
    expect(content).toMatch(/sample size/i)
    expect(content).toMatch(/power/i)
  })

  it('SAP template includes primary and secondary outcomes', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'templates', 'statistical-analysis-plan.md'), 'utf-8')
    expect(content).toMatch(/primary outcome/i)
    expect(content).toMatch(/secondary outcome/i)
  })

  it('SAP template includes missing data handling section', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'templates', 'statistical-analysis-plan.md'), 'utf-8')
    expect(content).toMatch(/missing data/i)
  })

  it('SAP template includes deviations section for transparency', async () => {
    const content = await readFile(join(RESEARCH_SQUAD_DIR, 'templates', 'statistical-analysis-plan.md'), 'utf-8')
    expect(content).toMatch(/deviation/i)
  })
})

// ---------------------------------------------------------------------------
// validateSquadStructure — full validation pass
// ---------------------------------------------------------------------------

describe('Scientific Research Squad — validateSquadStructure', () => {
  it('passes structural validation with zero errors', async () => {
    const result = await validateSquadStructure(RESEARCH_SQUAD_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})

// ---------------------------------------------------------------------------
// validateHandoffGraph — handoff graph validity
// ---------------------------------------------------------------------------

describe('Scientific Research Squad — validateHandoffGraph', () => {
  it('passes handoff graph validation with zero errors', async () => {
    const result = await validateHandoffGraph(RESEARCH_SQUAD_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})
