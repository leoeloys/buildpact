# buildpact plan

Generate a wave-based implementation plan.

## Usage

```bash
buildpact plan [options]
```

## Options

| Flag | Description |
|------|------------|
| `--research` | Enable parallel research before planning |
| `--spec` | Path to a spec file |

## Examples

```bash
# Generate a plan from the current spec
buildpact plan

# Plan with parallel research enabled
buildpact plan --research

# Plan from a specific spec file
buildpact plan --spec .buildpact/specs/auth-spec.md
```

Generates a `plan.md` with waves, research summary, and validation steps.

## Related Commands

- [`specify`](/en/cli/specify) — Capture a requirement as a structured spec
- [`execute`](/en/cli/execute) — Execute the plan with subagent isolation
