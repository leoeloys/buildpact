/**
 * Persona D (Web User) bundle export journey test.
 * Tests the export-web flow with pre-populated pipeline artifacts.
 * NOTE: export-web command is from Epic 10 — test validates what's currently available.
 * @see Story 17.2 — AC-2: Persona D (Web User) Bundle Export Journey
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { writeFile, mkdir } from 'node:fs/promises'
import {
  createPersonaProject,
  writePersonaSpec,
  WEB_USER_FIXTURE,
} from './helpers.js'
import { fileExists, type TempProject } from '../helpers.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  group: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  log: {
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}))

vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// ---------------------------------------------------------------------------
// Persona D: Web User Journey
// ---------------------------------------------------------------------------

describe('Persona D: Web User Journey', () => {
  let project: TempProject & { fixture: typeof WEB_USER_FIXTURE }

  beforeEach(async () => {
    project = await createPersonaProject(WEB_USER_FIXTURE)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await project.cleanup()
    vi.restoreAllMocks()
  })

  it('project is initialized with software squad for web user', async () => {
    expect(await fileExists(join(project.dir, '.buildpact', 'config.yaml'))).toBe(true)
    expect(await fileExists(join(project.dir, '.buildpact', 'constitution.md'))).toBe(true)
  })

  it('pre-populated pipeline artifacts exist for export', async () => {
    // Write spec and plan artifacts that a web user would have from previous pipeline runs
    await writePersonaSpec(project.dir, 'web-bundle-export', WEB_USER_FIXTURE.specContent)

    expect(
      await fileExists(join(project.dir, '.buildpact', 'specs', 'web-bundle-export', 'spec.md')),
    ).toBe(true)
  })

  it('export-web handler can be loaded', async () => {
    // Verify the export-web handler module exists and can be imported
    const mod = await import('../../../src/commands/export-web/handler.js')
    expect(mod.handler).toBeDefined()
    expect(typeof mod.handler.run).toBe('function')
  })

  it('persona project is self-contained and cleanable', async () => {
    const dir = project.dir
    expect(await fileExists(dir)).toBe(true)
    await project.cleanup()
    expect(await fileExists(dir)).toBe(false)
    // Re-create for afterEach
    project = await createPersonaProject(WEB_USER_FIXTURE)
  })
})
