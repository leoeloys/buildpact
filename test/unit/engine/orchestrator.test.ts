import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadOrchestratorTemplate, validateOrchestratorFile } from '../../../src/engine/orchestrator.js'

// Factory helpers
const makeCompliantContent = (extraLines = 0): string => {
  const base = [
    '<!-- ORCHESTRATOR: test | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->',
    '# /bp:test — Test Command',
    '',
    '> Stub for testing.',
    '',
    '## Implementation Notes',
    '<!-- For Agent Mode TypeScript wrapper only -->',
    '- Context variables parsed by: `src/commands/test/index.ts`',
  ]
  for (let i = 0; i < extraLines; i++) {
    base.push(`// extra line ${i}`)
  }
  return base.join('\n')
}

describe('loadOrchestratorTemplate', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true })
    }
  })

  it('returns content when file exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'buildpact-orch-'))
    const commandsDir = join(tempDir, 'commands')
    await mkdir(commandsDir)
    const content = makeCompliantContent()
    await writeFile(join(commandsDir, 'specify.md'), content, 'utf-8')

    const result = await loadOrchestratorTemplate('specify', tempDir)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(content)
    }
  })

  it('returns err FILE_READ_FAILED when file does not exist', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'buildpact-orch-'))
    const commandsDir = join(tempDir, 'commands')
    await mkdir(commandsDir)

    const result = await loadOrchestratorTemplate('nonexistent', tempDir)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_READ_FAILED')
      expect(result.error.i18nKey).toBe('error.engine.file_read_failed')
    }
  })

  it('returns err FILE_READ_FAILED when commands dir does not exist', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'buildpact-orch-'))

    const result = await loadOrchestratorTemplate('specify', tempDir)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_READ_FAILED')
    }
  })
})

describe('validateOrchestratorFile', () => {
  it('returns ok for fully compliant content', () => {
    const content = makeCompliantContent()
    const result = validateOrchestratorFile(content, 'test.md')
    expect(result.ok).toBe(true)
  })

  it('returns err ORCHESTRATOR_TOO_LONG for content with more than 300 lines', () => {
    // makeCompliantContent() base is 8 lines; add 293+ to exceed 300
    const content = makeCompliantContent(293) // 8 + 293 = 301 lines
    const result = validateOrchestratorFile(content, 'test.md')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ORCHESTRATOR_TOO_LONG')
      expect(result.error.params?.['path']).toBe('test.md')
      expect(result.error.params?.['max']).toBe('300')
    }
  })

  it('returns ok for content with exactly 300 lines', () => {
    // 8 base lines + 292 extra = 300 lines
    const content = makeCompliantContent(292)
    const lines = content.split('\n')
    expect(lines.length).toBe(300)

    const result = validateOrchestratorFile(content, 'test.md')
    expect(result.ok).toBe(true)
  })

  it('returns err MISSING_ORCHESTRATOR_HEADER when header comment is absent', () => {
    const content = [
      '# /bp:test — No Header',
      '',
      '## Implementation Notes',
      '- some note',
    ].join('\n')

    const result = validateOrchestratorFile(content, 'test.md')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_ORCHESTRATOR_HEADER')
      expect(result.error.params?.['path']).toBe('test.md')
    }
  })

  it('returns err MISSING_IMPLEMENTATION_NOTES when block is absent', () => {
    const content = [
      '<!-- ORCHESTRATOR: test | MAX_LINES: 300 | CONTEXT_BUDGET: 15% | VERSION: 1.0.0 -->',
      '# /bp:test — Missing Notes',
      '',
      '> No implementation notes section here.',
    ].join('\n')

    const result = validateOrchestratorFile(content, 'test.md')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_IMPLEMENTATION_NOTES')
      expect(result.error.params?.['path']).toBe('test.md')
    }
  })

  it('checks line count before header presence (line count is first check)', () => {
    // >300 lines AND no header — should get ORCHESTRATOR_TOO_LONG (first check)
    const lines = Array.from({ length: 301 }, (_, i) => `line ${i}`).join('\n')
    const result = validateOrchestratorFile(lines, 'test.md')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ORCHESTRATOR_TOO_LONG')
    }
  })
})
