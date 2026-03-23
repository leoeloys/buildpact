# Software Squad

![Validated](https://img.shields.io/badge/BuildPact-Validated-brightgreen)

A full-stack software development Squad for the BuildPact framework. Covers the full specification → planning → execution → verification lifecycle.

## Agents

| Agent | Role | Autonomy |
|-------|------|----------|
| Chief (PM) | Captures requirements, writes specs, drives the pipeline | L2 |
| Specialist (Architect / Developer) | Designs architecture and implements code | L2 |
| Support (QA) | Writes tests, validates acceptance criteria, catches regressions | L2 |
| Reviewer (Tech Writer / Code Reviewer) | Reviews code, writes docs, ensures quality gates | L2 |

## Use Cases

- Building web apps, APIs, CLIs, or libraries from natural-language specifications
- Running spec → plan → execute → verify cycles with AI assistance
- Managing architecture decisions and technical debt
- Producing documentation alongside code

## Installation

```bash
npx buildpact squad add software
```

The Squad installs to `.buildpact/squads/software/` and activates automatically with your next BuildPact command.

## License

MIT
