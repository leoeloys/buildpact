# Testing Patterns

**Analysis Date:** 2026-03-22

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`
- Globals mode: `globals: true` — `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` available without import (but explicitly imported in test files anyway)

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Mocking:**
- Vitest built-in (`vi.mock`, `vi.fn`, `vi.spyOn`, `vi.mocked`)

**Run Commands:**
```bash
npm test                   # Run all tests (vitest run)
npm run test:watch         # Watch mode (vitest)
npm run test:coverage      # Coverage report (vitest run --coverage)
```

## Test File Organization

**Location:**
- Separate `test/` directory — not co-located with source
- Mirrors `src/` directory structure exactly

**Naming:**
- `{module-name}.test.ts` — one test file per source file
- Examples: `src/foundation/constitution.ts` → `test/unit/foundation/constitution.test.ts`

**Structure:**
```
test/
├── unit/
│   ├── commands/        # Command handler unit tests
│   ├── contracts/       # Contract shape and completeness tests
│   ├── engine/          # Engine module unit tests
│   ├── foundation/      # Foundation module unit tests
│   ├── optimize/        # Optimize module unit tests
│   ├── squads/          # Squad loader/validator unit tests
│   └── community/       # Community hub unit tests
├── integration/
│   └── pipeline/        # Multi-module integration tests (AC-level flows)
├── e2e/
│   ├── pipeline/        # Full specify→plan→execute→verify E2E tests
│   ├── personas/        # Persona validation scripts
│   └── helpers.ts       # Shared E2E infrastructure
├── fixtures/
│   ├── projects/        # Pre-built .buildpact/ project fixtures
│   └── squads/          # Squad YAML fixtures
└── snapshots/
    ├── quick/           # Structural snapshot baselines for quick command
    └── specify/         # Structural snapshot baselines for specify command
```

## Test Structure

**Suite Organization:**
```typescript
// Explicit imports (even with globals: true, imports are used for type safety)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Top-level vi.mock() calls before describe blocks (hoisted by Vitest)
vi.mock('@clack/prompts', () => ({ ... }))
vi.mock('../../../src/foundation/audit.js', () => ({ ... }))

// Section dividers for readability
// ---------------------------------------------------------------------------
// functionName
// ---------------------------------------------------------------------------

describe('functionName', () => {
  // Setup with temp filesystem
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-{module}-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('describes behavior using plain English', async () => {
    // arrange - act - assert
  })
})
```

**Test naming:** Plain English behavior descriptions — `'returns undefined when constitution does not exist'`, `'extracts all named sections from a standard constitution'`

**Patterns:**
- `beforeEach` / `afterEach` for filesystem setup and teardown
- `vi.clearAllMocks()` called in `beforeEach` when mocks are complex
- `vi.restoreAllMocks()` called in `afterEach` for `vi.spyOn` cleanup
- One `describe` block per exported function or logical feature area

## Mocking

**Framework:** Vitest `vi` module

**Module mocking — `vi.mock()` (hoisted, declared at top of test file):**
```typescript
// @clack/prompts — prevents interactive TTY in CI
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  log: { success: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  isCancel: vi.fn(() => false),
}))

// AuditLogger — prevents real JSONL writes during tests
vi.mock('../../../src/foundation/audit.js', () => ({
  AuditLogger: class {
    log = vi.fn().mockResolvedValue(undefined)
  },
}))

// node:child_process — prevents real git/shell commands
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
  execSync: vi.fn(() => ''),
}))
```

**Spy mocking — `vi.spyOn()` for targeted overrides:**
```typescript
vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
// Always cleaned up with vi.restoreAllMocks() in afterEach
```

**Per-test mock behavior — `vi.mocked()` with `mockResolvedValueOnce` / `mockImplementationOnce`:**
```typescript
vi.mocked(clack.text).mockResolvedValueOnce('fix broken login')
vi.mocked(clack.isCancel).mockReturnValue(true)
vi.mocked(clack.confirm)
  .mockResolvedValueOnce(true)   // first call
  .mockResolvedValueOnce(false)  // second call
```

**Injected function mocks (dependency injection pattern):**
Some modules accept functions as parameters instead of using `vi.mock`. This is the preferred pattern for pure logic:
```typescript
const execFn = vi.fn().mockReturnValue('abc123\n')
const result = createIsolatedBranch('optimize/code/session/ts', execFn)
```

**What to mock:**
- `@clack/prompts` — always (interactive TUI)
- `src/foundation/audit.js` — always (writes to filesystem)
- `node:child_process` — when testing git/shell command handlers
- External module state that would pollute other tests

**What NOT to mock:**
- `node:fs/promises` — real filesystem via temp directories is preferred
- Pure business logic modules — test them directly
- `src/contracts/errors.js` — always use real `ok`/`err` helpers

## Fixtures and Factories

**Temp filesystem fixtures (most common pattern):**
```typescript
beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'buildpact-{module}-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// Write fixture files inline in tests
await mkdir(join(tmpDir, '.buildpact'), { recursive: true })
await writeFile(join(tmpDir, '.buildpact', 'constitution.md'), SAMPLE_CONSTITUTION, 'utf-8')
```

**String fixture constants:**
```typescript
// Defined at module top with template literal
const SAMPLE_CONSTITUTION = `# Project Constitution — Acme

## Immutable Principles
...`
```

**Option factory pattern (lazy evaluation):**
```typescript
// Factory evaluated inside test so beforeEach has run first
const opts = (overrides: Partial<InstallOptions> = {}): InstallOptions => ({
  projectName: 'my-project',
  language: 'en',
  domain: 'software',
  ...overrides,   // caller overrides specific fields
})
```

**Static fixtures location:**
- `test/fixtures/projects/minimal/.buildpact/` — minimal pre-built project
- `test/fixtures/squads/software/` — squad YAML fixtures

**E2E helper (`test/e2e/helpers.ts`):**
- `createTempProject(opts)` — creates full `.buildpact/` structure with config, constitution, squad
- `runBpCommand(dir, command, args)` — invokes command handler programmatically with cwd mocked
- `fileExists(path)` — async boolean check
- `extractMarkdownStructure(content)` — structural snapshot analysis
- `compareStructures(actual, expected)` — returns diff strings for snapshot validation

## Coverage

**Requirements:**
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%
- Thresholds apply only to covered files (files with at least one test executing them)

**Excluded from coverage:**
- `src/cli/index.ts` — interactive TUI entry point
- `src/commands/*/index.ts` — re-export stubs
- `src/commands/registry.ts` — command registry
- `src/contracts/budget.ts`, `i18n.ts`, `profile.ts`, `squad.ts`, `task.ts` — interface-only files
- `src/foundation/index.ts`, `src/engine/index.ts` — barrel re-exports

**View coverage:**
```bash
npm run test:coverage
# Reports: text (terminal) + lcov (coverage/ directory)
open coverage/index.html
```

## Test Types

**Unit Tests (`test/unit/`):**
- Scope: single module in isolation
- Mock all I/O side effects with `vi.mock`
- Use real temp filesystem for file-writing modules (avoids mocking `node:fs/promises`)
- Import functions via dynamic `await import(...)` when testing handler internals that are not exported

**Integration Tests (`test/integration/pipeline/`):**
- Scope: multi-module flows from command handler to filesystem
- Each file tests one acceptance criteria (AC) flow end-to-end
- Test naming by story: `describe('AC-1: Constitution creation', ...)`, `describe('AC-3: Task payload injection', ...)`
- Use real temp filesystem; mock only TUI (`@clack/prompts`) and `AuditLogger`
- Dynamic import of handler modules inside tests to pick up `vi.mock` replacements

**E2E Tests (`test/e2e/pipeline/`):**
- Scope: full `specify → plan → execute → verify` pipeline
- Uses `createTempProject()` / `runBpCommand()` helpers
- LLM calls mocked — tests validate structural output, not LLM content
- Bilingual — tests run in both `en` and `pt-br` configurations
- Structural snapshots via `extractMarkdownStructure` + `compareStructures`

## Common Patterns

**Async testing:**
```typescript
it('reads experience_level from frontmatter', async () => {
  await writeFile(join(tmpDir, '.buildpact', 'project-context.md'), content)
  const level = await readExperienceLevel(tmpDir)
  expect(level).toBe('expert')
})
```

**Result unwrapping:**
```typescript
it('returns list of installed resources', async () => {
  const result = await install(opts())
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.value.installedResources.length).toBeGreaterThan(0)
  }
})
```

**Error path testing:**
```typescript
it('returns CONSTITUTION_NOT_FOUND when file missing', async () => {
  const result = await loadConstitution(tmpDir)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error.code).toBe('CONSTITUTION_NOT_FOUND')
  }
})
```

**Dynamic import for handler internals:**
```typescript
// Needed when the module uses top-level vi.mock replacements
it('extracts tasks from Acceptance Criteria section', async () => {
  const { extractTasksFromSpec } = await import('../../../src/commands/plan/handler.js')
  const tasks = extractTasksFromSpec(spec)
  expect(tasks).toHaveLength(3)
})
```

**i18n key resolution testing:**
```typescript
it('EN enforcement keys resolve', () => {
  const i18n = createI18n('en')
  for (const key of ENFORCEMENT_KEYS) {
    const value = i18n.t(key, { principle: 'Test', section: 'Test' })
    expect(value).not.toMatch(/^\[CLI_/)  // unresolved keys return [KEY_NAME]
  }
})
```

**Mock i18n inline:**
```typescript
const mockI18n = {
  lang: 'en' as const,
  t: (key: string, params?: Record<string, string>) => {
    if (key === 'cli.constitution.violation.title_expert') return `Violation: ${params?.principle}`
    return key
  },
}
```

---

*Testing analysis: 2026-03-22*
