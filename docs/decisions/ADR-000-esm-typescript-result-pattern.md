# ADR-000: Use ESM + TypeScript + Result<T> Pattern

- Status: accepted
- Deciders: BuildPact core team
- Date: 2026-03-15

## Context and Problem Statement

BuildPact is a CLI tool for AI-assisted software development pipelines. We need to choose the module system, language, and error handling strategy that will be used throughout the codebase.

## Decision Drivers

- TypeScript provides type safety critical for contracts between pipeline stages
- ESM is the modern standard and Node.js default for new projects
- Traditional try/catch error handling loses type information and makes error flow implicit
- Pipeline operations are fallible and must communicate failure reasons clearly

## Considered Options

1. CommonJS + JavaScript + throw/catch
2. ESM + TypeScript + throw/catch
3. ESM + TypeScript + Result<T, E> pattern

## Decision Outcome

Chosen option: "ESM + TypeScript + Result<T, E> pattern", because it provides maximum type safety, explicit error handling, and modern module compatibility.

### Positive Consequences

- All fallible functions return `Result<T, CliError>` — errors are typed and composable
- No accidental unhandled rejections — errors are values, not exceptions
- TypeScript ensures contracts between pipeline stages are enforced at compile time
- ESM enables tree-shaking and better static analysis

### Negative Consequences

- Slightly more verbose than throw/catch for simple cases
- Developers must learn the Result pattern if unfamiliar
- ESM requires `.js` extensions in imports even for `.ts` files
- Some older Node.js libraries may need adaptation for ESM

## Links

- [Result type definition](../../src/contracts/errors.ts)
- [Error codes registry](../../src/contracts/errors.ts)
