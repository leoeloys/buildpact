/**
 * Integration test: constitution create + edit + payload injection flow
 * Tests AC-1 (create), AC-2 (edit), AC-3 (payload injection) end-to-end
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadConstitution,
  saveConstitution,
  constitutionExists,
  enforceConstitution,
  formatViolationWarning,
  parseConstitutionPrinciples,
} from '../../../src/foundation/constitution.js'
import { enforceConstitutionOnOutput } from '../../../src/engine/orchestrator.js'
import { buildTaskPayload } from '../../../src/engine/subagent.js'
import { createI18n } from '../../../src/foundation/i18n.js'

// Mock @clack/prompts to prevent interactive TTY in CI
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  group: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  log: { success: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  isCancel: vi.fn(() => false),
}))

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupProject(dir: string): Promise<void> {
  await mkdir(join(dir, '.buildpact'), { recursive: true })
}

// ---------------------------------------------------------------------------
// AC-1: Constitution creation
// ---------------------------------------------------------------------------

describe('AC-1: Constitution creation', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-constitution-flow-'))
    await setupProject(tmpDir)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('creates .buildpact/constitution.md via handler create flow', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.group).mockResolvedValueOnce({
      coding_standards: '- Use TypeScript strict mode',
      compliance: 'LGPD',
      architecture: '- Layered architecture',
      quality_gates: '- 90% coverage',
      domain_rules: 'N/A',
    })

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/constitution/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    // File must exist
    const exists = await constitutionExists(tmpDir)
    expect(exists).toBe(true)

    // Content must contain the user-provided rules
    const content = await readFile(join(tmpDir, '.buildpact', 'constitution.md'), 'utf-8')
    expect(content).toContain('Use TypeScript strict mode')
    expect(content).toContain('LGPD')
    expect(content).toContain('90% coverage')
  })

  it('constitution content includes all 5 required sections', async () => {
    const clack = await import('@clack/prompts')
    vi.mocked(clack.group).mockResolvedValueOnce({
      coding_standards: 'Standard',
      compliance: 'None',
      architecture: 'Clean arch',
      quality_gates: '80%',
      domain_rules: 'N/A',
    })

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/constitution/handler.js')
    await handler.run([])

    const content = await readFile(join(tmpDir, '.buildpact', 'constitution.md'), 'utf-8')
    expect(content).toContain('Coding Standards')
    expect(content).toContain('Compliance Requirements')
    expect(content).toContain('Architectural Constraints')
    expect(content).toContain('Quality Gates')
    expect(content).toContain('Domain-Specific Rules')
    expect(content).toContain('Version History')
  })
})

// ---------------------------------------------------------------------------
// AC-2: Constitution update (edit mode)
// ---------------------------------------------------------------------------

describe('AC-2: Constitution update', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-constitution-edit-'))
    await setupProject(tmpDir)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('detects existing constitution and switches to edit mode', async () => {
    // Pre-create a constitution
    const initial = [
      '# Project Constitution — TestProject',
      '',
      '## Immutable Principles',
      '',
      '### Coding Standards',
      '- Old standard',
      '',
      '### Compliance Requirements',
      'None',
      '',
      '### Architectural Constraints',
      '- Layered',
      '',
      '### Quality Gates',
      '- 80%',
      '',
      '## Domain-Specific Rules',
      'N/A',
      '',
      '## Version History',
      '| Date | Change | Reason |',
      '|------|--------|--------|',
      '| 2026-03-14 | Initial creation | Project setup |',
      '',
    ].join('\n')

    await saveConstitution(tmpDir, initial)

    const clack = await import('@clack/prompts')
    // Edit mode: first confirm is consent (true), then selects section, edits, then declines more edits
    vi.mocked(clack.confirm)
      .mockResolvedValueOnce(true)  // consent granted
      .mockResolvedValueOnce(false) // no more edits
    vi.mocked(clack.select).mockResolvedValueOnce('coding_standards')
    vi.mocked(clack.text).mockResolvedValueOnce('- New strict standard')

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const { handler } = await import('../../../src/commands/constitution/handler.js')
    const result = await handler.run([])
    expect(result.ok).toBe(true)

    // File should still exist and be updated
    const loadResult = await loadConstitution(tmpDir)
    expect(loadResult.ok).toBe(true)
    if (loadResult.ok) {
      expect(loadResult.value).toContain('New strict standard')
    }
  })
})

// ---------------------------------------------------------------------------
// AC-3: Task payload injection
// ---------------------------------------------------------------------------

describe('AC-3: Constitution path in task payload', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-constitution-payload-'))
    await setupProject(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('includes constitutionPath in task payload when constitution exists', async () => {
    const constitutionPath = join(tmpDir, '.buildpact', 'constitution.md')
    await saveConstitution(tmpDir, '# Constitution\n\n## Coding Standards\n- TypeScript\n')

    const payload = buildTaskPayload({
      type: 'specify',
      content: 'Build a user authentication system',
      constitutionPath,
    })

    expect(payload.constitutionPath).toBe(constitutionPath)
    expect(payload.taskId).toBeDefined()
    expect(payload.type).toBe('specify')
  })

  it('omits constitutionPath from payload when constitution does not exist', async () => {
    const payload = buildTaskPayload({
      type: 'plan',
      content: 'Plan the database schema',
      // No constitutionPath
    })

    expect(payload.constitutionPath).toBeUndefined()
  })

  it('payload with constitutionPath passes size validation (NFR-02)', async () => {
    const { validatePayloadSize } = await import('../../../src/engine/subagent.js')
    const constitutionPath = join(tmpDir, '.buildpact', 'constitution.md')
    await saveConstitution(tmpDir, '# Constitution\n- Rules here\n')

    const payload = buildTaskPayload({
      type: 'execute',
      content: 'Execute the plan',
      context: 'Some minimal context',
      constitutionPath,
    })

    const validation = validatePayloadSize(payload)
    expect(validation.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Story 2.2 — AC-1: Constitution enforcement on pipeline output
// ---------------------------------------------------------------------------

describe('AC-1 (2.2): Pipeline enforcement — constitution present → enforcement called → violation shown', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-enforce-flow-'))
    await setupProject(tmpDir)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  const ENFORCING_CONSTITUTION = [
    '# Project Constitution — TestProject',
    '',
    '## Immutable Principles',
    '',
    '### Coding Standards',
    '- Use TypeScript strict mode',
    '',
    '### Architectural Constraints',
    '- No circular dependencies',
    '- Never use global state',
    '',
    '### Quality Gates',
    '- All tests must pass before merging',
    '',
    '## Domain-Specific Rules',
    '- Do not expose internal APIs publicly',
    '',
    '## Version History',
    '| Date | Change | Reason |',
    '|------|--------|--------|',
    '| 2026-03-16 | Initial creation | Project setup |',
    '',
  ].join('\n')

  it('enforceConstitutionOnOutput returns violations when pipeline output violates constitution', async () => {
    await saveConstitution(tmpDir, ENFORCING_CONSTITUTION)

    const violatingOutput = 'This module introduces circular dependencies between service A and service B.'
    const result = await enforceConstitutionOnOutput(violatingOutput, tmpDir)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.hasViolations).toBe(true)
      expect(result.value.violations.length).toBeGreaterThan(0)
      expect(result.value.violations[0].principle.section).toBe('Architectural Constraints')
    }
  })

  it('enforceConstitutionOnOutput returns clean result when output is compliant', async () => {
    await saveConstitution(tmpDir, ENFORCING_CONSTITUTION)

    const compliantOutput = 'Added new API endpoint with proper auth middleware and unit tests.'
    const result = await enforceConstitutionOnOutput(compliantOutput, tmpDir)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.hasViolations).toBe(false)
      expect(result.value.violations).toHaveLength(0)
    }
  })

  it('enforceConstitutionOnOutput returns violations in result (rendering is command-layer responsibility)', async () => {
    await saveConstitution(tmpDir, ENFORCING_CONSTITUTION)

    const result = await enforceConstitutionOnOutput('Use global state for session caching.', tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.hasViolations).toBe(true)
      expect(result.value.violations.length).toBeGreaterThan(0)
    }
  })

  it('enforceConstitution detects multiple violations in single output', async () => {
    const result = enforceConstitution(
      'We will use global state and expose internal APIs publicly for debugging.',
      ENFORCING_CONSTITUTION,
    )
    expect(result.hasViolations).toBe(true)
    expect(result.violations.length).toBeGreaterThanOrEqual(2)
  })

  it('parseConstitutionPrinciples extracts principles with section references', async () => {
    const principles = parseConstitutionPrinciples(ENFORCING_CONSTITUTION)
    expect(principles.length).toBeGreaterThan(0)

    // Each principle has name, section, content
    for (const p of principles) {
      expect(p.name).toBeTruthy()
      expect(p.section).toBeTruthy()
      expect(p.content).toBeTruthy()
    }

    // Should find rules across multiple sections
    const sections = [...new Set(principles.map(p => p.section))]
    expect(sections.length).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// Story 2.2 — AC-4: Experience-level-aware violation messages
// ---------------------------------------------------------------------------

describe('AC-4 (2.2): Beginner vs Expert violation messages', () => {
  const violation = {
    principle: {
      name: 'No circular dependencies',
      section: 'Architectural Constraints',
      content: 'No circular dependencies',
    },
    explanation: 'Output introduces circular dependencies',
    severity: 'warn' as const,
  }

  it('experience_level: beginner → plain language warning without jargon', () => {
    const warning = formatViolationWarning(violation, true)
    // Beginner mode: plain language, mentions the rule, says "review"
    expect(warning.toLowerCase()).toContain('review')
    expect(warning).toContain('No circular dependencies')
    // Should NOT use bracket notation
    expect(warning).not.toContain('[Architectural Constraints]')
  })

  it('experience_level: expert → technical warning with principle name', () => {
    const warning = formatViolationWarning(violation, false)
    // Expert mode: includes the principle name
    expect(warning).toContain('No circular dependencies')
    // Uses more technical format
    expect(warning.toLowerCase()).toContain('constitution violation')
  })

  it('beginner mode with i18n uses localized keys', () => {
    const i18n = createI18n('en')
    const warning = formatViolationWarning(violation, true, i18n)
    // Should use the i18n beginner keys
    expect(warning).toContain("Your project rules say this isn't allowed")
    expect(warning).toContain('No circular dependencies')
    expect(warning).toContain('Look at what was created')
  })

  it('expert mode with i18n uses localized keys', () => {
    const i18n = createI18n('en')
    const warning = formatViolationWarning(violation, false, i18n)
    expect(warning).toContain('Constitution violation detected: No circular dependencies')
    expect(warning).toContain('Architectural Constraints')
    expect(warning).toContain('Review output and update Constitution')
  })

  it('PT-BR beginner mode uses Portuguese localized keys', () => {
    const i18n = createI18n('pt-br')
    const warning = formatViolationWarning(violation, true, i18n)
    expect(warning).toContain('regras do seu projeto')
    expect(warning).toContain('No circular dependencies')
  })

  it('PT-BR expert mode uses Portuguese localized keys', () => {
    const i18n = createI18n('pt-br')
    const warning = formatViolationWarning(violation, false, i18n)
    expect(warning).toContain('Violação da Constituição detectada')
    expect(warning).toContain('Architectural Constraints')
  })
})

// ---------------------------------------------------------------------------
// Story 2.2 — Bilingual i18n keys for enforcement
// ---------------------------------------------------------------------------

describe('Story 2.2 enforcement i18n keys', () => {
  const ENFORCEMENT_KEYS = [
    'cli.constitution.violation.title_expert',
    'cli.constitution.violation.title_beginner',
    'cli.constitution.violation.explanation_expert',
    'cli.constitution.violation.explanation_beginner',
    'cli.constitution.violation.action_expert',
    'cli.constitution.violation.action_beginner',
    'cli.constitution.violation.modification_blocked',
  ]

  it('EN enforcement keys resolve', () => {
    const i18n = createI18n('en')
    for (const key of ENFORCEMENT_KEYS) {
      const value = i18n.t(key, { principle: 'Test', section: 'Test', principle_simple: 'Test' })
      expect(value, `EN key "${key}" should resolve`).not.toMatch(/^\[CLI_/)
    }
  })

  it('PT-BR enforcement keys resolve', () => {
    const i18n = createI18n('pt-br')
    for (const key of ENFORCEMENT_KEYS) {
      const value = i18n.t(key, { principle: 'Test', section: 'Test', principle_simple: 'Test' })
      expect(value, `PT-BR key "${key}" should resolve`).not.toMatch(/^\[CLI_/)
    }
  })
})

// ---------------------------------------------------------------------------
// Bilingual support verification (Story 2.1)
// ---------------------------------------------------------------------------

describe('Bilingual output verification', () => {
  const CONSTITUTION_KEYS = [
    'cli.constitution.welcome',
    'cli.constitution.section_coding',
    'cli.constitution.section_compliance',
    'cli.constitution.section_architecture',
    'cli.constitution.section_quality',
    'cli.constitution.section_domain',
    'cli.constitution.edit_prompt',
    'cli.constitution.saved',
    'cli.constitution.no_changes',
  ]

  it('EN i18n keys resolve without placeholders', async () => {
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('en')
    for (const key of CONSTITUTION_KEYS) {
      const value = i18n.t(key)
      expect(value, `EN key "${key}" should resolve`).not.toMatch(/^\[CLI_CONSTITUTION_/)
    }
  })

  it('PT-BR i18n keys resolve without placeholders', async () => {
    const { createI18n } = await import('../../../src/foundation/i18n.js')
    const i18n = createI18n('pt-br')
    for (const key of CONSTITUTION_KEYS) {
      const value = i18n.t(key)
      expect(value, `PT-BR key "${key}" should resolve`).not.toMatch(/^\[CLI_CONSTITUTION_/)
    }
  })
})
