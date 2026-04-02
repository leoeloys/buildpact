import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  hasApprovalMarker,
  countClarificationMarkers,
  requireApprovedSpec,
  createSpecBypass,
} from '../../../src/engine/spec-first-gate.js'

describe('hasApprovalMarker', () => {
  it('detects [APPROVED]', () => {
    expect(hasApprovalMarker('Some spec\n[APPROVED]\nMore text')).toBe(true)
  })

  it('detects status: approved', () => {
    expect(hasApprovalMarker('---\nstatus: approved\n---')).toBe(true)
  })

  it('detects emoji marker', () => {
    expect(hasApprovalMarker('Review: ✅ Approved by team')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(hasApprovalMarker('[approved]')).toBe(true)
  })

  it('returns false when no marker present', () => {
    expect(hasApprovalMarker('This spec is still in draft')).toBe(false)
  })
})

describe('countClarificationMarkers', () => {
  it('counts zero when none present', () => {
    expect(countClarificationMarkers('Clean spec with no issues')).toBe(0)
  })

  it('counts multiple markers', () => {
    const content = '[NEEDS CLARIFICATION: auth] and [NEEDS CLARIFICATION: scope]'
    expect(countClarificationMarkers(content)).toBe(2)
  })

  it('counts single marker', () => {
    expect(countClarificationMarkers('[NEEDS CLARIFICATION]')).toBe(1)
  })
})

describe('requireApprovedSpec', () => {
  let tmpDir: string

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
  })

  it('fails when spec file does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-test-'))
    const result = await requireApprovedSpec(tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SPEC_NOT_APPROVED')
  })

  it('fails when spec has no approval marker', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-test-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'spec.md'), 'Draft spec content')
    const result = await requireApprovedSpec(tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SPEC_NOT_APPROVED')
  })

  it('succeeds with approved spec', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-test-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'spec.md'), '# Spec\n[APPROVED]\nContent here')
    const result = await requireApprovedSpec(tmpDir)
    expect(result.ok).toBe(true)
  })

  it('fails when too many clarification markers', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bp-test-'))
    await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
    const content = '[APPROVED]\n[NEEDS CLARIFICATION: a]\n[NEEDS CLARIFICATION: b]\n[NEEDS CLARIFICATION: c]\n[NEEDS CLARIFICATION: d]'
    await writeFile(join(tmpDir, '.buildpact', 'spec.md'), content)
    const result = await requireApprovedSpec(tmpDir)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('SPEC_NOT_APPROVED')
  })
})

describe('createSpecBypass', () => {
  it('creates bypass record with reason and timestamp', () => {
    const bypass = createSpecBypass('Hotfix for production')
    expect(bypass.bypassed).toBe(true)
    expect(bypass.reason).toBe('Hotfix for production')
    expect(bypass.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
