# buildpact specify

Capture a requirement as a structured spec.

## Usage

```bash
buildpact specify "description" [options]
```

## Options

| Flag | Description |
|------|------------|
| `--description` | Provide literal text, skip interactive mode |

## Examples

```bash
# Interactive specification capture
buildpact specify "user auth with email"

# Non-interactive with literal description
buildpact specify --description "Add JWT-based authentication with email/password login"
```

Generates a `spec.md` containing user story, acceptance criteria, and requirements.

## Related Commands

- [`plan`](/en/cli/plan) — Generate a wave-based implementation plan from a spec
