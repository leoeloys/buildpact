# Story 18.4: Performance Budget Validation

Status: ready-for-dev

## Story

As a tech lead evaluating BuildPact for production use,
I want automated benchmarks that validate BuildPact meets its stated performance budgets,
So that I can trust it won't degrade my team's workflow.

## Acceptance Criteria

**AC-1: Core Performance Metrics**

Given the performance benchmark suite
When `npm run benchmark` is executed
Then it measures and reports:
- CLI startup time (target: <500ms)
- Command parse time (target: <50ms)
- Squad load time (target: <100ms)
- Constitution check time (target: <200ms)
- Audit write time (target: <10ms)

**AC-2: Failure Reporting**

Given any measurement exceeds its target
When the benchmark report is generated
Then the failing metric is highlighted with the actual value vs target
And the overall benchmark exits with code 1

**AC-3: CI-Compatible JSON Output**

Given the benchmark suite
When it runs in CI (GitHub Actions)
Then it produces a machine-readable JSON report compatible with benchmark tracking tools
And the JSON includes for each metric: name, target (ms), actual (ms), pass/fail, timestamp

**AC-4: Memory Usage Budget**

Given the memory usage benchmark
When a standard operation runs (single squad, 50 tasks)
Then resident memory stays below 256MB as measured by `process.memoryUsage().rss`

## Tasks / Subtasks

- [ ] Task 1: Create benchmark script infrastructure (AC: #1, #3)
  - [ ] 1.1: Create `scripts/benchmark.ts` as a standalone Node.js script (no Vitest dependency) that exports a `runBenchmarks()` function and serves as CLI entry point
  - [ ] 1.2: Define the `BenchmarkResult` interface: `{ name: string; targetMs: number; actualMs: number; pass: boolean; timestamp: string }`
  - [ ] 1.3: Define the `BenchmarkReport` interface: `{ version: string; nodeVersion: string; platform: string; results: BenchmarkResult[]; memoryResults: MemoryResult[]; overallPass: boolean; timestamp: string }`
  - [ ] 1.4: Implement a `measure(name, targetMs, fn)` helper that runs `fn`, records wall-clock time via `performance.now()`, and returns a `BenchmarkResult`
  - [ ] 1.5: Add a `"benchmark": "node dist/benchmark.mjs"` script to `package.json` (build step must compile `scripts/benchmark.ts` to `dist/benchmark.mjs`)

- [ ] Task 2: Implement CLI startup benchmark (AC: #1)
  - [ ] 2.1: Spawn `node dist/index.mjs --help` as a child process using `child_process.execFile`
  - [ ] 2.2: Measure wall-clock time from spawn to process exit (not from import — real cold-start measurement)
  - [ ] 2.3: Run 3 iterations and report the median to reduce variance
  - [ ] 2.4: Target: <500ms

- [ ] Task 3: Implement command parse benchmark (AC: #1)
  - [ ] 3.1: Import `resolveCommand` from `src/commands/registry.ts` programmatically
  - [ ] 3.2: Measure time to resolve each registered command name (plan, execute, specify, quick, squad, verify)
  - [ ] 3.3: Run 5 iterations per command and report the median
  - [ ] 3.4: Target: <50ms per command resolution

- [ ] Task 4: Implement squad load benchmark (AC: #1)
  - [ ] 4.1: Measure time to load the Software Squad definition from `templates/squads/software/squad.yaml`
  - [ ] 4.2: Include parsing of all agent files referenced by the squad (architect.md, developer.md, pm.md, qa.md, tech-writer.md)
  - [ ] 4.3: Run 3 iterations and report the median
  - [ ] 4.4: Target: <100ms

- [ ] Task 5: Implement constitution check benchmark (AC: #1)
  - [ ] 5.1: Import the constitution enforcer from `src/engine/constitution-enforcer.ts`
  - [ ] 5.2: Create a minimal mock payload that exercises the enforcement logic without LLM calls
  - [ ] 5.3: Measure time for a full enforcement check pass
  - [ ] 5.4: Run 3 iterations and report the median
  - [ ] 5.5: Target: <200ms

- [ ] Task 6: Implement audit write benchmark (AC: #1)
  - [ ] 6.1: Import the AuditLogger from `src/foundation/audit.ts`
  - [ ] 6.2: Measure time to write a single audit entry (JSONL append operation)
  - [ ] 6.3: Also measure a burst of 100 sequential writes to detect I/O bottlenecks
  - [ ] 6.4: Use a temporary directory for audit file output (clean up after benchmark)
  - [ ] 6.5: Target: <10ms per single write

- [ ] Task 7: Implement memory usage benchmark (AC: #4)
  - [ ] 7.1: Simulate a standard operation: load a squad, create 50 mock task objects, run constitution check on each
  - [ ] 7.2: Measure `process.memoryUsage().rss` before and after the operation
  - [ ] 7.3: Record peak RSS and delta RSS in the report
  - [ ] 7.4: Target: peak RSS <256MB

- [ ] Task 8: Implement report generation and exit code logic (AC: #2, #3)
  - [ ] 8.1: Generate human-readable console output with pass/fail indicators for each metric
  - [ ] 8.2: Highlight failing metrics with actual vs target values
  - [ ] 8.3: Write JSON report to `.buildpact/reports/benchmark-report.json`
  - [ ] 8.4: Exit with code 0 if all pass, code 1 if any fail

- [ ] Task 9: Vitest integration test (AC: #1, #2, #3)
  - [ ] 9.1: Create `test/unit/benchmark/benchmark-structure.test.ts` that imports `runBenchmarks()` and validates the report structure
  - [ ] 9.2: Verify the JSON report contains all expected metric names
  - [ ] 9.3: Verify exit code logic (mock a failing metric and assert code 1)
  - [ ] 9.4: Do NOT re-run the actual benchmarks in Vitest — only validate report structure and logic

- [ ] Task 10: CI integration (AC: #3)
  - [ ] 10.1: Add a benchmark step to `.github/workflows/test.yml` that runs `npm run benchmark` after tests pass
  - [ ] 10.2: Upload `.buildpact/reports/benchmark-report.json` as a workflow artifact
  - [ ] 10.3: Ensure the benchmark step does not block PR merges (use `continue-on-error: true` initially while baselines stabilize)

## Dev Notes

### Architecture

The benchmark is a **standalone Node.js script** that does not depend on Vitest or any test framework. It uses only Node.js built-in APIs: `child_process` for CLI startup measurement, `performance.now()` for timing, `process.memoryUsage()` for memory, and `fs` for report output.

The script should be structured as:
1. A library module (`scripts/benchmark.ts`) with exported `runBenchmarks()` function
2. A CLI entry point at the bottom that calls `runBenchmarks()` and handles exit codes
3. The build step compiles this to `dist/benchmark.mjs` alongside the main CLI

### Source Files to Benchmark

| Metric | Source File | What to Measure |
|---|---|---|
| CLI startup | `src/cli/index.ts` | Cold-start: spawn `node dist/index.mjs --help` as child process |
| Command parse | `src/commands/registry.ts` | `resolveCommand()` for each registered command |
| Squad load | `src/engine/orchestrator.ts`, `src/squads/` | Load squad YAML + parse all referenced agent .md files |
| Constitution check | `src/engine/constitution-enforcer.ts` | Full enforcement pass with mock payload (no LLM) |
| Audit write | `src/foundation/audit.ts` | Single JSONL append via AuditLogger |
| Memory | All above combined | `process.memoryUsage().rss` during simulated 50-task operation |

### JSON Report Format

```json
{
  "version": "0.1.0-alpha.5",
  "nodeVersion": "v20.x.x",
  "platform": "linux",
  "timestamp": "2026-03-22T12:00:00.000Z",
  "overallPass": true,
  "results": [
    {
      "name": "cli-startup",
      "targetMs": 500,
      "actualMs": 312,
      "pass": true,
      "iterations": 3,
      "medianMs": 312,
      "timestamp": "2026-03-22T12:00:01.000Z"
    }
  ],
  "memoryResults": [
    {
      "name": "standard-operation-rss",
      "targetMB": 256,
      "actualMB": 128,
      "peakMB": 142,
      "deltaMB": 14,
      "pass": true,
      "timestamp": "2026-03-22T12:00:05.000Z"
    }
  ]
}
```

### Anti-Patterns to Avoid

- Do NOT use `vitest bench` or any benchmark library (e.g., tinybench, benchmark.js) — write a simple Node.js script with `performance.now()` and `child_process`
- Do NOT measure LLM API call times — only measure BuildPact's own file I/O and computation overhead
- Do NOT require network access or API keys — all benchmarks must run fully offline
- Do NOT hardcode absolute paths — use `import.meta.url`, `process.cwd()`, and relative path resolution
- Do NOT skip JSON output — CI integration depends on machine-readable reports
- Do NOT create large benchmark fixtures — use minimal but representative payloads (e.g., Software Squad with 5 agents, 50 lightweight task stubs)
- Do NOT run benchmarks inside Vitest's test runner for actual timing — Vitest's module transforms and test isolation add overhead that skews results

### Measurement Strategy

- **Median over multiple iterations** to reduce variance from OS scheduling and disk cache effects
- **CLI startup uses child_process spawn** for true cold-start measurement (not in-process import)
- **All other benchmarks use in-process measurement** via `performance.now()` for precision
- **Memory benchmark uses `process.memoryUsage().rss`** which is Node.js native, zero dependencies
- **Warm-up run** before timing iterations for in-process benchmarks (first run loads modules)

### References

- FR-1504 (PRD v2.3.0): automated benchmark suite requirement (priority: SHOULD)
- Story 17-4: prior performance profiling work, results in `.buildpact/reports/performance-profile.md`
- NFR-02: orchestrator context window budget (<=15%), payload size (<=20KB)
- `.github/workflows/test.yml`: existing CI workflow to add benchmark step
- `package.json`: add `"benchmark"` script

### Build Integration

The benchmark script needs to be included in the build output. Options:
1. Add `scripts/benchmark.ts` as a secondary entry point in the tsdown config
2. Or compile it separately with a dedicated build script

The `package.json` script should be: `"benchmark": "node dist/benchmark.mjs"` — this assumes the build produces the file. The build config (tsdown) may need an additional entry point.

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List
### Change Log
- Story created by create-story workflow (Date: 2026-03-22)
