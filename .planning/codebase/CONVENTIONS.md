# Coding Conventions

**Analysis Date:** 2026-03-22

## Naming Patterns

**Files:**
- `kebab-case.ts` for all source files: `budget-guard.ts`, `wave-executor.ts`, `squad-scaffolder.ts`
- `handler.ts` for command implementation logic, `index.ts` for command entry/re-export
- Test files mirror source paths exactly: `src/engine/orchestrator.ts` → `test/unit/engine/orchestrator.test.ts`

**Functions:**
- `camelCase` for exported functions: `loadOrchestratorTemplate`, `buildTaskPayload`, `enforceConstitution`
- `camelCase` for private functions: `parseYamlNumber`, `isProhibitionRule`, `interpolate`
- Action-verb prefix pattern: `load*`, `save*`, `build*`, `format*`, `validate*`, `resolve*`, `read*`, `create*`

**Variables and Constants:**
- `camelCase` for variables: `tmpDir`, `filePath`, `lowerOutput`
- `SCREAMING_SNAKE_CASE` for module-level constants: `MAX_ORCHESTRATOR_LINES`, `PROHIBITION_KEYWORDS`, `STUB_COST_PER_TASK_USD`, `CONSTITUTION_FILE`
- Error codes in `SCREAMING_SNAKE_CASE` defined in the `ERROR_CODES` const object: `SQUAD_NOT_FOUND`, `FILE_READ_FAILED`

**Types and Interfaces:**
- `PascalCase` for interfaces: `CliError`, `AuditEntry`, `InstallOptions`, `CommandHandler`
- `PascalCase` for type aliases: `Result`, `ErrorCode`, `CommandId`, `AuditOutcome`
- `PascalCase` for classes: `AuditLogger`
- `type` imports separated from value imports: `import type { Result } from '../contracts/errors.js'`

**i18n Keys:**
- `dot.notation.snake_case` hierarchy: `error.engine.file_read_failed`, `cli.constitution.violation.title_expert`
- Prefix by domain: `error.*`, `cli.*`

## Code Style

**Formatting:**
- No dedicated formatter config detected (no `.prettierrc`, no `biome.json`)
- TypeScript compiler enforces style via strict `tsconfig.json`
- Single quotes for strings throughout
- Trailing commas in multi-line object/array literals
- 2-space indentation (consistent across all files)

**TypeScript Configuration (`tsconfig.json`):**
- `strict: true` — all strict checks enabled
- `exactOptionalPropertyTypes: true` — optional properties must be explicitly `T | undefined`, not assignable from missing
- `noUncheckedIndexedAccess: true` — array/object indexing returns `T | undefined`
- `module: NodeNext` with `moduleResolution: NodeNext`
- All imports use explicit `.js` extension (ESM): `import { ok } from '../contracts/errors.js'`
- `import type` used consistently for type-only imports

**Linting:**
- `tsc --noEmit` is the lint command (no ESLint or Biome)
- TypeScript itself serves as the linter

## Import Organization

**Order:**
1. Node built-ins with `node:` prefix: `import { readFile } from 'node:fs/promises'`
2. Third-party packages: `import * as clack from '@clack/prompts'`
3. Internal contracts (type imports): `import type { Result } from '../contracts/errors.js'`
4. Internal implementation modules: `import { loadConstitution } from '../foundation/constitution.js'`

**Path Aliases:**
- None — all paths are relative with explicit `.js` extensions
- Layer boundaries: `contracts` → `foundation` → `engine` → `commands` (no upward imports)

**Namespace imports:**
- `import * as clack from '@clack/prompts'` used for TUI library (avoids named import sprawl)

## Error Handling

**Core pattern — `Result<T>` type, never throw for business logic:**
```typescript
// All fallible functions return Result<T>
export type Result<T, E = CliError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

// Constructors
export function ok<T>(value: T): Result<T> { return { ok: true, value } }
export function err<T = never>(error: CliError): Result<T> { return { ok: false, error } }
```

**CliError shape — always include code + i18nKey:**
```typescript
return err({
  code: ERROR_CODES.FILE_READ_FAILED,
  i18nKey: 'error.engine.file_read_failed',
  params: { path: filePath },   // optional interpolation params
  cause,                         // optional: wrap original error
})
```

**Error codes:**
- All codes defined in `ERROR_CODES` const object in `src/contracts/errors.ts`
- `SCREAMING_SNAKE_CASE` string literals
- `as const` assertion provides `ErrorCode` union type

**Throw is reserved for programming errors (invariant violations) only.**

**Result checking pattern:**
```typescript
const result = await loadConstitution(projectDir)
if (!result.ok) {
  // handle error — result.error is CliError
  return result // propagate or handle
}
// result.value is safe here
```

**Node ENOENT handling:**
```typescript
} catch (cause) {
  if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
    return err({ code: ERROR_CODES.CONSTITUTION_NOT_FOUND, i18nKey: 'error.constitution.not_found' })
  }
  return err({ code: ERROR_CODES.FILE_READ_FAILED, i18nKey: 'error.file.read_failed', cause })
}
```

**Async fallback returning boolean (existence checks):**
```typescript
export async function constitutionExists(projectDir: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}
```

## Logging

**Framework:** `AuditLogger` class from `src/foundation/audit.ts` — append-only JSONL

**Pattern:**
```typescript
const auditLogger = new AuditLogger(join(projectDir, '.buildpact', 'audit', 'enforcement.jsonl'))
await auditLogger.log({
  action: 'constitution.enforce.pass',  // module.operation format
  agent: 'orchestrator',
  files: [],
  outcome: 'success',
})
```

**AuditEntry shape:** `ts` (auto), `action`, `agent`, `files`, `outcome`, `error?`, `cost_usd?`, `tokens?`

**User-facing output:** `@clack/prompts` — `clack.log.success()`, `clack.log.warn()`, `clack.log.error()`, `clack.log.info()`, `clack.intro()`, `clack.outro()`

**No `console.log` in production code** — all output routes through clack or AuditLogger.

## Comments and Documentation

**Module-level JSDoc:**
```typescript
/**
 * Pipeline orchestrator — Markdown template loader and compliance validator.
 * @module engine/orchestrator
 * @see FR-301 — Orchestrator size limits (≤300 lines, ≤15% context window)
 */
```

**Function-level JSDoc:**
- Required for all exported functions
- `@param` tags for non-obvious parameters
- `@see` for requirement traceability (FR-xxx, AC-x)

**Inline section dividers:**
```typescript
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
```
Used to structure longer files into logical sections.

**Inline comments:**
- Brief, explain intent not mechanics
- `// No constitution — nothing to enforce` style
- `TODO(Phase):` for deferred work: `// TODO(Beta): Replace structural check with LLM subagent semantic validation.`

## Function Design

**Size:** Functions are small and single-purpose. Large command handlers are the exception (plan/handler.ts at 1250 lines) but they are organized internally with section dividers.

**Parameters:**
- Option objects (`InstallOptions`, `BuildPayloadParams`) used when > 3 parameters
- Explicit `undefined` check before assigning optional fields: `if (params.description !== undefined) payload.description = params.description`

**Return values:**
- Async functions return `Promise<Result<T>>` for fallible operations
- Pure functions return `Result<T>` synchronously for fallible operations
- Boolean for simple existence checks

**Private helpers:**
- Declared as `function` (not exported) within the same module
- Named with action verbs: `parseYamlNumber`, `isProhibitionRule`, `copyDir`

## Module Design

**Exports:**
- Named exports only — no default exports
- `export interface`, `export function`, `export class`, `export type`, `export const`
- Re-export barrel files: `src/foundation/index.ts`, `src/engine/index.ts`, `src/contracts/index.ts`

**Barrel files:**
- Exist at `src/foundation/index.ts`, `src/engine/index.ts`, `src/contracts/index.ts`
- Excluded from coverage (pure re-exports, no logic)

**Class usage:**
- Classes used only when stateful: `AuditLogger` (holds `logPath`)
- Everything else is plain exported functions

**Template interpolation:**
- `{{variable}}` placeholder pattern in Markdown templates
- `interpolate(template, vars)` helper in `src/foundation/installer.ts`

---

*Convention analysis: 2026-03-22*
