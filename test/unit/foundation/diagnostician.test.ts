import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { diagnoseProject, formatDiagnosticReport } from '../../../src/foundation/diagnostician.js'
import type { ScanResult } from '../../../src/foundation/scanner.js'

// Mock child_process to avoid real git calls
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
}))

function baseScan(dir: string): ScanResult {
  return {
    packageManagers: [{ name: 'pip', configFile: 'requirements.txt' }],
    languages: ['Python'],
    linters: [{ tool: 'ruff', configFile: 'pyproject.toml', extractedRules: [] }],
    ci: [{ platform: 'github-actions', configFile: '.github/workflows/', qualityGates: ['test', 'lint'] }],
    git: { commitCount: 11, branchCount: 1, contributorCount: 1, firstCommitDate: '2026-03-10', hasUncommittedChanges: false },
    existingAiConfigs: [],
    existingBuildpact: true,
    inferredDomain: 'software',
    projectName: 'test-project',
  }
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'bp-diag-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('diagnoseProject', () => {
  it('discovers SPEC.md and PLAN.md in .buildpact/specs/', async () => {
    const specDir = join(tmpDir, '.buildpact', 'specs', 'my-feature')
    await mkdir(specDir, { recursive: true })
    await writeFile(join(specDir, 'SPEC.md'), '# My Feature Spec\n\nREQ-1.1: User can log in\nREQ-1.2: User can log out\n')
    await writeFile(join(specDir, 'PLAN.md'), '# Implementation Plan\n\nFase 1 — Foundation ✅ Complete\nFase 2 — Core Logic ⏳ In Progress\nFase 3 — Dashboard ❌ Not Started\n')

    const report = await diagnoseProject(tmpDir, baseScan(tmpDir))

    expect(report.documents.length).toBeGreaterThanOrEqual(2)
    const spec = report.documents.find(d => d.type === 'spec')
    expect(spec).toBeDefined()
    expect(spec!.title).toBe('My Feature Spec')

    const plan = report.documents.find(d => d.type === 'plan')
    expect(plan).toBeDefined()
  })

  it('extracts phases from PLAN.md', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'specs', 'x'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'specs', 'x', 'PLAN.md'), [
      '# Plan',
      '',
      'Fase 1 — Foundation ✅ Complete',
      'Fase 2 — Backend ✅ Complete',
      'Fase 3 — Frontend ⏳ In Progress',
      'Fase 4 — Deployment ❌ Not Started',
    ].join('\n'))

    const report = await diagnoseProject(tmpDir, baseScan(tmpDir))

    expect(report.phases.length).toBeGreaterThanOrEqual(4)
    const p1 = report.phases.find(p => p.id === 'fase-1')
    const p2 = report.phases.find(p => p.id === 'fase-2')
    const p3 = report.phases.find(p => p.id === 'fase-3')
    const p4 = report.phases.find(p => p.id === 'fase-4')
    expect(p1?.status).toBe('complete')
    expect(p2?.status).toBe('complete')
    expect(p3?.status).toBe('in-progress')
    expect(p4?.status).toBe('not-started')
  })

  it('extracts requirements from SPEC.md', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'specs', 'x'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'specs', 'x', 'SPEC.md'), [
      '# Spec',
      '',
      'REQ-1.1: User registration',
      'REQ-1.2: Login with email',
      'FR-101: API returns 200 on success',
      'AC-1: User sees welcome page',
    ].join('\n'))

    const report = await diagnoseProject(tmpDir, baseScan(tmpDir))

    expect(report.requirements.length).toBe(4)
    expect(report.requirements.map(r => r.id)).toContain('REQ-1.1')
    expect(report.requirements.map(r => r.id)).toContain('FR-101')
    expect(report.requirements.map(r => r.id)).toContain('AC-1')
  })

  it('collects code metrics from Python files', async () => {
    const appDir = join(tmpDir, 'backend', 'app')
    await mkdir(appDir, { recursive: true })
    await writeFile(join(appDir, 'main.py'), 'from fastapi import FastAPI\napp = FastAPI()\n')
    await writeFile(join(appDir, 'service.py'), 'def hello():\n    return "world"\n\ndef goodbye():\n    return "bye"\n')

    const testsDir = join(tmpDir, 'backend', 'tests')
    await mkdir(testsDir, { recursive: true })
    await writeFile(join(testsDir, 'test_main.py'), 'def test_hello():\n    assert True\n')

    const report = await diagnoseProject(tmpDir, baseScan(tmpDir))

    expect(report.metrics.totalFiles).toBe(3)
    expect(report.metrics.testFiles).toBe(1)
    expect(report.metrics.totalLines).toBeGreaterThan(0)
    expect(report.metrics.byDirectory['backend']).toBeDefined()
  })

  it('assesses quality signals', async () => {
    const report = await diagnoseProject(tmpDir, baseScan(tmpDir))

    const positive = report.qualitySignals.filter(s => s.category === 'positive')
    expect(positive.length).toBeGreaterThan(0)

    // Should detect linter from scan
    const linterSignal = positive.find(s => s.description.includes('ruff'))
    expect(linterSignal).toBeDefined()

    // Should detect CI from scan
    const ciSignal = positive.find(s => s.description.includes('github-actions'))
    expect(ciSignal).toBeDefined()
  })

  it('generates recommendations', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'specs', 'x'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'specs', 'x', 'PLAN.md'), [
      '# Plan',
      'Fase 1 — Done ✅ Complete',
      'Fase 2 — Next ❌ Not Started',
    ].join('\n'))

    const report = await diagnoseProject(tmpDir, baseScan(tmpDir))

    expect(report.recommendations.length).toBeGreaterThan(0)
    // Should recommend next phase
    const nextPhase = report.recommendations.find(r => r.includes('fase-2'))
    expect(nextPhase).toBeDefined()
  })
})

describe('formatDiagnosticReport', () => {
  it('produces markdown in English', async () => {
    await mkdir(join(tmpDir, '.buildpact', 'specs', 'x'), { recursive: true })
    await writeFile(join(tmpDir, '.buildpact', 'specs', 'x', 'SPEC.md'), '# Test Spec\nREQ-1: Something\n')

    const report = await diagnoseProject(tmpDir, baseScan(tmpDir))
    const md = formatDiagnosticReport(report, 'en')

    expect(md).toContain('# Project Diagnostic')
    expect(md).toContain('Documents Found')
    expect(md).toContain('Code Metrics')
    expect(md).toContain('Quality Assessment')
    expect(md).toContain('Recommendations')
  })

  it('produces markdown in Portuguese', async () => {
    const report = await diagnoseProject(tmpDir, baseScan(tmpDir))
    const md = formatDiagnosticReport(report, 'pt-br')

    expect(md).toContain('# Diagnóstico do Projeto')
    expect(md).toContain('Documentos Encontrados')
    expect(md).toContain('Métricas do Código')
    expect(md).toContain('Qualidade')
    expect(md).toContain('Recomendações')
  })
})
