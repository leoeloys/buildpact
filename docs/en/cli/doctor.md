# buildpact doctor

Health check for your BuildPact project.

## Usage

```bash
buildpact doctor [options]
```

## Options

| Flag | Description |
|------|------------|
| `--smoke` | Run squad smoke tests |

## Examples

```bash
# Run a standard health check
buildpact doctor

# Include squad smoke tests
buildpact doctor --smoke
```

Checks Node.js version, Git availability, config validity, squad definitions, and constitution integrity.

## Related Commands

- [`init`](/en/cli/init) — Initialize a new project
