# buildpact verify

Guided acceptance testing.

## Usage

```bash
buildpact verify [options]
```

## Options

| Flag | Description |
|------|------------|
| `--spec` | Path to the spec to verify against |

## Examples

```bash
# Verify against the current spec
buildpact verify

# Verify against a specific spec
buildpact verify --spec .buildpact/specs/auth-spec.md
```

Walks through each acceptance criterion and generates a fix plan for any failures.

## Related Commands

- [`execute`](/en/cli/execute) — Execute the plan with subagent isolation
- [`specify`](/en/cli/specify) — Capture a requirement as a structured spec
