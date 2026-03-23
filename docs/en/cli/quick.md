# buildpact quick

All-in-one: from description to committed code in a single command.

## Usage

```bash
buildpact quick "description" [options]
```

## Options

| Flag | Description |
|------|------------|
| `--discuss` | Ask clarifying questions before starting |
| `--full` | Run the full pipeline (specify, plan, execute, verify) |

## Examples

```bash
# Quick implementation from a one-liner
buildpact quick "add dark mode toggle to settings page"

# Ask clarifying questions first
buildpact quick "user auth with OAuth" --discuss

# Run the full pipeline with verification
buildpact quick "REST API for products" --full
```

## Related Commands

- [`specify`](/en/cli/specify) — Capture a requirement as a structured spec
- [`plan`](/en/cli/plan) — Generate a wave-based implementation plan
- [`execute`](/en/cli/execute) — Execute the plan with subagent isolation
