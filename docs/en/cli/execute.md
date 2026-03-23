# buildpact execute

Execute the plan with subagent isolation.

## Usage

```bash
buildpact execute [options]
```

## Options

| Flag | Description |
|------|------------|
| `--plan` | Path to the plan directory |
| `--budget` | Override the default budget |

## Examples

```bash
# Execute the current plan
buildpact execute

# Execute a specific plan
buildpact execute --plan .buildpact/plans/auth-plan

# Execute with a custom budget
buildpact execute --budget 5.00
```

Each task gets isolated context and an atomic git commit.

## Related Commands

- [`plan`](/en/cli/plan) — Generate a wave-based implementation plan
- [`verify`](/en/cli/verify) — Guided acceptance testing
