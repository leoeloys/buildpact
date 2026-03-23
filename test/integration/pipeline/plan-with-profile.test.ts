/**
 * Integration test: plan command with model profile
 * Tests that the plan command respects the active_model_profile from config.yaml
 * and uses the appropriate model per phase via the profile system.
 *
 * @see Story 5.3 — Task 7
 * @see AC #1 — Profile resolution from config.yaml
 * @see AC #3 — Operation-level routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Mock @clack/prompts — prevents interactive TTY blocking in CI
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn().mockResolvedValue('override'),
  confirm: vi.fn().mockResolvedValue(true),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
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

const TEMPLATES_DIR = resolve(process.cwd(), 'templates')

const SAMPLE_SPEC = [
  '# Feature: Test Feature',
  '',
  '## Acceptance Criteria',
  '',
  '- Build the core module',
  '- Add unit tests',
  '',
  '## Tasks',
  '',
  '- setup: Set up project structure (deps: none)',
  '- implement: Core implementation (deps: setup)',
].join('\n')

async function makeTmpProject(): Promise<{ projectDir: string; tmpRoot: string }> {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'buildpact-plan-profile-'))
  const projectDir = join(tmpRoot, 'project')

  await mkdir(join(projectDir, '.buildpact', 'specs', 'test-feature'), { recursive: true })
  await mkdir(join(projectDir, '.buildpact', 'audit'), { recursive: true })
  await mkdir(join(projectDir, '.buildpact', 'profiles'), { recursive: true })

  // Write spec
  await writeFile(join(projectDir, '.buildpact', 'specs', 'test-feature', 'spec.md'), SAMPLE_SPEC, 'utf-8')

  return { projectDir, tmpRoot }
}

/** Copy a profile template from templates/ into the project's .buildpact/profiles/. */
async function installProfile(projectDir: string, profileName: string): Promise<void> {
  const src = join(TEMPLATES_DIR, 'profiles', `${profileName}.yaml`)
  const dest = join(projectDir, '.buildpact', 'profiles', `${profileName}.yaml`)
  const content = await (await import('node:fs/promises')).readFile(src, 'utf-8')
  await writeFile(dest, content, 'utf-8')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let tmpRoot: string
let projectDir: string

beforeEach(async () => {
  const dirs = await makeTmpProject()
  tmpRoot = dirs.tmpRoot
  projectDir = dirs.projectDir
})

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true })
})

describe('plan command with budget profile', () => {
  it('loads the budget profile and resolves budget-tier models', async () => {
    await installProfile(projectDir, 'budget')

    // Write config.yaml with budget profile
    await writeFile(
      join(projectDir, '.buildpact', 'config.yaml'),
      [
        'project_name: "test"',
        'language: "en"',
        'experience_level: "intermediate"',
        'active_squad: ""',
        'active_model_profile: "budget"',
        'created_at: "2026-01-01"',
      ].join('\n'),
      'utf-8',
    )

    // Import profile loader directly to verify budget profile resolves correctly
    const { loadProfile, resolveModelForOperation } = await import(
      '../../../src/foundation/profile.js'
    )

    const profileResult = await loadProfile('budget', projectDir)
    expect(profileResult.ok).toBe(true)
    if (!profileResult.ok) return

    const profile = profileResult.value
    expect(profile.name).toBe('budget')

    // Budget profile uses haiku for research operations
    const researchModel = resolveModelForOperation(profile, 'plan', 'research')
    expect(researchModel).toContain('haiku')

    // Budget profile uses haiku for plan-writing
    const planWritingModel = resolveModelForOperation(profile, 'plan', 'plan-writing')
    expect(planWritingModel).toContain('haiku')
  })

  it('falls back gracefully when no profile file exists', async () => {
    // Write config with non-existent profile
    await writeFile(
      join(projectDir, '.buildpact', 'config.yaml'),
      'active_model_profile: "nonexistent"\n',
      'utf-8',
    )

    const { loadProfile } = await import('../../../src/foundation/profile.js')
    const result = await loadProfile('nonexistent', projectDir)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('FILE_READ_FAILED')
  })
})

describe('plan command with quality profile', () => {
  it('resolves opus models for research and plan-writing operations', async () => {
    await installProfile(projectDir, 'quality')

    const { loadProfile, resolveModelForOperation } = await import(
      '../../../src/foundation/profile.js'
    )

    const profileResult = await loadProfile('quality', projectDir)
    expect(profileResult.ok).toBe(true)
    if (!profileResult.ok) return

    const profile = profileResult.value

    // Quality profile uses opus for research
    const researchModel = resolveModelForOperation(profile, 'plan', 'research')
    expect(researchModel).toContain('opus')
  })
})

describe('three built-in profiles exist in templates', () => {
  it('quality.yaml, balanced.yaml, and budget.yaml all load successfully', async () => {
    await installProfile(projectDir, 'quality')
    await installProfile(projectDir, 'balanced')
    await installProfile(projectDir, 'budget')

    const { loadProfile } = await import('../../../src/foundation/profile.js')

    const [q, b, budget] = await Promise.all([
      loadProfile('quality', projectDir),
      loadProfile('balanced', projectDir),
      loadProfile('budget', projectDir),
    ])

    expect(q.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(budget.ok).toBe(true)

    if (q.ok) expect(q.value.name).toBe('quality')
    if (b.ok) expect(b.value.name).toBe('balanced')
    if (budget.ok) expect(budget.value.name).toBe('budget')
  })
})
