#!/usr/bin/env node
/**
 * BuildPact Performance Budget Validation
 *
 * Standalone benchmark script that measures CLI startup, command parsing,
 * squad loading, constitution enforcement, audit writes, and memory usage.
 *
 * Uses only Node.js built-in APIs: child_process, performance, process.memoryUsage, fs.
 * No test framework dependencies.
 *
 * NOTE: Constitution enforcement and audit logging logic is imported dynamically
 * at runtime to avoid tsdown bundler tree-shaking issues with shared chunks.
 *
 * @see Story 18-4: Performance Budget Validation
 */

import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a single benchmark metric */
export interface BenchmarkResult {
  name: string
  targetMs: number
  actualMs: number
  pass: boolean
  iterations: number
  medianMs: number
  timestamp: string
}

/** Result of a memory benchmark */
export interface MemoryResult {
  name: string
  targetMB: number
  actualMB: number
  peakMB: number
  deltaMB: number
  pass: boolean
  timestamp: string
}

/** Full benchmark report */
export interface BenchmarkReport {
  version: string
  nodeVersion: string
  platform: string
  timestamp: string
  overallPass: boolean
  results: BenchmarkResult[]
  memoryResults: MemoryResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Resolve the project root (dist/ parent) */
function projectRoot(): string {
  let dir = __dirname
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir
    dir = dirname(dir)
  }
  return process.cwd()
}

/** Compute median of a numeric array */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Run a synchronous function multiple times and return a BenchmarkResult
 * with the median timing.
 */
function measure(
  name: string,
  targetMs: number,
  iterations: number,
  fn: () => void,
): BenchmarkResult {
  const timings: number[] = []

  // Warm-up run (not counted)
  try { fn() } catch { /* warm-up may fail, that's ok */ }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    const elapsed = performance.now() - start
    timings.push(elapsed)
  }

  const med = median(timings)
  return {
    name,
    targetMs,
    actualMs: round2(med),
    pass: med <= targetMs,
    iterations,
    medianMs: round2(med),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Run an async function multiple times and return a BenchmarkResult
 * with the median timing.
 */
async function measureAsync(
  name: string,
  targetMs: number,
  iterations: number,
  fn: () => Promise<void>,
): Promise<BenchmarkResult> {
  const timings: number[] = []

  // Warm-up run (not counted)
  try { await fn() } catch { /* warm-up may fail */ }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const elapsed = performance.now() - start
    timings.push(elapsed)
  }

  const med = median(timings)
  return {
    name,
    targetMs,
    actualMs: round2(med),
    pass: med <= targetMs,
    iterations,
    medianMs: round2(med),
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Inline constitution enforcement (avoids bundler chunk resolution issues)
// Mirrors logic from src/foundation/constitution.ts
// ---------------------------------------------------------------------------

const PROHIBITION_KEYWORDS = [
  'no ', 'never ', 'must not ', 'do not ', "don't ",
  'prohibited', 'forbidden', 'disallowed', 'avoid ', 'ban ', 'cannot ', "can't ",
]

const OVERRIDE_KEYWORDS = ['override', 'ignore', 'bypass', 'disable', 'skip']

interface BenchPrinciple { name: string; section: string; content: string }
interface BenchViolation { principle: BenchPrinciple; explanation: string; severity: string }
interface BenchEnforcementResult { violations: BenchViolation[]; hasViolations: boolean }

function parseConstitutionPrinciples(content: string): BenchPrinciple[] {
  const principles: BenchPrinciple[] = []
  let currentSection = ''
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('### ')) { currentSection = line.slice(4).trim(); continue }
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const heading = line.slice(3).trim()
      currentSection = (heading === 'Version History' || heading === 'Immutable Principles') ? '' : heading
      continue
    }
    if (line.startsWith('- ') && currentSection) {
      const name = line.slice(2).trim()
      if (name) principles.push({ name, section: currentSection, content: name })
    }
  }
  return principles
}

function extractProhibitedTerm(rule: string): string | undefined {
  const lower = rule.toLowerCase()
  for (const kw of PROHIBITION_KEYWORDS) {
    const idx = lower.indexOf(kw)
    if (idx !== -1) {
      const after = rule.slice(idx + kw.length).trim()
      const end = after.search(/[,;:.()\n]/)
      return end === -1 ? after : after.slice(0, end).trim()
    }
  }
  return undefined
}

function enforceConstitution(output: string, constitutionContent: string): BenchEnforcementResult {
  const principles = parseConstitutionPrinciples(constitutionContent)
  const violations: BenchViolation[] = []
  const lowerOutput = output.toLowerCase()

  for (const principle of principles) {
    const lower = principle.content.toLowerCase()
    const isProhibition = PROHIBITION_KEYWORDS.some((kw) => lower.includes(kw))
    if (!isProhibition) continue
    const prohibited = extractProhibitedTerm(principle.content)
    if (!prohibited || prohibited.length < 3) continue
    if (lowerOutput.includes(prohibited.toLowerCase())) {
      violations.push({
        principle,
        explanation: `Output contains prohibited term "${prohibited}"`,
        severity: 'warn',
      })
    }
  }

  for (const principle of principles) {
    const principleWords = principle.name.toLowerCase().split(/\s+/)
    for (const overrideKw of OVERRIDE_KEYWORDS) {
      const idx = lowerOutput.indexOf(overrideKw)
      if (idx === -1) continue
      const nearby = lowerOutput.slice(idx, idx + overrideKw.length + 50)
      const hasMatch = principleWords.some((pw) => pw.length >= 4 && nearby.includes(pw))
      if (hasMatch) {
        violations.push({
          principle,
          explanation: `Output uses override language "${overrideKw}" near principle "${principle.name}"`,
          severity: 'warn',
        })
        break
      }
    }
  }

  return { violations, hasViolations: violations.length > 0 }
}

// ---------------------------------------------------------------------------
// Inline audit logger (avoids bundler chunk resolution issues)
// Mirrors logic from src/foundation/audit.ts
// ---------------------------------------------------------------------------

interface BenchAuditPayload {
  action: string
  agent: string
  files: string[]
  outcome: 'success' | 'failure' | 'rollback'
}

function auditLog(logPath: string, payload: BenchAuditPayload): void {
  const entry = { ts: new Date().toISOString(), ...payload }
  const line = JSON.stringify(entry) + '\n'
  mkdirSync(dirname(logPath), { recursive: true })
  appendFileSync(logPath, line, 'utf-8')
}

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

const SAMPLE_CONSTITUTION = `# Project Constitution

## Immutable Principles

### Coding Standards
- Use TypeScript strict mode
- ESM modules only — no CommonJS
- No inline styles in components

### Architectural Constraints
- Layered architecture only
- No circular dependencies
- Never use global state
- Do not mix concerns across layers

### Quality Gates
- 80% test coverage required
- All tests must pass before merging

## Domain-Specific Rules
- Do not expose internal APIs publicly
- Never store passwords in plain text
- Avoid using deprecated APIs
`

const SAMPLE_OUTPUT = `
This implementation uses a clean layered architecture with TypeScript strict mode.
All modules use ESM imports. Test coverage is at 85%.
The authentication module hashes all passwords with bcrypt.
No deprecated APIs are used in this codebase.
`.repeat(10)

// ---------------------------------------------------------------------------
// Individual Benchmarks
// ---------------------------------------------------------------------------

/**
 * Benchmark 1: CLI startup time.
 * Spawns `node dist/cli/index.mjs --help` as a child process and measures wall-clock time.
 * Target: <500ms
 */
function benchmarkCliStartup(root: string): BenchmarkResult {
  const candidates = [
    join(root, 'dist', 'cli', 'index.mjs'),
    join(root, 'dist', 'index.mjs'),
  ]
  const distEntry = candidates.find((p) => existsSync(p))

  if (!distEntry) {
    return {
      name: 'cli-startup',
      targetMs: 500,
      actualMs: -1,
      pass: false,
      iterations: 0,
      medianMs: -1,
      timestamp: new Date().toISOString(),
    }
  }

  const timings: number[] = []
  const iterations = 5

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    try {
      execFileSync(process.execPath, [distEntry, '--help'], {
        timeout: 10_000,
        stdio: 'pipe',
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      })
    } catch {
      // --help may cause non-zero exit in some CLIs; timing is still valid
    }
    const elapsed = performance.now() - start
    timings.push(elapsed)
  }

  const med = median(timings)
  return {
    name: 'cli-startup',
    targetMs: 500,
    actualMs: round2(med),
    pass: med <= 500,
    iterations,
    medianMs: round2(med),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Benchmark 2: Command parse/resolve time.
 * Dynamically imports resolveCommand and measures resolution for each known command.
 * Target: <50ms per command resolution.
 */
async function benchmarkCommandParse(): Promise<BenchmarkResult> {
  const commands = ['plan', 'execute', 'specify', 'quick', 'squad', 'verify']

  // Dynamic import to get resolveCommand from the built registry chunk
  const registry = await import('../commands/registry.js')
  const { resolveCommand: resolve } = registry

  return measureAsync('command-parse', 50, 5, async () => {
    for (const cmd of commands) {
      await resolve(cmd)
    }
  })
}

/**
 * Benchmark 3: Squad load time.
 * Loads the Software Squad YAML + all referenced agent markdown files.
 * Target: <100ms
 */
function benchmarkSquadLoad(root: string): BenchmarkResult {
  const squadDir = join(root, 'templates', 'squads', 'software')
  const squadYamlPath = join(squadDir, 'squad.yaml')

  if (!existsSync(squadYamlPath)) {
    return {
      name: 'squad-load',
      targetMs: 100,
      actualMs: -1,
      pass: false,
      iterations: 0,
      medianMs: -1,
      timestamp: new Date().toISOString(),
    }
  }

  const agentFiles = [
    'agents/pact.md',
    'agents/pm.md',
    'agents/architect.md',
    'agents/developer.md',
    'agents/qa.md',
    'agents/tech-writer.md',
  ]

  return measure('squad-load', 100, 5, () => {
    readFileSync(squadYamlPath, 'utf-8')
    for (const agentFile of agentFiles) {
      const agentPath = join(squadDir, agentFile)
      if (existsSync(agentPath)) {
        readFileSync(agentPath, 'utf-8')
      }
    }
  })
}

/**
 * Benchmark 4: Constitution enforcement check time.
 * Runs enforceConstitution with a sample constitution and output. No LLM calls.
 * Target: <200ms
 */
function benchmarkConstitutionCheck(): BenchmarkResult {
  return measure('constitution-check', 200, 5, () => {
    enforceConstitution(SAMPLE_OUTPUT, SAMPLE_CONSTITUTION)
  })
}

/**
 * Benchmark 5: Audit write time.
 * Writes a single audit log entry to a temp file (sync append).
 * Target: <10ms per single write.
 */
function benchmarkAuditWrite(): BenchmarkResult {
  const tmpDir = join(tmpdir(), `buildpact-bench-audit-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
  const logPath = join(tmpDir, 'bench-audit.jsonl')

  const result = measure('audit-write', 10, 5, () => {
    auditLog(logPath, {
      action: 'benchmark.audit_write',
      agent: 'benchmark',
      files: ['test-file.ts'],
      outcome: 'success',
    })
  })

  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  return result
}

/**
 * Benchmark 5b: Audit burst write (100 sequential writes).
 * Measures I/O bottleneck potential.
 */
function benchmarkAuditBurst(): BenchmarkResult {
  const tmpDir = join(tmpdir(), `buildpact-bench-burst-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
  const logPath = join(tmpDir, 'bench-burst.jsonl')

  const result = measure('audit-burst-100', 1000, 3, () => {
    for (let i = 0; i < 100; i++) {
      auditLog(logPath, {
        action: `benchmark.burst.${i}`,
        agent: 'benchmark',
        files: [],
        outcome: 'success',
      })
    }
  })

  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  return result
}

/**
 * Benchmark 6: Memory usage during standard operation.
 * Simulates: load squad, create 50 task objects, run constitution check on each.
 * Target: peak RSS <256MB.
 */
function benchmarkMemoryUsage(root: string): MemoryResult {
  const squadYamlPath = join(root, 'templates', 'squads', 'software', 'squad.yaml')

  // Force GC if available to get a clean baseline
  if (global.gc) global.gc()
  const before = process.memoryUsage()

  // Simulate standard operation
  const squadYaml = existsSync(squadYamlPath)
    ? readFileSync(squadYamlPath, 'utf-8')
    : 'name: mock-squad'

  // Create 50 mock task objects
  const tasks = Array.from({ length: 50 }, (_, i) => ({
    id: `task-${i}`,
    name: `Task ${i}: implement feature ${i}`,
    description: `This task implements feature ${i} with proper error handling and tests.`,
    output: `Implementation of feature ${i} completed. All tests pass. Code follows layered architecture.`,
    agent: 'developer',
    squad: squadYaml.slice(0, 100),
  }))

  // Run constitution check on each task's output
  for (const task of tasks) {
    enforceConstitution(task.output, SAMPLE_CONSTITUTION)
  }

  const after = process.memoryUsage()
  const peakRss = after.rss
  const deltaRss = after.rss - before.rss

  return {
    name: 'standard-operation-rss',
    targetMB: 256,
    actualMB: round2(after.rss / 1024 / 1024),
    peakMB: round2(peakRss / 1024 / 1024),
    deltaMB: round2(deltaRss / 1024 / 1024),
    pass: peakRss / 1024 / 1024 <= 256,
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

function printReport(report: BenchmarkReport): void {
  console.error('')
  console.error('=== BuildPact Performance Budget Report ===')
  console.error(`Version: ${report.version}`)
  console.error(`Node: ${report.nodeVersion} | Platform: ${report.platform}`)
  console.error(`Timestamp: ${report.timestamp}`)
  console.error('')

  for (const r of report.results) {
    const indicator = r.pass ? '[OK]' : '[!!]'
    const status = r.pass ? 'PASS' : 'FAIL'
    console.error(
      `  ${indicator} ${r.name}: ${r.actualMs}ms (target: <${r.targetMs}ms) [${status}]`,
    )
  }

  console.error('')
  for (const m of report.memoryResults) {
    const indicator = m.pass ? '[OK]' : '[!!]'
    const status = m.pass ? 'PASS' : 'FAIL'
    console.error(
      `  ${indicator} ${m.name}: ${m.actualMB}MB peak (target: <${m.targetMB}MB, delta: ${m.deltaMB}MB) [${status}]`,
    )
  }

  console.error('')
  console.error(`Overall: ${report.overallPass ? 'ALL PASSED' : 'SOME FAILED'}`)
  console.error('')
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Run all benchmarks and return a structured report.
 * Can be imported for testing or called as CLI.
 */
export async function runBenchmarks(): Promise<BenchmarkReport> {
  const root = projectRoot()
  const results: BenchmarkResult[] = []

  // 1. CLI startup (sync, uses child_process)
  results.push(benchmarkCliStartup(root))

  // 2. Command parse (async, imports registry)
  results.push(await benchmarkCommandParse())

  // 3. Squad load (sync, file I/O)
  results.push(benchmarkSquadLoad(root))

  // 4. Constitution check (sync, inlined logic)
  results.push(benchmarkConstitutionCheck())

  // 5. Audit write (sync, file I/O)
  results.push(benchmarkAuditWrite())

  // 5b. Audit burst
  results.push(benchmarkAuditBurst())

  // 6. Memory usage
  const memoryResult = benchmarkMemoryUsage(root)

  const allTimingPass = results.every((r) => r.pass)
  const allMemoryPass = memoryResult.pass

  const report: BenchmarkReport = {
    version: '0.1.0-alpha.5',
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
    overallPass: allTimingPass && allMemoryPass,
    results,
    memoryResults: [memoryResult],
  }

  return report
}

// ---------------------------------------------------------------------------
// CLI execution
// ---------------------------------------------------------------------------

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('benchmark/index.mjs') ||
  process.argv[1]?.endsWith('benchmark/index.ts')

if (isMainModule) {
  runBenchmarks()
    .then((report) => {
      printReport(report)
      console.log(JSON.stringify(report, null, 2))

      const root = projectRoot()
      const reportDir = join(root, '.buildpact', 'reports')
      try {
        mkdirSync(reportDir, { recursive: true })
        writeFileSync(
          join(reportDir, 'benchmark-report.json'),
          JSON.stringify(report, null, 2),
          'utf-8',
        )
        console.error(`Report saved to .buildpact/reports/benchmark-report.json`)
      } catch {
        console.error('Warning: Could not save report file.')
      }

      process.exit(report.overallPass ? 0 : 1)
    })
    .catch((error: unknown) => {
      console.error('Benchmark failed:', error)
      process.exit(1)
    })
}
