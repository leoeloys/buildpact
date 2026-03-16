# Project Constitution — {{project_name}}

> This is the project constitution for {{project_name}}.
> It defines the immutable rules injected into every AI context window (FR-202).
> Edit this file carefully — changes affect ALL pipeline sessions.

---

## Immutable Principles

### Coding Standards
<!-- Define your coding standards here (e.g., TypeScript strict mode, ESM modules, naming conventions) -->
- Spec before code — no implementation begins without a reviewed specification
- Atomic commits — one commit per completed task: `type(phase): description`
- Context discipline — orchestrators ≤300 lines; subagents receive only task payload
- No binary files — all artifacts are Markdown, JSON, or YAML (human-readable, Git-diffable)
- Document large files — any file >500 lines must be auto-sharded with `index.md`

### Compliance Requirements
<!-- List applicable compliance frameworks: CFM, ANVISA, LGPD, HIPAA, GDPR, etc. -->
<!-- Remove this section if not applicable -->
- None by default — add project-specific compliance requirements here

### Architectural Constraints
<!-- Define architectural boundaries and constraints -->
<!-- Examples: layered architecture, no circular dependencies, specific patterns required -->
- Layered dependency order: contracts ← foundation ← engine ← commands ← cli
- No circular dependencies between modules
- All fallible functions return Result<T, CliError> — never throw for business errors

### Quality Gates
<!-- Define quality thresholds that must be met before code is merged -->
- All tests must pass before any commit
- No regressions allowed in existing test suite
- Code review required for all non-trivial changes

## Domain-Specific Rules
<!-- Add rules that apply when specific Squads are active -->
<!-- Examples: medical disclaimers for health squads, legal boilerplate for compliance squads -->
- None by default — add Squad-specific rules here

---

## Version History
| Date | Change | Reason |
|------|--------|--------|
| {{created_at}} | Initial creation | Project setup |
