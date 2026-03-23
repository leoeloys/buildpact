# Best Practices — Architecture Patterns

## Layered Architecture
- Strict unidirectional dependencies: UI → Application → Domain → Infrastructure
- Never import upward: Domain must not import from Application
- Each layer has a clear responsibility — no logic leaks

## SOLID Principles
- Single Responsibility: one reason to change per module
- Open/Closed: extend through composition, not modification
- Liskov Substitution: subtypes must be substitutable for their base
- Interface Segregation: many specific interfaces over one general
- Dependency Inversion: depend on abstractions, not concretions

## Error Handling
- Use Result types for expected failures (not exceptions)
- Exceptions only for truly unexpected situations (programmer errors)
- Never silently swallow errors — log or propagate
- Define error codes at the boundary — internal layers use typed errors

## Module Design
- Max 300 lines per file — split if larger
- One public API per module (index.ts exports)
- Internal files are implementation details — never import directly
- Circular dependencies are architecture bugs — fix the design

## Anti-Patterns
- ✘ Never create a util/helper module — find the right home for the function
- ✘ Never add a dependency without checking its maintenance status
- ✘ Never design for hypothetical future requirements
- ✘ Never allow god objects/modules that do everything
