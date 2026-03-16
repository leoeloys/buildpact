/**
 * Community Governance Infrastructure Tests (US-050)
 *
 * Validates that all community health and governance files exist and meet
 * the acceptance criteria: bilingual CONTRIBUTING.md, good-first-issue labels,
 * MADR ADR template, and bilingual-enforcing PR template.
 */

import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ROOT = join(__dirname, '..', '..', '..')
const CONTRIBUTING = join(ROOT, 'CONTRIBUTING.md')
const DECISIONS_DIR = join(ROOT, 'docs', 'decisions')
const PR_TEMPLATE = join(ROOT, '.github', 'PULL_REQUEST_TEMPLATE.md')
const LABELS_FILE = join(ROOT, '.github', 'labels.yml')

// ---------------------------------------------------------------------------
// CONTRIBUTING.md
// ---------------------------------------------------------------------------

describe('CONTRIBUTING.md — bilingual content', () => {
  it('exists at repository root', async () => {
    const content = await readFile(CONTRIBUTING, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('contains English step-by-step instructions', async () => {
    const content = await readFile(CONTRIBUTING, 'utf-8')
    // Must have numbered steps in EN
    expect(content).toContain('Step 1')
    expect(content).toContain('Step 2')
    expect(content).toContain('Step 3')
  })

  it('contains Portuguese (PT-BR) step-by-step instructions', async () => {
    const content = await readFile(CONTRIBUTING, 'utf-8')
    // Must have numbered steps in PT-BR
    expect(content).toContain('Passo 1')
    expect(content).toContain('Passo 2')
    expect(content).toContain('Passo 3')
  })

  it('includes PT-BR section marker', async () => {
    const content = await readFile(CONTRIBUTING, 'utf-8')
    expect(content).toContain('PT-BR')
  })

  it('references bilingual i18n requirement (en.yaml + pt-br.yaml)', async () => {
    const content = await readFile(CONTRIBUTING, 'utf-8')
    expect(content).toContain('en.yaml')
    expect(content).toContain('pt-br.yaml')
  })

  it('contains npm test and typecheck commands', async () => {
    const content = await readFile(CONTRIBUTING, 'utf-8')
    expect(content).toContain('npm test')
    expect(content).toContain('typecheck')
  })
})

// ---------------------------------------------------------------------------
// docs/decisions/ — MADR infrastructure
// ---------------------------------------------------------------------------

describe('docs/decisions/ — MADR ADR infrastructure', () => {
  it('directory exists', async () => {
    const entries = await readdir(DECISIONS_DIR)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('contains MADR template file', async () => {
    const entries = await readdir(DECISIONS_DIR)
    const hasTemplate = entries.some(e => e.includes('TEMPLATE') || e.includes('template'))
    expect(hasTemplate, 'Expected a TEMPLATE-*.md file in docs/decisions/').toBe(true)
  })

  it('MADR template has required sections', async () => {
    const content = await readFile(join(DECISIONS_DIR, 'TEMPLATE-MADR.md'), 'utf-8')
    expect(content).toContain('Context and Problem Statement')
    expect(content).toContain('Decision Drivers')
    expect(content).toContain('Considered Options')
    expect(content).toContain('Decision Outcome')
    expect(content).toContain('Status')
  })

  it('MADR template includes Status field with valid values', async () => {
    const content = await readFile(join(DECISIONS_DIR, 'TEMPLATE-MADR.md'), 'utf-8')
    expect(content).toContain('proposed')
    expect(content).toContain('accepted')
    expect(content).toContain('deprecated')
    expect(content).toContain('superseded')
  })

  it('contains at least one concrete ADR following the MADR template', async () => {
    const entries = await readdir(DECISIONS_DIR)
    const adrs = entries.filter(e => /^ADR-\d+/.test(e) && e.endsWith('.md'))
    expect(adrs.length, 'Expected at least one ADR-NNN-*.md file').toBeGreaterThan(0)
  })

  it('concrete ADR has accepted status and all MADR sections', async () => {
    const content = await readFile(join(DECISIONS_DIR, 'ADR-000-esm-typescript-result-pattern.md'), 'utf-8')
    expect(content).toContain('Status:')
    expect(content).toContain('accepted')
    expect(content).toContain('Context and Problem Statement')
    expect(content).toContain('Decision Outcome')
    expect(content).toContain('Positive Consequences')
    expect(content).toContain('Negative Consequences')
  })
})

// ---------------------------------------------------------------------------
// .github/PULL_REQUEST_TEMPLATE.md
// ---------------------------------------------------------------------------

describe('.github/PULL_REQUEST_TEMPLATE.md — bilingual i18n enforcement', () => {
  it('exists in .github/', async () => {
    const content = await readFile(PR_TEMPLATE, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('has a bilingual i18n checklist section', async () => {
    const content = await readFile(PR_TEMPLATE, 'utf-8')
    expect(content).toContain('i18n')
    expect(content).toContain('en.yaml')
    expect(content).toContain('pt-br.yaml')
  })

  it('requires same key in both locales', async () => {
    const content = await readFile(PR_TEMPLATE, 'utf-8')
    // The template must explicitly call out that the same key goes in both files
    expect(content).toContain('same key')
  })

  it('has typecheck and test checklist items', async () => {
    const content = await readFile(PR_TEMPLATE, 'utf-8')
    expect(content).toContain('typecheck')
    expect(content).toContain('npm test')
  })

  it('has bilingual labels on checklist items (EN + PT-BR)', async () => {
    const content = await readFile(PR_TEMPLATE, 'utf-8')
    // Checklist items should have both EN and PT-BR descriptions
    expect(content).toContain('PT-BR')
  })

  it('includes architecture layer dependency check', async () => {
    const content = await readFile(PR_TEMPLATE, 'utf-8')
    expect(content).toContain('contracts')
    expect(content).toContain('engine')
  })
})

// ---------------------------------------------------------------------------
// .github/labels.yml — good-first-issue labels
// ---------------------------------------------------------------------------

describe('.github/labels.yml — good-first-issue labels', () => {
  it('exists in .github/', async () => {
    const content = await readFile(LABELS_FILE, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  it('has at least 5 good-first-issue labels', async () => {
    const content = await readFile(LABELS_FILE, 'utf-8')
    const matches = content.match(/good-first-issue/g) ?? []
    expect(matches.length, 'Expected ≥5 good-first-issue label entries').toBeGreaterThanOrEqual(5)
  })

  it('each good-first-issue label has a description with effort estimate', async () => {
    const content = await readFile(LABELS_FILE, 'utf-8')
    // Each good-first-issue description must mention effort <N hr
    const effortMatches = content.match(/Effort:/g) ?? []
    expect(effortMatches.length, 'Expected effort estimate for each good-first-issue label').toBeGreaterThanOrEqual(5)
  })

  it('each good-first-issue label has a mentor reference', async () => {
    const content = await readFile(LABELS_FILE, 'utf-8')
    const mentorMatches = content.match(/Mentor:/g) ?? []
    expect(mentorMatches.length, 'Expected mentor reference for each good-first-issue label').toBeGreaterThanOrEqual(5)
  })

  it('each good-first-issue label has a scope reference', async () => {
    const content = await readFile(LABELS_FILE, 'utf-8')
    const scopeMatches = content.match(/Scope:/g) ?? []
    expect(scopeMatches.length, 'Expected scope reference for each good-first-issue label').toBeGreaterThanOrEqual(5)
  })

  it('good-first-issue labels use the reserved 7057ff color', async () => {
    const content = await readFile(LABELS_FILE, 'utf-8')
    const colorMatches = content.match(/7057ff/g) ?? []
    expect(colorMatches.length, 'Expected 7057ff color on good-first-issue labels').toBeGreaterThanOrEqual(5)
  })
})
