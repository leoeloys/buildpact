# ADR-000 — ESM + TypeScript strict mode with Result<T> error handling

**Status:** accepted
**Date:** 2026-03-15
**Deciders:** BuildPact core team

---

## Context and Problem Statement

BuildPact is a CLI framework distributed as an npm package. We need to choose a module system, type-checking strategy, and error-handling pattern that support a clean, testable, maintainable codebase for a long-lived tool that evolves across many user stories.

## Decision Drivers

* Modern Node.js (≥20.x) natively supports ES Modules
* TypeScript strict mode catches the most bugs at compile time
* CLI tools need predictable, composable error handling without uncaught exception crashes
* Subagent-style autonomous execution requires explicit error propagation to the caller

## Considered Options

* **Option A** — ESM + TypeScript strict + `Result<T, CliError>` railway-oriented errors
* **Option B** — CommonJS + TypeScript non-strict + `throw/catch` exceptions
* **Option C** — ESM + TypeScript strict + `throw/catch` exceptions

## Decision Outcome

**Chosen option: Option A**, because it maximises type-safety and predictability in a CLI context where crashes are disruptive and error paths must be explicitly handled by the caller.

### Positive Consequences

* All `.js` extension imports enforce ESM resolution at compile time
* `strict: true` + `noUncheckedIndexedAccess: true` eliminate entire classes of runtime bugs
* `Result<T, CliError>` makes every failure path visible in function signatures
* `ok()` / `err()` helpers keep error construction concise and consistent

### Negative Consequences

* ESM `.js` imports on TypeScript source files confuse newcomers
* `noUncheckedIndexedAccess` requires non-null assertions (`!`) for known-safe map lookups
* All callers must unwrap `Result` before using the value

## Pros and Cons of the Options

### Option A — ESM + TS strict + Result

* ✅ Native ESM works without bundler transpilation in Node.js 20+
* ✅ Strict mode catches `undefined` index access, missing properties, etc.
* ✅ `Result<T>` forces explicit error handling — no forgotten `try/catch`
* ❌ `.js` extension in `.ts` imports is confusing at first
* ❌ Slightly more verbose error propagation than `throw`

### Option B — CJS + TS non-strict + throw/catch

* ✅ Familiar to most JS developers
* ❌ `require()` interop gets messy with dual CJS/ESM packages
* ❌ Non-strict mode lets `undefined` bugs reach production silently
* ❌ Exception stack traces are harder to handle programmatically in autonomous agents

### Option C — ESM + TS strict + throw/catch

* ✅ ESM + strict benefits
* ❌ Exception handling is not visible in function types — callers may forget to wrap
* ❌ Autonomous subagents cannot inspect exception shapes without instanceof checks

## Links

* Relates to [ADR-001 AutoResearch isolation](ADR-001-autoResearch-isolation.md) (pending)
* Implemented in `src/contracts/errors.ts` (`ok`, `err`, `ERROR_CODES`)
* Referenced in `CONTRIBUTING.md` code style section
