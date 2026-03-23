import { describe, it, expect } from 'vitest'
import { runBenchmarks } from '../../../src/benchmark/index.js'
import type { BenchmarkReport, BenchmarkResult, MemoryResult } from '../../../src/benchmark/index.js'

// ---------------------------------------------------------------------------
// Structure Validation (does NOT re-run expensive benchmarks — validates shape)
// ---------------------------------------------------------------------------

describe('benchmark report structure', () => {
  let report: BenchmarkReport

  // Run benchmarks once for all structure tests
  it('runBenchmarks returns a report object', async () => {
    report = await runBenchmarks()
    expect(report).toBeDefined()
    expect(typeof report).toBe('object')
  }, 30_000) // generous timeout for child_process spawns

  it('report has required top-level fields', () => {
    expect(report.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(report.nodeVersion).toMatch(/^v\d+/)
    expect(report.platform).toBeTruthy()
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(typeof report.overallPass).toBe('boolean')
    expect(Array.isArray(report.results)).toBe(true)
    expect(Array.isArray(report.memoryResults)).toBe(true)
  })

  it('results array contains expected metric names', () => {
    const names = report.results.map((r) => r.name)
    expect(names).toContain('cli-startup')
    expect(names).toContain('command-parse')
    expect(names).toContain('squad-load')
    expect(names).toContain('constitution-check')
    expect(names).toContain('audit-write')
    expect(names).toContain('audit-burst-100')
  })

  it('each result has metric, target, actual, and pass fields', () => {
    for (const r of report.results) {
      expect(typeof r.name).toBe('string')
      expect(r.name.length).toBeGreaterThan(0)
      expect(typeof r.targetMs).toBe('number')
      expect(r.targetMs).toBeGreaterThan(0)
      expect(typeof r.actualMs).toBe('number')
      expect(typeof r.pass).toBe('boolean')
      expect(typeof r.iterations).toBe('number')
      expect(typeof r.medianMs).toBe('number')
      expect(typeof r.timestamp).toBe('string')
    }
  })

  it('all targets are positive numbers', () => {
    for (const r of report.results) {
      expect(r.targetMs).toBeGreaterThan(0)
    }
    for (const m of report.memoryResults) {
      expect(m.targetMB).toBeGreaterThan(0)
    }
  })

  it('memoryResults contains standard-operation-rss', () => {
    const names = report.memoryResults.map((m) => m.name)
    expect(names).toContain('standard-operation-rss')
  })

  it('memory result has required fields', () => {
    for (const m of report.memoryResults) {
      expect(typeof m.name).toBe('string')
      expect(typeof m.targetMB).toBe('number')
      expect(typeof m.actualMB).toBe('number')
      expect(typeof m.peakMB).toBe('number')
      expect(typeof m.deltaMB).toBe('number')
      expect(typeof m.pass).toBe('boolean')
      expect(typeof m.timestamp).toBe('string')
    }
  })

  it('overallPass is true only when all individual results pass', () => {
    const allTimingPass = report.results.every((r) => r.pass)
    const allMemoryPass = report.memoryResults.every((m) => m.pass)
    expect(report.overallPass).toBe(allTimingPass && allMemoryPass)
  })

  it('JSON output is serializable', () => {
    const json = JSON.stringify(report)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(report.version)
    expect(parsed.results.length).toBe(report.results.length)
    expect(parsed.memoryResults.length).toBe(report.memoryResults.length)
  })
})
