/**
 * Software Squad — Reference Implementation Tests (US-038)
 *
 * Validates that templates/squads/software/ passes all structural validation
 * checks out of the box, serving as the canonical reference implementation.
 */

import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { validateSquadStructure, validateHandoffGraph } from '../../../src/engine/squad-scaffolder.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Resolve templates/squads/software from test file location (test/unit/engine → root)
const SOFTWARE_SQUAD_DIR = join(__dirname, '..', '..', '..', 'templates', 'squads', 'software')

// ---------------------------------------------------------------------------
// Squad YAML
// ---------------------------------------------------------------------------

describe('Software Squad — squad.yaml', () => {
  it('has all required YAML fields', async () => {
    const yaml = await readFile(join(SOFTWARE_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    const requiredFields = ['name:', 'version:', 'domain:', 'description:', 'initial_level:']
    for (const field of requiredFields) {
      expect(yaml, `Missing field: ${field}`).toContain(field)
    }
  })

  it('has phases mapping for all pipeline phases', async () => {
    const yaml = await readFile(join(SOFTWARE_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('phases:')
    expect(yaml).toContain('specify:')
    expect(yaml).toContain('plan:')
    expect(yaml).toContain('execute:')
    expect(yaml).toContain('verify:')
  })

  it('lists all 5 agents in agents block', async () => {
    const yaml = await readFile(join(SOFTWARE_SQUAD_DIR, 'squad.yaml'), 'utf-8')
    expect(yaml).toContain('pm:')
    expect(yaml).toContain('architect:')
    expect(yaml).toContain('developer:')
    expect(yaml).toContain('qa:')
    expect(yaml).toContain('tech-writer:')
  })
})

// ---------------------------------------------------------------------------
// Agent files
// ---------------------------------------------------------------------------

describe('Software Squad — agent files', () => {
  it('has exactly 5 agent files', async () => {
    const agentsDir = join(SOFTWARE_SQUAD_DIR, 'agents')
    const files = await readdir(agentsDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    expect(mdFiles).toHaveLength(5)
    expect(mdFiles).toContain('pm.md')
    expect(mdFiles).toContain('architect.md')
    expect(mdFiles).toContain('developer.md')
    expect(mdFiles).toContain('qa.md')
    expect(mdFiles).toContain('tech-writer.md')
  })

  const agents = ['pm.md', 'architect.md', 'developer.md', 'qa.md', 'tech-writer.md']

  for (const agentFile of agents) {
    describe(`agents/${agentFile}`, () => {
      it('has all 6 required layers', async () => {
        const content = await readFile(join(SOFTWARE_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const layers = ['## Identity', '## Persona', '## Voice DNA', '## Heuristics', '## Examples', '## Handoffs']
        for (const layer of layers) {
          expect(content, `Missing ${layer}`).toContain(layer)
        }
      })

      it('has all 5 Voice DNA sections', async () => {
        const content = await readFile(join(SOFTWARE_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const sections = [
          '### Personality Anchors',
          '### Opinion Stance',
          '### Anti-Patterns',
          '### Never-Do Rules',
          '### Inspirational Anchors',
        ]
        for (const section of sections) {
          expect(content, `Missing ${section}`).toContain(section)
        }
      })

      it('has minimum 5 Anti-Pattern prohibited markers (✘)', async () => {
        const content = await readFile(join(SOFTWARE_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const antiPatternsStart = content.indexOf('### Anti-Patterns')
        expect(antiPatternsStart).toBeGreaterThan(-1)
        const afterAntiPatterns = content.slice(antiPatternsStart + '### Anti-Patterns'.length)
        const nextSubsectionIdx = afterAntiPatterns.search(/^###\s/m)
        const antiPatternsContent = nextSubsectionIdx === -1 ? afterAntiPatterns : afterAntiPatterns.slice(0, nextSubsectionIdx)
        const prohibitedCount = (antiPatternsContent.match(/✘/g) ?? []).length
        expect(prohibitedCount, `Expected ≥5 ✘ in Anti-Patterns, found ${prohibitedCount}`).toBeGreaterThanOrEqual(5)
      })

      it('has minimum 3 IF/THEN heuristic rules', async () => {
        const content = await readFile(join(SOFTWARE_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        expect(heuristicsStart).toBeGreaterThan(-1)
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        const rules = heuristicsContent.match(/^\d+\.\s+(When|If)\b/gm) ?? []
        expect(rules.length, `Expected ≥3 IF/THEN rules, found ${rules.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one VETO condition in Heuristics', async () => {
        const content = await readFile(join(SOFTWARE_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const heuristicsStart = content.indexOf('## Heuristics')
        const afterHeuristics = content.slice(heuristicsStart + '## Heuristics'.length)
        const nextSectionIdx = afterHeuristics.search(/^##\s/m)
        const heuristicsContent = nextSectionIdx === -1 ? afterHeuristics : afterHeuristics.slice(0, nextSectionIdx)
        expect(heuristicsContent).toContain('VETO:')
      })

      it('has minimum 3 Examples', async () => {
        const content = await readFile(join(SOFTWARE_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        const exampleMatches = content.match(/^\d+\.\s+\*\*/gm) ?? []
        expect(exampleMatches.length, `Expected ≥3 examples, found ${exampleMatches.length}`).toBeGreaterThanOrEqual(3)
      })

      it('has at least one Handoff entry', async () => {
        const content = await readFile(join(SOFTWARE_SQUAD_DIR, 'agents', agentFile), 'utf-8')
        expect(content).toMatch(/^-\s+[←→]/m)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// validateSquadStructure — full validation pass
// ---------------------------------------------------------------------------

describe('Software Squad — validateSquadStructure', () => {
  it('passes structural validation with zero errors', async () => {
    const result = await validateSquadStructure(SOFTWARE_SQUAD_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})

// ---------------------------------------------------------------------------
// validateHandoffGraph — handoff graph validity
// ---------------------------------------------------------------------------

describe('Software Squad — validateHandoffGraph', () => {
  it('passes handoff graph validation with zero errors', async () => {
    const result = await validateHandoffGraph(SOFTWARE_SQUAD_DIR)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.errors).toHaveLength(0)
    }
  })
})
