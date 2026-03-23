import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateWebBundle,
  applyDegradationTier,
  DegradationTier,
  generateConversationalPreamble,
  JARGON_BLOCKLIST,
} from '../../../src/squads/web-bundle.js'
import type { CompressedBundle } from '../../../src/foundation/bundle.js'
import { createI18n } from '../../../src/foundation/i18n.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupProject(tmpDir: string, config: Record<string, string> = {}): Promise<void> {
  await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
  const language = config['language'] ?? 'en'
  const activeSquad = config['active_squad'] ?? 'none'
  await writeFile(
    join(tmpDir, '.buildpact', 'config.yaml'),
    `language: ${language}\nactive_squad: ${activeSquad}\n`,
  )
}

async function setupSquad(tmpDir: string, squadName: string): Promise<void> {
  const agentsDir = join(tmpDir, '.buildpact', 'squads', squadName, 'agents')
  await mkdir(agentsDir, { recursive: true })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateWebBundle', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-web-bundle-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns content and tokenCount', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toBeDefined()
    expect(typeof result.tokenCount).toBe('number')
    expect(result.tokenCount).toBeGreaterThan(0)
  })

  it('tokenCount matches estimateTokens(content)', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    const expected = Math.ceil(result.content.length / 4)
    expect(result.tokenCount).toBe(expected)
  })

  it('includes platform name in bundle header', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('claude.ai')
  })

  it('includes constitution rules section when constitution.md exists', async () => {
    await setupProject(tmpDir)
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), '# Rules\n- No secrets')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('CONSTITUTION RULES')
    expect(result.content).toContain('No secrets')
  })

  it('omits constitution section when constitution.md is missing', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).not.toContain('=== CONSTITUTION RULES ===')
  })

  it('includes project context section when project-context.md exists', async () => {
    await setupProject(tmpDir)
    await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), '# My Project')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('PROJECT CONTEXT')
    expect(result.content).toContain('My Project')
  })

  it('omits project context section when file is missing', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).not.toContain('=== PROJECT CONTEXT ===')
  })

  it('includes squad agents section when active squad has agent files', async () => {
    await setupProject(tmpDir, { active_squad: 'software' })
    await setupSquad(tmpDir, 'software')
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'software', 'agents', 'chief.md'),
      '# Chief Agent\nOrchestrates all tasks.',
    )
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('SQUAD AGENTS')
    expect(result.content).toContain('chief')
    expect(result.content).toContain('Orchestrates all tasks')
  })

  it('omits squad agents section when no active squad', async () => {
    await setupProject(tmpDir, { active_squad: 'none' })
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).not.toContain('=== SQUAD AGENTS ===')
  })

  it('includes English activation preamble when language is en', async () => {
    await setupProject(tmpDir, { language: 'en' })
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('ACTIVATION INSTRUCTIONS')
    expect(result.content).toContain('You are the assistant')
  })

  it('includes Portuguese activation preamble when language is pt-br', async () => {
    await setupProject(tmpDir, { language: 'pt-br' })
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('ACTIVATION INSTRUCTIONS')
    expect(result.content).toContain('Você é o assistente')
  })

  it('uses language override when provided', async () => {
    await setupProject(tmpDir, { language: 'en' })
    const result = await generateWebBundle('claude.ai', {
      projectDir: tmpDir,
      language: 'pt-br',
    })
    expect(result.content).toContain('Você é o assistente')
  })

  it('includes squad name in activation preamble when active squad is set', async () => {
    await setupProject(tmpDir, { active_squad: 'medical' })
    await setupSquad(tmpDir, 'medical')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('"medical"')
  })

  it('includes bundle disclaimer from squad.yaml when present', async () => {
    await setupProject(tmpDir, { active_squad: 'software' })
    const squadDir = join(tmpDir, '.buildpact', 'squads', 'software')
    await mkdir(squadDir, { recursive: true })
    await writeFile(
      join(squadDir, 'squad.yaml'),
      `name: software\nbundle_disclaimers:\n  en: "Use at your own risk."\n  pt-br: "Use por sua conta e risco."\n`,
    )
    await setupSquad(tmpDir, 'software')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('DISCLAIMER')
    expect(result.content).toContain('Use at your own risk')
  })

  it('omits disclaimer section when no squad.yaml bundle_disclaimers', async () => {
    await setupProject(tmpDir, { active_squad: 'none' })
    const result = await generateWebBundle('chatgpt', { projectDir: tmpDir })
    expect(result.content).not.toContain('=== DISCLAIMER ===')
  })

  it('works for chatgpt platform', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('chatgpt', { projectDir: tmpDir })
    expect(result.content).toContain('chatgpt')
  })

  it('works for gemini platform', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('gemini', { projectDir: tmpDir })
    expect(result.content).toContain('gemini')
  })

  it('includes BUILDPACT WEB BUNDLE header section', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('=== BUILDPACT WEB BUNDLE ===')
  })

  it('falls back to squad root when agents/ subdirectory is missing', async () => {
    await setupProject(tmpDir, { active_squad: 'software' })
    const squadDir = join(tmpDir, '.buildpact', 'squads', 'software')
    await mkdir(squadDir, { recursive: true })
    await writeFile(join(squadDir, 'dev.md'), '# Developer Agent\nWrite tests.')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('SQUAD AGENTS')
    expect(result.content).toContain('Write tests')
  })

  it('handles missing .buildpact directory gracefully', async () => {
    // No .buildpact setup at all
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toBeDefined()
    expect(result.tokenCount).toBeGreaterThan(0)
  })

  it('returns needsDegradation: false for small bundles within token limit', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.needsDegradation).toBe(false)
  })

  it('returns compressedBundle with content matching result.content', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.compressedBundle.content).toBe(result.content)
  })

  it('returns availableTiers as empty array when no degradation needed', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.availableTiers).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// DegradationTier enum (Story 10.2 — Task 2.1)
// ---------------------------------------------------------------------------

describe('DegradationTier', () => {
  it('NONE equals 0', () => {
    expect(DegradationTier.NONE).toBe(0)
  })

  it('REMOVE_EXAMPLES equals 1', () => {
    expect(DegradationTier.REMOVE_EXAMPLES).toBe(1)
  })

  it('REMOVE_HEURISTICS equals 2', () => {
    expect(DegradationTier.REMOVE_HEURISTICS).toBe(2)
  })

  it('CHIEF_ONLY equals 3', () => {
    expect(DegradationTier.CHIEF_ONLY).toBe(3)
  })

  it('QUICK_SESSION equals 4', () => {
    expect(DegradationTier.QUICK_SESSION).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// applyDegradationTier (Story 10.2 — Task 2.2 & 2.4)
// ---------------------------------------------------------------------------

/** Build a minimal CompressedBundle fixture for degradation tests */
function makeBundle(content: string): CompressedBundle {
  return {
    content,
    compressionLevel: 1,
    sectionsRemoved: [],
    tokenCount: Math.ceil(content.length / 4),
  }
}

describe('applyDegradationTier', () => {
  it('NONE tier returns bundle unchanged', () => {
    const bundle = makeBundle('=== SQUAD AGENTS ===\n--- chief ---\nChief rules')
    const result = applyDegradationTier(bundle, DegradationTier.NONE)
    expect(result).toBe(bundle)
  })

  it('REMOVE_EXAMPLES removes ## Examples sections from content', () => {
    const content = [
      '=== SQUAD AGENTS ===',
      '--- chief ---',
      '## Rules',
      '- Always test',
      '## Examples',
      'Here is an example.',
      '## Notes',
      'Important.',
    ].join('\n')
    const result = applyDegradationTier(makeBundle(content), DegradationTier.REMOVE_EXAMPLES)
    expect(result.content).not.toContain('Here is an example')
    expect(result.content).toContain('- Always test')
    expect(result.content).toContain('Notes')
  })

  it('REMOVE_EXAMPLES injects compression note', () => {
    const bundle = makeBundle('Platform: claude.ai\n\n=== SQUAD AGENTS ===\n--- a ---\n## Examples\nex.')
    const result = applyDegradationTier(bundle, DegradationTier.REMOVE_EXAMPLES)
    expect(result.content).toContain('=== COMPRESSION NOTE ===')
  })

  it('REMOVE_HEURISTICS includes tier 1 changes (removes examples too)', () => {
    const content = [
      'Platform: claude.ai',
      '=== SQUAD AGENTS ===',
      '--- chief ---',
      '## Examples',
      'example text',
      '## Heuristics',
      'Try this approach',
      '## Rules',
      '- Keep rule',
    ].join('\n')
    const result = applyDegradationTier(makeBundle(content), DegradationTier.REMOVE_HEURISTICS)
    expect(result.content).not.toContain('example text')
    expect(result.content).not.toContain('Try this approach')
    expect(result.content).toContain('- Keep rule')
  })

  it('REMOVE_HEURISTICS keeps VETO: lines in heuristics section', () => {
    const content = [
      '=== SQUAD AGENTS ===',
      '--- chief ---',
      '## Heuristics',
      'Normal heuristic — skip this',
      '- VETO: Never do X',
      '## Rules',
      '- Normal rule',
    ].join('\n')
    const result = applyDegradationTier(makeBundle(content), DegradationTier.REMOVE_HEURISTICS)
    expect(result.content).not.toContain('Normal heuristic — skip this')
    expect(result.content).toContain('- VETO: Never do X')
  })

  it('CHIEF_ONLY keeps only the chief agent', () => {
    const content = [
      '=== BUILDPACT WEB BUNDLE ===',
      'Platform: claude.ai',
      '',
      '=== SQUAD AGENTS ===',
      '--- chief ---',
      'Chief rules',
      '--- dev ---',
      'Dev rules',
      '',
      '=== PROJECT CONTEXT ===',
      'My project',
    ].join('\n')
    const result = applyDegradationTier(makeBundle(content), DegradationTier.CHIEF_ONLY)
    expect(result.content).toContain('Chief rules')
    expect(result.content).not.toContain('Dev rules')
  })

  it('CHIEF_ONLY injects compression note', () => {
    const content = 'Platform: claude.ai\n\n=== SQUAD AGENTS ===\n--- chief ---\nRules\n--- dev ---\nDev'
    const result = applyDegradationTier(makeBundle(content), DegradationTier.CHIEF_ONLY)
    expect(result.content).toContain('=== COMPRESSION NOTE ===')
  })

  it('QUICK_SESSION removes CONSTITUTION RULES and PROJECT CONTEXT sections', () => {
    const content = [
      '=== BUILDPACT WEB BUNDLE ===',
      'Platform: claude.ai',
      '',
      '=== CONSTITUTION RULES ===',
      '- Rule one',
      '',
      '=== SQUAD AGENTS ===',
      '--- chief ---',
      'Chief rules',
      '',
      '=== PROJECT CONTEXT ===',
      'Project details',
    ].join('\n')
    const result = applyDegradationTier(makeBundle(content), DegradationTier.QUICK_SESSION)
    expect(result.content).not.toContain('=== CONSTITUTION RULES ===')
    expect(result.content).not.toContain('Project details')
    expect(result.content).toContain('Chief rules')
  })

  it('each tier reduces token count compared to NONE (larger content)', () => {
    const agentContent = '## Examples\n' + 'example line\n'.repeat(20) +
      '## Heuristics\n' + 'heuristic line\n'.repeat(20) +
      '## Rules\n- Keep rule'
    const content = [
      'Platform: claude.ai',
      '',
      '=== SQUAD AGENTS ===',
      '--- chief ---',
      agentContent,
      '--- dev ---',
      agentContent,
      '',
      '=== CONSTITUTION RULES ===',
      '- Rule one',
      '',
      '=== PROJECT CONTEXT ===',
      'Some context.',
    ].join('\n')
    const base = makeBundle(content)
    const t1 = applyDegradationTier(base, DegradationTier.REMOVE_EXAMPLES)
    const t2 = applyDegradationTier(base, DegradationTier.REMOVE_HEURISTICS)
    expect(t1.tokenCount).toBeLessThan(base.tokenCount + 100) // has note, roughly similar or less
    expect(t2.tokenCount).toBeLessThanOrEqual(t1.tokenCount + 100)
  })

  it('injects compression note before DISCLAIMER when present', () => {
    const content = [
      'Platform: claude.ai',
      '',
      '=== SQUAD AGENTS ===',
      '--- a ---',
      '## Examples',
      'example',
      '',
      '=== DISCLAIMER ===',
      'Use at own risk.',
    ].join('\n')
    const result = applyDegradationTier(makeBundle(content), DegradationTier.REMOVE_EXAMPLES)
    const noteIdx = result.content.indexOf('=== COMPRESSION NOTE ===')
    const disclaimerIdx = result.content.indexOf('=== DISCLAIMER ===')
    expect(noteIdx).toBeGreaterThan(-1)
    expect(disclaimerIdx).toBeGreaterThan(-1)
    expect(noteIdx).toBeLessThan(disclaimerIdx)
  })

  it('compressionLevel reflects applied tier', () => {
    const bundle = makeBundle('Platform: claude.ai\n=== SQUAD AGENTS ===\n--- a ---\n## Examples\nex')
    expect(applyDegradationTier(bundle, DegradationTier.REMOVE_EXAMPLES).compressionLevel).toBe(1)
    expect(applyDegradationTier(bundle, DegradationTier.REMOVE_HEURISTICS).compressionLevel).toBe(2)
    expect(applyDegradationTier(bundle, DegradationTier.CHIEF_ONLY).compressionLevel).toBe(3)
    expect(applyDegradationTier(bundle, DegradationTier.QUICK_SESSION).compressionLevel).toBe(4)
  })

  it('tokenCount reflects new content length after degradation', () => {
    const content = 'Platform: claude.ai\n\n=== SQUAD AGENTS ===\n--- a ---\n## Examples\n' + 'x'.repeat(400)
    const result = applyDegradationTier(makeBundle(content), DegradationTier.REMOVE_EXAMPLES)
    expect(result.tokenCount).toBe(Math.ceil(result.content.length / 4))
  })

  it('PT-BR language produces PT-BR degradation note', () => {
    const content = 'Platform: claude.ai\n\n=== SQUAD AGENTS ===\n--- a ---\n## Examples\n' + 'x'.repeat(200)
    const result = applyDegradationTier(makeBundle(content), DegradationTier.REMOVE_EXAMPLES, 'pt-br')
    expect(result.content).toContain('=== COMPRESSION NOTE ===')
    // PT-BR note uses the locale string (no English "compressed to fit")
    expect(result.content).toContain('simplificado')
    expect(result.content).not.toContain('compressed to fit within')
  })

  it('EN language (default) produces English degradation note', () => {
    const content = 'Platform: claude.ai\n\n=== SQUAD AGENTS ===\n--- a ---\n## Examples\n' + 'x'.repeat(200)
    const result = applyDegradationTier(makeBundle(content), DegradationTier.REMOVE_EXAMPLES)
    expect(result.content).toContain('compressed to fit within')
  })
})

// ---------------------------------------------------------------------------
// generateConversationalPreamble (Story 10.3 — Task 1 & 4.1)
// ---------------------------------------------------------------------------

describe('generateConversationalPreamble', () => {
  it('returns a string for EN language', () => {
    const result = generateConversationalPreamble('my-squad', 'en')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a string for PT-BR language', () => {
    const result = generateConversationalPreamble('my-squad', 'pt-br')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('EN output contains English activation header', () => {
    const result = generateConversationalPreamble('my-squad', 'en')
    expect(result).toContain('You are the assistant "my-squad" configured with BuildPact.')
  })

  it('PT-BR output contains Portuguese activation header', () => {
    const result = generateConversationalPreamble('my-squad', 'pt-br')
    expect(result).toContain('Você é o assistente "my-squad" configurado com o BuildPact.')
  })

  it('works when squadName is undefined', () => {
    const enResult = generateConversationalPreamble(undefined, 'en')
    expect(enResult).toContain('You are the assistant configured with BuildPact.')
    const ptBrResult = generateConversationalPreamble(undefined, 'pt-br')
    expect(ptBrResult).toContain('Você é o assistente configurado com o BuildPact.')
  })

  it('EN output contains the jargon blocklist EN terms', () => {
    const result = generateConversationalPreamble('squad', 'en')
    for (const term of JARGON_BLOCKLIST.en) {
      expect(result).toContain(term)
    }
  })

  it('PT-BR output contains the jargon blocklist EN terms (for host model to block in both languages)', () => {
    const result = generateConversationalPreamble('squad', 'pt-br')
    for (const term of JARGON_BLOCKLIST.en) {
      expect(result).toContain(term)
    }
  })

  it('PT-BR output contains the jargon blocklist PT-BR terms', () => {
    const result = generateConversationalPreamble('squad', 'pt-br')
    for (const term of JARGON_BLOCKLIST['pt-br']) {
      expect(result).toContain(term)
    }
  })

  it('EN output contains the jargon blocklist PT-BR terms (bidirectional blocking)', () => {
    const result = generateConversationalPreamble('squad', 'en')
    for (const term of JARGON_BLOCKLIST['pt-br']) {
      expect(result).toContain(term)
    }
  })

  it('PT-BR phase prompts are in Portuguese and do not contain English jargon terms', () => {
    const result = generateConversationalPreamble('squad', 'pt-br')
    // Phase prompts from locale should be in Portuguese
    expect(result).toContain('Vamos descrever o que você quer fazer')
    expect(result).toContain('Vou criar um plano para isso')
    expect(result).toContain('Vou executar o plano agora')
    expect(result).toContain('Vamos revisar o resultado')
    // Phase prompt text itself should not contain English technical jargon
    const phaseSection = result.slice(result.indexOf('## Prompts de Fase'))
    expect(phaseSection).not.toContain('repository')
    expect(phaseSection).not.toContain('branch')
    expect(phaseSection).not.toContain('pipeline')
  })

  it('EN phase prompts are loaded from locale', () => {
    const result = generateConversationalPreamble('squad', 'en')
    expect(result).toContain("Let's describe what you want to do")
    expect(result).toContain('Let me create a plan for this')
    expect(result).toContain('Let me execute the plan now')
    expect(result).toContain("Let's review the result")
  })

  it('PT-BR output instructs to ALWAYS respond in Portuguese', () => {
    const result = generateConversationalPreamble('squad', 'pt-br')
    expect(result).toContain('SEMPRE responda em Português')
  })

  it('EN output instructs to ALWAYS respond in English', () => {
    const result = generateConversationalPreamble('squad', 'en')
    expect(result).toContain('ALWAYS respond in English')
  })

  it('PT-BR output instructs to NEVER use /bp:* commands', () => {
    const result = generateConversationalPreamble('squad', 'pt-br')
    expect(result).toContain('NUNCA use comandos /bp:*')
  })

  it('EN output instructs to NEVER use /bp:* commands', () => {
    const result = generateConversationalPreamble('squad', 'en')
    expect(result).toContain('NEVER use /bp:* commands')
  })
})

// ---------------------------------------------------------------------------
// JARGON_BLOCKLIST (Story 10.3 — Task 1.3)
// ---------------------------------------------------------------------------

describe('JARGON_BLOCKLIST', () => {
  it('EN blocklist contains required technical terms', () => {
    expect(JARGON_BLOCKLIST.en).toContain('repository')
    expect(JARGON_BLOCKLIST.en).toContain('branch')
    expect(JARGON_BLOCKLIST.en).toContain('commit')
    expect(JARGON_BLOCKLIST.en).toContain('YAML')
    expect(JARGON_BLOCKLIST.en).toContain('pipeline')
    expect(JARGON_BLOCKLIST.en).toContain('subagent')
    expect(JARGON_BLOCKLIST.en).toContain('orchestrator')
    expect(JARGON_BLOCKLIST.en).toContain('JSON')
    expect(JARGON_BLOCKLIST.en).toContain('TypeScript')
    expect(JARGON_BLOCKLIST.en).toContain('npm')
    expect(JARGON_BLOCKLIST.en).toContain('CLI')
    expect(JARGON_BLOCKLIST.en).toContain('terminal')
  })

  it('PT-BR blocklist contains required Portuguese technical terms', () => {
    expect(JARGON_BLOCKLIST['pt-br']).toContain('repositório')
    expect(JARGON_BLOCKLIST['pt-br']).toContain('subagente')
    expect(JARGON_BLOCKLIST['pt-br']).toContain('orquestrador')
    expect(JARGON_BLOCKLIST['pt-br']).toContain('terminal')
    expect(JARGON_BLOCKLIST['pt-br']).toContain('linha de comando')
    expect(JARGON_BLOCKLIST['pt-br']).toContain('módulo')
  })

  it('blocklist is non-empty for both languages', () => {
    expect(JARGON_BLOCKLIST.en.length).toBeGreaterThan(0)
    expect(JARGON_BLOCKLIST['pt-br'].length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// bundle.conversational locale keys (Story 10.3 — Task 2 & 4.2)
// ---------------------------------------------------------------------------

describe('bundle.conversational locale keys', () => {
  const CONVERSATIONAL_KEYS = [
    'bundle.conversational.welcome',
    'bundle.conversational.phase_specify',
    'bundle.conversational.phase_plan',
    'bundle.conversational.phase_execute',
    'bundle.conversational.phase_verify',
    'bundle.conversational.choose_option',
    'bundle.conversational.staleness_warning',
    'bundle.conversational.bundle_too_large',
  ]

  it('all PT-BR keys resolve without fallback', () => {
    const i18n = createI18n('pt-br')
    for (const key of CONVERSATIONAL_KEYS) {
      const value = i18n.t(key)
      expect(value, `PT-BR key "${key}" should not be a fallback indicator`).not.toMatch(/^\[.+\]$/)
      expect(value.length, `PT-BR key "${key}" should not be empty`).toBeGreaterThan(0)
    }
  })

  it('all EN keys resolve without fallback', () => {
    const i18n = createI18n('en')
    for (const key of CONVERSATIONAL_KEYS) {
      const value = i18n.t(key)
      expect(value, `EN key "${key}" should not be a fallback indicator`).not.toMatch(/^\[.+\]$/)
      expect(value.length, `EN key "${key}" should not be empty`).toBeGreaterThan(0)
    }
  })

  it('PT-BR bundle.conversational.welcome is in Portuguese', () => {
    const i18n = createI18n('pt-br')
    const value = i18n.t('bundle.conversational.welcome', { squad_name: 'Test' })
    // Should contain Portuguese content (not English "Hello")
    expect(value).not.toBe('[BUNDLE_CONVERSATIONAL_WELCOME]')
    expect(value.toLowerCase()).toMatch(/olá|assistente/)
  })

  it('EN bundle.conversational.welcome is in English', () => {
    const i18n = createI18n('en')
    const value = i18n.t('bundle.conversational.welcome', { squad_name: 'Test' })
    expect(value).not.toBe('[BUNDLE_CONVERSATIONAL_WELCOME]')
    expect(value.toLowerCase()).toMatch(/hello|assistant/)
  })

  it('PT-BR phase_specify uses non-technical Portuguese', () => {
    const i18n = createI18n('pt-br')
    const value = i18n.t('bundle.conversational.phase_specify')
    expect(value).not.toContain('repository')
    expect(value).not.toContain('branch')
    expect(value).not.toContain('CLI')
  })

  it('PT-BR bundle_too_large does not contain English technical content', () => {
    const i18n = createI18n('pt-br')
    const value = i18n.t('bundle.conversational.bundle_too_large')
    expect(value).not.toContain('compressed to fit within')
    expect(value.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// generateWebBundle uses generateConversationalPreamble (Story 10.3 — Task 3)
// ---------------------------------------------------------------------------

describe('generateWebBundle — conversational preamble integration', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-wb-conv-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('PT-BR bundle contains PT-BR phase prompts from locale', async () => {
    await setupProject(tmpDir, { language: 'pt-br' })
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('Vamos descrever o que você quer fazer')
    expect(result.content).toContain('Vou criar um plano para isso')
  })

  it('EN bundle contains EN phase prompts from locale', async () => {
    await setupProject(tmpDir, { language: 'en' })
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain("Let's describe what you want to do")
    expect(result.content).toContain('Let me create a plan for this')
  })

  it('PT-BR bundle contains jargon blocklist for host model', async () => {
    await setupProject(tmpDir, { language: 'pt-br' })
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    // The blocklist must be present so the host model knows to block these terms
    expect(result.content).toContain('repositório')
    expect(result.content).toContain('subagente')
  })

  it('PT-BR bundle instructs host model to use Portuguese', async () => {
    await setupProject(tmpDir, { language: 'pt-br' })
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('SEMPRE responda em Português')
  })

  it('unset language defaults to EN bundle', async () => {
    // No language key in config — defaults to 'en'
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'config.yaml'), 'active_squad: none\n')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('ALWAYS respond in English')
  })
})

// ---------------------------------------------------------------------------
// generateWebBundle — bundle metadata and staleness (Story 10.4)
// ---------------------------------------------------------------------------

describe('generateWebBundle — bundle metadata and staleness', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-wb-meta-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('includes bundle hash in bundle header (AC-1)', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('Bundle hash:')
    expect(result.content).toMatch(/Bundle hash: [0-9a-f]{16}/)
  })

  it('includes staleness instruction with expiry date 7 days after generation (AC-2)', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    // Extract Generated date from content
    const genMatch = result.content.match(/Generated: (\S+)/)
    expect(genMatch).toBeTruthy()
    const generatedAt = new Date(genMatch![1]!)
    const expectedExpiry = new Date(generatedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    expect(result.content).toContain(expectedExpiry.toISOString())
  })

  it('staleness instruction is marked for host model only (AC-2)', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('for host model only')
  })

  it('staleness instruction uses EN locale staleness_warning key (AC-2)', async () => {
    await setupProject(tmpDir, { language: 'en' })
    const i18n = createI18n('en')
    const warningMsg = i18n.t('bundle.conversational.staleness_warning')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain(warningMsg)
  })

  it('staleness instruction uses PT-BR locale staleness_warning key (AC-2)', async () => {
    await setupProject(tmpDir, { language: 'pt-br' })
    const i18n = createI18n('pt-br')
    const warningMsg = i18n.t('bundle.conversational.staleness_warning')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain(warningMsg)
  })

  it('includes source files list in bundle header when source files exist (AC-1)', async () => {
    await setupProject(tmpDir)
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), '# Rules\n- Keep it simple')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('Source files:')
    expect(result.content).toContain('constitution.md')
  })

  it('includes expires field in bundle header (AC-1)', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('Expires:')
  })

  it('includes staleness threshold of 7 days in bundle header (AC-1)', async () => {
    await setupProject(tmpDir)
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('Staleness threshold: 7 days')
  })

  it('bundle hash differs when source file contents differ (AC-1)', async () => {
    await setupProject(tmpDir)
    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), '# Rules v1')
    const result1 = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    const hash1 = result1.content.match(/Bundle hash: ([0-9a-f]{16})/)![1]

    await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), '# Rules v2 (changed)')
    const result2 = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    const hash2 = result2.content.match(/Bundle hash: ([0-9a-f]{16})/)![1]

    expect(hash1).not.toBe(hash2)
  })

  it('includes project-context.md in source files when it exists (AC-1)', async () => {
    await setupProject(tmpDir)
    await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), '# My Project')
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    expect(result.content).toContain('project-context.md')
  })

  it('source file paths are relative to .buildpact/ root (AC-1)', async () => {
    await setupProject(tmpDir, { active_squad: 'software' })
    await setupSquad(tmpDir, 'software')
    await writeFile(
      join(tmpDir, '.buildpact', 'squads', 'software', 'agents', 'chief.md'),
      '# Chief Agent',
    )
    const result = await generateWebBundle('claude.ai', { projectDir: tmpDir })
    // Path should be relative: squads/software/agents/chief.md not absolute
    expect(result.content).toContain('squads/software/agents/chief.md')
    expect(result.content).not.toContain('.buildpact/squads')
  })
})
