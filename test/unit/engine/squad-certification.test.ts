import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  runCertification,
  formatCertificationReport,
} from '../../../src/engine/squad-certification.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LAYERS = [
  'persona',
  'expertise',
  'boundaries',
  'communication',
  'quality-standards',
  'autonomy-level',
]

const VOICE_DNA = [
  'Personality Anchors',
  'Opinion Stance',
  'Anti-Patterns',
  'Signature Phrases',
  'Tone Calibration',
]

/** Build a fully-compliant agent markdown file */
function buildCompliantAgent(name: string): string {
  const sections = LAYERS.map(l => `## ${l}\nSome content for ${l} layer.\n`)
  const voiceSections = VOICE_DNA.map(s => `### ${s}\nVoice DNA content.\n`)
  const examples = Array.from({ length: 4 }, (_, i) =>
    `Example: case ${i + 1}\n\`\`\`\ncode block ${i}\n\`\`\`\n`,
  )
  return `# Agent: ${name}\n\n${sections.join('\n')}\n${voiceSections.join('\n')}\n${examples.join('\n')}`
}

async function createCompliantSquad(baseDir: string, name: string): Promise<string> {
  const squadDir = join(baseDir, name)
  const agentsDir = join(squadDir, 'agents')
  await mkdir(agentsDir, { recursive: true })
  await writeFile(join(squadDir, 'squad.yaml'), `name: ${name}\ndomain: software\n`)
  await writeFile(join(squadDir, 'README.md'), `# ${name}\nA compliant squad.\n`)
  await writeFile(join(agentsDir, 'developer.md'), buildCompliantAgent('developer'))
  await writeFile(join(agentsDir, 'architect.md'), buildCompliantAgent('architect'))
  return squadDir
}

// ---------------------------------------------------------------------------
// runCertification
// ---------------------------------------------------------------------------

describe('runCertification', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-cert-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('passes for a fully compliant squad', async () => {
    const squadDir = await createCompliantSquad(tmpDir, 'good-squad')
    const result = await runCertification(squadDir, 'good-squad')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.passed).toBe(true)
      expect(result.value.certifiedAt).toBeDefined()
      expect(result.value.checks.every(c => c.passed)).toBe(true)
    }
  })

  it('fails when squad.yaml is missing', async () => {
    const squadDir = join(tmpDir, 'no-yaml')
    const agentsDir = join(squadDir, 'agents')
    await mkdir(agentsDir, { recursive: true })
    await writeFile(join(agentsDir, 'dev.md'), buildCompliantAgent('dev'))
    await writeFile(join(squadDir, 'README.md'), '# Squad\n')

    const result = await runCertification(squadDir, 'no-yaml')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.passed).toBe(false)
      expect(result.value.checks.find(c => c.name === 'squad.yaml exists')?.passed).toBe(false)
    }
  })

  it('fails when README is missing', async () => {
    const squadDir = join(tmpDir, 'no-readme')
    const agentsDir = join(squadDir, 'agents')
    await mkdir(agentsDir, { recursive: true })
    await writeFile(join(squadDir, 'squad.yaml'), 'name: no-readme\n')
    await writeFile(join(agentsDir, 'dev.md'), buildCompliantAgent('dev'))

    const result = await runCertification(squadDir, 'no-readme')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.passed).toBe(false)
      expect(result.value.checks.find(c => c.name === 'README exists')?.passed).toBe(false)
    }
  })

  it('fails when no agents directory exists', async () => {
    const squadDir = join(tmpDir, 'no-agents')
    await mkdir(squadDir, { recursive: true })
    await writeFile(join(squadDir, 'squad.yaml'), 'name: no-agents\n')
    await writeFile(join(squadDir, 'README.md'), '# no-agents\n')

    const result = await runCertification(squadDir, 'no-agents')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.passed).toBe(false)
    }
  })

  it('does not set certifiedAt when certification fails', async () => {
    const squadDir = join(tmpDir, 'fail-squad')
    await mkdir(squadDir, { recursive: true })
    await writeFile(join(squadDir, 'squad.yaml'), 'name: fail-squad\n')

    const result = await runCertification(squadDir, 'fail-squad')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.passed).toBe(false)
      expect(result.value.certifiedAt).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// formatCertificationReport
// ---------------------------------------------------------------------------

describe('formatCertificationReport', () => {
  it('formats a passing report', () => {
    const report = formatCertificationReport({
      squadName: 'test-squad',
      passed: true,
      checks: [
        { name: 'squad.yaml exists', passed: true, detail: 'Found squad.yaml' },
        { name: 'README exists', passed: true, detail: 'Found README.md' },
      ],
      certifiedAt: '2026-03-23T00:00:00Z',
    })
    expect(report).toContain('CERTIFIED')
    expect(report).toContain('test-squad')
    expect(report).toContain('2/2 checks passed')
  })

  it('formats a failing report', () => {
    const report = formatCertificationReport({
      squadName: 'bad-squad',
      passed: false,
      checks: [
        { name: 'squad.yaml exists', passed: true, detail: 'Found squad.yaml' },
        { name: 'README exists', passed: false, detail: 'Missing README.md' },
      ],
    })
    expect(report).toContain('NOT CERTIFIED')
    expect(report).toContain('1/2 checks passed')
  })
})
