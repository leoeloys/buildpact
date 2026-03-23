import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadOrgConstitution,
  mergeConstitutions,
  detectConflicts,
} from '../../../src/engine/org-constitution.js'

// ---------------------------------------------------------------------------
// loadOrgConstitution
// ---------------------------------------------------------------------------

describe('loadOrgConstitution', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-org-const-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns null when no org constitution exists', async () => {
    const result = await loadOrgConstitution(tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBeNull()
  })

  it('finds constitution in the start directory', async () => {
    const orgDir = join(tmpDir, '.buildpact-org')
    await mkdir(orgDir, { recursive: true })
    await writeFile(join(orgDir, 'constitution.md'), '# Org Constitution\n- Rule one\n')

    const result = await loadOrgConstitution(tmpDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('Org Constitution')
    }
  })

  it('searches upward for constitution in parent directory', async () => {
    // Create constitution in the parent
    const orgDir = join(tmpDir, '.buildpact-org')
    await mkdir(orgDir, { recursive: true })
    await writeFile(join(orgDir, 'constitution.md'), '# Parent Org Rules\n- No secrets in code\n')

    // Search from a child directory
    const childDir = join(tmpDir, 'projects', 'my-app')
    await mkdir(childDir, { recursive: true })

    const result = await loadOrgConstitution(childDir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('Parent Org Rules')
    }
  })
})

// ---------------------------------------------------------------------------
// mergeConstitutions
// ---------------------------------------------------------------------------

describe('mergeConstitutions', () => {
  it('includes both org and project rules', () => {
    const merged = mergeConstitutions(
      '- All code must be reviewed',
      '- Tests are mandatory',
    )
    expect(merged).toContain('All code must be reviewed')
    expect(merged).toContain('Tests are mandatory')
    expect(merged).toContain('Organization Constitution')
    expect(merged).toContain('Project Constitution')
  })

  it('marks conflicting project rules as overridden', () => {
    const org = '- Security audits must run weekly'
    const project = '- Security audits must run monthly'
    const merged = mergeConstitutions(org, project)
    expect(merged).toContain('OVERRIDDEN BY ORG')
  })
})

// ---------------------------------------------------------------------------
// detectConflicts
// ---------------------------------------------------------------------------

describe('detectConflicts', () => {
  it('detects no conflicts when rules do not overlap', () => {
    const orgRules = '- Code reviews required\n- CI must pass'
    const projectRules = '- Tests are mandatory\n- Docs must be updated'
    expect(detectConflicts(orgRules, projectRules)).toEqual([])
  })

  it('detects conflict when project overrides org rule', () => {
    const orgRules = '- Security audits must run weekly'
    const projectRules = '- Security audits must run monthly'
    const conflicts = detectConflicts(orgRules, projectRules)
    expect(conflicts.length).toBe(1)
    expect(conflicts[0]).toContain('monthly')
  })
})
