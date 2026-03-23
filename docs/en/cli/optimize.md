# buildpact optimize

AutoResearch continuous improvement.

## Usage

```bash
buildpact optimize [options]
```

## Options

| Flag | Description |
|------|------------|
| `--budget` | Set the experiment budget |
| `--target` | Target area: `code`, `copy`, or `squad` |

## Examples

```bash
# Run optimization with defaults
buildpact optimize

# Optimize code with a specific budget
buildpact optimize --target code --budget 2.00

# Optimize squad definitions
buildpact optimize --target squad
```

Uses a git ratchet strategy to commit only proven improvements, ensuring quality never regresses.

## Related Commands

- [`execute`](/en/cli/execute) — Execute the plan with subagent isolation
