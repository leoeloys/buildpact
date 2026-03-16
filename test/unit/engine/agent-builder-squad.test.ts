/**
 * Agent Builder Squad Tests (US-042)
 *
 * Validates that templates/squads/agent-builder/ passes all structural
 * validation checks and that all 3 agents enforce meta-creation quality gates.
 */

import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { validateSquadStructure, validateHandoffGraph } from '../../../src/engine/squad-scaffolder.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const AGENT_BUILDER_DIR = join(__dirname, '..', '..', '..', 'templates', 'squads', 'agent-builder')

// ---------------------------------------------------------------------------
// Squad YAML
// ---------------------------------------------------------------------------

describe('Agent Builder Squad — squad.yaml', () => {
  it('has all required YAML fields', async () => {
    const yaml = await readFile(join(AGENT_BUILDER_DIR, 'squad.yaml'), 'utf-8')
    const requiredFields = ['name:', 'version:', 'domain:', 'description:', 'initial_level:']
    for (const field of requiredFields) {
      expect(yaml, `Missing field: ${field}`).toContain(field)
    }
  })

  it('has phases mapping for pipeline phases', async () => {
    const yaml = await readFile(join(AGENT_BUILDER_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('phases:')
    expect(yaml).toContain('specify:')
    expect(yaml).toContain('plan:')
    expect(yaml).toContain('execute:')
    expect(yaml).toContain('verify:')
  })

  it('lists all 3 agents in agents block', async () => {
    const yaml = await readFile(join(AGENT_BUILDER_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('agent-designer:')
    expect(yaml).toContain('workflow-architect:')
    expect(yaml).toContain('squad-tester:')
  })

  it('has domain_questions addressing the 4 required Squad design topics', async () => {
    const yaml = await readFile(join(AGENT_BUILDER_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('squad_purpose')
    expect(yaml).toContain('target_domain')
    expect(yaml).toContain('agent_roles')
    expect(yaml).toContain('workflow_handoffs')
  })
})

// ---------------------------------------------------------------------------
// Agent files — structural validation (6 layers + Voice DNA)
// ---------------------------------------------------------------------------

describe('Agent Builder Squad — agent files', () => {
  it('has exactly 3 agent files', async () => {
    const agentsDir = join(AGENT_BUILDER_DIR, 'agents')
    const files = await readdir(agentsDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    expect(mdFiles).toHaveLength(3)
    expect(mdFiles).toContain('agent-designer.md')
    expect(mdFiles).toContain('workflow-architect.md')
    expect(mdFiles).toContain('squad-tester.md')
  })

  const agents = [
    'agent-designer.md',
    'workflow-architect.md',
    'squad-tester.md',
  ]

  for (const agentFile of agents) {
    describe(`agents/${agentFile}`, () => {
      it('has all 6 required layers', async () => {
        const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', agentFile), 'utf-8')
        const layers = ['## Identity', '## Persona', '## Voice DNA', '## Heuristics', '## Examples', '## Handoffs']
        for (const layer of layers) {
          expect(content, `Missing ${layer} in ${agentFile}`).toContain(layer)
        }
      })

      it('has all 5 Voice DNA sections', async () => {
        const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', agentFile), 'utf-8')
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
        const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', agentFile), 'utf-8')
        const antiPatternsStart = content.indexOf('### Anti-Patterns')
        expect(antiPatternsStart).toBeGreaterThan(-1)
        const afterAntiPatterns = content.slice(antiPatternsStart + '### Anti-Patterns'.length)
        const nextSubsectionIdx = afterAntiPatterns.search(/^###\s/m)
        const antiPatternsContent = nextSubsectionIdx === -1 ? afterAntiPatterns : afterAntiPatterns.slice(0, nextSubsectionIdx)
        const prohibitedCount = (antiPatternsContent.match(/✘/g) ?? []).length
        expect(prohibitedCount, `Expected ≥5 ✘ in Anti-Patterns of ${agentFile}, found ${prohibitedCount}`).toBeGreaterThanOrEqual(5)
      })

      it('has minimum 3 IF/THEN heuristic rules', async () => {
        const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        expect(heuristicsStart).toBeGreaterThan(-1)
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        const rules = heuristicsContent.match(/^\d+\.\s+(When|If)\b/gm) ?? []
        expect(rules.length, `Expected ≥3 IF/THEN rules in ${agentFile}, found ${rules.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one VETO condition in Heuristics', async () => {
        const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        expect(heuristicsContent, `Missing VETO: in ${agentFile}`).toContain('VETO:')
      })

      it('has minimum 3 Examples', async () => {
        const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', agentFile), 'utf-8')
        const exampleMatches = content.match(/^\d+\.\s+\*\*/gm) ?? []
        expect(exampleMatches.length, `Expected ≥3 examples in ${agentFile}, found ${exampleMatches.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one Handoff entry', async () => {
        const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', agentFile), 'utf-8')
        expect(content, `Missing handoff arrow in ${agentFile}`).toMatch(/^-\s+[←→]/m)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Agent Designer — meta creation quality gates
// ---------------------------------------------------------------------------

describe('Agent Builder Squad — Agent Designer quality gates', () => {
  it('agent-designer guides through Voice DNA design', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'agent-designer.md'), 'utf-8')
    expect(content).toContain('Voice DNA')
    expect(content).toContain('Identity')
    expect(content).toContain('Persona')
  })

  it('agent-designer references 6-layer anatomy checklist', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'agent-designer.md'), 'utf-8')
    expect(content).toMatch(/6-layer|six.layer|anatomy/i)
  })

  it('agent-designer has VETO condition blocking role overlap', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'agent-designer.md'), 'utf-8')
    expect(content).toContain('VETO:')
  })

  it('agent-designer hands off to squad-tester for validation', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'agent-designer.md'), 'utf-8')
    expect(content).toMatch(/Squad Tester|squad-tester/i)
  })
})

// ---------------------------------------------------------------------------
// Workflow Architect — heuristics and handoff design
// ---------------------------------------------------------------------------

describe('Agent Builder Squad — Workflow Architect workflow design', () => {
  it('workflow-architect guides through heuristics design', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'workflow-architect.md'), 'utf-8')
    expect(content).toContain('Heuristics')
    expect(content).toMatch(/IF.THEN|if.then|When.*condition/i)
  })

  it('workflow-architect guides through handoff graph design', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'workflow-architect.md'), 'utf-8')
    expect(content).toMatch(/handoff|Handoff/i)
    expect(content).toMatch(/directed graph|graph/i)
  })

  it('workflow-architect has VETO condition for handoff validation', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'workflow-architect.md'), 'utf-8')
    expect(content).toContain('VETO:')
  })

  it('workflow-architect references examples design', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'workflow-architect.md'), 'utf-8')
    expect(content).toContain('Examples')
  })
})

// ---------------------------------------------------------------------------
// Squad Tester — 6-layer and Voice DNA validation
// ---------------------------------------------------------------------------

describe('Agent Builder Squad — Squad Tester validation criteria', () => {
  it('squad-tester validates against 6-layer anatomy', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'squad-tester.md'), 'utf-8')
    expect(content).toMatch(/6-layer|six.layer/i)
    expect(content).toContain('Identity')
    expect(content).toContain('Persona')
    expect(content).toContain('Voice DNA')
    expect(content).toContain('Heuristics')
    expect(content).toContain('Examples')
    expect(content).toContain('Handoffs')
  })

  it('squad-tester validates Voice DNA requirements', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'squad-tester.md'), 'utf-8')
    expect(content).toContain('Voice DNA')
    expect(content).toMatch(/Anti-Patterns|anti.patterns/i)
    expect(content).toMatch(/≥5|minimum 5/i)
  })

  it('squad-tester enforces VETO: blocks on single violation', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'squad-tester.md'), 'utf-8')
    expect(content).toContain('VETO:')
    expect(content).toMatch(/block|stop|fail/i)
  })

  it('squad-tester validates handoff graph completeness', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'squad-tester.md'), 'utf-8')
    expect(content).toMatch(/handoff graph|validateHandoffGraph/i)
    expect(content).toMatch(/orphan|zero handoff/i)
  })

  it('squad-tester issues pass/fail verdict (not partial pass)', async () => {
    const content = await readFile(join(AGENT_BUILDER_DIR, 'agents', 'squad-tester.md'), 'utf-8')
    expect(content).toMatch(/pass|fail/i)
    expect(content).toMatch(/partial pass|partial/i)
  })
})

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

describe('Agent Builder Squad — built-in templates', () => {
  it('has squad-design-worksheet template', async () => {
    const content = await readFile(
      join(AGENT_BUILDER_DIR, 'templates', 'squad-design-worksheet.md'),
      'utf-8'
    )
    expect(content).toMatch(/Squad Design Worksheet/i)
  })

  it('squad-design-worksheet covers all 5 design sections', async () => {
    const content = await readFile(
      join(AGENT_BUILDER_DIR, 'templates', 'squad-design-worksheet.md'),
      'utf-8'
    )
    expect(content).toContain('Squad Purpose')
    expect(content).toContain('Agent Roster')
    expect(content).toContain('Voice DNA')
    expect(content).toContain('Workflow Map')
    expect(content).toContain('VETO')
  })

  it('squad-design-worksheet has validation checklist with VETO and handoff checks', async () => {
    const content = await readFile(
      join(AGENT_BUILDER_DIR, 'templates', 'squad-design-worksheet.md'),
      'utf-8'
    )
    expect(content).toContain('Validation Checklist')
    expect(content).toMatch(/6-layer|6 layer/i)
    expect(content).toMatch(/VETO/i)
    expect(content).toMatch(/handoff/i)
  })

  it('squad-design-worksheet has at least 10 checklist items', async () => {
    const content = await readFile(
      join(AGENT_BUILDER_DIR, 'templates', 'squad-design-worksheet.md'),
      'utf-8'
    )
    const items = content.match(/- \[ \]/g) ?? []
    expect(items.length, `Expected ≥10 checklist items, found ${items.length}`).toBeGreaterThanOrEqual(10)
  })
})

// ---------------------------------------------------------------------------
// validateSquadStructure — full validation pass
// ---------------------------------------------------------------------------

describe('Agent Builder Squad — validateSquadStructure', () => {
  it('passes structural validation with zero errors', async () => {
    const result = await validateSquadStructure(AGENT_BUILDER_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})

// ---------------------------------------------------------------------------
// validateHandoffGraph — handoff graph validity
// ---------------------------------------------------------------------------

describe('Agent Builder Squad — validateHandoffGraph', () => {
  it('passes handoff graph validation with zero errors', async () => {
    const result = await validateHandoffGraph(AGENT_BUILDER_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})
