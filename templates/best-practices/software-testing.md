# Best Practices — Software Testing

## Test Strategy
- Write tests BEFORE implementation (TDD red-green-refactor)
- Prefer integration tests over unit tests for user-facing flows
- Use snapshot tests only for structured data, never for generated prose
- Each test file mirrors its source file: `src/foo.ts` → `test/foo.test.ts`

## Coverage
- Minimum 80% line coverage for production code
- 100% coverage for error paths and boundary conditions
- Never chase coverage metrics — chase behavior verification

## Test Organization
- Group by behavior, not by method: `describe('when user submits form', ...)`
- Use AAA pattern: Arrange → Act → Assert
- One assertion per test when possible (multiple assertions = multiple behaviors)

## Anti-Patterns
- ✘ Never mock what you don't own — wrap external dependencies first
- ✘ Never test implementation details — test behavior and outcomes
- ✘ Never use `any` in test types — if you can't type it, the design is wrong
- ✘ Never rely on test execution order — each test must be independent

## Edge Cases Checklist
- Empty inputs (null, undefined, "", [], {})
- Boundary values (0, -1, MAX_INT, empty string vs whitespace)
- Unicode and special characters
- Concurrent access patterns
- Network failure simulation
- Timeout behavior
